# DEALT/SLIDE - MVP Repository Structure & Dev Build Plan

## 🎯 MVP PRIORITY FOCUS
**Goal**: Beta-ready build with revenue capability in 4-6 weeks

**Core Revenue Features**:
1. Real-world territory claiming (Mapbox integration)
2. Drug dealing mechanics (DEALT swipe system)
3. Gang warfare (SLIDE grid combat)
4. In-app purchases (gang members, weapons, territory boosts)

---

## 📁 REPOSITORY STRUCTURE

```
dealt-slide-mvp/
│
├── README.md
├── .gitignore
├── docker-compose.yml
├── MVP_ROADMAP.md
│
├── frontend/                          # React + TypeScript + Phaser
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── index.html
│   │
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── config/                   # Configuration files
│   │   │   ├── constants.ts          # Game constants, cities, regions
│   │   │   ├── mapbox.config.ts      # Mapbox API configuration
│   │   │   ├── banana.config.ts      # Banana Nano API for AI graphics
│   │   │   └── socket.config.ts      # WebSocket configuration
│   │   │
│   │   ├── stores/                   # Zustand state management
│   │   │   ├── gameStore.ts          # Main game state
│   │   │   ├── userStore.ts          # User profile, gang, inventory
│   │   │   ├── mapStore.ts           # Territory & location state
│   │   │   ├── combatStore.ts        # SLIDE combat state
│   │   │   ├── dealerStore.ts        # DEALT drug dealing state
│   │   │   └── assetStore.ts         # AI-generated graphics cache
│   │   │
│   │   ├── components/
│   │   │   │
│   │   │   ├── layout/               # Core UI shell
│   │   │   │   ├── OSShell.tsx       # iOS-style desktop interface
│   │   │   │   ├── AppGrid.tsx       # App icon grid
│   │   │   │   ├── NavigationBar.tsx
│   │   │   │   ├── StatusBar.tsx     # Cash, heat, notifications
│   │   │   │   └── NotificationCenter.tsx
│   │   │   │
│   │   │   ├── map/                  # Territory claiming system
│   │   │   │   ├── MapView.tsx       # Mapbox GL integration
│   │   │   │   ├── BlockMarker.tsx   # Territory markers
│   │   │   │   ├── ClaimModal.tsx    # Territory claiming UI
│   │   │   │   ├── TerritoryInfo.tsx # Block stats & ownership
│   │   │   │   └── GridPreview.tsx   # Show grid before claiming
│   │   │   │
│   │   │   ├── dealt/                # Drug dealing game mode
│   │   │   │   ├── DealerMode.tsx    # Main container
│   │   │   │   ├── SwipeCard.tsx     # Tinder-style swipe cards
│   │   │   │   ├── ClientProfile.tsx # Customer details
│   │   │   │   ├── DealConfirm.tsx   # Transaction confirmation
│   │   │   │   └── HeatWarning.tsx   # Heat level alerts
│   │   │   │
│   │   │   ├── slide/                # Grid combat game mode
│   │   │   │   ├── SlideGame.tsx     # Main Phaser container
│   │   │   │   ├── GridRenderer.tsx  # Battleship-style grid
│   │   │   │   ├── UnitSelector.tsx  # Choose units to deploy
│   │   │   │   ├── CombatLog.tsx     # Battle feed
│   │   │   │   └── VictoryScreen.tsx # Win/lose results
│   │   │   │
│   │   │   ├── driveby/              # First-person shooting
│   │   │   │   ├── DriveByGame.tsx   # Main Phaser container
│   │   │   │   ├── ParallaxScroller.tsx # Street scrolling
│   │   │   │   ├── TargetReticle.tsx
│   │   │   │   └── ScoreDisplay.tsx
│   │   │   │
│   │   │   ├── gang/                 # Gang management
│   │   │   │   ├── GangOverview.tsx  # Dashboard
│   │   │   │   ├── MemberCard.tsx    # Individual member UI
│   │   │   │   ├── RecruitModal.tsx  # Hire new members
│   │   │   │   ├── UpgradeModal.tsx  # Member upgrades
│   │   │   │   ├── LoyaltyMeter.tsx  # Morale/loyalty display
│   │   │   │   └── MemberPhotoUpload.tsx # Custom character photos
│   │   │   │
│   │   │   ├── alchemy/              # Crafting system
│   │   │   │   ├── AlchemyLab.tsx
│   │   │   │   ├── CraftingTable.tsx
│   │   │   │   ├── RecipeBook.tsx
│   │   │   │   └── InventoryGrid.tsx
│   │   │   │
│   │   │   ├── shop/                 # In-app purchases (IAP)
│   │   │   │   ├── ShopScreen.tsx    # Main store
│   │   │   │   ├── CashPackages.tsx  # Buy in-game currency
│   │   │   │   ├── PremiumItems.tsx  # Weapons, boosts
│   │   │   │   ├── GangSlots.tsx     # Buy more member slots
│   │   │   │   └── PaymentModal.tsx  # Stripe/payment integration
│   │   │   │
│   │   │   └── shared/               # Reusable components
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── LoadingSpinner.tsx
│   │   │       ├── Toast.tsx
│   │   │       └── AIGeneratedImage.tsx # Banana Nano wrapper
│   │   │
│   │   ├── game-engines/             # Phaser 3 game logic
│   │   │   ├── slide/
│   │   │   │   ├── SlideScene.ts     # Main combat scene
│   │   │   │   ├── GridManager.ts    # Grid state & logic
│   │   │   │   ├── UnitController.ts # Unit behavior
│   │   │   │   └── CombatResolver.ts # Damage calculation
│   │   │   │
│   │   │   ├── driveby/
│   │   │   │   ├── DriveByScene.ts
│   │   │   │   ├── ScrollManager.ts
│   │   │   │   ├── EnemySpawner.ts
│   │   │   │   └── WeaponSystem.ts
│   │   │   │
│   │   │   └── alchemy/
│   │   │       ├── AlchemyScene.ts
│   │   │       └── PhysicsEngine.ts
│   │   │
│   │   ├── services/                 # API & external integrations
│   │   │   ├── api.service.ts        # Base API client
│   │   │   ├── auth.service.ts       # Login, signup, JWT
│   │   │   ├── map.service.ts        # Mapbox geocoding
│   │   │   ├── territory.service.ts  # Claim/attack blocks
│   │   │   ├── combat.service.ts     # SLIDE game API
│   │   │   ├── dealer.service.ts     # DEALT game API
│   │   │   ├── gang.service.ts       # Member management
│   │   │   ├── socket.service.ts     # WebSocket events
│   │   │   ├── banana.service.ts     # AI image generation
│   │   │   ├── cloudinary.service.ts # User photo uploads
│   │   │   └── payment.service.ts    # Stripe/IAP
│   │   │
│   │   ├── utils/                    # Helper functions
│   │   │   ├── heatCalculator.ts     # Heat system logic
│   │   │   ├── combatResolver.ts     # Combat math
│   │   │   ├── economySimulator.ts   # Income calculations
│   │   │   ├── gridGenerator.ts      # Convert maps to grids
│   │   │   ├── imageProcessor.ts     # Crop/resize user photos
│   │   │   └── validators.ts         # Form validation
│   │   │
│   │   ├── types/                    # TypeScript definitions
│   │   │   ├── game.types.ts
│   │   │   ├── map.types.ts
│   │   │   ├── combat.types.ts
│   │   │   ├── gang.types.ts
│   │   │   ├── dealer.types.ts
│   │   │   └── api.types.ts
│   │   │
│   │   └── hooks/                    # Custom React hooks
│   │       ├── useGameState.ts
│   │       ├── useSocket.ts
│   │       ├── useHeat.ts
│   │       ├── useLocation.ts
│   │       └── useAssetGeneration.ts # Banana Nano hook
│   │
│   └── public/
│       └── assets/
│           ├── sprites/              # Pre-made sprites
│           ├── audio/                # Sound effects
│           └── icons/                # App icons
│
├── backend/                          # Python/Flask API
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   │
│   ├── src/
│   │   ├── main.py                   # Flask app entry point
│   │   ├── config.py                 # Environment config
│   │   ├── extensions.py             # DB, Redis, SocketIO init
│   │   │
│   │   ├── api/                      # REST endpoints
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # /api/auth/*
│   │   │   ├── map.py                # /api/map/*
│   │   │   ├── territory.py          # /api/territory/*
│   │   │   ├── combat.py             # /api/combat/*
│   │   │   ├── dealer.py             # /api/dealer/*
│   │   │   ├── gang.py               # /api/gang/*
│   │   │   ├── alchemy.py            # /api/alchemy/*
│   │   │   ├── shop.py               # /api/shop/* (IAP)
│   │   │   └── assets.py             # /api/assets/* (Banana Nano)
│   │   │
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── block.py              # Territory blocks
│   │   │   ├── gang_member.py
│   │   │   ├── unit.py               # Combat units
│   │   │   ├── drug.py               # Inventory items
│   │   │   ├── transaction.py        # Economy logs
│   │   │   ├── combat_log.py
│   │   │   └── generated_asset.py    # AI image cache
│   │   │
│   │   ├── services/                 # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── heat_service.py       # Heat decay & police
│   │   │   ├── combat_service.py     # Battle resolution
│   │   │   ├── economy_service.py    # Income generation
│   │   │   ├── territory_service.py  # Block claiming logic
│   │   │   ├── grid_service.py       # Map → Grid conversion
│   │   │   ├── ai_service.py         # NPC behavior
│   │   │   ├── banana_service.py     # Banana Nano API calls
│   │   │   ├── cloudinary_service.py # Photo upload/storage
│   │   │   └── payment_service.py    # Stripe integration
│   │   │
│   │   ├── sockets/                  # WebSocket handlers
│   │   │   ├── __init__.py
│   │   │   ├── combat_events.py      # Real-time combat
│   │   │   ├── territory_events.py   # Block updates
│   │   │   └── notification_events.py
│   │   │
│   │   └── utils/
│   │       ├── validators.py
│   │       ├── decorators.py         # @require_auth, @rate_limit
│   │       └── helpers.py
│   │
│   └── tests/
│       ├── test_auth.py
│       ├── test_combat.py
│       ├── test_territory.py
│       └── test_grid_generation.py
│
├── database/
│   └── migrations/                   # Alembic migrations
│
├── docs/
│   ├── API_REFERENCE.md
│   ├── HEAT_SYSTEM.md
│   ├── GRID_GENERATION.md
│   ├── BANANA_NANO_INTEGRATION.md
│   ├── IAP_SETUP.md
│   └── USER_PHOTO_SYSTEM.md
│
└── scripts/
    ├── setup.sh                      # Initial setup
    ├── seed_data.py                  # Test data
    └── generate_cities.py            # Pre-populate cities
```

