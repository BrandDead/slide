# DEEPSEEK 671B MASTER PROMPT
## Project: DEALT/SLIDE - Urban Warfare RPG Hub & Combat System

---

## 0. YOUR ROLE & EXPECTATIONS

You are acting as:
- **Senior Frontend Architect** (Hub UI/UX redesign)
- **Game Systems Engineer** (Combat mechanics)
- **Creative Director** (Visual design language)

### Your Mandate
Design and implement production-ready code for two critical systems. You have explicit permission to:
- Expand scope if it meaningfully enhances user experience or backend efficiency
- Propose additional features, animations, or systems
- Optimize architecture beyond what's specified
- Add "juice" (visual polish, micro-interactions, haptic feedback patterns)

### Quality Bar
- Production-grade TypeScript/React code
- Mobile-first, responsive design
- Accessibility considerations
- Performance-optimized (60fps animations)
- Dark theme aesthetic (neon noir)

---

## 1. GAME CONTEXT (CRITICAL - READ FULLY)

### What is DEALT/SLIDE?
An 18+ multiplayer urban warfare RPG where players:
- Claim **real-world city blocks** as territory
- Build gangs with unique members (generated from friend selfies)
- Deal drugs via Tinder-style swipe mechanics (DEALT mode)
- Engage in Battleship-style tactical combat (SLIDE mode)
- Perform drive-by shootings (FPS from passenger perspective)
- Craft drugs in Little Alchemy-style lab

### Core Fantasy
"I own my actual block. My friends are my gang. Every drive-by feels unpredictable and dangerous."

### Visual Identity: NEON NOIR
```
Primary: Deep blacks (#0a0a0f, #12121a)
Accent 1: Electric cyan (#00f0ff)
Accent 2: Warning red (#ff2d55)
Accent 3: Cash green (#00ff88)
Accent 4: Purple haze (#9d4edd)
Typography: Sharp, condensed sans-serif (Rajdhani, Orbitron, or similar)
Aesthetic: iOS-style glass morphism meets GTA loading screens
```

### Regional Gang Styles (6 US Cities)
Each city has distinct visual identity affecting UI accents:

| City | Gang Style | Color Accent | Visual Motifs |
|------|------------|--------------|---------------|
| NYC | Organized crime, luxury flex | Gold/Black | Timbs, Yankees caps, designer |
| LA | Bloods/Crips aesthetic | Red/Blue | Lowriders, palm trees, bandanas |
| Miami | Cuban links, tropical vice | Pink/Teal | Speedboats, pastel suits, cocaine white |
| Chicago | Drill culture, winter gear | Black/Red | Ski masks, Glock switches, snow |
| Detroit | Industrial decay, survival | Steel gray/Orange | Abandoned factories, muscle cars |
| New Orleans | Voodoo mysticism, brass | Purple/Gold | Masks, gators, cemetery gates |

---

## 2. DELIVERABLE #1: HUB UI REDESIGN

### Current Problem
The hub interface (main navigation shell) looks "bad" - generic, lacks personality, doesn't feel like a street game. The asset generator and gang member displays are particularly weak.

### What the Hub Contains
```
┌─────────────────────────────────────────────────────┐
│  STATUS BAR (cash, heat, notifications)             │
├─────────────────────────────────────────────────────┤
│                                                     │
│           MAIN CONTENT AREA                         │
│     (switches between game modes)                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  DOCK (app icons for different modes)               │
│  [Map] [Dealt] [Slide] [Lab] [Gang] [Casino]       │
└─────────────────────────────────────────────────────┘
```

### Hub Screens to Design

#### A. GANG ROSTER (Gang Member Display)
Shows all gang members with their stats. Must feel like flipping through mugshots or a police evidence board.

**Required Elements per Member:**
- Portrait (generated from selfie upload)
- Name + Street name (alias)
- Role icon (Dealer 💊, Shooter 🔫, Driver 🚗, Chemist 🧪)
- Loyalty meter (0-100%)
- Heat level (personal wanted level)
- Skills (accuracy, nerve, charisma)
- Status (Active, Injured, Locked Up, Dead)
- Equipment slots (weapon, accessory)

**Interaction Patterns:**
- Tap card → expand to full profile
- Long press → quick actions menu (assign, equip, dismiss)
- Swipe left → fire/betray member
- Swipe right → promote/give bonus

