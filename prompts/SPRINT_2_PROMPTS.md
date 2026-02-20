# Sprint 2 Prompts: Core Game System Integrations

These prompts wire the existing utility engines (`heatSystem.ts`, `moraleSystem.ts`, `memberProgression.ts`) into the UI components so game mechanics actually function. Each prompt is self-contained with full codebase context.

---

## PROMPT 2A: Game Loop Engine — Central Tick System + Heat/Morale/Income Integration

### Context

You are building a React/TypeScript game called DEALT/SLIDE. The game has an iOS-style desktop where players tap app icons to play mini-games. The game uses **Zustand** for state management with persisted stores.

The game already has three utility engines that are fully written but **not connected** to anything:

1. **heatSystem.ts** — Manages heat level (0-100), raid probability, raid execution, undercover frequency
2. **moraleSystem.ts** — Manages gang morale (0-100), consequences like no-shows, friendly fire, desertion, betrayal, mutiny
3. **memberProgression.ts** — Manages member XP, leveling, stat boosts, ability unlocks, heat contribution from high-level members

Your task is to create a **GameLoopEngine** that runs on a timer and connects these systems to the Zustand stores, plus create an **incomeEngine** for passive block income.

### Existing Utility: heatSystem.ts (Key Exports)

```typescript
export interface HeatState {
  level: number;           // 0-100
  raidThreshold: number;
  decayRate: number;       // Points per hour of natural decay
  lastDecayTime: number;
  raidCooldown: number;    // Minimum time between raids (ms)
  lastRaidTime: number;
}

export interface RaidResult {
  occurred: boolean;
  severity: 'minor' | 'major' | 'federal';
  confiscatedDrugs: number;
  confiscatedWeapons: number;
  confiscatedMoney: number;
  arrestedMembers: string[];
  heatReduction: number;
  bailCosts: Map<string, number>;
}

export const HEAT_CONFIG = {
  MAX_HEAT: 100,
  BASE_DECAY_RATE: 2,        // Points per hour
  RAID_THRESHOLD_LOW: 40,
  RAID_THRESHOLD_MED: 65,
  RAID_THRESHOLD_HIGH: 85,
  RAID_COOLDOWN_MS: 30 * 60 * 1000,
  DEAL_HEAT: {
    regular: 3, fiend: 5, prep_kid: 2, celebrity: 0, undercover: 40,
    informant: 25, tourist: 4, homeless: 1, armed_buyer: 8, college_kid: 3,
  } as Record<string, number>,
  SUPER_DRUG_HEAT_MULT: 3.0,
  OD_HEAT_SPIKE: 25,
  COMBAT_HEAT_PER_TURN: 5,
  CIVILIAN_KILL_HEAT: 15,
};

export function calculateDecayedHeat(state: HeatState): number;
export function addHeat(state: HeatState, amount: number): HeatState;
export function getRaidProbability(heat: number): number;
export function rollForRaid(state: HeatState, rng?: () => number): boolean;
export function executeRaid(heat: number, memberIds: string[], drugQuantity: number, weaponCount: number, cashOnHand: number, rng?: () => number): RaidResult;
export function getUndercoverFrequency(heat: number): number;
export function createInitialHeatState(): HeatState;
```

### Existing Utility: moraleSystem.ts (Key Exports)