---

## 🎮 PLAYABLE GAME MODES STATUS

### ✅ CURRENTLY PLAYABLE
1. **DEALT (Drug Dealing)** - Tinder-style swipe mechanics ✓
2. **SLIDE (Grid Combat)** - Battleship-style warfare ✓
3. **Drive-By (FPS)** - First-person shooting from vehicle ✓
4. **Alchemy Lab** - Crafting system ✓

### 🚧 IN DEVELOPMENT
1. **Territory Map** - Real-world block claiming (needs Mapbox integration)
2. **Grid Generator** - Convert satellite imagery to tactical grids (needs implementation)
3. **AI Asset Generation** - On-demand graphics via Banana Nano (needs full integration)
4. **User Photo Upload** - Custom gang member portraits (needs Cloudinary setup)

---

## 🗺️ MAP GENERATOR - CURRENT CAPABILITIES

**What You Have:**
- Mapbox API configuration planned
- Grid generation service structure defined
- Geospatial database support (PostGIS)

**What's Missing for MVP:**
1. ✅ Mapbox GL JS integration in MapView.tsx
2. ❌ Grid Generator implementation (convert lat/lng + satellite data → playable grid)
3. ❌ Block claiming API endpoints
4. ❌ Caching system to avoid re-generating same blocks

**Technical Approach:**
```
1. User taps location on map
2. Get lat/lng coordinates
3. Define block boundaries (e.g., 100m x 100m square)
4. Fetch Mapbox satellite imagery for that area
5. Process image to detect:
   - Buildings (obstacles)
   - Streets (movement paths)
   - Open areas (cover points)
6. Generate 10x10 grid with terrain types
7. Cache grid in database
8. Return grid to frontend for SLIDE combat
```

