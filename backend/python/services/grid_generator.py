"""
DEALT/SLIDE - Grid Generator Service
Converts real-world location data into playable tactical grids

Grid Layout (8x8 default):
Row 0-1: Top Sidewalk (defender territory)
Row 2-5: Street (drive-by path)
Row 6-7: Bottom Sidewalk (defender territory)
"""

import hashlib
import math
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
import logging

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
    'sidewalk': 0.1,
    'building': 0.9,
    'alley': 0.3,
    'parking': 0.05,
    'grass': 0.05,
    'water': 0.0,
}

TILE_BASE_VISIBILITY = {
    'street': 1.0,
    'sidewalk': 0.9,
    'building': 0.3,
    'alley': 0.6,
    'parking': 0.95,
    'grass': 0.85,
    'water': 1.0,
}

TILE_MOVEMENT_COST = {
    'street': 1.0,
    'sidewalk': 1.0,
    'building': 999,  # Impassable
    'alley': 1.2,
    'parking': 1.0,
    'grass': 1.3,
    'water': 999,
}


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
            'cover': round(self.cover, 2),
            'visibility': round(self.visibility, 2),
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
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'grid': self.grid.to_dict(),
            'metadata': {
                'generatedAt': self.generated_at,
                'seed': self.seed,
                'config': asdict(self.config),
                'stats': self.stats,
            }
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
        seed: str = None
    ):
        self.city = city
        self.traffic_score = traffic_score
        self.config = config or GridConfig()
        
        # Generate deterministic seed if not provided
        if seed:
            self.config.seed = seed
        elif not self.config.seed:
            self.config.seed = f"{city}_{traffic_score}_{datetime.utcnow().timestamp()}"
        
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
        )
    
    def _generate_tile(self, x: int, y: int) -> GridTile:
        """Generate a single tile"""
        tile_type = self._determine_tile_type(y)
        subtype = self._determine_subtype(x, y, tile_type)
        
        return GridTile(
            x=x,
            y=y,
            type=tile_type,
            subtype=subtype,
            cover=TILE_BASE_COVER.get(tile_type, 0),
            visibility=TILE_BASE_VISIBILITY.get(tile_type, 1.0),
            movement_cost=TILE_MOVEMENT_COST.get(tile_type, 1.0),
            deployable=self._is_deployable(tile_type, y),
        )
    
    def _determine_tile_type(self, y: int) -> str:
        """Determine tile type based on row position"""
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
        
        return BlockGrid(
            width=gw,
            height=gh,
            tiles=tiles,
            street_rows=list(range(sw, sw + st)),
            sidewalk_rows_top=list(range(sw)),
            sidewalk_rows_bottom=list(range(sw + st, gh)),
            attacker_entry=[{'x': 0, 'y': sw + st // 2}],
            attacker_exit=[{'x': gw - 1, 'y': sw + st // 2}],
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
    seed: str = None
) -> GridGenerationResult:
    """
    Generate a grid for a block.
    
    Args:
        city: City code (nyc, la, etc.)
        traffic_score: Traffic score 1-100
        config: Optional grid configuration
        seed: Optional seed for reproducibility
    
    Returns:
        GridGenerationResult with complete grid data
    """
    generator = GridGenerator(city, traffic_score, config, seed)
    return generator.generate()


def regenerate_grid(
    city: str,
    traffic_score: int,
    config: GridConfig = None
) -> GridGenerationResult:
    """Generate grid with new random seed"""
    return generate_block_grid(city, traffic_score, config, None)
