/**
 * bailHospitalSystem — tests (Sprint 14-B)
 *
 * Covers the new severity/repeat-offense cost scaling and wait-time
 * system, plus the existing abandonment penalty and detention tracking.
 */
import { describe, it, expect } from 'vitest';
import {
  RECOVERY_CONFIG,
  isJailed,
  isInjured,
  needsRecovery,
  recoveryKindFor,
  recoveryCost,
  severityTier,
  scaledBailCost,
  scaledHospitalCost,
  waitTicks,
  isLifer,
  quoteRecovery,
  overdueMembers,
  applyAbandonmentPenalty,
  updateHeldSince,
  type RecoveryKind,
} from '../bailHospitalSystem';
import type { GangMember } from '../../types/game.types';

// ─── Fixtures ────────────────────────────────────────────────

function member(
  id: string,
  status: GangMember['status'],
  arrests = 0,
  priorInjuries = 0,
): Pick<GangMember, 'id' | 'name' | 'status' | 'arrests'> & { priorInjuries?: number } {
  return { id, name: `Member ${id}`, status, arrests, priorInjuries };
}

// ─── Status helpers ───────────────────────────────────────────

describe('bailHospital — status helpers', () => {
  it('treats jailed and arrested as bail cases', () => {
    expect(isJailed(member('a', 'jailed'))).toBe(true);
    expect(isJailed(member('a', 'arrested'))).toBe(true);
  });

  it('treats the three injury statuses as hospital cases', () => {
    expect(isInjured(member('a', 'injured'))).toBe(true);
    expect(isInjured(member('a', 'hospitalized'))).toBe(true);
    expect(isInjured(member('a', 'hospital'))).toBe(true);
  });

  it('an active member needs nothing', () => {
    expect(needsRecovery(member('a', 'active'))).toBe(false);
    expect(recoveryKindFor(member('a', 'active'))).toBeNull();
  });

  it('a dead member is not recoverable — bail does not resurrect', () => {
    expect(needsRecovery(member('a', 'dead'))).toBe(false);
    expect(recoveryCost(member('a', 'dead'))).toBe(0);
  });

  it('a backdoored member is not recoverable', () => {
    expect(needsRecovery(member('a', 'backdoored'))).toBe(false);
  });
});

// ─── severityTier ─────────────────────────────────────────────

describe('severityTier — bail', () => {
  it('0 charges → tier 0 (minor)', () => {
    expect(severityTier(0, 'bail')).toBe(0);
  });

  it('1-2 charges → tier 1 (moderate)', () => {
    expect(severityTier(1, 'bail')).toBe(1);
    expect(severityTier(2, 'bail')).toBe(1);
  });

  it('3-4 charges → tier 2 (serious)', () => {
    expect(severityTier(3, 'bail')).toBe(2);
    expect(severityTier(4, 'bail')).toBe(2);
  });

  it('5-6 charges → tier 3 (major)', () => {
    expect(severityTier(5, 'bail')).toBe(3);
    expect(severityTier(6, 'bail')).toBe(3);
  });

  it('7+ charges → tier 4 (critical)', () => {
    expect(severityTier(7, 'bail')).toBe(4);
    expect(severityTier(20, 'bail')).toBe(4);
  });
});

describe('severityTier — hospital', () => {
  it('<20 damage → tier 0 (minor)', () => {
    expect(severityTier(0, 'hospital')).toBe(0);
    expect(severityTier(19, 'hospital')).toBe(0);
  });

  it('20-39 damage → tier 1 (moderate)', () => {
    expect(severityTier(20, 'hospital')).toBe(1);
    expect(severityTier(39, 'hospital')).toBe(1);
  });

  it('40-59 damage → tier 2 (serious)', () => {
    expect(severityTier(40, 'hospital')).toBe(2);
    expect(severityTier(59, 'hospital')).toBe(2);
  });

  it('60-79 damage → tier 3 (major)', () => {
    expect(severityTier(60, 'hospital')).toBe(3);
    expect(severityTier(79, 'hospital')).toBe(3);
  });

  it('80+ damage → tier 4 (critical)', () => {
    expect(severityTier(80, 'hospital')).toBe(4);
    expect(severityTier(100, 'hospital')).toBe(4);
  });
});

// ─── scaledBailCost ───────────────────────────────────────────

