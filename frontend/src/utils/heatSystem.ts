// ============================================================
// heatSystem.ts - Heat level management and raid mechanics
// Heat affects raid probability, undercover frequency, and game difficulty
// ============================================================

export interface HeatState {
  level: number;           // 0-100
  raidThreshold: number;   // Heat level that triggers raid check
  decayRate: number;       // Points per hour of natural decay
  lastDecayTime: number;   // Timestamp of last decay
  raidCooldown: number;    // Minimum time between raids (ms)
  lastRaidTime: number;    // Timestamp of last raid
}

export interface RaidResult {
  occurred: boolean;
  severity: 'minor' | 'major' | 'federal';
  confiscatedDrugs: number;    // Quantity lost
  confiscatedWeapons: number;
  confiscatedMoney: number;
  arrestedMembers: string[];   // Member IDs
  heatReduction: number;       // Heat drops after raid
  bailCosts: Map<string, number>; // memberId -> bail amount
}

// ============ HEAT CONSTANTS ============
export const HEAT_CONFIG = {
  MAX_HEAT: 100,
  MIN_HEAT: 0,
  BASE_DECAY_RATE: 2,        // Points per hour
  RAID_THRESHOLD_LOW: 40,
  RAID_THRESHOLD_MED: 65,
  RAID_THRESHOLD_HIGH: 85,
  RAID_COOLDOWN_MS: 30 * 60 * 1000, // 30 minutes minimum between raids
  // Heat sources
  DEAL_HEAT: {
    regular: 3,
    fiend: 5,
    prep_kid: 2,
    celebrity: 0,
    undercover: 40,
    informant: 25,
    tourist: 4,
    homeless: 1,
    armed_buyer: 8,
    college_kid: 3,
  } as Record<string, number>,
  // Super drug heat multipliers
  SUPER_DRUG_HEAT_MULT: 3.0,
  OD_HEAT_SPIKE: 25,
  COMBAT_HEAT_PER_TURN: 5,
  CIVILIAN_KILL_HEAT: 15,
} as const;

// ============ HEAT FUNCTIONS ============

/**
 * Calculate current heat after natural decay.
 */
export function calculateDecayedHeat(state: HeatState): number {
  const now = Date.now();
  const hoursElapsed = (now - state.lastDecayTime) / (1000 * 60 * 60);
  const decay = hoursElapsed * state.decayRate;
  return Math.max(HEAT_CONFIG.MIN_HEAT, state.level - decay);
}

/**
 * Add heat from a deal or event.
 */
export function addHeat(state: HeatState, amount: number): HeatState {
  return {
    ...state,
    level: Math.min(HEAT_CONFIG.MAX_HEAT, state.level + amount),
  };
}

/**
 * Check if a raid should occur based on current heat.
 * Returns probability 0-1.
 */
export function getRaidProbability(heat: number): number {
  if (heat < HEAT_CONFIG.RAID_THRESHOLD_LOW) return 0;
  if (heat < HEAT_CONFIG.RAID_THRESHOLD_MED) return 0.05 + (heat - 40) * 0.002;
  if (heat < HEAT_CONFIG.RAID_THRESHOLD_HIGH) return 0.15 + (heat - 65) * 0.005;
  return 0.30 + (heat - 85) * 0.01; // Max ~45% at heat 100
}

/**
 * Determine raid severity based on heat level.
 */
export function getRaidSeverity(heat: number): 'minor' | 'major' | 'federal' {
  if (heat < HEAT_CONFIG.RAID_THRESHOLD_MED) return 'minor';
  if (heat < HEAT_CONFIG.RAID_THRESHOLD_HIGH) return 'major';
  return 'federal';
}

/**
 * Roll for a raid event. Returns true if raid occurs.
 */
export function rollForRaid(state: HeatState, rng: () => number = Math.random): boolean {
  const now = Date.now();
  // Check cooldown
  if (now - state.lastRaidTime < state.raidCooldown) return false;

  const currentHeat = calculateDecayedHeat(state);
  const probability = getRaidProbability(currentHeat);
  return rng() < probability;
}

/**
 * Execute a raid and determine consequences.
 */
export function executeRaid(
  heat: number,
  memberIds: string[],
  drugQuantity: number,
  weaponCount: number,
  cashOnHand: number,
  rng: () => number = Math.random
): RaidResult {
  const severity = getRaidSeverity(heat);

  // Confiscation rates by severity
  const confiscationRates = {
    minor: { drugs: 0.3, weapons: 0.2, money: 0.1, arrestChance: 0.15 },
    major: { drugs: 0.6, weapons: 0.5, money: 0.3, arrestChance: 0.35 },
    federal: { drugs: 1.0, weapons: 0.8, money: 0.5, arrestChance: 0.60 },
  };

  const rates = confiscationRates[severity];

  // Determine arrested members
  const arrestedMembers: string[] = [];
  for (const memberId of memberIds) {
    if (rng() < rates.arrestChance) {
      arrestedMembers.push(memberId);
    }
  }

  // Calculate bail costs
  const bailCosts = new Map<string, number>();
  for (const memberId of arrestedMembers) {
    const baseBail = severity === 'minor' ? 5000 : severity === 'major' ? 15000 : 50000;
    const variance = baseBail * (0.5 + rng());
    bailCosts.set(memberId, Math.round(variance));
  }

  // Heat reduction after raid
  const heatReduction = severity === 'minor' ? 15 : severity === 'major' ? 25 : 40;

  return {
    occurred: true,
    severity,
    confiscatedDrugs: Math.round(drugQuantity * rates.drugs),
    confiscatedWeapons: Math.round(weaponCount * rates.weapons),
    confiscatedMoney: Math.round(cashOnHand * rates.money),
    arrestedMembers,
    heatReduction,
    bailCosts,
  };
}

/**
 * Calculate the undercover cop frequency based on heat.
 * Higher heat = more undercovers in the DEALT dealing game.
 */
export function getUndercoverFrequency(heat: number): number {
  // Base 5% chance, scales up with heat
  const base = 0.05;
  const heatBonus = (heat / 100) * 0.25; // Up to +25% at max heat
  return Math.min(0.30, base + heatBonus); // Cap at 30%
}

/**
 * Create initial heat state.
 */
export function createInitialHeatState(): HeatState {
  return {
    level: 0,
    raidThreshold: HEAT_CONFIG.RAID_THRESHOLD_LOW,
    decayRate: HEAT_CONFIG.BASE_DECAY_RATE,
    lastDecayTime: Date.now(),
    raidCooldown: HEAT_CONFIG.RAID_COOLDOWN_MS,
    lastRaidTime: 0,
  };
}
