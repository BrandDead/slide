# SLIDE MVP - Quick Start & Testing Guide

## ✅ Setup Completed

This repository is now ready for local development and testing of the core game loop.

---

## 🚀 Quick Start (3 Steps)

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend/python
pip3 install Flask Flask-CORS python-dotenv supabase --user
```

### 2. Configure Environment

**Backend** (`backend/python/.env`):
```bash
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=dev-secret-key
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Frontend** (`frontend/.env`):
```bash
VITE_API_URL=http://localhost:5000
VITE_ENV=development
```

### 3. Start Servers

```bash
# Terminal 1: Start Backend (Port 5000)
cd backend/python
python3 app.py

# Terminal 2: Start Frontend (Port 3000)
cd frontend
npm run dev
```

Access at: http://localhost:3000

---

## 🧪 Testing the API (Manual Verification)

### Test 1: Health Check
```bash
curl http://localhost:5000/health
# Expected: {"status": "healthy", "service": "slide-backend", "version": "1.0.0"}
```

### Test 2: Get Inventory
```bash
curl -H "Authorization: Bearer demo_player" http://localhost:5000/api/inventory/
# Expected: {"cash": 10000, "items": [], "total_items": 0, "user_id": "demo_player"}
```

### Test 3: Browse Market
```bash
curl -H "Authorization: Bearer demo_player" http://localhost:5000/api/inventory/market
# Expected: List of 5 items (pistol-9mm, ak47, vest, medkit, lockpick)
```

### Test 4: Buy an Item
```bash
curl -X POST -H "Authorization: Bearer demo_player" -H "Content-Type: application/json" \
  -d '{"item_id": "pistol-9mm", "quantity": 2}' \
  http://localhost:5000/api/inventory/buy
# Expected: {"success": true, "cost": 1000, "new_balance": 9000}
```

### Test 5: Get Block Snapshot
```bash
curl -H "Authorization: Bearer demo_player" http://localhost:5000/api/blocks/mock-block-1/snapshot
# Expected: Full BlockSnapshot with grid, members, stats
```

### Test 6: World Tick (Passive Income)
```bash
curl -X POST -H "Authorization: Bearer demo_player" -H "Content-Type: application/json" \
  -d '{"minutes": 10}' \
  http://localhost:5000/api/world/tick
# Expected: Events showing income earned and heat decay
```

---

## 📁 What Was Implemented

### Backend (Python Flask)
✅ **Core Services**
- `app.py` - Main Flask application with all blueprint registrations
- `block_state_engine.py` - Central BlockStateEngine for canonical snapshots
- `requirements.txt` - All Python dependencies

✅ **API Blueprints**
- `/api/blocks/*` - Block claiming, grid generation, snapshots
- `/api/combat/*` - SLIDE combat (start, turn, get session)
- `/api/driveby/*` - Drive-by shooting (start, shoot, complete)
- `/api/inventory/*` - Market, buying, equipping, transactions
- `/api/world/*` - World tick for passive income, heat decay, loyalty

✅ **Database**
- `schema.sql` - Core tables (users, blocks, gangs, inventory, etc.)
- `migrations/001_mvp_tables.sql` - MVP additions:
  - gang_members
  - member_loadouts
  - block_snapshots
  - combat_sessions
  - driveby_sessions
  - user_inventory
  - shoebox_ledger
  - item_catalog (pre-seeded)
  - loyalty_events
  - npc_gangs

### Frontend (React + TypeScript)
✅ **Configuration**
- `package.json` - Updated with scripts (dev, dev:all, seed)
- `tsconfig.json` + `tsconfig.node.json` - TypeScript config
- `.env.example` + `.env` - Environment variables
- Fixed JSX issue (renamed .ts → .tsx)

✅ **Seed Script**
- `src/scripts/seed.ts` - Creates demo data:
  - 2 gangs (The Syndicate, Los Diablos)
  - 2 users (demo_player, npc_boss)
  - 2 blocks in Los Angeles
  - 7 gang members (3 player, 4 NPC)
  - Starter inventory items
  - Initial shoebox ledger

### Documentation
✅ `README_RUN.md` - Comprehensive setup guide
✅ `TESTING_GUIDE.md` - This file

---

## 🎮 Core Gameplay Loop (Implemented)

### 1. Underground Market ✅
- Browse items
- Purchase weapons/armor/consumables
- View transaction history (shoebox ledger)

### 2. Block Management ✅
- Get block snapshots (deterministic state)
- View grid layout (8x8 tiles with street/building types)
- See member positions and loadouts

### 3. Combat System (SLIDE) ✅
- Start combat with snapshot-based state
- Turn-by-turn resolution
- Deterministic RNG with seeds
- Hit/miss/damage calculation
- HP tracking for all members

