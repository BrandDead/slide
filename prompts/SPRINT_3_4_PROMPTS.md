# DEALT/SLIDE — Sprint 3 & 4 AI Prompts

These prompts are **self-contained** — each includes all the codebase context an AI model needs to generate useful code without access to the repository.

---

## SPRINT 3: Backend Connection

Sprint 3 requires **Supabase** to be set up first. These prompts assume Supabase is configured with the schema from `001_mvp_tables.sql` and `002_combat_tables.sql`.

---

### PROMPT 3A: API Service Layer Update (Issue #6)

```
You are building a street gang strategy game called DEALT/SLIDE. The frontend is React/TypeScript/Vite with Zustand state management. The backend is Flask/Python with Supabase.

TASK: Update the frontend API service layer to properly connect to the Flask backend, add error handling, loading states, retry logic, and offline fallback to Zustand stores.

EXISTING api.service.ts ENDPOINTS (these already exist but need updating):
- authApi: login, register, getProfile
- blocksApi: search, claim, getBlock, getMembers, nearby
- combatApi: start, submitTurn, getSession, getHistory
- dealerApi: getNextClient, swipe, getInventory, getStats
- gangApi: create, get, getMembers, recruit, assignMember, updateMember, dismissMember
- alchemyApi: getRecipes, getIngredients, combine
- economyApi: getMarketPrices, getTransactions

FLASK BACKEND ROUTES (these are the actual server endpoints):
- POST /api/blocks/claim — Body: { address, city, lat, lng }
- GET /api/blocks/<id> — Returns block data
- GET /api/blocks/<id>/snapshot — Returns BlockSnapshot
- POST /api/blocks/<id>/snapshot — Creates new snapshot
- GET /api/blocks/search?q=<query>&limit=5
- GET /api/blocks/nearby?lat=&lng=&radius=
- POST /api/combat/start — Body: { attacker_gang_id, target_block_id, attacker_members[] }
- POST /api/combat/<session_id>/turn — Body: { attacker_id, action_type, target_id?, position? }
- GET /api/combat/<session_id> — Returns combat session
- POST /api/driveby/start — Body: { target_block_id, vehicle, shooters[] }
- POST /api/driveby/<session_id>/shoot — Body: { shooter_id, target_x, target_y }
- POST /api/world/tick — Body: { minutes }
- GET /api/inventory/catalog — Returns item catalog
- POST /api/inventory/purchase — Body: { item_id, quantity }
- GET /api/inventory/user — Returns user inventory

AUTH: All protected routes use Bearer token in Authorization header. Currently token = user_id (placeholder). Will be replaced with Supabase JWT.

EXISTING ZUSTAND STORES (used as offline fallback):
- usePlayerStore: { player: { money, heat, reputation, level, xp }, updateMoney, addXP }
- useGangStore: { members, contacts, addMember, updateMember, releaseMember }
- useEconomyStore: { inventory, transactions, addTransaction, transferItemToMember }
- useNotificationStore: { notifications, addNotification }

REQUIREMENTS:
1. Create a new file `frontend/src/services/apiClient.ts` with:
   - Axios instance with base URL from env var VITE_API_URL (default http://localhost:5000)
   - Request interceptor that adds Bearer token from localStorage
   - Response interceptor with retry logic (3 retries, exponential backoff)
   - Error handler that falls back to Zustand stores when offline
   - Loading state management (global isLoading flag)

2. Update `frontend/src/services/api.service.ts` to:
   - Use the new apiClient
   - Match endpoint URLs to Flask routes listed above
   - Add proper TypeScript return types
   - Add try/catch with Zustand fallback for each method

3. Create a new hook `frontend/src/hooks/useApi.ts` with:
   - useApiQuery(key, fetcher) — wraps API calls with loading/error/data states
   - useApiMutation(mutator) — wraps POST/PUT/DELETE with loading/error/success
   - Automatic retry on network errors
   - Toast notifications on errors via useNotificationStore

4. Create `frontend/src/services/syncService.ts` with:
   - Queue for offline mutations
   - Sync queue when connection restored
   - Conflict resolution (server wins)

Output the complete files. Use TypeScript. No external state management libraries beyond Zustand.
```