---

## 🎨 AI GRAPHICS - BANANA NANO API STATUS

**Integration Plan:**
- **Character Portraits**: Gang members, enemies, NPCs
- **Weapon Renders**: Hyper-realistic firearms
- **Environment Assets**: Street backgrounds for Drive-By mode
- **UI Elements**: Custom icons, badges

**Hybrid Style Approach:**
- **Standard Items**: 100% hyper-realistic (photos/3D renders)
- **Super Items**: 80% realistic + 20% futuristic glow effects
- **Character Portraits**: User photos processed + AI enhancement

**Current Status:** Configuration file planned, service layer defined, needs API integration

---

## 👥 USER PHOTO SYSTEM - CUSTOM CHARACTERS

**Feature:** Players upload photos of friends → AI converts them into playable gang members

**Tech Stack:**
1. **Frontend**: File upload component with crop/preview
2. **Storage**: Cloudinary (CDN + transformations)
3. **Processing**: 
   - Crop to square aspect ratio
   - Background removal (optional)
   - Face detection for proper framing
4. **AI Enhancement**: Banana Nano to stylize photos
5. **Backend**: Store photo URL + character metadata

**Security Considerations:**
- Max file size: 5MB
- Allowed formats: JPG, PNG
- Content moderation: NSFW detection
- Age verification required (18+ game)

---

## 🚀 MVP BUILD PLAN - 6 SPRINTS (4 WEEKS)

### SPRINT 1: FOUNDATION (Days 1-5)
**Goal:** Core infrastructure + authentication

**Tasks:**
1. ✅ Set up repository structure
2. ✅ Backend: Flask app + PostgreSQL + Redis
3. ✅ Frontend: React + Vite + Tailwind setup
4. ✅ Authentication: JWT login/signup
5. ✅ Basic state management (Zustand stores)

**Deliverable:** Users can create accounts and log in

---

### SPRINT 2: TERRITORY SYSTEM (Days 6-10)
**Goal:** Real-world map integration + block claiming

**Priority Tasks:**
1. Mapbox GL integration in MapView component
2. Geocoding service (address → lat/lng)
3. Block claiming API endpoint
4. Territory database schema
5. Basic grid preview (show what grid looks like before claiming)

**Deliverable:** Users can see map, claim blocks, and view owned territory

---

### SPRINT 3: GRID GENERATOR + SLIDE COMBAT (Days 11-15)
**Goal:** Playable combat on claimed territory

**Priority Tasks:**
1. **Grid Generator Service:**
   - Input: lat/lng + block size
   - Output: 10x10 grid with terrain data
   - Satellite image processing (basic version)
   - Caching system
2. **SLIDE Game Integration:**
   - Phaser scene setup
   - Grid rendering on frontend
   - Unit placement UI
   - Combat resolution API
3. **Combat Flow:**
   - Attack initiation
   - Real-time updates via WebSocket
   - Victory/defeat screens

**Deliverable:** Users can attack other players' blocks with working grid combat

---

### SPRINT 4: DEALT + GANG MANAGEMENT (Days 16-20)
**Goal:** Drug dealing mechanics + gang member system

**Priority Tasks:**
1. **DEALT Swipe System:**
   - Client generation (random customers)
   - Swipe cards UI (like Tinder)
   - Deal confirmation + income
   - Heat level tracking
2. **Gang Management:**
   - Member database schema
   - Recruit/hire UI
   - Member stats (loyalty, skills, health)
   - Assignment to territories

**Deliverable:** Users can deal drugs, earn money, and build gangs

---

### SPRINT 5: AI GRAPHICS + USER PHOTOS (Days 21-25)
**Goal:** Visual polish + custom character system

**Priority Tasks:**
1. **Banana Nano Integration:**
   - API service wrapper
   - Asset caching system
   - Generate character portraits on demand
   - Generate weapon renders
2. **User Photo Upload:**
   - Cloudinary setup
   - Photo upload component
   - Image processing pipeline
   - Link photos to gang members
3. **UI Polish:**
   - iOS-style desktop interface
   - Smooth animations
   - Loading states
   - Error handling

**Deliverable:** Game looks polished with AI-generated graphics and custom character photos

---

### SPRINT 6: IN-APP PURCHASES + BETA LAUNCH (Days 26-30)
**Goal:** Revenue generation + public beta

**Priority Tasks:**
1. **Shop System:**
   - In-game currency packages
   - Premium weapons/items
   - Gang member slots
   - Territory boosts
2. **Payment Integration:**
   - Stripe setup
   - Payment flow (web)
   - Receipt generation
   - Transaction logging
3. **Beta Prep:**
   - Bug fixes
   - Performance optimization
   - Tutorial/onboarding
   - Analytics setup (track key metrics)

**Deliverable:** Beta-ready build with working monetization