```typescript
export interface MoraleFactors {
  baseMorale: number;          // 0-100
  payOnTime: boolean;
  memberBailedOut: boolean;
  hospitalBillPaid: boolean;
  recentWins: number;
  recentLosses: number;
  memberDeaths: number;
  gangSize: number;
  playerReputation: number;
}

export interface MoraleConsequence {
  type: 'no_show' | 'friendly_fire' | 'desertion' | 'betrayal' | 'mutiny';
  probability: number;
  description: string;
  affectedMemberId?: string;
}

export const MORALE_CONFIG = {
  MAX_MORALE: 100, MIN_MORALE: 0,
  HIGH_MORALE: 75, NORMAL_MORALE: 50, LOW_MORALE: 30, CRITICAL_MORALE: 15,
  SALARY_PAID_BONUS: 5, SALARY_MISSED_PENALTY: -15,
  BAIL_PAID_BONUS: 10, BAIL_MISSED_PENALTY: -20,
  HOSPITAL_PAID_BONUS: 8, HOSPITAL_MISSED_PENALTY: -18,
  WIN_BONUS: 3, LOSS_PENALTY: -5, DEATH_PENALTY: -10,
  REPUTATION_FACTOR: 0.1,
};

export function calculateMorale(factors: MoraleFactors): number;
export function getMoraleConsequences(morale: number, memberId: string, rng?: () => number): MoraleConsequence[];
export function rollMoraleConsequences(consequences: MoraleConsequence[], rng?: () => number): MoraleConsequence[];
export function calculateBailImpact(gangSize: number, memberName: string): { moraleChange: number; message: string };
export function calculateHospitalImpact(gangSize: number, memberName: string): { moraleChange: number; message: string };
export function getMoraleDescription(morale: number): { label: string; color: string; warning: string | null };
```

### Existing Utility: memberProgression.ts (Key Exports)

```typescript
export interface MemberStats {
  shooting: number;    // 0-100
  dealing: number;     // 0-100
  nerve: number;       // 0-100
  hustle: number;      // 0-100
  stealth: number;     // 0-100
}

export interface MemberLevel {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
}

export const XP_CONFIG = {
  BASE_XP: 100, XP_MULTIPLIER: 1.5, MAX_LEVEL: 50,
  XP_PER_DEAL: 25, XP_PER_KILL: 50, XP_PER_SLIDE_WIN: 100,
  XP_PER_DRIVEBY_BLOCK: 75, XP_PER_MISSION: 150, XP_PER_CRAFT: 30,
  STAT_BOOST_PER_LEVEL: 2,
  HEAT_PER_LEVEL: 0.5, HEAT_THRESHOLD_LEVEL: 10,
};

export function addXp(currentLevel: MemberLevel, xpGained: number, role: string): { level: MemberLevel; levelUps: LevelUpResult[] };
export function getMemberHeatContribution(level: number): number;
export function getDealingEffectiveness(stats: MemberStats): { priceMultiplier: number; successRateBonus: number; bulkDealChance: number };
export function getShootingEffectiveness(stats: MemberStats): { accuracyBonus: number; damageMultiplier: number; critChance: number };
export function createInitialLevel(): MemberLevel;
```

### Existing Zustand Stores (Key Actions)

```typescript
// usePlayerStore
updateMoney: (amount: number) => void;
updateHeat: (amount: number) => void;
addXP: (amount: number) => void;
// player.money, player.heat, player.reputation, player.bankBalance

// useGangStore
members: GangMember[];  // Each has: id, name, role, level, health, status, inventory
updateMember: (id: string, updates: Partial<GangMember>) => void;
jailMember: (id: string) => void;
killMember: (id: string, cause: string) => void;
getActiveMembers: () => GangMember[];

// useTerritoryStore
blocks: Block[];  // Each has: id, units: BlockUnit[], heatLevel, incomeRate
// BlockUnit has: memberId, position: {row, col}, role

// useEconomyStore
inventory: InventoryItem[];  // {id, type, itemId, quantity}
removeInventoryItem: (itemId: string, quantity: number) => void;
addTransaction: (transaction: Transaction) => void;

// useNotificationStore
addNotification: (notification: {type, title, message, priority}) => void;
```

### What to Build

**File 1: `frontend/src/utils/incomeEngine.ts`**

Create an income engine that calculates passive income from blocks:
- Each block generates income based on: number of dealers placed, their position (closer to street = rows 6-7 = more money but more danger), drug quality equipped, member dealing stats
- Base income per dealer: $50/tick
- Street proximity bonus: row 7 = 2x, row 6 = 1.5x, row 5 = 1.2x, rows 0-4 = 1x
- Drug quality multiplier: based on purity (0-100 mapped to 0.5x-2.0x)
- Member dealing stat bonus: dealing/100 added as multiplier
- Export: `calculateBlockIncome(block, members, drugs)` and `calculateTotalIncome(blocks, members, drugs)`

**File 2: `frontend/src/utils/gameLoopEngine.ts`**

Create the central game loop that runs every 30 seconds (configurable) and:

1. **Heat Decay**: Calls `calculateDecayedHeat` and updates `player.heat` in the store
2. **Raid Check**: If heat > 40, calls `rollForRaid`. If raid triggers:
   - Calls `executeRaid` with current members, drugs, weapons, cash
   - Removes confiscated items from economy store
   - Jails arrested members via gang store
   - Sends notification with raid details and bail costs
   - Reduces heat by `heatReduction`
3. **Passive Income**: Calls `calculateTotalIncome` and adds money to player
4. **Member Heat Contribution**: For each member on a block, calls `getMemberHeatContribution` and adds to heat
5. **Morale Check**: Every 5 ticks, recalculates morale for the gang based on recent events
6. **Random Events**: 5% chance per tick of random events (rival gang sighting, police patrol, customer OD, etc.)

Export a React hook `useGameLoop()` that starts/stops the loop and returns current tick count and last event.

**File 3: `frontend/src/components/layout/GameEventOverlay.tsx` + CSS**

Create a full-screen overlay that appears when a raid or major event occurs:
- Raid overlay: Red flashing border, "🚨 RAID 🚨" title, shows severity, what was confiscated, who was arrested, bail costs for each member with "Pay Bail" / "Leave Them" buttons
- Event overlay: Shows random events with appropriate styling
- Auto-dismisses after 10 seconds or on tap
- Uses framer-motion for entrance/exit animations

### Integration Points

- Import `useGameLoop()` in `App.tsx` and call it at the top level
- The `GameEventOverlay` should render in `App.tsx` above the current app content
- When a raid occurs and player doesn't bail members, call `calculateBailImpact` and apply morale penalty to all members
- The heat meter on the OSShell home screen should pulse/glow when heat > 40 (add CSS class)
- Add a morale indicator next to heat on the home screen stats bar

### Output

Provide the complete code for all 3 files plus the modifications needed for `App.tsx` and `OSShell.tsx`.

---

## PROMPT 2B: Morale System UI — Visual Indicators + Consequence Popups

### Context

Same game as above. The morale system engine (`moraleSystem.ts`) is fully written but has no visual representation. Players need to SEE morale effects.

### What to Build

**Modify: `frontend/src/components/contacts/Contacts.tsx`**

The Contacts page currently shows gang member cards. Add:

1. **Morale Badge** on each member card: Shows the morale description label (Loyal/Steady/Uneasy/Hostile/Mutiny) with the corresponding color from `getMoraleDescription()`
2. **Deploy Warning**: When player taps "Send to Block" on a member with morale < 50, show a warning popup:
   - Lists possible consequences from `getMoraleConsequences()`
   - Each consequence shows type, probability, and description
   - "Send Anyway" / "Cancel" buttons
   - If they send anyway, roll consequences with `rollMoraleConsequences()` and show result
3. **Bail/Hospital Section**: When a member is jailed or wounded, show:
   - Bail cost or hospital bill amount
   - "Pay" button (deducts from player money)
   - "Leave Them" button (triggers `calculateBailImpact` or `calculateHospitalImpact`, applies morale penalty to ALL members)
   - Timer showing how long until member is permanently lost (jail for life after 3 arrests)

### Existing Contacts Component Structure

The Contacts component currently has:
- Header with "CREW" title and member count
- Filter tabs: All, Shooters, Dealers, Enforcers
- Member cards showing: avatar, name, nickname, role badge, level, status
- Detail modal when tapping a card: shows full stats, equipment, actions (Deploy, Equip, Train)

The existing `GangMember` type has these relevant fields:
```typescript
interface GangMember {
  id: string;
  name: string;
  nickname: string;
  role: 'dealer' | 'shooter' | 'enforcer' | 'driver';
  level: number;
  health: number;
  maxHealth: number;
  morale: number;        // 0-100
  status: 'active' | 'jailed' | 'hospital' | 'dead' | 'missing';
  arrestCount: number;   // 3 = life in prison
  inventory: InventoryItem[];
  stats: {
    shooting: number;
    dealing: number;
    nerve: number;
    hustle: number;
    stealth: number;
  };
}
```

### Output

Provide the modified `Contacts.tsx` with morale badges, deploy warnings, and bail/hospital UI. Include the CSS additions.

