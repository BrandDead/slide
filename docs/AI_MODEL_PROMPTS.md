# AI MODEL PROMPTS - Final Build Phase

## 🎯 PROMPT 1: Territory Map React Components
**Assign to:** `deepseek-v3.1:671b-cloud` or `qwen3-coder:480b-cloud`
**Estimated Time:** 4-5 hours

---

```
# TASK: Build Territory Map React Components for Dealt/Slide

You are building the React UI components for the real-world territory map system. The types, store, and Mapbox service are already complete - you only need to build the React components.

## EXISTING CODE (Already Built)

### Types (use these exactly)

// /types/territory.types.ts - ALREADY EXISTS
interface GameBlock {
  id: string;
  address: string;
  coordinates: { lat: number; lng: number };
  players: BlockPlayer[];
  grid: GridTile[][];
  resources: {
    trafficLevel: number;  // 1-10
    heatLevel: number;     // Police presence
    riskLevel: number;     // Drive-by frequency
  };
  createdAt: number;
  lastActivity: number;
}

interface BlockPlayer {
  playerId: string;
  gangName: string;
  joinedAt: number;
  deployedMembers: DeployedMember[];
  territory: GridTile[];
}

interface GridTile {
  x: number;
  y: number;
  type: 'STREET' | 'SIDEWALK' | 'BUILDING' | 'ALLEY' | 'CORNER';
  occupant?: { playerId: string; memberId: string; };
  cover: number;
  visibility: number;
  incomeMultiplier: number;
}

interface GangMember {
  id: string;
  name: string;
  nickname: string;
  role: 'SHOOTER' | 'DEALER' | 'ENFORCER' | 'LOOKOUT' | 'DRIVER';
  level: number;
  morale: number;
  placement?: { blockId: string; position: { x: number; y: number } };
}

### Store (already exists - use these actions)

// /stores/territoryStore.ts - ALREADY EXISTS
const useTerritoryStore = create((set, get) => ({
  blocks: [], // GameBlock[]
  playerId: string,
  members: [], // GangMember[]
  mapView: { center, zoom, showSatellite, selectedBlockId },
  loading: boolean,
  error: string | null,
  
  // Actions you can call:
  initializeMap: (container) => Promise<void>,
  claimBlock: (address) => Promise<GameBlock | null>,
  deployMember: (memberId, blockId, position) => void,
  recallMember: (memberId) => void,
  getBlocksInRadius: (center, radiusKm) => BlockSearchResult[],
  toggleSatellite: () => void,
  selectBlock: (blockId) => void,
}));

## COMPONENTS TO BUILD

### 1. TerritoryMap.tsx - Main Map View

Full-screen Mapbox map with:
- Dark theme (mapbox://styles/mapbox/dark-v11)
- Territory overlays (green=yours, red=enemy, yellow=contested)
- Click to select block
- Search bar for address input
- "Claim Block" button
- Toggle satellite view button
- Zoom controls
- Current location button

Implementation:
- Initialize Mapbox GL JS on mount using mapboxgl.Map
- Use mapService from /services/mapbox.service.ts
- Add territory polygons as GeoJSON layers
- Handle click events to select blocks
- Implement address search with Mapbox Geocoding API
- Add loading overlay during operations

### 2. BlockGrid.tsx - 8x8 Grid Editor

When a block is selected, show the 8x8 grid:
- Visual grid overlay on screen
- Tile type colors:
  - STREET: #2a2a2a with white lane markings
  - SIDEWALK: #3a3a3a
  - BUILDING: #1a1a1a (cannot place members)
  - ALLEY: #333333
  - CORNER: #4a4a4a with gold border (best income spots)
- Show deployed members as circular avatars on their tiles
- Income multiplier indicators ($ symbols near street edges)
- Risk indicators (⚠️ near high-risk tiles)
- Hover to see tile details tooltip
- Click tile to select for deployment

Grid Layout (8x8):
- Row 0 and Row 7 (y=0, y=7): Street edges - highest income, highest risk
- Rows 1-2 and 5-6: Near street - medium income, medium risk
- Rows 3-4: Mid block - lowest income, safest
- Columns 0 and 7 (x=0, x=7): Also street edges
- Corners (0,0), (7,0), (0,7), (7,7): CORNER tiles - best spots

### 3. MemberPlacer.tsx - Drag & Drop Deployment

Side panel showing available gang members to deploy:
- Filter to show only AVAILABLE members (not deployed, not in hospital, not in jail)
- Each member card shows: Avatar, Name, Role, Level
- Drag member to grid tile to deploy
- OR tap member to select, then tap grid tile
- Role placement restrictions:
  - DEALER: Can ONLY be placed on STREET or CORNER tiles
  - SHOOTER: Any tile EXCEPT BUILDING
  - ENFORCER: Any tile except BUILDING
  - LOOKOUT: Any tile, bonus on CORNER
  - DRIVER: Any tile (getaway driver)
- Show warning toast if invalid placement
- "Confirm Deployment" button
- Preview estimated income change

### 4. BlockInfo.tsx - Block Details Panel

Slide-out panel when a block is selected:
- Block address (full street address)
- Coordinates (lat/lng)
- Traffic level bar (1-10 scale)
- Heat level bar (police activity)
- Risk level bar (drive-by frequency)
- List of players on this block (up to 5 max)
- Your deployed members on this block
- Estimated hourly income calculation
- Action buttons:
  - "Edit Deployment" - opens MemberPlacer
  - "Attack This Block" - if enemy territory (opens SLIDE game)
  - "Leave Block" - abandon this territory

Income Display Example:
Total Income: $1,250/hour
- Dealer "Peso" (Corner 1.5x): $500/hr
- Dealer "Bands" (Street 1.25x): $400/hr
- Traffic Bonus (+30%): $350/hr

### 5. ClaimBlockModal.tsx - Claim New Block

Modal dialog for claiming territory:
- Address input field with autocomplete (Mapbox Geocoding)
- Map preview showing the location
- Availability check (max 5 players per block)
- If block is full: Show "Block Full" message + list of nearby alternative blocks
- If block has space: "Join this block for $5,000?"
- If block doesn't exist: "Claim new territory for $5,000?"
- Balance check before claiming
- Confirm/Cancel buttons

### 6. NearbyBlocksList.tsx - Discover Nearby Blocks

Scrollable list of blocks within radius:
- Distance from current location/selected point
- Player count / 5 slots
- Available slots indicator
- Territory status color (yours/enemy/neutral)
- Traffic level indicator
- "View on Map" button
- "Attack" button (for enemy blocks)

Sort options:
- Nearest first (default)
- Most players
- Least players (easier targets)
- Highest traffic (most profitable)

## STYLING REQUIREMENTS

Use these CSS variables:
--map-bg: #0a0a0a;
--territory-yours: rgba(0, 255, 136, 0.3);
--territory-enemy: rgba(255, 68, 68, 0.3);
--territory-contested: rgba(255, 204, 0, 0.3);
--territory-neutral: rgba(102, 102, 102, 0.3);
--tile-street: #2a2a2a;
--tile-sidewalk: #3a3a3a;
--tile-building: #1a1a1a;
--tile-alley: #333333;
--tile-corner: #4a4a4a;
--accent-green: #00ff88;
--accent-red: #ff4444;
--accent-yellow: #ffcc00;
--text-primary: #ffffff;
--text-secondary: #888888;

## RESPONSIVE DESIGN

- Desktop (1025px+): Map takes 70% width, panel 30% width side-by-side
- Tablet (641-1024px): Map fullscreen, panel as bottom sheet (swipe up)
- Mobile (0-640px): Map fullscreen, panel as bottom sheet

## DEPENDENCIES

- react 18
- typescript
- mapbox-gl (npm install mapbox-gl @types/mapbox-gl)
- framer-motion
- zustand (already installed)
- tailwindcss

## DELIVERABLES

Create these complete files with full implementations:

1. /components/map/TerritoryMap.tsx
2. /components/map/BlockGrid.tsx  
3. /components/map/MemberPlacer.tsx
4. /components/map/BlockInfo.tsx
5. /components/map/ClaimBlockModal.tsx
6. /components/map/NearbyBlocksList.tsx
7. /components/map/index.ts (barrel exports)

Each component should:
- Be fully typed with TypeScript
- Handle loading states
- Handle error states
- Be mobile responsive
- Use Framer Motion for animations
- Connect to useTerritoryStore for state
```