---

### PROMPT 3B: Supabase JWT Authentication (Issue #9)

```
You are building a street gang strategy game called DEALT/SLIDE. The backend is Flask/Python with Supabase as the database and auth provider.

TASK: Replace the placeholder Bearer token authentication with proper Supabase JWT validation.

CURRENT AUTH (placeholder — in every API file):
```python
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        token = auth_header.replace('Bearer ', '')
        request.user_id = token  # Token IS the user_id — INSECURE
        return f(*args, **kwargs)
    return decorated
```

FLASK APP SETUP (app.py):
```python
app.config['SUPABASE_URL'] = os.getenv('SUPABASE_URL')
app.config['SUPABASE_SERVICE_ROLE_KEY'] = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
```

SUPABASE USERS TABLE (from migration):
```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    cash INTEGER DEFAULT 5000,
    reputation INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    heat INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

REQUIREMENTS:
1. Create `backend/python/middleware/auth.py` with:
   - `require_auth` decorator that validates Supabase JWT tokens
   - Extract user_id from JWT `sub` claim
   - Handle token expiration (return 401 with "token_expired" error)
   - Handle invalid tokens (return 401 with "invalid_token" error)
   - Cache JWKS keys with TTL to avoid repeated fetches
   - Set `request.user_id` and `request.user_email` from JWT claims

2. Create `backend/python/api/auth.py` blueprint with:
   - POST /api/auth/register — Body: { email, password, username }
     - Create user in Supabase Auth
     - Create user row in users table
     - Return JWT tokens
   - POST /api/auth/login — Body: { email, password }
     - Authenticate with Supabase Auth
     - Return JWT access_token and refresh_token
   - POST /api/auth/refresh — Body: { refresh_token }
     - Refresh expired access token
   - GET /api/auth/me — Protected, returns user profile
   - POST /api/auth/logout — Invalidate session

3. Create frontend auth components:
   - `frontend/src/components/auth/LoginPage.tsx` — email/password login form
   - `frontend/src/components/auth/RegisterPage.tsx` — registration form
   - `frontend/src/stores/authStore.ts` — Zustand store for auth state
     - accessToken, refreshToken, user, isAuthenticated
     - login(), register(), logout(), refreshToken()
     - Auto-refresh token before expiration
   - `frontend/src/components/auth/ProtectedRoute.tsx` — redirect to login if not authenticated

4. Update `frontend/src/services/apiClient.ts` to:
   - Use accessToken from authStore in Authorization header
   - On 401 response, attempt token refresh, then retry
   - On refresh failure, redirect to login

Dependencies: pip install PyJWT cryptography supabase
Frontend: No new dependencies needed.

Output complete files with proper error handling.
```

---

### PROMPT 3C: Block Claiming API Connection (Issue #5, #6)

```
You are building a street gang strategy game called DEALT/SLIDE. Players claim real-world blocks by providing addresses. The frontend has a TerritoryMap component and the backend has a blocks API with Mapbox geocoding.

TASK: Connect the TerritoryMap frontend component to the backend blocks API for real address search, block claiming, and grid rendering.

BACKEND BLOCK ROUTES (already implemented):
- GET /api/blocks/search?q=<query>&limit=5 — Search addresses via Mapbox geocoding
  Returns: { results: [{ address, city, state, lat, lng, bbox, mapboxId }] }
- POST /api/blocks/claim — Body: { address, city, lat, lng }
  Returns: { block: { id, address, city, lat, lng, gridData, trafficScore, incomePerHour, heatLevel } }
- GET /api/blocks/<id> — Returns full block data with grid
- GET /api/blocks/<id>/snapshot — Returns BlockSnapshot for combat

