# SLIDE — Urban Warfare RPG

> An 18+ multiplayer street gang strategy game combining real-world territory control, Tinder-style drug dealing, Battleship combat, and deep gang management.

---

## Game Overview

**SLIDE** is an 18+ multiplayer urban warfare RPG where players build criminal empires across real US cities. The game features an iOS-style desktop interface where each game mode appears as a separate "app":

| App | Mode | Engine | Description |
|-----|------|--------|-------------|
| DEALT | Dealing | Tinder/Swipe | Swipe to deal drugs to customers with risk assessment |
| SLIDE | Combat | Battleship | Grid-based territory warfare with unit placement |
| DRIVE | Drive-By | FPS/Scroller | First-person shooting from a moving vehicle |
| COOK | Alchemy | Little Alchemy | Combine elements to craft drugs (base to super) |
| CREW | Contacts | Contact Book | Buy/manage gang members (shooters, dealers, enforcers, dogs) |
| MAP | Territory | Mapbox | Claim real-world blocks, position gang members |
| SHOEBOX | Economy | Cash App | Banking, transactions, bail, hospital bills |
| OPS | Missions | Task System | Tactical operations and assignments |
| CASINO | Gambling | Phaser 3 | Blackjack, Craps, Slots |

---

## Repository Structure

```
slide/
├── frontend/                        # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              # OSShell (iOS desktop)
│   │   │   ├── dealt/               # Swipe dealing mode
│   │   │   ├── slide/               # Grid combat mode
│   │   │   ├── driveby/             # FPS drive-by mode
│   │   │   ├── alchemy/             # Drug crafting
│   │   │   ├── contacts/            # Contact book
│   │   │   ├── gang/                # Member management
│   │   │   ├── economy/             # Shoebox banking
│   │   │   ├── map/                 # Territory map
│   │   │   ├── casino/              # Gambling games
│   │   │   ├── missions/            # Mission system
│   │   │   ├── shell/               # Admin dashboard
│   │   │   ├── shared/              # Reusable UI components
│   │   │   └── auth/                # Login/signup
│   │   ├── core/                    # Cross-system engines
│   │   ├── stores/                  # Zustand state management
│   │   ├── services/                # API clients (Supabase, Socket.IO)
│   │   ├── utils/                   # Game logic utilities
│   │   ├── types/                   # TypeScript definitions
│   │   └── hooks/                   # Custom React hooks
│   └── public/assets/               # Static game assets
│
├── backend/
│   ├── supabase/                    # Database schema (SQL)
│   └── python/                      # Python microservices
│
├── standalone/                      # Playable HTML demos (no setup)
├── docs/                            # Project documentation
└── prompts/                         # AI code generation prompts
```

---

## Quick Start

### Play Standalone (No Setup Required)
Open any file in `standalone/` in a browser to play immediately.

### Run React Project
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
VITE_SOCKET_URL=ws://localhost:3001
```

---

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Zustand + Framer Motion + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + PostGIS + Auth + Real-time + Storage)
- **Real-time**: Socket.IO for multiplayer events
- **Maps**: Mapbox GL JS for territory visualization
- **Mini-games**: Phaser 3 for casino games
- **AI Assets**: Banana Nano for stylized imagery

See `docs/` for full development plan, element tracking, and AI prompts.

---

## License

Private — BrandDead