### 4. Drive-By System ✅
- Street edge detection
- Member proximity calculations
- Shooting mechanics with accuracy
- Counterfire from defenders
- Escape mechanics

### 5. World Simulation ✅
- Passive income from dealers
- Heat decay over time
- Loyalty tracking
- NPC event chances

---

## 🔑 BlockStateEngine (Single Source of Truth)

All game modes use the BlockStateEngine to get consistent block state:

```python
from services.block_state_engine import get_block_state_engine

engine = get_block_state_engine()
snapshot = engine.get_block_snapshot(block_id)

# Snapshot contains:
# - block_id, address, city
# - grid (8x8 tiles with types and terrain bonuses)
# - members (with stats, positions, loadouts)
# - heat_level, income_rate, defense_rating
# - seed (for deterministic RNG)
```

This ensures combat, drive-by, and world ticks all see the same state.

---

## 🧩 What's Missing (For Full MVP)

### Database Setup
- [ ] Run Supabase setup OR configure local PostgreSQL
- [ ] Execute schema.sql and migrations
- [ ] Run seed script

### Frontend Integration
- [ ] Connect frontend to backend API
- [ ] Map integration (Mapbox GL)
- [ ] Member placement UI
- [ ] Combat UI (SLIDE grid)
- [ ] Drive-By UI
- [ ] World tick button
- [ ] Fix TypeScript errors in existing code

### Auth System
- [ ] Implement real JWT validation
- [ ] User login/signup flow
- [ ] Session management

### Testing
- [ ] Unit tests for BlockStateEngine
- [ ] Integration tests for combat
- [ ] End-to-end test of full loop

---

## 🐛 Known Issues

1. **TypeScript Errors**: Existing codebase has ~40 TypeScript errors (unused variables, type mismatches). These don't prevent Vite dev server from running.

2. **Auth Placeholder**: Currently using `Bearer demo_player` as mock auth. Need to implement proper JWT.

3. **No Database Yet**: Backend works with mock data. Need to set up Supabase or local PostgreSQL to persist data.

4. **SQLAlchemy Imports**: blocks.py has some commented-out SQLAlchemy code that needs Supabase migration.

---

## 📊 API Endpoint Summary

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/health` | Health check | ✅ Works |
| GET | `/` | API info | ✅ Works |
| GET | `/api/inventory/` | Get inventory | ✅ Works |
| GET | `/api/inventory/market` | Browse items | ✅ Works |
| POST | `/api/inventory/buy` | Purchase item | ✅ Works |
| POST | `/api/inventory/equip` | Equip on member | ✅ Works |
| GET | `/api/inventory/transactions` | Transaction history | ✅ Works |
| GET | `/api/blocks/:id/snapshot` | Get block state | ✅ Works |
| POST | `/api/blocks/:id/snapshot` | Create snapshot | ⚠️ Needs DB |
| POST | `/api/combat/start` | Start combat | ⚠️ Needs DB |
| POST | `/api/combat/turn` | Submit turn | ⚠️ Needs DB |
| GET | `/api/combat/:id` | Get combat state | ⚠️ Needs DB |
| POST | `/api/driveby/start` | Start drive-by | ⚠️ Needs DB |
| POST | `/api/driveby/shoot` | Execute shot | ⚠️ Needs DB |
| POST | `/api/driveby/:id/complete` | Complete drive-by | ⚠️ Needs DB |
| POST | `/api/world/tick` | Advance time | ✅ Works (mock) |
| GET | `/api/world/status` | Get world state | ✅ Works (mock) |

---

## 🔐 Security Notes

- [ ] Run CodeQL security scan before deployment
- [ ] Add rate limiting to API endpoints
- [ ] Implement proper CORS in production
- [ ] Use environment variables for secrets
- [ ] Add input validation on all endpoints
- [ ] Sanitize user inputs

---

## 🚀 Next Steps

1. **Set up Database**
   - Create Supabase project OR local PostgreSQL
   - Run schema.sql
   - Run migrations/001_mvp_tables.sql
   - Run seed script: `npm run seed`

2. **Test with Real Data**
   - Claim a block through frontend
   - Place members on grid
   - Buy equipment
   - Initiate combat

3. **Polish & Security**
   - Fix TypeScript errors
   - Add proper auth
   - Run security scan
   - Code review

---

## 📞 Support

- Repository: https://github.com/BrandDead/slide
- Docs: `/docs` folder
- Issues: Use GitHub Issues

---

**Status**: Backend operational, frontend buildable, core APIs tested.  
**Ready for**: Database setup and frontend integration.  
**Estimated time to full MVP**: 4-6 hours (with database setup).
