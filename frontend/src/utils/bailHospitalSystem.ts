// ============================================================
// SLIDE — Bail & Hospital System  (Sprint 14-B, Task 2)
// frontend/src/utils/bailHospitalSystem.ts
//
// Handles the cost and wait-time logic for getting jailed or injured
// gang members back to the block.
//
// DESIGN (per player spec):
//   • Base cost scales with severity — how much damage was taken
//     (hospital) or how many charges were filed (bail).
//   • Repeat offenses compound cost and wait time — a member who has
//     been arrested 3 times before is harder and more expensive to
//     spring than someone who caught their first case.
//   • The player can pay to skip the wait entirely. The amount of time
//     they wait without paying depends on the same severity + history
//     factors.
//   • Members not bailed / treated past the grace period bleed morale.
//
// Pure and store-free — the component / game loop owns state, this
// module owns the rules.
// ============================================================

import type { GangMember, MemberStatus } from '../types/game.types';

// ─── Config ──────────────────────────────────────────────────

export const RECOVERY_CONFIG = {
  // ── Base costs ──────────────────────────────────────────
  /** Minimum bail cost (first offense, minor charges). */
  BAIL_BASE_COST: 1_500,
  /** Minimum hospital cost (light injuries). */
  HOSPITAL_BASE_COST: 800,

  // ── Severity multipliers ────────────────────────────────
  /**
   * Each severity tier (0-4) multiplies the base cost.
   * Tier 0 = minor, Tier 4 = critical / life sentence risk.
   */
  SEVERITY_COST_MULTIPLIERS: [1.0, 1.5, 2.5, 4.0, 7.0] as const,

  // ── Repeat-offense scaling ──────────────────────────────
  /**
   * Each prior arrest / hospitalization adds this fraction to the cost.
   * e.g., 0.25 means a third arrest (priorCount=2) costs 1 + 2*0.25 = 1.5×.
   */
  REPEAT_COST_FACTOR: 0.25,
  /**
   * Hard cap on the repeat multiplier so costs don't become impossible.
   * A member with 10+ priors still has a finite cost.
   */
  REPEAT_COST_CAP: 3.0,

  // ── Wait times (in game ticks) ───────────────────────────
  /** Base wait ticks for bail (first offense, minor charges). */
  BAIL_BASE_WAIT_TICKS: 6,
  /** Base wait ticks for hospital (light injuries). */
  HOSPITAL_BASE_WAIT_TICKS: 3,
  /** Each severity tier adds this many ticks to the base wait. */
  SEVERITY_WAIT_TICKS_PER_TIER: 4,
  /** Each prior offense adds this many ticks to the wait. */
  REPEAT_WAIT_TICKS_PER_PRIOR: 2,
  /**
   * Hard cap on total wait ticks. A member caught too many times will
   * eventually be in jail for life — represented here as a very long
   * wait that the player cannot afford to skip.
   */
  WAIT_TICKS_CAP: 60,
  /**
   * If a member has been arrested this many times or more, they are
   * considered a "lifer" — the system still quotes a cost and wait, but
   * the UI should warn the player that release is unlikely.
   */
  LIFER_ARREST_THRESHOLD: 5,

  // ── Abandonment ─────────────────────────────────────────
  /** Ticks a member can sit unrecovered before the crew reacts. */
  ABANDON_GRACE_TICKS: 3,
  /** Morale lost per abandoned member, as a percentage of current. */
  ABANDON_MORALE_PENALTY_PCT: 5,

  // ── Legacy flat costs (kept for backward compat) ────────
  /** @deprecated Use scaledBailCost() instead. */
  BAIL_COST: 5_000,
  /** @deprecated Use scaledHospitalCost() instead. */
  HOSPITAL_COST: 2_000,
} as const;

// ─── Severity ────────────────────────────────────────────────

/**
 * Severity tier 0-4.
 *
 * For bail: derived from arrest count in a single incident (charges).
 * For hospital: derived from damage taken (0-100 health lost).
 */
export type SeverityTier = 0 | 1 | 2 | 3 | 4;

/**
 * Map a raw severity value to a tier.
 *
 * @param value  - For bail: number of charges (0-10+).
 *                 For hospital: health damage taken (0-100).
 * @param kind   - 'bail' or 'hospital' (different thresholds).
 */
