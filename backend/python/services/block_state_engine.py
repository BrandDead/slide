"""
BlockStateEngine - Single Source of Truth for Block State
This service provides canonical snapshots of block state for all game modes.
"""

import json
import hashlib
import logging
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from supabase import create_client, Client
import os

logger = logging.getLogger(__name__)


@dataclass
class MemberSnapshot:
    """Snapshot of a gang member's state"""
    id: str
    role: str  # dealer, shooter, enforcer, canine
    stats: Dict[str, int]  # health, damage, defense, etc.
    position: Dict[str, int]  # x, y on grid
    loadout: Dict[str, Any]  # equipped items


@dataclass
class TileSnapshot:
    """Snapshot of a single grid tile"""
    x: int
    y: int
    tile_type: str  # street, building, alley, park, etc.
    terrain_bonus: Dict[str, float]  # cover, visibility, etc.
    member_id: Optional[str] = None


@dataclass
class BlockSnapshot:
    """Immutable snapshot of block state for combat/simulation"""
    block_id: str
    snapshot_id: str
    snapshot_version: int
    created_at: str
    
    # Location data
    address: str
    city: str
    bbox: List[float]  # [minLng, minLat, maxLng, maxLat]
    center: List[float]  # [lng, lat]
    
    # Grid layout
    grid_width: int
    grid_height: int
    tiles: List[List[TileSnapshot]]
    
    # Members on block
    members: List[MemberSnapshot]
    
    # Block stats
    heat_level: float
    income_rate: float
    defense_rating: float
    fortification_level: int
    
    # Seed for deterministic RNG
    seed: str
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        data = asdict(self)
        # Convert tiles to simple structure
        data['tiles'] = [
            [asdict(tile) for tile in row]
            for row in self.tiles
        ]
        return data


