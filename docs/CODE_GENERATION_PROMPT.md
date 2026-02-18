# 🔧 DEALT/SLIDE - Complete Code Generation Prompt

Use this prompt with any AI code generator (Claude, DeepSeek, GPT-4, etc.) to generate the remaining code for this project.

---

## 📋 PROJECT CONTEXT

**Game**: DEALT/SLIDE - An 18+ multiplayer urban warfare RPG
**Core Concept**: Real-world locations become playable tactical grids. Players claim actual city blocks, build gangs, deal drugs, and wage war.

**Tech Stack**:
- Frontend: React 18 + TypeScript + Vite + Zustand + Phaser 3 + Mapbox GL
- Backend: Python Flask + Flask-SocketIO + SQLAlchemy + PostgreSQL + Redis
- Real-time: WebSockets via Socket.IO
- Location: Mapbox API for geocoding and satellite imagery

**Game Modes**:
1. **DEALT** - Tinder-style drug dealing (swipe to accept/reject clients)
2. **SLIDE** - Battleship-style grid combat (position units, attack blocks)
3. **DRIVE-BY** - FPS from vehicle (War Thunder-style probabilistic combat)
4. **ALCHEMY LAB** - Little Alchemy-style drug crafting
5. **GANG HQ** - Manage members, loyalty, assignments
6. **TERRITORY MAP** - Real-world Mapbox integration

---

## 🎯 WHAT NEEDS TO BE GENERATED

### 1. BACKEND API ROUTES (Python/Flask)

Generate these Flask Blueprint files:

#### `/backend/src/api/auth.py`
```python
# Authentication routes
# POST /api/auth/register - Create account
# POST /api/auth/login - Login, return JWT tokens
# POST /api/auth/refresh - Refresh access token
# POST /api/auth/logout - Invalidate tokens
# GET /api/auth/me - Get current user

# Use flask_jwt_extended for JWT handling
# Use bcrypt for password hashing
# Store users in PostgreSQL via SQLAlchemy
```

#### `/backend/src/api/combat.py`
```python
# Combat routes
# POST /api/combat/initiate - Start a combat session (SLIDE mode)
# POST /api/combat/action - Submit combat action (shoot, move, etc.)
# GET /api/combat/{id} - Get combat state
# POST /api/combat/{id}/resolve - Resolve combat turn
# POST /api/combat/driveby/start - Initiate drive-by attack
# POST /api/combat/driveby/shot - Fire shot during drive-by

# Combat uses probabilistic resolution (see combatResolver.ts for algorithm)
# Key factors: accuracy, cover, visibility, distance, chaos
# Must broadcast updates via WebSocket to both players
```

#### `/backend/src/api/dealer.py`
```python
# Dealer mode routes
# GET /api/dealer/client - Get next potential client (swipe card)
# POST /api/dealer/swipe - Accept or reject deal
# GET /api/dealer/stats - Get dealing statistics
# GET /api/dealer/inventory - Get drug inventory

# Client generation includes:
# - Risk level (low/medium/high/extreme)
# - isCop, isRobber, isAddict flags
# - Drug requested, quantity, price offered
# Heat system: each deal can increase block heat
```

#### `/backend/src/api/gang.py`
```python
# Gang management routes
# POST /api/gang/create - Create new gang
# GET /api/gang/{id} - Get gang details
# GET /api/gang/{id}/members - List members
# POST /api/gang/recruit - Generate new random member
# POST /api/gang/member/{id}/assign - Assign member to block/task
# PUT /api/gang/member/{id} - Update member stats
# DELETE /api/gang/member/{id} - Remove member

# Members have: stats (STR/AGI/INT/CHA/LCK), loyalty, morale, respect
# Recruitment costs money and generates random member
```

#### `/backend/src/api/alchemy.py`
```python
# Alchemy lab routes
# GET /api/alchemy/recipes - Get discovered recipes
# POST /api/alchemy/combine - Combine ingredients
# GET /api/alchemy/ingredients - Get available ingredients

# Little Alchemy style: combine base items to create new drugs
# Recipes are discovered through experimentation
# Failed combinations waste ingredients
```

### 2. DATABASE MODELS (SQLAlchemy)

Generate `/backend/src/models/` files:

#### Core Models Needed:
```python
# user.py
class User:
    id, email, username, password_hash, 
    gang_id, cash, reputation, level, experience,
    created_at, last_login_at

# gang.py  
class Gang:
    id, name, tag (2-4 chars), color_primary, color_secondary,
    leader_id, region, bankroll, daily_income,
    respect, fear, heat, founded_at

# member.py
class GangMember:
    id, gang_id, name, nickname, avatar_url,
    age, region, level, experience,
    strength, agility, intelligence, charisma, luck, intimidation,
    loyalty, morale, respect, status,
    kills, arrests, deals_completed, money_earned,
    current_assignment, joined_at

# block.py
class Block:
    id, address, city, lat, lng,
    owner_id, gang_id, claimed_at,
    grid_data (JSON), metadata (JSON),
    traffic_score, heat_level, income_per_tick

# combat_log.py
class CombatLog:
    id, session_id, attacker_id, defender_id,
    block_id, combat_type, outcome,
    attacker_casualties, defender_casualties,
    started_at, ended_at

# drug.py
class Drug:
    id, name, street_name, tier,
    base_price, volatility, demand,
    heat_generation, recipe_id

# transaction.py
class Transaction:
    id, user_id, type, amount, details (JSON), created_at
```

### 3. WEBSOCKET EVENT HANDLERS

Generate `/backend/src/sockets/` files:

#### `combat_events.py`
```python
# Socket events for real-time combat
# 'combat:join' - Join combat room
# 'combat:action' - Broadcast combat action
# 'combat:update' - Push combat state update
# 'combat:result' - Push combat result
# 'combat:leave' - Leave combat room
```

#### `block_events.py`
```python
# Socket events for territory updates
# 'block:claimed' - Broadcast when block is claimed
# 'block:attacked' - Alert when block is under attack
# 'block:update' - Push block state changes
```

#### `notification_events.py`
```python
# Socket events for notifications
# 'notify:income' - Income received
# 'notify:combat' - Combat alert
# 'notify:heat' - Heat level warning
# 'notify:member' - Member status change
```

### 4. FRONTEND COMPONENTS (React/TypeScript)

#### Main App Entry `/frontend/src/App.tsx`
```tsx
// React Router setup with routes:
// / - Hub Dashboard
// /map - Territory Map (Mapbox)
// /slide - SLIDE combat mode
// /driveby - Drive-by FPS mode
// /dealer - DEALT dealing mode
// /alchemy - Alchemy lab
// /gang - Gang management
// /casino - Casino games

// Wrap with providers: QueryClientProvider, GameStoreProvider
// Include WebSocket connection setup
```

#### Territory Map `/frontend/src/components/map/TerritoryMap.tsx`
```tsx
// Full-screen Mapbox map component
// Features:
// - 3D buildings layer
// - Territory overlay showing owned blocks
// - Click to select block
// - Address search to claim new blocks
// - Fly-to animation when selecting blocks
// Use MapService from services/map.service.ts
```

#### SLIDE Combat Grid `/frontend/src/components/slide/SlideGame.tsx`
```tsx
// Battleship-style grid combat view
// Features:
// - 8x8 grid display with tile types
// - Unit placement phase
// - Attack targeting
// - Turn-based combat resolution
// - Fog of war for enemy positions
// Use BlockGrid from utils/blockGridGenerator.ts
```

#### Dealer Swipe Mode `/frontend/src/components/dealer/DealerMode.tsx`
```tsx
// Tinder-style card swiping
// Features:
// - Client cards with photo, request, risk level
// - Swipe left to reject, right to accept
// - Heat indicator
// - Deal result animation (profit/bust/robbed)
// - Streak counter for consecutive deals
```

### 5. PHASER GAME SCENES

Generate `/frontend/src/game-engines/phaser/` files:

#### `DriveByScene.ts`
```typescript
// Phaser 3 scene for Drive-By FPS mode
// Features:
// - Parallax scrolling street background
// - Enemy targets on sidewalks
// - First-person shooting mechanics
// - Vehicle movement (player is passenger)
// - Probabilistic hit detection (use combatResolver)
// - Health/ammo HUD
```

#### `SlideScene.ts`
```typescript
// Phaser 3 scene for SLIDE grid combat
// Features:
// - Isometric or top-down grid view
// - Unit sprites with health bars
// - Attack animations
// - Cover indicators
// - Fog of war shader
```

### 6. SERVICES

#### `/frontend/src/services/api.service.ts`
```typescript
// Axios-based API client
// - Base URL configuration
// - JWT token interceptor
// - Refresh token logic
// - Error handling
// Methods for all API endpoints
```

#### `/frontend/src/services/socket.service.ts`
```typescript
// Socket.IO client wrapper
// - Connection management
// - Event subscriptions
// - Reconnection logic
// - Room joining for combat sessions
```

---

