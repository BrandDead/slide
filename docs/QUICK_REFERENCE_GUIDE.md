# DEALT/SLIDE - Current Status & What's Next

## ✅ WHAT YOU HAVE (PLAYABLE)

### Game Modes
1. **DEALT** - Tinder-style drug dealing ✓
2. **SLIDE** - Battleship grid combat ✓
3. **Drive-By** - FPS vehicle shooting ✓
4. **Alchemy Lab** - Crafting system ✓

### Architecture
- Complete frontend structure planned
- Backend API architecture defined
- Database schema designed
- Scaling strategy documented (MVP → 10M+ users)

### Tech Stack
- Frontend: React + TypeScript + Phaser 3 + Zustand
- Backend: Python/Flask + PostgreSQL + Redis
- Real-time: Socket.IO/Flask-SocketIO
- Infrastructure: Docker, Kubernetes ready

---

## ❌ WHAT'S MISSING FOR MVP BETA

### 1. MAP INTEGRATION (HIGH PRIORITY - Revenue Blocker)
**Current State:** Configuration planned, not implemented  
**Needed:**
- Mapbox GL JS integration in MapView component
- Block claiming API endpoints
- Real-time territory updates via WebSocket
- Geocoding service (address lookup)

**Why Critical:** Territory control = core gameplay loop. Without this, users can't claim real-world blocks.

**AI Prompt:** Ready (see PROMPT 1 in main document)

---

### 2. GRID GENERATOR (HIGH PRIORITY - Gameplay Blocker)
**Current State:** Service structure defined, algorithm not implemented  
**Needed:**
- Satellite image → 10x10 tactical grid converter
- Mapbox Static Images API integration
- Image analysis (detect buildings, streets, open areas)
- Caching system to avoid re-generating blocks
- Fallback procedural generation

**Why Critical:** SLIDE combat requires grids. No grid = no combat on claimed territories.

**Technical Challenge:**
```
Input: Lat/Lng (e.g., 40.7128, -74.0060)
Output: 10x10 grid like:
[
  [0, 0, 1, 2, 0, 0, 0, 0, 0, 0],  # 0=open, 1=building, 2=street
  [0, 0, 1, 2, 0, 3, 3, 3, 0, 0],  # 3=alley, 4=park
  ...
]
```

**AI Prompt:** Ready (see PROMPT 2 in main document)

---

### 3. BANANA NANO API INTEGRATION (MEDIUM PRIORITY - Polish)
**Current State:** Service wrapper planned, not integrated  
**Needed:**
- API authentication setup
- Asset generation endpoints
- Caching system (avoid re-generating same assets)
- Frontend hook for on-demand generation
- Prompt engineering for consistent style

**Use Cases:**
- Gang member portraits (when recruiting)
- Weapon renders (hyper-realistic firearms)
- Environment backgrounds (Drive-By mode)
- UI elements (badges, icons)

**Style Guide:**
- Standard items: 100% hyper-realistic
- Super/legendary items: 80% realistic + 20% neon glow
- Character portraits: Urban street aesthetic

**AI Prompt:** Ready (see PROMPT 3 in main document)

---

### 4. USER PHOTO UPLOAD SYSTEM (MEDIUM PRIORITY - Unique Feature)
**Current State:** Not implemented  
**Needed:**
- Photo upload component (drag-and-drop)
- Image cropping tool (square aspect ratio)
- Cloudinary integration (CDN storage)
- Face detection for proper framing
- Optional: AI enhancement via Banana Nano
- NSFW content moderation

**Feature:** Users upload photos of friends → create custom gang members

**Technical Flow:**
```
1. User uploads photo
2. Crop to 512x512px square
3. Upload to Cloudinary
4. (Optional) Remove background
5. (Optional) AI enhance via Banana Nano
6. Store URL in database
7. Display as gang member portrait
```

**Security:** 18+ age verification, NSFW detection, rate limiting

**AI Prompt:** Ready (see PROMPT 4 in main document)

---

### 5. IN-APP PURCHASES (HIGH PRIORITY - Revenue)
**Current State:** Not implemented  
**Needed:**
- Shop UI (cash packages, weapons, gang slots, boosts)
- Stripe integration (payment processing)
- Backend webhook (confirm payments & grant items)
- Receipt generation
- Transaction logging

**Products:**
- Cash Packages: $4.99-$49.99
- Premium Weapons: $2.99-$14.99
- Gang Slots: $3.99-$19.99
- Territory Boosts: $0.99-$4.99

