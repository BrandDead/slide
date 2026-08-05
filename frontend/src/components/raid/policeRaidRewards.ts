// ============================================================
// SLIDE — Police Raid consequences  (Sprint 14-B, Task 1)
// frontend/src/components/raid/policeRaidRewards.ts
//
// The single place a finished interactive raid touches game state.
// policeRaidEngine stays pure; this translates its result.
// ============================================================

import { usePlayerStore, useGangStore, useEconomyStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import {
  caughtMembers,
  savedMembers,
  RAID_CONFIG,
  type RaidState,
} from '../../utils/policeRaidEngine';

export interface RaidConsequences {
  jailedIds: string[];
  savedIds: string[];
  cashSeized: number;
  drugsSeized: number;
  blockHeatAfter: number | null;
}

/**
 * Apply a resolved raid.
 *
 * Call once — it moves money and member status. PoliceRaidGame guards
 * re-entry with a ref, matching the BipNDip pattern.
 */
export function applyRaidConsequences(state: RaidState): RaidConsequences {
  const caught = caughtMembers(state);
  const saved = savedMembers(state);

  const playerStore = usePlayerStore.getState();
  const gangStore = useGangStore.getState();
  const economyStore = useEconomyStore.getState();

  // ─── Cash ──────────────────────────────────────────────────
  // Never seize more than the player actually has. A raid should not be
  // able to push the balance negative and softlock every purchase.
  const cashSeized = Math.min(state.seizedCash, Math.max(0, playerStore.player.money));
  if (cashSeized > 0) playerStore.updateMoney(-cashSeized);

  // ─── Product ───────────────────────────────────────────────
  // Drawn down across whatever drugs are in inventory, cheapest first,
  // so a bust does not selectively wipe the player's best stock.
  let drugsRemaining = state.seizedDrugs;
  let drugsSeized = 0;
  if (drugsRemaining > 0) {
    const drugs = economyStore.inventory
      .filter((i) => i.type === 'drug' && i.quantity > 0)
      .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));

    for (const item of drugs) {
      if (drugsRemaining <= 0) break;
      const take = Math.min(item.quantity, drugsRemaining);
      economyStore.removeInventoryItem(item.itemId, take);
      drugsRemaining -= take;
      drugsSeized += take;
    }
  }

  // ─── Members ───────────────────────────────────────────────
  for (const member of caught) {
    gangStore.jailMember(member.memberId);
  }

  // ─── Block ─────────────────────────────────────────────────
  // Heat drops after a raid regardless of outcome — the block has
  // already been hit, so it stops being a target for a while. Caught
  // members are also pulled off the grid; leaving a jailed member
  // standing on a tile would keep earning income from a cell.
  let blockHeatAfter: number | null = null;
  if (state.blockId) {
    const blockStore = useBlockStore.getState();
    const block = blockStore.getBlock(state.blockId);
    if (block) {
      const caughtIds = new Set(caught.map((m) => m.memberId));
      blockHeatAfter = RAID_CONFIG.POST_RAID_HEAT;
      blockStore.upsertBlock({
        ...block,
        heat: RAID_CONFIG.POST_RAID_HEAT,
        placements: block.placements.filter((p) => !caughtIds.has(p.memberId)),
        members: Math.max(0, block.placements.length - caught.length),
      });
    }
  }

  return {
    jailedIds: caught.map((m) => m.memberId),
    savedIds: saved.map((m) => m.memberId),
    cashSeized,
    drugsSeized,
    blockHeatAfter,
  };
}