**Visual Inspiration:**
```
Think: Police evidence board meets Pokémon card collection meets GTA character wheel
NOT: Generic card grid, boring list view, corporate dashboard
```

#### B. ASSET GENERATOR DISPLAY
Shows player's inventory: drugs, weapons, vehicles, cash.

**Inventory Categories:**
```typescript
interface Inventory {
  drugs: Drug[];        // Craftable, sellable
  weapons: Weapon[];    // Equippable to members
  vehicles: Vehicle[];  // For drive-bys, escape
  cash: {
    pocket: number;     // On-hand (losable)
    stash: number;      // Safe at base
    shoebox: number;    // Hidden (untaxed)
  };
  contraband: Item[];   // Special items
}
```

**Drug Display Requirements:**
- Visual representation (pill, powder, plant icons)
- Purity percentage (affects price)
- Quantity
- Street value estimate
- Heat risk indicator

**Weapon Display Requirements:**
- Weapon sprite/icon
- Caliber + damage stats
- Accuracy modifier
- Ammo count
- Condition (new, worn, jammed)
- Currently equipped by: [member name]

#### C. BLOCK OVERVIEW (Territory Dashboard)
Shows claimed blocks with income/status.

**Per-Block Card:**
- Address (real location)
- Satellite thumbnail
- Current income/hour
- Heat level
- Deployed units (dealers, shooters)
- Threat indicator (nearby enemy activity)
- Last raid timestamp

#### D. NOTIFICATIONS CENTER
In-game events feed - attacks, sales, arrests, etc.

**Event Types:**
```typescript
type NotificationType = 
  | 'sale_complete'      // Drug sold ✅
  | 'sale_failed'        // Buyer was cop 🚔
  | 'attack_incoming'    // Someone sliding on you ⚔️
  | 'member_arrested'    // Gang member caught 🔒
  | 'member_killed'      // Gang member dead 💀
  | 'turf_claimed'       // New block owned 🏴
  | 'turf_lost'          // Block taken 🏳️
  | 'heat_warning'       // Heat getting high 🔥
  | 'raid_incoming'      // Police raid imminent 🚨
  | 'income_collected';  // Passive income 💰
```

### Hub UI Technical Requirements

```typescript
// Tech Stack
- React 18 + TypeScript
- Zustand for state management
- Framer Motion for animations
- Tailwind CSS for styling
- Radix UI primitives for accessibility

// File Structure Expected
frontend/src/components/hub/
├── HubShell.tsx           // Main container with dock
├── StatusBar.tsx          // Top bar (cash, heat, notifs)
├── NavigationDock.tsx     // Bottom app icons
├── screens/
│   ├── GangRoster.tsx
│   ├── MemberCard.tsx
│   ├── MemberProfile.tsx
│   ├── InventoryScreen.tsx
│   ├── DrugCard.tsx
│   ├── WeaponCard.tsx
│   ├── BlockOverview.tsx
│   ├── BlockCard.tsx
│   └── NotificationFeed.tsx
├── shared/
│   ├── GlassPanel.tsx     // Reusable glass morphism container
│   ├── NeonText.tsx       // Glowing text effect
│   ├── StatMeter.tsx      // Animated stat bars
│   └── HeatIndicator.tsx  // Visual heat level
└── animations/
    └── transitions.ts     // Shared motion configs
```

### Animation & Polish Requirements

**Must Have:**
- Page transitions (slide, fade, scale based on navigation direction)
- Card hover states (subtle lift, glow)
- Stat changes animate (numbers count up/down)
- Loading skeletons (not spinners)
- Pull-to-refresh on mobile
- Haptic feedback patterns (define them even if not implemented)

**Nice to Have (implement if time):**
- Parallax depth on card grids
- Ambient particle effects (smoke, rain based on city)
- Sound design hooks (click, swoosh, alert)
- Easter eggs (Konami code, shake gesture)

---

## 3. DELIVERABLE #2: COMBAT RESOLVER ENHANCEMENT

### Current Problem
Combat feels too deterministic - like Battleship math instead of War Thunder chaos. We need probabilistic, environmental, emergent outcomes.

### Combat Philosophy
```
❌ WRONG: "You hit. 25 damage."
✅ RIGHT: "Shot grazed his shoulder. He's returning fire from behind a dumpster. Your driver panicked and accelerated."
```

