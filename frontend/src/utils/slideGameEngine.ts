// ============================================================
// slideGameEngine.ts — SLIDE Drive-By Battleship Engine
//
// GAME MECHANICS:
//
//  THE BLOCK GRID (8 columns × 8 rows):
//    Row 0: STREET  — where the attacking car stops and shoots FROM
//    Row 1: CURB    — closest to street, highest exposure
//    Row 2: SIDEWALK
//    Row 3: STOREFRONT
//    Row 4: ALLEY
//    Row 5: ALLEY BACK
//    Row 6: PARKING
//    Row 7: ROOFTOP — safest, lowest exposure
//
//  ATTACKER TURN (SLIDING):
//    1. Attacker picks 1-3 STREET squares (col 0-7, row 0) to stop at.
//       This is the "car stop position" — hidden from defenders.
//    2. From each stop position, the attacker picks grid squares on the
//       BLOCK (rows 1-7) to shoot at. Number of shots = total ammo
//       across all shooters in the car.
//    3. Recruits and Enforcers in the car cannot shoot.
//
//  DEFENDER TURN (RETURNING FIRE):
//    1. Defenders with SHOOTER role pick STREET squares (row 0) to
//       shoot at — trying to guess where the car stopped.
//    2. Number of shots = number of alive Shooters on the block.
//    3. Recruits and Enforcers on the block CANNOT shoot back.
//
//  SHOT SPOTTER:
//    After each round, the SHOT SPOTTER fires if any member was hit.
//    It reveals a 3-column range around where the shooting happened.
//    This tells the defender if they should spin the block again.
//
//  SPIN THE BLOCK:
//    The attacker can choose to spin again (do another round).
//    Each spin costs ammo. Running out of ammo ends the attack.
//    Each spin adds heat to the attacker.
//
//  REINFORCEMENTS:
//    The defender can call backup between spins.
//    Reinforcements take 1 spin to arrive (delayed).
//    Each reinforcement adds 1 Shooter to the defense.
//
//  WIN CONDITIONS:
//    - Attacker wins: all defenders killed or flee.
//    - Defender wins: car destroyed (driver killed) or attacker retreats.
// ============================================================

export const BLOCK_COLS = 8;
export const BLOCK_ROWS = 8;
export const STREET_ROW = 0;

// Row zone labels and properties
export interface BlockZone {
  row: number;
  label: string;
  shortLabel: string;
  exposureRisk: number;   // 0-100: how exposed to street fire
  incomeMultiplier: number;
  coverBonus: number;     // 0-1: reduces hit chance
}

export const BLOCK_ZONES: BlockZone[] = [
  { row: 0, label: 'STREET',     shortLabel: 'ST',  exposureRisk: 100, incomeMultiplier: 2.0, coverBonus: 0.0 },
  { row: 1, label: 'CURB',       shortLabel: 'CB',  exposureRisk: 90,  incomeMultiplier: 1.8, coverBonus: 0.1 },
  { row: 2, label: 'SIDEWALK',   shortLabel: 'WK',  exposureRisk: 70,  incomeMultiplier: 1.5, coverBonus: 0.2 },
  { row: 3, label: 'STOREFRONT', shortLabel: 'SF',  exposureRisk: 50,  incomeMultiplier: 1.2, coverBonus: 0.4 },
  { row: 4, label: 'ALLEY',      shortLabel: 'AL',  exposureRisk: 30,  incomeMultiplier: 0.9, coverBonus: 0.6 },
  { row: 5, label: 'ALLEY BACK', shortLabel: 'AB',  exposureRisk: 20,  incomeMultiplier: 0.7, coverBonus: 0.7 },
  { row: 6, label: 'PARKING',    shortLabel: 'PK',  exposureRisk: 10,  incomeMultiplier: 0.6, coverBonus: 0.8 },
  { row: 7, label: 'ROOFTOP',    shortLabel: 'RF',  exposureRisk: 5,   incomeMultiplier: 0.5, coverBonus: 0.9 },
];

// ─── MEMBER TYPES ────────────────────────────────────────────

export type SlideRole = 'shooter' | 'dealer' | 'enforcer' | 'recruit' | 'driver';

export interface SlideMember {
  id: string;
  name: string;
  role: SlideRole;
  hp: number;
  maxHp: number;
  row: number;    // block position (defenders only)
  col: number;
  ammo: number;   // total rounds available
  maxAmmo: number;
  weaponName: string;
  weaponDamage: number;
  accuracy: number;    // 0-100
  isAlive: boolean;
  isRevealed: boolean; // has been hit (position revealed to attacker)
  armorLevel: number;  // 0-3 (0=none, 1=vest, 2=heavy, 3=ceramic)
}

