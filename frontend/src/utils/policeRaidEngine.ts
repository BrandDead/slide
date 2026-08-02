// ============================================================
// policeRaidEngine.ts — pure game logic for the Police Raid
// mini-game.  No Phaser, no React — fully testable in Node.
//
// Rules:
//   • 8×8 grid, same layout as the block
//   • Police units spawn at row 0 and row 7 edges, advance
//     1 tile per tick toward the centre
//   • Player taps a deployed member to begin evacuation
//     (takes EVAC_TICKS ticks to complete)
//   • If a police unit reaches a member's tile before they
//     evacuate, that member is "caught" (jailed)
//   • Game ends when all members are evacuated or caught,
//     or when the timer runs out
// ============================================================

export const RAID_GRID_COLS = 8;
export const RAID_GRID_ROWS = 8;
export const RAID_DURATION_TICKS = 30;   // 30 seconds at 1 tick/s
export const EVAC_TICKS = 2;             // ticks to evacuate a member
export const POLICE_ADVANCE_TICKS = 1;   // police move every N ticks

// ─── Types ───────────────────────────────────────────────────

export type RaidMemberStatus = 'deployed' | 'evacuating' | 'evacuated' | 'caught';

export interface RaidMember {
  memberId: string;
  memberName: string;
  role: string;
  col: number;
  row: number;
  status: RaidMemberStatus;
  /** Ticks remaining until evacuation completes (only when status === 'evacuating') */
  evacTicksLeft: number;
  /** Drugs / cash this member is carrying (seized if caught) */
  heldCash: number;
  heldDrugs: number;
}

export interface PoliceUnit {
  id: string;
  col: number;
  row: number;
  /** Direction of advance: +1 = moving down (from row 0), -1 = moving up (from row 7) */
  direction: 1 | -1;
}

export type RaidPhase = 'countdown' | 'active' | 'resolved';

