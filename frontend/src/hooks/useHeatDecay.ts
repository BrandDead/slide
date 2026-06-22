// ============================================================
// useHeatDecay — React hook
// Runs heat decay on all player-owned blocks every 60 seconds.
// Integrates heatSystem.ts calculateDecayedHeat with blockStore.
// Sprint: morale-heat-photo-batch2
// ============================================================

import { useEffect, useRef } from 'react';
import { useBlockStore } from '../stores/blockStore';
import { calculateDecayedHeat, createInitialHeatState } from '../utils/heatSystem';

// Decay interval: every 60 seconds in real time
const DECAY_INTERVAL_MS = 60_000;

export function useHeatDecay() {
  const { blocks, upsertBlock } = useBlockStore();
  const lastDecayRef = useRef<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const playerBlocks = Object.values(blocks).filter(b => b.owner === 'player');

      playerBlocks.forEach(block => {
        if (block.heat <= 0) return;

        // Build a transient HeatState from the block's current heat
        const heatState = {
          ...createInitialHeatState(),
          level: block.heat * 20, // block.heat is 0-5, heatSystem uses 0-100
          lastDecayTime: lastDecayRef.current,
        };

        const decayed = calculateDecayedHeat(heatState);
        const newHeat = Math.max(0, Math.round(decayed / 20)); // back to 0-5 scale

        if (newHeat !== block.heat) {
          upsertBlock({ ...block, heat: newHeat });
        }
      });

      lastDecayRef.current = now;
    }, DECAY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [blocks, upsertBlock]);
}