BACKEND BlockSnapshot SHAPE:
```python
@dataclass
class BlockSnapshot:
    block_id: str
    snapshot_id: str
    address: str
    city: str
    bbox: List[float]  # [minLng, minLat, maxLng, maxLat]
    center: List[float]  # [lng, lat]
    grid_width: int  # 8
    grid_height: int  # 8
    tiles: List[List[TileSnapshot]]  # 8x8 grid
    members: List[MemberSnapshot]
    heat_level: int
    income_per_hour: float
    defense_rating: float
    traffic_score: float
    seed: int
```

CURRENT TerritoryMap.tsx (placeholder with hardcoded 8x8 grid):
The current component has three views (Block/Hood/Roster) with a hardcoded grid. Members can be placed on tiles. Street-adjacent tiles earn more money but are more dangerous.

REQUIREMENTS:
1. Add address search bar to TerritoryMap that calls GET /api/blocks/search
   - Debounced input (300ms)
   - Dropdown showing matching addresses
   - Select address to claim block

2. On claim, call POST /api/blocks/claim and render the server-generated grid
   - Replace hardcoded TILE_TYPES with server grid data
   - Map TileSnapshot.tile_type to visual representation
   - Show block stats (income, heat, defense, traffic)

3. Add Mapbox GL JS map in the "Hood" view
   - Show claimed blocks as colored polygons on the map
   - Click block polygon to switch to Block view
   - Show nearby unclaimed blocks as grey outlines
   - Mapbox token from env var VITE_MAPBOX_TOKEN

4. Member placement should call backend:
   - POST /api/blocks/<id>/members/place — Body: { member_id, x, y }
   - Validate placement server-side
   - Sync placement with gang store

5. Income collection should call:
   - POST /api/blocks/<id>/collect — Collect accumulated income
   - Show accumulated amount based on time since last collection

Dependencies: mapbox-gl is already installed in package.json.
Output the complete updated TerritoryMap.tsx and any new files needed.
```

---

### PROMPT 3D: Combat API Connection (Issue #6)

```
You are building a street gang strategy game called DEALT/SLIDE. The SLIDE mini-game is a battleship-style grid combat where attackers shoot at a block and defenders shoot at the car.

TASK: Connect the SlideGame frontend component to the backend combat API.

BACKEND COMBAT ROUTES:
- POST /api/combat/start
  Body: { attacker_gang_id, target_block_id, attacker_members: [member_ids] }
  Returns: { session_id, target_snapshot, attacker_members, max_turns: 20 }

- POST /api/combat/<session_id>/turn
  Body: { attacker_id, action_type: "shoot"|"move"|"reload"|"take_cover", target_id?, position?: {x,y} }
  Returns: { turn_number, result: { hit, damage, killed, counterattack }, combat_log, status }

- GET /api/combat/<session_id>
  Returns: Full combat session state

CURRENT SlideGame.tsx STRUCTURE:
The component has phases: role_select → placement → battle → game_over
- Role select: choose attacker or defender
- Placement: position members on 8x8 grid
- Battle: turn-based shooting on opponent's grid
- Game over: show stats

EXISTING COMBAT UTILITIES (frontend):
- dualGrid.ts: DualGridManager manages attacker/defender grids
- turnLogic.ts: TurnManager handles turn order, action validation
- combatStore.ts: Zustand store for combat state

REQUIREMENTS:
1. On "Start Battle" (after placement), call POST /api/combat/start
   - Send selected members and target block
   - Receive session_id and target block snapshot
   - Initialize DualGridManager with server grid data

2. On each turn action, call POST /api/combat/<session_id>/turn
   - Send action type and target
   - Receive hit/miss/damage result from server
   - Update local grid state with server response
   - Show hit/miss animation

3. Poll GET /api/combat/<session_id> every 5 seconds during opponent's turn (for multiplayer future)

4. On game over:
   - Update member XP via gang store
   - Update heat via player store
   - Update money (loot) via economy store
   - Show final stats

5. Offline fallback: If API is unreachable, use existing local combat logic from turnLogic.ts and combatStore.ts

Output the complete updated SlideGame.tsx with API integration.
```

---

### PROMPT 3E: World Tick Scheduler (Issue #8)

```
You are building a street gang strategy game called DEALT/SLIDE. The backend is Flask/Python with Supabase.

