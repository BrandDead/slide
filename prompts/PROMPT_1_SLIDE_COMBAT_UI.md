# PROMPT 1: SLIDE Combat UI — Full Battleship-Style Grid Combat

**Recommended AI Model:** `deepseek-v3.1:671b-cloud`

**Estimated Complexity:** High (multiple interconnected components + Zustand store)

---

## TASK

Generate the complete React/TypeScript UI for the **SLIDE** combat mode — a Battleship-style grid combat system where an attacker in a car shoots at defenders on a block, and defenders shoot back at the car. The system uses a **dual-grid** architecture: an 8x8 **macro grid** (the block, where defenders place units) and a 16x16 **micro grid** (the car, where the attacker's vehicle occupies space).

---

## TECH STACK

- React 18 with functional components and hooks
- TypeScript (strict mode, no `any`)
- Zustand 4 for state management (with `devtools` middleware)
- Framer Motion for animations
- Tailwind CSS for styling (dark theme, glass morphism effects)
- Vite as the build tool

---

## EXISTING CODE YOU MUST USE

### 1. Dual Grid Types (`frontend/src/utils/dualGrid.ts`)

```typescript
export const MACRO_SIZE = 8 as const;
export const MICRO_SIZE = 16 as const;

export type MacroCoord = { x: number; y: number };
export type MicroCoord = { i: number; j: number };

export type MacroCell = {
  coord: MacroCoord;
  revealed: boolean;
  hit: boolean;
  occupantId?: string;
  occupantHp?: number;
};

export type MicroCell = {
  coord: MicroCoord;
  revealed: boolean;
  hit: boolean;
  vehicleId?: string;
  vehiclePart?: VehiclePart;
  partHp?: number;
};

export type VehiclePart = "hood" | "driver_seat" | "passenger_seat" | "rear_left" | "rear_right" | "trunk";

export type Vehicle = {
  id: string;
  origin: MicroCoord;
  facing: "N" | "S" | "E" | "W";
  seats: {
    driver: { alive: boolean };
    passenger: { alive: boolean };
    rearLeft: { alive: boolean };
    rearRight: { alive: boolean };
  };
  hpByPart: Record<VehiclePart, number>;
};

export function inBoundsMacro({ x, y }: MacroCoord): boolean;
export function inBoundsMicro({ i, j }: MicroCoord): boolean;
export function vehicleFootprint(vehicle: Vehicle): { cell: MicroCoord; part: VehiclePart }[];
export function canPlaceVehicle(vehicle: Vehicle, microGrid: MicroCell[][]): boolean;
export function stampVehicle(vehicle: Vehicle, microGrid: MicroCell[][]): void;
```

### 2. Attack Patterns (`frontend/src/utils/attackPatterns.ts`)

```typescript
export type MacroPattern = "single" | "burst3x3" | "line3";

export function patternTargets(center: MacroCoord, pattern: MacroPattern): MacroCoord[];
```

### 3. Turn Logic (`frontend/src/utils/turnLogic.ts`)

```typescript
export type DriveBySeat = "passenger" | "rearLeft" | "rearRight";

export type DriveByShot = {
  seat: DriveBySeat;
  target: MacroCoord;
  pattern: MacroPattern;
};

export function availableShooterSeats(vehicle: Vehicle): DriveBySeat[];
export function resolveDriveByTurn(macroGrid: MacroCell[][], shots: DriveByShot[], rng: () => number): { seat: string; hit: boolean; affected: MacroCoord[] }[];
export function resolveDefenseRetaliation(microGrid: MicroCell[][], vehicle: Vehicle, microShots: { targetI: number; targetJ: number }[]): { hit: boolean; part?: string }[];
```

### 4. Grid Factory (`frontend/src/utils/gridFactory.ts`)

```typescript
export function createMacroGrid(): MacroCell[][];
export function createMicroGrid(): MicroCell[][];
export function placeOccupant(grid: MacroCell[][], coord: MacroCoord, occupantId: string, hp?: number): boolean;
export function countAliveOccupants(grid: MacroCell[][]): number;
export type TerrainType = 'street' | 'building' | 'alley' | 'corner' | 'park' | 'lot';
export function generateRandomBlockLayout(seed?: number): TerrainType[][];
```

### 5. Slide Types (`frontend/src/types/slide.types.ts`)

```typescript
export type SlidePhase = 'setup' | 'attacker_turn' | 'defender_turn' | 'resolution' | 'finished';
export type SlideRole = 'attacker' | 'defender';
export type BlockUnitType = 'dealer' | 'shooter' | 'enforcer' | 'pitbull' | 'trap';

export interface BlockUnit {
  id: string;
  type: BlockUnitType;
  memberId: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  accuracy: number;
  position: MacroCoord;
  isAlive: boolean;
  canCounterAttack: boolean;
  streetProximity: number;
  incomeMultiplier: number;
}

export interface SlideGameState {
  id: string;
  blockId: string;
  attackerId: string;
  defenderId: string;
  phase: SlidePhase;
  currentTurn: number;
  maxTurns: number;
  defenderUnits: BlockUnit[];
  attackerVehicle: AttackerVehicle;
  turnHistory: TurnResult[];
  attackerScore: number;
  defenderScore: number;
  combatHeat: number;
  winner?: SlideRole;
  endReason?: 'all_units_dead' | 'vehicle_destroyed' | 'max_turns' | 'retreat';
}

export const PLACEMENT_RULES: Record<BlockUnitType, PlacementRule>;

export const STREET_PROXIMITY_TABLE: { incomeMultiplier: number; hitChance: number }[];
```

---

## FILES TO GENERATE

Generate the following 8 files. Each must be complete and ready to copy-paste:

1. **`frontend/src/stores/slideCombatStore.ts`** — Zustand store managing `SlideGameState`, with actions for `startCombat`, `placeUnit`, `confirmPlacement`, `selectTarget`, `fireShot`, `resolveTurn`, and `retreat`.

2. **`frontend/src/components/slide/SlideGame.tsx`** — Main container. Renders the correct sub-component based on `phase`. Shows a back button, combat info header, and the active grid.

3. **`frontend/src/components/slide/MacroGrid.tsx`** — 8x8 grid for the block. Props: `grid: MacroCell[][]`, `terrain: TerrainType[][]`, `units: BlockUnit[]`, `onCellClick: (coord: MacroCoord) => void`, `selectedTargets: MacroCoord[]`, `isInteractive: boolean`. Each cell shows terrain color, unit icon if occupied, and hit/miss markers.

4. **`frontend/src/components/slide/MicroGrid.tsx`** — 16x16 grid for the vehicle. Props: `grid: MicroCell[][]`, `vehicle: Vehicle`, `onCellClick: (coord: MicroCoord) => void`, `selectedTargets: MicroCoord[]`, `isInteractive: boolean`. Vehicle parts are colored by type. Damaged parts show red.

5. **`frontend/src/components/slide/UnitPlacement.tsx`** — Setup phase UI. Shows available units in a sidebar. User clicks a unit, then clicks a cell on the MacroGrid to place it. Enforces `PLACEMENT_RULES`. "Ready" button to confirm.

6. **`frontend/src/components/slide/CombatHUD.tsx`** — HUD overlay. Shows: current turn, phase, attacker vehicle HP summary, defender units alive count, heat generated, and a scrollable combat log.

7. **`frontend/src/components/slide/CombatActions.tsx`** — Action bar at the bottom. For attacker: pattern selector (single/burst/line) + "Fire" button. For defender: "Fire" button. Both: "Retreat" button.

8. **`frontend/src/components/slide/index.ts`** — Barrel export file.

---

## DESIGN GUIDELINES

- **Dark theme**: Background `#0a0a0a`, grid lines `rgba(255,255,255,0.1)`, accent green `#00ff88`, accent red `#ff4444`.
- **Grid cells**: 40px x 40px for macro, 24px x 24px for micro. Rounded corners. Hover glow effect.
- **Terrain colors**: street = `#333`, building = `#555`, alley = `#222`, corner = `#444`, park = `#1a3a1a`, lot = `#2a2a2a`.
- **Unit icons**: dealer = `💊`, shooter = `🔫`, enforcer = `👊`, pitbull = `🐕`, trap = `💣`.
- **Vehicle part colors**: hood = `#4a90d9`, driver_seat = `#d94a4a`, passenger_seat = `#d9a04a`, rear_left = `#4ad94a`, rear_right = `#d94ad9`, trunk = `#808080`.
- **Animations**: Use Framer Motion for cell reveal (scale from 0 to 1), hit flash (red pulse), and miss splash (blue ripple).
- **Responsive**: The grid should scale to fit the viewport. Use `aspect-ratio: 1` on grid cells.

---

## GAME FLOW

1. **Setup Phase**: Defender places units on the macro grid. Attacker's vehicle is auto-placed on the micro grid.
2. **Attacker Turn**: Attacker selects up to 3 macro cells (one per alive shooter seat). Chooses a pattern for each. Clicks "Fire".
3. **Resolution**: `resolveDriveByTurn` is called. Results are animated on the macro grid.
4. **Defender Turn**: Defender selects micro cells to shoot at the vehicle. Clicks "Fire".
5. **Resolution**: `resolveDefenseRetaliation` is called. Results are animated on the micro grid.
6. **Repeat** until all defender units are dead, the vehicle is destroyed, or max turns reached.
7. **Finished**: Show winner, score, and a "Back to Block" button.
