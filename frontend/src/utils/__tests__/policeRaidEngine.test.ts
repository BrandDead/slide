/**
 * policeRaidEngine — time-based engine tests (Sprint 14-B)
 *
 * The engine advances off an explicit elapsed-ms value, so a whole
 * 30-second raid resolves synchronously here with no fake timers.
 */
import { describe, it, expect } from 'vitest';
import {
  createRaidState,
  createRaidMember,
  spawnUnits,
  tapMember,
  advanceRaid,
  expireRaid,
  evacProgress,
  secondsRemaining,
  caughtMembers,
  savedMembers,
  estimateHeld,
  isTileThreatened,
  RAID_CONFIG,
} from '../policeRaidEngine';
import type { BlockPlacement } from '../../types/block.types';

// ─── Fixtures ────────────────────────────────────────────────

function placement(over: Partial<BlockPlacement> = {}): BlockPlacement {
  return {
    memberId: 'm1',
    memberName: 'Trap Mike',
    role: 'dealer',
    x: 3,
    y: 4,
    zoneType: 'corner',
    incomePerTick: 60,
    exposureRisk: 20,
    level: 2,
    health: 100,
    ...over,
  } as BlockPlacement;
}

// ─── RAID_CONFIG ─────────────────────────────────────────────

describe('RAID_CONFIG', () => {
  it('exports correct grid size', () => {
    expect(RAID_CONFIG.GRID_SIZE).toBe(8);
  });

  it('exports 30-second duration in ms', () => {
    expect(RAID_CONFIG.DURATION_MS).toBe(30_000);
  });

  it('exports 1-second advance interval', () => {
    expect(RAID_CONFIG.ADVANCE_INTERVAL_MS).toBe(1_000);
  });

  it('exports 1.5-second evacuation duration', () => {
    expect(RAID_CONFIG.EVAC_DURATION_MS).toBe(1_500);
  });
});

// ─── estimateHeld ─────────────────────────────────────────────

describe('estimateHeld', () => {
  it('derives cash from income per tick', () => {
    const held = estimateHeld(placement({ incomePerTick: 60 }));
    expect(held.cash).toBe(480); // 60 * 8
  });

  it('derives drugs from income per tick', () => {
    const held = estimateHeld(placement({ incomePerTick: 60 }));
    expect(held.drugs).toBe(5); // round(60/12)
  });

  it('zero-income placement still carries at least one unit of product', () => {
    const held = estimateHeld(placement({ incomePerTick: 0 }));
    expect(held.drugs).toBeGreaterThanOrEqual(1);
  });
});

// ─── createRaidMember ─────────────────────────────────────────

describe('createRaidMember', () => {
  it('creates a deployed member from a placement', () => {
    const m = createRaidMember(placement());
    expect(m.status).toBe('deployed');
    expect(m.memberId).toBe('m1');
    expect(m.x).toBe(3);
    expect(m.y).toBe(4);
    expect(m.evacStartedAt).toBeNull();
  });

  it('sets held cash from estimateHeld', () => {
    const m = createRaidMember(placement({ incomePerTick: 60 }));
    expect(m.heldCash).toBe(480);
  });
});

// ─── spawnUnits ───────────────────────────────────────────────

describe('spawnUnits', () => {
  it('spawns a unit at each edge of every occupied column', () => {
    const members = [
      createRaidMember(placement({ x: 2 })),
      createRaidMember(placement({ memberId: 'm2', x: 5 })),
    ];
    const units = spawnUnits(members);
    expect(units).toHaveLength(4);
    expect(units.filter((u) => u.y === 0)).toHaveLength(2);
    expect(units.filter((u) => u.y === RAID_CONFIG.GRID_SIZE - 1)).toHaveLength(2);
  });

  it('does not spawn duplicate lanes for two members in one column', () => {
    const members = [
      createRaidMember(placement({ x: 4, y: 2 })),
      createRaidMember(placement({ memberId: 'm2', x: 4, y: 6 })),
    ];
    expect(spawnUnits(members)).toHaveLength(2);
  });

  it('still spawns a token pair when nobody is deployed', () => {
    expect(spawnUnits([])).toHaveLength(2);
  });
});

// ─── createRaidState ─────────────────────────────────────────

describe('createRaidState', () => {
  it('starts in_progress with no seizures', () => {
    const s = createRaidState([placement()]);
    expect(s.outcome).toBe('in_progress');
    expect(s.seizedCash).toBe(0);
    expect(s.seizedDrugs).toBe(0);
    expect(s.elapsedMs).toBe(0);
  });

  it('creates members from placements', () => {
    const s = createRaidState([placement(), placement({ memberId: 'm2', x: 5 })]);
    expect(s.members).toHaveLength(2);
  });

  it('stores the blockId', () => {
    const s = createRaidState([placement()], 'blk-99');
    expect(s.blockId).toBe('blk-99');
  });

  it('handles zero placements gracefully', () => {
    const s = createRaidState([]);
    expect(s.members).toHaveLength(0);
    expect(s.seizedCash).toBe(0);
  });
});

