"""
Authoritative Block DNA resolution + snapshot persistence.

The headline guarantee: a block claimed today keeps its exact tactical identity
after the DNA catalog grows. That needs two things proven here — the server
resolves DNA identically to the client (cross-language parity), and the
snapshot it stores is self-contained and additive to grid_data.
"""

import json
from pathlib import Path

import pytest

from services.block_dna import (
    DNA_SNAPSHOT_KEY,
    DNA_SNAPSHOT_SCHEMA,
    attach_dna_snapshot,
    build_dna_snapshot,
    build_zone_layout,
    current_catalog_version,
    generate_block_seed,
    get_catalog_cards,
    load_catalog,
    read_dna_snapshot,
    resolve_block_dna,
)
from services.geocoding_service import GeocodingService

PARITY_FIXTURE = Path(__file__).parent / 'fixtures' / 'dna_resolver_parity.json'

BATCH_TWO_IDS = {
    'signal-yard', 'marina-cut', 'sable-plaza', 'orchard-row',
    'switchback-garage', 'civic-arcade', 'ridge-estates', 'vernon-court',
}

SNAPSHOT_REQUIRED_FIELDS = (
    'dnaId', 'catalogVersion', 'zoneLayout', 'incomeMultiplier',
    'heatDecayMultiplier', 'globalCoverBonus', 'startingMorale',
    'maxMembers', 'startingHeat', 'hotBlock',
)


# ─── Catalog artifact ────────────────────────────────────────────────────────

def test_catalog_versions_are_frozen_and_nested():
    catalog = load_catalog()
    v1 = catalog['versions']['v1']
    v2 = catalog['versions']['v2']
    assert len(v1) == 25
    assert len(v2) == 33
    assert len(set(v1)) == len(v1)
    assert set(v1).issubset(set(v2)), 'a frozen version may never lose ids'
    assert BATCH_TWO_IDS.isdisjoint(set(v1))
    assert BATCH_TWO_IDS.issubset(set(v2))
    assert current_catalog_version() == 'v2'


def test_catalog_cards_resolve_in_client_order():
    catalog = load_catalog()
    for version in ('v1', 'v2'):
        ids = [card['id'] for card in get_catalog_cards(version)]
        assert ids == catalog['versions'][version]


def test_unknown_catalog_version_is_rejected():
    with pytest.raises(Exception):
        get_catalog_cards('v99')


def test_every_card_builds_an_eight_row_layout():
    for card in get_catalog_cards('v2'):
        layout = build_zone_layout(card)
        assert len(layout) == 8, card['id']
        assert all(isinstance(zone, str) and zone for zone in layout), card['id']


# ─── Seed ────────────────────────────────────────────────────────────────────

def test_block_seed_matches_client_coordinate_form():
    assert generate_block_seed(26.1186239, -80.1574818) == 'block_26.118624_-80.157482'
    assert generate_block_seed(0, 0) == 'block_0.000000_0.000000'
    assert generate_block_seed(-0.0, -0.0) == 'block_0.000000_0.000000'


def test_resolver_seed_is_not_the_md5_block_hash():
    """
    Guard rail. geocoding_service.generate_block_hash is an md5 digest used for
    block identity; the resolver seed is the coordinate string. Swapping them
    silently changes which DNA every address resolves to.
    """
    lat, lng = 26.1186239, -80.1574818
    assert generate_block_seed(lat, lng) != GeocodingService.generate_block_hash(lat, lng)


# ─── Cross-language parity ───────────────────────────────────────────────────

def test_python_resolver_matches_typescript_fixture():
    payload = json.loads(PARITY_FIXTURE.read_text(encoding='utf-8'))
    assert payload['schema'] == DNA_SNAPSHOT_SCHEMA
    cases = payload['cases']
    assert len(cases) >= 400

    mismatches = []
    for case in cases:
        snapshot = build_dna_snapshot(
            case['lat'], case['lng'], case['address'], case['catalogVersion'],
        )
        actual = {field: snapshot[field] for field in case['expected']}
        if actual != case['expected']:
            mismatches.append((case, actual))

    assert not mismatches, (
        f'{len(mismatches)}/{len(cases)} cases diverge from the client resolver. '
        f'First: {mismatches[0] if mismatches else None}'
    )


