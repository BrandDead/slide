"""
DEALT/SLIDE - Grid Generator Service
Converts real-world location data into playable tactical grids

Grid Layout (8x8 default):
Row 0-1: Top Sidewalk (defender territory)
Row 2-5: Street (drive-by path)
Row 6-7: Bottom Sidewalk (defender territory)
"""

import hashlib
import json
import math
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
import logging
import re

from services.block_dna import build_zone_layout, load_catalog, resolve_block_dna

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class GridConfig:
    """Configuration for grid generation"""
    grid_width: int = 8
    grid_height: int = 8
    street_width: int = 4      # Rows 2-5
    sidewalk_width: int = 2    # Rows 0-1 and 6-7
    feature_density: float = 0.3  # 30% of tiles have features
    cover_bias: float = 0.5    # Balanced cover distribution
    seed: Optional[str] = None


# ============================================================================
# FEATURE DEFINITIONS
# ============================================================================

FEATURE_CONFIGS = {
    'dumpster': {
        'cover_bonus': 0.7,
        'visibility_penalty': 0.3,
        'destructible': False,
        'spawn_weight': 8,
        'valid_tile_types': ['sidewalk', 'alley'],
    },
    'parked_car': {
        'cover_bonus': 0.6,
        'visibility_penalty': 0.2,
        'destructible': True,
        'health': 100,
        'spawn_weight': 15,
        'valid_tile_types': ['street', 'parking'],
    },
    'mailbox': {
        'cover_bonus': 0.3,
        'visibility_penalty': 0.1,
        'destructible': True,
        'health': 30,
        'spawn_weight': 10,
        'valid_tile_types': ['sidewalk'],
    },
    'fire_hydrant': {
        'cover_bonus': 0.2,
        'visibility_penalty': 0.05,
        'destructible': False,
        'spawn_weight': 8,
        'valid_tile_types': ['sidewalk'],
    },
    'streetlight': {
        'cover_bonus': 0.1,
        'visibility_penalty': -0.2,  # Increases visibility at night
        'destructible': True,
        'health': 50,
        'spawn_weight': 12,
        'valid_tile_types': ['sidewalk'],
    },
    'bench': {
        'cover_bonus': 0.25,
        'visibility_penalty': 0.1,
        'destructible': True,
        'health': 40,
        'spawn_weight': 6,
        'valid_tile_types': ['sidewalk'],
    },
    'trash_can': {
        'cover_bonus': 0.2,
        'visibility_penalty': 0.05,
        'destructible': True,
        'health': 20,
        'spawn_weight': 12,
        'valid_tile_types': ['sidewalk'],
    },
    'newspaper_box': {
        'cover_bonus': 0.15,
        'visibility_penalty': 0.05,
        'destructible': True,
        'health': 25,
        'spawn_weight': 6,
        'valid_tile_types': ['sidewalk'],
    },
    'phone_booth': {
        'cover_bonus': 0.5,
        'visibility_penalty': 0.2,
        'destructible': True,
        'health': 60,
        'spawn_weight': 3,
        'valid_tile_types': ['sidewalk'],
    },
    'bus_stop': {
        'cover_bonus': 0.4,
        'visibility_penalty': 0.15,
        'destructible': False,
        'spawn_weight': 4,
        'valid_tile_types': ['sidewalk'],
    },
    'barricade': {
        'cover_bonus': 0.8,
        'visibility_penalty': 0.4,
        'destructible': True,
        'health': 150,
        'spawn_weight': 2,
        'valid_tile_types': ['street', 'sidewalk'],
    },
    'crate': {
        'cover_bonus': 0.35,
        'visibility_penalty': 0.15,
        'destructible': True,
        'health': 35,
        'spawn_weight': 8,
        'valid_tile_types': ['sidewalk', 'alley'],
    },
    'barrel': {
        'cover_bonus': 0.3,
        'visibility_penalty': 0.1,
        'destructible': True,
        'health': 30,
        'spawn_weight': 6,
        'valid_tile_types': ['sidewalk', 'alley'],
    },
    'scaffold': {
        'cover_bonus': 0.5,
        'visibility_penalty': 0.3,
        'destructible': False,
        'spawn_weight': 3,
        'valid_tile_types': ['sidewalk'],
    },
    'vendor_cart': {
        'cover_bonus': 0.4,
        'visibility_penalty': 0.2,
        'destructible': True,
        'health': 45,
        'spawn_weight': 4,
        'valid_tile_types': ['sidewalk'],
        'lootable': True,
    },
}