---

## PROMPT 2C: Member Progression UI — XP Bars, Level-Up Animations, Stat Screens

### Context

Same game. The `memberProgression.ts` engine handles XP, leveling, and stat boosts but has no UI representation.

### What to Build

**Modify: `frontend/src/components/contacts/Contacts.tsx`** (member detail modal)

Add to the member detail view:

1. **XP Progress Bar**: Shows current XP / XP to next level with a gradient fill bar
2. **Level Badge**: Large level number with a rank title (Lv1-10: Youngin, 11-20: Soldier, 21-30: Lieutenant, 31-40: Captain, 41-50: OG)
3. **Stat Radar Chart**: Pentagon/radar visualization of the 5 stats (shooting, dealing, nerve, hustle, stealth) using CSS or canvas
4. **Abilities List**: Shows unlocked abilities from milestone levels (from `getAbilityUnlock`)
5. **Heat Warning**: If member level >= 10, show warning: "High-profile member. Generates +X heat/hour on the block" using `getMemberHeatContribution()`

**New Component: `frontend/src/components/contacts/LevelUpPopup.tsx`**

When a member levels up (after completing a deal, combat, or mission), show a popup:
- Member name and new level
- Stat boosts gained (e.g., "+4 Shooting, +2 Nerve, +1 Stealth")
- If ability unlocked, show it prominently with description
- If heat increase, show warning
- Gold/yellow theme with particle effects (CSS animations)
- Auto-dismiss after 5 seconds

### Existing Member Stats Shape

```typescript
// From memberProgression.ts
export function addXp(
  currentLevel: MemberLevel,
  xpGained: number,
  role: 'dealer' | 'shooter' | 'enforcer' | 'driver' | 'chemist'
): { level: MemberLevel; levelUps: LevelUpResult[] };

// LevelUpResult
interface LevelUpResult {
  newLevel: number;
  statBoosts: Partial<MemberStats>;  // {shooting?, dealing?, nerve?, hustle?, stealth?}
  unlockedAbility?: string;
  heatIncrease: number;
}
```

### Output

Provide the modified member detail section of Contacts.tsx and the new LevelUpPopup.tsx + CSS.

---

## PROMPT 2D: Alchemy → Dealer Pipeline — Connect Cook Lab to Economy

### Context

Same game. The Cook Lab (Alchemy) lets players craft drugs by combining base ingredients. The crafted drugs currently just show in the Cook Lab results but **don't go anywhere**. They need to flow into the economy.

### Pipeline

```
Cook Lab (craft drug) → Economy Store (inventory) → Contacts (equip to dealer) → Territory Map (dealer sells on block) → Income Engine (calculates earnings)
```

### What to Build

**Modify: `frontend/src/components/alchemy/AlchemyLab.tsx`**

When a drug is successfully crafted:
1. Add it to the economy store's inventory via `addInventoryItem({ type: 'drug', itemId: drug.id, quantity: 1 })`
2. Show a "Stash Updated" toast notification
3. If the drug has OD risk > 50%, show a warning: "⚠️ This product is dangerous. Customers may OD, raising heat by +25"

**Modify: `frontend/src/components/contacts/Contacts.tsx`** (member detail)

Add an "Equip Product" section to dealer member cards:
1. Show list of drugs in player inventory (from economy store)
2. Tap a drug to equip it to the dealer
3. Equipped drug shows on the member card with stats (purity, potency, price, OD risk)
4. Dealers with better drugs generate more income but higher OD risk drugs can trigger heat spikes

**Modify: Income calculation**

When calculating block income, factor in the equipped drug's stats:
- `pricePerUnit * purityMultiplier * dealerDealingStat`
- If OD risk > 50%, there's a chance per tick that a customer ODs:
  - OD event: +25 heat, notification "Customer OD'd on [drug name]. Heat is rising."
  - If multiple ODs, heat stacks rapidly

### Existing Alchemy Types

