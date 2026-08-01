// ============================================================
// SLIDE — Graffiti → Territory bridge  (Sprint 13, Task 3)
// frontend/src/components/graffiti/graffitiTerritory.ts
//
// A successful tag used to raise only the PLAYER's heat, which left
// the territory layer with no idea the block had been hit. This module
// records the hit on the block itself.
//
// Extracted from the component so the wiring is testable without
// mounting GraffitiGame's ~1100 lines of canvas and timer logic.
// ============================================================

import { useBlockStore } from '../../stores/blockStore';
import type { BlockData, BlockOwner } from '../../types/block.types';

/** Block heat is a 0-5 band; player heat is a separate, wider scale. */
export const BLOCK_HEAT_MAX = 5;
export const BLOCK_MORALE_MAX = 100;

export interface TagOutcome {
  blockId: string;
  blockName: string;
  /** Gang landing the tag — becomes `taggedBy`. */
  gangName: string;
  heatGained: number;
  moraleChange: number;
}

export function clampHeat(value: number): number {
  return Math.max(0, Math.min(BLOCK_HEAT_MAX, value));
}

export function clampMorale(value: number): number {
  return Math.max(0, Math.min(BLOCK_MORALE_MAX, value));
}

/**
 * A block that exists only as a graffiti target has no entry in the block
 * store yet. Create the minimum a territory view needs rather than a full
 * simulated block — placements and income belong to whoever owns it, and
 * inventing those would put phantom earnings on the map.
 */
export function createNpcBlockStub(blockId: string, blockName: string): BlockData {
  return {
    id: blockId,
    address: blockName,
    lat: 0,
    lng: 0,
    owner: 'npc' as BlockOwner,
    grid: useBlockStore.getState().generateDefaultGrid(),
    placements: [],
    incomePerTick: 0,
    heat: 0,
    morale: 50,
    members: 0,
    viewMode: 'topdown',
    pendingIncome: 0,
  };
}

/**
 * Record a successful tag. Returns the block as written, or null when the
 * outcome carries no block to attribute it to.
 *
 * Note the sign convention: `moraleChange` is the ATTACKER's morale boost,
 * so it is subtracted from the defending block. A crew that just got tagged
 * does not feel better about it.
 */
export function applyTagToBlock(outcome: TagOutcome): BlockData | null {
  if (!outcome.blockId) return null;

  const store = useBlockStore.getState();
  const existing = store.getBlock(outcome.blockId);
  const base = existing ?? createNpcBlockStub(outcome.blockId, outcome.blockName);

  const updated: BlockData = {
    ...base,
    heat: clampHeat(base.heat + outcome.heatGained),
    morale: clampMorale(base.morale - outcome.moraleChange),
    taggedBy: outcome.gangName,
    taggedAt: new Date().toISOString(),
  };

  store.upsertBlock(updated);
  return updated;
}
