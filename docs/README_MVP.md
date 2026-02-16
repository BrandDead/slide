# DEALT / SLIDE — Urban Warfare RPG

> **An 18+ multiplayer street gang strategy game combining real-world territory control, Tinder-style drug dealing, Battleship combat, and deep gang management.**

![Status](https://img.shields.io/badge/Status-MVP%20Development-orange)
![Phase](https://img.shields.io/badge/Phase-1B%20Location%20System-blue)
![Frontend](https://img.shields.io/badge/Frontend-95%25%20Complete-green)
![Backend](https://img.shields.io/badge/Backend-In%20Progress-yellow)

---

## 🎮 Game Overview

**DEALT/SLIDE** is an 18+ multiplayer urban warfare RPG where players build criminal empires across real US cities. The game features an iOS-style desktop interface where each game mode appears as a separate "app":

| App | Mode | Description |
|-----|------|-------------|
| 📍 MAP | Territory | Claim real-world blocks using actual addresses |
| 💊 DEALT | Dealing | Tinder-style swipe mechanics to deal to customers |
| 🎯 SLIDE | Combat | Battleship-style grid warfare for territory |
| 🚗 DRIVE | Drive-By | First-person shooting from moving vehicle |
| ⚗️ COOK | Alchemy | Little Alchemy-style drug crafting |
| 👥 CREW | Gang | Contact book + member management |
| 💰 SHOEBOX | Economy | Cash App-style banking & marketplace |
| 📋 OPS | Missions | Tactical operations & assignments |
| 🎰 CASINO | Gambling | Blackjack, Craps, Slots |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account (for backend)
- Mapbox API key (for real-world locations)
- Banana Nano API key (for AI asset generation)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/dealt-slide.git
cd dealt-slide

# Install frontend dependencies
cd frontend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run development server
npm run dev
```

### Environment Variables

```env
# Required API Keys
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
VITE_BANANA_NANO_API_KEY=your_banana_nano_key

# Optional
VITE_SOCKET_URL=ws://localhost:3001
```

---

## 📁 Project Structure

```
dealt-slide-mvp/
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/          # Game UI components
│   │   │   ├── layout/          # OSShell, Navigation
│   │   │   ├── dealt/           # Swipe dealing mode
│   │   │   ├── slide/           # Grid combat mode
│   │   │   ├── driveby/         # FPS drive-by mode
│   │   │   ├── alchemy/         # Crafting system
│   │   │   ├── gang/            # Member management
│   │   │   ├── economy/         # Shoebox banking
│   │   │   ├── contacts/        # Contact book
│   │   │   ├── map/             # Territory map
│   │   │   └── casino/          # Gambling games
│   │   ├── stores/              # Zustand state management
│   │   ├── services/            # API & external services
│   │   ├── utils/               # Game logic utilities
│   │   ├── types/               # TypeScript definitions
│   │   └── hooks/               # Custom React hooks
│   └── public/assets/           # Static game assets
│
├── backend/                     # Supabase + Edge Functions
│   ├── supabase/
│   │   └── functions/           # Edge function endpoints
│   └── src/
│       ├── api/                 # REST endpoints
│       ├── models/              # Database models
│       └── services/            # Business logic
│
├── tools/                       # Development tools
│   ├── asset-generator.html     # AI asset generation tool
│   └── gang-member-creator.html # NPC creation tool
│
├── docs/                        # Documentation
│   ├── DATABASE_SCHEMA.md       # Complete DB schema
│   ├── API.md                   # API reference
│   └── GAME_MECHANICS.md        # Gameplay documentation
│
└── assets/                      # Generated game assets
    ├── characters/
    ├── weapons/
    ├── drugs/
    ├── vehicles/
    └── blocks/
```

---

## 🏗️ Current Status

### ✅ Phase 1A: Core Game Engines (COMPLETE)

| Component | Status | Notes |
|-----------|--------|-------|
| iOS-Style Desktop Shell | ✅ | App grid, navigation, notifications |
| DEALT Engine | ✅ | Swipe dealing with 10+ client types |
| SLIDE Engine | ✅ | Battleship grid combat with fog of war |
| ALCHEMY Engine | ✅ | Little Alchemy-style crafting |
| Drive-By FPS | ✅ | Parallax shooter from vehicle |
| Territory Map | ✅ | Member placement system |
| Economy System | ✅ | Shoebox banking + marketplace |
| Mission Control | ✅ | Tactical operations |
| Zustand Stores | ✅ | Complete state management |
| TypeScript Types | ✅ | Full type coverage |

### 🔄 Phase 1B: Real-World Location System (IN PROGRESS)

| Component | Status | Notes |
|-----------|--------|-------|
| Mapbox Integration | 🔄 | Geocoding API setup needed |
| Block Generation | 🔄 | On-demand from addresses |
| Banana Nano Pipeline | 🔄 | AI stylization integration |
| Asset Caching | ⏳ | Hash-based deduplication |

### ⏳ Phase 1C: Multiplayer Backend (QUEUED)

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Auth | ⏳ | Email, Google, Apple |
| User Persistence | ⏳ | Save/load game state |
| Real-time Events | ⏳ | Socket.IO integration |
| Combat Sync | ⏳ | PvP territory battles |

---

## 🎯 Key Features

### 🆕 Friend Selfie Gang Members
Upload a friend's photo and generate a gang member that resembles them:
- AI-powered face recognition integration
- Auto-generated backstories with family & friends
- Targetable connections (family members can be attacked)
- Loyalty/morale impacts from loved ones being hurt

### 💰 Shoebox Economy
Cash App-style in-game banking:
- Easy spending interface
- Underworld Marketplace purchases
- Auto-distribute items to members
- Transaction history

### 📇 Contact Book System
Complete member history:
- Active, jailed, and deceased members
- Status indicators (💀 dead, ⛓️ jailed, 🔙 backdoored)
- Full member backstories
- Connection tracking (family, friends, rivals)

### 🎯 Member Loyalty System
Deep member management:
- Morale affects performance
- Loyalty determines betrayal risk
- "Get back" demands after family attacks
- Backdoor mechanics for disloyal members

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **Framer Motion** - Animations
- **Tailwind CSS** - Styling
- **Mapbox GL** - Territory maps

### Backend
- **Supabase** - Database + Auth + Realtime
- **PostgreSQL** - Data persistence
- **PostGIS** - Geospatial queries
- **Edge Functions** - Serverless API

### External Services
- **Mapbox** - Geocoding & satellite imagery
- **Banana Nano** - AI asset generation
- **Socket.IO** - Real-time multiplayer

---

## 📖 Documentation

- [Database Schema](./docs/DATABASE_SCHEMA.md)
- [API Reference](./docs/API.md)
- [Game Mechanics](./docs/GAME_MECHANICS.md)
- [Asset Generation](./docs/ASSET_GENERATION.md)
- [Scaling Strategy](./docs/SCALING.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🎮 Play Testing

The game is currently in closed beta. To request access:
1. Join our Discord (link coming soon)
2. Fill out the beta tester form
3. Wait for approval email

**Age Verification Required** - This is an 18+ game with mature themes.
