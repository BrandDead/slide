// ============================================================
// PhaserSlideGame.tsx — React wrapper for Phaser SLIDE scene
//
// Bridges Phaser scene events → slideGameEngine state machine.
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import {
  SlidePhaser3Scene,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './SlidePhaser3Scene';
import type { SlideGameState } from '../../utils/slideGameEngine';

export interface PhaserSlideGameProps {
  initialState: SlideGameState;
  onStateChange?: (state: SlideGameState) => void;
}

export const PhaserSlideGame: React.FC<PhaserSlideGameProps> = ({
  initialState,
  onStateChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<SlidePhaser3Scene | null>(null);
  const stateRef = useRef<SlideGameState>(initialState);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle cell clicks — visual feedback only; parent drives state via onStateChange
  const handleCellClick = useCallback(
    ({ col, row }: { col: number; row: number }) => {
      const state = stateRef.current;
      if (!state || !sceneRef.current) return;

      // Play visual shot effect based on current phase
      if (state.phase === 'attacker_shooting' && row > 0) {
        const fromCol = state.vehicle?.stopPositions?.[0] ?? col;
        sceneRef.current.playShot(fromCol, 0, col, row, false);
      } else if (state.phase === 'defender_shooting' && row === 0) {
        sceneRef.current.playShot(col, 1, col, 0, true);
      }

      // Notify parent of click so it can run the engine and push new state back
      onStateChange?.(state);
    },
    [onStateChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const scene = new SlidePhaser3Scene();
      sceneRef.current = scene;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        parent: containerRef.current,
        backgroundColor: '#0a0a0a',
        scene,
        scale: {
          mode: Phaser.Scale.NONE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        banner: false,
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;

      scene.events.once('ready', () => {
        setIsReady(true);
        stateRef.current = initialState;
        scene.updateState(initialState);
      });

      scene.events.on('cell_click', handleCellClick);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PhaserSlideGame] failed to init Phaser', err);
      setError(err instanceof Error ? err.message : 'Unknown Phaser error');
    }

    return () => {
      sceneRef.current?.events.off('cell_click', handleCellClick);
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push external state updates into the scene
  useEffect(() => {
    stateRef.current = initialState;
    if (sceneRef.current && isReady) {
      sceneRef.current.updateState(initialState);
    }
  }, [initialState, isReady]);

  if (error) {
    return (
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#ef4444',
          fontFamily: 'monospace',
          fontSize: 14,
          border: '1px solid #374151',
        }}
      >
        Loading combat...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <div ref={containerRef} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }} />
      {!isReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10,10,10,0.9)',
            color: '#9ca3af',
            fontFamily: 'monospace',
            fontSize: 14,
          }}
        >
          Loading combat...
        </div>
      )}
    </div>
  );
};

export default PhaserSlideGame;
