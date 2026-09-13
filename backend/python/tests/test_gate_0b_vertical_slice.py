"""Integration tests for Gate 0B claim → place → encounter → earn → reload."""

import copy
import json
import math
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from api.blocks import _placement_income
from services.db import _mock_blocks, _mock_placements, _mock_profiles, _mock_player_heat
from services.block_state_engine import (
    BlockStateEngine,
    MemberSnapshot,
    TileSnapshot,
    _members_from_placements,
)
from services.block_dna import build_dna_snapshot
from services.grid_generator import (
    GridConfig,
    generate_block_grid,
    resolve_block_dna_profile,
    resolve_block_grid_tiles,
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


def _clear_mocks():
    _mock_blocks.clear()
    _mock_placements.clear()
    _mock_profiles.clear()
    _mock_player_heat.clear()


def test_dna_grid_profile_matches_the_client_placement_contract():
    layout = ['street', 'curb', 'sidewalk', 'storefront', 'alley', 'parking', 'rooftop', 'building']
    expected = {
        'street': (0.05, 0.95, False),
        'curb': (0.15, 0.8, True),
        'sidewalk': (0.3, 0.5, True),
        'storefront': (0.6, 0.25, True),
        'alley': (0.8, 0.1, True),
        'parking': (0.35, 0.4, True),
        'rooftop': (0.9, 0.05, True),
        'building': (1.0, 0.0, False),
    }
    generated = generate_block_grid(
        city='miami',
        traffic_score=0.5,
        config=GridConfig(feature_density=0),
        seed='profile-contract',
        zone_layout=layout,
    ).to_dict()

    for y, zone_type in enumerate(layout):
        tile = generated['grid']['tiles'][y][0]
        cover, visibility, deployable = expected[zone_type]
        assert tile['type'] == zone_type
        assert tile['cover'] == cover
        assert tile['visibility'] == visibility
        assert tile['deployable'] is deployable
    tie = generate_block_grid(
        city='miami',
        traffic_score=0.5,
        config=GridConfig(feature_density=0),
        seed='rounding-contract',
        zone_layout=['sidewalk'] * 8,
        global_cover_bonus=0.005,
    ).to_dict()
    assert tie['grid']['tiles'][0][0]['cover'] == 0.31
    assert _placement_income('parking', 'dealer', 1, 0.75) == 23


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
    assert block.get('sceneManifest')
    grid_data = block['gridData']
    contract = grid_data['metadata']['gridContract']
    assert contract == {
        'name': 'block-dna-grid',
        'version': 1,
        'layoutSource': 'block-dna-snapshot',
        'globalCoverBonusApplied': True,
    }
    nested_tiles = grid_data['grid']['tiles']
    assert [row[0]['type'] for row in nested_tiles] == block['dnaSnapshot']['zoneLayout']
    assert all(
        tile['x'] == x and tile['y'] == y
        for y, row in enumerate(nested_tiles)
        for x, tile in enumerate(row)
    )

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
    zone_income = {
        'street': 100, 'curb': 80, 'sidewalk': 60, 'storefront': 40,
        'alley': 20, 'parking': 30, 'rooftop': 0, 'building': 0,
    }
    expected_income = math.floor(
        zone_income[nested_tiles[3][2]['type']]
        * block['dnaSnapshot']['incomeMultiplier'] + 0.5
    )
    assert place.get_json()['incomePerTick'] == expected_income
    assert place.get_json()['placements'][0]['zoneType'] == nested_tiles[3][2]['type']
    assert place.get_json()['placements'][0]['exposureRisk'] == round(nested_tiles[3][2]['visibility'] * 100)

    # The generated board is nested under grid.tiles. The tactical engine must
    # consume that board rather than silently replacing it with its default grid.
    raw_grid_data = _mock_blocks[block_id]['grid_data']
    nested_tiles = raw_grid_data['grid']['tiles']
    encounter = client.post('/api/combat/start', json={
        'attacker_gang_id': 'gang-1',
        'target_block_id': block_id,
        'attacker_members': ['dealer-1'],
    }, headers=auth_headers)
    assert encounter.status_code == 201, encounter.get_json()
    snapshot = encounter.get_json()['target_snapshot']
    assert snapshot['grid_height'] == len(nested_tiles)
    assert snapshot['grid_width'] == len(nested_tiles[0])
    assert snapshot['tiles'][0][0]['tile_type'] == nested_tiles[0][0]['type']
    assert snapshot['tiles'][0][0]['terrain_bonus']['cover'] == nested_tiles[0][0].get('cover', 0.0)
    assert snapshot['tiles'][0][0]['terrain_bonus']['visibility'] == nested_tiles[0][0].get('visibility', 1.0)
    assert snapshot['members'] == [{
        'id': 'dealer-1',
        'role': 'dealer',
        'stats': {'health': 100, 'damage': 10, 'defense': 5},
        'position': {'x': 2, 'y': 3},
        'loadout': {},
    }]
    assert snapshot['tiles'][3][2]['member_id'] == 'dealer-1'
    assert snapshot['heat_level'] == 5

    tick = client.post(f'/api/blocks/{block_id}/tick-income', headers=auth_headers)
    assert tick.status_code == 200
    assert tick.get_json()['block']['pendingIncome'] == expected_income

    collect = client.post(f'/api/blocks/{block_id}/collect', headers=auth_headers)
    assert collect.status_code == 200
    collected = collect.get_json()
    assert collected['collected'] == expected_income
    assert collected['player']['cash'] == 5000 + expected_income

    # Encounter crew-down state uses the same owner-checked replacement seam.
    # Health is monotonic, so a later placement refresh cannot resurrect the
    # member, and the next combat snapshot consumes the saved value.
    injured = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'dealer-1',
            'memberName': 'Dez',
            'role': 'dealer',
            'gridX': 2,
            'gridY': 3,
            'health': 0,
        }],
    }, headers=auth_headers)
    assert injured.status_code == 200, injured.get_json()
    assert injured.get_json()['placements'][0]['health'] == 0

    resurrection = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'dealer-1',
            'gridX': 2,
            'gridY': 3,
            'health': 100,
        }],
    }, headers=auth_headers)
    assert resurrection.status_code == 200, resurrection.get_json()
    assert resurrection.get_json()['placements'][0]['health'] == 0

    post_consequence = client.post('/api/combat/start', json={
        'attacker_gang_id': 'gang-1',
        'target_block_id': block_id,
        'attacker_members': ['dealer-1'],
    }, headers=auth_headers)
    assert post_consequence.status_code == 201, post_consequence.get_json()
    assert post_consequence.get_json()['target_snapshot']['members'][0]['stats']['health'] == 0

    # Refresh / reload path
    _mock_blocks[block_id]['metadata'] = {
        'appliedEncounterResultKeys': ['encounter-1:secured'],
        'lastEncounterResultKey': 'encounter-1:secured',
    }
    mine = client.get('/api/blocks/my-blocks', headers=auth_headers)
    assert mine.status_code == 200
    blocks = mine.get_json()['blocks']
    assert len(blocks) == 1
    assert blocks[0]['id'] == block_id
    assert len(blocks[0]['placements']) == 1
    assert blocks[0]['placements'][0]['memberId'] == 'dealer-1'
    assert blocks[0]['placements'][0]['health'] == 0
    assert blocks[0]['gridData']['grid']['tiles'] == nested_tiles
    assert blocks[0]['dnaId'] == block['dnaId']
    assert blocks[0]['metadata']['lastEncounterResultKey'] == 'encounter-1:secured'

    state = client.get('/api/player/state', headers=auth_headers)
    assert state.status_code == 200
    assert state.get_json()['player']['cash'] == 5000 + expected_income
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


