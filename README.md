# SLIDE — Urban Warfare RPG

> An 18+ multiplayer street gang strategy game combining real-world territory control, Tinder-style drug dealing, Battleship combat, and deep gang management.

---

## Game Overview

**SLIDE** is an 18+ multiplayer urban warfare RPG where players build criminal empires across real US cities. The game features an iOS-style desktop interface where each game mode appears as a separate "app" on a phone home screen.

Players pick a block by providing a real address, raise a gang, grow through drug dealing, and protect themselves from drive-bys and police raids. Every mini-game feeds back into the overall game state — money earned from dealing funds weapons, members placed on the block determine combat defense, and heat from activity triggers police raids.

| App | Mode | Engine Style | Description |
|-----|------|-------------|-------------|
| **DEALT** | Dealing | Tinder/Swipe | Swipe to deal drugs to customers with risk assessment |
| **SLIDE** | Combat | Battleship | Grid-based territory warfare — attacker shoots at block, defender shoots at car |
| **DRIVE** | Drive-By | Street Shooter | Shooting from a moving vehicle at members on the block |
| **COOK** | Alchemy | Little Alchemy | Combine base elements to craft drugs (5 tiers, 18 recipes) |
| **CREW** | Contacts | Contact Book | Buy/manage gang members — shooters, dealers, enforcers, dogs |
| **MAP** | Territory | Grid Strategy | Claim blocks, position members (street proximity = more money but more danger) |
| **SHOEBOX** | Banking | Cash App | Deposit/withdraw cash, safe from raids, transaction history |
| **MARKET** | Shop | Underworld Store | Buy weapons, armor, vehicles, consumables |
| **OPS** | Missions | Task System | Tactical operations — deliveries, collections, hits, recon |
| **CASINO** | Gambling | Mini-Games | Dice, Hi-Lo, Slots — gamble your earnings |
| **SETTINGS** | Config | System | Sound, notifications, difficulty, data management |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                    │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ OSShell  │  │ Mini-Game │  │  Zustand  │  │ Game Loop   │  │
│  │ (iOS UI) │→ │   UIs    │← │  Stores   │← │  Engine     │  │
│  └─────────┘  └──────────┘  └──────────┘  └─────────────┘  │
│                       ↕ api.service.ts                       │
├─────────────────────────────────────────────────────────────┤
│                   BACKEND (Flask + Python)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Blocks   │  │ Combat   │  │ Drive-By │  │ Inventory  │  │
│  │ API      │  │ API      │  │ API      │  │ API        │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                       ↕ BlockStateEngine                     │
├─────────────────────────────────────────────────────────────┤
│                  DATABASE (Supabase/PostgreSQL)               │
│  blocks · gang_members · combat_sessions · inventory · users │
└─────────────────────────────────────────────────────────────┘
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Zustand, Framer Motion |
| Styling | CSS Modules (dark theme, neon accents) |
| Backend | Flask (Python), Blueprint-based API |
| Database | Supabase (PostgreSQL + PostGIS + Auth) |
| Maps | Mapbox GL JS (planned) |
| State | Zustand stores (Player, Gang, Economy, Territory, Combat, Heat, Morale) |

---

## Game Loop Flow

```
Claim Block → Place Members → Deal Drugs → Earn Money → Buy Gear
     ↓              ↓              ↓            ↓           ↓
  Heat rises   Position =      Alchemy →    Shoebox     Market →
  from activity  income vs     craft drugs   banking     weapons/armor
     ↓          danger           ↓            ↓           ↓
  Cop Raids ← Heat threshold  OD Risk →    Bail/Hospital  Equip to
  seize product  triggers     kills customers  costs       members
     ↓                           ↓                          ↓
  Lose members ← Low morale  Heat spikes    Gang turns   Combat ready
  (jail/death)   from neglect  from ODs      on itself    for SLIDE
```

---

## Repository Structure

```
slide/
├── frontend/                        # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              # OSShell (iOS desktop), GameEventOverlay
│   │   │   ├── dealt/               # Swipe dealing mode (DealtMode)
│   │   │   ├── slide/               # Grid combat (SlideGame)
│   │   │   ├── driveby/             # Drive-by shooter (DriveByEngine/Game)
│   │   │   ├── alchemy/             # Drug crafting (AlchemyLab)
│   │   │   ├── contacts/            # Contact book + LevelUpPopup
│   │   │   ├── economy/             # Shoebox banking + Market shop
│   │   │   ├── map/                 # Territory map (TerritoryMap)
│   │   │   ├── casino/              # Dice, Hi-Lo, Slots (Casino)
│   │   │   ├── missions/            # Mission system (Missions)
│   │   │   └── settings/            # Settings page
│   │   ├── stores/                  # Zustand state (gameStore.ts — 8 stores)
│   │   ├── services/                # API client (api.service.ts)
│   │   ├── utils/                   # Game engines
│   │   │   ├── gameLoopEngine.ts    # Central tick system (10s interval)
│   │   │   ├── incomeEngine.ts      # Income calculation per member/position
│   │   │   ├── heatSystem.ts        # Heat accumulation and decay
│   │   │   ├── moraleSystem.ts      # Morale and loyalty tracking
│   │   │   ├── memberProgression.ts # XP, leveling, skill gains
│   │   │   ├── alchemyEngine.ts     # Drug crafting recipes (18 recipes, 5 tiers)
│   │   │   ├── dealtEngine.ts       # Dealing client generation
│   │   │   ├── missionGenerator.ts  # Mission generation and rewards
│   │   │   ├── combatResolver.ts    # Combat hit/damage resolution
│   │   │   ├── dualGrid.ts          # Dual-grid system for combat
│   │   │   └── turnLogic.ts         # Turn-based combat logic
│   │   └── types/                   # TypeScript definitions
│   │       ├── game.types.ts        # Core types (Player, Block, GangMember, etc.)
│   │       ├── alchemy.types.ts     # Alchemy/drug types
│   │       ├── combatTypes.ts       # Combat session types
│   │       └── slide.types.ts       # SLIDE game types
│   └── public/assets/               # Static game assets
│
├── backend/
│   ├── python/
│   │   ├── app.py                   # Flask application factory
│   │   ├── api/
│   │   │   ├── blocks.py            # Block search, preview, claim, nearby
│   │   │   ├── combat.py            # SLIDE combat start, turn, session
│   │   │   ├── driveby.py           # Drive-by start, shoot, complete
│   │   │   ├── inventory.py         # Market, buy, equip, transactions
│   │   │   └── world.py             # World tick, status
│   │   └── services/
│   │       └── block_state_engine.py # BlockStateEngine (rich grid, snapshots)
│   └── supabase/
│       └── migrations/              # Database schema SQL
│
├── docs/                            # Project documentation
├── prompts/                         # AI code generation prompts (Sprint 1-4)
└── DEV_PLAN.md                      # Development roadmap
```