// ─── VEHICLE (ATTACKER SIDE) ─────────────────────────────────

export interface SlideVehicle {
  id: string;
  type: '4door' | '2door' | 'suv' | 'van' | 'motorcycle';
  hp: number;
  maxHp: number;
  tiresBlown: boolean;
  engineDamaged: boolean;
  members: SlideMember[];  // people in the car
  stopPositions: number[]; // col indices where car stopped (row 0)
}

// ─── GRID CELL ───────────────────────────────────────────────

export interface SlideCell {
  row: number;
  col: number;
  // Defender side
  occupantId: string | null;
  occupantRole: SlideRole | null;
  wasShot: boolean;
  wasHit: boolean;
  // Attacker side (street row)
  isCarStop: boolean;
  wasTargetedByDefender: boolean;
  defenderHitCar: boolean;
}

// ─── SHOT SPOTTER ────────────────────────────────────────────

export interface ShotSpotterReport {
  triggered: boolean;
  message: string;
  revealedCols: number[];   // columns where shots were detected
  severity: 'clear' | 'shots_fired' | 'multiple_shots' | 'heavy_fire';
  shouldSpin: boolean;       // recommendation to the attacker
}

// ─── SPIN RESULT ─────────────────────────────────────────────

export interface SpinResult {
  spinNumber: number;
  attackerShots: Array<{ col: number; row: number; hit: boolean; memberId?: string; damage?: number }>;
  defenderShots: Array<{ col: number; hit: boolean; carDamage?: number; memberKilled?: string }>;
  membersKilled: string[];
  carDamageThisSpin: number;
  shotSpotter: ShotSpotterReport;
  heatGenerated: number;
}

// ─── GAME STATE ──────────────────────────────────────────────

export type SlidePhase =
  | 'setup_attacker'     // attacker assigns members to car seats
  | 'pick_stop'          // attacker picks where to stop on the street
  | 'attacker_shooting'  // attacker picks block squares to shoot
  | 'defender_shooting'  // defender picks street squares to shoot at car
  | 'spin_decision'      // attacker decides: spin again or retreat
  | 'reinforcements'     // defender calls backup
  | 'resolved';          // game over

export interface SlideGameState {
  phase: SlidePhase;
  spinNumber: number;
  maxSpins: number;
  vehicle: SlideVehicle;
  defenders: SlideMember[];
  grid: SlideCell[][];
  spinHistory: SpinResult[];
  killFeed: Array<{ message: string; timestamp: number; type: 'kill' | 'hit' | 'miss' | 'spotter' | 'system' }>;
  pendingReinforcements: number;  // reinforcements arriving next spin
  attackerRetreat: boolean;
  vehicleDestroyed: boolean;
  allDefendersDown: boolean;
  totalHeatGenerated: number;
}

// ─── ENGINE FUNCTIONS ────────────────────────────────────────

/**
 * Initialize the block grid with defender positions.
 */
export function createSlideGrid(defenders: SlideMember[]): SlideCell[][] {
  const grid: SlideCell[][] = [];

  for (let row = 0; row < BLOCK_ROWS; row++) {
    const rowCells: SlideCell[] = [];
    for (let col = 0; col < BLOCK_COLS; col++) {
      rowCells.push({
        row, col,
        occupantId: null,
        occupantRole: null,
        wasShot: false,
        wasHit: false,
        isCarStop: false,
        wasTargetedByDefender: false,
        defenderHitCar: false,
      });
    }
    grid.push(rowCells);
  }

  // Place defenders on the grid
  for (const defender of defenders) {
    if (defender.row >= 1 && defender.row < BLOCK_ROWS) {
      grid[defender.row][defender.col].occupantId = defender.id;
      grid[defender.row][defender.col].occupantRole = defender.role;
    }
  }

  return grid;
}

/**
 * Calculate hit probability for an attacker shooting at a block cell.
 * Factors: weapon accuracy, defender cover, zone exposure.
 */
export function calcAttackerHitChance(
  shooter: SlideMember,
  targetRow: number,
  targetCol: number,
  stopCol: number,
): number {
  const zone = BLOCK_ZONES[targetRow];
  if (!zone) return 0;

  const baseAccuracy = shooter.accuracy / 100;
  const coverPenalty = zone.coverBonus;

  // Horizontal distance from stop position reduces accuracy
  const colDistance = Math.abs(targetCol - stopCol);
  const distancePenalty = colDistance * 0.08;

  return Math.min(0.95, Math.max(0.05, baseAccuracy - coverPenalty - distancePenalty));
}