**Why Critical:** No IAP = no revenue during beta testing

**AI Prompt:** Ready (see PROMPT 5 in main document)

---

### 6. UI/UX POLISH (MEDIUM PRIORITY - User Experience)
**Current State:** iOS-style desktop planned, not fully designed  
**Needed:**
- App icon grid (each game mode = separate app)
- Smooth transitions between modes
- Loading states & animations
- Toast notifications
- Status bar (cash, heat, notifications)
- Haptic feedback (mobile)

**Design System:**
- iOS-inspired interface
- Neon noir aesthetics (#00ff00 green, #ff00ff pink accents)
- Glassmorphism effects
- Dark theme with high contrast

---

## 🗺️ MAP GENERATOR - TECHNICAL DETAILS

### What You Have:
- Mapbox API key setup planned
- Grid generation service structure
- PostGIS database support (geospatial queries)

### How Grid Generation Works:

**Step 1: Fetch Satellite Image**
```python
url = f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/"
url += f"{lng},{lat},16/600x600?access_token={MAPBOX_TOKEN}"
image = requests.get(url).content
```

**Step 2: Analyze Image**
```python
from PIL import Image
import numpy as np

img = Image.open(image_data)
pixels = np.array(img)

# Dark pixels = buildings (RGB < 100)
# Gray lines = streets (RGB 100-150)
# Green = parks (high G channel)
# White = open ground (RGB > 200)
```

**Step 3: Convert to 10x10 Grid**
```python
grid = np.zeros((10, 10), dtype=int)

for row in range(10):
    for col in range(10):
        # Sample pixels in this grid cell (60x60px each)
        cell_pixels = pixels[row*60:(row+1)*60, col*60:(col+1)*60]
        
        # Determine terrain type by majority pixel color
        if dark_pixels > 70%:
            grid[row][col] = 1  # Building
        elif gray_lines:
            grid[row][col] = 2  # Street
        # ... etc
```

**Step 4: Cache & Return**
```python
block = Block(
    lat=lat,
    lng=lng,
    grid=grid.tolist(),
    terrain_types={0: "open", 1: "building", 2: "street"},
    generated_at=datetime.utcnow()
)
db.session.add(block)
db.session.commit()
```

### Optimization:
- **Cache grids:** Only generate once per location
- **TTL:** 30 days (real-world terrain rarely changes)
- **Fallback:** If image analysis fails, use Perlin noise for procedural generation

---

## 🎨 GRAPHICS PIPELINE - BANANA NANO + USER PHOTOS

### Current Graphics Sources:
1. **Pre-made sprites** (stored in /public/assets/)
2. **AI-generated** (Banana Nano API) - NOT YET IMPLEMENTED
3. **User-uploaded photos** (Cloudinary) - NOT YET IMPLEMENTED

### Hybrid Approach:

**Standard Items (Hyper-Realistic):**
```
Glock 19 → Banana Nano:
"Professional product photography of Glock 19 pistol, 
studio lighting, black background, 8K resolution, extreme detail"
```

**Legendary Items (Futuristic):**
```
Golden AK-47 → Banana Nano:
"Professional product photography of AK-47, 
24k gold plating, neon green glow effects, 
studio lighting, black background, 8K resolution"
```

**Gang Member Portraits:**
```
Option A (AI-generated):
"Hyper-realistic portrait of Latino male, age 25-30, 
urban street style, dramatic lighting, 4K quality, 
front-facing, neutral expression"

Option B (User photo + AI enhancement):
Upload photo → Banana Nano:
"Portrait based on reference image, urban street style, 
cinematic lighting, maintain facial features exactly"
```

### Cost Optimization:
- **Cache everything:** Never generate same asset twice
- **Batch requests:** Generate multiple assets in one API call
- **Progressive loading:** Low-res preview → high-res on demand

---

## 📊 MVP FEATURE PRIORITY MATRIX

```
              ┌─────────────────────────────────────┐
              │  HIGH PRIORITY (Build First)       │
              ├─────────────────────────────────────┤
              │  ✓ Map Integration (Mapbox)        │
              │  ✓ Grid Generator                  │
              │  ✓ In-App Purchases (Stripe)       │
              │  ✓ Authentication (JWT)            │
              └─────────────────────────────────────┘
                            ↓
              ┌─────────────────────────────────────┐
              │  MEDIUM PRIORITY (Polish)          │
              ├─────────────────────────────────────┤
              │  ✓ Banana Nano Integration         │
              │  ✓ User Photo Upload               │
              │  ✓ UI/UX Refinement                │
              │  ✓ WebSocket Real-time Events      │
              └─────────────────────────────────────┘
                            ↓
              ┌─────────────────────────────────────┐
              │  LOW PRIORITY (Post-MVP)           │
              ├─────────────────────────────────────┤
              │  • Casino games (Blackjack, Craps) │
              │  • Advanced AI behavior            │
              │  • Leaderboards                    │
              │  • Social features (alliances)     │
              └─────────────────────────────────────┘
```

---

## 🚀 SPRINT BREAKDOWN (4 WEEKS TO BETA)

### WEEK 1: Infrastructure
- ✅ Repository setup
- ✅ Database schema
- ✅ Authentication system
- ✅ Basic frontend shell

### WEEK 2: Core Gameplay
- 🔨 Mapbox integration
- 🔨 Grid generator
- 🔨 Territory claiming API
- 🔨 SLIDE combat flow

### WEEK 3: Monetization + Polish
- 💰 Stripe integration
- 💰 Shop UI
- 🎨 Banana Nano integration
- 📸 User photo upload

### WEEK 4: Testing + Launch
- 🧪 Bug fixes
- 🧪 Load testing
- 📢 Beta invites
- 📊 Analytics setup

---

## 💡 QUICK WINS (Do These Now)

1. **Set up Mapbox account** → Get API key → Test Static Images API
2. **Set up Stripe account** → Create test products → Test webhook locally
3. **Set up Cloudinary account** → Create upload preset → Test photo upload
4. **Test Banana Nano API** → Generate sample character portrait → Verify quality

---

## 📞 EXTERNAL API ACCOUNTS NEEDED

| Service | Purpose | Cost | Status |
|---------|---------|------|--------|
| Mapbox | Territory map + satellite images | Free tier: 50k requests/month | ❌ Not set up |
| Banana Nano | AI image generation | ~$0.01-0.10 per image | ❌ Not set up |
| Cloudinary | User photo storage + transformations | Free tier: 25GB | ❌ Not set up |
| Stripe | Payment processing | 2.9% + $0.30 per transaction | ❌ Not set up |
| Supabase (or PostgreSQL) | Database | Free tier: 500MB | ❌ Not set up |
| Redis Cloud | Caching + WebSocket pub/sub | Free tier: 30MB | ❌ Not set up |

**Total Free Tier Coverage:** Enough for 100-500 beta users

---

## 🎯 DEFINITION OF "BETA READY"

✅ Users can:
1. Create accounts & log in
2. View real-world map with Mapbox
3. Claim territory blocks (costs in-game cash)
4. Attack other players' blocks (SLIDE combat)
5. Deal drugs (DEALT swipe mode)
6. Recruit gang members (with or without custom photos)
7. Purchase in-game currency & items (Stripe)

✅ System can:
1. Handle 100-500 concurrent users
2. Generate combat grids on-demand
3. Process payments securely
4. Send real-time updates via WebSocket

✅ Nice-to-haves (but not required for beta):
- AI-generated graphics (Banana Nano)
- User photo uploads (Cloudinary)
- Drive-By mode (can be post-beta)
- Alchemy Lab (can be post-beta)

---

## 📈 BETA SUCCESS METRICS

**Week 1 Goals:**
- 50 sign-ups
- 20 blocks claimed
- 10 combat sessions
- $0 revenue (test accounts)

**Week 2-4 Goals:**
- 200 sign-ups
- 100+ active users
- 500+ blocks claimed
- 200+ combat sessions
- $100-500 revenue (early adopters)

**Conversion Targets:**
- 20% of users claim at least 1 block
- 10% of users make at least 1 purchase
- Average revenue per paying user: $5-10

---

## 🔧 DEVELOPMENT TOOLS RECOMMENDED

- **VS Code** (with Pylance, ESLint, Prettier)
- **Postman** (API testing)
- **Redis Commander** (Redis GUI)
- **pgAdmin** (PostgreSQL GUI)
- **React DevTools** (state debugging)
- **Stripe CLI** (webhook testing)

---

**BOTTOM LINE:**  
You have 4 playable game modes and solid architecture.  
Missing: Map integration, grid generator, and monetization.  
Use the AI prompts to generate these components in 4 weeks.  
Beta launch possible by mid-March 2026.
