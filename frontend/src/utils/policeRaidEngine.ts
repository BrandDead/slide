// ============================================================
// SLIDE — Police Raid engine  (Sprint 14-B, Task 1)
// frontend/src/utils/policeRaidEngine.ts
//
// A timed grid-clear. Police enter from the top and bottom edges and
// walk inward one tile per second. The player has 30 seconds to tap
// each deployed member and start a 1.5s evacuation. A unit reaching an
// occupied tile before that evacuation completes takes the member.
//
// Pure and store-free, like bipNDipEngine — the component owns the
// clock, this owns the rules. Everything advances off an explicit
// elapsed-milliseconds value rather than reading Date.now(), so a test
// can drive a whole raid deterministically.
//
// NOTE ON SCOPE: this is the *interactive* raid. The existing
// heatSystem.executeRaid() is a non-interactive dice roll used by the
// background game loop. Both are kept — see raidTrigger.ts for how the
// loop decides which one fires.
// ============================================================

import type { BlockPlacement } from '../types/block.types';

// ─── Config ──────────────────────────────────────────────────

export const RAID_CONFIG = {
  GRID_SIZE: 8,
  /** Total time the player has, in ms. */
  DURATION_MS: 30_000,
  /** Police move one tile per this interval. */
  ADVANCE_INTERVAL_MS: 1_000,
  /** How long a tapped member takes to get clear. */
  EVAC_DURATION_MS: 1_500,
  /** Heat the block drops to once the raid resolves, win or lose. */
  POST_RAID_HEAT: 1,
} as const;

// ─── Types ───────────────────────────────────────────────────

export type RaidOutcome = 'in_progress' | 'clean' | 'partial' | 'disaster';

export interface PoliceUnit {
  id: string;
  x: number;
  y: number;
  /**
   * The row this unit entered from. Position is derived from THIS, not
   * from `y`, so advancing is idempotent: the component's rAF loop calls
   * advanceRaid ~60x a second and each call must land the unit in the
   * same place as a single call to the same timestamp would.
   */
  spawnY: number;
  /** +1 walks down the grid, -1 walks up. */
  direction: 1 | -1;
}

export type EvacueeStatus = 'deployed' | 'evacuating' | 'safe' | 'caught';

export interface RaidMember {
  memberId: string;
  memberName: string;
  role: string;
  x: number;
  y: number;
  status: EvacueeStatus;
  /** Elapsed-ms stamp when the tap landed; null until tapped. */
  evacStartedAt: number | null;
  /** Cash this member was holding, seized on capture. */
  heldCash: number;
  /** Drug units this member was holding, seized on capture. */
  heldDrugs: number;
}

export interface RaidState {
  elapsedMs: number;
  units: PoliceUnit[];
  members: RaidMember[];
  outcome: RaidOutcome;
  seizedCash: number;
  seizedDrugs: number;
  blockId: string | null;
}

// ─── Setup ───────────────────────────────────────────────────

/**
 * Cash and product on a member scale with the value of the corner they
 * were working. Deriving it from incomePerTick means a raid on a busy
 * block hurts more than one on a dead corner, without a second source
 * of truth for what each member is carrying.
 */
export function estimateHeld(placement: BlockPlacement): { cash: number; drugs: number } {
  const income = Math.max(0, placement.incomePerTick ?? 0);
  return {
    cash: Math.round(income * 8),
    drugs: Math.max(1, Math.round(income / 12)),
  };
}

export function createRaidMember(placement: BlockPlacement): RaidMember {
  const held = estimateHeld(placement);
  return {
    memberId: placement.memberId,
    memberName: placement.memberName,
    role: placement.role,
    x: placement.x,
    y: placement.y,
    status: 'deployed',
    evacStartedAt: null,
    heldCash: held.cash,
    heldDrugs: held.drugs,
  };
}

/**
 * Police spawn in the columns that actually have someone in them, so a
 * raid always applies pressure rather than sweeping empty lanes. With
 * nobody deployed we still spawn a token pair — a raid on an empty
 * block should resolve immediately, not hang with no units on screen.
 */
export function spawnUnits(members: RaidMember[]): PoliceUnit[] {
  const occupied = [...new Set(members.map((m) => m.x))].sort((a, b) => a - b);
  // One token lane when nobody is deployed: a raid on an empty block
  // should still show units, but there is nothing to converge on.
  const columns = occupied.length > 0 ? occupied : [4];

  const units: PoliceUnit[] = [];
  for (const x of columns) {
    units.push({ id: `cop-top-${x}`, x, y: 0, spawnY: 0, direction: 1 });
    units.push({
      id: `cop-bot-${x}`,
      x,
      y: RAID_CONFIG.GRID_SIZE - 1,
      spawnY: RAID_CONFIG.GRID_SIZE - 1,
      direction: -1,
    });
  }
  return units;
}

export function createRaidState(
  placements: BlockPlacement[],
  blockId: string | null = null,
): RaidState {
  const members = placements.map(createRaidMember);
  return {
    elapsedMs: 0,
    units: spawnUnits(members),
    members,
    outcome: 'in_progress',
    seizedCash: 0,
    seizedDrugs: 0,
    blockId,
  };
}