def test_claim_uses_verified_coordinate_city_instead_of_client_label(client, auth_headers):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': 'Fictional Manhattan Reference',
        'coordinates': {'lat': 40.7128, 'lng': -74.0060},
        'city': 'miami',
    }, headers=auth_headers)

    assert claim.status_code == 201, claim.get_json()
    block = claim.get_json()['block']
    assert block['city'] == 'nyc'
    assert _mock_blocks[block['id']]['city'] == 'nyc'


def test_claim_rejects_malformed_coordinates_without_mutating_state(client, auth_headers):
    _clear_mocks()
    from services.db import get_db
    db = get_db()
    cash_before = db.get_player_state('dev-user-001')['cash']
    path = '/api/blocks/claim'
    valid_address = '250 NE 1st Ave, Miami, FL'

    responses = [
        client.post(path, json=[], headers=auth_headers),
        client.post(path, data='{', content_type='application/json', headers=auth_headers),
        client.post(path, json={'address': valid_address, 'coordinates': []}, headers=auth_headers),
        client.post(path, json={
            'address': valid_address,
            'coordinates': {'lat': 'north', 'lng': -80.19},
        }, headers=auth_headers),
        client.post(path, json={
            'address': valid_address,
            'coordinates': {'lat': math.nan, 'lng': -80.19},
        }, headers=auth_headers),
        client.post(path, json={
            'address': valid_address,
            'coordinates': {'lat': 25.76, 'lng': math.inf},
        }, headers=auth_headers),
        client.post(path, json={
            'address': valid_address,
            'coordinates': {'lat': True, 'lng': -80.19},
        }, headers=auth_headers),
        client.post(path, json={
            'address': valid_address,
            'coordinates': {'lat': 91, 'lng': -80.19},
        }, headers=auth_headers),
        client.post(path, json={
            'address': valid_address,
            'coordinates': {'lat': 25.76, 'lng': -181},
        }, headers=auth_headers),
        client.post(path, json={
            'address': valid_address,
            'coordinates': {'lat': 25.76, 'lng': -80.19},
            'gangName': {'name': 'not-text'},
        }, headers=auth_headers),
    ]

    assert [response.status_code for response in responses] == [400] * len(responses)
    assert _mock_blocks == {}
    assert db.get_player_state('dev-user-001')['cash'] == cash_before