export function severityTier(value: number, kind: RecoveryKind): SeverityTier {
  if (kind === 'bail') {
    // charges: 0 = minor, 1-2 = moderate, 3-4 = serious, 5-6 = major, 7+ = critical
    if (value <= 0) return 0;
    if (value <= 2) return 1;
    if (value <= 4) return 2;
    if (value <= 6) return 3;
    return 4;
  } else {
    // health damage: <20 = minor, 20-39 = moderate, 40-59 = serious, 60-79 = major, 80+ = critical
    if (value < 20) return 0;
    if (value < 40) return 1;
    if (value < 60) return 2;
    if (value < 80) return 3;
    return 4;
  }
}

// ─── Types ───────────────────────────────────────────────────

export type RecoveryKind = 'bail' | 'hospital';

/** Statuses recoverable by posting bail. */
const JAILED_STATUSES: MemberStatus[] = ['jailed', 'arrested'];
/** Statuses recoverable by paying medical bills. */
const INJURED_STATUSES: MemberStatus[] = ['injured', 'hospitalized', 'hospital'];

// ─── Status helpers ──────────────────────────────────────────

export function isJailed(member: Pick<GangMember, 'status'>): boolean {
  return JAILED_STATUSES.includes(member.status);
}

export function isInjured(member: Pick<GangMember, 'status'>): boolean {
  return INJURED_STATUSES.includes(member.status);
}

/** Members needing recovery. Dead and backdoored members are not on this list. */
export function needsRecovery(member: Pick<GangMember, 'status'>): boolean {
  return isJailed(member) || isInjured(member);
}

export function recoveryKindFor(
  member: Pick<GangMember, 'status'>,
): RecoveryKind | null {
  if (isJailed(member)) return 'bail';
  if (isInjured(member)) return 'hospital';
  return null;
}

// ─── Scaled cost ─────────────────────────────────────────────

/**
 * Compute the bail cost for a jailed member.
 *
 * @param charges   - Number of charges filed (determines severity tier).
 * @param priorArrests - Number of times this member has been arrested before.
 */
export function scaledBailCost(charges: number, priorArrests: number): number {
  const tier = severityTier(charges, 'bail');
  const severityMult = RECOVERY_CONFIG.SEVERITY_COST_MULTIPLIERS[tier];
  const repeatMult = Math.min(
    RECOVERY_CONFIG.REPEAT_COST_CAP,
    1 + priorArrests * RECOVERY_CONFIG.REPEAT_COST_FACTOR,
  );
  return Math.round(RECOVERY_CONFIG.BAIL_BASE_COST * severityMult * repeatMult);
}

/**
 * Compute the hospital cost for an injured member.
 *
 * @param damageTaken   - Health lost (0-100).
 * @param priorInjuries - Number of times this member has been hospitalized before.
 */
export function scaledHospitalCost(damageTaken: number, priorInjuries: number): number {
  const tier = severityTier(damageTaken, 'hospital');
  const severityMult = RECOVERY_CONFIG.SEVERITY_COST_MULTIPLIERS[tier];
  const repeatMult = Math.min(
    RECOVERY_CONFIG.REPEAT_COST_CAP,
    1 + priorInjuries * RECOVERY_CONFIG.REPEAT_COST_FACTOR,
  );
  return Math.round(RECOVERY_CONFIG.HOSPITAL_BASE_COST * severityMult * repeatMult);
}

/**
 * Flat cost for a member (legacy path, uses status only).
 * Prefer scaledBailCost / scaledHospitalCost when severity data is available.
 */
export function recoveryCost(member: Pick<GangMember, 'status'>): number {
  const kind = recoveryKindFor(member);
  if (kind === 'bail') return RECOVERY_CONFIG.BAIL_COST;
  if (kind === 'hospital') return RECOVERY_CONFIG.HOSPITAL_COST;
  return 0;
}

// ─── Wait time ───────────────────────────────────────────────

/**
 * Compute how many game ticks a member must wait before they are
 * automatically released (without the player paying).
 *
 * @param kind         - 'bail' or 'hospital'.
 * @param severityValue - Charges (bail) or damage taken (hospital).
 * @param priorCount    - Prior arrests (bail) or prior hospitalizations (hospital).
 */
export function waitTicks(
  kind: RecoveryKind,
  severityValue: number,
  priorCount: number,
): number {
  const tier = severityTier(severityValue, kind);
  const base =
    kind === 'bail'
      ? RECOVERY_CONFIG.BAIL_BASE_WAIT_TICKS
      : RECOVERY_CONFIG.HOSPITAL_BASE_WAIT_TICKS;
  const severityAdd = tier * RECOVERY_CONFIG.SEVERITY_WAIT_TICKS_PER_TIER;
  const repeatAdd = priorCount * RECOVERY_CONFIG.REPEAT_WAIT_TICKS_PER_PRIOR;
  return Math.min(RECOVERY_CONFIG.WAIT_TICKS_CAP, base + severityAdd + repeatAdd);
}

