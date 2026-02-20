# DEALT/SLIDE — Forward Development Plan

## Current State (Post-Sprint 4)

### Completed
- **iOS Desktop Shell** — App grid, dock, stats bar, live dashboard
- **SLIDE Combat** — 8x8 battleship-style grid, attacker/defender roles, placement, shooting
- **Drive-By Engine** — Canvas-rendered car chase with shooting mechanics
- **Cook Lab (Alchemy)** — Little Alchemy-style drug crafting, 18 recipes, 5 tiers, stash integration
- **Territory Map** — Block grid positioning, Mapbox hood view, block claiming, address search
- **Contacts/Crew** — Member cards, morale badges, XP bars, equip products, bail/hospital
- **Shoebox (Banking)** — Deposit/withdraw, interest, transaction history, stash management
- **Market** — Weapons/gear/vehicles shop with categories and purchase flow
- **Missions/Ops** — Mission generator, accept/start/complete flow, rewards
- **Casino** — Dice, Hi-Lo, Slots mini-games with betting
- **Settings** — Audio, notifications, difficulty, theme toggles
- **Game Loop Engine** — Central tick system, income collection, event generation
- **Income Engine** — Position-based income calculation with dealer level multipliers
- **Event Overlay** — Raid alerts, drive-by warnings, OD notifications
- **Heat/Morale/Progression Systems** — All utility engines built and wired
- **JWT Auth Backend** — Register/login/refresh/logout/me endpoints
- **World Tick Scheduler** — APScheduler background worker with event generation
- **NPC AI System** — Behavior engine, spawner, patrol/attack/retreat logic
- **API Service Layer** — Axios client with interceptors, all Flask routes mapped
- **Advanced API Client** — Retry logic, request queue, offline support
- **Mapbox Integration** — MapboxMap, BlockSearch, BlockOverlay, BlockDetailPanel
- **Documentation** — ARCHITECTURE.md, API.md, GAME_DESIGN.md, updated README
- **Backend Tests** — 33 passing, 1 skipped (supabase)

### Open Issues
- **#5** — Mapbox Integration → **RESOLVED** in this PR (MapboxMap, BlockSearch, BlockOverlay, BlockDetailPanel)
- **#6** — Frontend Refactor → **PARTIALLY RESOLVED** (api.service.ts rewritten; live API connection needs running backend)
- **#11** — Documentation → **RESOLVED** in this PR (ARCHITECTURE.md, API.md, GAME_DESIGN.md)

### What's Missing for a Playable Game
1. **Visual Polish** — Game uses emoji sprites; needs pixel art or AI-generated assets
2. **Supabase Connection** — Backend is built but not connected to a live database
3. **Persistent State** — Game state resets on refresh (no save/load)
4. **Sound Effects** — No audio at all
5. **Multiplayer** — Currently single-player only
6. **Mobile Responsiveness** — Works on desktop, needs mobile optimization
7. **Onboarding** — No tutorial or first-time player experience

---

## Sprint 5: Visual Upgrade & Asset Pipeline (Priority: HIGH)

### 5A — Pixel Art Sprite System (Manus)
Create a sprite system that replaces emoji with pixel art assets:
- Generate 64x64 pixel art sprites for all game entities
- Build a SpriteAtlas utility for efficient rendering
- Create a GameSprite React component that replaces emoji usage
- Update all components to use GameSprite instead of raw emoji

### 5B — App Icon Design (Manus)
Generate custom app icons for the iOS desktop:
- 12 unique icons for each app (SLIDE, COOK, MAP, CREW, DEALT, OPS, SHOEBOX, MARKET, CASINO, SETTINGS, PHONE, MUSIC)
- Dark theme, neon accent colors, consistent style
- Replace emoji icons in OSShell.tsx

### 5C — Canvas Renderer Upgrade (qwen3-coder:480b)
Upgrade the DriveByEngine canvas to use sprite-based rendering:
- Load sprite sheets for cars, characters, bullets, buildings
- Replace rectangle drawing with sprite blitting
- Add parallax scrolling background layers
- Add muzzle flash and explosion particle effects

