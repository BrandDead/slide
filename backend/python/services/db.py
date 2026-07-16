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
                    'level': 1,
                    'xp': 0,
                    'created_at': _now(),
                }
            return _mock_profiles[user_id]

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
    ) -> Dict:
        """Claim a block for a user. Returns the created block record."""
        block_id = _make_id()
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
            'heat_level': 0,
            'claimed_at': _now(),
        }

        if self._dev_mode:
            _mock_blocks[block_id] = block
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