---

## Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.11+
- Supabase account (for backend — optional for frontend-only dev)

### Run Frontend (No Backend Required)
The frontend runs fully offline with Zustand stores providing all game state:

```bash
cd frontend
pnpm install
pnpm dev
# Open http://localhost:5173
```

### Run Backend
```bash
cd backend/python
pip install flask flask-cors python-dotenv supabase
python app.py
# API runs on http://localhost:5000
```

### Environment Variables
Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

Create `backend/python/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MAPBOX_ACCESS_TOKEN=your_mapbox_token
SECRET_KEY=your_secret_key
FLASK_DEBUG=True
```

---

## API Reference

All endpoints are prefixed with `/api/`. Authentication via JWT Bearer token.

### Blocks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/blocks/search?q=<address>` | Search for a real address |
| POST | `/blocks/preview` | Preview block grid before claiming |
| POST | `/blocks/claim` | Claim a block for your gang |
| GET | `/blocks/<block_id>` | Get block snapshot |
| GET | `/blocks/my-blocks` | Get all owned blocks |
| GET | `/blocks/nearby?lat=&lng=&radius=` | Find nearby blocks |
| GET | `/blocks/availability/<hash>` | Check if block is available |
| GET | `/blocks/city/<city>` | Get blocks in a city |
| GET | `/blocks/cities` | List supported cities |

### Combat (SLIDE)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/combat/start` | Start a SLIDE combat session |
| POST | `/combat/turn` | Submit a combat turn (shoot/move/reload) |
| GET | `/combat/<session_id>` | Get combat session state |

### Drive-By
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/driveby/start` | Start a drive-by session |
| POST | `/driveby/shoot` | Fire shots during drive-by |
| POST | `/driveby/<session_id>/complete` | Complete drive-by and get results |

### Inventory / Market
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/` | Get player inventory |
| GET | `/inventory/market` | Browse market listings |
| POST | `/inventory/buy` | Purchase an item |
| POST | `/inventory/equip` | Equip item to a member |
| GET | `/inventory/transactions?limit=` | Transaction history |
| GET | `/inventory/cash` | Get cash/bank balance |

### World
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/world/tick` | Advance world state (income, heat decay, events) |
| GET | `/world/status` | Get world overview (blocks, members, heat, income) |

---

## Core Game Mechanics

### Heat System
Every action generates **heat** — dealing, combat, drive-bys, and especially drug ODs. Heat decays slowly over time. When heat exceeds thresholds:
- **50+**: Increased police patrols (random raids)
- **75+**: Targeted raids (lose product, weapons, money)
- **90+**: SWAT raids (members arrested, block seized)

### Morale System
Gang members have **morale** and **loyalty**. Neglecting members (not paying bail, not covering hospital bills) drops morale. Low morale causes:
- Members refusing orders (won't deploy to block)
- Friendly fire (members shoot their own)
- Desertion (members leave the gang)

### Street Proximity Income
On the Territory Map, member position determines income vs. danger:
- **Street-adjacent**: $$$$ income but high exposure to drive-bys
- **Mid-block**: $$ moderate income, moderate safety
- **Deep interior**: $ low income but very safe from shooters

### Drug Crafting (Alchemy)
5 tiers of drugs, each with purity, potency, and OD risk:
- **Tier 1** (Basic): Weed, Lean — low risk, low profit
- **Tier 5** (Legendary): Super Crack, Krokodil — massive profit but high OD risk → heat spikes

---

## Development Status

### Completed (Sprints 1-2)
- iOS-style OSShell with live dashboard (heat meter, morale, income ticker)
- All 11 app UIs built and playable
- Game loop engine (10-second tick cycle)
- Income engine with position-based calculations
- Heat system with raid triggers
- Morale system with loyalty tracking
- Member progression (XP, leveling, skill gains)
- Alchemy crafting with 18 recipes across 5 tiers
- Rich grid generation with 7 terrain types and 10 feature types

### In Progress (Sprint 3)
- Backend API integration (api.service.ts ↔ Flask routes)
- JWT authentication
- Supabase database setup

### Planned (Sprint 4)
- Mapbox real-world map integration
- NPC AI simulation
- Multiplayer via Socket.IO
- Testing suite

See `DEV_PLAN.md` and `prompts/` for the full roadmap and AI-ready code generation prompts.

---

## License

Private — BrandDead