### Combat Modes

#### A. SLIDE MODE (Tactical Grid Combat)
Battleship-style where you attack enemy blocks.

**Grid Structure:**
```
Block = 8x8 grid (scalable)
├── Top Sidewalk (rows 0-1)
├── Street (rows 2-5)
└── Bottom Sidewalk (rows 6-7)
```

**Unit Placement:**
- Defenders place Shooters + Dealers on their block
- Attackers send Car with Shooters inside
- Combat resolves as car drives down street

#### B. DRIVE-BY MODE (FPS/Action)
First-person from passenger seat. Less relevant to this prompt but combat resolver affects both.

### Combat Resolver Requirements

**Input Variables (must all affect outcome):**

```typescript
interface CombatInput {
  // Attacker Stats
  attacker: {
    shooter: GangMember;
    weapon: Weapon;
    position: 'driver' | 'passenger_front' | 'passenger_back_left' | 'passenger_back_right';
    nerveState: number;  // Affected by chaos, drugs, experience
  };
  
  // Defender Stats
  defender: {
    shooter: GangMember;
    weapon: Weapon;
    tile: GridTile;
    alertLevel: 'unaware' | 'alerted' | 'engaged';
  };
  
  // Environmental
  environment: {
    tile: {
      cover: number;         // 0.0-1.0 (dumpster, car, wall)
      visibility: number;    // 0.0-1.0 (streetlight, fog, time)
      distance: number;      // Tiles from street
    };
    weather: 'clear' | 'rain' | 'fog' | 'snow';
    timeOfDay: 'day' | 'dusk' | 'night';
    carSpeed: 'slow' | 'normal' | 'fast' | 'fleeing';
  };
  
  // Chaos Factors
  chaos: {
    heatLevel: number;       // Higher = more police attention
    recentCasualties: number;// Bodies drop, people panic
    returnFireCount: number; // How many shots exchanged
  };
}
```

**Output Structure:**

```typescript
interface CombatResult {
  outcome: 'miss' | 'graze' | 'wound' | 'critical' | 'fatal' | 'collateral';
  damage: number;
  
  // Detailed breakdown (for replay/narrative)
  narrative: string;  // "Shot went wide, hit a parked car"
  
  // State changes
  effects: {
    targetHealth?: number;
    attackerNerve?: number;  // Can decrease from stress
    heatIncrease: number;
    civilianPanic?: boolean;
    carDamage?: number;
    ammoConsumed: number;
  };
  
  // Counter-attack opportunity
  counterAttack?: {
    eligible: boolean;
    probability: number;
    tracedPosition: boolean;  // Did defender spot shooter?
  };
  
  // Chain reactions
  triggers?: {
    policeAlert?: boolean;
    civilianWitness?: boolean;
    alarmTriggered?: boolean;
    reinforcementsIncoming?: boolean;
  };
}
```

### Probability Formulas (Starting Point - Improve These)

```typescript
// Base hit probability
const baseHit = 
  shooter.accuracy * 
  weapon.accuracy * 
  (1 - distance * 0.05) *
  tile.visibility *
  (1 - tile.cover) *
  speedModifier[carSpeed] *
  nerveModifier(shooter.nerveState);

// Modifiers to apply
const speedModifiers = {
  slow: 1.0,
  normal: 0.85,
  fast: 0.65,
  fleeing: 0.4
};

const weatherModifiers = {
  clear: 1.0,
  rain: 0.85,
  fog: 0.7,
  snow: 0.75
};

const timeModifiers = {
  day: 1.0,
  dusk: 0.9,
  night: 0.7  // Unless night vision
};

// Chaos escalation
const chaosMultiplier = 1 + (chaos.recentCasualties * 0.1) + (chaos.returnFireCount * 0.05);

// Final calculation
const finalHitChance = clamp(baseHit * weatherMod * timeMod / chaosMultiplier, 0.05, 0.95);
```

### Damage Calculation