// ─── tapMember ────────────────────────────────────────────────

describe('tapMember', () => {
  it('starts evacuation for a deployed member', () => {
    const s = createRaidState([placement()]);
    const next = tapMember(s, 'm1');
    const m = next.members.find((m) => m.memberId === 'm1')!;
    expect(m.status).toBe('evacuating');
    expect(m.evacStartedAt).toBe(0);
  });

  it('does not restart an already-evacuating member', () => {
    let s = createRaidState([placement()]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 500);
    const before = s.members.find((m) => m.memberId === 'm1')!.evacStartedAt;
    const next = tapMember(s, 'm1');
    const after = next.members.find((m) => m.memberId === 'm1')!.evacStartedAt;
    expect(after).toBe(before);
  });

  it('is a no-op for a caught member', () => {
    const s = createRaidState([placement()]);
    const caught = {
      ...s,
      members: s.members.map((m) => ({ ...m, status: 'caught' as const })),
    };
    const next = tapMember(caught, 'm1');
    expect(next.members[0].status).toBe('caught');
  });

  it('is a no-op for an unknown memberId', () => {
    const s = createRaidState([placement()]);
    const next = tapMember(s, 'no-such-member');
    expect(next).toBe(s);
  });
});

// ─── advanceRaid ─────────────────────────────────────────────

describe('advanceRaid', () => {
  it('is a no-op when outcome is not in_progress', () => {
    const s = createRaidState([]);
    const expired = expireRaid(s);
    const next = advanceRaid(expired, 5_000);
    expect(next).toBe(expired);
  });

  it('moves police units forward over time', () => {
    const s = createRaidState([placement({ x: 3, y: 4 })]);
    const next = advanceRaid(s, 1_000);
    const topUnit = next.units.find((u) => u.x === 3 && u.spawnY === 0)!;
    expect(topUnit.y).toBe(1);
  });

  it('catches a member when a police unit reaches their tile', () => {
    // Place member at y=1 so top unit (starting at y=0) reaches them after 1 second
    const s = createRaidState([placement({ x: 3, y: 1 })]);
    const next = advanceRaid(s, 1_000);
    const m = next.members.find((m) => m.memberId === 'm1')!;
    expect(m.status).toBe('caught');
    expect(next.seizedCash).toBeGreaterThan(0);
  });

  it('marks a member safe when evacuation completes', () => {
    let s = createRaidState([placement({ x: 3, y: 4 })]);
    s = tapMember(s, 'm1'); // evacStartedAt = 0
    s = advanceRaid(s, 2_000); // past EVAC_DURATION_MS (1500ms)
    const m = s.members.find((m) => m.memberId === 'm1')!;
    expect(m.status).toBe('safe');
  });

  it('resolves clean when all members evacuate', () => {
    let s = createRaidState([placement({ x: 3, y: 4 })]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 2_000);
    expect(s.outcome).toBe('clean');
  });

  it('resolves disaster when all members are caught', () => {
    // Top unit spawns at y=0 and advances to y=1 after 1 s (ADVANCE_INTERVAL_MS).
    // Place the only member at y=1 so the unit catches them at exactly 1 s.
    let s = createRaidState([placement({ x: 3, y: 1 })]);
    s = advanceRaid(s, 1_000);
    expect(s.outcome).toBe('disaster');
  });

  it('units stop at grid edges', () => {
    const s = createRaidState([placement()]);
    const next = advanceRaid(s, 100_000);
    for (const unit of next.units) {
      expect(unit.y).toBeGreaterThanOrEqual(0);
      expect(unit.y).toBeLessThanOrEqual(RAID_CONFIG.GRID_SIZE - 1);
    }
  });
});

// ─── expireRaid ───────────────────────────────────────────────