---

## 🤖 AI CODE GENERATOR PROMPTS

Below are ready-to-use prompts for AI coding assistants (ChatGPT, Claude, Cursor, etc.). Each includes full context about the codebase.

---

### PROMPT 1: Mapbox Integration for Territory Map

```
PROJECT CONTEXT:
- Game: DEALT/SLIDE - 18+ urban warfare RPG with real-world territory control
- Tech Stack: React 18 + TypeScript + Vite + Zustand + Mapbox GL JS
- Goal: Let users see a real-world map and claim blocks (territories) by tapping locations

CODE REQUEST:
Create a MapView.tsx component that integrates Mapbox GL JS with the following features:

REQUIREMENTS:
1. Display Mapbox satellite/streets hybrid view
2. Center map on user's geolocation (with permission)
3. Show markers for all claimed blocks (territories)
   - Green markers = owned by current user
   - Red markers = owned by enemies
   - Yellow markers = allied territories
4. On tap/click, show modal with:
   - Address of tapped location
   - Option to "Claim This Block" (costs $1000 in-game)
   - Preview of what the combat grid will look like
5. Real-time updates when other players claim nearby blocks (via WebSocket)

STATE MANAGEMENT (Zustand):
```typescript
// mapStore.ts structure
interface MapStore {
  userLocation: { lat: number; lng: number } | null;
  claimedBlocks: Block[];
  selectedBlock: Block | null;
  isClaimModalOpen: boolean;
  setUserLocation: (location: { lat: number; lng: number }) => void;
  fetchClaimedBlocks: () => Promise<void>;
  claimBlock: (lat: number, lng: number) => Promise<void>;
}

interface Block {
  id: string;
  lat: number;
  lng: number;
  owner_id: string;
  owner_name: string;
  address: string;
  traffic_value: number; // 1-10 scale
  claimed_at: string;
}
```

API ENDPOINTS:
- GET /api/territory/blocks?lat=X&lng=Y&radius=5000 (fetch nearby blocks)
- POST /api/territory/claim { lat, lng, address } (claim new block)
- WebSocket event: 'territory:claimed' (real-time updates)

MAPBOX CONFIG:
```typescript
// mapbox.config.ts
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
export const DEFAULT_ZOOM = 15;
export const BLOCK_RADIUS_METERS = 100; // Each block is 100m x 100m
```

STYLING:
- Use iOS-style design (rounded corners, glassmorphism)
- Dark theme with neon accents (#00ff00 for owned, #ff0000 for enemy)
- Smooth animations on marker tap

DELIVERABLES:
1. MapView.tsx (main component)
2. BlockMarker.tsx (custom marker component)
3. ClaimModal.tsx (modal for claiming blocks)
4. Updated mapStore.ts (Zustand store)
5. map.service.ts (API calls to backend)

Please include:
- Full TypeScript types
- Error handling
- Loading states
- Responsive design (works on mobile + desktop)
```

---

### PROMPT 2: Grid Generator Service (Backend)

