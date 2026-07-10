// ============================================================
// bipNDipEngine.ts — Bip N Dip Mini-Game Engine
//
// Inspired by San Francisco's "bipping" culture (breaking into
// cars and stealing). This is a Recruit-only mini-game that
// provides cars, loot, and XP for leveling up.
//
// GAME FLOW:
//   1. CAR SELECTION — Player picks a car from a random lineup
//   2. WINDOW BREAKING — Tap repeatedly to crack the glass
//   3. SCAVENGING — Look through the broken window, grab loot
//   4. ALARM CHECK — Some cars have alarms; timer starts
//   5. DECISION — Quit with loot OR speed round (more windows)
//   6. FOOT CHASE — If caught, rhythm game to escape cops
//   7. HOT-WIRE — Optional: steal the entire car via rhythm game
//
// REWARDS:
//   - Loot: cash, drugs, guns, jewelry, valuables
//   - Cars: can be sold on block market or used for missions
//   - XP: recruits level up toward Shooter/Dealer/Enforcer
// ============================================================

// ─── CAR TYPES ───────────────────────────────────────────────

export type CarTier = 'junk' | 'standard' | 'luxury' | 'exotic';

export interface BipCar {
  id: string;
  name: string;
  tier: CarTier;
  hasAlarm: boolean;
  alarmTimer: number;        // seconds before cops arrive (0 = no alarm)
  windowStrength: number;    // taps needed to break a window (1-10)
  lootTable: LootSlot[];
  sellValue: number;         // if stolen whole
  hotWireDifficulty: number; // 1-10 (rhythm game speed)
  speed: number;             // 1-10 (for missions)
  reliability: number;       // 1-10 (chance of breakdown during missions)
  protection: number;        // 1-10 (armor equivalent)
}

export interface LootSlot {
  windowSide: 'driver' | 'passenger' | 'rear_left' | 'rear_right';
  items: LootItem[];
}

export interface LootItem {
  id: string;
  name: string;
  type: 'cash' | 'drug' | 'weapon' | 'jewelry' | 'valuable' | 'nothing';
  value: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  description: string;
}

// ─── CAR GENERATION ──────────────────────────────────────────

const JUNK_CARS = ['1998 Honda Civic', '2003 Toyota Camry', '2001 Ford Taurus', '1995 Nissan Maxima', '2005 Chevy Impala'];
const STANDARD_CARS = ['2018 Honda Accord', '2020 Toyota RAV4', '2019 Ford Explorer', '2021 Hyundai Sonata', '2017 Nissan Altima'];
const LUXURY_CARS = ['2023 BMW 5 Series', '2022 Mercedes E-Class', '2024 Audi A6', '2023 Lexus ES', '2022 Cadillac CT5'];
const EXOTIC_CARS = ['2024 Porsche 911', '2023 Lamborghini Urus', '2024 Ferrari Roma', '2023 McLaren 720S', '2024 Rolls-Royce Ghost'];

const LOOT_POOLS: Record<CarTier, Array<Omit<LootItem, 'id'>>> = {
  junk: [
    { name: 'Loose Change', type: 'cash', value: 15, rarity: 'common', description: 'Coins in the cupholder' },
    { name: 'Old Phone', type: 'valuable', value: 30, rarity: 'common', description: 'Cracked screen but works' },
    { name: 'Bag of Weed', type: 'drug', value: 50, rarity: 'uncommon', description: 'Half oz in the glovebox' },
    { name: 'Nothing', type: 'nothing', value: 0, rarity: 'common', description: 'Empty seat' },
    { name: 'Pocket Knife', type: 'weapon', value: 20, rarity: 'common', description: 'Folding blade' },
  ],
  standard: [
    { name: 'Wallet', type: 'cash', value: 80, rarity: 'common', description: 'Cash and cards' },
    { name: 'Laptop Bag', type: 'valuable', value: 200, rarity: 'uncommon', description: 'MacBook inside' },
    { name: 'Prescription Pills', type: 'drug', value: 120, rarity: 'uncommon', description: 'Oxy bottle' },
    { name: 'Sunglasses', type: 'valuable', value: 50, rarity: 'common', description: 'Ray-Bans' },
    { name: 'Nothing', type: 'nothing', value: 0, rarity: 'common', description: 'Empty' },
    { name: 'Glock 19', type: 'weapon', value: 900, rarity: 'rare', description: 'Under the seat' },
  ],
  luxury: [
    { name: 'Designer Bag', type: 'valuable', value: 500, rarity: 'uncommon', description: 'Louis Vuitton' },
    { name: 'Cash Envelope', type: 'cash', value: 300, rarity: 'uncommon', description: 'Thick envelope' },
    { name: 'Gold Watch', type: 'jewelry', value: 800, rarity: 'rare', description: 'Rolex Submariner' },
    { name: 'Cocaine Baggie', type: 'drug', value: 400, rarity: 'rare', description: '8-ball in the console' },
    { name: 'iPad Pro', type: 'valuable', value: 350, rarity: 'uncommon', description: 'Latest model' },
    { name: 'Nothing', type: 'nothing', value: 0, rarity: 'common', description: 'Clean interior' },
  ],
  exotic: [
    { name: 'Briefcase of Cash', type: 'cash', value: 2000, rarity: 'rare', description: '$2K in hundreds' },
    { name: 'Diamond Chain', type: 'jewelry', value: 3000, rarity: 'legendary', description: 'Iced out Cuban link' },
    { name: 'Kilo of Coke', type: 'drug', value: 5000, rarity: 'legendary', description: 'Wrapped brick' },
    { name: 'Gold-Plated .45', type: 'weapon', value: 2500, rarity: 'legendary', description: 'Custom Desert Eagle' },
    { name: 'AP Watch', type: 'jewelry', value: 4000, rarity: 'legendary', description: 'Audemars Piguet Royal Oak' },
    { name: 'Nothing', type: 'nothing', value: 0, rarity: 'uncommon', description: 'Owner took everything' },
  ],
};