# Base values by tile type
TILE_BASE_COVER = {
    'street': 0.0,
    'curb': 0.15,
    'sidewalk': 0.1,
    'storefront': 0.6,
    'building': 0.9,
    'alley': 0.3,
    'parking': 0.05,
    'rooftop': 0.9,
    'grass': 0.05,
    'water': 0.0,
}

TILE_BASE_VISIBILITY = {
    'street': 1.0,
    'curb': 0.8,
    'sidewalk': 0.9,
    'storefront': 0.25,
    'building': 0.3,
    'alley': 0.6,
    'parking': 0.95,
    'rooftop': 0.05,
    'grass': 0.85,
    'water': 1.0,
}

TILE_MOVEMENT_COST = {
    'street': 1.0,
    'curb': 1.0,
    'sidewalk': 1.0,
    'storefront': 1.0,
    'building': 999,  # Impassable
    'alley': 1.2,
    'parking': 1.0,
    'rooftop': 1.0,
    'grass': 1.3,
    'water': 999,
}

DNA_ZONE_TYPES = {
    'street', 'curb', 'sidewalk', 'storefront',
    'alley', 'parking', 'rooftop', 'building',
}

DNA_DEPLOYABLE_TYPES = DNA_ZONE_TYPES - {'street', 'building'}

DECIMAL_NUMBER_PATTERN = re.compile(
    r'^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$'
)
DECIMAL_INTEGER_PATTERN = re.compile(r'^[+-]?[0-9]+$')


def parse_finite_decimal(value: Any) -> float:
    """Parse the same finite JSON/decimal numeric grammar used by the client."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError('value must be a finite decimal number')
    if isinstance(value, str) and not DECIMAL_NUMBER_PATTERN.fullmatch(value.strip()):
        raise ValueError('value must be a finite decimal number')
    try:
        numeric = float(value)
    except (TypeError, ValueError, OverflowError):
        raise ValueError('value must be a finite decimal number') from None
    if not math.isfinite(numeric):
        raise ValueError('value must be a finite decimal number')
    return numeric


def parse_python_integer(value: Any) -> int:
    """Mirror Python int for JSON numbers, with strict decimal strings."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError('value must be an integer')
    if isinstance(value, str):
        if not DECIMAL_INTEGER_PATTERN.fullmatch(value.strip()):
            raise ValueError('value must be an integer')
        return int(value.strip())
    if not math.isfinite(value):
        raise ValueError('value must be an integer')
    return int(value)

# Matches the established frontend Block DNA placement profile. Kept separate
# from the legacy generator constants above so old generic callers do not
# receive a silent balance rewrite.
DNA_TILE_PROFILE = {
    'street': {'cover': 0.05, 'visibility': 0.95, 'movement_cost': 1.0},
    'curb': {'cover': 0.15, 'visibility': 0.8, 'movement_cost': 1.0},
    'sidewalk': {'cover': 0.3, 'visibility': 0.5, 'movement_cost': 1.0},
    'storefront': {'cover': 0.6, 'visibility': 0.25, 'movement_cost': 1.0},
    'alley': {'cover': 0.8, 'visibility': 0.1, 'movement_cost': 1.2},
    'parking': {'cover': 0.35, 'visibility': 0.4, 'movement_cost': 1.0},
    'rooftop': {'cover': 0.9, 'visibility': 0.05, 'movement_cost': 1.0},
    'building': {'cover': 1.0, 'visibility': 0.0, 'movement_cost': 999},
}


def _round_tactical_value(value: float, digits: int = 2) -> float:
    """Round JSON tactical values with the client's Math.round semantics."""
    scale = 10 ** digits
    return math.floor(float(value) * scale + 0.5) / scale


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class TileFeature:
    """Feature on a tile (cover object)"""
    type: str
    cover_bonus: float
    visibility_penalty: float
    destructible: bool
    health: Optional[int] = None
    lootable: bool = False
    interactable: bool = False


@dataclass
class GridTile:
    """Single tile in the grid"""
    x: int
    y: int
    type: str
    subtype: Optional[str] = None
    cover: float = 0.0
    visibility: float = 1.0
    movement_cost: float = 1.0
    features: List[TileFeature] = field(default_factory=list)
    occupied_by: Optional[str] = None
    deployable: bool = False
    destructible: bool = False
    health: Optional[int] = None
    sprite_key: Optional[str] = None
    rotation: int = 0
    elevation: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'x': self.x,
            'y': self.y,
            'type': self.type,
            'subtype': self.subtype,
            'cover': _round_tactical_value(self.cover),
            'visibility': _round_tactical_value(self.visibility),
            'movementCost': self.movement_cost,
            'features': [asdict(f) for f in self.features],
            'occupiedBy': self.occupied_by,
            'deployable': self.deployable,
            'destructible': self.destructible,
            'health': self.health,
            'spriteKey': self.sprite_key,
            'rotation': self.rotation,
            'elevation': self.elevation,
        }