```
PROJECT CONTEXT:
- Game: DEALT/SLIDE - 18+ urban warfare RPG
- Tech Stack: Python/Flask + PostgreSQL (PostGIS) + Mapbox API
- Goal: Convert real-world locations into playable 10x10 combat grids

CODE REQUEST:
Create a Grid Generator service that takes a lat/lng coordinate and generates a tactical combat grid for the SLIDE game mode (Battleship-style combat).

REQUIREMENTS:

1. INPUT:
   - Latitude & longitude
   - Block size (default: 100m x 100m square)
   - Difficulty level (1-10, affects complexity)

2. OUTPUT:
```python
{
  "grid": [
    [0, 0, 1, 2, 0, 0, 0, 0, 0, 0],  # 10x10 array
    [0, 0, 1, 2, 0, 3, 3, 3, 0, 0],
    # ... 8 more rows
  ],
  "terrain_types": {
    0: "open_ground",      # Easy to traverse, no cover
    1: "building",         # Obstacle, provides cover
    2: "street",           # Fast movement, no cover
    3: "alley",            # Narrow passage
    4: "park",             # Open but with scattered cover
  },
  "spawn_zones": {
    "attacker": [[0, 0], [0, 1], [0, 2]],  # Top-left corner
    "defender": [[9, 7], [9, 8], [9, 9]]   # Bottom-right corner
  },
  "metadata": {
    "address": "123 Main St, Brooklyn, NY",
    "difficulty": 5,
    "generated_at": "2025-02-15T10:30:00Z",
    "cache_key": "grid_40.7128_-74.0060_100"
  }
}
```

3. GRID GENERATION ALGORITHM:
   - Fetch Mapbox satellite imagery for the area (use Static Images API)
   - Analyze image to detect:
     a) Dark areas = buildings (terrain_type: 1)
     b) Gray lines = streets (terrain_type: 2)
     c) Narrow paths = alleys (terrain_type: 3)
     d) Green areas = parks (terrain_type: 4)
   - Convert to 10x10 grid (each cell = 10m x 10m)
   - Ensure balanced gameplay:
     - 30-40% buildings (cover)
     - 20-30% streets (movement)
     - 30-40% open ground
   - Place spawn zones in opposite corners

4. CACHING STRATEGY:
   - Cache grids in PostgreSQL (blocks table)
   - Cache key: `grid_{lat}_{lng}_{size}`
   - TTL: 30 days (grids rarely change)
   - If block already exists, return cached grid

5. FALLBACK (if image analysis fails):
   - Generate procedural grid using Perlin noise
   - Ensure playability with manual rules

DATABASE SCHEMA:
```python
class Block(db.Model):
    __tablename__ = 'blocks'
    
    id = db.Column(UUID, primary_key=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    address = db.Column(db.String(255))
    owner_id = db.Column(UUID, db.ForeignKey('users.id'))
    traffic_value = db.Column(db.Integer)  # 1-10 scale
    
    # Grid data (stored as JSON)
    grid = db.Column(db.JSON)  # The 10x10 array
    terrain_types = db.Column(db.JSON)  # Terrain definitions
    spawn_zones = db.Column(db.JSON)  # Spawn positions
    
    # Geospatial index
    location = db.Column(Geography('POINT', srid=4326))
    
    claimed_at = db.Column(db.DateTime)
```

API ENDPOINTS:
```python
# GET /api/territory/grid?lat=X&lng=Y
@app.route('/api/territory/grid', methods=['GET'])
def get_grid():
    """Fetch or generate grid for a location"""
    pass

# POST /api/territory/claim
@app.route('/api/territory/claim', methods=['POST'])
def claim_block():
    """Claim a block (generates grid if not cached)"""
    pass
```

EXTERNAL APIS:
- Mapbox Static Images API:
  `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/[lng],[lat],[zoom]/600x600?access_token=TOKEN`

DELIVERABLES:
1. services/grid_service.py (main generator logic)
2. services/geocoding_service.py (address lookup)
3. api/territory.py (Flask routes)
4. Updated Block model with grid fields
5. Unit tests (test_grid_generation.py)

Please include:
- Full error handling
- Image processing (PIL/OpenCV)
- Caching logic
- Fallback procedural generation
```

---

### PROMPT 3: Banana Nano API Integration for AI Graphics

```
PROJECT CONTEXT:
- Game: DEALT/SLIDE - 18+ urban warfare RPG
- Tech Stack: React + TypeScript (frontend), Python/Flask (backend)
- Goal: Generate hyper-realistic game assets on-demand using Banana Nano API

CODE REQUEST:
Integrate Banana Nano API for on-demand AI image generation with the following use cases:

USE CASES:
1. Gang member portraits (when user recruits new members)
2. Weapon renders (hyper-realistic firearms)
3. Environment backgrounds (street scenes for Drive-By mode)
4. Custom UI elements (badges, icons)

REQUIREMENTS:

BACKEND SERVICE (banana_service.py):
```python
import requests
from typing import Literal, Optional
from dataclasses import dataclass

@dataclass
class GeneratedAsset:
    id: str
    url: str  # CDN URL
    prompt: str
    asset_type: Literal['character', 'weapon', 'environment', 'ui']
    style: Literal['realistic', 'semi_realistic', 'stylized']
    generated_at: str
    cached: bool

class BananaService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.banana.dev/..."  # Banana Nano endpoint
    
    def generate_character(self, 
                          ethnicity: str,
                          gender: str, 
                          age_range: str,
                          style: str = "realistic",
                          user_photo_url: Optional[str] = None) -> GeneratedAsset:
        """
        Generate gang member portrait
        
        If user_photo_url provided, use it as reference for face
        Otherwise, generate from prompt
        """
        pass
    
    def generate_weapon(self,
                       weapon_type: str,
                       rarity: Literal['common', 'rare', 'legendary'],
                       style: str = "realistic") -> GeneratedAsset:
        """
        Generate weapon render
        
        Examples:
        - weapon_type: "glock_19", "ak_47", "desert_eagle"
        - rarity affects visual effects (legendary has glow)
        """
        pass
    
    def generate_environment(self,
                            city: str,
                            time_of_day: str,
                            weather: str = "clear") -> GeneratedAsset:
        """
        Generate street background for Drive-By mode
        
        Examples:
        - city: "brooklyn", "los_angeles", "miami"
        - time_of_day: "day", "night", "dusk"
        """
        pass
    
    def cache_asset(self, asset: GeneratedAsset) -> None:
        """Store generated asset in database to avoid re-generating"""
        pass
    
    def get_cached_asset(self, asset_type: str, prompt_hash: str) -> Optional[GeneratedAsset]:
        """Retrieve cached asset if available"""
        pass
```

PROMPT ENGINEERING:
- **Characters:** "Hyper-realistic portrait of [ethnicity] [gender], age [range], urban street style, dramatic lighting, 4K quality, front-facing, neutral expression"
- **Weapons:** "Professional product photography of [weapon_name], studio lighting, black background, 8K resolution, extreme detail, [rarity_effect]"
  - Common: No effects
  - Rare: Subtle metallic sheen
  - Legendary: Neon glow accents (#00ff00 or #ff00ff)
- **Environments:** "Photo-realistic [city] street scene, [time_of_day], urban architecture, [weather], cinematic composition"

DATABASE MODEL:
```python
class GeneratedAsset(db.Model):
    __tablename__ = 'generated_assets'
    
    id = db.Column(UUID, primary_key=True)
    asset_type = db.Column(db.String(50))  # character, weapon, environment
    prompt = db.Column(db.Text)
    prompt_hash = db.Column(db.String(64), index=True)  # For quick lookup
    url = db.Column(db.String(500))  # Cloudinary or S3 URL
    banana_request_id = db.Column(db.String(255))
    
    # Metadata
    style = db.Column(db.String(50))
    parameters = db.Column(db.JSON)  # Store generation params
    
    # Usage tracking
    times_used = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime)
```

FRONTEND HOOK (useAssetGeneration.ts):
```typescript
import { useState, useEffect } from 'react';

interface UseAssetGenerationProps {
  assetType: 'character' | 'weapon' | 'environment';
  prompt: string;
  autoGenerate?: boolean;
}

export const useAssetGeneration = ({ 
  assetType, 
  prompt, 
  autoGenerate = false 
}: UseAssetGenerationProps) => {
  const [asset, setAsset] = useState<GeneratedAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAsset = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/assets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_type: assetType, prompt })
      });
      const data = await response.json();
      setAsset(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoGenerate) generateAsset();
  }, [prompt]);

  return { asset, loading, error, generateAsset };
};
```

REACT COMPONENT (AIGeneratedImage.tsx):
```typescript
interface AIGeneratedImageProps {
  assetType: 'character' | 'weapon' | 'environment';
  prompt: string;
  className?: string;
  fallbackSrc?: string;
}