### 5D — Sound Engine (deepseek-v3.1:671b)
Build an audio system with Web Audio API:
- SoundManager singleton with preloading
- Ambient loops per screen (street noise, lab bubbling, casino chatter)
- SFX for actions (gunshots, cash register, cooking, card flip)
- Music tracks (lo-fi hip hop for menus, intense for combat)
- Volume controls wired to Settings page

### 5E — CSS Theme System (gpt-oss:120b)
Create a proper theming system:
- CSS custom properties for all colors
- Dark/light/OLED theme variants
- Accent color customization (wired to Settings)
- Consistent glassmorphism across all components

---

## Sprint 6: Persistence & Backend Connection (Priority: HIGH)

### 6A — Supabase Setup & Migration (Manus)
Set up the Supabase project and run migrations:
- Create Supabase project
- Run 001_initial_schema.sql migration
- Configure environment variables
- Test all backend endpoints against live database

### 6B — Save/Load System (qwen3-coder:480b)
Build persistent game state:
- Auto-save game state to Supabase on every tick
- Load game state on app launch
- Conflict resolution for stale state
- Offline queue that syncs when connection restored

### 6C — Live API Connection (Manus)
Wire all frontend components to the live backend:
- Replace mock data with API calls in all components
- Add loading states and error boundaries
- Implement optimistic updates for responsive UI
- Add WebSocket for real-time events (raids, attacks)

### 6D — Player Profile & Leaderboard (deepseek-v3.1:671b)
Build player profile and competitive features:
- Player profile page with stats, achievements, history
- Global leaderboard (money, blocks, kills, reputation)
- Daily/weekly challenges
- Achievement system with unlock notifications

---

## Sprint 7: Polish & Launch Prep (Priority: MEDIUM)

### 7A — Onboarding Tutorial (Manus)
Build a first-time player experience:
- Interactive tutorial that guides through claiming first block
- Tooltip system for UI elements
- Progressive unlock of features (start with just MAP and DEALT)
- Story intro sequence

### 7B — Mobile Responsive (qwen3-coder:480b)
Optimize for mobile devices:
- Touch-friendly grid interactions
- Responsive layouts for all screens
- Swipe gestures for navigation
- PWA manifest for home screen install

### 7C — Multiplayer Foundation (deepseek-v3.1:671b)
Add basic multiplayer:
- Player-vs-player SLIDE combat
- Territory disputes (attack other players' blocks)
- Alliance system
- Real-time notifications for attacks

### 7D — Performance Optimization (gpt-oss:120b)
Optimize bundle size and rendering:
- Code splitting with dynamic imports
- Lazy load mini-games
- Memoize expensive computations
- Service worker for offline caching

---

## Task Assignment Matrix

| Task | Assigned To | Reason |
|------|-------------|--------|
| 5A Pixel Art Sprites | **Manus** | Can use generate tool for AI image creation |
| 5B App Icons | **Manus** | Can use generate tool for AI image creation |
| 5C Canvas Upgrade | **qwen3-coder:480b** | Strong at algorithmic canvas rendering code |
| 5D Sound Engine | **deepseek-v3.1:671b** | Complex Web Audio API architecture |
| 5E CSS Theme | **gpt-oss:120b** | Excellent at structured CSS systems |
| 6A Supabase Setup | **Manus** | Requires interactive setup and testing |
| 6B Save/Load | **qwen3-coder:480b** | Complex state serialization logic |
| 6C Live API | **Manus** | Requires testing against running backend |
| 6D Leaderboard | **deepseek-v3.1:671b** | Complex backend + frontend integration |
| 7A Onboarding | **Manus** | Requires iterative UI testing |
| 7B Mobile | **qwen3-coder:480b** | Responsive CSS + touch events |
| 7C Multiplayer | **deepseek-v3.1:671b** | WebSocket architecture |
| 7D Performance | **gpt-oss:120b** | Build optimization expertise |
