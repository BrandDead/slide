// ============================================================
// memberProgression.ts - Gang member leveling and progression system
// Members gain XP from missions, dealing, and combat
// High-level members are more effective but generate more heat
// ============================================================

export interface MemberStats {
  shooting: number;    // 0-100: Combat accuracy
  dealing: number;     // 0-100: Deal success rate, bigger deals
  nerve: number;       // 0-100: Stress handling, less panic
  hustle: number;      // 0-100: Money making efficiency
  stealth: number;     // 0-100: Avoiding detection
}

export interface MemberLevel {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
}

export interface LevelUpResult {
  newLevel: number;
  statBoosts: Partial<MemberStats>;
  unlockedAbility?: string;
  heatIncrease: number;  // Higher level = more heat from being on the block
}

// ============ XP CONSTANTS ============
export const XP_CONFIG = {
  // XP required per level (exponential curve)
  BASE_XP: 100,
  XP_MULTIPLIER: 1.5,
  MAX_LEVEL: 50,

  // XP sources
  XP_PER_DEAL: 25,
  XP_PER_KILL: 50,
  XP_PER_SLIDE_WIN: 100,
  XP_PER_DRIVEBY_BLOCK: 75,
  XP_PER_MISSION: 150,
  XP_PER_CRAFT: 30,

  // Stat boost per level
  STAT_BOOST_PER_LEVEL: 2,

  // Heat from high-level members on the block
  HEAT_PER_LEVEL: 0.5,  // Level 20 member = +10 heat/hour on block
  HEAT_THRESHOLD_LEVEL: 10, // Heat penalty starts at level 10
} as const;

// ============ PROGRESSION FUNCTIONS ============

/**
 * Calculate XP required for a given level.
 */
export function xpForLevel(level: number): number {
  return Math.round(XP_CONFIG.BASE_XP * Math.pow(XP_CONFIG.XP_MULTIPLIER, level - 1));
}

/**
 * Calculate total XP required from level 1 to target level.
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Add XP to a member and check for level up.
 */
export function addXp(
  currentLevel: MemberLevel,
  xpGained: number,
  role: 'dealer' | 'shooter' | 'enforcer' | 'driver' | 'chemist'
): { level: MemberLevel; levelUps: LevelUpResult[] } {
  const levelUps: LevelUpResult[] = [];
  let { level, xp, xpToNext, totalXp } = currentLevel;

  xp += xpGained;
  totalXp += xpGained;

  // Check for multiple level ups
  while (xp >= xpToNext && level < XP_CONFIG.MAX_LEVEL) {
    xp -= xpToNext;
    level++;
    xpToNext = xpForLevel(level);

    const levelUp = calculateLevelUp(level, role);
    levelUps.push(levelUp);
  }

  return {
    level: { level, xp, xpToNext, totalXp },
    levelUps,
  };
}

/**
 * Calculate stat boosts and unlocks for a level up.
 */
function calculateLevelUp(
  newLevel: number,
  role: 'dealer' | 'shooter' | 'enforcer' | 'driver' | 'chemist'
): LevelUpResult {
  const boost = XP_CONFIG.STAT_BOOST_PER_LEVEL;
  const statBoosts: Partial<MemberStats> = {};

  // Role-specific primary stat gets double boost
  switch (role) {
    case 'dealer':
      statBoosts.dealing = boost * 2;
      statBoosts.hustle = boost;
      statBoosts.nerve = Math.round(boost * 0.5);
      break;
    case 'shooter':
      statBoosts.shooting = boost * 2;
      statBoosts.nerve = boost;
      statBoosts.stealth = Math.round(boost * 0.5);
      break;
    case 'enforcer':
      statBoosts.shooting = boost;
      statBoosts.nerve = boost * 2;
      statBoosts.hustle = Math.round(boost * 0.5);
      break;
    case 'driver':
      statBoosts.stealth = boost * 2;
      statBoosts.nerve = boost;
      statBoosts.hustle = Math.round(boost * 0.5);
      break;
    case 'chemist':
      statBoosts.hustle = boost * 2;
      statBoosts.stealth = boost;
      statBoosts.nerve = Math.round(boost * 0.5);
      break;
  }

  // Unlock abilities at milestone levels
  const ability = getAbilityUnlock(newLevel, role);

  // Heat increase from being high level
  const heatIncrease = newLevel >= XP_CONFIG.HEAT_THRESHOLD_LEVEL
    ? (newLevel - XP_CONFIG.HEAT_THRESHOLD_LEVEL) * XP_CONFIG.HEAT_PER_LEVEL
    : 0;

  return {
    newLevel,
    statBoosts,
    unlockedAbility: ability,
    heatIncrease,
  };
}

/**
 * Exported ability milestone list for UI display (MemberProgressPanel).
 */
