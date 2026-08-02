// ============================================================
// policeRaidEngine.test.ts — unit tests for the police raid engine
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  createRaidState,
  startEvacuation,
  tickRaid,
  getRaidSummary,
  membersAtRisk,
  RAID_DURATION_TICKS,
  EVAC_TICKS,
  RAID_GRID_COLS,
  RAID_GRID_ROWS,
} from '../policeRaidEngine';

// ─── Factory ─────────────────────────────────────────────────

describe('createRaidState', () => {
  it('creates the correct number of police units', () => {
    const state = createRaidState([], 4);
    expect(state.police).toHaveLength(4);
  });

  it('sets phase to active and correct tick count', () => {
    const state = createRaidState([], 2);
    expect(state.phase).toBe('countdown');
    expect(state.ticksRemaining).toBe(RAID_DURATION_TICKS);
  });

  it('maps placements to RaidMembers correctly', () => {
    const state = createRaidState([
      { memberId: 'm1', memberName: 'Dre', role: 'dealer', x: 2, y: 3, heldCash: 500, heldDrugs: 2 },
    ], 2);
    expect(state.members).toHaveLength(1);
    const m = state.members[0];
    expect(m.memberId).toBe('m1');
    expect(m.col).toBe(2);
    expect(m.row).toBe(3);
    expect(m.status).toBe('deployed');
    expect(m.heldCash).toBe(500);
    expect(m.heldDrugs).toBe(2);
  });

  it('spawns police at top (row 0) and bottom (row GRID_ROWS-1) edges', () => {
    const state = createRaidState([], 4);
    const topCops = state.police.filter(c => c.row === 0);
    const botCops = state.police.filter(c => c.row === RAID_GRID_ROWS - 1);
    expect(topCops.length).toBeGreaterThan(0);
    expect(botCops.length).toBeGreaterThan(0);
  });

  it('top cops have direction +1, bottom cops have direction -1', () => {
    const state = createRaidState([], 4);
    for (const cop of state.police) {
      if (cop.row === 0) expect(cop.direction).toBe(1);
      if (cop.row === RAID_GRID_ROWS - 1) expect(cop.direction).toBe(-1);
    }
  });

  it('handles zero placements gracefully', () => {
    const state = createRaidState([], 2);
    expect(state.members).toHaveLength(0);
    expect(state.evacuated).toHaveLength(0);
    expect(state.caught).toHaveLength(0);
  });

  it('defaults heldCash and heldDrugs to 0 when not provided', () => {
    const state = createRaidState([
      { memberId: 'm1', memberName: 'X', role: 'shooter', x: 0, y: 0 },
    ], 1);
    expect(state.members[0].heldCash).toBe(0);
    expect(state.members[0].heldDrugs).toBe(0);
  });
});

// ─── startEvacuation ─────────────────────────────────────────

describe('startEvacuation', () => {
  it('transitions a deployed member to evacuating', () => {
    const state = createRaidState([
      { memberId: 'm1', memberName: 'Dre', role: 'dealer', x: 3, y: 3 },
    ], 2);
    const active = { ...state, phase: 'active' as const };
    const next = startEvacuation(active, 'm1');
    const m = next.members.find(m => m.memberId === 'm1')!;
    expect(m.status).toBe('evacuating');
    expect(m.evacTicksLeft).toBe(EVAC_TICKS);
  });

  it('does not change members that are not the target', () => {
    const state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 1, y: 1 },
      { memberId: 'm2', memberName: 'B', role: 'shooter', x: 5, y: 5 },
    ], 2);
    const active = { ...state, phase: 'active' as const };
    const next = startEvacuation(active, 'm1');
    const m2 = next.members.find(m => m.memberId === 'm2')!;
    expect(m2.status).toBe('deployed');
  });

  it('is a no-op when phase is not active', () => {
    const state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 1, y: 1 },
    ], 2);
    // phase is 'countdown' by default
    const next = startEvacuation(state, 'm1');
    expect(next.members[0].status).toBe('deployed');
  });

  it('does not re-evacuate an already evacuating member', () => {
    const state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 1, y: 1 },
    ], 2);
    const active = { ...state, phase: 'active' as const };
    const once = startEvacuation(active, 'm1');
    const twice = startEvacuation(once, 'm1');
    // evacTicksLeft should not reset
    expect(twice.members[0].evacTicksLeft).toBe(EVAC_TICKS);
  });
});

// ─── tickRaid ────────────────────────────────────────────────

