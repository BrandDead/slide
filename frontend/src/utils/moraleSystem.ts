// ============================================================
// moraleSystem.ts - Gang member morale and loyalty mechanics
// Low morale causes members to not show up, betray, or turn on each other
// ============================================================

export interface MoraleFactors {
  baseMorale: number;          // 0-100
  payOnTime: boolean;          // Did player pay salary?
  memberBailedOut: boolean;    // Did player bail out arrested members?
  hospitalBillPaid: boolean;   // Did player pay for wounded members?
  recentWins: number;          // Combat wins in last 24h
  recentLosses: number;        // Combat losses in last 24h
  memberDeaths: number;        // Deaths in last 24h
  gangSize: number;            // Total active members
  playerReputation: number;    // 0-100
}

export interface MoraleConsequence {
  type: 'no_show' | 'friendly_fire' | 'desertion' | 'betrayal' | 'mutiny';
  probability: number;
  description: string;
  affectedMemberId?: string;
}

// ============ MORALE CONSTANTS ============
export const MORALE_CONFIG = {
  MAX_MORALE: 100,
  MIN_MORALE: 0,
  // Morale thresholds
  HIGH_MORALE: 75,
  NORMAL_MORALE: 50,
  LOW_MORALE: 30,
  CRITICAL_MORALE: 15,
  // Morale modifiers
  SALARY_PAID_BONUS: 5,
  SALARY_MISSED_PENALTY: -15,
  BAIL_PAID_BONUS: 10,
  BAIL_MISSED_PENALTY: -20,
  HOSPITAL_PAID_BONUS: 8,
  HOSPITAL_MISSED_PENALTY: -18,
  WIN_BONUS: 3,
  LOSS_PENALTY: -5,
  DEATH_PENALTY: -10,
  REPUTATION_FACTOR: 0.1,     // reputation * factor added to morale
} as const;

// ============ MORALE FUNCTIONS ============

/**
 * Calculate effective morale for a gang member based on all factors.
 */
export function calculateMorale(factors: MoraleFactors): number {
  let morale = factors.baseMorale;

  // Pay and care modifiers
  if (factors.payOnTime) {
    morale += MORALE_CONFIG.SALARY_PAID_BONUS;
  } else {
    morale += MORALE_CONFIG.SALARY_MISSED_PENALTY;
  }

  if (factors.memberBailedOut) {
    morale += MORALE_CONFIG.BAIL_PAID_BONUS;
  } else {
    morale += MORALE_CONFIG.BAIL_MISSED_PENALTY;
  }

  if (factors.hospitalBillPaid) {
    morale += MORALE_CONFIG.HOSPITAL_PAID_BONUS;
  } else {
    morale += MORALE_CONFIG.HOSPITAL_MISSED_PENALTY;
  }

  // Combat modifiers
  morale += factors.recentWins * MORALE_CONFIG.WIN_BONUS;
  morale += factors.recentLosses * MORALE_CONFIG.LOSS_PENALTY;
  morale += factors.memberDeaths * MORALE_CONFIG.DEATH_PENALTY;

  // Reputation bonus
  morale += factors.playerReputation * MORALE_CONFIG.REPUTATION_FACTOR;

  return Math.max(MORALE_CONFIG.MIN_MORALE, Math.min(MORALE_CONFIG.MAX_MORALE, morale));
}

/**
 * Determine what consequences low morale causes when deploying a member.
 * Called when player sends a member from contacts to the block.
 */
