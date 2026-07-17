"""
DEALT/SLIDE - Database Adapter Layer
Provides a clean interface to Supabase PostgreSQL.
Falls back to in-memory mock data when Supabase is not configured (dev mode).

Usage:
    from services.db import get_db
    db = get_db()
    profile = db.get_or_create_profile(user_id)
"""

import os
import logging
import uuid
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# IN-MEMORY MOCK STORE (used when Supabase is not configured)
# ─────────────────────────────────────────────────────────────────────────────

_mock_profiles: Dict[str, Dict] = {}
_mock_blocks: Dict[str, Dict] = {}
_mock_inventory: Dict[str, List[Dict]] = {}
_mock_combat_sessions: Dict[str, Dict] = {}
_mock_entitlements: Dict[str, List[Dict]] = {}
_mock_placements: Dict[str, List[Dict]] = {}  # block_id -> placements
_mock_player_heat: Dict[str, int] = {}


def _make_id() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# DB ADAPTER CLASS
# ─────────────────────────────────────────────────────────────────────────────

class DBAdapter:
    """Thin adapter over Supabase client. Falls back to in-memory mocks in dev mode."""

    def __init__(self, supabase_client=None):
        self._sb = supabase_client
        self._dev_mode = supabase_client is None
        if self._dev_mode:
            logger.warning("DBAdapter running in dev mode — using in-memory mock store")

    # ─── Profiles ──────────────────────────────────────────────────────────

    def get_or_create_profile(self, user_id: str) -> Dict:
        """Return user profile, creating it if it doesn't exist."""
        if self._dev_mode:
            if user_id not in _mock_profiles:
                _mock_profiles[user_id] = {
                    'id': user_id,
                    'username': f'player_{user_id[:6]}',
                    'cash': 10000,
                    'heat': 0,
                    'level': 1,
                    'xp': 0,
                    'created_at': _now(),
                }
            profile = _mock_profiles[user_id]
            profile.setdefault('heat', _mock_player_heat.get(user_id, 0))
            return profile

        try:
            result = self._sb.table('profiles').select('*').eq('id', user_id).execute()
            if result.data:
                return result.data[0]
            # Create profile
            new_profile = {
                'id': user_id,
                'username': f'player_{user_id[:6]}',
                'cash': 10000,
                'level': 1,
                'xp': 0,
            }
            created = self._sb.table('profiles').insert(new_profile).execute()
            return created.data[0] if created.data else new_profile
        except Exception as e:
            logger.error(f"get_or_create_profile failed: {e}")
            raise

    def get_player_state(self, user_id: str) -> Dict:
        """Return authoritative cash/heat/level for the player."""
        profile = self.get_or_create_profile(user_id)
        return {
            'user_id': user_id,
            'cash': int(profile.get('cash', 0)),
            'heat': int(profile.get('heat', _mock_player_heat.get(user_id, 0))),
            'level': int(profile.get('level', 1)),
            'xp': int(profile.get('xp', 0)),
            'username': profile.get('username', ''),
        }

    def deduct_cash(self, user_id: str, amount: int) -> Optional[Dict]:
        """Deduct cash if funds allow. Returns updated player state or None."""
        if amount < 0:
            raise ValueError('amount must be non-negative')
        profile = self.get_or_create_profile(user_id)
        cash = int(profile.get('cash', 0))
        if cash < amount:
            return None
        return self.apply_economy_delta(user_id, cash_delta=-amount, heat_delta=0)

    def apply_economy_delta(
        self,
        user_id: str,
        cash_delta: int = 0,
        heat_delta: int = 0,
    ) -> Dict:
        """Apply cash/heat deltas and return the updated player state."""
        profile = self.get_or_create_profile(user_id)
        new_cash = max(0, int(profile.get('cash', 0)) + cash_delta)
        new_heat = max(0, min(100, int(profile.get('heat', 0)) + heat_delta))

        if self._dev_mode:
            profile['cash'] = new_cash
            profile['heat'] = new_heat
            _mock_player_heat[user_id] = new_heat
            _mock_profiles[user_id] = profile
            return self.get_player_state(user_id)

        try:
            self._sb.table('profiles').update({
                'cash': new_cash,
                'heat': new_heat,
            }).eq('id', user_id).execute()
            profile['cash'] = new_cash
            profile['heat'] = new_heat
            return self.get_player_state(user_id)
        except Exception as e:
            logger.error(f"apply_economy_delta failed: {e}")
            raise

    def find_block_by_hash(self, block_hash: str) -> Optional[Dict]:
        if self._dev_mode:
            for block in _mock_blocks.values():
                if block.get('block_hash') == block_hash:
                    return block
            return None
        try:
            result = (
                self._sb.table('blocks')
                .select('*')
                .eq('block_hash', block_hash)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"find_block_by_hash failed: {e}")
            return None

    def save_placements(self, block_id: str, placements: List[Dict]) -> List[Dict]:
        """Replace placements for a block and bump live revision."""
        normalized = list(placements)
        if self._dev_mode:
            _mock_placements[block_id] = normalized
            if block_id in _mock_blocks:
                block = _mock_blocks[block_id]
                block['placements'] = normalized
                block['live_revision'] = int(block.get('live_revision', 0)) + 1
                block['pending_income'] = int(block.get('pending_income', 0))
                income = sum(int(p.get('incomePerTick') or p.get('income_per_tick') or 0) for p in normalized)
                block['income_per_tick'] = income
            return normalized

        try:
            self._sb.table('block_placements').delete().eq('block_id', block_id).execute()
            rows = []
            for p in normalized:
                rows.append({
                    'block_id': block_id,
                    'member_id': p.get('memberId') or p.get('member_id'),
                    'role': p.get('role'),
                    'x': p.get('gridX', p.get('x')),
                    'y': p.get('gridY', p.get('y')),
                    'anchor_id': p.get('anchorId') or p.get('anchor_id'),
                    'health': p.get('health', 100),
                    'income_per_tick': p.get('incomePerTick') or p.get('income_per_tick') or 0,
                    'payload': p,
                })
            if rows:
                self._sb.table('block_placements').insert(rows).execute()
            block = self.get_block(block_id)
            if block:
                rev = int(block.get('live_revision', 0)) + 1
                self._sb.table('blocks').update({
                    'live_revision': rev,
                    'income_per_tick': sum(int(r.get('income_per_tick') or 0) for r in rows),
                }).eq('id', block_id).execute()
            return normalized
        except Exception as e:
            logger.error(f"save_placements failed: {e}")
            raise

    def get_placements(self, block_id: str) -> List[Dict]:
        if self._dev_mode:
            if block_id in _mock_placements:
                return list(_mock_placements[block_id])
            block = _mock_blocks.get(block_id) or {}
            return list(block.get('placements') or [])
        try:
            result = (
                self._sb.table('block_placements')
                .select('*')
                .eq('block_id', block_id)
                .execute()
            )
            rows = result.data or []
            out = []
            for row in rows:
                payload = row.get('payload') or {}
                out.append({
                    **payload,
                    'memberId': row.get('member_id') or payload.get('memberId'),
                    'role': row.get('role') or payload.get('role'),
                    'gridX': row.get('x'),
                    'gridY': row.get('y'),
                    'anchorId': row.get('anchor_id') or payload.get('anchorId'),
                    'health': row.get('health', 100),
                    'incomePerTick': row.get('income_per_tick', 0),
                })
            return out
        except Exception as e:
            logger.error(f"get_placements failed: {e}")
            return []

    def collect_block_income(self, user_id: str, block_id: str) -> Optional[Dict]:
        """Move pending_income to player cash. Returns {collected, player, block}."""
        block = self.get_block(block_id)
        if not block or block.get('owner_id') != user_id:
            return None
        pending = int(block.get('pending_income') or 0)
        if pending <= 0:
            player = self.get_player_state(user_id)
            return {'collected': 0, 'player': player, 'block': block}

        if self._dev_mode:
            block['pending_income'] = 0
            _mock_blocks[block_id] = block
            player = self.apply_economy_delta(user_id, cash_delta=pending, heat_delta=0)
            return {'collected': pending, 'player': player, 'block': block}

        try:
            self._sb.table('blocks').update({'pending_income': 0}).eq('id', block_id).execute()
            player = self.apply_economy_delta(user_id, cash_delta=pending, heat_delta=0)
            block['pending_income'] = 0
            return {'collected': pending, 'player': player, 'block': block}
        except Exception as e:
            logger.error(f"collect_block_income failed: {e}")
            raise

    def tick_block_income(self, block_id: str) -> Optional[Dict]:
        """Add income_per_tick into pending_income (world/earn step)."""
        block = self.get_block(block_id)
        if not block:
            return None
        income = int(block.get('income_per_tick') or block.get('income_per_hour') or 0)
        pending = int(block.get('pending_income') or 0) + income
        if self._dev_mode:
            block['pending_income'] = pending
            _mock_blocks[block_id] = block
            return block
        try:
            self._sb.table('blocks').update({'pending_income': pending}).eq('id', block_id).execute()
            block['pending_income'] = pending
            return block
        except Exception as e:
            logger.error(f"tick_block_income failed: {e}")
            raise

    # ─── Paid access entitlements ─────────────────────────────────────────

    def get_active_entitlements(self, user_id: str) -> List[Dict]:
        """Return effective paid-access entitlements for the authenticated owner."""
        if self._dev_mode:
            if os.getenv('DEV_PAID_BETA_ACCESS', 'false').lower() == 'true':
                return [{
                    'id': 'dev-paid-beta',
                    'user_id': user_id,
                    'entitlement_key': 'paid_beta',
                    'product_id': 'founders-access',
                    'source': 'manual',
                    'status': 'active',
                    'expires_at': None,
                    'granted_at': _now(),
                }]
            return _mock_entitlements.get(user_id, [])

        try:
            result = (
                self._sb.table('entitlements')
                .select('id, entitlement_key, product_id, source, status, granted_at, expires_at')
                .eq('user_id', user_id)
                .eq('status', 'active')
                .execute()
            )
            entitlements = result.data or []
            now = _utc_now()
            return [
                entitlement for entitlement in entitlements
                if _entitlement_is_effective(entitlement, now)
            ]
        except Exception as e:
            logger.error(f"get_active_entitlements failed: {e}")
            raise

    # ─── Blocks ────────────────────────────────────────────────────────────

    def claim_block(
        self,
        user_id: str,
        address: str,
        coords: Dict,
        city: str,
        bounds: Dict,
        gang_name: str = '',
        grid_data: Optional[Dict] = None,
        traffic_score: float = 0.5,
        block_hash: str = '',
        scene_manifest: Optional[Dict] = None,
        heat_level: int = 0,
    ) -> Dict:
        """Claim a block for a user. Returns the created block record."""
        block_id = _make_id()
        scene_version = f"scene-{block_id[:8]}-v1"
        block = {
            'id': block_id,
            'owner_id': user_id,
            'address': address,
            'city': city,
            'lat': coords.get('lat'),
            'lng': coords.get('lng'),
            'bounds_north': bounds.get('north'),
            'bounds_south': bounds.get('south'),
            'bounds_east': bounds.get('east'),
            'bounds_west': bounds.get('west'),
            'gang_name': gang_name,
            'grid_data': grid_data or {},
            'traffic_score': traffic_score,
            'income_per_hour': traffic_score * 10,
            'income_per_tick': 0,
            'pending_income': 0,
            'heat_level': heat_level,
            'block_hash': block_hash,
            'scene_version': scene_version,
            'scene_manifest': scene_manifest or {},
            'live_revision': 1,
            'placements': [],
            'claimed_at': _now(),
        }

        if self._dev_mode:
            _mock_blocks[block_id] = block
            _mock_placements[block_id] = []
            return block

        try:
            result = self._sb.table('blocks').insert(block).execute()
            return result.data[0] if result.data else block
        except Exception as e:
            logger.error(f"claim_block failed: {e}")
            raise

    def get_blocks_for_city(self, city: str, limit: int = 100) -> List[Dict]:
        """Return blocks in a given city."""
        if self._dev_mode:
            return [b for b in _mock_blocks.values() if b.get('city') == city][:limit]

        try:
            result = (
                self._sb.table('blocks')
                .select('*')
                .eq('city', city)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"get_blocks_for_city failed: {e}")
            return []

    def get_user_blocks(self, user_id: str) -> List[Dict]:
        """Return all blocks owned by a user."""
        if self._dev_mode:
            return [b for b in _mock_blocks.values() if b.get('owner_id') == user_id]

        try:
            result = (
                self._sb.table('blocks')
                .select('*')
                .eq('owner_id', user_id)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"get_user_blocks failed: {e}")
            return []

    def get_block(self, block_id: str) -> Optional[Dict]:
        """Return a block by ID."""
        if self._dev_mode:
            return _mock_blocks.get(block_id)

        try:
            result = self._sb.table('blocks').select('*').eq('id', block_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"get_block failed: {e}")
            return None

    def update_block_backgrounds(self, block_id: str, backgrounds: Dict) -> bool:
        """Persist generated background URLs for a block."""
        if self._dev_mode:
            if block_id in _mock_blocks:
                _mock_blocks[block_id]['backgrounds'] = backgrounds
            return True

        try:
            self._sb.table('block_backgrounds').upsert({
                'block_id': block_id,
                'topdown_url': backgrounds.get('topdownUrl'),
                'street_n_url': backgrounds.get('streetNUrl'),
                'street_e_url': backgrounds.get('streetEUrl'),
                'street_s_url': backgrounds.get('streetSUrl'),
                'street_w_url': backgrounds.get('streetWUrl'),
            }).execute()
            return True
        except Exception as e:
            logger.error(f"update_block_backgrounds failed: {e}")
            return False

    def save_block_grid_anchors(self, block_id: str, anchors_json: Dict) -> bool:
        """Persist lat/lon anchors for each 8x8 grid tile."""
        if self._dev_mode:
            return True

        try:
            self._sb.table('block_grid_anchors').upsert({
                'block_id': block_id,
                'grid_size': 8,
                'anchors_json': anchors_json,
            }).execute()
            return True
        except Exception as e:
            logger.error(f"save_block_grid_anchors failed: {e}")
            return False

    # ─── Inventory ─────────────────────────────────────────────────────────

    def get_inventory(self, user_id: str) -> List[Dict]:
        """Return user's inventory items."""
        if self._dev_mode:
            return _mock_inventory.get(user_id, [])

        try:
            result = (
                self._sb.table('user_inventory')
                .select('*, item_catalog(*)')
                .eq('user_id', user_id)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"get_inventory failed: {e}")
            return []

    def buy_item(self, user_id: str, item_id: str, qty: int = 1) -> Optional[Dict]:
        """
        Purchase an item for a user.
        Returns updated inventory entry or None if failed (e.g. insufficient funds).
        """
        if self._dev_mode:
            if user_id not in _mock_inventory:
                _mock_inventory[user_id] = []
            # Check if item already in inventory
            for entry in _mock_inventory[user_id]:
                if entry['item_id'] == item_id:
                    entry['quantity'] += qty
                    return entry
            # New item
            new_entry = {
                'id': _make_id(),
                'user_id': user_id,
                'item_id': item_id,
                'quantity': qty,
            }
            _mock_inventory[user_id].append(new_entry)
            return new_entry

        try:
            # Check if already owned
            existing = (
                self._sb.table('user_inventory')
                .select('*')
                .eq('user_id', user_id)
                .eq('item_id', item_id)
                .execute()
            )
            if existing.data:
                new_qty = existing.data[0]['quantity'] + qty
                result = (
                    self._sb.table('user_inventory')
                    .update({'quantity': new_qty})
                    .eq('id', existing.data[0]['id'])
                    .execute()
                )
                return result.data[0] if result.data else None
            else:
                new_entry = {
                    'user_id': user_id,
                    'item_id': item_id,
                    'quantity': qty,
                }
                result = self._sb.table('user_inventory').insert(new_entry).execute()
                return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"buy_item failed: {e}")
            return None

    # ─── Combat ────────────────────────────────────────────────────────────

    def create_combat_session(
        self,
        attacker_user_id: str,
        target_block_id: str,
        attacker_gang_id: Optional[str] = None,
        target_snapshot_id: Optional[str] = None,
        seed: str = '',
    ) -> Dict:
        """Create and persist a new combat session."""
        session_id = f"combat-{_make_id()}"
        session = {
            'id': session_id,
            'attacker_user_id': attacker_user_id,
            'attacker_gang_id': attacker_gang_id,
            'target_block_id': target_block_id,
            'target_snapshot_id': target_snapshot_id,
            'current_turn': 0,
            'max_turns': 20,
            'attacker_hp': {},
            'defender_hp': {},
            'combat_log': [],
            'status': 'active',
            'seed': seed,
            'created_at': _now(),
        }

        if self._dev_mode:
            _mock_combat_sessions[session_id] = session
            return session

        try:
            result = self._sb.table('combat_sessions').insert(session).execute()
            return result.data[0] if result.data else session
        except Exception as e:
            logger.error(f"create_combat_session failed: {e}")
            # Fall back to in-memory
            _mock_combat_sessions[session_id] = session
            return session

    def record_combat_turn(self, session_id: str, turn_data: Dict) -> bool:
        """Append a turn to the combat log and update session state."""
        if self._dev_mode:
            if session_id in _mock_combat_sessions:
                sess = _mock_combat_sessions[session_id]
                sess['combat_log'].append(turn_data)
                sess['current_turn'] = turn_data.get('turn', sess['current_turn'])
                if turn_data.get('status'):
                    sess['status'] = turn_data['status']
            return True

        try:
            # Fetch current log
            result = (
                self._sb.table('combat_sessions')
                .select('combat_log, current_turn')
                .eq('id', session_id)
                .execute()
            )
            if not result.data:
                return False
            current_log = result.data[0].get('combat_log', [])
            current_log.append(turn_data)
            updates: Dict[str, Any] = {
                'combat_log': current_log,
                'current_turn': turn_data.get('turn', result.data[0]['current_turn']),
            }
            if turn_data.get('status'):
                updates['status'] = turn_data['status']
                if turn_data['status'] != 'active':
                    updates['completed_at'] = _now()
            self._sb.table('combat_sessions').update(updates).eq('id', session_id).execute()
            return True
        except Exception as e:
            logger.error(f"record_combat_turn failed: {e}")
            return False

    def get_combat_session(self, session_id: str) -> Optional[Dict]:
        """Fetch a combat session by ID."""
        if self._dev_mode:
            return _mock_combat_sessions.get(session_id)

        try:
            result = (
                self._sb.table('combat_sessions')
                .select('*')
                .eq('id', session_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"get_combat_session failed: {e}")
            return None


# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON FACTORY
# ─────────────────────────────────────────────────────────────────────────────

_db_instance: Optional[DBAdapter] = None


def get_db() -> DBAdapter:
    """Return the singleton DBAdapter, initialising it on first call."""
    global _db_instance
    if _db_instance is not None:
        return _db_instance

    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if supabase_url and supabase_key:
        try:
            from supabase import create_client
            sb = create_client(supabase_url, supabase_key)
            _db_instance = DBAdapter(sb)
            logger.info("DBAdapter connected to Supabase")
        except Exception as e:
            logger.error(f"Failed to connect to Supabase: {e}. Falling back to dev mode.")
            _db_instance = DBAdapter(None)
    else:
        _db_instance = DBAdapter(None)

    return _db_instance


def _utc_now():
    """Return an aware UTC datetime for expiry comparisons."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)


def _entitlement_is_effective(entitlement: Dict, now=None) -> bool:
    """An active entitlement is effective until its optional UTC expiry."""
    from datetime import datetime

    expires_at = entitlement.get('expires_at')
    if not expires_at:
        return True

    reference = now or _utc_now()
    try:
        expiry = datetime.fromisoformat(str(expires_at).replace('Z', '+00:00'))
        return expiry > reference
    except (TypeError, ValueError):
        logger.warning("Ignoring entitlement with invalid expires_at value")
        return False


def _now() -> str:
    """ISO timestamp helper."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
