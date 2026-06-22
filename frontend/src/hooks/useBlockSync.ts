// ============================================================
// useBlockSync — React hook
// Syncs the Zustand block store to Supabase on changes.
// - Loads player blocks on mount (if authenticated)
// - Persists block updates with debounce
// - Subscribes to realtime placement changes
// Sprint: wire-morale-supabase-batch3
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useBlockStore } from '../stores/blockStore';
import { usePlayerStore } from '../stores/gameStore';
import {
  persistBlock,
  persistPlacements,
  loadPlayerBlocks,
  loadPlacements,
} from '../services/blockPersistence.service';

const DEBOUNCE_MS = 3000; // 3 s debounce before writing to Supabase

export function useBlockSync() {
  const { blocks, upsertBlock, generateDefaultGrid } = useBlockStore();
  const { player } = usePlayerStore();
  const userId = player?.id;

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialized = useRef(false);

  // ── Load blocks from Supabase on first mount ──
  useEffect(() => {
    if (!userId || initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const remoteBlocks = await loadPlayerBlocks(userId);
        for (const partial of remoteBlocks) {
          if (!partial.id) continue;

          // Don't overwrite blocks already in local store
          const existing = useBlockStore.getState().blocks[partial.id];
          if (existing) continue;

          // Rebuild full BlockData with default grid
          const grid = generateDefaultGrid();
          const placements = await loadPlacements(partial.id);

          upsertBlock({
            id: partial.id!,
            address: partial.address ?? '',
            lat: 0,
            lng: 0,
            owner: 'player',
            grid,
            placements,
            incomePerTick: partial.incomePerTick ?? 0,
            heat: partial.heat ?? 0,
            morale: partial.morale ?? 80,
            members: placements.length,
            viewMode: partial.viewMode ?? 'topdown',
            pendingIncome: partial.pendingIncome ?? 0,
            streetBackdropUrl: partial.streetBackdropUrl,
            topdownBgUrl: partial.topdownBgUrl,
          });
        }
      } catch (err) {
        console.warn('[BlockSync] Failed to load remote blocks:', err);
      }
    })();
  }, [userId, upsertBlock, generateDefaultGrid]);

  // ── Debounced persist on block changes ──
  const scheduleSync = useCallback(
    (blockId: string) => {
      if (!userId) return;
      if (debounceTimers.current[blockId]) {
        clearTimeout(debounceTimers.current[blockId]);
      }
      debounceTimers.current[blockId] = setTimeout(async () => {
        const block = useBlockStore.getState().blocks[blockId];
        if (!block || block.owner !== 'player') return;
        try {
          await persistBlock(block, userId);
          await persistPlacements(blockId, block.placements);
        } catch (err) {
          console.warn('[BlockSync] Failed to persist block:', err);
        }
      }, DEBOUNCE_MS);
    },
    [userId]
  );

  // Watch for block changes and schedule sync
  useEffect(() => {
    const playerBlockIds = Object.keys(blocks).filter(
      (id) => blocks[id].owner === 'player'
    );
    playerBlockIds.forEach((id) => scheduleSync(id));
  }, [blocks, scheduleSync]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);
}