export function getMoraleConsequences(
  morale: number,
  memberId: string,
  rng: () => number = Math.random
): MoraleConsequence[] {
  const consequences: MoraleConsequence[] = [];

  if (morale >= MORALE_CONFIG.HIGH_MORALE) {
    // High morale: no issues, member is loyal
    return [];
  }

  if (morale < MORALE_CONFIG.CRITICAL_MORALE) {
    // Critical: high chance of mutiny or betrayal
    consequences.push({
      type: 'mutiny',
      probability: 0.20,
      description: 'Gang is on the verge of turning on you.',
      affectedMemberId: memberId,
    });
    consequences.push({
      type: 'betrayal',
      probability: 0.15,
      description: 'Member might snitch to the cops.',
      affectedMemberId: memberId,
    });
  }

  if (morale < MORALE_CONFIG.LOW_MORALE) {
    // Low: members might not show up or shoot their own
    consequences.push({
      type: 'no_show',
      probability: 0.30 - (morale / 100),
      description: 'Member might not show up when called.',
      affectedMemberId: memberId,
    });
    consequences.push({
      type: 'friendly_fire',
      probability: 0.10,
      description: 'Member might shoot at their own crew.',
      affectedMemberId: memberId,
    });
  }

  if (morale < MORALE_CONFIG.NORMAL_MORALE) {
    // Below normal: chance of desertion
    consequences.push({
      type: 'desertion',
      probability: 0.10,
      description: 'Member is thinking about leaving the gang.',
      affectedMemberId: memberId,
    });
    consequences.push({
      type: 'no_show',
      probability: 0.15 - (morale / 200),
      description: 'Member might be late or not show.',
      affectedMemberId: memberId,
    });
  }

  return consequences;
}

/**
 * Roll for morale consequences. Returns which consequences actually trigger.
 */
export function rollMoraleConsequences(
  consequences: MoraleConsequence[],
  rng: () => number = Math.random
): MoraleConsequence[] {
  return consequences.filter(c => rng() < c.probability);
}

/**
 * Calculate the morale impact of not bailing out a member.
 * Affects ALL gang members' morale.
 */
export function calculateBailImpact(
  gangSize: number,
  memberName: string
): { moraleChange: number; message: string } {
  // The more members see you abandon someone, the worse it is
  const basePenalty = MORALE_CONFIG.BAIL_MISSED_PENALTY;
  const scaledPenalty = basePenalty * (1 + gangSize * 0.05);
  return {
    moraleChange: Math.round(scaledPenalty),
    message: `You left ${memberName} locked up. The whole crew is watching. Morale dropped by ${Math.abs(Math.round(scaledPenalty))}.`,
  };
}

/**
 * Calculate morale impact of not paying hospital bills.
 */
export function calculateHospitalImpact(
  gangSize: number,
  memberName: string
): { moraleChange: number; message: string } {
  const basePenalty = MORALE_CONFIG.HOSPITAL_MISSED_PENALTY;
  const scaledPenalty = basePenalty * (1 + gangSize * 0.04);
  return {
    moraleChange: Math.round(scaledPenalty),
    message: `${memberName} is bleeding out and you won't pay the bill. The crew doesn't trust you. Morale dropped by ${Math.abs(Math.round(scaledPenalty))}.`,
  };
}

/**
 * Get a description of the current morale state.
 */
export function getMoraleDescription(morale: number): {
  label: string;
  color: string;
  warning: string | null;
} {
  if (morale >= MORALE_CONFIG.HIGH_MORALE) {
    return { label: 'Loyal', color: '#00ff88', warning: null };
  }
  if (morale >= MORALE_CONFIG.NORMAL_MORALE) {
    return { label: 'Steady', color: '#ffd700', warning: null };
  }
  if (morale >= MORALE_CONFIG.LOW_MORALE) {
    return {
      label: 'Uneasy',
      color: '#ff8800',
      warning: 'Members may not follow orders.',
    };
  }
  if (morale >= MORALE_CONFIG.CRITICAL_MORALE) {
    return {
      label: 'Hostile',
      color: '#ff4444',
      warning: 'Gang is turning on each other. Pay your debts.',
    };
  }
  return {
    label: 'Mutiny',
    color: '#ff0000',
    warning: 'Your gang is about to collapse. Members will betray you.',
  };
}