/**
 * Calculate hit probability for a defender shooting at a street square.
 * Factors: shooter accuracy, whether the car actually stopped there.
 */
export function calcDefenderHitChance(
  shooter: SlideMember,
  targetCol: number,
  actualStopCols: number[],
): number {
  const isActualStop = actualStopCols.includes(targetCol);
  if (!isActualStop) return 0;  // miss — wrong square

  const baseAccuracy = shooter.accuracy / 100;
  return Math.min(0.90, Math.max(0.10, baseAccuracy));
}

/**
 * Calculate damage dealt to a member accounting for armor.
 */
export function calcDamage(
  weaponDamage: number,
  targetArmorLevel: number,
  rng: () => number = Math.random,
): number {
  const variance = Math.round((rng() - 0.5) * 10);
  const armorReduction = targetArmorLevel * 0.2;  // 0%, 20%, 40%, 60%
  const rawDamage = weaponDamage + variance;
  return Math.max(1, Math.round(rawDamage * (1 - armorReduction)));
}

/**
 * Process one attacker shot at a block cell.
 */
export function processAttackerShot(
  shooter: SlideMember,
  targetRow: number,
  targetCol: number,
  stopCol: number,
  defenders: SlideMember[],
  grid: SlideCell[][],
  rng: () => number = Math.random,
): {
  hit: boolean;
  memberId?: string;
  damage?: number;
  killed?: boolean;
  message: string;
} {
  const cell = grid[targetRow]?.[targetCol];
  if (!cell) return { hit: false, message: 'Invalid target.' };

  const hitChance = calcAttackerHitChance(shooter, targetRow, targetCol, stopCol);
  const roll = rng();

  if (roll > hitChance) {
    return { hit: false, message: `${shooter.name} shot at (${targetCol},${targetRow}) — MISS` };
  }

  // Hit — check if there's a defender there
  const defender = defenders.find((d) => d.row === targetRow && d.col === targetCol && d.isAlive);
  if (!defender) {
    return { hit: true, message: `${shooter.name} hit (${targetCol},${targetRow}) — empty` };
  }

  const damage = calcDamage(shooter.weaponDamage, defender.armorLevel, rng);
  const killed = damage >= defender.hp;

  return {
    hit: true,
    memberId: defender.id,
    damage,
    killed,
    message: killed
      ? `💀 ${shooter.name} KILLED ${defender.name}!`
      : `🎯 ${shooter.name} HIT ${defender.name} for ${damage} dmg (${defender.hp - damage} HP left)`,
  };
}

/**
 * Process one defender shot at a street square.
 */
export function processDefenderShot(
  shooter: SlideMember,
  targetCol: number,
  vehicle: SlideVehicle,
  rng: () => number = Math.random,
): {
  hit: boolean;
  carDamage?: number;
  memberKilled?: string;
  message: string;
} {
  const hitChance = calcDefenderHitChance(shooter, targetCol, vehicle.stopPositions);

  if (hitChance === 0) {
    return { hit: false, message: `${shooter.name} shot at street col ${targetCol} — WRONG SPOT` };
  }

  const roll = rng();
  if (roll > hitChance) {
    return { hit: false, message: `${shooter.name} shot at col ${targetCol} — MISSED THE CAR` };
  }

  // Hit the car — determine what was hit
  const carDamage = calcDamage(shooter.weaponDamage, 0, rng);

  // Check if a car occupant was hit (random chance based on damage)
  const aliveMembers = vehicle.members.filter((m) => m.isAlive && m.role !== 'driver');
  let memberKilled: string | undefined;

  if (aliveMembers.length > 0 && rng() < 0.3) {
    const victim = aliveMembers[Math.floor(rng() * aliveMembers.length)];
    memberKilled = victim.id;
  }

  return {
    hit: true,
    carDamage,
    memberKilled,
    message: memberKilled
      ? `💥 ${shooter.name} HIT THE CAR — occupant shot!`
      : `🚗 ${shooter.name} HIT THE CAR for ${carDamage} damage`,
  };
}

/**
 * Generate a Shot Spotter report after a spin.
 */