class BlockStateEngine:
    """
    Central engine for block state management.
    All game modes MUST use this to get block state.
    """
    
    def __init__(self, supabase_url: str = None, supabase_key: str = None):
        """Initialize with Supabase connection"""
        self.supabase_url = supabase_url or os.getenv('SUPABASE_URL')
        self.supabase_key = supabase_key or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if self.supabase_url and self.supabase_key:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            self.use_supabase = True
        else:
            self.supabase = None
            self.use_supabase = False
            logger.warning("BlockStateEngine initialized without Supabase - using mock data")
    
    def get_block_snapshot(
        self,
        block_id: str,
        snapshot_id: Optional[str] = None
    ) -> Optional[BlockSnapshot]:
        """
        Get current or specific snapshot of a block.
        
        Args:
            block_id: Block UUID
            snapshot_id: Optional specific snapshot UUID (for historical/combat)
        
        Returns:
            BlockSnapshot or None if not found
        """
        try:
            if snapshot_id:
                # Get specific snapshot from archive
                return self._get_archived_snapshot(snapshot_id)
            else:
                # Generate current snapshot
                return self._generate_current_snapshot(block_id)
        except Exception as e:
            logger.error(f"Failed to get block snapshot: {e}")
            return None
    
    def create_snapshot(self, block_id: str) -> Optional[str]:
        """
        Create and persist an immutable snapshot.
        Used at the start of combat to freeze block state.
        
        Args:
            block_id: Block UUID
        
        Returns:
            snapshot_id or None if failed
        """
        try:
            snapshot = self._generate_current_snapshot(block_id)
            if not snapshot:
                return None
            
            # Persist to database
            if self.use_supabase:
                result = self.supabase.table('block_snapshots').insert({
                    'id': snapshot.snapshot_id,
                    'block_id': block_id,
                    'version': snapshot.snapshot_version,
                    'snapshot_data': snapshot.to_dict(),
                    'created_at': snapshot.created_at
                }).execute()
                
                return snapshot.snapshot_id
            else:
                logger.warning("Snapshot created but not persisted (no Supabase)")
                return snapshot.snapshot_id
                
        except Exception as e:
            logger.error(f"Failed to create snapshot: {e}")
            return None
    
    def _generate_current_snapshot(self, block_id: str) -> Optional[BlockSnapshot]:
        """Generate snapshot from current database state"""
        if not self.use_supabase:
            return self._generate_mock_snapshot(block_id)
        
        try:
            # Fetch block data
            block_data = self.supabase.table('blocks').select('*').eq('id', block_id).single().execute()
            if not block_data.data:
                logger.error(f"Block {block_id} not found")
                return None
            
            block = block_data.data
            
            # Fetch members on this block
            members_data = self.supabase.table('gang_members').select(
                'id, role, stats, position, health, damage, defense'
            ).eq('current_block_id', block_id).execute()
            
            # Fetch member loadouts
            member_ids = [m['id'] for m in members_data.data] if members_data.data else []
            loadouts = {}
            if member_ids:
                loadouts_data = self.supabase.table('member_loadouts').select(
                    'member_id, weapon_id, armor_id, items'
                ).in_('member_id', member_ids).execute()
                
                for loadout in loadouts_data.data:
                    loadouts[loadout['member_id']] = loadout
            
            # Build member snapshots
            members = []
            for member in (members_data.data or []):
                member_loadout = loadouts.get(member['id'], {})
                members.append(MemberSnapshot(
                    id=member['id'],
                    role=member.get('role', 'soldier'),
                    stats={
                        'health': member.get('health', 100),
                        'damage': member.get('damage', 10),
                        'defense': member.get('defense', 5),
                    },
                    position=member.get('position', {'x': 0, 'y': 0}),
                    loadout={
                        'weapon_id': member_loadout.get('weapon_id'),
                        'armor_id': member_loadout.get('armor_id'),
                        'items': member_loadout.get('items', [])
                    }
                ))
            
            # Parse grid data
            grid_data = block.get('grid_data', {})
            if isinstance(grid_data, str):
                grid_data = json.loads(grid_data)
            
            tiles_data = grid_data.get('tiles', [])
            if not tiles_data:
                # Generate default grid if missing
                tiles_data = self._generate_default_grid(8, 8)
            
            # Build tile snapshots
            tiles = []
            for row_data in tiles_data:
                row = []
                for tile_data in row_data:
                    # Find member on this tile
                    member_on_tile = None
                    for m in members:
                        if m.position.get('x') == tile_data.get('x') and m.position.get('y') == tile_data.get('y'):
                            member_on_tile = m.id
                            break
                    
                    row.append(TileSnapshot(
                        x=tile_data.get('x', 0),
                        y=tile_data.get('y', 0),
                        tile_type=tile_data.get('type', 'building'),
                        terrain_bonus=tile_data.get('terrain_bonus', {}),
                        member_id=member_on_tile
                    ))
                tiles.append(row)
            
            # Compute derived stats
            heat_level = self.compute_heat(block)
            income_rate = self.compute_income(block, members)
            defense_rating = self.compute_defense(block, members)
            
            # Generate snapshot ID and seed
            snapshot_version = block.get('snapshot_version', 0) + 1
            snapshot_id = self._generate_snapshot_id(block_id, snapshot_version)
            seed = self._generate_seed(block_id, snapshot_version)
            
            # Get bbox and center
            coords = block.get('coordinates', {})
            if isinstance(coords, str):
                coords = json.loads(coords)
            
            # Extract bbox from polygon coordinates (PostGIS format)
            bbox = self._extract_bbox(coords)
            center_point = block.get('center_point', {})
            if isinstance(center_point, str):
                center_point = json.loads(center_point)
            center = self._extract_point(center_point)
            
            return BlockSnapshot(
                block_id=block_id,
                snapshot_id=snapshot_id,
                snapshot_version=snapshot_version,
                created_at=datetime.utcnow().isoformat(),
                address=block.get('address', ''),
                city=block.get('city', ''),
                bbox=bbox,
                center=center,
                grid_width=len(tiles[0]) if tiles else 8,
                grid_height=len(tiles),
                tiles=tiles,
                members=members,
                heat_level=heat_level,
                income_rate=income_rate,
                defense_rating=defense_rating,
                fortification_level=block.get('fortification_level', 0),
                seed=seed
            )
            
        except Exception as e:
            logger.error(f"Failed to generate snapshot: {e}", exc_info=True)
            return None
    
    def _generate_mock_snapshot(self, block_id: str) -> BlockSnapshot:
        """Generate a mock snapshot for testing without database — uses rich grid."""
        snapshot_id = self._generate_snapshot_id(block_id, 1)
        seed = self._generate_seed(block_id, 1)

        # Use the rich grid generator
        raw_tiles = self._generate_default_grid(8, 8, seed=seed)

        # Convert raw dicts to TileSnapshot objects
        tiles = []
        for row_data in raw_tiles:
            row = []
            for td in row_data:
                row.append(TileSnapshot(
                    x=td['x'],
                    y=td['y'],
                    tile_type=td['type'],
                    terrain_bonus=td['terrain_bonus'],
                ))
            tiles.append(row)

        members = [
            MemberSnapshot(
                id='member-1',
                role='shooter',
                stats={'health': 100, 'damage': 15, 'defense': 5},
                position={'x': 3, 'y': 3},
                loadout={'weapon_id': 'pistol-1', 'armor_id': None, 'items': []}
            )
        ]

        return BlockSnapshot(
            block_id=block_id,
            snapshot_id=snapshot_id,
            snapshot_version=1,
            created_at=datetime.utcnow().isoformat(),
            address='123 Mock St',
            city='Los Angeles',
            bbox=[-118.25, 34.05, -118.24, 34.06],
            center=[-118.245, 34.055],
            grid_width=8,
            grid_height=8,
            tiles=tiles,
            members=members,
            heat_level=30.0,
            income_rate=100.0,
            defense_rating=25.0,
            fortification_level=0,
            seed=seed
        )
    
    def _get_archived_snapshot(self, snapshot_id: str) -> Optional[BlockSnapshot]:
        """Retrieve a previously saved snapshot"""
        if not self.use_supabase:
            return None
        
        try:
            result = self.supabase.table('block_snapshots').select('snapshot_data').eq('id', snapshot_id).single().execute()
            if result.data:
                data = result.data['snapshot_data']
                # Reconstruct snapshot from stored data
                # (Simplified - in production would fully reconstruct all objects)
                return BlockSnapshot(**data)
            return None
        except Exception as e:
            logger.error(f"Failed to get archived snapshot: {e}")
            return None
    
    def compute_heat(self, block: Dict) -> float:
        """
        Compute current heat level for a block.
        MVP: Simple formula based on recent activity.
        """
        current_heat = float(block.get('current_heat', 0))
        max_heat = float(block.get('max_heat', 100))
        
        # Heat decays over time (simplified)
        # In full version, factor in time since last raid
        return min(current_heat, max_heat)
    
    def compute_income(self, block: Dict, members: List[MemberSnapshot]) -> float:
        """
        Compute income rate for a block.
        MVP: Base rate + dealer count * dealer multiplier
        """
        base_income = float(block.get('income_per_hour', 100))
        
        # Count dealers
        dealer_count = sum(1 for m in members if m.role == 'dealer')
        dealer_bonus = dealer_count * 25.0
        
        # Traffic bonus
        traffic = block.get('traffic_level', 50) / 100.0
        traffic_bonus = base_income * traffic * 0.2
        
        return base_income + dealer_bonus + traffic_bonus
    
    def compute_defense(self, block: Dict, members: List[MemberSnapshot]) -> float:
        """
        Compute defense rating for a block.
        MVP: Fortification + shooter count + equipment
        """
        fortification = float(block.get('fortification_level', 0)) * 10.0
        
        # Count shooters and enforcers
        combat_members = sum(1 for m in members if m.role in ['shooter', 'enforcer'])
        member_defense = combat_members * 5.0
        
        # Sum member defense stats
        stat_defense = sum(m.stats.get('defense', 0) for m in members)
        
        return fortification + member_defense + stat_defense
    
    def _generate_snapshot_id(self, block_id: str, version: int) -> str:
        """Generate unique snapshot ID"""
        data = f"{block_id}-{version}-{datetime.utcnow().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _generate_seed(self, block_id: str, version: int) -> str:
        """Generate deterministic seed for RNG"""
        data = f"{block_id}-v{version}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    def _extract_bbox(self, coords: Any) -> List[float]:
        """Extract bounding box from PostGIS coordinates"""
        if not coords:
            return [-118.25, 34.05, -118.24, 34.06]  # Default LA
        
        # Handle different coordinate formats
        if isinstance(coords, dict) and 'coordinates' in coords:
            coords = coords['coordinates']
        
        if isinstance(coords, list) and len(coords) > 0:
            if isinstance(coords[0], list) and len(coords[0]) > 0:
                points = coords[0] if isinstance(coords[0][0], list) else coords
                lngs = [p[0] for p in points]
                lats = [p[1] for p in points]
                return [min(lngs), min(lats), max(lngs), max(lats)]
        
        return [-118.25, 34.05, -118.24, 34.06]
    
    def _extract_point(self, point: Any) -> List[float]:
        """Extract point from PostGIS format"""
        if not point:
            return [-118.245, 34.055]  # Default LA
        
        if isinstance(point, dict) and 'coordinates' in point:
            coords = point['coordinates']
            if isinstance(coords, list) and len(coords) >= 2:
                return [coords[0], coords[1]]
        
        return [-118.245, 34.055]
    
    # ─── Rich Grid Feature Configs (from Issue #12) ────────────────────────
    TILE_TYPES = {
        'street':   {'base_cover': 0.0,  'base_visibility': 1.0,  'walkable': True},
        'sidewalk': {'base_cover': 0.05, 'base_visibility': 1.0,  'walkable': True},
        'alley':    {'base_cover': 0.25, 'base_visibility': 0.6,  'walkable': True},
        'parking':  {'base_cover': 0.0,  'base_visibility': 0.9,  'walkable': True},
        'building': {'base_cover': 0.8,  'base_visibility': 0.3,  'walkable': False},
        'yard':     {'base_cover': 0.1,  'base_visibility': 0.85, 'walkable': True},
        'park':     {'base_cover': 0.15, 'base_visibility': 0.7,  'walkable': True},
    }

    FEATURES = {
        'dumpster':      {'cover': 0.7,  'visibility_penalty': 0.3,  'destructible': False, 'hp': 0,   'valid_tiles': ['sidewalk', 'alley']},
        'parked_car':    {'cover': 0.6,  'visibility_penalty': 0.2,  'destructible': True,  'hp': 100, 'valid_tiles': ['street', 'parking']},
        'mailbox':       {'cover': 0.3,  'visibility_penalty': 0.1,  'destructible': True,  'hp': 30,  'valid_tiles': ['sidewalk']},
        'fire_hydrant':  {'cover': 0.2,  'visibility_penalty': 0.05, 'destructible': False, 'hp': 0,   'valid_tiles': ['sidewalk']},
        'streetlight':   {'cover': 0.1,  'visibility_penalty': -0.2, 'destructible': True,  'hp': 50,  'valid_tiles': ['sidewalk']},
        'bench':         {'cover': 0.25, 'visibility_penalty': 0.05, 'destructible': True,  'hp': 40,  'valid_tiles': ['sidewalk', 'park']},
        'trash_can':     {'cover': 0.15, 'visibility_penalty': 0.05, 'destructible': True,  'hp': 20,  'valid_tiles': ['sidewalk', 'alley']},
        'phone_booth':   {'cover': 0.4,  'visibility_penalty': 0.15, 'destructible': True,  'hp': 60,  'valid_tiles': ['sidewalk']},
        'fence':         {'cover': 0.35, 'visibility_penalty': 0.1,  'destructible': True,  'hp': 45,  'valid_tiles': ['yard', 'alley']},
        'barrel':        {'cover': 0.3,  'visibility_penalty': 0.1,  'destructible': True,  'hp': 25,  'valid_tiles': ['alley', 'parking']},
    }

    def _generate_default_grid(self, width: int, height: int, seed: str = None) -> List[List[Dict]]:
        """
        Generate a rich grid layout with varied terrain types, features,
        cover bonuses, visibility, and destructible objects.
        Uses seeded RNG for deterministic placement.
        """
        import random as _random
        rng = _random.Random(seed or 'default-seed')

        # ── Step 1: Lay out base terrain ──────────────────────────────────
        base_grid = []
        for y in range(height):
            row = []
            for x in range(width):
                if y == 0 or y == height - 1:
                    tile_type = 'street'
                elif x == 0 or x == width - 1:
                    tile_type = 'sidewalk'
                elif (x == 1 or x == width - 2) and (y == 1 or y == height - 2):
                    tile_type = rng.choice(['alley', 'sidewalk'])
                elif x == 1 or x == width - 2:
                    tile_type = rng.choice(['sidewalk', 'yard', 'parking'])
                else:
                    # Interior tiles: mostly buildings with some alleys/yards
                    roll = rng.random()
                    if roll < 0.55:
                        tile_type = 'building'
                    elif roll < 0.70:
                        tile_type = 'yard'
                    elif roll < 0.82:
                        tile_type = 'alley'
                    elif roll < 0.90:
                        tile_type = 'parking'
                    else:
                        tile_type = 'park'
                row.append(tile_type)
            base_grid.append(row)

        # ── Step 2: Spawn features on valid tiles ─────────────────────────
        feature_grid = [[None] * width for _ in range(height)]
        feature_names = list(self.FEATURES.keys())

        for y in range(height):
            for x in range(width):
                tile_type = base_grid[y][x]
                if tile_type == 'building':
                    continue  # No features on buildings

                # ~25% chance of a feature on eligible tiles
                if rng.random() < 0.25:
                    eligible = [
                        f for f in feature_names
                        if tile_type in self.FEATURES[f]['valid_tiles']
                    ]
                    if eligible:
                        feature_grid[y][x] = rng.choice(eligible)

        # ── Step 3: Build final tile dicts ────────────────────────────────
        tiles = []
        for y in range(height):
            row = []
            for x in range(width):
                tile_type = base_grid[y][x]
                tile_cfg = self.TILE_TYPES.get(tile_type, self.TILE_TYPES['building'])
                feature_name = feature_grid[y][x]

                cover = tile_cfg['base_cover']
                visibility = tile_cfg['base_visibility']
                feature_data = None

                if feature_name:
                    feat_cfg = self.FEATURES[feature_name]
                    cover = max(cover, feat_cfg['cover'])
                    visibility = max(0.0, visibility - feat_cfg['visibility_penalty'])
                    feature_data = {
                        'name': feature_name,
                        'cover_bonus': feat_cfg['cover'],
                        'destructible': feat_cfg['destructible'],
                        'hp': feat_cfg['hp'] if feat_cfg['destructible'] else None,
                        'max_hp': feat_cfg['hp'] if feat_cfg['destructible'] else None,
                    }

                tile = {
                    'x': x,
                    'y': y,
                    'type': tile_type,
                    'walkable': tile_cfg['walkable'],
                    'terrain_bonus': {
                        'cover': round(cover, 2),
                        'visibility': round(visibility, 2),
                    },
                }
                if feature_data:
                    tile['feature'] = feature_data

                row.append(tile)
            tiles.append(row)

        return tiles


# Global instance
_engine = None

def get_block_state_engine() -> BlockStateEngine:
    """Get or create singleton instance"""
    global _engine
    if _engine is None:
        _engine = BlockStateEngine()
    return _engine