## 🎨 DESIGN SPECIFICATIONS

### Color Palette
```css
/* Core */
--slide-black: #0a0a0f;
--slide-darker: #12121a;
--slide-dark: #1a1a25;

/* Neon Accents */
--neon-red: #ff2d55;
--neon-green: #30d158;
--neon-blue: #0a84ff;
--neon-purple: #bf5af2;
--neon-cyan: #64d2ff;
--neon-yellow: #ffcc00;
--neon-orange: #ff9500;

/* Heat Levels */
--heat-1: #30d158; /* Cool */
--heat-5: #ff2d55; /* Hot */
```

### Typography
- Display: Oswald, Bebas Neue (bold headers)
- Body: Inter (clean readability)
- Mono: JetBrains Mono (stats, numbers)

### UI Style
- Dark mode only
- Neon glow effects on interactive elements
- Noise texture overlay (subtle grain)
- Smoke/fog gradients
- Card-based layouts with backdrop blur

---

## ⚙️ KEY ALGORITHMS

### Probabilistic Combat (from combatResolver.ts)
```
finalHitProbability = 
  baseChance (0.45)
  + shooterAccuracy
  + weaponAccuracy  
  - distancePenalty
  - targetCover * 0.5
  + visibilityBonus
  - vehicleSpeedPenalty (for drive-by)
  + nerveFactor
  ± chaosFactor (random)

Clamped between 0.05 and 0.95

Outcomes:
- roll <= hitProb * 0.15 → Critical Hit (2.5x damage)
- roll <= hitProb → Hit
- roll <= hitProb + 0.15 → Graze (25% damage)
- else → Miss
```

### Block Grid Generation (from blockGridGenerator.ts)
```
1. Use address as seed for deterministic random
2. Generate 8x8 grid
3. Rows 3-4 = street, rows 2 and 5 = sidewalk
4. Fill building area with: building/storefront/alley/parking/vacant
5. Assign cover scores (0-1) based on tile type
6. Assign visibility scores (0-1) based on tile type
7. Post-process: add alleys, enhance corners, balance cover
```

### Heat System
```
Heat Level 0-5:
- Each deal generates heat based on drug type and client risk
- Heat decays over time (10% per hour)
- High heat (4-5) triggers police attention
- Heat 5 can trigger raids
- Heat affects spawn rates and combat modifiers
```

---

## 📦 FILE STRUCTURE

```
dealt-slide-mvp/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── hub/HubDashboard.tsx ✅
│   │   │   ├── gang/GangMemberCard.tsx ✅
│   │   │   ├── map/TerritoryMap.tsx [NEEDED]
│   │   │   ├── slide/SlideGame.tsx [NEEDED]
│   │   │   ├── dealer/DealerMode.tsx [NEEDED]
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── map.service.ts ✅
│   │   │   ├── api.service.ts [NEEDED]
│   │   │   └── socket.service.ts [NEEDED]
│   │   ├── utils/
│   │   │   ├── blockGridGenerator.ts ✅
│   │   │   └── combatResolver.ts ✅
│   │   ├── stores/
│   │   │   └── gameStore.ts ✅
│   │   ├── types/
│   │   │   └── game.types.ts ✅
│   │   ├── App.tsx [NEEDED]
│   │   └── main.tsx [NEEDED]
│   └── package.json ✅
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth.py [NEEDED]
│   │   │   ├── blocks.py [PARTIAL]
│   │   │   ├── combat.py [NEEDED]
│   │   │   ├── dealer.py [NEEDED]
│   │   │   ├── gang.py [NEEDED]
│   │   │   └── alchemy.py [NEEDED]
│   │   ├── models/ [ALL NEEDED]
│   │   ├── services/ [ALL NEEDED]
│   │   ├── engines/
│   │   │   └── block_generator.py ✅
│   │   ├── sockets/ [ALL NEEDED]
│   │   └── main.py ✅
│   └── requirements.txt ✅
│
└── assets/
    └── prompts/
        └── ASSET_GENERATION_PROMPTS.md ✅
```

---

## 🚀 GENERATION INSTRUCTIONS

When generating code:

1. **Match existing patterns** - Look at the completed files for style/structure
2. **Use TypeScript strictly** - All frontend code must be fully typed
3. **Use async/await** - All API calls should be async
4. **Include error handling** - Try/catch with meaningful error messages
5. **Add comments** - Document complex logic
6. **Follow the design system** - Use the color palette and Tailwind classes
7. **Make it production-ready** - No placeholder code, fully functional

Generate files one at a time, complete and ready to use.