```typescript
interface CraftedDrug {
  id: string;
  name: string;
  tier: number;           // 1-5
  category: 'stimulant' | 'depressant' | 'psychedelic' | 'opioid' | 'designer';
  purity: number;         // 0-100
  potency: number;        // 0-100
  odRisk: number;         // 0-100
  pricePerUnit: number;   // Dollar value
  addictionRate: number;  // 0-100
  ingredients: string[];
}
```

### Existing Economy Store

```typescript
// useEconomyStore
inventory: InventoryItem[];  // {id, type: 'drug'|'weapon'|'armor', itemId, quantity}
addInventoryItem: (item: InventoryItem) => void;
transferItemToMember: (itemId: string, memberId: string, quantity: number) => void;
```

### Output

Provide the modifications to AlchemyLab.tsx, Contacts.tsx, and any new utility code needed.

---

## PROMPT 2E: OSShell Dashboard — Live Stats, Heat Meter, Morale Indicator, Income Ticker

### Context

Same game. The OSShell home screen currently shows static stats (Cash, Heat, Rep, Level). These need to become live, animated, and connected to the game loop.

### What to Build

**Modify: `frontend/src/components/layout/OSShell.tsx`**

Replace the static stats bar with a live dashboard:

1. **Cash Display**: Animated counter that ticks up when income arrives. Green flash on increase, red flash on decrease.
2. **Heat Meter**: 
   - Progress bar that fills from green (0) → yellow (40) → orange (65) → red (85) → pulsing red (100)
   - When heat > 40, the bar pulses with a glow animation
   - Shows numeric value and raid probability percentage
   - Tap to see heat breakdown (sources, decay rate, time until next decay)
3. **Morale Indicator**:
   - New stat in the bar showing gang morale with emoji and color from `getMoraleDescription()`
   - Tap to see morale factors and warnings
4. **Income Ticker**:
   - Small "+$X/min" indicator below cash showing passive income rate
   - Calculated from `calculateTotalIncome()`
5. **Alert Badge on App Icons**:
   - Red badge on CREW icon if any member is jailed/hospital
   - Red badge on OPS icon if active mission
   - Yellow badge on COOK icon if new recipe discovered
   - Red badge on MAP icon if block is under attack

### Existing OSShell Structure

```typescript
// OSShell.tsx renders:
// - Status bar (time, gang name, notifications bell)
// - Title "DEALT/SLIDE" with subtitle
// - Stats row: Cash, Heat, Rep, Level
// - XP progress bar
// - 4x3 app icon grid
// - Bottom dock with 4 quick-access icons

// Uses:
const { player } = usePlayerStore();
const { navigateTo } = useNavigationStore();
```

### CSS Requirements

- Heat bar gradient: `linear-gradient(90deg, #00ff88 0%, #ffd700 40%, #ff8800 65%, #ff4444 85%, #ff0000 100%)`
- Pulse animation for high heat: `@keyframes heatPulse { 0% { box-shadow: 0 0 5px red; } 50% { box-shadow: 0 0 20px red; } 100% { box-shadow: 0 0 5px red; } }`
- Cash counter animation: CSS `transition: all 0.3s ease` on the number
- Income ticker: small green text, fades in/out

### Output

Provide the modified `OSShell.tsx` and `OSShell.css` with all live dashboard features.

---

## Summary of Sprint 2 Deliverables

| Prompt | Files Created/Modified | Purpose |
|--------|----------------------|---------|
| 2A | `incomeEngine.ts`, `gameLoopEngine.ts`, `GameEventOverlay.tsx` | Central tick system, raids, income |
| 2B | Modified `Contacts.tsx` | Morale badges, deploy warnings, bail UI |
| 2C | Modified `Contacts.tsx`, new `LevelUpPopup.tsx` | XP bars, level-up animations, stat screens |
| 2D | Modified `AlchemyLab.tsx`, `Contacts.tsx` | Drug crafting → dealer → income pipeline |
| 2E | Modified `OSShell.tsx`, `OSShell.css` | Live dashboard with heat, morale, income |

All prompts use the same Zustand stores and utility engines. The integration order matters:
1. Build 2A first (game loop + income engine) — everything else depends on it
2. Build 2E next (dashboard) — shows the loop is working
3. Build 2B and 2C in parallel (morale + progression UI)
4. Build 2D last (alchemy pipeline) — connects the crafting to the economy