function pickRandom<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateLootForWindow(tier: CarTier, rng: () => number = Math.random): LootItem[] {
  const pool = LOOT_POOLS[tier];
  const count = tier === 'junk' ? 1 : tier === 'standard' ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
  const items: LootItem[] = [];
  for (let i = 0; i < count; i++) {
    const template = pickRandom(pool, rng);
    items.push({ ...template, id: `loot-${Date.now()}-${Math.floor(rng() * 10000)}` });
  }
  return items;
}

/**
 * Generate a random car for the Bip N Dip lineup.
 */
export function generateBipCar(rng: () => number = Math.random): BipCar {
  // Weighted tier selection: 40% junk, 30% standard, 20% luxury, 10% exotic
  const roll = rng();
  let tier: CarTier;
  let namePool: string[];
  if (roll < 0.40) { tier = 'junk'; namePool = JUNK_CARS; }
  else if (roll < 0.70) { tier = 'standard'; namePool = STANDARD_CARS; }
  else if (roll < 0.90) { tier = 'luxury'; namePool = LUXURY_CARS; }
  else { tier = 'exotic'; namePool = EXOTIC_CARS; }

  const name = pickRandom(namePool, rng);

  // Alarm probability: junk=0%, standard=30%, luxury=80%, exotic=100%
  const alarmChance = { junk: 0, standard: 0.3, luxury: 0.8, exotic: 1.0 }[tier];
  const hasAlarm = rng() < alarmChance;
  const alarmTimer = hasAlarm ? ({ junk: 0, standard: 20, luxury: 15, exotic: 10 }[tier]) : 0;

  // Window strength: junk=2, standard=4, luxury=6, exotic=8
  const windowStrength = { junk: 2, standard: 4, luxury: 6, exotic: 8 }[tier];

  // Generate loot for each window
  const windows: Array<'driver' | 'passenger' | 'rear_left' | 'rear_right'> = ['driver', 'passenger', 'rear_left', 'rear_right'];
  const lootTable: LootSlot[] = windows.map((side) => ({
    windowSide: side,
    items: generateLootForWindow(tier, rng),
  }));

  return {
    id: `car-${Date.now()}-${Math.floor(rng() * 10000)}`,
    name,
    tier,
    hasAlarm,
    alarmTimer,
    windowStrength,
    lootTable,
    sellValue: { junk: 500, standard: 3000, luxury: 12000, exotic: 40000 }[tier],
    hotWireDifficulty: { junk: 2, standard: 5, luxury: 7, exotic: 9 }[tier],
    speed: { junk: 3, standard: 5, luxury: 7, exotic: 10 }[tier],
    reliability: { junk: 2, standard: 6, luxury: 8, exotic: 9 }[tier],
    protection: { junk: 1, standard: 4, luxury: 6, exotic: 8 }[tier],
  };
}

/**
 * Generate a lineup of cars to choose from.
 */
export function generateCarLineup(count: number = 5, rng: () => number = Math.random): BipCar[] {
  return Array.from({ length: count }, () => generateBipCar(rng));
}