export const ABILITY_MILESTONES: Record<string, Array<{ level: number; ability: string }>> = {
  shooter: [
    { level: 5,  ability: 'Double Tap - Two shots per turn' },
    { level: 10, ability: 'Headshot - 20% instant kill chance' },
    { level: 20, ability: 'Suppressive Fire - 3x3 burst pattern' },
    { level: 30, ability: 'Sniper - Can target specific vehicle parts' },
    { level: 40, ability: 'One Shot One Kill - 50% crit chance' },
    { level: 50, ability: 'Legend - Never misses' },
  ],
  dealer: [
    { level: 5,  ability: 'Smooth Talker - 10% better prices' },
    { level: 10, ability: 'Bulk Deals - Can sell 2x quantity' },
    { level: 20, ability: 'Sixth Sense - Detects undercovers 50% of time' },
    { level: 30, ability: 'Kingpin Deals - Celebrity clients appear more' },
    { level: 40, ability: 'Empire Builder - Passive income +50%' },
    { level: 50, ability: 'Untouchable - Immune to minor raids' },
  ],
  enforcer: [
    { level: 5,  ability: 'Intimidate - Enemies less accurate' },
    { level: 10, ability: 'Bodyguard - Absorbs damage for nearby units' },
    { level: 20, ability: 'Berserker - Double damage when HP < 50%' },
    { level: 30, ability: 'Iron Will - Cannot be one-shot killed' },
    { level: 40, ability: 'Warlord - Boosts all nearby unit damage' },
    { level: 50, ability: 'Immortal - Survives lethal damage once per battle' },
  ],
  driver: [
    { level: 5,  ability: 'Quick Getaway - Escape raids 30% of time' },
    { level: 10, ability: 'Drift - Vehicle harder to hit' },
    { level: 20, ability: 'Ramming Speed - Vehicle deals contact damage' },
    { level: 30, ability: 'Phantom - Vehicle invisible for first 2 turns' },
    { level: 40, ability: 'Speed Demon - Extra attack phase per turn' },
    { level: 50, ability: 'Ghost Rider - Vehicle cannot be destroyed' },
  ],
  chemist: [
    { level: 5,  ability: 'Precise Measurements - +10% purity' },
    { level: 10, ability: 'Batch Processing - Craft 2x quantity' },
    { level: 20, ability: 'Master Cook - Unlock super drug recipes' },
    { level: 30, ability: 'Alchemist - 0% craft failure rate' },
    { level: 40, ability: 'Pharmacist - Reduce OD risk by 50%' },
    { level: 50, ability: 'Heisenberg - All crafts are max purity' },
  ],
};

/**
 * Get ability unlocked at a milestone level.
 */
function getAbilityUnlock(level: number, role: string): string | undefined {
  const milestones: Record<string, Record<number, string>> = {
    shooter: {
      5: 'Double Tap - Two shots per turn',
      10: 'Headshot - 20% instant kill chance',
      20: 'Suppressive Fire - 3x3 burst pattern',
      30: 'Sniper - Can target specific vehicle parts',
      40: 'One Shot One Kill - 50% crit chance',
      50: 'Legend - Never misses',
    },
    dealer: {
      5: 'Smooth Talker - 10% better prices',
      10: 'Bulk Deals - Can sell 2x quantity',
      20: 'Sixth Sense - Detects undercovers 50% of time',
      30: 'Kingpin Deals - Celebrity clients appear more',
      40: 'Empire Builder - Passive income +50%',
      50: 'Untouchable - Immune to minor raids',
    },
    enforcer: {
      5: 'Intimidate - Enemies less accurate',
      10: 'Bodyguard - Absorbs damage for nearby units',
      20: 'Berserker - Double damage when HP < 50%',
      30: 'Iron Will - Cannot be one-shot killed',
      40: 'Warlord - Boosts all nearby unit damage',
      50: 'Immortal - Survives lethal damage once per battle',
    },
    driver: {
      5: 'Quick Getaway - Escape raids 30% of time',
      10: 'Drift - Vehicle harder to hit',
      20: 'Ramming Speed - Vehicle deals contact damage',
      30: 'Phantom - Vehicle invisible for first 2 turns',
      40: 'Speed Demon - Extra attack phase per turn',
      50: 'Ghost Rider - Vehicle cannot be destroyed',
    },
    chemist: {
      5: 'Precise Measurements - +10% purity',
      10: 'Batch Processing - Craft 2x quantity',
      20: 'Master Cook - Unlock super drug recipes',
      30: 'Alchemist - 0% craft failure rate',
      40: 'Pharmacist - Reduce OD risk by 50%',
      50: 'Heisenberg - All crafts are max purity',
    },
  };

  return milestones[role]?.[level];
}

/**
 * Calculate the heat generated by a member being on a block.
 * High-level members attract attention.
 */
export function getMemberHeatContribution(level: number): number {
  if (level < XP_CONFIG.HEAT_THRESHOLD_LEVEL) return 0;
  return (level - XP_CONFIG.HEAT_THRESHOLD_LEVEL) * XP_CONFIG.HEAT_PER_LEVEL;
}

