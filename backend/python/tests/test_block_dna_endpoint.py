"""
Endpoint-level regression for Block DNA snapshot persistence.

Covers the actual player path end to end, offline and in-memory:

    claim (with a FORGED client dnaId)
      -> server resolves and stores its own snapshot
      -> the marked grid_data['grid']['tiles'] board uses that DNA layout
      -> place / tick / collect
      -> reload through /api/blocks/my-blocks
      -> the same snapshot comes back, and the forged id was never trusted

The unit-level guarantees (cross-language parity, catalog invariants, malformed
reads) live in test_block_dna_snapshot.py. This file exists to prove those
guarantees actually hold through the Flask routes a player hits, because that
is where the original defect lived: the serializer simply omitted the DNA.

Requires no Supabase, secrets, migrations or scheduler — it runs against the
in-memory dev adapter, like the Gate 0B slice test.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from services.block_dna import (
    DNA_SNAPSHOT_KEY,
    DNA_SNAPSHOT_SCHEMA,
    build_dna_snapshot,
    get_catalog_cards,
)
from services.db import (
    _mock_blocks,
    _mock_placements,
    _mock_player_heat,
    _mock_profiles,
)

ADDRESS = '900 Test Boulevard, Miami, FL'
REQUESTED = {'lat': 25.7617, 'lng': -80.1918}

SNAPSHOT_FIELDS = (
    'dnaId', 'catalogVersion', 'zoneLayout', 'incomeMultiplier',
    'heatDecayMultiplier', 'globalCoverBonus', 'startingMorale',
    'maxMembers', 'startingHeat', 'hotBlock',
)


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


@pytest.fixture(autouse=True)
def clear_mocks():
    for store in (_mock_blocks, _mock_placements, _mock_profiles, _mock_player_heat):
        store.clear()
    yield
    for store in (_mock_blocks, _mock_placements, _mock_profiles, _mock_player_heat):
        store.clear()


def _forged_id_for(address, lat, lng):
    """An elite card the server will NOT pick for this location."""
    honest = build_dna_snapshot(lat, lng, address)['dnaId']
    for card in get_catalog_cards('v2'):
        if card['id'] != honest and card['incomeMultiplier'] >= 2.0:
            return card['id']
    raise AssertionError('catalog has no alternate elite card to forge with')


def _claim(client, auth_headers, dna_id=None):
    payload = {
        'address': ADDRESS,
        'coordinates': dict(REQUESTED),
        'city': 'miami',
        'gangName': 'Test Crew',
    }
    if dna_id is not None:
        payload['dnaId'] = dna_id
    response = client.post('/api/blocks/claim', json=payload, headers=auth_headers)
    assert response.status_code == 201, response.get_json()
    return response.get_json()['block']


def test_claim_ignores_forged_dna_id_and_survives_reload(client, auth_headers):
    forged = _forged_id_for(ADDRESS, REQUESTED['lat'], REQUESTED['lng'])
    block = _claim(client, auth_headers, dna_id=forged)
    block_id = block['id']

    # ── The claim response carries a server-selected snapshot ────────────────
    snapshot = block['dnaSnapshot']
    assert snapshot, 'claim must return a DNA snapshot'
    assert block['dnaId'] == snapshot['dnaId']
    assert snapshot['schema'] == DNA_SNAPSHOT_SCHEMA
    for field in SNAPSHOT_FIELDS:
        assert field in snapshot, field
    assert len(snapshot['zoneLayout']) == 8

    # ── The forged client id was not trusted ─────────────────────────────────
    assert snapshot['dnaId'] != forged
    assert block['dnaId'] != forged

    # ── The snapshot is what the server would independently resolve ──────────
    coords = block['coordinates']
    expected = build_dna_snapshot(coords['lat'], coords['lng'], block['address'])
    assert {f: snapshot[f] for f in SNAPSHOT_FIELDS} == {f: expected[f] for f in SNAPSHOT_FIELDS}

    # ── grid_data survived the additive write ────────────────────────────────
    # NOTE ON SHAPE: generate_block_grid().to_dict() nests the board under
    # 'grid' ({'grid': {...,'tiles': [...]}, 'metadata': {...}}), so the tiles
    # live at grid_data['grid']['tiles'] and there is no top-level 'tiles' key —
    # before this change and after it. The snapshot is written as a top-level
    # sibling, so it cannot collide with or shadow the board payload.
    grid = block['gridData']
    assert grid['grid']['tiles'], 'the generated board must survive the snapshot write'
    assert len(grid['grid']['tiles']) == 8
    assert grid['metadata'], 'grid metadata must survive the snapshot write'
    assert grid['metadata']['gridContract']['name'] == 'block-dna-grid'
    assert grid['metadata']['gridContract']['version'] == 1
    assert [row[0]['type'] for row in grid['grid']['tiles']] == snapshot['zoneLayout']
    assert grid[DNA_SNAPSHOT_KEY] == snapshot
    assert set(grid) == {'grid', 'metadata', DNA_SNAPSHOT_KEY}
    stored_grid = grid['grid']

    # ── Play the block, then reload ──────────────────────────────────────────
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

    tick = client.post(f'/api/blocks/{block_id}/tick-income', headers=auth_headers)
    assert tick.status_code == 200
    assert tick.get_json()['block']['dnaSnapshot'] == snapshot

    collect = client.post(f'/api/blocks/{block_id}/collect', headers=auth_headers)
    assert collect.status_code == 200
    assert collect.get_json()['block']['dnaSnapshot'] == snapshot

    mine = client.get('/api/blocks/my-blocks', headers=auth_headers)
    assert mine.status_code == 200
    blocks = mine.get_json()['blocks']
    assert len(blocks) == 1
    reloaded = blocks[0]

    # ── The reload returns the same identity, and still not the forgery ──────
    assert reloaded['id'] == block_id
    assert reloaded['dnaSnapshot'] == snapshot
    assert reloaded['dnaId'] == snapshot['dnaId']
    assert reloaded['dnaId'] != forged
    assert reloaded['gridData']['grid'] == stored_grid
    assert reloaded['gridData'][DNA_SNAPSHOT_KEY] == snapshot


def test_single_block_fetch_returns_the_same_snapshot(client, auth_headers):
    block = _claim(client, auth_headers)
    # This route returns the block payload unwrapped.
    response = client.get(f"/api/blocks/{block['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()['dnaSnapshot'] == block['dnaSnapshot']


def test_claim_without_a_client_dna_id_still_snapshots(client, auth_headers):
    block = _claim(client, auth_headers)
    assert block['dnaSnapshot']
    assert block['dnaId'] == block['dnaSnapshot']['dnaId']


def test_two_claims_of_the_same_address_resolve_identically(client, auth_headers):
    first = _claim(client, auth_headers)
    _mock_blocks.clear()
    _mock_placements.clear()
    second = _claim(client, auth_headers)
    assert second['dnaSnapshot'] == first['dnaSnapshot']


def test_pre_snapshot_record_reports_no_snapshot(client, auth_headers):
    """
    A block claimed before this shipped has no '__dna__' key. It must serialize
    as null so the client falls back to its pinned legacy resolver, rather than
    the serializer inventing an identity.
    """
    block = _claim(client, auth_headers)
    stored = _mock_blocks[block['id']]
    stored['grid_data'] = {k: v for k, v in stored['grid_data'].items() if k != DNA_SNAPSHOT_KEY}

    mine = client.get('/api/blocks/my-blocks', headers=auth_headers)
    assert mine.status_code == 200
    legacy = mine.get_json()['blocks'][0]
    assert legacy['dnaSnapshot'] is None
    assert legacy['dnaId'] is None
    assert legacy['gridData']['grid']['tiles'], 'the board must be untouched by the removal'