---

## 🎯 PROMPT 2: UI Shell / Navigation System
**Assign to:** `qwen3-coder:480b-cloud` or `glm-4.6:cloud`
**Estimated Time:** 3-4 hours

---

```
# TASK: Build iOS-Style UI Shell for Dealt/Slide

Create the main application shell that wraps all game features. The design mimics an iPhone/iPad home screen with app icons that open different game modes.

## DESIGN CONCEPT

The game UI looks like an iOS home screen:
- Dark gradient background
- App icons arranged in a grid
- Each icon opens a different game feature
- Status bar at top showing cash, heat level, notifications
- Dock at bottom with pinned apps
- Smooth transitions between apps

## APP ICONS TO CREATE

| Icon | Name | Route | Description |
|------|------|-------|-------------|
| 🎯 | SLIDE | /slide | Battleship-style combat game |
| 🚗 | DRIVE-BY | /driveby | FPS drive-by shooting |
| 💊 | DEALT | /dealt | Tinder-style drug dealing |
| 🧪 | ALCHEMY | /alchemy | Drug crafting lab |
| 📱 | CONTACTS | /contacts | Gang member management |
| 💰 | SHOEBOX | /shoebox | Banking and finances |
| 🛒 | MARKET | /market | Black market shop |
| 🗺️ | MAP | /map | Territory control map |
| 🎰 | CASINO | /casino | Gambling mini-games |
| 📊 | STATS | /stats | Player statistics |
| ⚙️ | SETTINGS | /settings | Game settings |
| 📰 | NEWS | /news | Game events feed |

## COMPONENTS TO BUILD

### 1. AppShell.tsx - Root Container

The main wrapper component:
- Full viewport dark background with subtle gradient
- Contains StatusBar, main content area, and Dock
- Manages notification toasts
- Handles modal overlays

Structure:
<AppShell>
  <StatusBar />
  <main className="flex-1 overflow-hidden">
    <Outlet /> {/* React Router renders here */}
  </main>
  <Dock />
  <NotificationToast />
</AppShell>

### 2. StatusBar.tsx - Top Information Bar

Always visible bar at top:
- Left side: Current time (updates every minute)
- Center: Current app/page name
- Right side: Cash balance, Heat indicator, Notification bell

Example Layout:
┌────────────────────────────────────────────────┐
│  2:34 PM     │     DEALT     │  $125,450 🔥3 🔔 │
└────────────────────────────────────────────────┘

Heat Level Visual:
- 0-2: 🟢 Green (safe)
- 3-5: 🟡 Yellow (caution)
- 6-8: 🟠 Orange (hot)
- 9-10: 🔴 Red pulsing (danger!)

Clicking cash opens Shoebox
Clicking heat shows heat breakdown tooltip
Clicking bell opens NotificationCenter

### 3. HomeScreen.tsx - App Grid

iOS-style home screen:
- Grid of app icons
- 4 columns on mobile
- 5 columns on tablet
- 6 columns on desktop
- Each icon has name below
- Red badge for notification count
- Tap to navigate to app

Icon layout:
- 60x60px icon with 14px border radius
- App name below in small text
- Badge positioned top-right

### 4. Dock.tsx - Bottom Navigation

Fixed dock at bottom:
- Glass morphism background (blur + transparency)
- 5 most important apps pinned
- Active app has highlight indicator
- Always visible for quick navigation

Default Dock Apps:
[DEALT] [MAP] [CONTACTS] [SHOEBOX] [≡ MORE]

The "MORE" button opens a quick menu showing all other apps

### 5. AppIcon.tsx - Reusable Icon Component

Props:
- id: string
- name: string (display name)
- icon: string | ReactNode (emoji or custom icon)
- route: string (React Router path)
- badge?: number (notification count)
- isLocked?: boolean (not yet unlocked)
- unlockLevel?: number (level required)

Features:
- Tap animation (scale down to 0.9, then back)
- Long press for context menu (future)
- Locked state shows padlock overlay
- Badge shows red circle with count

### 6. NotificationCenter.tsx - Notification Panel

Slide-down panel from top:
- List of recent notifications
- Each notification has: icon, title, message, timestamp
- Swipe individual to dismiss
- "Clear All" button
- Mark as read on view

Notification Types:
- INCOME: "💰 Your dealers earned $2,500"
- ATTACK: "⚔️ Block under attack!"
- HOSPITAL: "🏥 Lil Mike released from hospital"
- JAIL: "⛓️ Big Tony released from jail"  
- MARKET: "📦 Your order has arrived"
- HEAT: "🚨 Police activity increasing"
- DEAL: "💊 The Plug has a limited offer"
- LEVEL_UP: "⬆️ You reached Level 10!"

### 7. QuickStats.tsx - Floating Stats Widget

Small floating widget (bottom-left):
- Shows key stats at a glance
- Tap to expand/collapse
- Draggable position (optional)

Collapsed View:
┌─────────────────┐
│ $125K 🔥3 👥8  │
└─────────────────┘

Expanded View:
┌─────────────────────┐
│ Cash: $125,450      │
│ Heat: 3/10          │
│ Members: 8/12       │
│ Blocks: 3 owned     │
│ Income: $2.5K/hr    │
│ Level: 15           │
└─────────────────────┘

### 8. AppRouter.tsx - Route Configuration

React Router v6 setup:
- Lazy load each app for performance
- Loading spinner during load
- 404 page for unknown routes
- Route guards (future: auth check)

Routes:
/               → HomeScreen
/dealt          → DealtGame (lazy)
/slide          → SlideGame (lazy)
/driveby        → DriveByGame (lazy)
/alchemy        → AlchemyLab (lazy)
/contacts       → ContactsApp (lazy)
/shoebox        → ShoeboxApp (lazy)
/market         → MarketApp (lazy)
/map            → TerritoryMap (lazy)
/casino         → CasinoLobby (lazy)
/stats          → PlayerStats (lazy)
/settings       → SettingsPage (lazy)
/news           → NewsPage (lazy)
/onboarding     → StoryPlayer

## STYLING

CSS Variables:
--shell-bg: linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 100%);
--status-bar-bg: rgba(0, 0, 0, 0.85);
--status-bar-height: 44px;
--dock-bg: rgba(255, 255, 255, 0.1);
--dock-blur: 20px;
--dock-height: 80px;
--icon-size: 60px;
--icon-radius: 14px;
--icon-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
--accent-green: #00ff88;
--accent-red: #ff4444;
--text-primary: #ffffff;
--text-secondary: rgba(255, 255, 255, 0.6);

Glass Morphism Effect:
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

## ANIMATIONS (Framer Motion)

App Icon Tap:
whileTap={{ scale: 0.9 }}
transition={{ duration: 0.1 }}

Page Transition:
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.95 }}
transition={{ duration: 0.2 }}

Notification Slide:
initial={{ y: -100, opacity: 0 }}
animate={{ y: 0, opacity: 1 }}
exit={{ y: -100, opacity: 0 }}

## RESPONSIVE BREAKPOINTS

Mobile (max-width: 640px):
- 4 column grid
- Smaller icons (50px)
- Compact dock

Tablet (641px - 1024px):
- 5 column grid
- Standard icons (60px)
- Standard dock

Desktop (1025px+):
- 6 column grid
- Larger icons (70px)
- Wider dock with labels

## DEPENDENCIES

- react 18
- react-router-dom v6
- framer-motion
- zustand
- tailwindcss
- lucide-react (for icons)

## DELIVERABLES

Create these complete files:

1. /components/shell/AppShell.tsx
2. /components/shell/StatusBar.tsx
3. /components/shell/HomeScreen.tsx
4. /components/shell/Dock.tsx
5. /components/shell/AppIcon.tsx
6. /components/shell/NotificationCenter.tsx
7. /components/shell/QuickStats.tsx
8. /components/shell/AppRouter.tsx
9. /components/shell/index.ts (exports)
10. /App.tsx (updated root with AppShell)

Each component should be:
- Fully typed TypeScript
- Mobile responsive
- Animated with Framer Motion
- Connected to stores where needed
```

