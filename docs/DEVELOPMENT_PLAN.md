# DEALT / SLIDE — Development Plan ("Death Plan")

## Project Status: Phase 1A Complete → Phase 1B Ready

---

## ✅ WHAT'S BEEN BUILT (Complete)

### Standalone Playable Games
1. **dealt-slide-standalone.html** - iOS shell + DEALT swipe dealing
2. **slide-game.html** - Battleship-style grid combat

### React/TypeScript Project
| File | Status | Description |
|------|--------|-------------|
| OSShell.tsx | ✅ | iOS-style app launcher |
| DealtMode.tsx | ✅ | Tinder swipe dealing |
| gameStore.ts | ✅ | Zustand state management |
| dealtEngine.ts | ✅ | Client generation logic |
| game.types.ts | ✅ | TypeScript definitions |

### Features Working
- ✅ iOS-style navigation with app grid
- ✅ 8 client types with risk profiles
- ✅ Heat system affecting undercover frequency
- ✅ Streak bonuses for consecutive deals
- ✅ Battleship combat with unit placement
- ✅ Turn-based attacks with counter-attack
- ✅ Local storage for progress saving
- ✅ Responsive mobile design

---

## 🔄 PHASE 1B: Real-World Location (IN PROGRESS)

### Block Generation Flow
```
User enters address → Mapbox Geocoding → Satellite imagery →
Banana Nano AI stylization → Cache result → Display to player
```

### Components Needed
1. **Mapbox Integration**
   - Geocoding API for address → coordinates
   - Static Maps API for satellite imagery
   - Building footprints from OpenStreetMap

2. **Banana Nano Asset Generation**
   - Top-down grid view generation
   - City-specific styling (Miami neon, NYC concrete, etc.)
   - ~$0.02 per block generation

3. **Caching System**
   - Redis for short-term caching
   - PostgreSQL for permanent storage
   - Hash-based deduplication

### Cost Projections
| Scale | Blocks/Month | Monthly Cost |
|-------|--------------|--------------|
| 1K users | 500 | $10 |
| 10K users | 5,000 | $100 |
| 100K users | 20,000 | $400 |
| 1M users | 50,000 | $1,000 |

*75-90% cache hit rate after Year 1*

---

## ⏳ PHASE 1C: Multiplayer Backend

### Infrastructure
1. **Supabase Auth** - User accounts & sessions
2. **Socket.IO** - Real-time events
3. **PostgreSQL** - Game state persistence
4. **Redis** - Session caching

### Features
- User authentication (email, social)
- Real-time combat notifications
- Territory claiming & disputes
- Nearby player alerts

---

## ⏳ PHASE 2: Additional Engines

### ALCHEMY Engine (Drug Crafting)
- Little Alchemy-style combining
- Recipe discovery system
- Purity & quality mechanics

### EMPIRE Engine (Crew Management)
- Gang member recruitment
- Loyalty & betrayal system
- Role assignments (dealer, shooter, driver)

### DRIVE-BY Engine (Side-Scroller)
- Parallax scrolling shooter
- Territory defense missions
- Drive-by attacks on enemies

### Cross-Engine Progression
- Alchemy unlocks improve dealing payouts
- Combat wins expand territory
- Crew members can be deployed to blocks

---

## 💰 REVENUE OPPORTUNITIES

### In-App Purchases
- Premium cosmetics (cars, crew appearances)
- Speed boosts (faster income, heat decay)
- Territory expansion slots

### Streetwear Integration
- Real brand partnerships
- Affiliate links for clothing
- Virtual → physical merch bridge

---

## 🚀 QUICK START

### Play Standalone (No Setup)
1. Open `dealt-slide-standalone.html` in browser
2. Tap DEALT icon to start dealing
3. Open `slide-game.html` for combat mode

### Run React Project
```bash
cd dealt-slide-mvp
npm install
npm run dev
# Open http://localhost:3000
```

---

## 📁 FILE STRUCTURE

```
dealt-slide-mvp/
├── src/
│   ├── components/
│   │   ├── OSShell.tsx
│   │   ├── DealtMode.tsx
│   │   └── DealtMode.css
│   ├── stores/
│   │   └── gameStore.ts
│   ├── utils/
│   │   └── dealtEngine.ts
│   ├── types/
│   │   └── game.types.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

*Last Updated: December 21, 2025*
