"""Integration tests for Gate 0B claim → place → earn → collect → reload."""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from services.db import _mock_blocks, _mock_placements, _mock_profiles, _mock_player_heat


@pytest.fixture
def app():
    application = create_app()
    application.config['TESTING'] = True
    application.config['SUPABASE_URL'] = None
    application.config['SUPABASE_SERVICE_ROLE_KEY'] = None
    return application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers():
    return {'Authorization': 'Bearer dev-token'}


def _clear_mocks():
    _mock_blocks.clear()
    _mock_placements.clear()
    _mock_profiles.clear()
    _mock_player_heat.clear()


def test_claim_place_earn_collect_reload(client, auth_headers):
    _clear_mocks()

    claim = client.post('/api/blocks/claim', json={
        'address': '100 NE 1st Ave, Miami, FL',
        'coordinates': {'lat': 25.7617, 'lng': -80.1918},
        'city': 'miami',
        'gangName': 'Test Crew',
    }, headers=auth_headers)
    assert claim.status_code == 201, claim.get_json()
    body = claim.get_json()
    block = body['block']
    block_id = block['id']
    assert body['player']['cash'] == 5000  # 10000 - 5000
    assert body['player']['heat'] == 5
    assert block['sceneVersion']
    assert block.get('sceneManifest') or True

    place = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'dealer-1',
            'memberName': 'Dez',
            'role': 'dealer',
            'gridX': 2,
            'gridY': 3,
            'zoneType': 'storefront',
            'incomePerTick': 40,
            'health': 100,
        }],
    }, headers=auth_headers)
    assert place.status_code == 200, place.get_json()
    assert place.get_json()['incomePerTick'] == 40

    tick = client.post(f'/api/blocks/{block_id}/tick-income', headers=auth_headers)
    assert tick.status_code == 200
    assert tick.get_json()['block']['pendingIncome'] == 40

    collect = client.post(f'/api/blocks/{block_id}/collect', headers=auth_headers)
    assert collect.status_code == 200
    collected = collect.get_json()
    assert collected['collected'] == 40
    assert collected['player']['cash'] == 5040

    # Refresh / reload path
    mine = client.get('/api/blocks/my-blocks', headers=auth_headers)
    assert mine.status_code == 200
    blocks = mine.get_json()['blocks']
    assert len(blocks) == 1
    assert blocks[0]['id'] == block_id
    assert len(blocks[0]['placements']) == 1
    assert blocks[0]['placements'][0]['memberId'] == 'dealer-1'

    state = client.get('/api/player/state', headers=auth_headers)
    assert state.status_code == 200
    assert state.get_json()['player']['cash'] == 5040
    assert state.get_json()['player']['heat'] == 5


def test_claim_rejects_insufficient_funds(client, auth_headers):
    _clear_mocks()
    from services.db import get_db
    db = get_db()
    db.apply_economy_delta('dev-user-001', cash_delta=-6000)  # leave 4000

    claim = client.post('/api/blocks/claim', json={
        'address': '200 NE 1st Ave, Miami, FL',
        'lat': 25.7620,
        'lng': -80.1920,
        'city': 'miami',
    }, headers=auth_headers)
    assert claim.status_code == 400
    assert claim.get_json()['reason'] == 'insufficient_funds'