```typescript
interface DamageResult {
  type: 'miss' | 'graze' | 'wound' | 'critical' | 'fatal';
  damage: number;
  location?: 'head' | 'torso' | 'arm' | 'leg';
  bleedout?: boolean;
}

// Damage roll after hit confirmed
function calculateDamage(weapon: Weapon, defender: GangMember, roll: number): DamageResult {
  const baseDamage = weapon.damage;
  const armor = defender.equipment?.vest?.rating || 0;
  const penetration = weapon.penetration;
  
  // Armor check
  const armorEffective = armor > penetration ? (armor - penetration) * 0.5 : 0;
  const netDamage = baseDamage - armorEffective;
  
  // Location roll
  const location = rollLocation(); // Weighted toward torso
  const locationMultiplier = {
    head: 2.5,
    torso: 1.0,
    arm: 0.6,
    leg: 0.7
  };
  
  const finalDamage = netDamage * locationMultiplier[location];
  
  // Determine severity
  if (roll < 0.1) return { type: 'graze', damage: finalDamage * 0.25, location };
  if (roll < 0.5) return { type: 'wound', damage: finalDamage, location };
  if (roll < 0.85) return { type: 'critical', damage: finalDamage * 1.5, location, bleedout: true };
  return { type: 'fatal', damage: finalDamage * 2, location };
}
```

### Counter-Attack System

```typescript
interface CounterAttackCheck {
  canCounter: boolean;
  probability: number;
  delay: 'immediate' | 'delayed';
}

function checkCounterAttack(
  defender: GangMember,
  attacker: CombatInput['attacker'],
  wasHit: boolean
): CounterAttackCheck {
  // Can't counter if dead or fleeing
  if (defender.health <= 0 || defender.status === 'fleeing') {
    return { canCounter: false, probability: 0, delay: 'immediate' };
  }
  
  // Spotted shooter?
  const spotChance = defender.perception * (wasHit ? 1.2 : 0.8);
  const spotted = Math.random() < spotChance;
  
  if (!spotted) {
    return { canCounter: false, probability: 0, delay: 'immediate' };
  }
  
  // Counter probability based on training + nerve
  const counterProb = 
    defender.accuracy * 
    defender.nerve * 
    (defender.alertLevel === 'engaged' ? 1.2 : 0.8);
  
  return {
    canCounter: true,
    probability: clamp(counterProb, 0.1, 0.8),
    delay: defender.alertLevel === 'engaged' ? 'immediate' : 'delayed'
  };
}
```

### Heat System Integration

```typescript
interface HeatChange {
  immediate: number;   // Added right now
  lingering: number;   // Decays over time
  triggers: string[];  // What caused it
}

function calculateHeatChange(combat: CombatResult): HeatChange {
  let heat = 0;
  const triggers: string[] = [];
  
  // Shots fired
  heat += 5;
  triggers.push('shots_fired');
  
  // Casualties
  if (combat.outcome === 'wound') { heat += 15; triggers.push('injury'); }
  if (combat.outcome === 'critical') { heat += 25; triggers.push('serious_injury'); }
  if (combat.outcome === 'fatal') { heat += 50; triggers.push('homicide'); }
  
  // Witnesses
  if (combat.triggers?.civilianWitness) { heat += 20; triggers.push('witness'); }
  
  // Time of day (more witnesses during day)
  const timeMult = combat.environment.timeOfDay === 'day' ? 1.5 : 0.8;
  
  return {
    immediate: Math.round(heat * timeMult),
    lingering: Math.round(heat * timeMult * 0.3),
    triggers
  };
}
```

### Combat Resolver Technical Requirements

```typescript
// File Structure Expected
frontend/src/game-engines/combat/
├── CombatResolver.ts      // Main resolver class
├── ProbabilityEngine.ts   // All probability calculations
├── DamageCalculator.ts    // Damage formulas
├── CounterAttackSystem.ts // Return fire logic
├── HeatIntegration.ts     // Heat system hooks
├── NarrativeGenerator.ts  // Generates combat descriptions
├── types.ts               // All combat types
└── constants.ts           // Tuning values (easy to adjust)

// Backend Mirror (Python)
backend/src/services/combat/
├── resolver.py
├── probability.py
├── damage.py
├── counter_attack.py
├── heat.py
└── narrative.py
```

### Backend Combat API

