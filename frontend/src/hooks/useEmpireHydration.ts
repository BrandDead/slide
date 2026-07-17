/**
 * Hydrate player cash/heat + owned blocks from Flask (Gate 0B authority).
 */

import { useEffect, useRef } from 'react';
import { blocksApi, playerApi } from '../services/api.service';
import { usePlayerStore } from '../stores/gameStore';
import { useBlockStore } from '../stores/blockStore';
import { apiBlockToBlockData } from '../utils/blockMappers';

export function useEmpireHydration(enabled: boolean) {
  const ran = useRef(false);
  const updatePlayer = usePlayerStore((s) => s.updatePlayer);
  const upsertBlock = useBlockStore((s) => s.upsertBlock);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;

    let cancelled = false;
    (async () => {
      try {
        const [player, owned] = await Promise.all([
          playerApi.getState(),
          blocksApi.getOwned(),
        ]);
        if (cancelled) return;
        updatePlayer({
          money: player.cash,
          heat: player.heat,
          level: player.level ?? 1,
          xp: player.xp ?? 0,
        });
        for (const raw of owned.blocks || []) {
          upsertBlock(apiBlockToBlockData(raw as Record<string, unknown>));
        }
      } catch (err) {
        // Backend may be offline in pure-UI sessions — keep local cache.
        console.warn('[useEmpireHydration] skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, updatePlayer, upsertBlock]);
}
