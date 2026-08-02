// ============================================================
// PhaserTopDownBlock.tsx — React wrapper for BlockTopDownScene
//
// Mounts a Phaser game into a div, feeds it block data from
// the blockStore, and bridges Phaser events back to React
// callbacks so the parent (BlockModeView) can drive placement
// and navigation.
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { BlockTopDownScene } from './BlockTopDownScene';
import { useBlockStore } from '../../stores/blockStore';
import { TD_CANVAS_W, TD_CANVAS_H } from './blockTopDownCoords';
import './PhaserTopDownBlock.css';

export interface PhaserTopDownBlockProps {
  blockId: string;
  /** Called when the player single-taps a cell (for placement) */
  onCellClick?: (col: number, row: number) => void;
  /** Called when the player single-taps a member sprite */
  onMemberClick?: (memberId: string, col: number, row: number) => void;
  /** Called when the player double-taps a member (first-person toggle) */
  onFirstPersonToggle?: (memberId: string, col: number, row: number) => void;
}

export const PhaserTopDownBlock: React.FC<PhaserTopDownBlockProps> = ({
  blockId,
  onCellClick,
  onMemberClick,
  onFirstPersonToggle,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BlockTopDownScene | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull block data from the store
  const block = useBlockStore((s) => s.blocks[blockId]);

  // ── Stable callbacks ──────────────────────────────────────
  const handleCellClick = useCallback(
    ({ col, row }: { col: number; row: number }) => onCellClick?.(col, row),
    [onCellClick]
  );
  const handleMemberClick = useCallback(
    ({ memberId, col, row }: { memberId: string; col: number; row: number }) =>
      onMemberClick?.(memberId, col, row),
    [onMemberClick]
  );
  const handleFirstPersonToggle = useCallback(
    ({ memberId, col, row }: { memberId: string; col: number; row: number }) =>
      onFirstPersonToggle?.(memberId, col, row),
    [onFirstPersonToggle]
  );

  // ── Mount Phaser once ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !block) return;

    try {
      const scene = new BlockTopDownScene();
      scene.setBlock(block);
      sceneRef.current = scene;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: TD_CANVAS_W,
        height: TD_CANVAS_H,
        parent: containerRef.current,
        backgroundColor: '#0a0a14',
        scene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        banner: false,
        audio: { noAudio: true },
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;

      scene.events.once('ready', () => {
        setIsReady(true);
        scene.events.on('cellClick', handleCellClick);
        scene.events.on('memberClick', handleMemberClick);
        scene.events.on('firstPersonToggle', handleFirstPersonToggle);
      });
    } catch (err) {
      setError(String(err));
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
        setIsReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]); // Only remount when blockId changes

  // ── Sync placements when store updates ───────────────────
  useEffect(() => {
    if (isReady && sceneRef.current && block) {
      sceneRef.current.updatePlacements(block.placements);
    }
  }, [isReady, block?.placements]);

  // ── Sync callbacks ────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !sceneRef.current) return;
    const scene = sceneRef.current;
    scene.events.off('cellClick', handleCellClick);
    scene.events.off('memberClick', handleMemberClick);
    scene.events.off('firstPersonToggle', handleFirstPersonToggle);
    scene.events.on('cellClick', handleCellClick);
    scene.events.on('memberClick', handleMemberClick);
    scene.events.on('firstPersonToggle', handleFirstPersonToggle);
  }, [isReady, handleCellClick, handleMemberClick, handleFirstPersonToggle]);

  if (!block) {
    return (
      <div className="ptdb-error">
        Block not found: {blockId}
      </div>
    );
  }

  return (
    <div className="ptdb-wrapper">
      {error && (
        <div className="ptdb-error">
          Phaser failed to initialise: {error}
        </div>
      )}
      {!isReady && !error && (
        <div className="ptdb-loading">
          <span className="ptdb-loading-dot" />
          <span className="ptdb-loading-dot" />
          <span className="ptdb-loading-dot" />
        </div>
      )}
      <div
        ref={containerRef}
        className={`ptdb-canvas ${isReady ? 'ptdb-canvas--ready' : ''}`}
        style={{ width: TD_CANVAS_W, height: TD_CANVAS_H }}
      />
      {isReady && (
        <div className="ptdb-hint">
          Tap to select · Double-tap member for street view
        </div>
      )}
    </div>
  );
};

export default PhaserTopDownBlock;
