// ============================================================
// SLIDE — Interactive raid trigger  (Sprint 14-B, Task 1)
// frontend/src/utils/raidTrigger.ts
//
// Decides whether the game loop should hand control to the playable
// PoliceRaidGame instead of resolving a raid in the background.
//
// TWO RAID PATHS, ONE DECISION POINT
// ----------------------------------
// heatSystem.executeRaid() is a dice roll against PLAYER heat (0-100)
// and produces a result the player only reads about. That stays — it
// is what covers blocks the player is not looking at.
//
// This module governs the INTERACTIVE raid, which keys off BLOCK heat
// (0-5, a completely separate scale) hitting the ceiling. The two are
// mutually exclusive per tick: firing both would jail the same crew
// twice over the same 30 seconds.
// ============================================================

import type { BlockData } from '../types/block.types';

export const RAID_TRIGGER_CONFIG = {
  /** Block heat, on the 0-5 band, at which the playable raid fires. */
  BLOCK_HEAT_THRESHOLD: 5,
  /** Ticks before the same block can be raided interactively again. */
  COOLDOWN_TICKS: 10,
} as const;

export interface RaidTriggerDecision {
  blockId: string;
  reason: 'block_heat_max';
}

/**
 * Pick a block to raid, or null.
 *
 * Only player-owned blocks with someone deployed are eligible. Raiding
 * an empty block produces a 30-second minigame with nothing at stake,
 * which reads as a bug; the background roll handles those instead.
 *
 * When several blocks are maxed, the busiest is chosen — that is where
 * the player has the most to lose, so it is the raid worth interrupting
 * them for.
 */
export function selectRaidTarget(
  blocks: Record<string, BlockData>,
  lastRaidTick: Record<string, number>,
  currentTick: number,
): RaidTriggerDecision | null {
  const eligible = Object.values(blocks)
    .filter((b) => b.owner === 'player')
    .filter((b) => (b.heat ?? 0) >= RAID_TRIGGER_CONFIG.BLOCK_HEAT_THRESHOLD)
    .filter((b) => (b.placements?.length ?? 0) > 0)
    .filter((b) => {
      const last = lastRaidTick[b.id];
      if (last === undefined) return true;
      return currentTick - last >= RAID_TRIGGER_CONFIG.COOLDOWN_TICKS;
    })
    .sort((a, b) => (b.placements?.length ?? 0) - (a.placements?.length ?? 0));

  const target = eligible[0];
  return target ? { blockId: target.id, reason: 'block_heat_max' } : null;
}

/** True when the background dice-roll raid should be suppressed this tick. */
export function suppressesBackgroundRaid(decision: RaidTriggerDecision | null): boolean {
  return decision !== null;
}