export const AIGeneratedImage: React.FC<AIGeneratedImageProps> = ({
  assetType,
  prompt,
  className,
  fallbackSrc
}) => {
  const { asset, loading, error } = useAssetGeneration({ 
    assetType, 
    prompt, 
    autoGenerate: true 
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <img src={fallbackSrc} alt="Fallback" />;
  
  return <img src={asset?.url} alt={prompt} className={className} />;
};
```

API ENDPOINTS:
```python
# POST /api/assets/generate
@app.route('/api/assets/generate', methods=['POST'])
def generate_asset():
    """Generate new asset via Banana Nano"""
    pass

# GET /api/assets/<asset_id>
@app.route('/api/assets/<asset_id>', methods=['GET'])
def get_asset(asset_id):
    """Retrieve cached asset"""
    pass
```

COST OPTIMIZATION:
- Always check cache before generating
- Batch requests when possible
- Use lower resolution for previews (upgrade on demand)
- Track usage to identify popular assets

DELIVERABLES:
1. services/banana_service.py (backend API wrapper)
2. api/assets.py (Flask routes)
3. Updated GeneratedAsset model
4. hooks/useAssetGeneration.ts (React hook)
5. components/shared/AIGeneratedImage.tsx
6. banana.config.ts (API keys, endpoints)

Please include:
- Error handling (API failures, rate limits)
- Retry logic with exponential backoff
- Loading states
- Fallback images
```

---

### PROMPT 4: User Photo Upload for Custom Gang Members

```
PROJECT CONTEXT:
- Game: DEALT/SLIDE - 18+ urban warfare RPG
- Tech Stack: React + TypeScript + Cloudinary (frontend), Python/Flask (backend)
- Goal: Let users upload photos of friends to create custom gang member characters

CODE REQUEST:
Build a complete user photo upload system with the following features:

REQUIREMENTS:

1. UPLOAD FLOW:
   ```
   User uploads photo → Crop to square → Preview → 
   Upload to Cloudinary → Process (background removal optional) →
   Create gang member with photo → AI enhance via Banana Nano (optional)
   ```

2. FRONTEND COMPONENT (MemberPhotoUpload.tsx):
```typescript
import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface MemberPhotoUploadProps {
  onPhotoUploaded: (photoUrl: string) => void;
  maxSizeMB?: number;  // Default: 5MB
}

export const MemberPhotoUpload: React.FC<MemberPhotoUploadProps> = ({
  onPhotoUploaded,
  maxSizeMB = 5
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Features:
  // 1. Drag-and-drop or click to upload
  // 2. Show preview with crop tool (react-easy-crop)
  // 3. Validate file size and type
  // 4. Upload to Cloudinary
  // 5. Return CDN URL
  
  return (
    <div className="photo-upload-container">
      {/* Dropzone */}
      {/* Crop tool */}
      {/* Upload button */}
      {/* Loading state */}
    </div>
  );
};
```

3. IMAGE PROCESSING:
   - Crop to 1:1 aspect ratio (square)
   - Resize to 512x512px (optimal for AI processing)
   - Optional: Remove background (use remove.bg API or Cloudinary AI)
   - Optional: Face detection to ensure face is centered

4. CLOUDINARY INTEGRATION:
```typescript
// cloudinary.service.ts
import { Cloudinary } from '@cloudinary/url-gen';

const cloudinary = new Cloudinary({
  cloud: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  }
});

export const uploadPhoto = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'gang_members'); // Pre-configured preset
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );
  
  const data = await response.json();
  return data.secure_url; // Return CDN URL
};

export const transformPhoto = (publicId: string, transformations: string[]): string => {
  // Generate transformed URL
  // Example: remove background, crop, resize
  return cloudinary
    .image(publicId)
    .removeBackground()
    .resize(fill().width(512).height(512))
    .toURL();
};
```

5. BACKEND ENDPOINT:
```python
# POST /api/gang/member/photo
@app.route('/api/gang/member/photo', methods=['POST'])
@require_auth
def upload_member_photo():
    """
    Handle photo upload and create gang member
    
    Request body:
    {
      "photo_url": "https://res.cloudinary.com/...",
      "member_name": "Optional name",
      "enhance_with_ai": true  # Use Banana Nano to stylize
    }
    
    Response:
    {
      "member_id": "uuid",
      "photo_url": "...",
      "enhanced_photo_url": "..."  # If AI enhancement requested
    }
    """
    pass
```

6. DATABASE MODEL:
```python
class GangMember(db.Model):
    __tablename__ = 'gang_members'
    
    id = db.Column(UUID, primary_key=True)
    user_id = db.Column(UUID, db.ForeignKey('users.id'), nullable=False)
    
    # Photo data
    photo_url = db.Column(db.String(500))  # Original Cloudinary URL
    enhanced_photo_url = db.Column(db.String(500))  # AI-enhanced version
    cloudinary_public_id = db.Column(db.String(255))
    
    # Member stats
    name = db.Column(db.String(100))
    role = db.Column(db.String(50))  # dealer, enforcer, driver, etc.
    level = db.Column(db.Integer, default=1)
    loyalty = db.Column(db.Integer, default=50)  # 0-100
    
    # Skills
    shooting_skill = db.Column(db.Integer, default=50)
    driving_skill = db.Column(db.Integer, default=50)
    dealing_skill = db.Column(db.Integer, default=50)
    
    recruited_at = db.Column(db.DateTime, default=datetime.utcnow)
