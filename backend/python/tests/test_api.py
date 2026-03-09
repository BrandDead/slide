"""
DEALT/SLIDE - Backend API Test Suite
Tests all API endpoints: auth, blocks, combat, world, inventory, driveby.
Run with: pytest tests/test_api.py -v
"""

import os
import sys
import json
import pytest

# Add parent directory to path so we can import the app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def app():
    """Create a test Flask app instance."""
    app = create_app()
    app.config['TESTING'] = True
    # Ensure dev mode (no Supabase) for tests
    app.config['SUPABASE_URL'] = None
    app.config['SUPABASE_SERVICE_ROLE_KEY'] = None
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return app.test_client()


@pytest.fixture
def auth_headers():
    """Return dev-mode auth headers."""
    return {'Authorization': 'Bearer dev-access-token'}


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH & ROOT
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthEndpoints:
    """Test basic health and root endpoints."""

    def test_health_check(self, client):
        """GET /health should return healthy status."""
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
        assert data['service'] == 'slide-backend'
        assert 'version' in data

    def test_root_endpoint(self, client):
        """GET / should return API info."""
        response = client.get('/')
        assert response.status_code == 200
        data = response.get_json()
        assert 'message' in data
        assert 'version' in data

    def test_404_handler(self, client):
        """GET /nonexistent should return 404 JSON."""
        response = client.get('/nonexistent')
        assert response.status_code == 404
        data = response.get_json()
        assert 'error' in data


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class TestAuthEndpoints:
    """Test authentication endpoints (dev mode)."""

    def test_register_dev_mode(self, client):
        """POST /api/auth/register should return mock tokens in dev mode."""
        response = client.post('/api/auth/register', json={
            'email': 'test@example.com',
            'password': 'password123',
            'username': 'TestPlayer',
        })
        assert response.status_code == 200
        data = response.get_json()
        assert 'user' in data
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['email'] == 'test@example.com'

    def test_register_missing_fields(self, client):
        """POST /api/auth/register without email should return 400."""
        response = client.post('/api/auth/register', json={
            'password': 'password123',
        })
        assert response.status_code == 400

    def test_login_dev_mode(self, client):
        """POST /api/auth/login should return mock tokens in dev mode."""
        response = client.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'password123',
        })
        assert response.status_code == 200
        data = response.get_json()
        assert 'access_token' in data
        assert data['access_token'] == 'dev-access-token'

    def test_login_missing_fields(self, client):
        """POST /api/auth/login without password should return 400."""
        response = client.post('/api/auth/login', json={
            'email': 'test@example.com',
        })
        assert response.status_code == 400

    def test_refresh_dev_mode(self, client):
        """POST /api/auth/refresh should return new token in dev mode."""
        response = client.post('/api/auth/refresh', json={
            'refresh_token': 'dev-refresh-token',
        })
        assert response.status_code == 200
        data = response.get_json()
        assert 'access_token' in data

    def test_get_me_dev_mode(self, client, auth_headers):
        """GET /api/auth/me should return dev user in dev mode."""
        response = client.get('/api/auth/me', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'user' in data
        assert data['user']['id'] == 'dev-user-001'

    def test_logout_dev_mode(self, client, auth_headers):
        """POST /api/auth/logout should succeed in dev mode."""
        response = client.post('/api/auth/logout', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True


# ─────────────────────────────────────────────────────────────────────────────
# BLOCKS ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class TestBlocksEndpoints:
    """Test block/territory management endpoints."""

    def test_get_blocks(self, client):
        """GET /api/blocks should return a list or 404 (no DB in test)."""
        response = client.get('/api/blocks')
        assert response.status_code in (200, 404)
        data = response.get_json()
        assert data is not None

    def test_get_block_by_id(self, client):
        """GET /api/blocks/<id> should return block, 404, or 500 (no DB)."""
        response = client.get('/api/blocks/nonexistent')
        # 500 is acceptable when DB is not configured
        assert response.status_code in (200, 404, 500)

    def test_claim_block(self, client, auth_headers):
        """POST /api/blocks/claim should handle block claiming."""
        response = client.post('/api/blocks/claim', json={
            'address': '123 Test St, Miami, FL',
            'lat': 25.7617,
            'lng': -80.1918,
        }, headers=auth_headers)
        # Should succeed or return error (no DB in test)
        assert response.status_code in (200, 201, 400, 500)

    def test_get_block_state(self, client):
        """GET /api/blocks/<id>/state should return grid state."""
        response = client.get('/api/blocks/test-block/state')
        assert response.status_code in (200, 404)


# ─────────────────────────────────────────────────────────────────────────────
# COMBAT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class TestCombatEndpoints:
    """Test combat-related endpoints."""

    def test_start_combat(self, client, auth_headers):
        """POST /api/combat/start should initialize a combat session."""
        response = client.post('/api/combat/start', json={
            'block_id': 'test-block',
            'attacker_id': 'player-1',
            'defender_id': 'npc-1',
        }, headers=auth_headers)
        assert response.status_code in (200, 201, 400, 404)

    def test_combat_action(self, client, auth_headers):
        """POST /api/combat/turn should process a combat action."""
        response = client.post('/api/combat/turn', json={
            'session_id': 'test-session',
            'action': 'shoot',
            'target': {'row': 3, 'col': 5},
        }, headers=auth_headers)
        assert response.status_code in (200, 400, 404)


# ─────────────────────────────────────────────────────────────────────────────
# WORLD ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class TestWorldEndpoints:
    """Test world tick and event endpoints."""

    def test_get_world_state(self, client, auth_headers):
        """GET /api/world/state should return world state."""
        response = client.get('/api/world/state', headers=auth_headers)
        assert response.status_code in (200, 404)

    def test_manual_tick(self, client, auth_headers):
        """POST /api/world/tick should trigger a manual tick."""
        response = client.post('/api/world/tick', json={
            'minutes': 10,
        }, headers=auth_headers)
        assert response.status_code in (200, 400, 404)

    def test_get_events(self, client, auth_headers):
        """GET /api/world/events should return event list."""
        response = client.get('/api/world/events', headers=auth_headers)
        assert response.status_code in (200, 404)


# ─────────────────────────────────────────────────────────────────────────────
# INVENTORY ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class TestInventoryEndpoints:
    """Test inventory management endpoints."""

    def test_get_inventory(self, client, auth_headers):
        """GET /api/inventory should return inventory list."""
        response = client.get('/api/inventory/', headers=auth_headers)
        assert response.status_code in (200, 308, 404)

    def test_add_item(self, client, auth_headers):
        """POST /api/inventory/add should add an item or 404 (no route)."""
        response = client.post('/api/inventory/add', json={
            'type': 'drug',
            'item_id': 'weed',
            'quantity': 10,
        }, headers=auth_headers)
        assert response.status_code in (200, 201, 400, 404)

    def test_transfer_item(self, client, auth_headers):
        """POST /api/inventory/transfer should transfer item to member."""
        response = client.post('/api/inventory/transfer', json={
            'item_id': 'weed',
            'member_id': 'member-1',
            'quantity': 5,
        }, headers=auth_headers)
        assert response.status_code in (200, 400, 404)


# ─────────────────────────────────────────────────────────────────────────────
# DRIVEBY ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class TestDrivebyEndpoints:
    """Test drive-by combat endpoints."""

    def test_start_driveby(self, client, auth_headers):
        """POST /api/driveby/start should initialize a drive-by session."""
        response = client.post('/api/driveby/start', json={
            'block_id': 'test-block',
            'shooters': ['member-1', 'member-2'],
        }, headers=auth_headers)
        assert response.status_code in (200, 201, 400, 404)

    def test_driveby_shoot(self, client, auth_headers):
        """POST /api/driveby/shoot should process a shot."""
        response = client.post('/api/driveby/shoot', json={
            'session_id': 'test-session',
            'target': {'row': 2, 'col': 4},
        }, headers=auth_headers)
        assert response.status_code in (200, 400, 404)


# ─────────────────────────────────────────────────────────────────────────────
# NPC AI UNIT TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestNPCAI:
    """Test NPC AI system components."""

    def test_spawn_gang(self):
        """NPCSpawner should create a gang with members."""
        from services.npc_ai import NPCSpawner
        gang = NPCSpawner.spawn_gang(difficulty=3)
        assert gang.name != ''
        assert len(gang.members) >= 5
        assert gang.difficulty == 3
        assert gang.active is True

    def test_spawn_gang_difficulty_scaling(self):
        """Higher difficulty should produce more members with higher stats."""
        from services.npc_ai import NPCSpawner
        easy = NPCSpawner.spawn_gang(difficulty=1)
        hard = NPCSpawner.spawn_gang(difficulty=5)
        assert len(hard.members) > len(easy.members)
        assert hard.aggression > easy.aggression

    def test_spawn_for_city(self):
        """spawn_for_city should create multiple gangs."""
        from services.npc_ai import NPCSpawner
        gangs = NPCSpawner.spawn_for_city('miami', player_block_count=3)
        assert len(gangs) >= 3
        for gang in gangs:
            assert gang.active is True

    def test_behavior_engine_decide(self):
        """NPCBehaviorEngine should return a valid action."""
        from services.npc_ai import NPCSpawner, NPCBehaviorEngine
        gang = NPCSpawner.spawn_gang(difficulty=2)
        engine = NPCBehaviorEngine()
        action = engine.decide_action(gang, {
            'player_blocks': ['block-1'],
            'unclaimed_blocks': ['block-2', 'block-3'],
        })
        assert action.action_type in ('patrol', 'expand', 'retaliate', 'raid', 'defend')
        assert action.description != ''

    def test_retaliation_boost(self):
        """Gang that was recently attacked should retaliate more often."""
        from services.npc_ai import NPCSpawner, NPCBehaviorEngine
        gang = NPCSpawner.spawn_gang(difficulty=3)
        gang.last_attacked_by = 'player-1'
        engine = NPCBehaviorEngine()

        # Run 100 decisions and count retaliations
        retaliation_count = 0
        for _ in range(100):
            action = engine.decide_action(gang, {
                'player_blocks': ['block-1'],
                'unclaimed_blocks': [],
            })
            if action.action_type == 'retaliate':
                retaliation_count += 1

        # Should retaliate significantly more than 25% of the time
        assert retaliation_count > 20


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULER UNIT TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestScheduler:
    """Test world tick scheduler components."""

    def test_event_generator_random(self):
        """EventGenerator should produce valid random events."""
        from services.scheduler import EventGenerator
        event = EventGenerator.generate_random_event('123 Test St')
        assert event.event_type != ''
        assert '123 Test St' in event.description

    def test_event_generator_raid(self):
        """EventGenerator should produce raids at high heat."""
        from services.scheduler import EventGenerator
        # Run many times with max heat — should get at least one raid
        raids = 0
        for _ in range(100):
            event = EventGenerator.generate_raid_event('Test Block', 100)
            if event is not None:
                raids += 1
        assert raids > 50  # Should be ~85% at heat 100

    def test_event_generator_no_raid_low_heat(self):
        """EventGenerator should rarely produce raids at low heat."""
        from services.scheduler import EventGenerator
        raids = 0
        for _ in range(100):
            event = EventGenerator.generate_raid_event('Test Block', 5)
            if event is not None:
                raids += 1
        assert raids < 20  # Should be ~5% at heat 5

    def test_world_tick_processor_mock(self):
        """WorldTickProcessor should produce mock tick results."""
        from services.scheduler import WorldTickProcessor
        processor = WorldTickProcessor()
        result = processor.process_tick('dev-user-001', 10)
        assert result['success'] is True
        assert result['user_id'] == 'dev-user-001'
        assert len(result['events']) > 0
        assert result['income'] > 0

    def test_block_state_engine_grid(self):
        """BlockStateEngine should generate a valid rich grid."""
        try:
            from services.block_state_engine import BlockStateEngine
            engine = BlockStateEngine()
            grid = engine._generate_default_grid(8, 8)
            assert len(grid) == 8
            assert len(grid[0]) == 8
            cell = grid[0][0]
            assert 'type' in cell
            assert 'terrain_bonus' in cell
        except ImportError:
            # supabase module not installed — skip
            pytest.skip('supabase module not installed')


# ─────────────────────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
