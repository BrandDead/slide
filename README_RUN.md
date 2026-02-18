# SLIDE — Local Development Setup Guide

This guide provides step-by-step instructions to run the SLIDE game locally with all features operational.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **PostgreSQL** 14+ with PostGIS extension (or Supabase account)
- **Mapbox Account** (free tier works)
- **Git**

---

## Quick Start (5 Minutes)

```bash
# 1. Clone and navigate
git clone https://github.com/BrandDead/slide.git
cd slide

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Install backend dependencies
cd ../backend/python
pip install -r requirements.txt

# 4. Set up environment variables (see below)
cp frontend/.env.example frontend/.env
cp backend/python/.env.example backend/python/.env
# Edit both .env files with your credentials

# 5. Set up database
# Option A: Use Supabase (recommended)
#   - Go to https://supabase.com and create a project
#   - Run the SQL from backend/supabase/schema.sql in the SQL editor
# Option B: Local PostgreSQL
#   - createdb slide_dev
#   - psql slide_dev < backend/supabase/schema.sql

# 6. Seed demo data
cd frontend
npm run seed

# 7. Start everything
npm run dev:all
# Or manually:
# Terminal 1: cd frontend && npm run dev
# Terminal 2: cd backend/python && python app.py
```

Frontend: http://localhost:5173  
Backend API: http://localhost:5000

---

## Environment Variables

### Frontend (`frontend/.env`)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Mapbox Configuration (REQUIRED for map features)
VITE_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token-here

# Backend API
VITE_API_URL=http://localhost:5000

# Socket.IO (for multiplayer features)
VITE_SOCKET_URL=ws://localhost:3001

# Environment
VITE_ENV=development
```

**Where to get these:**

- **Supabase**: Sign up at https://supabase.com (free tier)
  1. Create a new project
  2. Go to Settings → API
  3. Copy "Project URL" and "anon public" key
  
- **Mapbox**: Sign up at https://mapbox.com (free tier includes 50K requests/month)
  1. Go to Account → Tokens
  2. Create a new token or copy the default public token
  3. Ensure these scopes: `styles:read`, `geocoding:read`, `directions:read`

### Backend (`backend/python/.env`)

```env
# Database (if using local PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/slide_dev

# Supabase (if using Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Mapbox (for server-side geocoding)
MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token-here

# Flask
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key-for-sessions

# CORS (allow frontend)
CORS_ORIGINS=http://localhost:5173
```

---

## Database Setup

### Option A: Supabase (Recommended)

1. Create account at https://supabase.com
2. Create a new project
3. Go to SQL Editor
4. Copy and run `/backend/supabase/schema.sql`
5. Copy Project URL and keys to `.env` files

### Option B: Local PostgreSQL

```bash
# Install PostgreSQL and PostGIS
sudo apt-get install postgresql postgresql-contrib postgis

# Create database
createdb slide_dev

# Enable PostGIS
psql slide_dev -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql slide_dev -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Run schema
psql slide_dev < backend/supabase/schema.sql

# Update backend/.env with connection string
DATABASE_URL=postgresql://localhost:5432/slide_dev
```

---

## Seeding Demo Data

The seed script creates:
- 2 test gangs (player gang + NPC gang)
- 2 claimed blocks in different cities
- Gang members assigned to blocks
- Initial inventory items
- Demo transactions

```bash
cd frontend
npm run seed
```

---

## Running the Application

### Method 1: Concurrent Mode (Recommended)

```bash
cd frontend
npm run dev:all
```

This starts both frontend and backend simultaneously.

### Method 2: Separate Terminals

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd backend/python
python app.py
```

**Terminal 3 - Socket.IO (optional, for multiplayer):**
```bash
cd backend/socket
npm install
npm start
```

---

## Testing the Core Loop

Once everything is running:

1. **Open browser** → http://localhost:5173
2. **Log in** (use demo account or create new)
3. **Open MAP app** (icon on desktop)
4. **Search address** → Try "123 Main St, Los Angeles, CA"
5. **Preview block** → Click on map or search result
6. **Claim block** → Confirm claim (costs $5,000)
7. **Place members** → Open CREW, drag members to grid tiles
8. **Equip members** → Assign weapons from inventory
9. **Attack** → Find NPC block, initiate SLIDE combat
10. **Drive-By** → Try drive-by mode on a block
11. **Run tick** → Click "Advance Time" to simulate passive income

---

## Available Scripts

### Frontend

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run seed         # Seed database with demo data
npm run dev:all      # Start frontend + backend concurrently
```

### Backend

```bash
python app.py        # Start Flask server (port 5000)
python -m pytest     # Run tests
python seed.py       # Seed database (alternative to npm run seed)
```

---

## Project Structure

```
slide/
├── frontend/                    # React + TypeScript
│   ├── src/
│   │   ├── components/          # UI components (map, combat, etc.)
│   │   ├── services/            # API clients
│   │   ├── stores/              # Zustand state management
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Game logic utilities
│   ├── .env                     # Environment config (create from .env.example)
│   └── package.json
│
├── backend/
│   ├── python/                  # Flask API
│   │   ├── api/                 # Route blueprints
│   │   ├── services/            # Business logic
│   │   ├── models/              # Data models
│   │   ├── .env                 # Backend config
│   │   ├── app.py               # Main Flask app
│   │   └── requirements.txt
│   │
│   └── supabase/                # Database
│       ├── schema.sql           # Main schema
│       ├── migrations/          # Schema updates
│       └── functions/           # PostgreSQL functions
│
├── docs/                        # Documentation
└── README_RUN.md               # This file
```

---

## Troubleshooting

### "Cannot connect to database"
- Verify DATABASE_URL or Supabase credentials in `.env`
- Check PostgreSQL is running: `pg_isready`
- For Supabase: verify project is not paused

### "Mapbox token invalid"
- Ensure token starts with `pk.`
- Check token scopes include `styles:read` and `geocoding:read`
- Verify token is not expired or restricted by URL

### "CORS errors in browser"
- Check backend `.env` has `CORS_ORIGINS=http://localhost:5173`
- Ensure backend is running on port 5000
- Clear browser cache

### "Module not found" errors
- Frontend: `cd frontend && npm install`
- Backend: `cd backend/python && pip install -r requirements.txt`

### "Grid generation fails"
- Verify Mapbox token has satellite imagery access
- Check network connectivity
- Grid generation is deterministic; same coords = same grid

### Port already in use
- Frontend (5173): `lsof -ti:5173 | xargs kill -9`
- Backend (5000): `lsof -ti:5000 | xargs kill -9`

---

## API Endpoints Reference

### Blocks
- `GET /api/blocks/search?q=address` — Search addresses
- `POST /api/blocks/preview` — Preview block before claiming
- `POST /api/blocks/claim` — Claim a block
- `GET /api/blocks/:id` — Get block details
- `GET /api/blocks/:id/snapshot` — Get immutable block snapshot

### Combat
- `POST /api/combat/start` — Initiate SLIDE battle
- `POST /api/combat/turn` — Submit combat turn
- `GET /api/combat/:session_id` — Get combat state

### Drive-By
- `POST /api/driveby/start` — Start drive-by
- `POST /api/driveby/shoot` — Execute drive-by

### World
- `POST /api/world/tick` — Advance world time (passive income, decay)

### Inventory
- `GET /api/inventory` — Get player inventory
- `POST /api/inventory/buy` — Purchase item
- `POST /api/inventory/equip` — Equip item on member

---

## Next Steps

1. **Test the full loop** (claim → place → attack)
2. **Check documentation** in `/docs` folder
3. **Review game design** in `docs/DEALT_SLIDE_MVP_STRUCTURE.md`
4. **Join development** — check `docs/ELEMENTS_NEEDING_WORK.md` for tasks

---

## Support

- **Issues**: https://github.com/BrandDead/slide/issues
- **Docs**: `/docs` folder
- **Discord**: [Coming soon]

---

## License

Private — BrandDead
