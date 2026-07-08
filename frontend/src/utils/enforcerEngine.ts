// ============================================================
// enforcerEngine.ts — Enforcer patrol and strong-arm mechanics
//
// Enforcers do NOT hold drugs or weapons.
// They patrol the block, providing:
//   1. Small passive income per tick (strong-arming low-dollar earners)
//   2. Passive heat reduction (keeping order, less visible dealing)
//   3. Combat bonus to the block's defense during raids/drive-bys
// ============================================================

import {
  ENFORCER_PATROL_INCOME_PER_TICK,
  ENFORCER_HEAT_REDUCTION_PER_TICK,
} from '../config/roleMechanics';

export interface EnforcerContribution {
  memberId: string;
  memberName: string;
  patrolIncome: number;
  heatReduction: number;
  defenseBonus: number;  // % bonus to block defense during combat
}

/**
 * Calculate the contribution of a single enforcer on a block per tick.
 * Level scales both income and defense bonus.
 */
export function calculateEnforcerContribution(
  memberId: string,
  memberName: string,
  level: number,
  row: number,  // position on block (closer to street = more visible = more income)
): EnforcerContribution {
  // Level multiplier: level 1 = 1.0x, level 10 = 2.0x
  const levelMult = 1.0 + (level - 1) * 0.1;

  // Position multiplier: closer to street = more strong-arming opportunities
  const positionMult = 0.8 + (row / 7) * 0.4;  // 0.8 to 1.2

  const patrolIncome = Math.round(
    ENFORCER_PATROL_INCOME_PER_TICK * levelMult * positionMult
  );

  const heatReduction = ENFORCER_HEAT_REDUCTION_PER_TICK;

  // Defense bonus: 5% per level, capped at 40%
  const defenseBonus = Math.min(40, level * 5);

  return {
    memberId,
    memberName,
    patrolIncome,
    heatReduction,
    defenseBonus,
  };
}

/**
 * Calculate total enforcer contributions for a block.
 */
export function calculateBlockEnforcerContributions(
  enforcers: Array<{
    memberId: string;
    memberName: string;
    level: number;
    row: number;
  }>
): {
  totalPatrolIncome: number;
  totalHeatReduction: number;
  totalDefenseBonus: number;
  contributions: EnforcerContribution[];
} {
  const contributions = enforcers.map((e) =>
    calculateEnforcerContribution(e.memberId, e.memberName, e.level, e.row)
  );

  return {
    totalPatrolIncome: contributions.reduce((sum, c) => sum + c.patrolIncome, 0),
    totalHeatReduction: contributions.reduce((sum, c) => sum + c.heatReduction, 0),
    totalDefenseBonus: Math.min(60, contributions.reduce((sum, c) => sum + c.defenseBonus, 0)),
    contributions,
  };
}
