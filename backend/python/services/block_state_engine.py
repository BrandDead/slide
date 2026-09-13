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

from services.grid_generator import (
    parse_finite_decimal,
    parse_python_integer,
    resolve_block_grid_tiles,
)

logger = logging.getLogger(__name__)

def _tile_terrain_bonus(tile_data: Dict[str, Any]) -> Dict[str, float]:
    """Normalize canonical root values while retaining legacy bonus fields."""
    legacy = tile_data.get('terrain_bonus')
    bonus = dict(legacy) if isinstance(legacy, dict) else {}
    bonus['cover'] = tile_data.get('cover', bonus.get('cover', 0.0))
    bonus['visibility'] = tile_data.get('visibility', bonus.get('visibility', 1.0))
    return bonus

def _members_from_placements(
    placements: List[Dict[str, Any]],
    roster_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
    loadouts_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
    require_roster: bool = False,
    gameplay_tiles: Optional[List[List[Dict[str, Any]]]] = None,
) -> List['MemberSnapshot']:
    """Overlay saved state and normalize positions onto the gameplay board."""
    roster_by_id = roster_by_id or {}
    loadouts_by_id = loadouts_by_id or {}
    placement_grid = gameplay_tiles or [
        [{'deployable': True} for _x in range(8)] for _y in range(8)
    ]
    occupied = set()

    def tile_is_deployable(tile: Any) -> bool:
        if not isinstance(tile, dict):
            return False
        deployable = tile.get('deployable')
        if isinstance(deployable, bool):
            return deployable
        return tile.get('type') not in {'street', 'building'}

    def first_open_position() -> Optional[Dict[str, int]]:
        for candidate_y, row in enumerate(placement_grid):
            if not isinstance(row, list):
                continue
            for candidate_x, tile in enumerate(row):
                if (
                    isinstance(tile, dict)
                    and tile_is_deployable(tile)
                    and (candidate_x, candidate_y) not in occupied
                ):
                    return {'x': candidate_x, 'y': candidate_y}
        return None

    members = []
    ordered_placements = sorted(
        placements,
        key=lambda item: str(
            (item.get('memberId') or item.get('member_id') or '')
            if isinstance(item, dict) else ''
        ),
    )
    for placement in ordered_placements:
        if not isinstance(placement, dict):
            continue
        member_id = placement.get('memberId') or placement.get('member_id')
        if not member_id:
            continue
        member_id = str(member_id)
        roster = roster_by_id.get(member_id)
        if require_roster and roster is None:
            logger.warning('Skipping placement for unresolved member %s', member_id)
            continue
        roster = roster or {}
        x = placement.get('gridX', placement.get('x', 0))
        y = placement.get('gridY', placement.get('y', 0))
        requested = None
        try:
            if isinstance(x, bool) or isinstance(y, bool):
                raise ValueError
            numeric_x = parse_finite_decimal(x)
            numeric_y = parse_finite_decimal(y)
            if not numeric_x.is_integer() or not numeric_y.is_integer():
                raise ValueError
            requested = {'x': int(numeric_x), 'y': int(numeric_y)}
        except (TypeError, ValueError, OverflowError):
            # Match the client compatibility mapper: malformed legacy
            # coordinates relocate deterministically rather than inventing a
            # partially valid position or dropping an otherwise valid member.
            requested = None
        try:
            health = max(0, min(100, parse_python_integer(placement.get('health', 100))))
        except (TypeError, ValueError, OverflowError):
            logger.warning('Skipping malformed block placement for member %s', member_id)
            continue
        try:
            damage = parse_python_integer(roster.get('damage', placement.get('damage', 10)))
        except (TypeError, ValueError, OverflowError):
            damage = 10
        try:
            defense = parse_python_integer(
                roster.get('defense', roster.get('armor_rating', placement.get('defense', 5)))
            )
        except (TypeError, ValueError, OverflowError):
            defense = 5
        requested_tile = (
            placement_grid[requested['y']][requested['x']]
            if requested is not None
            and 0 <= requested['y'] < len(placement_grid)
            and isinstance(placement_grid[requested['y']], list)
            and 0 <= requested['x'] < len(placement_grid[requested['y']])
            else None
        )
        if (
            isinstance(requested_tile, dict)
            and tile_is_deployable(requested_tile)
            and (requested['x'], requested['y']) not in occupied
        ):
            position = requested
        else:
            position = first_open_position()
        if position is None:
            logger.warning('Skipping placement with no open gameplay tile for member %s', member_id)
            continue
        occupied.add((position['x'], position['y']))
        loadout_row = loadouts_by_id.get(member_id) or {}
        loadout = {
            'weapon_id': loadout_row.get('weapon_id') or roster.get('weapon_name'),
            'armor_id': loadout_row.get('armor_id'),
            'items': loadout_row.get('items') or [],
        } if loadout_row or roster.get('weapon_name') else {}
        members.append(MemberSnapshot(
            id=member_id,
            role=str(roster.get('role', placement.get('role', 'soldier'))),
            stats={
                'health': health,
                'damage': damage,
                'defense': defense,
            },
            position=position,
            loadout=loadout,
        ))
    return members


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
            self._mock_snapshots = {}
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
                # Keep the offline engine’s archive semantics aligned with the
                # production path so encounter tests can reload the immutable
                # snapshot without requiring a database connection.
                self._mock_snapshots[snapshot.snapshot_id] = snapshot
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

            # Resolve the gameplay board before members so malformed/legacy
            # placements follow the same first-open relocation rule as the
            # client mapper.
            tiles_data, _grid_source = resolve_block_grid_tiles(block)
            if not tiles_data:
                tiles_data = self._generate_default_grid(8, 8)
            
            # The block placement route writes `block_placements`; consume that
            # exact contract first so the encounter cannot relocate defenders.
            # Older records may still assign members directly on gang_members,
            # so retain that path only when no placement rows exist.
            from services.db import get_db
            db = get_db()
            placements = db.get_placements(block_id)
            placement_ids = [
                str(p.get('memberId') or p.get('member_id'))
                for p in placements
                if p.get('memberId') or p.get('member_id')
            ]
            roster_rows = db.get_owned_members(block.get('owner_id'), placement_ids)
            roster_by_id = {str(row['id']): row for row in roster_rows if row.get('id')}
            members = _members_from_placements(
                placements,
                roster_by_id=roster_by_id,
                loadouts_by_id=db.get_member_loadouts(placement_ids),
                require_roster=bool(placements),
                gameplay_tiles=tiles_data,
            )
            if not placements:
                # Compatibility only: pre-placement records assigned members
                # directly on one of two historical gang_members columns.
                members_data = None
                for assignment_column in ('assigned_block_id', 'current_block_id'):
                    try:
                        members_data = (
                            self.supabase.table('gang_members')
                            .select('*')
                            .eq(assignment_column, block_id)
                            .execute()
                        )
                        break
                    except Exception:
                        continue
                legacy_rows = members_data.data if members_data and members_data.data else []
                legacy_ids = [str(member['id']) for member in legacy_rows if member.get('id')]
                legacy_placements = []
                for member in legacy_rows:
                    position = member.get('position') if isinstance(member.get('position'), dict) else {}
                    legacy_placements.append({
                        'memberId': member.get('id'),
                        'role': member.get('role', 'soldier'),
                        'gridX': position.get('x', member.get('grid_x', 0)),
                        'gridY': position.get('y', member.get('grid_y', 0)),
                        'health': member.get('health', 100),
                    })
                members = _members_from_placements(
                    legacy_placements,
                    roster_by_id={str(row['id']): row for row in legacy_rows if row.get('id')},
                    loadouts_by_id=db.get_member_loadouts(legacy_ids),
                    gameplay_tiles=tiles_data,
                )

            # Build tile snapshots
            tiles = []
            for y, row_data in enumerate(tiles_data):
                row = []
                for x, tile_data in enumerate(row_data):
                    # Find member on this tile
                    member_on_tile = None
                    for m in members:
                        if m.position.get('x') == x and m.position.get('y') == y:
                            member_on_tile = m.id
                            break
                    
                    row.append(TileSnapshot(
                        x=x,
                        y=y,
                        tile_type=tile_data.get('type', 'building'),
                        terrain_bonus=_tile_terrain_bonus(tile_data),
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
    
    def _generate_mock_snapshot(self, block_id: str) -> Optional[BlockSnapshot]:
        """Generate a mock snapshot for testing without database — uses stored block grid when available."""
        snapshot_id = self._generate_snapshot_id(block_id, 1)
        seed = self._generate_seed(block_id, 1)

        # Prefer the claimed block's persisted board so offline combat exercises
        # the same nested `grid.tiles` shape used by the real claim path.
        from services.db import get_db
        block = get_db().get_block(block_id)
        if not block:
            logger.error(f"Block {block_id} not found")
            return None
        raw_tiles, _grid_source = resolve_block_grid_tiles(block)
        if not raw_tiles:
            raw_tiles = self._generate_default_grid(8, 8, seed=seed)

        members = _members_from_placements(
            get_db().get_placements(block_id),
            gameplay_tiles=raw_tiles,
        )

        # Convert raw dicts to TileSnapshot objects
        tiles = []
        for y, row_data in enumerate(raw_tiles):
            row = []
            for x, td in enumerate(row_data):
                terrain_bonus = _tile_terrain_bonus(td)
                member_on_tile = next((
                    member.id for member in members
                    if member.position.get('x') == x
                    and member.position.get('y') == y
                ), None)
                row.append(TileSnapshot(
                    x=x,
                    y=y,
                    tile_type=td['type'],
                    terrain_bonus=terrain_bonus,
                    member_id=member_on_tile,
                ))
            tiles.append(row)

        return BlockSnapshot(
            block_id=block_id,
            snapshot_id=snapshot_id,
            snapshot_version=1,
            created_at=datetime.utcnow().isoformat(),
            address=block.get('address', '123 Mock St'),
            city=block.get('city', 'Los Angeles'),
            bbox=[-118.25, 34.05, -118.24, 34.06],
            center=[-118.245, 34.055],
            grid_width=len(tiles[0]) if tiles else 8,
            grid_height=len(tiles) if tiles else 8,
            tiles=tiles,
            members=members,
            heat_level=float(block.get('heat_level', 0)),
            income_rate=self.compute_income(block, members),
            defense_rating=self.compute_defense(block, members),
            fortification_level=0,
            seed=seed
        )
    
    def _get_archived_snapshot(self, snapshot_id: str) -> Optional[BlockSnapshot]:
        """Retrieve a previously saved snapshot"""
        if not self.use_supabase:
            return self._mock_snapshots.get(snapshot_id)
        
        try:
            result = self.supabase.table('block_snapshots').select('snapshot_data').eq('id', snapshot_id).single().execute()
            if result.data:
                data = result.data['snapshot_data']
                if isinstance(data, str):
                    data = json.loads(data)
                if not isinstance(data, dict):
                    return None
                raw_tiles = data.get('tiles')
                raw_members = data.get('members')
                if not isinstance(raw_tiles, list) or not isinstance(raw_members, list):
                    return None
                tiles = [
                    [tile if isinstance(tile, TileSnapshot) else TileSnapshot(**tile) for tile in row]
                    for row in raw_tiles
                    if isinstance(row, list)
                ]
                if len(tiles) != len(raw_tiles):
                    return None
                members = [
                    member if isinstance(member, MemberSnapshot) else MemberSnapshot(**member)
                    for member in raw_members
                ]
                return BlockSnapshot(**{**data, 'tiles': tiles, 'members': members})
            return None
        except Exception as e:
            logger.error(f"Failed to get archived snapshot: {e}")
            return None
    
    def compute_heat(self, block: Dict) -> float:
        """
        Compute current heat level for a block.
        MVP: Simple formula based on recent activity.
        """
        current_heat = float(block.get('current_heat', block.get('heat_level', block.get('block_heat', 0))))
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
