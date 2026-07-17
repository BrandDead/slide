"""
Gate 0B typed contracts — mirror frontend/src/types/contracts/blockScene.types.ts

Geometry decides gameplay; AI pixels decide atmosphere only.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Optional


SceneStatus = Literal['queued', 'extracting', 'rendering', 'generating', 'validating', 'review', 'ready', 'failed', 'fallback']
ZoneType = Literal['street', 'curb', 'sidewalk', 'storefront', 'alley', 'parking', 'rooftop', 'building']


@dataclass
class SceneExtent:
    width_m: float = 80.0
    height_m: float = 80.0
    rotation_bearing_deg: float = 0.0
    center_lat: float = 0.0
    center_lng: float = 0.0
    bounds: Dict[str, float] = field(default_factory=dict)


@dataclass
class SceneAnchor:
    id: str
    local_x_m: float
    local_y_m: float
    normalized_x: float
    normalized_y: float
    zone_type: ZoneType
    facing_deg: float = 0.0
    payout_multiplier: float = 1.0
    risk_multiplier: float = 1.0
    cover: float = 0.0
    playable: bool = True


@dataclass
class BlockSceneManifest:
    """Immutable physical board version."""

    block_id: str
    scene_version: str
    status: SceneStatus
    address_display: str
    address_canonical: Optional[str]
    geocoder_feature_id: Optional[str]
    extent: SceneExtent
    grid_width: int = 8
    grid_height: int = 8
    cell_size_m: float = 10.0
    anchors: List[SceneAnchor] = field(default_factory=list)
    grid_zone_types: List[List[ZoneType]] = field(default_factory=list)
    topdown_texture_url: Optional[str] = None
    street_strip_url: Optional[str] = None
    provenance: Dict[str, Any] = field(default_factory=dict)
    created_at: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LivePlacement:
    member_id: str
    anchor_id: str
    role: str
    local_offset_x_m: float = 0.0
    local_offset_y_m: float = 0.0
    facing_deg: float = 0.0
    health: int = 100
    loadout: Dict[str, Any] = field(default_factory=dict)
    grid_x: Optional[int] = None
    grid_y: Optional[int] = None


@dataclass
class LiveBlockState:
    """Mutable ownership / crew / economy for a block."""

    block_id: str
    scene_version: str
    revision: int
    owner_id: str
    claim_status: Literal['owned', 'npc', 'unclaimed', 'contested']
    placements: List[LivePlacement] = field(default_factory=list)
    heat: int = 0
    morale: int = 80
    pending_income: int = 0
    income_per_tick: int = 0
    updated_at: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AttackSnapshot:
    """Immutable defender board frozen at attack start."""

    attack_id: str
    block_id: str
    scene_version: str
    live_revision: int
    rules_version: str
    seed: str
    started_at: str
    defender_placements: List[LivePlacement] = field(default_factory=list)
    attacker_loadout: Dict[str, Any] = field(default_factory=dict)
    civilian_seed: str = ''
    weather: str = 'clear'

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def grid_cell_to_anchor_id(x: int, y: int) -> str:
    return f'cell-{x}-{y}'


def build_default_manifest(
    block_id: str,
    *,
    scene_version: str,
    address_display: str,
    lat: float,
    lng: float,
    bounds: Optional[Dict[str, float]] = None,
    created_at: str = '',
) -> BlockSceneManifest:
    """Procedural fallback manifest until Overture ingest (Gate 3)."""
    zone_row = [
        'street', 'street', 'street', 'street', 'street', 'street', 'street', 'street',
    ]
    layout: List[List[ZoneType]] = [
        zone_row,  # type: ignore[list-item]
        ['curb'] * 8,  # type: ignore[list-item]
        ['sidewalk'] * 8,  # type: ignore[list-item]
        ['storefront', 'storefront', 'alley', 'storefront', 'storefront', 'alley', 'storefront', 'storefront'],  # type: ignore[list-item]
        ['storefront', 'storefront', 'alley', 'storefront', 'storefront', 'alley', 'storefront', 'storefront'],  # type: ignore[list-item]
        ['sidewalk'] * 8,  # type: ignore[list-item]
        ['curb'] * 8,  # type: ignore[list-item]
        zone_row,  # type: ignore[list-item]
    ]
    anchors: List[SceneAnchor] = []
    for y, row in enumerate(layout):
        for x, zone in enumerate(row):
            playable = zone not in ('street', 'building')
            anchors.append(
                SceneAnchor(
                    id=grid_cell_to_anchor_id(x, y),
                    local_x_m=x * 10.0 + 5.0,
                    local_y_m=y * 10.0 + 5.0,
                    normalized_x=(x + 0.5) / 8.0,
                    normalized_y=(y + 0.5) / 8.0,
                    zone_type=zone,  # type: ignore[arg-type]
                    payout_multiplier=1.2 if zone in ('curb', 'sidewalk') else 1.0,
                    risk_multiplier=1.5 if zone in ('street', 'curb') else 1.0,
                    cover=0.6 if zone in ('storefront', 'alley') else 0.2,
                    playable=playable,
                )
            )
    extent = SceneExtent(
        center_lat=lat,
        center_lng=lng,
        bounds=bounds or {},
    )
    return BlockSceneManifest(
        block_id=block_id,
        scene_version=scene_version,
        status='fallback',
        address_display=address_display,
        address_canonical=address_display,
        geocoder_feature_id=None,
        extent=extent,
        anchors=anchors,
        grid_zone_types=layout,  # type: ignore[arg-type]
        provenance={'source': 'procedural-fallback', 'gate': '0B'},
        created_at=created_at,
    )