def test_placement_rejects_missing_unauthorized_and_invalid_cells(client, auth_headers):
    _clear_mocks()
    missing = client.post('/api/blocks/missing/members/place', json={
        'placements': [],
    }, headers=auth_headers)
    assert missing.status_code == 404

    claim = client.post('/api/blocks/claim', json={
        'address': '300 NE 1st Ave, Miami, FL',
        'coordinates': {'lat': 25.7630, 'lng': -80.1920},
        'city': 'miami',
    }, headers=auth_headers)
    assert claim.status_code == 201, claim.get_json()
    block_id = claim.get_json()['block']['id']

    _mock_blocks[block_id]['owner_id'] = 'different-owner'
    unauthorized = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [],
    }, headers=auth_headers)
    assert unauthorized.status_code == 403
    _mock_blocks[block_id]['owner_id'] = 'dev-user-001'

    malformed_body = client.post(
        f'/api/blocks/{block_id}/members/place',
        json=['not-an-object'],
        headers=auth_headers,
    )
    malformed_list = client.post(
        f'/api/blocks/{block_id}/members/place',
        json={'placements': {}},
        headers=auth_headers,
    )
    malformed_item = client.post(
        f'/api/blocks/{block_id}/members/place',
        json={'placements': ['not-a-placement']},
        headers=auth_headers,
    )
    assert [malformed_body.status_code, malformed_list.status_code, malformed_item.status_code] == [400, 400, 400]
    assert _mock_placements[block_id] == []

    decimal = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{'memberId': 'dealer-1', 'gridX': 2.5, 'gridY': 3}],
    }, headers=auth_headers)
    assert decimal.status_code == 400

    underscored = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{'memberId': 'dealer-1', 'gridX': '2_0', 'gridY': 3}],
    }, headers=auth_headers)
    assert underscored.status_code == 400

    grid = _mock_blocks[block_id]['grid_data']['grid']['tiles']
    blocked = next(tile for row in grid for tile in row if not tile['deployable'])
    non_deployable = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'dealer-1',
            'gridX': blocked['x'],
            'gridY': blocked['y'],
        }],
    }, headers=auth_headers)
    assert non_deployable.status_code == 400

    open_tiles = [tile for row in grid for tile in row if tile['deployable']]
    duplicate_member = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [
            {'memberId': 'dealer-1', 'gridX': open_tiles[0]['x'], 'gridY': open_tiles[0]['y']},
            {'memberId': 'dealer-1', 'gridX': open_tiles[1]['x'], 'gridY': open_tiles[1]['y']},
        ],
    }, headers=auth_headers)
    duplicate_cell = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [
            {'memberId': 'dealer-1', 'gridX': open_tiles[0]['x'], 'gridY': open_tiles[0]['y']},
            {'memberId': 'dealer-2', 'gridX': open_tiles[0]['x'], 'gridY': open_tiles[0]['y']},
        ],
    }, headers=auth_headers)
    assert duplicate_member.status_code == 400
    assert duplicate_cell.status_code == 400

    cap = _mock_blocks[block_id]['grid_data']['__dna__']['maxMembers']
    over_cap = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [
            {'memberId': f'member-{index}', 'gridX': tile['x'], 'gridY': tile['y']}
            for index, tile in enumerate(open_tiles[:cap + 1])
        ],
    }, headers=auth_headers)
    assert over_cap.status_code == 400
    assert _mock_placements[block_id] == []

    open_tile = next(tile for row in grid for tile in row if tile['deployable'])
    over_level = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'dealer-1',
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
            'level': 11,
        }],
    }, headers=auth_headers)
    assert over_level.status_code == 400
    assert _mock_placements[block_id] == []

    for field in ('level', 'health'):
        overflow = client.post(
            f'/api/blocks/{block_id}/members/place',
            data=(
                '{"placements":[{"memberId":"overflow-' + field
                + '","gridX":' + str(open_tile['x'])
                + ',"gridY":' + str(open_tile['y'])
                + ',"' + field + '":1e309}]}'
            ),
            content_type='application/json',
            headers=auth_headers,
        )
        assert overflow.status_code == 400
        assert _mock_placements[block_id] == []

    underscored_health = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'underscored-health',
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
            'health': '1_0',
        }],
    }, headers=auth_headers)
    assert underscored_health.status_code == 400
    assert _mock_placements[block_id] == []

    for field in ('level', 'health', 'facingDeg'):
        boolean = client.post(f'/api/blocks/{block_id}/members/place', json={
            'placements': [{
                'memberId': f'boolean-{field}',
                'gridX': open_tile['x'],
                'gridY': open_tile['y'],
                field: True,
            }],
        }, headers=auth_headers)
        assert boolean.status_code == 400
        assert _mock_placements[block_id] == []

    downed_payload = {'placements': [{
        'memberId': 'dealer-1',
        'gridX': open_tile['x'],
        'gridY': open_tile['y'],
        'health': 0,
    }]}
    open_tile['visibility'] = 0.125
    first = client.post(
        f'/api/blocks/{block_id}/members/place',
        json=downed_payload,
        headers=auth_headers,
    )
    retry = client.post(
        f'/api/blocks/{block_id}/members/place',
        json=downed_payload,
        headers=auth_headers,
    )
    assert first.status_code == 200
    assert retry.status_code == 200
    assert retry.get_json()['placements'][0]['health'] == 0
    assert retry.get_json()['placements'][0]['exposureRisk'] == 13
    assert len(_mock_placements[block_id]) == 1