@dataclass
class BlockGrid:
    """Complete grid for a block"""
    width: int
    height: int
    tiles: List[List[GridTile]]
    street_rows: List[int] = field(default_factory=list)
    sidewalk_rows_top: List[int] = field(default_factory=list)
    sidewalk_rows_bottom: List[int] = field(default_factory=list)
    attacker_entry: List[Dict[str, int]] = field(default_factory=list)
    attacker_exit: List[Dict[str, int]] = field(default_factory=list)
    defender_spawns: List[Dict[str, int]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'width': self.width,
            'height': self.height,
            'tiles': [[tile.to_dict() for tile in row] for row in self.tiles],
            'streetRow': self.street_rows,
            'sidewalkRows': {
                'top': self.sidewalk_rows_top,
                'bottom': self.sidewalk_rows_bottom,
            },
            'spawnPoints': {
                'attackerEntry': self.attacker_entry,
                'attackerExit': self.attacker_exit,
                'defenderSpawns': self.defender_spawns,
            },
        }


@dataclass
class GridGenerationResult:
    """Result of grid generation"""
    grid: BlockGrid
    seed: str
    config: GridConfig
    generated_at: str
    stats: Dict[str, Any]
    grid_contract: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        metadata = {
            'generatedAt': self.generated_at,
            'seed': self.seed,
            'config': asdict(self.config),
            'stats': self.stats,
        }
        if self.grid_contract:
            metadata['gridContract'] = self.grid_contract
        return {
            'grid': self.grid.to_dict(),
            'metadata': metadata,
        }


# ============================================================================
# SEEDED RANDOM NUMBER GENERATOR
# ============================================================================

class SeededRandom:
    """
    Seeded random number generator for deterministic grid generation.
    Uses Linear Congruential Generator algorithm.
    """
    
    def __init__(self, seed: str):
        self.seed = self._hash_string(seed)
    
    def _hash_string(self, s: str) -> int:
        """Convert string to integer seed"""
        h = 0
        for char in s:
            h = ((h << 5) - h) + ord(char)
            h = h & 0x7fffffff
        return h or 1
    
    def next(self) -> float:
        """Generate next random float between 0 and 1"""
        self.seed = (self.seed * 1103515245 + 12345) & 0x7fffffff
        return self.seed / 0x7fffffff
    
    def next_int(self, min_val: int, max_val: int) -> int:
        """Generate random integer in range [min_val, max_val]"""
        return int(self.next() * (max_val - min_val + 1)) + min_val
    
    def pick(self, items: List[Any]) -> Any:
        """Pick random item from list"""
        return items[self.next_int(0, len(items) - 1)]
    
    def shuffle(self, items: List[Any]) -> List[Any]:
        """Shuffle list in place and return it"""
        for i in range(len(items) - 1, 0, -1):
            j = self.next_int(0, i)
            items[i], items[j] = items[j], items[i]
        return items


# ============================================================================
# GRID GENERATOR
# ============================================================================