```python
# POST /api/combat/resolve
{
  "attacker_id": "uuid",
  "defender_id": "uuid",
  "block_id": "uuid",
  "target_tile": {"x": 3, "y": 5},
  "weapon_id": "uuid"
}

# Response
{
  "success": true,
  "result": {
    "outcome": "wound",
    "damage": 35,
    "narrative": "9mm round caught him in the shoulder. He's down but returning fire.",
    "attacker_state": {...},
    "defender_state": {...},
    "heat_change": 25,
    "counter_attack": {
      "occurred": true,
      "result": {...}
    }
  }
}
```

---

## 4. DATA MODELS (EXISTING - EXTEND AS NEEDED)

### Gang Member

```typescript
interface GangMember {
  id: string;
  name: string;
  streetName: string;
  
  // Generated from selfie
  portrait: string;  // URL to generated image
  originalSelfie?: string;  // Original upload (private)
  
  // Core Stats (1-100)
  stats: {
    accuracy: number;    // Shooting skill
    nerve: number;       // Stays calm under fire
    loyalty: number;     // Won't snitch
    charisma: number;    // Better deals, recruitment
    perception: number;  // Spots threats
    driving: number;     // Getaway skill
  };
  
  // Role
  role: 'dealer' | 'shooter' | 'driver' | 'chemist' | 'enforcer';
  
  // Status
  status: 'active' | 'injured' | 'locked_up' | 'dead' | 'hiding';
  health: number;
  heat: number;  // Personal wanted level
  
  // Equipment
  weapon?: Weapon;
  vest?: Armor;
  accessory?: Item;
  
  // History
  kills: number;
  arrests: number;
  earnings: number;
  
  // Morale
  morale: number;  // Affects performance
  lastPaid: Date;
  
  // Assignment
  assignedBlock?: string;  // Block ID
  assignedRole?: 'guard' | 'patrol' | 'deal' | 'cook';
}
```

### Weapon

```typescript
interface Weapon {
  id: string;
  name: string;
  type: 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'melee';
  
  stats: {
    damage: number;       // Base damage
    accuracy: number;     // 0.0-1.0
    penetration: number;  // Armor pierce
    firerate: number;     // Shots per turn
    range: number;        // Effective tiles
    noise: number;        // Heat generation
  };
  
  ammo: {
    current: number;
    max: number;
    type: string;
  };
  
  condition: number;  // Degrades, can jam
  
  // Visuals
  sprite: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}
```

### Drug

```typescript
interface Drug {
  id: string;
  name: string;
  type: 'weed' | 'cocaine' | 'heroin' | 'meth' | 'pills' | 'psychedelics' | 'custom';
  
  // Quality
  purity: number;  // 0-100%
  quantity: number;
  
  // Economics
  basePricePerUnit: number;
  streetValue: number;  // Calculated from purity + demand
  
  // Risk
  heatRisk: number;  // How hot this product is
  
  // Crafting
  recipe?: string[];  // Ingredients used
  craftedBy?: string; // Member ID
}
```

### Block

```typescript
interface Block {
  id: string;
  
  // Real Location
  address: string;
  city: 'nyc' | 'la' | 'miami' | 'chicago' | 'detroit' | 'nola';
  lat: number;
  lng: number;
  
  // Generated Data
  gridSize: { width: number; height: number };
  tiles: GridTile[][];
  thumbnail: string;  // Satellite image
  
  // Economy
  trafficScore: number;     // Foot traffic = more customers
  incomePerHour: number;
  lastCollection: Date;
  
  // Defense
  deployedUnits: string[];  // Member IDs
  fortifications: string[]; // Barriers, cameras, etc.
  
  // Status
  owner: string;            // User ID
  heat: number;
  lastRaid?: Date;
  
  // Metadata
  claimedAt: Date;
  totalEarnings: number;
  timesDefended: number;
  timesLost: number;
}

interface GridTile {
  x: number;
  y: number;
  type: 'sidewalk' | 'street' | 'building' | 'alley';
  cover: number;       // 0.0-1.0
  visibility: number;  // 0.0-1.0
  occupied?: string;   // Unit ID
  features: string[];  // 'dumpster', 'car', 'streetlight', etc.
}
```

---

## 5. EXISTING TECH STACK (MUST USE)

### Frontend
```json
{
  "react": "^18.2.0",
  "typescript": "^5.0.0",
  "zustand": "^4.4.0",
  "framer-motion": "^10.0.0",
  "tailwindcss": "^3.4.0",
  "@radix-ui/react-*": "latest",
  "mapbox-gl": "^3.0.0",
  "phaser": "^3.70.0",
  "socket.io-client": "^4.6.0"
}
```

