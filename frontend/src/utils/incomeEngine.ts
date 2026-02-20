// ============================================================
// incomeEngine.ts - Passive income calculation from blocks
// Dealers on blocks generate income based on position, drug quality, and stats
// ============================================================

export interface IncomeBreakdown {
  blockId: string;
  blockName: string;
  totalIncome: number;
  dealerBreakdowns: DealerIncome[];
  odEvents: ODEvent[];
}

export interface DealerIncome {
  memberId: string;
  memberName: string;
  baseIncome: number;
  positionMultiplier: number;
  drugMultiplier: number;
  statMultiplier: number;
  totalIncome: number;
}

export interface ODEvent {
  memberId: string;
  memberName: string;
  drugName: string;
  heatSpike: number;
}

// ============ INCOME CONSTANTS ============
export const INCOME_CONFIG = {
  BASE_INCOME_PER_DEALER: 50,    // $ per tick per dealer
  TICK_INTERVAL_MS: 30_000,       // 30 seconds

  // Street proximity multipliers (row 0 = back of block, row 7 = street)
  POSITION_MULTIPLIERS: {
    0: 0.6,  // Far back — safest, least money
    1: 0.7,
    2: 0.8,
    3: 0.9,
    4: 1.0,  // Middle
    5: 1.2,
    6: 1.5,  // Near street
    7: 2.0,  // On the street — most money, most danger
  } as Record<number, number>,

  // Drug quality → income multiplier
  PURITY_MULT_MIN: 0.5,
  PURITY_MULT_MAX: 2.0,

  // OD check
  OD_CHECK_THRESHOLD: 50,  // OD risk > 50% triggers check
  OD_HEAT_SPIKE: 25,
} as const;

// ============ INCOME FUNCTIONS ============

/**
 * Get position multiplier for a row on the block grid.
 * Higher rows (closer to street) = more money.
 */
export function getPositionMultiplier(row: number): number {
  return INCOME_CONFIG.POSITION_MULTIPLIERS[row] ?? 1.0;
}

/**
 * Convert drug purity (0-100) to an income multiplier.
 */
export function getPurityMultiplier(purity: number): number {
  const range = INCOME_CONFIG.PURITY_MULT_MAX - INCOME_CONFIG.PURITY_MULT_MIN;
  return INCOME_CONFIG.PURITY_MULT_MIN + (purity / 100) * range;
}

/**
 * Get dealing stat multiplier from member stats.
 * dealing: 0-100 → multiplier 1.0-1.5
 */
export function getDealingStatMultiplier(dealingStat: number): number {
  return 1.0 + (dealingStat / 200);
}

/**
 * Check if a customer ODs from a drug this tick.
 */
export function checkForOD(
  odRisk: number,
  rng: () => number = Math.random
): boolean {
  if (odRisk <= INCOME_CONFIG.OD_CHECK_THRESHOLD) return false;
  // Scale probability: 50% OD risk = 5% chance per tick, 100% = 15%
  const probability = 0.05 + ((odRisk - 50) / 50) * 0.10;
  return rng() < probability;
}

/**
 * Calculate income for a single dealer on a block.
 */
export function calculateDealerIncome(
  memberId: string,
  memberName: string,
  row: number,
  dealingStat: number,
  drugPurity: number,
): DealerIncome {
  const baseIncome = INCOME_CONFIG.BASE_INCOME_PER_DEALER;
  const positionMultiplier = getPositionMultiplier(row);
  const drugMultiplier = getPurityMultiplier(drugPurity);
  const statMultiplier = getDealingStatMultiplier(dealingStat);

  const totalIncome = Math.round(
    baseIncome * positionMultiplier * drugMultiplier * statMultiplier
  );

  return {
    memberId,
    memberName,
    baseIncome,
    positionMultiplier,
    drugMultiplier,
    statMultiplier,
    totalIncome,
  };
}

/**
 * Calculate total income for a block with all its dealers.
 */
export function calculateBlockIncome(
  blockId: string,
  blockName: string,
  dealers: Array<{
    memberId: string;
    memberName: string;
    row: number;
    dealingStat: number;
    drugPurity: number;
    drugOdRisk: number;
    drugName: string;
  }>,
  rng: () => number = Math.random,
): IncomeBreakdown {
  const dealerBreakdowns: DealerIncome[] = [];
  const odEvents: ODEvent[] = [];

  for (const dealer of dealers) {
    const income = calculateDealerIncome(
      dealer.memberId,
      dealer.memberName,
      dealer.row,
      dealer.dealingStat,
      dealer.drugPurity,
    );
    dealerBreakdowns.push(income);

    // Check for OD
    if (checkForOD(dealer.drugOdRisk, rng)) {
      odEvents.push({
        memberId: dealer.memberId,
        memberName: dealer.memberName,
        drugName: dealer.drugName,
        heatSpike: INCOME_CONFIG.OD_HEAT_SPIKE,
      });
    }
  }

  const totalIncome = dealerBreakdowns.reduce((sum, d) => sum + d.totalIncome, 0);

  return {
    blockId,
    blockName,
    totalIncome,
    dealerBreakdowns,
    odEvents,
  };
}

/**
 * Calculate total income across all blocks.
 */
export function calculateTotalIncome(
  blocks: Array<{
    blockId: string;
    blockName: string;
    dealers: Array<{
      memberId: string;
      memberName: string;
      row: number;
      dealingStat: number;
      drugPurity: number;
      drugOdRisk: number;
      drugName: string;
    }>;
  }>,
  rng: () => number = Math.random,
): {
  totalIncome: number;
  blockBreakdowns: IncomeBreakdown[];
  allOdEvents: ODEvent[];
} {
  const blockBreakdowns: IncomeBreakdown[] = [];
  const allOdEvents: ODEvent[] = [];

  for (const block of blocks) {
    const breakdown = calculateBlockIncome(
      block.blockId,
      block.blockName,
      block.dealers,
      rng,
    );
    blockBreakdowns.push(breakdown);
    allOdEvents.push(...breakdown.odEvents);
  }

  const totalIncome = blockBreakdowns.reduce((sum, b) => sum + b.totalIncome, 0);

  return { totalIncome, blockBreakdowns, allOdEvents };
}

/**
 * Estimate income per minute for display purposes.
 */
export function estimateIncomePerMinute(incomePerTick: number): number {
  const ticksPerMinute = 60_000 / INCOME_CONFIG.TICK_INTERVAL_MS;
  return Math.round(incomePerTick * ticksPerMinute);
}