// ─── WINDOW BREAKING ─────────────────────────────────────────

export interface WindowBreakState {
  windowSide: 'driver' | 'passenger' | 'rear_left' | 'rear_right';
  tapsRequired: number;
  tapsCurrent: number;
  isBroken: boolean;
  crackLevel: number;  // 0-100 visual progress
}

export function createWindowBreakState(car: BipCar, side: WindowBreakState['windowSide']): WindowBreakState {
  return {
    windowSide: side,
    tapsRequired: car.windowStrength,
    tapsCurrent: 0,
    isBroken: false,
    crackLevel: 0,
  };
}

export function tapWindow(state: WindowBreakState): WindowBreakState {
  const newTaps = state.tapsCurrent + 1;
  const isBroken = newTaps >= state.tapsRequired;
  return {
    ...state,
    tapsCurrent: newTaps,
    isBroken,
    crackLevel: Math.min(100, Math.round((newTaps / state.tapsRequired) * 100)),
  };
}

// ─── SCAVENGING ──────────────────────────────────────────────

export interface ScavengeResult {
  windowSide: string;
  itemsFound: LootItem[];
  timeSpent: number;  // seconds
}

export function scavengeWindow(car: BipCar, side: WindowBreakState['windowSide']): ScavengeResult {
  const slot = car.lootTable.find((s) => s.windowSide === side);
  return {
    windowSide: side,
    itemsFound: slot?.items.filter((i) => i.type !== 'nothing') ?? [],
    timeSpent: 3 + Math.floor(Math.random() * 3),  // 3-5 seconds per window
  };
}

// ─── ALARM & TIMER ───────────────────────────────────────────

export interface AlarmState {
  isTriggered: boolean;
  timeRemaining: number;  // seconds until cops arrive
  copsArrived: boolean;
}

export function triggerAlarm(car: BipCar): AlarmState {
  return {
    isTriggered: car.hasAlarm,
    timeRemaining: car.alarmTimer,
    copsArrived: false,
  };
}

export function tickAlarm(state: AlarmState, deltaSeconds: number): AlarmState {
  if (!state.isTriggered) return state;
  const newTime = Math.max(0, state.timeRemaining - deltaSeconds);
  return {
    ...state,
    timeRemaining: newTime,
    copsArrived: newTime <= 0,
  };
}

// ─── FOOT CHASE (RHYTHM GAME) ────────────────────────────────

export interface FootChaseState {
  isActive: boolean;
  bpm: number;              // beats per minute (tempo)
  currentBeat: number;      // which beat we're on
  totalBeats: number;       // beats needed to escape
  consecutiveHits: number;  // streak of on-rhythm taps
  consecutiveMisses: number;
  trips: number;            // 2 trips = fall = caught
  escaped: boolean;
  caught: boolean;
  speedMultiplier: number;  // increases with streak
}

export function createFootChase(recruitLevel: number): FootChaseState {
  // Higher level = slower BPM (easier) and fewer beats needed
  const bpm = 140 - (recruitLevel * 5);  // Level 1 = 135bpm, Level 10 = 90bpm
  const totalBeats = 20 - recruitLevel;   // Level 1 = 19 beats, Level 10 = 10 beats
  return {
    isActive: true,
    bpm: Math.max(80, bpm),
    currentBeat: 0,
    totalBeats: Math.max(8, totalBeats),
    consecutiveHits: 0,
    consecutiveMisses: 0,
    trips: 0,
    escaped: false,
    caught: false,
    speedMultiplier: 1.0,
  };
}

/**
 * Process a tap during the foot chase.
 * Returns whether the tap was on-beat.
 */
export function processFootChaseTap(
  state: FootChaseState,
  timingAccuracy: number,  // 0-1 (1 = perfect, 0 = completely off)
): FootChaseState {
  const isOnBeat = timingAccuracy >= 0.6;  // 60% accuracy threshold

  if (isOnBeat) {
    const newHits = state.consecutiveHits + 1;
    const newBeat = state.currentBeat + 1;
    const escaped = newBeat >= state.totalBeats;
    return {
      ...state,
      currentBeat: newBeat,
      consecutiveHits: newHits,
      consecutiveMisses: 0,
      speedMultiplier: Math.min(2.0, 1.0 + newHits * 0.05),
      escaped,
    };
  } else {
    const newMisses = state.consecutiveMisses + 1;
    const tripped = newMisses >= 2;
    const newTrips = tripped ? state.trips + 1 : state.trips;
    const caught = newTrips >= 2;
    return {
      ...state,
      consecutiveHits: 0,
      consecutiveMisses: tripped ? 0 : newMisses,
      trips: newTrips,
      caught,
      speedMultiplier: 1.0,
    };
  }
}