TASK: Implement a background scheduler that runs world ticks to simulate passive income, heat decay, loyalty changes, and NPC events.

BACKEND WORLD TICK ROUTE (already exists):
POST /api/world/tick — Body: { minutes } — Processes world simulation

SUPABASE TABLES INVOLVED:
- blocks: owner_id, income_per_hour, heat_level, grid_data
- gang_members: owner_id, current_block_id, role, stats, loyalty, status
- shoebox_ledger: user_id, transaction_type, amount, description
- loyalty_events: member_id, event_type, loyalty_change

REQUIREMENTS:
1. Create `backend/python/services/scheduler.py` with:
   - APScheduler integration (BackgroundScheduler)
   - Job: `process_world_tick` runs every 10 minutes
     - For each active user with blocks:
       - Calculate passive income from dealers on blocks
       - Apply heat decay (-2 per tick if no activity)
       - Check loyalty decay (if salary not paid in 24h)
       - Roll for random events (raid chance based on heat)
       - Roll for NPC attacks (based on territory proximity)
     - Write results to Supabase tables
     - Log all events

   - Job: `process_loyalty_check` runs every 30 minutes
     - Check all members with loyalty < 50
     - Roll for desertion, betrayal, or sabotage
     - Update member status if consequence triggered

   - Job: `process_npc_actions` runs every 60 minutes
     - NPC gangs expand to unclaimed adjacent blocks
     - NPC gangs retaliate if attacked recently
     - NPC gangs initiate raids on high-heat player blocks

2. Update `backend/python/app.py` to:
   - Initialize scheduler on app startup
   - Add /api/admin/scheduler/status endpoint
   - Add /api/admin/scheduler/trigger endpoint (manual tick for testing)
   - Graceful shutdown on SIGTERM

3. Create `backend/python/services/event_generator.py` with:
   - generate_raid_event(block, heat_level) — police raid based on heat
   - generate_npc_attack(block, npc_gang) — NPC drive-by or slide
   - generate_random_event(block) — random events (informant, deal opportunity, etc.)
   - Each event returns: { type, description, effects: { money?, heat?, loyalty?, members_affected? } }

Dependencies: pip install APScheduler
Output complete files.
```

---

## SPRINT 4: Advanced Features

---

### PROMPT 4A: Mapbox Integration (Issue #5)

```
You are building a street gang strategy game called DEALT/SLIDE. Players claim real-world blocks by providing addresses. The game uses Mapbox for geocoding and map visualization.

TASK: Replace the placeholder territory map with a full Mapbox GL JS integration.

BACKEND GEOCODING SERVICE (already implemented):
```python
class GeocodingService:
    def search_address(query, limit=5) -> List[GeocodingResult]
    def get_block_location(address=None, lat=None, lng=None) -> BlockLocation
    def generate_block_bbox(lat, lng) -> List[float]  # [minLng, minLat, maxLng, maxLat]
    def get_supported_cities() -> List[dict]
```

GeocodingResult shape: { address, city, state, lat, lng, bbox, mapbox_id }
BlockLocation shape: { address, city, state, lat, lng, bbox, neighborhood, traffic_score }

MAPBOX DEPENDENCIES (already in package.json):
- mapbox-gl: ^3.18.1
- @mapbox/mapbox-gl-geocoder (available but not imported)

