// ============================================================
// recruitEngine.ts — Recruit intel, recon, and vandalism mechanics
//
// Recruits are the EYES of the block. They:
//   1. SPOT SURVEILLANCE — detect if a rival is watching the block
//   2. STEAL CARS — provide a vehicle for a drive-by attack
//   3. VANDALIZE OPP BLOCKS — raise heat on enemy territory
//   4. SCOUT BLOCKS — reveal member positions on an enemy block
//
// Recruits hold RECON TOOLS only (binoculars, burner phones, spray cans).
// They cannot shoot and do not generate income.
// ============================================================

// Recruit action constants (inline since roleMechanics.ts was rewritten)
export const RECRUIT_ACTIONS = {
  SPOT_SURVEILLANCE: 'spot_surveillance' as const,
  STEAL_CAR:         'steal_car' as const,
  VANDALIZE_BLOCK:   'vandalize_block' as const,
  SCOUT_BLOCK:       'scout_block' as const,
};
export type RecruitAction = typeof RECRUIT_ACTIONS[keyof typeof RECRUIT_ACTIONS];

export interface RecruitMission {
  id: string;
  recruitId: string;
  recruitName: string;
  action: RecruitAction;
  targetBlockId?: string;
  startedAt: number;
  completesAt: number;
  status: 'pending' | 'in_progress' | 'complete' | 'failed' | 'busted';
}

export interface RecruitMissionResult {
  success: boolean;
  action: RecruitAction;
  message: string;
  // Spot surveillance
  surveillanceDetected?: boolean;
  // Steal car
  vehicleType?: string;
  // Vandalize block
  heatAdded?: number;
  // Scout block
  revealedPositions?: Array<{ role: string; row: number; col: number }>;
  // Failure
  recruitBusted?: boolean;
}

// Mission duration in milliseconds
const MISSION_DURATIONS: Record<RecruitAction, number> = {
  [RECRUIT_ACTIONS.SPOT_SURVEILLANCE]: 2 * 60 * 1000,   // 2 minutes
  [RECRUIT_ACTIONS.STEAL_CAR]:         5 * 60 * 1000,   // 5 minutes
  [RECRUIT_ACTIONS.VANDALIZE_BLOCK]:   8 * 60 * 1000,   // 8 minutes
  [RECRUIT_ACTIONS.SCOUT_BLOCK]:       10 * 60 * 1000,  // 10 minutes
};

// Base success probability per action
const BASE_SUCCESS_RATE: Record<RecruitAction, number> = {
  [RECRUIT_ACTIONS.SPOT_SURVEILLANCE]: 0.85,
  [RECRUIT_ACTIONS.STEAL_CAR]:         0.70,
  [RECRUIT_ACTIONS.VANDALIZE_BLOCK]:   0.60,
  [RECRUIT_ACTIONS.SCOUT_BLOCK]:       0.55,
};

// Bust probability on failure
const BUST_ON_FAIL_RATE: Record<RecruitAction, number> = {
  [RECRUIT_ACTIONS.SPOT_SURVEILLANCE]: 0.05,
  [RECRUIT_ACTIONS.STEAL_CAR]:         0.20,
  [RECRUIT_ACTIONS.VANDALIZE_BLOCK]:   0.35,
  [RECRUIT_ACTIONS.SCOUT_BLOCK]:       0.25,
};

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Minivan', 'Pickup Truck', 'Muscle Car'];

/**
 * Create a new recruit mission.
 * Level increases success rate (+3% per level).
 */
export function createRecruitMission(
  recruitId: string,
  recruitName: string,
  action: RecruitAction,
  targetBlockId?: string,
): RecruitMission {
  const now = Date.now();
  return {
    id: `rm-${now}-${Math.random().toString(36).slice(2, 7)}`,
    recruitId,
    recruitName,
    action,
    targetBlockId,
    startedAt: now,
    completesAt: now + MISSION_DURATIONS[action],
    status: 'in_progress',
  };
}

/**
 * Resolve a recruit mission when its timer expires.
 * Level bonus: +3% success rate per level above 1.
 */
export function resolveRecruitMission(
  mission: RecruitMission,
  recruitLevel: number,
  rng: () => number = Math.random,
): RecruitMissionResult {
  const levelBonus = (recruitLevel - 1) * 0.03;
  const successRate = Math.min(0.95, BASE_SUCCESS_RATE[mission.action] + levelBonus);
  const roll = rng();
  const success = roll < successRate;

  if (!success) {
    const bustRoll = rng();
    const busted = bustRoll < BUST_ON_FAIL_RATE[mission.action];
    return {
      success: false,
      action: mission.action,
      message: busted
        ? `${mission.recruitName} got caught and arrested!`
        : `${mission.recruitName} came back empty-handed.`,
      recruitBusted: busted,
    };
  }

  // Build success result per action type
  switch (mission.action) {
    case RECRUIT_ACTIONS.SPOT_SURVEILLANCE: {
      const detected = rng() < 0.4;  // 40% chance there actually IS surveillance
      return {
        success: true,
        action: mission.action,
        surveillanceDetected: detected,
        message: detected
          ? `${mission.recruitName} spotted a car watching the block. Stay low.`
          : `${mission.recruitName} checked the block. All clear — no surveillance.`,
      };
    }

    case RECRUIT_ACTIONS.STEAL_CAR: {
      const vehicle = VEHICLE_TYPES[Math.floor(rng() * VEHICLE_TYPES.length)];
      return {
        success: true,
        action: mission.action,
        vehicleType: vehicle,
        message: `${mission.recruitName} boosted a ${vehicle}. Ready for a slide.`,
      };
    }

    case RECRUIT_ACTIONS.VANDALIZE_BLOCK: {
      const heatAdded = Math.round(10 + rng() * 15);  // 10-25 heat
      return {
        success: true,
        action: mission.action,
        heatAdded,
        message: `${mission.recruitName} hit their block. +${heatAdded} heat on the opps.`,
      };
    }

    case RECRUIT_ACTIONS.SCOUT_BLOCK: {
      // Reveal 2-4 random positions (simulated)
      const count = 2 + Math.floor(rng() * 3);
      const roles = ['dealer', 'shooter', 'enforcer', 'recruit'];
      const revealedPositions = Array.from({ length: count }, () => ({
        role: roles[Math.floor(rng() * roles.length)],
        row: Math.floor(rng() * 8),
        col: Math.floor(rng() * 8),
      }));
      return {
        success: true,
        action: mission.action,
        revealedPositions,
        message: `${mission.recruitName} scoped out the block. ${count} positions revealed.`,
      };
    }

    default:
      return { success: true, action: mission.action, message: 'Mission complete.' };
  }
}