export interface RaidState {
  phase: RaidPhase;
  ticksRemaining: number;
  members: RaidMember[];
  police: PoliceUnit[];
  /** Members who escaped with their product */
  evacuated: RaidMember[];
  /** Members who were caught (jailed, product seized) */
  caught: RaidMember[];
  /** Total cash seized */
  cashSeized: number;
  /** Total drugs seized (units) */
  drugsSeized: number;
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create the initial raid state from the current block placements.
 * policeCount: how many police units to spawn (scales with heat).
 */
export function createRaidState(
  placements: Array<{
    memberId: string;
    memberName: string;
    role: string;
    x: number;
    y: number;
    heldCash?: number;
    heldDrugs?: number;
  }>,
  policeCount = 4
): RaidState {
  const members: RaidMember[] = placements.map((p) => ({
    memberId: p.memberId,
    memberName: p.memberName,
    role: p.role,
    col: p.x,
    row: p.y,
    status: 'deployed',
    evacTicksLeft: 0,
    heldCash: p.heldCash ?? 0,
    heldDrugs: p.heldDrugs ?? 0,
  }));

  // Spawn police evenly across the top and bottom edges
  const police: PoliceUnit[] = [];
  const topCount = Math.ceil(policeCount / 2);
  const botCount = policeCount - topCount;

  for (let i = 0; i < topCount; i++) {
    police.push({
      id: `cop-top-${i}`,
      col: Math.round((i / Math.max(topCount - 1, 1)) * (RAID_GRID_COLS - 1)),
      row: 0,
      direction: 1,
    });
  }
  for (let i = 0; i < botCount; i++) {
    police.push({
      id: `cop-bot-${i}`,
      col: Math.round((i / Math.max(botCount - 1, 1)) * (RAID_GRID_COLS - 1)),
      row: RAID_GRID_ROWS - 1,
      direction: -1,
    });
  }

  return {
    phase: 'countdown',
    ticksRemaining: RAID_DURATION_TICKS,
    members,
    police,
    evacuated: [],
    caught: [],
    cashSeized: 0,
    drugsSeized: 0,
  };
}

// ─── Actions ─────────────────────────────────────────────────

/**
 * Player taps a member to begin evacuation.
 * Returns a new state (immutable update).
 */
export function startEvacuation(state: RaidState, memberId: string): RaidState {
  if (state.phase !== 'active') return state;
  const members = state.members.map((m) => {
    if (m.memberId !== memberId || m.status !== 'deployed') return m;
    return { ...m, status: 'evacuating' as RaidMemberStatus, evacTicksLeft: EVAC_TICKS };
  });
  return { ...state, members };
}

// ─── Tick ────────────────────────────────────────────────────

/**
 * Advance the raid by one tick.
 * Returns a new RaidState (immutable).
 */
export function tickRaid(state: RaidState): RaidState {
  if (state.phase === 'resolved') return state;

  // Transition countdown → active on first tick
  let phase = state.phase === 'countdown' ? 'active' as RaidPhase : state.phase;
  let ticksRemaining = state.ticksRemaining - 1;

  // ── Advance evacuating members ──────────────────────────
  let members = state.members.map((m): RaidMember => {
    if (m.status !== 'evacuating') return m;
    const left = m.evacTicksLeft - 1;
    if (left <= 0) return { ...m, status: 'evacuated', evacTicksLeft: 0 };
    return { ...m, evacTicksLeft: left };
  });

  // ── Advance police ──────────────────────────────────────
  const police = state.police.map((cop): PoliceUnit => {
    const nextRow = cop.row + cop.direction;
    if (nextRow < 0 || nextRow >= RAID_GRID_ROWS) return cop; // already at edge
    return { ...cop, row: nextRow };
  });

  // ── Collision detection ─────────────────────────────────
  let cashSeized = state.cashSeized;
  let drugsSeized = state.drugsSeized;

  members = members.map((m): RaidMember => {
    if (m.status !== 'deployed' && m.status !== 'evacuating') return m;
    const caught = police.some((cop) => cop.col === m.col && cop.row === m.row);
    if (caught) {
      cashSeized += m.heldCash;
      drugsSeized += m.heldDrugs;
      return { ...m, status: 'caught', evacTicksLeft: 0 };
    }
    return m;
  });

  // ── Collect resolved members ────────────────────────────
  const evacuated = [
    ...state.evacuated,
    ...members.filter((m) => m.status === 'evacuated'),
  ];
  const caught = [
    ...state.caught,
    ...members.filter((m) => m.status === 'caught'),
  ];
  members = members.filter(
    (m) => m.status !== 'evacuated' && m.status !== 'caught'
  );

  // ── Check end conditions ────────────────────────────────
  const allResolved = members.length === 0;
  const timedOut = ticksRemaining <= 0;

  if (allResolved || timedOut) {
    // Any remaining deployed/evacuating members are caught on timeout
    if (timedOut && members.length > 0) {
      for (const m of members) {
        cashSeized += m.heldCash;
        drugsSeized += m.heldDrugs;
        caught.push({ ...m, status: 'caught' });
      }
      members = [];
    }
    phase = 'resolved';
  }

  return {
    phase,
    ticksRemaining: Math.max(0, ticksRemaining),
    members,
    police,
    evacuated,
    caught,
    cashSeized,
    drugsSeized,
  };
}

// ─── Selectors ───────────────────────────────────────────────

/** How many members are still at risk (deployed or evacuating) */
export function membersAtRisk(state: RaidState): number {
  return state.members.filter(
    (m) => m.status === 'deployed' || m.status === 'evacuating'
  ).length;
}

/** Summary for the results screen */
export interface RaidSummary {
  evacuated: number;
  caught: number;
  cashSeized: number;
  drugsSeized: number;
  heatReduction: number;  // heat drops after a successful raid
}

export function getRaidSummary(state: RaidState): RaidSummary {
  const evacuated = state.evacuated.length;
  const caught = state.caught.length;
  const total = evacuated + caught;
  // Heat drops proportionally to how many were caught (raid "satisfied" the police)
  const heatReduction = total > 0 ? Math.round((caught / total) * 2) : 0;
  return {
    evacuated,
    caught,
    cashSeized: state.cashSeized,
    drugsSeized: state.drugsSeized,
    heatReduction,
  };
}
