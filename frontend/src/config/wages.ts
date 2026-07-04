// ============================================================
// DEALT/SLIDE — Role-Based Weekly Wage Configuration
// Dealers cost the most, shooters next, then down the line.
// All income flows into the Shoebox (bankBalance).
// Weekly dues are drawn from the Shoebox.
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
 * Get the weekly wage for a member based on their role.
 * Falls back to $500 if role is unknown.
 */
export function getWageForRole(role: string | undefined): number {
  if (!role) return 500;
  return ROLE_WAGES[role.toLowerCase()] ?? 500;
}

/**
 * Calculate the total weekly payroll for a set of members.
 */
export function calculateBlockPayroll(
  members: Array<{ role?: string }>
): number {
  return members.reduce((sum, m) => sum + getWageForRole(m.role), 0);
}

/**
 * Calculate payroll for a specific block's deployed members.
 */
export function calculatePerBlockPayroll(
  placements: Array<{ role: string }>
): number {
  return placements.reduce((sum, p) => sum + getWageForRole(p.role), 0);
}
