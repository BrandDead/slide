// ============================================================
// DEALT/SLIDE — Role-Based Weekly Wage Configuration
// Dealers cost the most (they print the money), shooters next,
// down the ladder. All income flows into the Shoebox (bankBalance).
// Weekly dues are drawn from the Shoebox.
//
// Upgraded (Pillar 1): level-based wage scaling + morale/loyalty
// constants for payroll fallout calculations.
// ============================================================

export const ROLE_WAGES: Record<string, number> = {
  dealer:   1000,
  shooter:  800,
  enforcer: 600,
  driver:   500,
  lookout:  400,
  chemist:  700,
  runner:   350,
  cook:     700,
  soldier:  450,
  boss:     1500,
};

/**
 * Wage scaling by member level — a lvl 10 dealer costs more than a rookie.
 * wage = base * (1 + (level - 1) * LEVEL_WAGE_MULTIPLIER)
 */
export const LEVEL_WAGE_MULTIPLIER = 0.05;

/** Morale hit taken by a member who is skipped on payday. */
export const UNPAID_MORALE_HIT = 25;

/** Loyalty hit for being skipped — smaller, but stacks week over week. */
export const UNPAID_LOYALTY_HIT = 10;

/** Small morale bump for members paid on time. Getting paid feels good. */
export const PAID_MORALE_BONUS = 3;

/** Consecutive unpaid weeks before a member considers walking / flipping. */
export const UNPAID_WEEKS_BEFORE_EXIT_RISK = 2;

/**
 * Payroll cycle length in ms.
 * 7 real days = 1 game week by default.
 * Set VITE_SALARY_INTERVAL_MS env var to e.g. 600000 (10 min) for beta testing.
 */
export const PAYROLL_CYCLE_MS = parseInt(
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SALARY_INTERVAL_MS) ?? '604800000',
  10
);

/**
 * Get the weekly wage for a member based on their role.
 * Falls back to $500 if role is unknown.
 */
export function getWageForRole(role: string | undefined): number {
  if (!role) return 500;
  return ROLE_WAGES[role.toLowerCase()] ?? 500;
}

/**
 * Compute a single member's weekly wage with level scaling.
 * wage = base * (1 + (level - 1) * LEVEL_WAGE_MULTIPLIER)
 */
export function computeWage(role: string | undefined, level: number = 1): number {
  const base = getWageForRole(role);
  return Math.round(base * (1 + Math.max(0, level - 1) * LEVEL_WAGE_MULTIPLIER));
}

/**
 * Calculate the total weekly payroll for a set of members (no level scaling).
 */
export function calculateBlockPayroll(
  members: Array<{ role?: string }>
): number {
  return members.reduce((sum, m) => sum + getWageForRole(m.role), 0);
}

/**
 * Calculate payroll for a specific block's deployed members (no level scaling).
 */
export function calculatePerBlockPayroll(
  placements: Array<{ role: string }>
): number {
  return placements.reduce((sum, p) => sum + getWageForRole(p.role), 0);
}
