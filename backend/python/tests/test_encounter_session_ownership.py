"""Request-level encounter ownership contracts with synthetic verified users."""

import copy
import os
import sys
from unittest.mock import Mock

import pytest
from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import api.combat as combat
import api.driveby as driveby
from middleware.auth import DEV_USER
from services.block_state_engine import BlockSnapshot, MemberSnapshot, TileSnapshot


USER_A = {'id': 'synthetic-user-a', 'role': 'authenticated'}
USER_B = {'id': 'synthetic-user-b', 'role': 'authenticated'}
HEADERS_A = {'Authorization': 'Bearer synthetic-token-a'}
HEADERS_B = {'Authorization': 'Bearer synthetic-token-b'}


@pytest.fixture
def encounter_app(monkeypatch):
    monkeypatch.setattr(combat, 'combat_sessions', {})
    monkeypatch.setattr(driveby, 'driveby_sessions', {})
    users = {'synthetic-token-a': USER_A, 'synthetic-token-b': USER_B}
    monkeypatch.setattr(
        'middleware.auth._verify_token',
        lambda token: copy.deepcopy(users.get(token)),
    )
    snapshot = BlockSnapshot(
        block_id='synthetic-block',
        snapshot_id='synthetic-snapshot',
        snapshot_version=1,
        created_at='2026-10-15T00:00:00',
        address='1208 Fictional Way',
        city='Fictional City',
        bbox=[0, 0, 1, 1],
        center=[0.5, 0.5],
        grid_width=2,
        grid_height=2,
        tiles=[[
            TileSnapshot(
                x=x,
                y=y,
                tile_type='sidewalk',
                terrain_bonus={'cover': 0},
                member_id='synthetic-defender' if (x, y) == (1, 1) else None,
            )
            for x in range(2)
        ] for y in range(2)],
        members=[MemberSnapshot(
            id='synthetic-defender',
            role='shooter',
            stats={'health': 100, 'defense': 0},
            position={'x': 1, 'y': 1},
            loadout={},
        )],
        heat_level=0,
        income_rate=0,
        defense_rating=0,
        fortification_level=0,
        seed='synthetic-seed',
    )
    engine = Mock()
    engine.create_snapshot.return_value = snapshot.snapshot_id
    engine.get_block_snapshot.return_value = snapshot
    monkeypatch.setattr(combat, 'get_block_state_engine', lambda: engine)
    monkeypatch.setattr(driveby, 'get_block_state_engine', lambda: engine)

    app = Flask(__name__)
    app.config.update(TESTING=True, SUPABASE_URL='https://synthetic.invalid')
    app.register_blueprint(combat.combat_bp)
    app.register_blueprint(driveby.driveby_bp)
    return app, engine


def start_session(client, kind, headers):
    payload = {
        'target_block_id': 'synthetic-block',
        # The caller cannot choose the authenticated session owner.
        'owner_id': USER_B['id'],
    }
    if kind == 'combat':
        payload.update(
            attacker_gang_id='synthetic-gang',
            attacker_members=['synthetic-attacker'],
        )
    else:
        payload.update(shooters=['synthetic-attacker'], vehicle={'speed': 50})
    response = client.post(f'/api/{kind}/start', json=payload, headers=headers)
    assert response.status_code == 201, response.get_json()
    return response.get_json()['session_id']


def session_store(kind):
    return combat.combat_sessions if kind == 'combat' else driveby.driveby_sessions


def call_session_route(client, route, session_id, headers):
    if route == 'combat-read':
        return client.get(f'/api/combat/{session_id}', headers=headers)
    if route == 'combat-turn':
        return client.post('/api/combat/turn', headers=headers, json={
            'session_id': session_id,
            'action': {'type': 'retreat'},
        })
    if route == 'driveby-shoot':
        return client.post('/api/driveby/shoot', headers=headers, json={
            'session_id': session_id,
            'target_tile': {'x': 1, 'y': 1},
        })
    return client.post(f'/api/driveby/{session_id}/complete', headers=headers)


ROUTES = ['combat-read', 'combat-turn', 'driveby-shoot', 'driveby-complete']


@pytest.mark.parametrize('kind', ['combat', 'driveby'])
def test_start_binds_session_to_verified_caller(encounter_app, kind):
    app, _ = encounter_app
    session_id = start_session(app.test_client(), kind, HEADERS_A)

    assert session_store(kind)[session_id]['owner_id'] == USER_A['id']


@pytest.mark.parametrize('route', ROUTES)
@pytest.mark.parametrize('case', ['foreign', 'missing', 'ownerless'])
def test_unavailable_sessions_share_404_without_work_or_mutation(encounter_app, route, case):
    app, engine = encounter_app
    client = app.test_client()
    kind = route.split('-')[0]
    session_id = start_session(client, kind, HEADERS_A)
    store = session_store(kind)
    if case == 'ownerless':
        store[session_id].pop('owner_id', None)
    before = copy.deepcopy(store)
    engine.reset_mock()

    missing = call_session_route(client, route, 'missing-session', HEADERS_A)
    response = call_session_route(
        client,
        route,
        'another-missing-session' if case == 'missing' else session_id,
        HEADERS_B if case == 'foreign' else HEADERS_A,
    )

    assert missing.status_code == response.status_code == 404
    assert response.get_json() == missing.get_json()
    assert store == before
    engine.get_block_snapshot.assert_not_called()
    engine.create_snapshot.assert_not_called()


@pytest.mark.parametrize('route', ROUTES)
def test_verified_owner_can_continue_the_session(encounter_app, route):
    app, _ = encounter_app
    client = app.test_client()
    kind = route.split('-')[0]
    session_id = start_session(client, kind, HEADERS_A)

    response = call_session_route(client, route, session_id, HEADERS_A)

    assert response.status_code == 200, response.get_json()
    if route == 'combat-read':
        assert response.get_json()['current_turn'] == 0
    elif route == 'combat-turn':
        assert response.get_json()['status'] == 'defender_victory'
        assert session_store(kind)[session_id]['current_turn'] == 1
    elif route == 'driveby-shoot':
        assert response.get_json()['shots_remaining'] == 2
        assert session_store(kind)[session_id]['shots_fired'] == 1
    else:
        assert response.get_json()['completed'] is True
        assert session_id not in session_store(kind)


@pytest.mark.parametrize('route', ROUTES)
def test_unverified_request_cannot_access_session(encounter_app, route):
    app, engine = encounter_app
    client = app.test_client()
    kind = route.split('-')[0]
    session_id = start_session(client, kind, HEADERS_A)
    before = copy.deepcopy(session_store(kind))
    engine.reset_mock()

    response = call_session_route(client, route, session_id, {
        'Authorization': 'Bearer synthetic-invalid-token',
    })

    assert response.status_code == 401
    assert session_store(kind) == before
    engine.get_block_snapshot.assert_not_called()


@pytest.mark.parametrize('kind', ['combat', 'driveby'])
def test_offline_dev_owner_can_start_and_continue(encounter_app, kind):
    app, _ = encounter_app
    app.config['SUPABASE_URL'] = None
    client = app.test_client()
    session_id = start_session(client, kind, {})

    assert session_store(kind)[session_id]['owner_id'] == DEV_USER['id']
    routes = ['combat-read', 'combat-turn'] if kind == 'combat' else ['driveby-shoot', 'driveby-complete']
    for route in routes:
        response = call_session_route(client, route, session_id, {})
        assert response.status_code == 200, response.get_json()