describe('expireRaid', () => {
  it('catches all remaining deployed members', () => {
    const s = createRaidState([
      placement({ memberId: 'm1', x: 3, y: 4 }),
      placement({ memberId: 'm2', x: 5, y: 2 }),
    ]);
    const expired = expireRaid(s);
    expect(caughtMembers(expired)).toHaveLength(2);
  });

  it('does not re-catch already-safe members', () => {
    let s = createRaidState([
      placement({ memberId: 'm1', x: 3, y: 4 }),
      placement({ memberId: 'm2', x: 5, y: 2 }),
    ]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 2_000); // m1 is now safe
    const expired = expireRaid(s);
    const safe = savedMembers(expired);
    expect(safe.some((m) => m.memberId === 'm1')).toBe(true);
    expect(caughtMembers(expired).some((m) => m.memberId === 'm1')).toBe(false);
  });

  it('sets elapsedMs to DURATION_MS', () => {
    const s = createRaidState([]);
    const expired = expireRaid(s);
    expect(expired.elapsedMs).toBe(RAID_CONFIG.DURATION_MS);
  });

  it('resolves disaster when all members were deployed', () => {
    const s = createRaidState([placement()]);
    const expired = expireRaid(s);
    expect(expired.outcome).toBe('disaster');
  });

  it('resolves clean when all members were already safe', () => {
    let s = createRaidState([placement()]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 2_000);
    const expired = expireRaid(s);
    expect(expired.outcome).toBe('clean');
  });
});

// ─── secondsRemaining ────────────────────────────────────────

describe('secondsRemaining', () => {
  it('returns 30 at the start', () => {
    const s = createRaidState([]);
    expect(secondsRemaining(s)).toBe(30);
  });

  it('returns 0 after expiry', () => {
    const s = expireRaid(createRaidState([]));
    expect(secondsRemaining(s)).toBe(0);
  });

  it('counts down correctly', () => {
    const s = advanceRaid(createRaidState([placement()]), 10_000);
    expect(secondsRemaining(s)).toBe(20);
  });
});

// ─── evacProgress ────────────────────────────────────────────

describe('evacProgress', () => {
  it('returns 0 for a deployed member', () => {
    const s = createRaidState([placement()]);
    const m = s.members[0];
    expect(evacProgress(m, 0)).toBe(0);
  });

  it('returns 1 for a safe member', () => {
    let s = createRaidState([placement()]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 2_000);
    const m = s.members.find((m) => m.memberId === 'm1')!;
    expect(evacProgress(m, s.elapsedMs)).toBe(1);
  });

  it('returns a fraction during evacuation', () => {
    let s = createRaidState([placement({ x: 3, y: 4 })]);
    s = tapMember(s, 'm1'); // evacStartedAt = 0
    const m = s.members[0];
    const progress = evacProgress(m, 750);
    expect(progress).toBeCloseTo(0.5);
  });

  it('clamps to 1 even if elapsed exceeds evac duration', () => {
    let s = createRaidState([placement()]);
    s = tapMember(s, 'm1');
    const m = s.members[0];
    expect(evacProgress(m, 99_999)).toBe(1);
  });
});

// ─── caughtMembers / savedMembers ────────────────────────────

describe('caughtMembers / savedMembers', () => {
  it('caughtMembers returns only caught members', () => {
    const s = createRaidState([
      placement({ memberId: 'm1', x: 3, y: 1 }),
      placement({ memberId: 'm2', x: 5, y: 4 }),
    ]);
    const next = advanceRaid(s, 1_000); // m1 caught
    expect(caughtMembers(next).map((m) => m.memberId)).toContain('m1');
    expect(caughtMembers(next).map((m) => m.memberId)).not.toContain('m2');
  });

  it('savedMembers returns only safe members', () => {
    let s = createRaidState([placement()]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 2_000);
    expect(savedMembers(s).map((m) => m.memberId)).toContain('m1');
  });

  it('returns empty arrays when no members match', () => {
    const s = createRaidState([placement()]);
    expect(caughtMembers(s)).toHaveLength(0);
    expect(savedMembers(s)).toHaveLength(0);
  });
});

// ─── isTileThreatened ────────────────────────────────────────

describe('isTileThreatened', () => {
  it('returns true for a tile a unit is on', () => {
    const s = createRaidState([placement({ x: 3, y: 4 })]);
    // Top unit starts at y=0, x=3
    expect(isTileThreatened(s, 3, 0)).toBe(true);
  });

  it('returns true for a tile one step ahead of a unit', () => {
    const s = createRaidState([placement({ x: 3, y: 4 })]);
    // Top unit at y=0, direction=1 — y=1 is one step ahead
    expect(isTileThreatened(s, 3, 1)).toBe(true);
  });

  it('returns false for a tile not near any unit', () => {
    const s = createRaidState([placement({ x: 3, y: 4 })]);
    expect(isTileThreatened(s, 3, 4)).toBe(false);
  });

  it('returns false for a different column', () => {
    const s = createRaidState([placement({ x: 3, y: 4 })]);
    // Column 0 has no units (only column 3 does)
    expect(isTileThreatened(s, 0, 0)).toBe(false);
  });
});