// ─── HOT-WIRE (RHYTHM GAME) ──────────────────────────────────

export type WireColor = 'red' | 'black';

export interface HotWireState {
  isActive: boolean;
  sequence: WireColor[];     // the pattern to match
  currentIndex: number;
  mistakes: number;
  maxMistakes: number;       // 3 mistakes = fail
  sparksGenerated: number;   // visual feedback
  carStarted: boolean;
  failed: boolean;
}

export function createHotWire(car: BipCar): HotWireState {
  // Generate a random red/black wire sequence
  const length = car.hotWireDifficulty * 3;  // 6 to 27 taps
  const sequence: WireColor[] = Array.from({ length }, () =>
    Math.random() < 0.5 ? 'red' : 'black'
  );
  return {
    isActive: true,
    sequence,
    currentIndex: 0,
    mistakes: 0,
    maxMistakes: 3,
    sparksGenerated: 0,
    carStarted: false,
    failed: false,
  };
}

/**
 * Process a wire tap during hot-wiring.
 */
export function processHotWireTap(state: HotWireState, tappedWire: WireColor): HotWireState {
  const expected = state.sequence[state.currentIndex];
  const correct = tappedWire === expected;

  if (correct) {
    const newIndex = state.currentIndex + 1;
    const carStarted = newIndex >= state.sequence.length;
    return {
      ...state,
      currentIndex: newIndex,
      sparksGenerated: state.sparksGenerated + 1,
      carStarted,
    };
  } else {
    const newMistakes = state.mistakes + 1;
    return {
      ...state,
      mistakes: newMistakes,
      failed: newMistakes >= state.maxMistakes,
    };
  }
}

// ─── GAME SESSION ────────────────────────────────────────────

export type BipPhase =
  | 'car_selection'
  | 'window_breaking'
  | 'scavenging'
  | 'alarm_active'
  | 'speed_round'
  | 'foot_chase'
  | 'hot_wire'
  | 'escape_success'
  | 'arrested'
  | 'results';

export interface BipNDipSession {
  phase: BipPhase;
  car: BipCar | null;
  lineup: BipCar[];
  windowStates: Record<string, WindowBreakState>;
  lootCollected: LootItem[];
  alarm: AlarmState;
  footChase: FootChaseState | null;
  hotWire: HotWireState | null;
  xpEarned: number;
  carStolen: boolean;
  totalValue: number;
}

/**
 * Create a new Bip N Dip session.
 */
export function createBipNDipSession(): BipNDipSession {
  const lineup = generateCarLineup(5);
  return {
    phase: 'car_selection',
    car: null,
    lineup,
    windowStates: {},
    lootCollected: [],
    alarm: { isTriggered: false, timeRemaining: 0, copsArrived: false },
    footChase: null,
    hotWire: null,
    xpEarned: 0,
    carStolen: false,
    totalValue: 0,
  };
}

/**
 * Select a car from the lineup.
 */
export function selectCar(session: BipNDipSession, carId: string): BipNDipSession {
  const car = session.lineup.find((c) => c.id === carId);
  if (!car) return session;

  const windows: Array<'driver' | 'passenger' | 'rear_left' | 'rear_right'> = ['driver', 'passenger', 'rear_left', 'rear_right'];
  const windowStates: Record<string, WindowBreakState> = {};
  for (const side of windows) {
    windowStates[side] = createWindowBreakState(car, side);
  }

  return {
    ...session,
    phase: 'window_breaking',
    car,
    windowStates,
    alarm: triggerAlarm(car),
  };
}

/**
 * Calculate total loot value.
 */
export function calculateTotalLootValue(loot: LootItem[]): number {
  return loot.reduce((sum, item) => sum + item.value, 0);
}

/**
 * Calculate XP earned from a Bip N Dip session.
 */
export function calculateBipXP(session: BipNDipSession): number {
  let xp = 0;
  xp += session.lootCollected.length * 10;  // 10 XP per item grabbed
  xp += Math.floor(session.totalValue / 100);  // 1 XP per $100 value
  if (session.carStolen) xp += 100;  // bonus for stealing the car
  if (session.phase === 'escape_success') xp += 50;  // bonus for clean escape
  return xp;
}