### Backend
```
Flask 3.0+
PostgreSQL 15+ (with PostGIS)
Redis 7+
Celery (background tasks)
Socket.IO (real-time)
SQLAlchemy (ORM)
```

### State Management Pattern

```typescript
// Zustand store pattern
interface GameStore {
  // State
  player: Player;
  gang: GangMember[];
  blocks: Block[];
  inventory: Inventory;
  
  // Actions
  updateMember: (id: string, updates: Partial<GangMember>) => void;
  addBlock: (block: Block) => void;
  resolveCombat: (input: CombatInput) => Promise<CombatResult>;
  
  // Computed (use selectors)
  getTotalIncome: () => number;
  getActiveMembers: () => GangMember[];
}
```

---

## 6. WHAT TO DELIVER

### Deliverable Checklist

**Hub UI (React/TypeScript):**
- [ ] `HubShell.tsx` - Main container with navigation
- [ ] `StatusBar.tsx` - Cash, heat, notifications badge
- [ ] `NavigationDock.tsx` - iOS-style bottom dock
- [ ] `GangRoster.tsx` - Grid/list of members
- [ ] `MemberCard.tsx` - Individual member card
- [ ] `MemberProfile.tsx` - Full member detail view
- [ ] `InventoryScreen.tsx` - Drug/weapon/vehicle inventory
- [ ] `DrugCard.tsx` - Drug item display
- [ ] `WeaponCard.tsx` - Weapon item display
- [ ] `BlockOverview.tsx` - Territory dashboard
- [ ] `BlockCard.tsx` - Individual block card
- [ ] `NotificationFeed.tsx` - Event notifications
- [ ] Shared components (GlassPanel, NeonText, StatMeter, etc.)
- [ ] Animation configs
- [ ] Full TypeScript types

**Combat Resolver (TypeScript + Python):**
- [ ] `CombatResolver.ts` - Main resolver
- [ ] `ProbabilityEngine.ts` - Probability calculations
- [ ] `DamageCalculator.ts` - Damage system
- [ ] `CounterAttackSystem.ts` - Return fire
- [ ] `NarrativeGenerator.ts` - Combat descriptions
- [ ] `types.ts` - Combat types
- [ ] `constants.ts` - Tuning values
- [ ] Python mirror of all above

**Bonus (if time):**
- [ ] Sound effect hooks
- [ ] Haptic feedback patterns
- [ ] Particle effect configs
- [ ] Combat replay system

---

## 7. QUALITY REQUIREMENTS

### Code Quality
- TypeScript strict mode
- No `any` types
- Proper error handling
- Comments on complex logic
- Consistent naming conventions

### Performance
- React.memo on list items
- Virtualized lists for large collections
- Debounced inputs
- Optimistic UI updates
- Skeleton loading states

### Accessibility
- Keyboard navigation
- Screen reader labels
- Color contrast compliance
- Focus indicators
- Reduced motion support

### Mobile First
- Touch-friendly hit targets (44px min)
- Swipe gestures where appropriate
- Responsive breakpoints
- Safe area insets (notch handling)

---

## 8. FREEDOM TO EXPAND

You are explicitly encouraged to:

1. **Add visual flourishes** - Particles, glows, screen shake, etc.
2. **Improve data structures** - If you see a better schema, propose it
3. **Add emergent behaviors** - Combat events that chain unexpectedly
4. **Create narrative variety** - Make combat descriptions feel unique
5. **Optimize performance** - Caching, memoization, lazy loading
6. **Add config systems** - Easy tuning for game balance
7. **Propose new features** - If it enhances the gritty street vibe

### Constraints
- Must work with existing tech stack
- Must maintain neon noir aesthetic
- Must feel like a street game, not corporate software
- Must support 6 US cities with regional flair

---

## 9. BEGIN IMPLEMENTATION

Start with:
1. Hub component architecture (file structure + skeleton components)
2. Core UI components (GlassPanel, NeonText, etc.)
3. GangRoster screen with MemberCard
4. Combat types and constants
5. CombatResolver core logic
6. Probability engine
7. Then iterate to completion

**Output all code files with clear file paths.**

**This is the foundation for a scalable, authentic street warfare game. Make it feel alive.**