describe('scaledBailCost', () => {
  it('first offense, no charges → base cost', () => {
    expect(scaledBailCost(0, 0)).toBe(RECOVERY_CONFIG.BAIL_BASE_COST);
  });

  it('increases with severity tier', () => {
    const tier0 = scaledBailCost(0, 0);
    const tier2 = scaledBailCost(3, 0);
    const tier4 = scaledBailCost(7, 0);
    expect(tier2).toBeGreaterThan(tier0);
    expect(tier4).toBeGreaterThan(tier2);
  });

  it('increases with prior arrests', () => {
    const first = scaledBailCost(0, 0);
    const third = scaledBailCost(0, 2);
    expect(third).toBeGreaterThan(first);
  });

  it('repeat multiplier is capped', () => {
    const manyPriors = scaledBailCost(0, 100);
    const capCost = Math.round(
      RECOVERY_CONFIG.BAIL_BASE_COST *
        RECOVERY_CONFIG.SEVERITY_COST_MULTIPLIERS[0] *
        RECOVERY_CONFIG.REPEAT_COST_CAP,
    );
    expect(manyPriors).toBe(capCost);
  });

  it('tier 4 with cap priors is the most expensive possible bail', () => {
    const max = scaledBailCost(10, 100);
    const expected = Math.round(
      RECOVERY_CONFIG.BAIL_BASE_COST *
        RECOVERY_CONFIG.SEVERITY_COST_MULTIPLIERS[4] *
        RECOVERY_CONFIG.REPEAT_COST_CAP,
    );
    expect(max).toBe(expected);
  });
});

// ─── scaledHospitalCost ───────────────────────────────────────

describe('scaledHospitalCost', () => {
  it('light injury, first time → base cost', () => {
    expect(scaledHospitalCost(0, 0)).toBe(RECOVERY_CONFIG.HOSPITAL_BASE_COST);
  });

  it('increases with damage taken', () => {
    const light = scaledHospitalCost(10, 0);
    const critical = scaledHospitalCost(90, 0);
    expect(critical).toBeGreaterThan(light);
  });

  it('increases with prior injuries', () => {
    const first = scaledHospitalCost(30, 0);
    const repeat = scaledHospitalCost(30, 3);
    expect(repeat).toBeGreaterThan(first);
  });

  it('repeat multiplier is capped', () => {
    const manyPriors = scaledHospitalCost(0, 100);
    const capCost = Math.round(
      RECOVERY_CONFIG.HOSPITAL_BASE_COST *
        RECOVERY_CONFIG.SEVERITY_COST_MULTIPLIERS[0] *
        RECOVERY_CONFIG.REPEAT_COST_CAP,
    );
    expect(manyPriors).toBe(capCost);
  });
});

// ─── waitTicks ────────────────────────────────────────────────

describe('waitTicks', () => {
  it('bail: first offense, no charges → base wait', () => {
    expect(waitTicks('bail', 0, 0)).toBe(RECOVERY_CONFIG.BAIL_BASE_WAIT_TICKS);
  });

  it('hospital: first injury, light damage → base wait', () => {
    expect(waitTicks('hospital', 0, 0)).toBe(RECOVERY_CONFIG.HOSPITAL_BASE_WAIT_TICKS);
  });

  it('increases with severity tier', () => {
    const tier0 = waitTicks('bail', 0, 0);
    const tier4 = waitTicks('bail', 10, 0);
    expect(tier4).toBeGreaterThan(tier0);
  });

  it('increases with prior offenses', () => {
    const first = waitTicks('bail', 0, 0);
    const repeat = waitTicks('bail', 0, 5);
    expect(repeat).toBeGreaterThan(first);
  });

  it('is capped at WAIT_TICKS_CAP', () => {
    expect(waitTicks('bail', 10, 100)).toBe(RECOVERY_CONFIG.WAIT_TICKS_CAP);
    expect(waitTicks('hospital', 100, 100)).toBe(RECOVERY_CONFIG.WAIT_TICKS_CAP);
  });
});

// ─── isLifer ─────────────────────────────────────────────────

describe('isLifer', () => {
  it('returns false below the threshold', () => {
    expect(isLifer({ arrests: RECOVERY_CONFIG.LIFER_ARREST_THRESHOLD - 1 })).toBe(false);
  });

  it('returns true at and above the threshold', () => {
    expect(isLifer({ arrests: RECOVERY_CONFIG.LIFER_ARREST_THRESHOLD })).toBe(true);
    expect(isLifer({ arrests: 99 })).toBe(true);
  });
});

// ─── quoteRecovery ────────────────────────────────────────────