def test_malformed_placement_body_cannot_clear_saved_members(client, auth_headers):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': '325 NE 1st Ave, Miami, FL',
        'coordinates': {'lat': 25.7632, 'lng': -80.1921},
        'city': 'miami',
    }, headers=auth_headers)
    block_id = claim.get_json()['block']['id']
    grid = _mock_blocks[block_id]['grid_data']['grid']['tiles']
    open_tile = next(tile for row in grid for tile in row if tile['deployable'])
    seeded = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'dealer-1',
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
            'health': 64,
        }],
    }, headers=auth_headers)
    assert seeded.status_code == 200
    saved_before = copy.deepcopy(_mock_placements[block_id])

    malformed = [
        client.post(
            f'/api/blocks/{block_id}/members/place',
            data='{',
            content_type='application/json',
            headers=auth_headers,
        ),
        client.post(
            f'/api/blocks/{block_id}/members/place',
            json={},
            headers=auth_headers,
        ),
        client.post(
            f'/api/blocks/{block_id}/members/place',
            data='',
            content_type='application/json',
            headers=auth_headers,
        ),
    ]
    assert [response.status_code for response in malformed] == [400, 400, 400]
    assert _mock_placements[block_id] == saved_before

    cleared = client.post(
        f'/api/blocks/{block_id}/members/place',
        json={'placements': []},
        headers=auth_headers,
    )
    assert cleared.status_code == 200
    assert _mock_placements[block_id] == []