/**
 * Calculate dealing effectiveness based on member stats.
 * Returns multipliers for price and success rate.
 */
export function getDealingEffectiveness(stats: MemberStats): {
  priceMultiplier: number;
  successRateBonus: number;
  bulkDealChance: number;
} {
  return {
    priceMultiplier: 1.0 + (stats.dealing / 200),     // Max 1.5x at 100 dealing
    successRateBonus: stats.hustle / 5,                 // Max +20% at 100 hustle
    bulkDealChance: stats.dealing / 500,                // Max 20% at 100 dealing
  };
}

/**
 * Calculate shooting effectiveness based on member stats.
 * Returns accuracy and damage modifiers.
 */
export function getShootingEffectiveness(stats: MemberStats): {
  accuracyBonus: number;
  damageMultiplier: number;
  critChance: number;
} {
  return {
    accuracyBonus: stats.shooting / 2,                  // Max +50% at 100 shooting
    damageMultiplier: 1.0 + (stats.shooting / 200),     // Max 1.5x at 100 shooting
    critChance: stats.nerve / 500,                       // Max 20% at 100 nerve
  };
}

/**
 * Create initial member level state.
 */
export function createInitialLevel(): MemberLevel {
  return {
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    totalXp: 0,
  };
}

// ============================================================
// ROLE UPGRADE & GIFTING SYSTEM (added in role-mechanics sprint)
// ============================================================

import {
  UPGRADE_PATHS,
  GIFT_CATALOG,
  canUpgradeToRole,
  getShooterTier,
  SHOOTER_TIER_LABELS,
  type MemberRole,
  type GiftItem,
  type UpgradePath,
} from '../config/roleMechanics';

// ─── ROLE UPGRADE HELPERS ────────────────────────────────────

export interface RoleUpgradeResult {
  success: boolean;
  newRole?: MemberRole;
  cost?: number;
  reason?: string;
  description?: string;
}

/**
 * Attempt to upgrade a member to a new role.
 */
export function attemptRoleUpgrade(
  currentRole: MemberRole,
  targetRole: MemberRole,
  level: number,
  completedMissions: number,
  playerMoney: number,
): RoleUpgradeResult {
  const check = canUpgradeToRole(currentRole, targetRole, level, completedMissions, playerMoney);
  if (!check.eligible) {
    return { success: false, reason: check.reason };
  }
  const path = UPGRADE_PATHS.find((p) => p.fromRole === currentRole && p.toRole === targetRole)!;
  return {
    success: true,
    newRole: targetRole,
    cost: path.cost,
    description: path.description,
  };
}

/**
 * Get all available upgrade paths for a member.
 */
export function getAvailableUpgrades(
  currentRole: MemberRole,
  level: number,
  completedMissions: number,
  playerMoney: number,
): Array<UpgradePath & { eligible: boolean; reason?: string }> {
  return UPGRADE_PATHS
    .filter((p) => p.fromRole === currentRole)
    .map((path) => {
      const check = canUpgradeToRole(currentRole, path.toRole, level, completedMissions, playerMoney);
      return { ...path, eligible: check.eligible, reason: check.reason };
    });
}

// ─── GIFTING SYSTEM ──────────────────────────────────────────

export interface GiftResult {
  success: boolean;
  moraleGained: number;
  xpGained: number;
  cost: number;
  message: string;
}

/**
 * Apply a gift to a member. Returns morale and XP gains.
 */
export function applyGift(
  giftId: string,
  memberName: string,
  playerMoney: number,
): GiftResult {
  const gift = GIFT_CATALOG.find((g) => g.id === giftId);
  if (!gift) {
    return { success: false, moraleGained: 0, xpGained: 0, cost: 0, message: 'Gift not found.' };
  }
  if (playerMoney < gift.cost) {
    return {
      success: false,
      moraleGained: 0,
      xpGained: 0,
      cost: gift.cost,
      message: `Not enough money. ${gift.name} costs $${gift.cost.toLocaleString()}.`,
    };
  }
  return {
    success: true,
    moraleGained: gift.moraleBonus,
    xpGained: gift.xpBonus,
    cost: gift.cost,
    message: `${memberName} got a ${gift.name}. +${gift.moraleBonus} morale, +${gift.xpBonus} XP.`,
  };
}

/**
 * Get all gifts available within a budget.
 */
export function getAffordableGifts(budget: number): GiftItem[] {
  return GIFT_CATALOG.filter((g) => g.cost <= budget);
}

// ─── SHOOTER TIER LABEL HELPER ───────────────────────────────

/**
 * Get the display tier label for a shooter at a given level.
 */
export function getShooterTierLabel(level: number): string {
  return SHOOTER_TIER_LABELS[getShooterTier(level)];
}