/**
 * True if a member's arrest history qualifies them as a "lifer" —
 * the system still quotes costs, but the UI should warn the player.
 */
export function isLifer(member: Pick<GangMember, 'arrests'>): boolean {
  return member.arrests >= RECOVERY_CONFIG.LIFER_ARREST_THRESHOLD;
}

// ─── Quote ───────────────────────────────────────────────────

export interface RecoveryQuote {
  memberId: string;
  memberName: string;
  kind: RecoveryKind;
  /** Cost to pay now and skip the wait entirely. */
  cost: number;
  affordable: boolean;
  /** Ticks this member has been out of action, when tracked. */
  ticksHeld: number;
  /** True once the grace period has lapsed and morale is bleeding. */
  costingMorale: boolean;
  /** Ticks remaining before automatic release (if player does not pay). */
  waitTicksRemaining: number;
  /** True if the member's history makes them unlikely to be released. */
  lifer: boolean;
  /** Severity tier (0-4) for UI display. */
  severityTier: SeverityTier;
}

/**
 * Full recovery quote for a member.
 *
 * @param member        - The gang member.
 * @param playerMoney   - Current player balance.
 * @param ticksHeld     - How many ticks this member has been detained.
 * @param severityValue - Charges filed (bail) or damage taken (hospital).
 *                        Defaults to 0 (minimum cost) when not provided.
 */
export function quoteRecovery(
  member: Pick<GangMember, 'id' | 'name' | 'status' | 'arrests'> & {
    /** Number of prior hospitalizations, if available. */
    priorInjuries?: number;
  },
  playerMoney: number,
  ticksHeld = 0,
  severityValue = 0,
): RecoveryQuote | null {
  const kind = recoveryKindFor(member);
  if (!kind) return null;

  const priorCount =
    kind === 'bail' ? (member.arrests ?? 0) : (member.priorInjuries ?? 0);

  const cost =
    kind === 'bail'
      ? scaledBailCost(severityValue, priorCount)
      : scaledHospitalCost(severityValue, priorCount);

  const totalWait = waitTicks(kind, severityValue, priorCount);
  const waitTicksRemaining = Math.max(0, totalWait - ticksHeld);
  const tier = severityTier(severityValue, kind);

  return {
    memberId: member.id,
    memberName: member.name,
    kind,
    cost,
    affordable: playerMoney >= cost,
    ticksHeld,
    costingMorale: ticksHeld > RECOVERY_CONFIG.ABANDON_GRACE_TICKS,
    waitTicksRemaining,
    lifer: isLifer(member),
    severityTier: tier,
  };
}

// ─── Abandonment penalty ─────────────────────────────────────

/**
 * Members held past the grace period.
 *
 * `heldSince` maps memberId to the tick they went down. Anyone missing
 * from it is treated as newly detained rather than instantly overdue —
 * a member captured before tick tracking existed should not trigger a
 * penalty the moment the feature ships.
 */
export function overdueMembers(
  members: Array<Pick<GangMember, 'id' | 'status'>>,
  heldSince: Record<string, number>,
  currentTick: number,
): string[] {
  return members
    .filter((m) => needsRecovery(m))
    .filter((m) => {
      const since = heldSince[m.id];
      if (since === undefined) return false;
      return currentTick - since > RECOVERY_CONFIG.ABANDON_GRACE_TICKS;
    })
    .map((m) => m.id);
}

/**
 * Morale after applying the penalty for abandoned members.
 *
 * Percentage of current, compounded per member, so abandoning four
 * people hurts more than abandoning one but never zeroes morale
 * outright — a crew that feels bad is still a crew.
 */
export function applyAbandonmentPenalty(
  currentMorale: number,
  abandonedCount: number,
): number {
  if (abandonedCount <= 0) return currentMorale;
  const factor = 1 - RECOVERY_CONFIG.ABANDON_MORALE_PENALTY_PCT / 100;
  const next = currentMorale * Math.pow(factor, abandonedCount);
  return Math.max(0, Math.round(next));
}

/**
 * Track when members went down.
 *
 * Returns a new map: newly-down members get stamped with the current
 * tick, recovered members are dropped so a second stint starts its own
 * grace period rather than inheriting the first one's clock.
 */
export function updateHeldSince(
  members: Array<Pick<GangMember, 'id' | 'status'>>,
  heldSince: Record<string, number>,
  currentTick: number,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const member of members) {
    if (!needsRecovery(member)) continue;
    next[member.id] = heldSince[member.id] ?? currentTick;
  }
  return next;
}