def test_missing_grid_snapshot_uses_pinned_fallback_without_crashing(client, auth_headers):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': '340 NE 1st Ave, Miami, FL',
        'coordinates': {'lat': 25.7634, 'lng': -80.19215},
        'city': 'miami',
    }, headers=auth_headers)
    block_id = claim.get_json()['block']['id']
    _mock_blocks[block_id]['grid_data'] = {}

    response = client.post(
        f'/api/blocks/{block_id}/members/place',
        json={'placements': []},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert _mock_placements[block_id] == []


def test_placement_rejects_unowned_database_member_without_mutation(
    client,
    auth_headers,
    monkeypatch,
):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': '350 NE 1st Ave, Miami, FL',
        'coordinates': {'lat': 25.7635, 'lng': -80.1922},
        'city': 'miami',
    }, headers=auth_headers)
    block_id = claim.get_json()['block']['id']
    grid = _mock_blocks[block_id]['grid_data']['grid']['tiles']
    open_tile = next(tile for row in grid for tile in row if tile['deployable'])

    from services.db import get_db
    db = get_db()
    monkeypatch.setattr(db, 'get_owned_members', lambda _owner, _ids: [])
    response = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': '00000000-0000-4000-8000-000000000999',
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
        }],
    }, headers=auth_headers)

    assert response.status_code == 400
    assert _mock_placements[block_id] == []


def test_owned_roster_member_can_be_readded_downed_after_pending_removal(
    client,
    auth_headers,
    monkeypatch,
):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': '355 NE 1st Ave, Miami, FL',
        'coordinates': {'lat': 25.76355, 'lng': -80.19225},
        'city': 'miami',
    }, headers=auth_headers)
    block_id = claim.get_json()['block']['id']
    grid = _mock_blocks[block_id]['grid_data']['grid']['tiles']
    open_tile = next(tile for row in grid for tile in row if tile['deployable'])
    member_id = '00000000-0000-4000-8000-000000000222'

    from services.db import get_db
    db = get_db()
    monkeypatch.setattr(db, 'get_owned_members', lambda _owner, _ids: [{
        'id': member_id,
        'status': 'active',
        'name': 'Confirmed Defender',
        'role': 'shooter',
        'level': 3,
        'health': 100,
    }])
    response = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': member_id,
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
            'health': 0,
        }],
    }, headers=auth_headers)

    assert response.status_code == 200, response.get_json()
    assert response.get_json()['placements'][0]['health'] == 0
    assert _mock_placements[block_id][0]['health'] == 0


@pytest.mark.parametrize('status', ['jailed', 'defected', 'backdoored'])
def test_placement_rejects_non_deployable_roster_status(
    client,
    auth_headers,
    monkeypatch,
    status,
):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': f'360 {status} Ave, Miami, FL',
        'coordinates': {'lat': 25.7636, 'lng': -80.1923},
        'city': 'miami',
    }, headers=auth_headers)
    block_id = claim.get_json()['block']['id']
    grid = _mock_blocks[block_id]['grid_data']['grid']['tiles']
    open_tile = next(tile for row in grid for tile in row if tile['deployable'])
    member_id = '00000000-0000-4000-8000-000000000111'

    from services.db import get_db
    db = get_db()
    monkeypatch.setattr(db, 'get_owned_members', lambda _owner, _ids: [{
        'id': member_id,
        'status': status,
        'role': 'dealer',
        'level': 1,
    }])
    response = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': member_id,
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
        }],
    }, headers=auth_headers)

    assert response.status_code == 400
    assert _mock_placements[block_id] == []


def test_member_snapshot_overlays_saved_position_and_health_on_roster_and_loadout():
    members = _members_from_placements(
        [{
            'memberId': 'member-1',
            'role': 'dealer',
            'gridX': 2,
            'gridY': 3,
            'health': 63,
            'damage': 999,
            'defense': 999,
            'loadout': {'weapon_id': 'forged'},
        }],
        roster_by_id={'member-1': {
            'id': 'member-1',
            'role': 'shooter',
            'damage': 27,
            'defense': 11,
        }},
        loadouts_by_id={'member-1': {
            'member_id': 'member-1',
            'weapon_id': 'pistol-1',
            'armor_id': 'vest-1',
            'items': ['medkit'],
        }},
        require_roster=True,
    )

    assert members == [MemberSnapshot(
        id='member-1',
        role='shooter',
        stats={'health': 63, 'damage': 27, 'defense': 11},
        position={'x': 2, 'y': 3},
        loadout={'weapon_id': 'pistol-1', 'armor_id': 'vest-1', 'items': ['medkit']},
    )]