class GridGenerator:
    """
    Generates playable tactical grids from location data.
    Uses seeded randomness for reproducible results.
    """
    
    def __init__(
        self,
        city: str,
        traffic_score: int,
        config: GridConfig = None,
        seed: str = None,
        zone_layout: Optional[List[str]] = None,
        global_cover_bonus: float = 0.0,
    ):
        self.city = city
        self.traffic_score = traffic_score
        self.config = config or GridConfig()
        
        # Generate deterministic seed if not provided
        if seed:
            self.config.seed = seed
        elif not self.config.seed:
            self.config.seed = f"{city}_{traffic_score}_{datetime.utcnow().timestamp()}"

        if zone_layout is not None:
            if len(zone_layout) != self.config.grid_height:
                raise ValueError('zone_layout must contain one type per grid row')
            if any(
                not isinstance(zone, str) or zone not in DNA_ZONE_TYPES
                for zone in zone_layout
            ):
                raise ValueError('zone_layout contains an unsupported tile type')
            self.zone_layout = list(zone_layout)
        else:
            self.zone_layout = None
        self.global_cover_bonus = float(global_cover_bonus)
        
        self.rng = SeededRandom(self.config.seed)
    
    def generate(self) -> GridGenerationResult:
        """Generate complete grid for a block"""
        # Initialize tiles
        tiles: List[List[GridTile]] = []
        
        for y in range(self.config.grid_height):
            row = []
            for x in range(self.config.grid_width):
                row.append(self._generate_tile(x, y))
            tiles.append(row)
        
        # Add features to tiles
        self._populate_features(tiles)
        
        # Build grid structure
        grid = self._build_block_grid(tiles)
        
        # Calculate stats
        stats = self._calculate_stats(tiles)
        
        return GridGenerationResult(
            grid=grid,
            seed=self.config.seed,
            config=self.config,
            generated_at=datetime.utcnow().isoformat(),
            stats=stats,
            grid_contract={
                'name': 'block-dna-grid',
                'version': 1,
                'layoutSource': 'block-dna-snapshot',
                'globalCoverBonusApplied': True,
            } if self.zone_layout else None,
        )
    
    def _generate_tile(self, x: int, y: int) -> GridTile:
        """Generate a single tile"""
        tile_type = self._determine_tile_type(y)
        subtype = self._determine_subtype(x, y, tile_type)
        profile = DNA_TILE_PROFILE.get(tile_type) if self.zone_layout else None
        base_cover = profile['cover'] if profile else TILE_BASE_COVER.get(tile_type, 0)
        visibility = profile['visibility'] if profile else TILE_BASE_VISIBILITY.get(tile_type, 1.0)
        movement_cost = profile['movement_cost'] if profile else TILE_MOVEMENT_COST.get(tile_type, 1.0)
        
        return GridTile(
            x=x,
            y=y,
            type=tile_type,
            subtype=subtype,
            cover=max(0.0, min(1.0, base_cover + self.global_cover_bonus)),
            visibility=visibility,
            movement_cost=movement_cost,
            deployable=self._is_deployable(tile_type, y),
        )
    
    def _determine_tile_type(self, y: int) -> str:
        """Determine tile type based on row position"""
        if self.zone_layout:
            return self.zone_layout[y]

        sw = self.config.sidewalk_width
        st = self.config.street_width
        
        if y < sw:
            return 'sidewalk'
        if y < sw + st:
            return 'street'
        return 'sidewalk'
    
    def _determine_subtype(self, x: int, y: int, tile_type: str) -> Optional[str]:
        """Determine tile subtype for special variations"""
        sw = self.config.sidewalk_width
        st = self.config.street_width
        gw = self.config.grid_width
        
        if tile_type == 'sidewalk':
            street_start = sw
            street_end = sw + st - 1
            if y == street_start - 1 or y == street_end + 1:
                return 'curb'
        
        if tile_type == 'street':
            if x == 0 or x == gw - 1:
                return 'crosswalk'
            if self.rng.next() < 0.3 and x == gw // 2:
                return 'median'
        
        return None
    
    def _is_deployable(self, tile_type: str, y: int) -> bool:
        """Check if tile can have units deployed"""
        if self.zone_layout:
            return tile_type in DNA_DEPLOYABLE_TYPES

        if tile_type != 'sidewalk':
            return False
        
        sw = self.config.sidewalk_width
        st = self.config.street_width
        
        # Don't deploy on curbs
        if y == sw - 1 or y == sw + st:
            return False
        
        return True
    
    def _populate_features(self, tiles: List[List[GridTile]]) -> None:
        """Add cover features to tiles"""
        gw = self.config.grid_width
        gh = self.config.grid_height
        target_features = int(gw * gh * self.config.feature_density)
        
        # Get valid positions
        valid_positions = []
        for y in range(gh):
            for x in range(gw):
                if tiles[y][x].type != 'building':
                    valid_positions.append((x, y, tiles[y][x].type))
        
        # Shuffle positions
        self.rng.shuffle(valid_positions)
        
        # Place features
        placed = 0
        for x, y, tile_type in valid_positions:
            if placed >= target_features:
                break
            
            feature = self._select_feature(tile_type)
            if feature:
                tile = tiles[y][x]
                tile.features.append(feature)
                tile.cover = min(1.0, tile.cover + feature.cover_bonus)
                tile.visibility = max(0.0, tile.visibility - feature.visibility_penalty)
                
                if feature.destructible:
                    tile.destructible = True
                    tile.health = feature.health
                
                placed += 1
        
        # Ensure minimum cover on sidewalks
        self._ensure_minimum_cover(tiles)
    
    def _select_feature(self, tile_type: str) -> Optional[TileFeature]:
        """Select appropriate feature for tile type"""
        valid_features = [
            (name, cfg) for name, cfg in FEATURE_CONFIGS.items()
            if tile_type in cfg['valid_tile_types']
        ]
        
        if not valid_features:
            return None
        
        # Weight-based selection
        total_weight = sum(cfg['spawn_weight'] for _, cfg in valid_features)
        roll = self.rng.next() * total_weight
        
        for name, cfg in valid_features:
            roll -= cfg['spawn_weight']
            if roll <= 0:
                return TileFeature(
                    type=name,
                    cover_bonus=cfg['cover_bonus'],
                    visibility_penalty=cfg['visibility_penalty'],
                    destructible=cfg['destructible'],
                    health=cfg.get('health'),
                    lootable=cfg.get('lootable', False),
                    interactable=name in ['parked_car', 'phone_booth'],
                )
        
        return None
    
    def _ensure_minimum_cover(self, tiles: List[List[GridTile]]) -> None:
        """Ensure sidewalks have minimum cover for gameplay"""
        # DNA boards already carry their authored cover profile (plus the
        # snapshotted global modifier). The legacy helper below assumes fixed
        # sidewalk bands and can otherwise put forced dumpsters on buildings.
        if self.zone_layout:
            return

        sw = self.config.sidewalk_width
        st = self.config.street_width
        gh = self.config.grid_height
        min_cover = 2
        
        # Check top sidewalk
        top_cover = sum(
            1 for y in range(sw)
            for x in range(self.config.grid_width)
            if tiles[y][x].cover >= 0.3
        )
        
        if top_cover < min_cover:
            self._add_forced_cover(tiles, 0, sw - 1, min_cover - top_cover)
        
        # Check bottom sidewalk
        bottom_start = sw + st
        bottom_cover = sum(
            1 for y in range(bottom_start, gh)
            for x in range(self.config.grid_width)
            if tiles[y][x].cover >= 0.3
        )
        
        if bottom_cover < min_cover:
            self._add_forced_cover(tiles, bottom_start, gh - 1, min_cover - bottom_cover)
    
    def _add_forced_cover(
        self,
        tiles: List[List[GridTile]],
        y_start: int,
        y_end: int,
        count: int
    ) -> None:
        """Force add cover features to a row range"""
        candidates = [
            (x, y) for y in range(y_start, y_end + 1)
            for x in range(self.config.grid_width)
            if not tiles[y][x].features
        ]
        
        self.rng.shuffle(candidates)
        
        for i in range(min(count, len(candidates))):
            x, y = candidates[i]
            tile = tiles[y][x]
            
            feature = TileFeature(
                type='dumpster',
                cover_bonus=0.7,
                visibility_penalty=0.3,
                destructible=False,
            )
            
            tile.features.append(feature)
            tile.cover = min(1.0, tile.cover + feature.cover_bonus)
            tile.visibility = max(0.0, tile.visibility - feature.visibility_penalty)
    
    def _build_block_grid(self, tiles: List[List[GridTile]]) -> BlockGrid:
        """Build final BlockGrid structure"""
        sw = self.config.sidewalk_width
        st = self.config.street_width
        gw = self.config.grid_width
        gh = self.config.grid_height
        
        # Calculate spawn points
        defender_spawns = [
            {'x': x, 'y': y}
            for y in range(gh)
            for x in range(gw)
            if tiles[y][x].deployable
        ]
        
        if self.zone_layout:
            street_rows = [y for y, zone in enumerate(self.zone_layout) if zone == 'street']
            sidewalk_rows = [y for y, zone in enumerate(self.zone_layout) if zone == 'sidewalk']
            midpoint = gh // 2
            sidewalk_rows_top = [y for y in sidewalk_rows if y < midpoint]
            sidewalk_rows_bottom = [y for y in sidewalk_rows if y >= midpoint]
            lane_y = min(street_rows, key=lambda row: abs(row - midpoint)) if street_rows else midpoint
        else:
            street_rows = list(range(sw, sw + st))
            sidewalk_rows_top = list(range(sw))
            sidewalk_rows_bottom = list(range(sw + st, gh))
            lane_y = sw + st // 2

        return BlockGrid(
            width=gw,
            height=gh,
            tiles=tiles,
            street_rows=street_rows,
            sidewalk_rows_top=sidewalk_rows_top,
            sidewalk_rows_bottom=sidewalk_rows_bottom,
            attacker_entry=[{'x': 0, 'y': lane_y}],
            attacker_exit=[{'x': gw - 1, 'y': lane_y}],
            defender_spawns=defender_spawns,
        )
    
    def _calculate_stats(self, tiles: List[List[GridTile]]) -> Dict[str, Any]:
        """Calculate grid statistics"""
        gw = self.config.grid_width
        gh = self.config.grid_height
        total = gw * gh
        
        stats = {
            'totalTiles': total,
            'streetTiles': 0,
            'sidewalkTiles': 0,
            'buildingTiles': 0,
            'featureCount': 0,
            'totalCover': 0.0,
            'totalVisibility': 0.0,
        }
        
        for row in tiles:
            for tile in row:
                if tile.type == 'street':
                    stats['streetTiles'] += 1
                elif tile.type == 'sidewalk':
                    stats['sidewalkTiles'] += 1
                elif tile.type == 'building':
                    stats['buildingTiles'] += 1
                
                stats['featureCount'] += len(tile.features)
                stats['totalCover'] += tile.cover
                stats['totalVisibility'] += tile.visibility
        
        stats['averageCover'] = round(stats['totalCover'] / total, 3)
        stats['averageVisibility'] = round(stats['totalVisibility'] / total, 3)
        
        del stats['totalCover']
        del stats['totalVisibility']
        
        return stats


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def generate_block_grid(
    city: str,
    traffic_score: int,
    config: GridConfig = None,
    seed: str = None,
    zone_layout: Optional[List[str]] = None,
    global_cover_bonus: float = 0.0,
) -> GridGenerationResult:
    """
    Generate a grid for a block.
    
    Args:
        city: City code (nyc, la, etc.)
        traffic_score: Traffic score 1-100
        config: Optional grid configuration
        seed: Optional seed for reproducibility
        zone_layout: Optional Block DNA row types for a canonical claim board
        global_cover_bonus: Snapshotted DNA cover modifier baked into each tile
    
    Returns:
        GridGenerationResult with complete grid data
    """
    generator = GridGenerator(
        city,
        traffic_score,
        config,
        seed,
        zone_layout=zone_layout,
        global_cover_bonus=global_cover_bonus,
    )
    return generator.generate()


