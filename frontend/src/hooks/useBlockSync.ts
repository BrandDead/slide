// ============================================================
// useBlockSync — React hook
// Syncs the Zustand block store to Supabase on changes.
// - Loads player blocks on mount (if authenticated)
// - Persists block updates with debounce
// - Subscribes to realtime placement changes
// Sprint: wire-morale-supabase-batch3
//
// Birthday-demo patch: accepts an `enabled` flag (default true).
// When false, all Supabase I/O is skipped so demo mode never
// leaks network calls or corrupts a real account's data.
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import { useBlockStore } from '../stores/blockStore';
import { apiBlockToBlockData } from '../utils/blockMappers';
import { usePlayerStore } from '../stores/gameStore';
import {
  persistBlock,
  loadPlayerBlocks,
  loadPlacements,
} from '../services/blockPersistence.service';

const DEBOUNCE_MS = 3000; // 3 s debounce before writing to Supabase

export function useBlockSync(enabled = true) {
  const { blocks, upsertBlock } = useBlockStore();
  const { player } = usePlayerStore();
  const userId = player?.id;

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialized = useRef(false);

  // ── Load blocks from Supabase on first mount ──
  useEffect(() => {
    if (!enabled || !userId || initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const remoteBlocks = await loadPlayerBlocks(userId);
        for (const partial of remoteBlocks) {
          if (!partial.id) continue;

          // A Flask hydration may already own the complete block/grid. Import
          // only the durable receipt projection in that case; upsertBlock
          // unions it with existing keys without replacing canonical state.
          const mergeReceiptsIntoExisting = () => {
            const existing = useBlockStore.getState().blocks[partial.id!];
            if (!existing) return false;
            const currentKeys = existing.appliedEncounterResultKeys ?? [];
            const incomingKeys = partial.appliedEncounterResultKeys ?? [];
            const currentKeySet = new Set(currentKeys);
            const newKeys = incomingKeys.filter((key) => !currentKeySet.has(key));
            const currentTail = currentKeys.at(-1);
            const tailIndex = currentTail ? incomingKeys.lastIndexOf(currentTail) : -1;
            const projectionAdvancesReceipts = incomingKeys.length > 0 && (
              currentKeys.length === 0
              || (tailIndex >= 0 && tailIndex < incomingKeys.length - 1)
            );
            if (incomingKeys.length) {
              upsertBlock({
                ...existing,
                // The Supabase projection is partial, but a new durable
                // receipt means its consequence fields outrank an older Flask
                // hydration. Keep Flask's canonical grid/roster and import the
                // atomic economy projection alongside the extended ledger.
                ...(projectionAdvancesReceipts ? {
                  heat: partial.heat ?? existing.heat,
                  morale: partial.morale ?? existing.morale,
                  pendingIncome: partial.pendingIncome ?? existing.pendingIncome,
                } : {}),
                appliedEncounterResultKeys: projectionAdvancesReceipts
                  ? [...currentKeys, ...newKeys]
                  : incomingKeys,
              });
            }
            return true;
          };
          if (mergeReceiptsIntoExisting()) {
            continue;
          }

          const placements = await loadPlacements(partial.id);
          // Flask can finish hydrating while the placement query is in
          // flight. Re-check after the await so a partial Supabase projection
          // never replaces the complete canonical block/grid.
          if (mergeReceiptsIntoExisting()) continue;
          upsertBlock(apiBlockToBlockData({
            ...partial,
            placements,
          } as Record<string, unknown>));
        }
      } catch (err) {
        console.warn('[BlockSync] Failed to load remote blocks:', err);
      }
    })();
  }, [enabled, userId, upsertBlock]);

  // ── Debounced persist on block changes ──
  const scheduleSync = useCallback(
    (blockId: string) => {
      if (!enabled || !userId) return;
      if (debounceTimers.current[blockId]) {
        clearTimeout(debounceTimers.current[blockId]);
      }
      debounceTimers.current[blockId] = setTimeout(async () => {
        const block = useBlockStore.getState().blocks[blockId];
        if (!block || block.owner !== 'player') return;
        try {
          await persistBlock(block, userId);
        } catch (err) {
          console.warn('[BlockSync] Failed to persist block:', err);
        }
      }, DEBOUNCE_MS);
    },
    [enabled, userId]
  );

  // Watch for block changes and schedule sync
  useEffect(() => {
    if (!enabled) return;
    const playerBlockIds = Object.keys(blocks).filter(
      (id) => blocks[id].owner === 'player'
    );
    playerBlockIds.forEach((id) => scheduleSync(id));
  }, [enabled, blocks, scheduleSync]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);
}