export function generateShotSpotterReport(
  spinResult: Omit<SpinResult, 'shotSpotter'>,
  vehicle: SlideVehicle,
): ShotSpotterReport {
  const totalShots = spinResult.attackerShots.length + spinResult.defenderShots.length;
  const hits = spinResult.attackerShots.filter((s) => s.hit).length;
  const membersDown = spinResult.membersKilled.length;

  if (totalShots === 0) {
    return {
      triggered: false,
      message: 'No shots fired.',
      revealedCols: [],
      severity: 'clear',
      shouldSpin: false,
    };
  }

  // Reveal columns where shots were detected
  const shotCols = new Set<number>();
  spinResult.attackerShots.forEach((s) => shotCols.add(s.col));
  vehicle.stopPositions.forEach((col) => shotCols.add(col));

  // Expand to ±1 column (shot spotter isn't precise)
  const revealedCols = new Set<number>();
  shotCols.forEach((col) => {
    revealedCols.add(Math.max(0, col - 1));
    revealedCols.add(col);
    revealedCols.add(Math.min(BLOCK_COLS - 1, col + 1));
  });

  let severity: ShotSpotterReport['severity'];
  let message: string;
  let shouldSpin: boolean;

  if (totalShots >= 10) {
    severity = 'heavy_fire';
    message = `🚨 SHOT SPOTTER: Heavy gunfire reported near cols ${[...revealedCols].join(', ')}. Multiple casualties. Police ETA 3 min.`;
    shouldSpin = false;  // too hot
  } else if (membersDown > 0) {
    severity = 'multiple_shots';
    message = `⚠️ SHOT SPOTTER: Shots fired, casualties reported near cols ${[...revealedCols].join(', ')}. Spin again?`;
    shouldSpin = hits < 3;
  } else if (hits > 0) {
    severity = 'shots_fired';
    message = `📡 SHOT SPOTTER: Gunshots detected near cols ${[...revealedCols].join(', ')}. Someone got hit.`;
    shouldSpin = true;
  } else {
    severity = 'shots_fired';
    message = `📡 SHOT SPOTTER: Shots fired near cols ${[...revealedCols].join(', ')}. No confirmed hits.`;
    shouldSpin = true;
  }

  return {
    triggered: true,
    message,
    revealedCols: [...revealedCols].sort(),
    severity,
    shouldSpin,
  };
}

/**
 * Calculate heat generated by a spin.
 */
export function calcSpinHeat(
  spinNumber: number,
  membersKilled: number,
  carHit: boolean,
): number {
  let heat = 5 + spinNumber * 3;  // base heat increases each spin
  heat += membersKilled * 10;      // each kill adds heat
  if (carHit) heat += 5;
  return heat;
}

/**
 * Check if the game is over.
 */
export function checkGameOver(
  state: SlideGameState,
): { over: boolean; winner: 'attacker' | 'defender' | null; reason: string } {
  // All defenders dead
  const aliveDefenders = state.defenders.filter((d) => d.isAlive);
  if (aliveDefenders.length === 0) {
    return { over: true, winner: 'attacker', reason: 'All defenders eliminated. Block taken.' };
  }

  // Vehicle destroyed
  if (state.vehicleDestroyed) {
    return { over: true, winner: 'defender', reason: 'Attacking vehicle destroyed. Block held.' };
  }

  // Attacker retreated
  if (state.attackerRetreat) {
    return { over: true, winner: 'defender', reason: 'Attackers retreated. Block held.' };
  }

  // Max spins reached
  if (state.spinNumber > state.maxSpins) {
    return { over: true, winner: 'defender', reason: 'Attackers ran out of spins. Block held.' };
  }

  // All attacker ammo spent
  const totalAmmo = state.vehicle.members.reduce((sum, m) => sum + m.ammo, 0);
  if (totalAmmo <= 0) {
    return { over: true, winner: 'defender', reason: 'Attackers ran out of ammo. Block held.' };
  }

  return { over: false, winner: null, reason: '' };
}

/**
 * Get the number of shots available to the attacker this spin.
 * Based on alive shooters and their remaining ammo.
 */
export function getAttackerShotsAvailable(vehicle: SlideVehicle): number {
  return vehicle.members
    .filter((m) => m.isAlive && m.role === 'shooter')
    .reduce((sum, m) => sum + Math.min(m.ammo, 3), 0);  // max 3 shots per shooter per spin
}

/**
 * Get the number of shots available to the defender this spin.
 * Only alive Shooters on the block can return fire.
 */
export function getDefenderShotsAvailable(defenders: SlideMember[]): number {
  return defenders
    .filter((d) => d.isAlive && d.role === 'shooter')
    .length * 2;  // each defender shooter gets 2 shots per spin
}