def resolve_block_dna_profile(block: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Restore the same DNA fallback identity used by the TypeScript mapper.

    Complete snapshots win by value. A truncated snapshot falls back to its
    stored catalog id when that id still exists; otherwise it uses the pinned
    v1 address resolver. This keeps a damaged marked grid deterministic across
    Python placement/combat and client hydration.
    """
    grid_data = block.get('grid_data') or {}
    if isinstance(grid_data, str):
        try:
            grid_data = json.loads(grid_data)
        except (TypeError, ValueError):
            grid_data = {}
    if not isinstance(grid_data, dict):
        grid_data = {}

    snapshot = grid_data.get('__dna__')
    snapshot = snapshot if isinstance(snapshot, dict) else {}

    def finite_number(key: str) -> Optional[float]:
        value = snapshot.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError, OverflowError):
            return None
        return numeric if math.isfinite(numeric) else None

    dna_id = snapshot.get('dnaId')
    zone_layout = snapshot.get('zoneLayout')
    income_multiplier = finite_number('incomeMultiplier')
    heat_decay_multiplier = finite_number('heatDecayMultiplier')
    max_members = finite_number('maxMembers')
    cover_bonus = finite_number('globalCoverBonus')
    if (
        isinstance(dna_id, str)
        and bool(dna_id)
        and isinstance(zone_layout, list)
        and len(zone_layout) == 8
        and all(
            isinstance(zone, str) and zone in DNA_ZONE_TYPES
            for zone in zone_layout
        )
        and income_multiplier is not None
        and income_multiplier >= 0
        and heat_decay_multiplier is not None
        and heat_decay_multiplier >= 0
        and max_members is not None
        and max_members.is_integer()
        and 1 <= max_members <= 64
        and (cover_bonus is None or -1 <= cover_bonus <= 1)
    ):
        return {
            'dnaId': dna_id,
            'zoneLayout': list(zone_layout),
            'incomeMultiplier': income_multiplier,
            'heatDecayMultiplier': heat_decay_multiplier,
            'maxMembers': max_members,
            # The client treats an absent or malformed optional bonus as zero.
            'globalCoverBonus': cover_bonus if cover_bonus is not None else 0.0,
            'seed': str(snapshot.get('seed') or dna_id),
            'source': 'snapshot',
        }

    if isinstance(dna_id, str) and dna_id:
        cards = load_catalog().get('cards') or []
        card = None
        for candidate in cards:
            if isinstance(candidate, dict) and candidate.get('id') == dna_id:
                card = candidate
                break
        if card is not None:
            return {
                'dnaId': card['id'],
                'zoneLayout': build_zone_layout(card),
                'incomeMultiplier': float(card['incomeMultiplier']),
                'heatDecayMultiplier': float(card['heatDecayMultiplier']),
                'maxMembers': float(card['maxMembers']),
                'globalCoverBonus': float(card.get('globalCoverBonus', 0.0)),
                'seed': dna_id,
                'source': 'stored-id',
            }

    def safe_coordinate(key: str) -> float:
        value = block.get(key, 0.0)
        try:
            return parse_finite_decimal(value)
        except ValueError:
            return 0.0

    raw_address = block.get('address')
    safe_address = raw_address if isinstance(raw_address, str) and raw_address else 'Unknown'
    try:
        resolved = resolve_block_dna(
            safe_coordinate('lat'),
            safe_coordinate('lng'),
            safe_address,
            version='v1',
        )
        card = resolved['card']
        return {
            'dnaId': card['id'],
            'zoneLayout': build_zone_layout(card),
            'incomeMultiplier': float(card['incomeMultiplier']),
            'heatDecayMultiplier': float(card['heatDecayMultiplier']),
            'maxMembers': float(card['maxMembers']),
            'globalCoverBonus': float(card.get('globalCoverBonus', 0.0)),
            'seed': str(resolved.get('seed') or card['id']),
            'source': 'legacy-resolver',
        }
    except Exception as error:  # pragma: no cover - catalog corruption is fatal elsewhere
        logger.warning('Could not restore Block DNA fallback: %s', error)
        return None


def resolve_block_grid_tiles(block: Dict[str, Any]) -> Tuple[List[List[Dict[str, Any]]], str]:
    """Resolve one safe gameplay board for placement and encounter consumers.

    A valid marked board wins. If its payload is damaged (or an unmarked
    record already carries a DNA snapshot), rebuild a feature-free board from
    the saved row layout and cover modifier. The feature-free form is
    intentional: it is the exact fallback the TypeScript client can reproduce.
    Only records with no usable DNA identity may retain a validated legacy
    board.
    """
    raw_grid_data = block.get('grid_data') or {}
    grid_container_is_object = isinstance(raw_grid_data, dict)
    grid_data = raw_grid_data
    if isinstance(raw_grid_data, str):
        try:
            grid_data = json.loads(raw_grid_data)
        except (TypeError, ValueError):
            grid_data = {}
    if not isinstance(grid_data, dict):
        grid_data = {}

    # API clients receive JSON objects. Treat string-wrapped board containers
    # as malformed so Python cannot consume a board the TypeScript mapper must
    # discard. We may still read a DNA snapshot from parsed outer JSON below.
    board_grid_data = grid_data if grid_container_is_object else {}
    nested_grid = board_grid_data.get('grid') or {}
    if not isinstance(nested_grid, dict):
        nested_grid = {}
    nested_candidate = nested_grid.get('tiles') if isinstance(nested_grid, dict) else None
    nested_rows = nested_candidate if isinstance(nested_candidate, list) and nested_candidate else None
    legacy_rows = nested_rows if nested_rows else board_grid_data.get('tiles')

    metadata = board_grid_data.get('metadata') or {}
    contract = metadata.get('gridContract') if isinstance(metadata, dict) else None
    marked = isinstance(contract, dict) and contract.get('name') == 'block-dna-grid'

    def validated_rows(rows: Any, canonical: bool) -> List[List[Dict[str, Any]]]:
        if not isinstance(rows, list) or not rows or not isinstance(rows[0], list) or not rows[0]:
            return []
        width = len(rows[0])
        # BlockData and every historical generator contract are 8x8. Reject a
        # larger legacy rectangle rather than allowing placement coordinates
        # that the encounter member snapshot cannot represent.
        if len(rows) != 8 or width != 8:
            return []
        if canonical:
            contract_version = contract.get('version')
            if (
                isinstance(contract_version, bool)
                or contract_version != 1
                or contract.get('globalCoverBonusApplied') is not True
                or not isinstance(nested_grid, dict)
                or nested_grid.get('width') != 8
                or nested_grid.get('height') != 8
            ):
                return []
        normalized_rows = []
        for y, row in enumerate(rows):
            if not isinstance(row, list) or len(row) != width:
                return []
            row_type = row[0].get('type') if row and isinstance(row[0], dict) else None
            if canonical and row_type not in DNA_ZONE_TYPES:
                return []
            normalized_row = []
            for x, tile in enumerate(row):
                tile_x = tile.get('x') if isinstance(tile, dict) else None
                tile_y = tile.get('y') if isinstance(tile, dict) else None
                if (
                    not isinstance(tile, dict)
                    or not isinstance(tile.get('type'), str)
                    or isinstance(tile_x, bool)
                    or isinstance(tile_y, bool)
                    or tile_x != x
                    or tile_y != y
                ):
                    return []
                if canonical and (
                    tile.get('type') != row_type
                    or not isinstance(tile.get('deployable'), bool)
                ):
                    return []
                if not canonical and tile.get('type') not in DNA_ZONE_TYPES:
                    return []
                legacy_bonus = tile.get('terrain_bonus')
                if canonical:
                    cover = tile.get('cover')
                    visibility = tile.get('visibility')
                else:
                    cover = tile.get(
                        'cover',
                        legacy_bonus.get('cover') if isinstance(legacy_bonus, dict) else None,
                    )
                    visibility = tile.get(
                        'visibility',
                        legacy_bonus.get('visibility') if isinstance(legacy_bonus, dict) else None,
                    )
                if canonical and (cover is None or visibility is None):
                    return []
                if not canonical:
                    cover = 0.0 if cover is None else cover
                    visibility = 1.0 if visibility is None else visibility
                for value in (cover, visibility):
                    if value is None:
                        continue
                    if isinstance(value, bool) or not isinstance(value, (int, float)):
                        return []
                    try:
                        finite = math.isfinite(float(value))
                    except (TypeError, ValueError, OverflowError):
                        finite = False
                    if not finite or not 0 <= value <= 1:
                        return []
                if not canonical:
                    deployable = tile.get('deployable')
                    if deployable is not None and not isinstance(deployable, bool):
                        return []
                    normalized_tile = dict(tile)
                    normalized_tile.update({
                        'x': x,
                        'y': y,
                        # Historical boards were not versioned. Normalize
                        # tactical decimals to the same wire precision as a
                        # generated canonical board before any consumer sees
                        # them.
                        'cover': _round_tactical_value(float(cover)),
                        'visibility': _round_tactical_value(float(visibility)),
                        'deployable': (
                            deployable
                            if isinstance(deployable, bool)
                            else tile['type'] in DNA_DEPLOYABLE_TYPES
                        ),
                    })
                    normalized_row.append(normalized_tile)
            if not canonical:
                normalized_rows.append(normalized_row)
        return rows if canonical else normalized_rows

    canonical_rows = validated_rows(nested_rows, canonical=True) if marked else []
    if canonical_rows:
        return canonical_rows, 'canonical'

    snapshot = grid_data.get('__dna__')
    if marked or isinstance(snapshot, dict):
        profile = resolve_block_dna_profile(block)
        if profile is not None:
            fallback = generate_block_grid(
                city=str(block.get('city') or 'legacy'),
                traffic_score=block.get('traffic_score') or 0,
                config=GridConfig(feature_density=0),
                seed=profile['seed'],
                zone_layout=profile['zoneLayout'],
                global_cover_bonus=profile['globalCoverBonus'],
            )
            return fallback.to_dict()['grid']['tiles'], 'dna-fallback'

    # A damaged marked board is never reinterpreted as legacy. That would let
    # malformed canonical values bypass the stricter contract.
    if marked:
        return [], 'missing'

    valid_legacy_rows = validated_rows(legacy_rows, canonical=False)
    if valid_legacy_rows:
        return valid_legacy_rows, 'legacy'

    # Snapshot-less records whose old board is missing or malformed use the
    # same pinned-v1 identity that the client has always used for hydration.
    profile = resolve_block_dna_profile(block)
    if profile is not None:
        fallback = generate_block_grid(
            city=str(block.get('city') or 'legacy'),
            traffic_score=block.get('traffic_score') or 0,
            config=GridConfig(feature_density=0),
            seed=profile['seed'],
            zone_layout=profile['zoneLayout'],
            global_cover_bonus=profile['globalCoverBonus'],
        )
        return fallback.to_dict()['grid']['tiles'], 'dna-fallback'
    return [], 'missing'


def regenerate_grid(
    city: str,
    traffic_score: int,
    config: GridConfig = None
) -> GridGenerationResult:
    """Generate grid with new random seed"""
    return generate_block_grid(city, traffic_score, config, None)