def test_member_snapshot_relocates_invalid_and_duplicate_legacy_cells_deterministically():
    tiles = [[{
        'x': x,
        'y': y,
        'type': 'sidewalk',
        'deployable': y == 0 and x in (1, 2),
    } for x in range(8)] for y in range(8)]
    placements = [
        {'memberId': 'member-b', 'gridX': 1, 'gridY': 0, 'health': 90},
        {'memberId': 'member-a', 'gridX': True, 'gridY': [], 'health': 80},
    ]

    members = _members_from_placements(placements, gameplay_tiles=tiles)

    assert [(member.id, member.position) for member in members] == [
        ('member-a', {'x': 1, 'y': 0}),
        ('member-b', {'x': 2, 'y': 0}),
    ]


def test_unmarked_legacy_grid_ignores_a_malformed_nested_candidate():
    legacy_tiles = [[{
        'x': x,
        'y': y,
        'type': 'sidewalk',
        'cover': 0.3,
        'visibility': 0.5,
        'deployable': True,
    } for x in range(8)] for y in range(8)]

    tiles, source = resolve_block_grid_tiles({
        'grid_data': {
            'grid': {'tiles': 'malformed-nested-value'},
            'tiles': legacy_tiles,
        },
        'address': 'Fictional Legacy Reference',
        'lat': 25.77,
        'lng': -80.18,
    })

    assert source == 'legacy'
    assert tiles[0][0]['type'] == 'sidewalk'


def test_archived_snapshot_json_round_trip_restores_nested_dataclasses():
    _clear_mocks()
    engine = BlockStateEngine()
    _mock_blocks['archive-round-trip'] = {
        'id': 'archive-round-trip',
        'address': 'Fictional Archive Fixture',
        'lat': 25.77,
        'lng': -80.18,
        'city': 'miami',
        'grid_data': {},
    }
    source = engine._generate_mock_snapshot('archive-round-trip')
    assert source is not None
    source.members = [MemberSnapshot(
        id='member-archive',
        role='lookout',
        stats={'health': 61, 'damage': 12, 'defense': 8},
        position={'x': 1, 'y': 1},
        loadout={'weapon_id': 'pistol-1'},
    )]
    source.tiles[1][1].member_id = 'member-archive'

    class Query:
        def select(self, *_args):
            return self

        def eq(self, *_args):
            return self

        def single(self):
            return self

        def execute(self):
            return type('Result', (), {'data': {'snapshot_data': source.to_dict()}})()

    class ArchiveStore:
        def table(self, _name):
            return Query()

    engine.use_supabase = True
    engine.supabase = ArchiveStore()
    restored = engine._get_archived_snapshot(source.snapshot_id)

    assert restored is not None
    assert isinstance(restored.tiles[0][0], TileSnapshot)
    assert restored.members
    assert all(isinstance(member, MemberSnapshot) for member in restored.members)
    assert restored.to_dict() == source.to_dict()


def test_missing_combat_target_does_not_create_a_session(client, auth_headers):
    _clear_mocks()
    from api.combat import combat_sessions
    sessions_before = set(combat_sessions)

    response = client.post('/api/combat/start', json={
        'attacker_gang_id': 'gang-1',
        'target_block_id': 'missing-block',
        'attacker_members': ['attacker-1'],
    }, headers=auth_headers)

    assert response.status_code == 500
    assert set(combat_sessions) == sessions_before