---

## 📋 EXECUTION SUMMARY

### Fire These Prompts Now:

| # | Component | Recommended Model | Est. Time |
|---|-----------|------------------|-----------|
| 1 | Territory Map | deepseek-v3.1:671b | 4-5 hrs |
| 2 | UI Shell | qwen3-coder:480b | 3-4 hrs |

### While Waiting, Claude Will Build:

**Game Engine Integration Layer:**
- GameLoop.tsx - Master tick manager (income, events, timers)
- IncomeEngine.ts - Dealer income calculations
- CombatResolver.ts - SLIDE attack resolution
- EventBus.ts - Cross-system event communication
- HospitalJailManager.ts - Member status timers

---

## 📁 FINAL PROJECT STRUCTURE

After all components are complete:

```
/src
├── components/
│   ├── shell/              ← From Prompt 2
│   │   ├── AppShell.tsx
│   │   ├── StatusBar.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── Dock.tsx
│   │   ├── AppIcon.tsx
│   │   ├── NotificationCenter.tsx
│   │   ├── QuickStats.tsx
│   │   ├── AppRouter.tsx
│   │   └── index.ts
│   │
│   ├── map/                ← From Prompt 1
│   │   ├── TerritoryMap.tsx
│   │   ├── BlockGrid.tsx
│   │   ├── MemberPlacer.tsx
│   │   ├── BlockInfo.tsx
│   │   ├── ClaimBlockModal.tsx
│   │   ├── NearbyBlocksList.tsx
│   │   └── index.ts
│   │
│   ├── contacts/           ← Already done (Doc 6)
│   ├── shoebox/            ← Already done (Doc 5)
│   ├── market/             ← Already done (Doc 8)
│   ├── onboarding/         ← Already done (Doc 3)
│   │
│   └── engines/            ← Already done (your original)
│       ├── dealt/
│       ├── slide/
│       ├── driveby/
│       └── alchemy/
│
├── core/                   ← Claude builds now
│   ├── GameLoop.tsx
│   ├── IncomeEngine.ts
│   ├── CombatResolver.ts
│   ├── EventBus.ts
│   └── HospitalJailManager.ts
│
├── stores/                 ← Already done
├── types/                  ← Already done
├── services/               ← Already done
└── App.tsx                 ← Updated by Prompt 2
```