// ─── Input ───────────────────────────────────────────────────

/**
 * Tap a member to start their evacuation.
 *
 * Only a 'deployed' member can be tapped. Re-tapping someone already
 * running does NOT restart their timer — otherwise mashing a tile would
 * be strictly worse than tapping once, which reads as a bug to a player.
 */
export function tapMember(state: RaidState, memberId: string): RaidState {
  const target = state.members.find((m) => m.memberId === memberId);
  if (!target || target.status !== 'deployed') return state;

  return {
    ...state,
    members: state.members.map((m) =>
      m.memberId === memberId
        ? { ...m, status: 'evacuating' as const, evacStartedAt: state.elapsedMs }
        : m,
    ),
  };
}

// ─── Simulation ──────────────────────────────────────────────

function unitPositionAt(unit: PoliceUnit, elapsedMs: number): PoliceUnit {
  const steps = Math.floor(elapsedMs / RAID_CONFIG.ADVANCE_INTERVAL_MS);
  const raw = unit.spawnY + unit.direction * steps;
  // Units stop at the far edge rather than walking off the board.
  const y = Math.max(0, Math.min(RAID_CONFIG.GRID_SIZE - 1, raw));
  return { ...unit, y };
}

/**
 * Advance the raid to `elapsedMs`.
 *
 * Resolution order per step matters and is deliberate: evacuations that
 * have finished are settled BEFORE police positions are checked. A
 * member whose 1.5s completes on the same tick a unit arrives gets out.
 * Ties going to the player keeps the timing readable — the alternative
 * makes a correctly-timed tap feel stolen.
 */
export function advanceRaid(state: RaidState, elapsedMs: number): RaidState {
  if (state.outcome !== 'in_progress') return state;
  if (elapsedMs <= state.elapsedMs) return { ...state, elapsedMs };

  const units = state.units.map((u) => unitPositionAt(u, elapsedMs));

  let seizedCash = state.seizedCash;
  let seizedDrugs = state.seizedDrugs;

  const members = state.members.map((m) => {
    if (m.status === 'safe' || m.status === 'caught') return m;

    // 1. Settle completed evacuations first.
    if (
      m.status === 'evacuating' &&
      m.evacStartedAt !== null &&
      elapsedMs - m.evacStartedAt >= RAID_CONFIG.EVAC_DURATION_MS
    ) {
      return { ...m, status: 'safe' as const };
    }

    // 2. Then check whether a unit is standing on them.
    const reached = units.some((u) => u.x === m.x && u.y === m.y);
    if (reached) {
      seizedCash += m.heldCash;
      seizedDrugs += m.heldDrugs;
      return { ...m, status: 'caught' as const };
    }

    return m;
  });

  const next: RaidState = { ...state, elapsedMs, units, members, seizedCash, seizedDrugs };
  return { ...next, outcome: resolveOutcome(next) };
}

/**
 * Anyone still on the board when the clock expires is caught. Standing
 * still is not a survival strategy.
 */
export function expireRaid(state: RaidState): RaidState {
  let seizedCash = state.seizedCash;
  let seizedDrugs = state.seizedDrugs;

  const members = state.members.map((m) => {
    if (m.status === 'safe' || m.status === 'caught') return m;
    seizedCash += m.heldCash;
    seizedDrugs += m.heldDrugs;
    return { ...m, status: 'caught' as const };
  });

  const next: RaidState = {
    ...state,
    elapsedMs: RAID_CONFIG.DURATION_MS,
    members,
    seizedCash,
    seizedDrugs,
  };
  return { ...next, outcome: resolveOutcome(next, true) };
}

function resolveOutcome(state: RaidState, forceFinal = false): RaidOutcome {
  const pending = state.members.filter(
    (m) => m.status === 'deployed' || m.status === 'evacuating',
  );
  const timeUp = state.elapsedMs >= RAID_CONFIG.DURATION_MS;

  if (!forceFinal && pending.length > 0 && !timeUp) return 'in_progress';

  const caught = state.members.filter((m) => m.status === 'caught').length;
  if (caught === 0) return 'clean';
  if (caught === state.members.length) return 'disaster';
  return 'partial';
}

// ─── Selectors ───────────────────────────────────────────────

export function evacProgress(member: RaidMember, elapsedMs: number): number {
  if (member.status === 'safe') return 1;
  if (member.status !== 'evacuating' || member.evacStartedAt === null) return 0;
  return Math.min(1, (elapsedMs - member.evacStartedAt) / RAID_CONFIG.EVAC_DURATION_MS);
}

export function secondsRemaining(state: RaidState): number {
  return Math.max(0, Math.ceil((RAID_CONFIG.DURATION_MS - state.elapsedMs) / 1000));
}

export function caughtMembers(state: RaidState): RaidMember[] {
  return state.members.filter((m) => m.status === 'caught');
}

export function savedMembers(state: RaidState): RaidMember[] {
  return state.members.filter((m) => m.status === 'safe');
}

/** True when a unit will step onto this tile within one advance. */
export function isTileThreatened(state: RaidState, x: number, y: number): boolean {
  return state.units.some((u) => u.x === x && Math.abs(u.y - y) <= 1);
}