```

7. SECURITY & VALIDATION:
   - Max file size: 5MB
   - Allowed formats: JPG, PNG only
   - NSFW detection (use Cloudinary's AI moderation)
   - Age verification reminder (18+ game)
   - Content moderation: Block explicit images
   - Rate limiting: Max 10 uploads per hour

8. AI ENHANCEMENT (Optional):
```python
# After photo uploaded, optionally enhance with Banana Nano
def enhance_member_photo(original_url: str) -> str:
    """
    Use Banana Nano to:
    - Improve lighting
    - Add subtle urban aesthetic
    - Maintain facial likeness
    
    Prompt: "Portrait of person, urban street style, 
             cinematic lighting, hyper-realistic, 
             maintain facial features exactly"
    """
    banana_service = BananaService(api_key=BANANA_API_KEY)
    enhanced = banana_service.generate_character(
        user_photo_url=original_url,
        style="semi_realistic"
    )
    return enhanced.url
```

FRONTEND INTEGRATION:
```typescript
// In GangManagement.tsx
const handleAddCustomMember = async (photoUrl: string) => {
  const response = await fetch('/api/gang/member/photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      photo_url: photoUrl,
      enhance_with_ai: true 
    })
  });
  
  const member = await response.json();
  
  // Add to gang
  gangStore.addMember(member);
};
```

DELIVERABLES:
1. components/gang/MemberPhotoUpload.tsx (upload UI)
2. components/gang/PhotoCropTool.tsx (crop interface)
3. services/cloudinary.service.ts (upload & transform)
4. api/gang.py (backend routes)
5. Updated GangMember model
6. Content moderation middleware
7. Error handling for failed uploads

Please include:
- Full TypeScript types
- Loading/progress indicators
- Error messages
- Preview before finalizing
- Mobile-responsive design
```

---

### PROMPT 5: In-App Purchase (IAP) Shop System

```
PROJECT CONTEXT:
- Game: DEALT/SLIDE - 18+ urban warfare RPG
- Tech Stack: React + TypeScript + Stripe (frontend), Python/Flask (backend)
- Goal: Monetize game via in-app purchases (cash packages, weapons, gang slots)

CODE REQUEST:
Build a complete in-app purchase system with Stripe integration for the following products:

PRODUCTS:
1. **Cash Packages** (in-game currency)
   - Starter Pack: $4.99 → 10,000 coins
   - Gang Pack: $9.99 → 25,000 coins + 5% bonus
   - Boss Pack: $19.99 → 60,000 coins + 10% bonus
   - Kingpin Pack: $49.99 → 200,000 coins + 20% bonus

2. **Premium Weapons**
   - Rare Weapon: $2.99
   - Legendary Weapon: $7.99
   - Ultimate Weapon Pack: $14.99

3. **Gang Slots** (increase member capacity)
   - +5 Slots: $3.99
   - +10 Slots: $6.99
   - Unlimited Slots: $19.99

4. **Territory Boosts**
   - Income Multiplier (2x for 24h): $1.99
   - Heat Shield (no police for 1h): $0.99
   - Fast Claim (instant block claim): $4.99

REQUIREMENTS:

1. FRONTEND SHOP UI (ShopScreen.tsx):
```typescript
import React from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;  // In USD
  currency: string;
  type: 'cash' | 'weapon' | 'slot' | 'boost';
  image_url: string;
  value: number;  // Amount of in-game currency or item ID
  bonus_percentage?: number;  // For cash packages
}

export const ShopScreen: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async (item: ShopItem) => {
    // Stripe payment flow
    // 1. Create payment intent on backend
    // 2. Confirm payment with Stripe
    // 3. Backend grants items
    // 4. Update UI
  };

  return (
    <div className="shop-container">
      <h1>Store</h1>
      
      {/* Cash Packages Section */}
      <section>
        <h2>Cash Packages</h2>
        <div className="product-grid">
          {cashPackages.map(item => (
            <ProductCard 
              key={item.id} 
              item={item} 
              onPurchase={handlePurchase} 
            />
          ))}
        </div>
      </section>
      
      {/* Weapons Section */}
      {/* Gang Slots Section */}
      {/* Boosts Section */}
      
      {/* Payment Modal */}
      {selectedItem && (
        <PaymentModal 
          item={selectedItem} 
          onConfirm={handlePurchase} 
          onCancel={() => setSelectedItem(null)} 
        />
      )}
    </div>
  );
};
```

2. STRIPE INTEGRATION:

**Frontend (payment.service.ts):**
```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export const purchaseItem = async (itemId: string): Promise<boolean> => {
  try {
    // 1. Create payment intent
    const response = await fetch('/api/shop/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId })
    });
    const { client_secret } = await response.json();
    
    // 2. Confirm payment
    const stripe = await stripePromise;
    const { error, paymentIntent } = await stripe!.confirmCardPayment(client_secret);
    
    if (error) {
      throw new Error(error.message);
    }
    
    // 3. Payment successful, backend will grant items
    return true;
  } catch (error) {
    console.error('Purchase failed:', error);
    return false;
  }
};
```

**Backend (api/shop.py):**
```python
import stripe
from flask import request, jsonify

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Shop items catalog
SHOP_ITEMS = {
    'cash_starter': {
        'name': 'Starter Pack',
        'price': 499,  # In cents ($4.99)
        'type': 'cash',
        'value': 10000,
        'bonus': 0
    },
    'cash_gang': {
        'name': 'Gang Pack',
        'price': 999,
        'type': 'cash',
        'value': 25000,
        'bonus': 0.05
    },
    # ... more items
}