def test_expanded_catalog_would_move_generic_blocks():
    """
    Documents why version pinning exists. If this ever fails the catalog stopped
    affecting generic resolution — re-derive the fixture, do not delete pinning.
    """
    payload = json.loads(PARITY_FIXTURE.read_text(encoding='utf-8'))
    v1_cases = [c for c in payload['cases'] if c['catalogVersion'] == 'v1']
    moved = 0
    for case in v1_cases:
        live = resolve_block_dna(case['lat'], case['lng'], case['address'], 'v2')
        if live['card']['id'] != case['expected']['dnaId']:
            moved += 1
    assert moved > 0


# ─── Snapshot payload ────────────────────────────────────────────────────────

def test_snapshot_carries_every_field_needed_to_rebuild_a_block():
    snapshot = build_dna_snapshot(30.2672, -97.7431, '19 Kestrel Court, Austin, TX')
    for field in SNAPSHOT_REQUIRED_FIELDS:
        assert field in snapshot, field
    assert snapshot['schema'] == DNA_SNAPSHOT_SCHEMA
    assert len(snapshot['zoneLayout']) == 8
    assert snapshot['catalogVersion'] == current_catalog_version()


def test_snapshot_is_deterministic():
    args = (30.2672, -97.7431, '19 Kestrel Court, Austin, TX')
    assert build_dna_snapshot(*args) == build_dna_snapshot(*args)


def test_snapshot_is_by_value_not_a_catalog_reference():
    """Later balance edits to a card must not reach through a stored snapshot."""
    snapshot = build_dna_snapshot(30.2672, -97.7431, '19 Kestrel Court, Austin, TX')
    card = next(c for c in get_catalog_cards('v2') if c['id'] == snapshot['dnaId'])
    assert snapshot['zoneLayout'] is not card.get('zoneOverrides')
    snapshot['zoneLayout'][0] = 'rooftop'
    assert build_zone_layout(card)[0] != 'rooftop'


# ─── grid_data integration ───────────────────────────────────────────────────

def test_attach_snapshot_preserves_tiles_and_siblings():
    grid = {
        'tiles': [[{'x': 0, 'y': 0}]],
        'width': 8,
        'height': 8,
        'meta': {'seed': 'abc'},
    }
    snapshot = build_dna_snapshot(26.1186239, -80.1574818, '1208 E Las Olas Blvd')
    merged = attach_dna_snapshot(grid, snapshot)

    assert merged['tiles'] == grid['tiles']
    assert merged['width'] == 8 and merged['height'] == 8
    assert merged['meta'] == {'seed': 'abc'}
    assert merged[DNA_SNAPSHOT_KEY] == snapshot
    assert DNA_SNAPSHOT_KEY not in grid, 'attach must not mutate the caller payload'
    # block_state_engine reads grid_data['tiles'] — prove that path is untouched.
    assert merged.get('tiles', [])[0][0] == {'x': 0, 'y': 0}


def test_attach_snapshot_handles_empty_grid():
    snapshot = build_dna_snapshot(26.1186239, -80.1574818, '1208 E Las Olas Blvd')
    assert attach_dna_snapshot(None, snapshot)[DNA_SNAPSHOT_KEY] == snapshot
    assert attach_dna_snapshot({}, snapshot)[DNA_SNAPSHOT_KEY] == snapshot


def test_read_snapshot_round_trips_including_json_string_column():
    snapshot = build_dna_snapshot(26.1186239, -80.1574818, '1208 E Las Olas Blvd')
    merged = attach_dna_snapshot({'tiles': []}, snapshot)
    assert read_dna_snapshot(merged) == snapshot
    assert read_dna_snapshot(json.dumps(merged)) == snapshot


@pytest.mark.parametrize('value', [
    None,
    {},
    {'tiles': []},
    'not json',
    '[]',
    123,
    {DNA_SNAPSHOT_KEY: 'nonsense'},
    {DNA_SNAPSHOT_KEY: {}},
])
def test_read_snapshot_returns_none_for_legacy_or_malformed_records(value):
    assert read_dna_snapshot(value) is None
