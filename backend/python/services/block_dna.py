"""
DEALT/SLIDE — authoritative Block DNA resolution.

WHY THIS EXISTS
A block's DNA decides its eight-row tactical layout, income multiplier, heat
decay, cover bonus, starting morale, capacity, initial heat and hot-block
status. Until now the server stored none of it: the client re-resolved DNA from
(lat, lng, address) on every load, so growing the DNA catalog silently rewrote
blocks players had already claimed.

The server now resolves DNA itself at claim time and stores a versioned
snapshot with the block. The client prefers that snapshot, so a claimed block's
identity survives both catalog expansion and later balance edits to the cards.

A client-supplied dnaId is never trusted — it is at most compared against the
server's own result for logging.

SINGLE SOURCE OF TRUTH
The card data and keyword rules come from data/block_dna_catalog.json, which is
generated from frontend/src/config/blockDNA.ts by
`npm run export:block-dna`. tests/test_block_dna_snapshot.py replays a fixture
of TypeScript-resolved cases to prove the two implementations agree.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Dict, List, Optional

CATALOG_PATH = Path(__file__).resolve().parent.parent / 'data' / 'block_dna_catalog.json'

#: Namespaced key the snapshot lives under inside the existing grid_data JSON
#: column. Deliberately not 'tiles' — block_state_engine reads grid_data['tiles']
#: and must remain unaffected.
DNA_SNAPSHOT_KEY = '__dna__'

#: Bumped when the snapshot payload shape changes.
DNA_SNAPSHOT_SCHEMA = 1

DEFAULT_ZONE_LAYOUT: List[str] = [
    'street', 'curb', 'sidewalk', 'storefront',
    'alley', 'sidewalk', 'curb', 'rooftop',
]

_CURATED_MAX_DISTANCE_SQUARED = 0.000025

_catalog_cache: Optional[Dict[str, Any]] = None
_compiled_rules_cache: Optional[List[Dict[str, Any]]] = None


class BlockDNAError(RuntimeError):
    """Raised when the catalog artifact is missing or unusable."""


def load_catalog() -> Dict[str, Any]:
    """Load and memoise the generated catalog artifact."""
    global _catalog_cache
    if _catalog_cache is None:
        try:
            with CATALOG_PATH.open('r', encoding='utf-8') as handle:
                _catalog_cache = json.load(handle)
        except (OSError, ValueError) as exc:
            raise BlockDNAError(f'Could not load block DNA catalog at {CATALOG_PATH}') from exc
    return _catalog_cache


def _compiled_rules() -> List[Dict[str, Any]]:
    global _compiled_rules_cache
    if _compiled_rules_cache is None:
        _compiled_rules_cache = [
            {
                'patterns': [re.compile(p, re.IGNORECASE) for p in rule['patterns']],
                'preferredTags': rule['preferredTags'],
            }
            for rule in load_catalog()['keywordRules']
        ]
    return _compiled_rules_cache


def current_catalog_version() -> str:
    return load_catalog()['currentVersion']


def get_catalog_cards(version: Optional[str] = None) -> List[Dict[str, Any]]:
    """Frozen card pool for a catalog version, in the client's exact order."""
    catalog = load_catalog()
    version = version or catalog['currentVersion']
    ids = catalog['versions'].get(version)
    if ids is None:
        raise BlockDNAError(f'Unknown resolver catalog version: {version!r}')
    by_id = {card['id']: card for card in catalog['cards']}
    missing = [card_id for card_id in ids if card_id not in by_id]
    if missing:
        raise BlockDNAError(
            f'Catalog version {version} is missing ids: {", ".join(missing)}. '
            'Frozen versions must never lose entries.'
        )
    return [by_id[card_id] for card_id in ids]


def _to_fixed(value: float, digits: int = 6) -> str:
    """
    Reproduce JavaScript's Number.prototype.toFixed.

    Decimal(float) is the exact binary value, and ROUND_HALF_UP rounds ties
    away from zero — together these match the spec's "pick the larger n" rule
    applied to the magnitude. Using repr() instead would round the shortest
    decimal representation and diverge from the client on tie values.
    """
    numeric = float(value) + 0.0  # normalise -0.0 to 0.0
    quantum = Decimal(1).scaleb(-digits)
    quantized = Decimal(numeric).quantize(quantum, rounding=ROUND_HALF_UP)
    return f'{quantized:.{digits}f}'


def generate_block_seed(lat: float, lng: float, precision: int = 6) -> str:
    """
    Port of the client's generateBlockHash (config/mapbox.config.ts).

    NOTE: this is NOT geocoding_service.generate_block_hash, which is an md5
    digest used for block identity. The resolver seed is the coordinate string
    form, and the two must not be confused — swapping them silently changes
    which DNA every address resolves to.
    """
    return f'block_{_to_fixed(lat, precision)}_{_to_fixed(lng, precision)}'