def test_malformed_nested_grid_uses_one_dna_fallback_for_placement_and_combat(client, auth_headers):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': '400 NE 1st Ave, Miami, FL',
        'coordinates': {'lat': 25.7640, 'lng': -80.1925},
        'city': 'miami',
    }, headers=auth_headers)
    assert claim.status_code == 201, claim.get_json()
    block_id = claim.get_json()['block']['id']

    grid = _mock_blocks[block_id]['grid_data']['grid']['tiles']
    contract = _mock_blocks[block_id]['grid_data']['metadata']['gridContract']
    nested_grid = _mock_blocks[block_id]['grid_data']['grid']
    _mock_blocks[block_id]['grid_data']['grid'] = json.dumps(nested_grid)
    _, string_container_source = resolve_block_grid_tiles(_mock_blocks[block_id])
    assert string_container_source == 'dna-fallback'
    _mock_blocks[block_id]['grid_data']['grid'] = nested_grid
    outer_grid_data = _mock_blocks[block_id]['grid_data']
    _mock_blocks[block_id]['grid_data'] = json.dumps(outer_grid_data)
    _, outer_string_source = resolve_block_grid_tiles(_mock_blocks[block_id])
    assert outer_string_source == 'dna-fallback'
    _mock_blocks[block_id]['grid_data'] = outer_grid_data
    contract['version'] = True
    _, boolean_version_source = resolve_block_grid_tiles(_mock_blocks[block_id])
    assert boolean_version_source == 'dna-fallback'
    contract['version'] = 1
    original_cover = grid[0][0].pop('cover')
    grid[0][0]['terrain_bonus'] = {
        'cover': original_cover,
        'visibility': grid[0][0]['visibility'],
    }
    _, legacy_root_source = resolve_block_grid_tiles(_mock_blocks[block_id])
    assert legacy_root_source == 'dna-fallback'
    grid[0][0]['cover'] = original_cover
    # Boolean coordinates compare equal to 0/1 in Python, but are not valid
    # JSON grid coordinates and must invalidate the whole marked board.
    grid[0][0]['x'] = False
    fallback, source = resolve_block_grid_tiles(_mock_blocks[block_id])
    assert source == 'dna-fallback'
    open_tile = next(tile for row in fallback for tile in row if tile['deployable'])
    placed = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'lookout-1',
            'role': 'lookout',
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
            'health': 73,
        }],
    }, headers=auth_headers)
    assert placed.status_code == 200, placed.get_json()
    placed_body = placed.get_json()['placements'][0]
    assert placed_body['zoneType'] == open_tile['type']
    assert placed_body['exposureRisk'] == round(open_tile['visibility'] * 100)

    encounter = client.post('/api/combat/start', json={
        'attacker_gang_id': 'gang-1',
        'target_block_id': block_id,
        'attacker_members': ['attacker-1'],
    }, headers=auth_headers)
    assert encounter.status_code == 201, encounter.get_json()
    snapshot = encounter.get_json()['target_snapshot']
    assert snapshot['grid_width'] == len(fallback[0]) == 8
    assert snapshot['grid_height'] == len(fallback) == 8
    for y, row in enumerate(fallback):
        for x, expected in enumerate(row):
            actual = snapshot['tiles'][y][x]
            assert (actual['x'], actual['y'], actual['tile_type']) == (x, y, expected['type'])
            assert actual['terrain_bonus']['cover'] == expected['cover']
            assert actual['terrain_bonus']['visibility'] == expected['visibility']
    assert snapshot['tiles'][open_tile['y']][open_tile['x']]['member_id'] == 'lookout-1'
    assert snapshot['members'][0]['id'] == 'lookout-1'
    assert snapshot['members'][0]['stats']['health'] == 73


def test_truncated_snapshot_falls_back_by_id_then_pinned_legacy_identity(client, auth_headers):
    _clear_mocks()
    address = 'Fictional Harbor Reference'
    lat = 25.7752
    lng = -80.1748
    claim = client.post('/api/blocks/claim', json={
        'address': address,
        'coordinates': {'lat': lat, 'lng': lng},
        'city': 'miami',
    }, headers=auth_headers)
    assert claim.status_code == 201, claim.get_json()
    block_id = claim.get_json()['block']['id']
    stored = _mock_blocks[block_id]
    snapshot = stored['grid_data']['__dna__']
    original_multiplier = snapshot['incomeMultiplier']
    stored['grid_data']['grid']['tiles'][2][3]['x'] = 99
    snapshot['incomeMultiplier'] = 9.9
    del snapshot['maxMembers']

    profile = resolve_block_dna_profile(stored)
    fallback, source = resolve_block_grid_tiles(stored)
    assert source == 'dna-fallback'
    assert profile['source'] == 'stored-id'
    assert profile['incomeMultiplier'] == original_multiplier
    open_tile = next(tile for row in fallback for tile in row if tile['deployable'])
    placed = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'fallback-dealer',
            'role': 'dealer',
            'gridX': open_tile['x'],
            'gridY': open_tile['y'],
        }],
    }, headers=auth_headers)
    assert placed.status_code == 200, placed.get_json()
    assert placed.get_json()['incomePerTick'] == _placement_income(
        open_tile['type'], 'dealer', 1, original_multiplier,
    )

    snapshot['dnaId'] = 'unknown-dna-id'
    legacy_snapshot = build_dna_snapshot(lat, lng, address, version='v1')
    legacy_profile = resolve_block_dna_profile(stored)
    legacy_fallback, legacy_source = resolve_block_grid_tiles(stored)
    assert legacy_source == 'dna-fallback'
    assert legacy_profile['source'] == 'legacy-resolver'
    assert legacy_profile['dnaId'] == legacy_snapshot['dnaId']
    assert [row[0]['type'] for row in legacy_fallback] == legacy_snapshot['zoneLayout']

    sanitized = resolve_block_dna_profile({
        'grid_data': {},
        'lat': True,
        'lng': 'not-a-coordinate',
        'address': 'Unknown',
    })
    sanitized_expected = build_dna_snapshot(0, 0, 'Unknown', version='v1')
    assert sanitized['dnaId'] == sanitized_expected['dnaId']