REQUIREMENTS:
1. Create `frontend/src/components/map/MapboxMap.tsx`:
   - Full-screen Mapbox GL JS map
   - Dark style (mapbox://styles/mapbox/dark-v11)
   - Mapbox token from import.meta.env.VITE_MAPBOX_TOKEN
   - GeolocateControl for "find me" button
   - NavigationControl for zoom

2. Create `frontend/src/components/map/BlockSearch.tsx`:
   - Floating search bar overlay on map
   - Debounced address search calling GET /api/blocks/search
   - Results dropdown with address suggestions
   - On select: fly map to location, show block outline

3. Create `frontend/src/components/map/BlockOverlay.tsx`:
   - Render claimed blocks as colored GeoJSON polygons
   - Player blocks: green fill, gold border
   - NPC blocks: red fill, dark border
   - Unclaimed: grey outline, dashed border
   - Click block to open detail panel

4. Create `frontend/src/components/map/BlockDetailPanel.tsx`:
   - Slide-up panel showing block info
   - Stats: income/hr, heat, defense, member count
   - Quick actions: collect income, deploy member, start slide
   - Mini grid preview (8x8 thumbnail)

5. Update TerritoryMap.tsx to use MapboxMap as the "Hood" view
   - Block view stays as the 8x8 grid
   - Hood view becomes the Mapbox map
   - Roster view stays as member list

6. Handle Mapbox token missing gracefully:
   - If no token, show placeholder map with message
   - All features still work with manual address entry

Output complete files. Use TypeScript. Import mapbox-gl CSS in the component.
```

---

### PROMPT 4B: NPC AI System (Issue #7)

```
You are building a street gang strategy game called DEALT/SLIDE. NPC gangs create dynamic opposition for the player.

TASK: Implement NPC gang AI that claims territory, attacks player blocks, and responds to player aggression.

SUPABASE NPC TABLE:
```sql
CREATE TABLE IF NOT EXISTS npc_gangs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    faction VARCHAR(30),
    difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
    territory_count INTEGER DEFAULT 1,
    aggression INTEGER DEFAULT 50 CHECK (aggression >= 0 AND aggression <= 100),
    wealth INTEGER DEFAULT 50 CHECK (wealth >= 0 AND wealth <= 100),
    controlled_blocks JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

EXISTING COMBAT SYSTEM:
- POST /api/combat/start — Start SLIDE combat session
- POST /api/driveby/start — Start drive-by session
- BlockStateEngine generates block snapshots for combat

REQUIREMENTS:
1. Create `backend/python/services/npc_ai.py` with:

   class NPCGang:
     - name, faction, difficulty, aggression, wealth, controlled_blocks
     - members: auto-generated based on difficulty (3-10 members)
     - behavior_weights: { patrol: 0.3, expand: 0.2, retaliate: 0.3, raid: 0.1, defend: 0.1 }

   class NPCBehaviorEngine:
     - decide_action(npc_gang, game_state) -> NPCAction
       - Weighted random based on behavior_weights
       - Modified by: aggression, recent_attacks, territory_proximity
     
     - execute_patrol(npc_gang) -> List[Event]
       - Check owned blocks for threats
       - Heal/resupply members
     
     - execute_expand(npc_gang) -> List[Event]
       - Find unclaimed blocks adjacent to territory
       - Claim with probability based on wealth
     
     - execute_retaliate(npc_gang, attacker_block) -> List[Event]
       - If player attacked NPC in last 3 ticks
       - Launch drive-by or SLIDE attack on player block
       - Strength proportional to aggression
     
     - execute_raid(npc_gang, target_block) -> List[Event]
       - High-aggression NPCs attack player blocks
       - Probability: aggression/100 * (player_heat/100)
       - Uses combat system with NPC members
     
     - execute_defend(npc_gang) -> List[Event]
       - Reinforce blocks under threat
       - Move members to defensive positions

2. Create `backend/python/services/npc_spawner.py`:
   - spawn_npc_gang(city, difficulty) — Create NPC gang with name, members, initial block
   - NPC names from pool: "The Scorpions", "Dead End Boys", "Block Burners", etc.
   - Auto-generate members with stats based on difficulty
   - Claim initial block near player territory

3. Create frontend NPC display:
   - `frontend/src/components/map/NPCGangCard.tsx` — Show NPC gang info
   - Red markers on territory map for NPC blocks
   - Notification when NPC attacks: "The Scorpions are sliding on your block!"
   - NPC contacts visible in Contacts app (as "opps")

4. Wire into world tick scheduler:
   - Every 60 minutes, run NPCBehaviorEngine.decide_action for each active NPC
   - Log events to game_events table
   - Push notifications to player via WebSocket or polling

Output complete files with proper typing and error handling.
```

---

### PROMPT 4C: Rich Grid Features (Issue #12)

```
You are building a street gang strategy game called DEALT/SLIDE. The 8x8 block grid has tiles with different terrain types that affect combat and dealing.

TASK: Integrate rich tile feature configurations into the grid generation system.

CURRENT TILE TYPES (from grid_generator.py):
street, sidewalk, building, alley, park, lot

FEATURE CONFIGS TO ADD:
| Feature | Cover Bonus | Visibility Penalty | Destructible | Valid Tiles |
|---------|-------------|-------------------|--------------|-------------|
| Dumpster | 0.7 | 0.3 | No | sidewalk, alley |
| Parked Car | 0.6 | 0.2 | Yes (HP: 50) | street |
| Mailbox | 0.3 | 0.1 | Yes (HP: 20) | sidewalk |
| Fire Hydrant | 0.2 | 0.0 | No | sidewalk |
| Phone Booth | 0.5 | 0.4 | Yes (HP: 30) | sidewalk |
| Fence | 0.4 | 0.3 | Yes (HP: 40) | alley, lot |
| Tree | 0.5 | 0.4 | No | park, sidewalk |
| Bench | 0.3 | 0.1 | No | park, sidewalk |
| Stoop | 0.4 | 0.2 | No | building (adjacent) |
| Trash Can | 0.2 | 0.1 | Yes (HP: 15) | sidewalk, alley |

REQUIREMENTS:
1. Update `backend/python/services/grid_generator.py`:
   - Add FEATURE_CONFIGS dictionary with all features above
   - During grid generation, randomly place features on valid tiles
   - Feature density based on block's traffic_score (higher traffic = more features)
   - Seed-based placement for deterministic grids

2. Update BlockSnapshot to include features:
   - TileSnapshot gets: features: List[TileFeature]
   - TileFeature: { type, cover_bonus, visibility_penalty, destructible, hp, max_hp }

3. Update frontend grid rendering:
   - Show feature icons on tiles (emoji or CSS sprites)
   - Tooltip showing feature stats on hover
   - Destructible features show HP bar
   - Features destroyed during combat (remove cover bonus)

4. Update combat logic:
   - Cover bonus reduces hit chance: base_hit * (1 - cover_bonus)
   - Visibility penalty reduces detection: base_detect * (1 - visibility_penalty)
   - Destructible features can be targeted (destroy cover)
   - Destroyed features create debris (reduced cover: 0.1)

Output the updated grid_generator.py, updated TileSnapshot, and updated SlideGame.tsx grid rendering.
```

---

### PROMPT 4D: Testing Suite (Issue #10)

```
You are building a street gang strategy game called DEALT/SLIDE. The backend is Flask/Python with Supabase.

TASK: Write comprehensive pytest tests for all backend API endpoints and game engines.

BACKEND STRUCTURE:
- backend/python/app.py — Flask app factory
- backend/python/api/blocks.py — Block CRUD and claiming
- backend/python/api/combat.py — SLIDE combat sessions
- backend/python/api/driveby.py — Drive-by shooting sessions
- backend/python/api/world.py — World tick simulation
- backend/python/api/inventory.py — Market and inventory
- backend/python/services/block_state_engine.py — Block snapshots
- backend/python/services/grid_generator.py — 8x8 grid generation
- backend/python/services/geocoding_service.py — Mapbox geocoding

REQUIREMENTS:
1. Create `backend/python/tests/conftest.py`:
   - Flask test client fixture
   - Mock Supabase client fixture
   - Mock auth token fixture (bypass JWT validation)
   - Test database setup/teardown
   - Sample data fixtures (blocks, members, items)

2. Create `backend/python/tests/test_blocks.py`:
   - test_search_blocks — search returns results
   - test_claim_block — claim creates block with grid
   - test_claim_duplicate — can't claim same block twice
   - test_get_block — returns block with grid data
   - test_get_block_snapshot — returns immutable snapshot
   - test_nearby_blocks — returns blocks within radius

3. Create `backend/python/tests/test_combat.py`:
   - test_start_combat — creates session with snapshot
   - test_submit_turn_hit — successful hit reduces HP
   - test_submit_turn_miss — miss doesn't reduce HP
   - test_combat_game_over — session ends when all killed
   - test_combat_max_turns — session ends at turn 20
   - test_invalid_action — rejects invalid action types

4. Create `backend/python/tests/test_driveby.py`:
   - test_start_driveby — creates session
   - test_shoot_hit — hit based on exposure
   - test_shoot_miss — miss when behind cover
   - test_counterfire — defenders can shoot back

5. Create `backend/python/tests/test_world.py`:
   - test_world_tick_income — passive income calculated
   - test_world_tick_heat_decay — heat decreases
   - test_world_tick_loyalty — loyalty events generated

6. Create `backend/python/tests/test_inventory.py`:
   - test_get_catalog — returns items
   - test_purchase_item — deducts cash, adds item
   - test_purchase_insufficient_funds — returns error
   - test_equip_item — assigns item to member

Dependencies: pip install pytest pytest-flask pytest-mock
Output complete test files with proper assertions and mocking.
```

---

### PROMPT 4E: Documentation and README (Issue #11)

```
You are building a street gang strategy game called DEALT/SLIDE. The project has a React/Vite/TypeScript frontend and Flask/Python backend with Supabase.

TASK: Write comprehensive documentation including README, architecture diagrams, and API docs.

PROJECT STRUCTURE:
frontend/ — React/Vite/TypeScript with Zustand
  src/components/ — alchemy/, casino/, contacts/, dealt/, driveby/, economy/, layout/, map/, missions/, settings/, slide/
  src/stores/ — gameStore.ts (Player, Gang, Economy, Notification, Morale, Selfie stores)
  src/utils/ — alchemyEngine, combatResolver, dealtEngine, dualGrid, gameLoopEngine, heatSystem, incomeEngine, memberProgression, missionGenerator, moraleSystem, turnLogic
  src/services/ — api.service.ts
  src/types/ — game.types.ts, alchemy.types.ts, combatTypes.ts, slide.types.ts

backend/python/ — Flask with Supabase
  api/ — blocks, combat, driveby, inventory, world blueprints
  services/ — block_state_engine, geocoding_service, grid_generator

GAME APPS (iOS-style desktop):
MAP, DEALT, SLIDE, DRIVE, COOK, CREW, SHOEBOX, MARKET, OPS, CASINO, PHONE, SETTINGS

REQUIREMENTS:
1. Create `README.md` with:
   - Project overview and game concept
   - Screenshots placeholder section
   - Tech stack table
   - Quick start guide (frontend + backend)
   - Environment variables reference
   - Game mechanics overview (each app explained)
   - Contributing guidelines

2. Create `docs/ARCHITECTURE.md` with:
   - System architecture diagram (Mermaid)
   - Frontend component tree
   - State management flow
   - Backend API flow
   - Database schema diagram (Mermaid)

3. Create `docs/API.md` with:
   - All API endpoints documented
   - Request/response examples
   - Authentication flow
   - Error codes reference

4. Create `docs/GAME_DESIGN.md` with:
   - Game loop explanation
   - Mini-game mechanics (each app)
   - Economy system (income, spending, banking)
   - Heat and morale systems
   - Member progression
   - NPC AI behavior

Output complete Markdown files with Mermaid diagrams where appropriate.
```

---

## How to Use These Prompts

1. **Copy the prompt** for the task you want to work on
2. **Paste it into any AI model** (Claude, GPT-4, Gemini, etc.)
3. The prompt contains all necessary codebase context — no repo access needed
4. **Review the generated code** before committing
5. **Test locally** before pushing to the repository
6. Create a PR targeting `main-tL2525` branch

### Execution Order

Sprint 3 should be done in order: **3A → 3B → 3C → 3D → 3E** (each builds on the previous).

Sprint 4 can be done in any order, but **4A before 4B** is recommended (NPC AI needs Mapbox for territory).
