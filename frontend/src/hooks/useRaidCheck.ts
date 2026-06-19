// ============================================================
// useRaidCheck — React hook
// Polls the selected block's heat level every 45 seconds and
// rolls for a raid. Returns the blockId to raid so the parent
// can render RaidEventOverlay.
// Sprint: morale-heat-photo-batch2
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { useBlockStore } from '../stores/blockStore';
import { rollForRaid, createInitialHeatState } from '../utils/heatSystem';

const POLL_INTERVAL_MS = 45_000;

export function useRaidCheck(): { raidBlockId: string | null; clearRaid: () => void } {
  const { blocks } = useBlockStore();
  const [raidBlockId, setRaidBlockId] = useState<string | null>(null);
  const lastRaidRef = useRef<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const playerBlocks = Object.values(blocks).filter(b => b.owner === 'player');

      for (const block of playerBlocks) {
        if (block.heat <= 1) continue;

        const heatState = {
          ...createInitialHeatState(),
          level: block.heat * 20,
          lastRaidTime: lastRaidRef.current,
        };

        if (rollForRaid(heatState)) {
          lastRaidRef.current = Date.now();
          setRaidBlockId(block.id);
          break;
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [blocks]);

  return {
    raidBlockId,
    clearRaid: () => setRaidBlockId(null),
  };
}