def test_malformed_snapshot_domains_fall_back_without_throwing():
    snapshot = build_dna_snapshot(25.7752, -80.1748, 'Fictional Harbor Reference')
    expected_id = snapshot['dnaId']

    malformed_zone = copy.deepcopy(snapshot)
    malformed_zone['zoneLayout'][7] = {}
    zone_profile = resolve_block_dna_profile({
        'grid_data': {'__dna__': malformed_zone},
        'lat': 25.7752,
        'lng': -80.1748,
        'address': 'Fictional Harbor Reference',
    })
    assert zone_profile['source'] == 'stored-id'
    assert zone_profile['dnaId'] == expected_id

    negative_income = copy.deepcopy(snapshot)
    negative_income['incomeMultiplier'] = -1
    income_profile = resolve_block_dna_profile({
        'grid_data': {'__dna__': negative_income},
        'lat': 25.7752,
        'lng': -80.1748,
        'address': 'Fictional Harbor Reference',
    })
    assert income_profile['source'] == 'stored-id'
    assert income_profile['incomeMultiplier'] >= 0


def test_legacy_grid_without_dna_is_shared_by_placement_and_combat(client, auth_headers):
    _clear_mocks()
    claim = client.post('/api/blocks/claim', json={
        'address': 'Fictional Legacy Board',
        'coordinates': {'lat': 25.7750, 'lng': -80.1750},
    }, headers=auth_headers)
    assert claim.status_code == 201, claim.get_json()
    block_id = claim.get_json()['block']['id']
    legacy_tiles = [[{
        'x': x,
        'y': y,
        'type': 'alley' if x == 1 else 'sidewalk',
        'terrain_bonus': {'cover': 0.4, 'visibility': 0.333 if (x, y) == (1, 1) else 0.6},
    } for x in range(8)] for y in range(8)]
    legacy_tiles[0][0]['cover'] = None
    legacy_tiles[0][0]['visibility'] = None
    _mock_blocks[block_id]['grid_data'] = {'tiles': legacy_tiles}

    tiles, source = resolve_block_grid_tiles(_mock_blocks[block_id])

    assert source == 'legacy'
    assert len(tiles) == 8
    assert len(tiles[0]) == 8
    assert tiles[0][0]['cover'] == 0.0
    assert tiles[0][0]['visibility'] == 1.0
    assert tiles[0][1] == {
        **legacy_tiles[0][1],
        'cover': 0.4,
        'visibility': 0.6,
        'deployable': True,
    }

    placed = client.post(f'/api/blocks/{block_id}/members/place', json={
        'placements': [{
            'memberId': 'legacy-lookout',
            'role': 'lookout',
            'gridX': 1,
            'gridY': 1,
        }],
    }, headers=auth_headers)
    assert placed.status_code == 200, placed.get_json()
    assert placed.get_json()['placements'][0]['zoneType'] == 'alley'
    assert placed.get_json()['placements'][0]['exposureRisk'] == 33

    encounter = client.post('/api/combat/start', json={
        'attacker_gang_id': 'gang-1',
        'target_block_id': block_id,
        'attacker_members': ['attacker-1'],
    }, headers=auth_headers)
    assert encounter.status_code == 201, encounter.get_json()
    snapshot = encounter.get_json()['target_snapshot']
    assert (snapshot['grid_width'], snapshot['grid_height']) == (8, 8)
    assert snapshot['tiles'][1][1]['tile_type'] == 'alley'
    assert snapshot['tiles'][1][1]['terrain_bonus'] == {
        'cover': 0.4,
        'visibility': 0.33,
    }
    assert snapshot['tiles'][1][1]['member_id'] == 'legacy-lookout'