def _seed_to_number(seed: str) -> int:
    """Port of seedToNumber — 32-bit unsigned rolling hash (n * 31 + charCode)."""
    n = 0
    for char in seed:
        n = (n * 31 + ord(char)) & 0xFFFFFFFF
    return n


def _detect_tag_from_address(address: str) -> Optional[str]:
    for rule in _compiled_rules():
        for pattern in rule['patterns']:
            if pattern.search(address or ''):
                return rule['preferredTags'][0]
    return None


def _find_card_by_tag(cards: List[Dict[str, Any]], tag: str, seed: str) -> Optional[Dict[str, Any]]:
    matches = [card for card in cards if tag in card['tags']]
    if not matches:
        return None
    return matches[_seed_to_number(seed) % len(matches)]


def _find_nearby_curated(cards: List[Dict[str, Any]], lat: float, lng: float) -> Optional[Dict[str, Any]]:
    closest = None
    closest_distance = float('inf')
    for card in cards:
        distance = (card['lat'] - lat) ** 2 + (card['lng'] - lng) ** 2
        if distance <= _CURATED_MAX_DISTANCE_SQUARED and distance < closest_distance:
            closest = card
            closest_distance = distance
    return closest


def _nearest_card(cards: List[Dict[str, Any]], lat: float, lng: float) -> Dict[str, Any]:
    nearest = cards[0]
    nearest_distance = float('inf')
    for card in cards:
        distance = (card['lat'] - lat) ** 2 + (card['lng'] - lng) ** 2
        if distance < nearest_distance:
            nearest_distance = distance
            nearest = card
    return nearest


def build_zone_layout(card: Dict[str, Any]) -> List[str]:
    overrides = card.get('zoneOverrides') or {}
    if not overrides:
        return list(DEFAULT_ZONE_LAYOUT)
    return [overrides.get(str(row), zone) for row, zone in enumerate(DEFAULT_ZONE_LAYOUT)]


def resolve_block_dna(
    lat: float,
    lng: float,
    address: str,
    version: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Server-side port of the client's resolveBlockDNA. Selection order:
      1. nearby curated card, 2. address keyword pool, 3. nearest by distance,
      4. seed-indexed fallback — each scoped to the frozen catalog version.
    """
    version = version or current_catalog_version()
    cards = get_catalog_cards(version)
    seed = generate_block_seed(lat, lng)

    card = _find_nearby_curated(cards, lat, lng)

    if card is None:
        tag = _detect_tag_from_address(address)
        if tag:
            card = _find_card_by_tag(cards, tag, seed)

    if card is None:
        card = _nearest_card(cards, lat, lng)

    if card is None:  # pragma: no cover - unreachable while a catalog is non-empty
        card = cards[_seed_to_number(seed) % len(cards)]

    return {'card': card, 'seed': seed, 'catalogVersion': version}


def build_dna_snapshot(
    lat: float,
    lng: float,
    address: str,
    version: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Authoritative, self-contained record of a block's tactical identity.

    Everything the client needs to rebuild the block is copied in by value, so
    the snapshot survives both catalog expansion and later balance edits to the
    card it came from.
    """
    resolved = resolve_block_dna(lat, lng, address, version)
    card = resolved['card']
    return {
        'schema': DNA_SNAPSHOT_SCHEMA,
        'dnaId': card['id'],
        'catalogVersion': resolved['catalogVersion'],
        'seed': resolved['seed'],
        'zoneLayout': build_zone_layout(card),
        'incomeMultiplier': card['incomeMultiplier'],
        'heatDecayMultiplier': card['heatDecayMultiplier'],
        'globalCoverBonus': card['globalCoverBonus'],
        'startingMorale': card['startingMorale'],
        'maxMembers': card['maxMembers'],
        'startingHeat': card['startingHeat'],
        'hotBlock': card['hotBlock'],
    }


def attach_dna_snapshot(grid_data: Optional[Dict[str, Any]], snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """
    Store the snapshot alongside the existing grid payload.

    Additive only: every other key (notably 'tiles', which block_state_engine
    reads) is preserved untouched, which is what lets this ship without a
    schema migration.
    """
    merged = dict(grid_data or {})
    merged[DNA_SNAPSHOT_KEY] = snapshot
    return merged


def read_dna_snapshot(grid_data: Any) -> Optional[Dict[str, Any]]:
    """Return a stored snapshot, or None for a record claimed before this shipped."""
    if isinstance(grid_data, str):
        try:
            grid_data = json.loads(grid_data)
        except ValueError:
            return None
    if not isinstance(grid_data, dict):
        return None
    snapshot = grid_data.get(DNA_SNAPSHOT_KEY)
    if isinstance(snapshot, dict) and snapshot.get('dnaId'):
        return snapshot
    return None