describe('tickRaid', () => {
  it('decrements ticksRemaining by 1 each tick', () => {
    const state = { ...createRaidState([], 2), phase: 'active' as const };
    const next = tickRaid(state);
    expect(next.ticksRemaining).toBe(RAID_DURATION_TICKS - 1);
  });

  it('advances police toward the centre', () => {
    const state = { ...createRaidState([], 2), phase: 'active' as const };
    const topCop = state.police.find(c => c.direction === 1)!;
    const next = tickRaid(state);
    const movedCop = next.police.find(c => c.id === topCop.id)!;
    expect(movedCop.row).toBe(topCop.row + 1);
  });

  it('completes evacuation after EVAC_TICKS ticks', () => {
    let state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 4, y: 4 },
    ], 0); // 0 police so no collisions
    state = { ...state, phase: 'active' as const };
    state = startEvacuation(state, 'm1');
    for (let i = 0; i < EVAC_TICKS; i++) {
      state = tickRaid(state);
    }
    expect(state.evacuated).toHaveLength(1);
    expect(state.evacuated[0].memberId).toBe('m1');
  });

  it('catches a member when police reach their tile', () => {
    // Place member at row 1 and a top cop at row 0, same col
    const state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 0, y: 1, heldCash: 200 },
    ], 1);
    // Force the police to be at col 0, row 0
    const forcedState = {
      ...state,
      phase: 'active' as const,
      police: [{ id: 'cop-top-0', col: 0, row: 0, direction: 1 as const }],
    };
    const next = tickRaid(forcedState);
    expect(next.caught).toHaveLength(1);
    expect(next.caught[0].memberId).toBe('m1');
    expect(next.cashSeized).toBe(200);
  });

  it('resolves when all members are evacuated', () => {
    let state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 4, y: 4 },
    ], 0);
    state = { ...state, phase: 'active' as const };
    state = startEvacuation(state, 'm1');
    for (let i = 0; i < EVAC_TICKS; i++) {
      state = tickRaid(state);
    }
    expect(state.phase).toBe('resolved');
  });

  it('resolves when timer runs out and catches remaining members', () => {
    let state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 4, y: 4, heldCash: 100 },
    ], 0);
    state = { ...state, phase: 'active' as const, ticksRemaining: 1 };
    state = tickRaid(state);
    expect(state.phase).toBe('resolved');
    expect(state.caught).toHaveLength(1);
    expect(state.cashSeized).toBe(100);
  });

  it('is a no-op when already resolved', () => {
    const state = createRaidState([], 2);
    const resolved = { ...state, phase: 'resolved' as const };
    const next = tickRaid(resolved);
    expect(next).toBe(resolved);
  });

  it('does not move police past grid edges', () => {
    const state = createRaidState([], 2);
    const botCop = state.police.find(c => c.direction === -1)!;
    // Force the cop to row 0 (already at top edge, direction -1 means it would go to -1)
    const forcedState = {
      ...state,
      phase: 'active' as const,
      police: [{ ...botCop, row: 0 }],
    };
    const next = tickRaid(forcedState);
    // Should stay at row 0, not go to -1
    expect(next.police[0].row).toBe(0);
  });
});

// ─── membersAtRisk ────────────────────────────────────────────

describe('membersAtRisk', () => {
  it('counts deployed and evacuating members', () => {
    let state = createRaidState([
      { memberId: 'm1', memberName: 'A', role: 'dealer', x: 1, y: 1 },
      { memberId: 'm2', memberName: 'B', role: 'shooter', x: 5, y: 5 },
    ], 0);
    state = { ...state, phase: 'active' as const };
    expect(membersAtRisk(state)).toBe(2);
    state = startEvacuation(state, 'm1');
    expect(membersAtRisk(state)).toBe(2); // still at risk while evacuating
  });

  it('returns 0 when all are resolved', () => {
    const state = createRaidState([], 0);
    expect(membersAtRisk(state)).toBe(0);
  });
});

// ─── getRaidSummary ───────────────────────────────────────────

describe('getRaidSummary', () => {
  it('returns correct evacuated and caught counts', () => {
    const state = createRaidState([], 0);
    const withResults = {
      ...state,
      phase: 'resolved' as const,
      evacuated: [{ memberId: 'm1', memberName: 'A', role: 'dealer', col: 0, row: 0, status: 'evacuated' as const, evacTicksLeft: 0, heldCash: 0, heldDrugs: 0 }],
      caught: [{ memberId: 'm2', memberName: 'B', role: 'shooter', col: 1, row: 1, status: 'caught' as const, evacTicksLeft: 0, heldCash: 500, heldDrugs: 1 }],
      cashSeized: 500,
      drugsSeized: 1,
    };
    const summary = getRaidSummary(withResults);
    expect(summary.evacuated).toBe(1);
    expect(summary.caught).toBe(1);
    expect(summary.cashSeized).toBe(500);
    expect(summary.drugsSeized).toBe(1);
  });

  it('calculates heatReduction proportional to caught ratio', () => {
    const state = createRaidState([], 0);
    // All caught → max heat reduction
    const allCaught = {
      ...state,
      phase: 'resolved' as const,
      evacuated: [],
      caught: [
        { memberId: 'm1', memberName: 'A', role: 'dealer', col: 0, row: 0, status: 'caught' as const, evacTicksLeft: 0, heldCash: 0, heldDrugs: 0 },
        { memberId: 'm2', memberName: 'B', role: 'dealer', col: 1, row: 1, status: 'caught' as const, evacTicksLeft: 0, heldCash: 0, heldDrugs: 0 },
      ],
      cashSeized: 0,
      drugsSeized: 0,
    };
    const summary = getRaidSummary(allCaught);
    expect(summary.heatReduction).toBe(2); // 100% caught → 2 heat reduction
  });

  it('returns 0 heatReduction when no members total', () => {
    const state = createRaidState([], 0);
    const summary = getRaidSummary({ ...state, phase: 'resolved' as const });
    expect(summary.heatReduction).toBe(0);
  });
});

// ─── Grid constants ───────────────────────────────────────────

describe('grid constants', () => {
  it('exports correct grid dimensions', () => {
    expect(RAID_GRID_COLS).toBe(8);
    expect(RAID_GRID_ROWS).toBe(8);
  });
});