describe('quoteRecovery', () => {
  it('returns null for a member who needs nothing', () => {
    expect(quoteRecovery(member('a', 'active'), 10_000)).toBeNull();
  });

  it('quotes bail for a jailed member', () => {
    const q = quoteRecovery(member('a', 'jailed'), 10_000);
    expect(q?.kind).toBe('bail');
  });

  it('quotes hospital for an injured member', () => {
    const q = quoteRecovery(member('a', 'injured'), 10_000);
    expect(q?.kind).toBe('hospital');
  });

  it('marks affordable when player can cover the cost', () => {
    const q = quoteRecovery(member('a', 'jailed'), 999_999);
    expect(q?.affordable).toBe(true);
  });

  it('marks unaffordable when player cannot cover the cost', () => {
    const q = quoteRecovery(member('a', 'jailed'), 0);
    expect(q?.affordable).toBe(false);
  });

  it('flags morale bleed once past grace period', () => {
    const grace = RECOVERY_CONFIG.ABANDON_GRACE_TICKS;
    expect(quoteRecovery(member('a', 'jailed'), 10_000, grace)?.costingMorale).toBe(false);
    expect(quoteRecovery(member('a', 'jailed'), 10_000, grace + 1)?.costingMorale).toBe(true);
  });

  it('includes waitTicksRemaining', () => {
    const q = quoteRecovery(member('a', 'jailed'), 10_000, 0, 0);
    expect(q?.waitTicksRemaining).toBe(RECOVERY_CONFIG.BAIL_BASE_WAIT_TICKS);
  });

  it('waitTicksRemaining decreases as ticksHeld increases', () => {
    const base = quoteRecovery(member('a', 'jailed'), 10_000, 0, 0)!.waitTicksRemaining;
    const later = quoteRecovery(member('a', 'jailed'), 10_000, 2, 0)!.waitTicksRemaining;
    expect(later).toBe(base - 2);
  });

  it('waitTicksRemaining floors at 0', () => {
    const q = quoteRecovery(member('a', 'jailed'), 10_000, 999, 0);
    expect(q?.waitTicksRemaining).toBe(0);
  });

  it('cost scales with severity value', () => {
    const minor = quoteRecovery(member('a', 'jailed'), 10_000, 0, 0)!.cost;
    const major = quoteRecovery(member('a', 'jailed'), 10_000, 0, 7)!.cost;
    expect(major).toBeGreaterThan(minor);
  });

  it('cost scales with prior arrests', () => {
    const first = quoteRecovery(member('a', 'jailed', 0), 10_000, 0, 0)!.cost;
    const repeat = quoteRecovery(member('a', 'jailed', 3), 10_000, 0, 0)!.cost;
    expect(repeat).toBeGreaterThan(first);
  });

  it('flags a lifer correctly', () => {
    const lifer = member('a', 'jailed', RECOVERY_CONFIG.LIFER_ARREST_THRESHOLD);
    const q = quoteRecovery(lifer, 10_000);
    expect(q?.lifer).toBe(true);
  });

  it('non-lifer is not flagged', () => {
    const q = quoteRecovery(member('a', 'jailed', 0), 10_000);
    expect(q?.lifer).toBe(false);
  });

  it('includes severityTier in the quote', () => {
    const q = quoteRecovery(member('a', 'jailed'), 10_000, 0, 5);
    expect(q?.severityTier).toBe(3); // 5 charges → tier 3 (major)
  });
});

// ─── Detention tracking ──────────────────────────────────────

describe('bailHospital — detention tracking', () => {
  it('stamps a newly downed member with the current tick', () => {
    const held = updateHeldSince([member('a', 'jailed')], {}, 7);
    expect(held.a).toBe(7);
  });

  it('preserves the original stamp across ticks', () => {
    const held = updateHeldSince([member('a', 'jailed')], { a: 2 }, 9);
    expect(held.a).toBe(2);
  });

  it('drops a recovered member so a second stint starts fresh', () => {
    const held = updateHeldSince([member('a', 'active')], { a: 2 }, 9);
    expect(held.a).toBeUndefined();
  });

  it('does not track members who need nothing', () => {
    const held = updateHeldSince([member('a', 'active'), member('b', 'dead')], {}, 3);
    expect(Object.keys(held)).toHaveLength(0);
  });
});

// ─── Abandonment penalty ─────────────────────────────────────

describe('bailHospital — abandonment', () => {
  const grace = RECOVERY_CONFIG.ABANDON_GRACE_TICKS;

  it('reports nobody overdue inside the grace period', () => {
    expect(overdueMembers([member('a', 'jailed')], { a: 0 }, grace)).toHaveLength(0);
  });

  it('reports a member overdue once the grace period lapses', () => {
    expect(overdueMembers([member('a', 'jailed')], { a: 0 }, grace + 1)).toEqual(['a']);
  });

  it('does not penalise a member with no recorded start tick', () => {
    expect(overdueMembers([member('a', 'jailed')], {}, 99)).toHaveLength(0);
  });

  it('counts injured members as abandonable too', () => {
    expect(overdueMembers([member('a', 'injured')], { a: 0 }, grace + 2)).toEqual(['a']);
  });

  it('ignores members who have since been recovered', () => {
    expect(overdueMembers([member('a', 'active')], { a: 0 }, grace + 5)).toHaveLength(0);
  });

  it('drops morale by the configured percentage per abandoned member', () => {
    expect(applyAbandonmentPenalty(100, 1)).toBe(95);
  });

  it('compounds the penalty across several abandoned members', () => {
    expect(applyAbandonmentPenalty(100, 2)).toBe(90);
    expect(applyAbandonmentPenalty(100, 3)).toBe(86);
  });

  it('leaves morale alone when nobody is abandoned', () => {
    expect(applyAbandonmentPenalty(72, 0)).toBe(72);
  });

  it('never drives morale below zero', () => {
    expect(applyAbandonmentPenalty(1, 50)).toBeGreaterThanOrEqual(0);
  });

  it('is compounding, not linear — it can never zero a crew outright', () => {
    expect(applyAbandonmentPenalty(100, 20)).toBeGreaterThan(0);
  });
});