@app.route('/api/shop/create-payment-intent', methods=['POST'])
@require_auth
def create_payment_intent():
    """
    Create Stripe payment intent for item purchase
    """
    user_id = g.current_user.id
    item_id = request.json.get('item_id')
    
    item = SHOP_ITEMS.get(item_id)
    if not item:
        return jsonify({'error': 'Invalid item'}), 400
    
    # Create Stripe payment intent
    intent = stripe.PaymentIntent.create(
        amount=item['price'],
        currency='usd',
        metadata={
            'user_id': str(user_id),
            'item_id': item_id,
            'item_type': item['type'],
            'item_value': item['value']
        }
    )
    
    return jsonify({'client_secret': intent.client_secret})

@app.route('/api/shop/webhook', methods=['POST'])
def stripe_webhook():
    """
    Stripe webhook to confirm payment and grant items
    """
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        return jsonify({'error': 'Invalid payload'}), 400
    
    # Handle successful payment
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        
        # Extract metadata
        user_id = payment_intent['metadata']['user_id']
        item_id = payment_intent['metadata']['item_id']
        item_type = payment_intent['metadata']['item_type']
        item_value = int(payment_intent['metadata']['item_value'])
        
        # Grant items to user
        if item_type == 'cash':
            user = User.query.get(user_id)
            user.cash += item_value
            db.session.commit()
        elif item_type == 'weapon':
            # Add weapon to inventory
            pass
        elif item_type == 'slot':
            user = User.query.get(user_id)
            user.gang_capacity += item_value
            db.session.commit()
        elif item_type == 'boost':
            # Apply boost
            pass
        
        # Log transaction
        transaction = Transaction(
            user_id=user_id,
            type='purchase',
            amount=payment_intent['amount'] / 100,  # Convert cents to dollars
            item_id=item_id,
            payment_intent_id=payment_intent['id'],
            timestamp=datetime.utcnow()
        )
        db.session.add(transaction)
        db.session.commit()
        
        # Emit WebSocket event to update user UI
        socketio.emit('purchase_complete', {
            'item_id': item_id,
            'new_balance': user.cash
        }, room=user_id)
    
    return jsonify({'status': 'success'})
```

3. DATABASE MODEL:
```python
class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(UUID, primary_key=True)
    user_id = db.Column(UUID, db.ForeignKey('users.id'), nullable=False)
    
    # Transaction details
    type = db.Column(db.String(50))  # purchase, income, combat_reward, etc.
    amount = db.Column(db.Float)  # USD amount (for purchases)
    item_id = db.Column(db.String(100))  # Shop item ID
    
    # Stripe data
    payment_intent_id = db.Column(db.String(255))
    stripe_customer_id = db.Column(db.String(255))
    
    # Metadata
    metadata = db.Column(db.JSON)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class User(db.Model):
    # ... existing fields
    
    # In-game economy
    cash = db.Column(db.BigInteger, default=10000)  # Starting cash
    gang_capacity = db.Column(db.Integer, default=5)  # Max gang members
    
    # Premium status
    active_boosts = db.Column(db.JSON, default={})  # {boost_type: expiry_timestamp}
```

4. RECEIPT GENERATION:
```python
def send_purchase_receipt(user_id: str, transaction: Transaction):
    """Send email receipt to user"""
    user = User.query.get(user_id)
    
    # Email template
    subject = f"DEALT/SLIDE - Purchase Receipt #{transaction.id}"
    body = f"""
    Thank you for your purchase!
    
    Item: {transaction.item_id}
    Amount: ${transaction.amount}
    Date: {transaction.timestamp}
    
    Transaction ID: {transaction.payment_intent_id}
    
    Play now: https://dealt-slide.com
    """
    
    # Send via email service (SendGrid, AWS SES, etc.)
    pass
```

5. SECURITY MEASURES:
   - Validate payment on backend (never trust frontend)
   - Use Stripe webhooks (not frontend confirmation)
   - Log all transactions
   - Rate limiting on purchase endpoints
   - Fraud detection (flag suspicious patterns)

6. ANALYTICS TRACKING:
```typescript
// Track purchase events
export const trackPurchase = (item: ShopItem) => {
  // Google Analytics
  gtag('event', 'purchase', {
    transaction_id: item.id,
    value: item.price,
    currency: 'USD',
    items: [{
      item_id: item.id,
      item_name: item.name,
      item_category: item.type,
      price: item.price
    }]
  });
  
  // Mixpanel
  mixpanel.track('Purchase', {
    item_id: item.id,
    item_name: item.name,
    price: item.price,
    currency: 'USD'
  });
};
```

DELIVERABLES:
1. components/shop/ShopScreen.tsx (main UI)
2. components/shop/ProductCard.tsx (item display)
3. components/shop/PaymentModal.tsx (Stripe checkout)
4. services/payment.service.ts (frontend API)
5. api/shop.py (backend routes + webhook)
6. Updated Transaction & User models
7. Receipt email template
8. Stripe webhook testing guide

Please include:
- Full Stripe integration
- Error handling
- Loading states
- Success/failure notifications
- Receipt generation
- Analytics tracking
```

---

## 🎯 NEXT STEPS - IMMEDIATE ACTIONS

1. **Set up repository** using the structure above
2. **Start with Sprint 1** (foundation)
3. **Use AI prompts** above to generate code for each component
4. **Test integrations** (Mapbox, Banana Nano, Stripe) with sandbox accounts
5. **Deploy to staging** (Vercel/Netlify for frontend, Railway/Render for backend)
6. **Invite beta testers** (friends, Discord community)

---

## 📞 SUPPORT RESOURCES

- Mapbox Documentation: https://docs.mapbox.com/
- Banana Nano API: https://www.banana.dev/
- Stripe Integration: https://stripe.com/docs/payments
- Cloudinary: https://cloudinary.com/documentation
- Phaser 3: https://phaser.io/tutorials

---

**ESTIMATED MVP TIMELINE: 4-6 weeks**  
**ESTIMATED COST (Pre-Revenue): $500-800/month**  
**REVENUE POTENTIAL: $5-10 per paying user per month**
