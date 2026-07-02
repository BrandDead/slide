// ============================================================
// DriveByEngine — Attack / Defend Loop
// Orchestrates a full drive-by event lifecycle:
//   incoming → active (shooting window) → retreating → resolved
// Integrates with blockStore for state, StreetBlock for visuals
// Sprint: block-mode-combat-assets
// ============================================================

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useBlockStore } from '../../stores/blockStore';
import { usePlayerStore, useGangStore } from '../../stores/gameStore';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import { soundManager } from '../../utils/SoundManager';
import type {
  BlockData,
  DriveByEvent,
  DriveByShot,
  DriveByPhase,
} from '../../types/block.types';
import StreetBlock from '../map/StreetBlock';
import CanvasStreetRenderer from './CanvasStreetRenderer';
import FPSOverlay from './FPSOverlay';
import './BlockDriveByEngine.css';

// Use canvas renderer for active drive-by phases; DOM renderer otherwise
const USE_CANVAS_RENDERER = true;

// ─── Phase timing (ms) ───────────────────────────────────────
const PHASE_DURATIONS: Record<DriveByPhase, number> = {
  idle:       0,
  incoming:   2000,
  active:     5000,
  retreating: 1500,
  resolved:   0,
};

// ─── Accuracy helpers ────────────────────────────────────────
function calcHitChance(
  shooterLevel: number,
  targetCover: number,
  zoneExposure: number
): number {
  const base = 0.35;
  const levelBonus = (shooterLevel - 1) * 0.08;
  const coverPenalty = targetCover * 0.5;
  const exposureBonus = (zoneExposure / 100) * 0.3;
  return Math.min(0.95, Math.max(0.05, base + levelBonus + exposureBonus - coverPenalty));
}

function calcDamage(shooterLevel: number): number {
  const base = 20;
  const variance = Math.floor(Math.random() * 20);
  const levelBonus = (shooterLevel - 1) * 5;
  return base + variance + levelBonus;
}

// ─── Main Component ───────────────────────────────────────────
interface DriveByEngineProps {
  blockId: string;
  /** Called when the event fully resolves */
  onResolved?: (outcome: DriveByEvent['outcome'], casualties: string[]) => void;
  /** Called when the player manually triggers a drive-by on an enemy block */
  attackMode?: boolean;
  enemyBlockId?: string;
}

const DriveByEngine: React.FC<DriveByEngineProps> = ({
  blockId,
  onResolved,
  attackMode = false,
}) => {
  const {
    blocks,
    activeDriveBys,
    startDriveBy,
    recordShot,
    resolveDriveBy,
    setBlockViewMode,
  } = useBlockStore();
  const { player, updateHeat } = usePlayerStore();
  useGangStore();
  const { completeStep: completeTutorialStep } = useTutorialProgressStore();

  const block = blocks[blockId] as BlockData | undefined;
  const activeEvent = activeDriveBys[blockId] as DriveByEvent | undefined;

  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiShootIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [defenderShotCount, setDefenderShotCount] = useState(0);
  const [resultBanner, setResultBanner] = useState<string | null>(null);

  // ── Clear timers on unmount ──
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (aiShootIntervalRef.current) clearInterval(aiShootIntervalRef.current);
    };
  }, []);

  // ── Phase progression ──
  const advancePhase = useCallback(
    (event: DriveByEvent, nextPhase: DriveByPhase) => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);

      // Update phase in store
      startDriveBy({ ...event, phase: nextPhase });

      if (nextPhase === 'active') {
        // Start AI shooting
        aiShootIntervalRef.current = setInterval(() => {
          if (!block) return;
          const targets = block.placements.filter(
            (p) => ['curb', 'sidewalk', 'street'].includes(p.zoneType) && p.health > 0
          );
          if (targets.length === 0) return;

          const target = targets[Math.floor(Math.random() * targets.length)];
          const zone = block.grid[target.y]?.[target.x];
          const hitChance = calcHitChance(3, zone?.coverScore ?? 0.3, target.exposureRisk);
          const hit = Math.random() < hitChance;
          const damage = hit ? calcDamage(3) : 0;

          const shot: DriveByShot = {
            shooterId: event.attackerGangId,
            targetX: target.x,
            targetY: target.y,
            hit,
            damage,
            timestamp: Date.now(),
          };
          recordShot(blockId, shot, false);
          // SFX: distant gunshot from attacker car
          soundManager.play('gunshot_distant');
        }, 1200);

        // Schedule retreat
        phaseTimerRef.current = setTimeout(() => {
          if (aiShootIntervalRef.current) clearInterval(aiShootIntervalRef.current);
          advancePhase({ ...event, phase: 'active' }, 'retreating');
        }, PHASE_DURATIONS.active);
      } else if (nextPhase === 'retreating') {
        phaseTimerRef.current = setTimeout(() => {
          resolveEvent(event);
        }, PHASE_DURATIONS.retreating);
      }
    },
    [block, blockId, startDriveBy, recordShot]
  );

  // ── Resolve event ──
  const resolveEvent = useCallback(
        (_event: DriveByEvent) => {
      if (!block) return;
      // Count casualties (members with 0 health)
      const casualties = block.placements
        .filter((p) => p.health <= 0)
        .map((p) => p.memberId);

      // Determine outcome
      const defenderShooters = block.placements.filter(
        (p) => p.role === 'shooter' && p.health > 0
      );
      const outcome: DriveByEvent['outcome'] =
        defenderShooters.length >= 2
          ? 'repelled'
          : casualties.length > 0
          ? 'successful'
          : 'fled';

      resolveDriveBy(blockId, outcome);

      // Heat increase
      updateHeat(2);

      const bannerMsg =
        outcome === 'repelled'
          ? '✅ Drive-by repelled! Shooters held the block.'
          : outcome === 'successful'
          ? `⚠️ Drive-by hit! ${casualties.length} member(s) down.`
          : '🚗 They fled. Block held.';

      setResultBanner(bannerMsg);
      setTimeout(() => setResultBanner(null), 3500);

      // SFX based on outcome
      if (outcome === 'repelled') soundManager.play('level_up');
      else if (casualties.length > 0) soundManager.play('member_down');

      // Tutorial: first drive-by survived (any outcome counts)
      completeTutorialStep('first_driveby_survived');

      onResolved?.(outcome, casualties);
    },
    [block, blockId, resolveDriveBy, updateHeat, onResolved, completeTutorialStep]
  );

  // ── Initiate a drive-by (called when enemy slides on player's block) ──
  const initiateDriveBy = useCallback(
    (attackerGangId: string, attackerGangName: string) => {
      if (!block) return;
      if (activeEvent && activeEvent.phase !== 'resolved') return; // already active

      const event: DriveByEvent = {
        id: uuidv4(),
        blockId,
        attackerGangId,
        attackerGangName,
        vehicleType: 'sedan',
        phase: 'incoming',
        shots: [],
        defenderShots: [],
        casualties: [],
        startedAt: Date.now(),
      };

      startDriveBy(event);
      setBlockViewMode(blockId, 'street');

        // Schedule active phase
        phaseTimerRef.current = setTimeout(() => {
          advancePhase(event, 'active');
        }, PHASE_DURATIONS.incoming);
        // SFX: alert on incoming
        soundManager.play('alert_driveby');
    },
    [block, blockId, activeEvent, startDriveBy, setBlockViewMode, advancePhase]
  );

  // ── Player defend shot ──
  const handleDefend = useCallback(
    (_shot: DriveByShot) => {
      setDefenderShotCount((c) => c + 1);
    },
    []
  );

  // ── Simulate incoming attack (for testing / NPC triggers) ──
  const simulateIncoming = useCallback(() => {
    initiateDriveBy('npc-gang-001', 'Rival Crew');
  }, [initiateDriveBy]);

  // ── Attack mode: player initiates slide on enemy block ──
  const initiateAttack = useCallback(() => {
    if (!block) return;
    // In attack mode, the "block" is the enemy's block
    // We create an event where the player is the attacker
    const event: DriveByEvent = {
      id: uuidv4(),
      blockId,
      attackerGangId: player.id || 'player',
      attackerGangName: player.gangName || 'Your Crew',
      vehicleType: 'sedan',
      phase: 'incoming',
      shots: [],
      defenderShots: [],
      casualties: [],
      startedAt: Date.now(),
    };
    startDriveBy(event);
    setBlockViewMode(blockId, 'street');

    phaseTimerRef.current = setTimeout(() => {
      advancePhase(event, 'active');
    }, PHASE_DURATIONS.incoming);
  }, [block, blockId, player, startDriveBy, setBlockViewMode, advancePhase]);

  if (!block) return null;

  return (
    <div className="driveby-engine">
      {/* Street view — canvas renderer during combat, DOM renderer otherwise */}
      {USE_CANVAS_RENDERER && activeEvent && activeEvent.phase !== 'resolved' ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: 8 }}>
          <CanvasStreetRenderer
            placements={block.placements}
            activeDriveBy={activeEvent}
            width={480}
            height={270}
            onDefendShot={(x, y) => {
              const shot = {
                shooterId: 'player',
                targetX: x,
                targetY: y,
                hit: Math.random() > 0.4,
                damage: Math.floor(Math.random() * 30) + 10,
                timestamp: Date.now(),
              };
              recordShot(blockId, shot, true);
              handleDefend(shot);
            }}
          />
          {/* FPS overlay: gun hands, crosshair, ammo, bullet casings */}
          <FPSOverlay
            width={480}
            height={270}
            isActive={activeEvent.phase === 'active'}
            gunType="compact"
            accuracy={70}
            onShot={(x, y, hit) => {
              soundManager.play('gunshot');
              const shot = {
                shooterId: 'player',
                targetX: x,
                targetY: y,
                hit,
                damage: hit ? Math.floor(Math.random() * 30) + 10 : 0,
                timestamp: Date.now(),
              };
              recordShot(blockId, shot, true);
              handleDefend(shot);
            }}
          />
        </div>
      ) : (
        <StreetBlock
          block={block}
          activeDriveBy={activeEvent}
          onDefend={handleDefend}
        />
      )}

      {/* Action bar */}
      <div className="dbe-action-bar">
        {!activeEvent || activeEvent.phase === 'resolved' ? (
          <>
            {attackMode ? (
              <motion.button
                className="dbe-btn attack"
                onClick={initiateAttack}
                whileTap={{ scale: 0.95 }}
              >
                🚗 SLIDE ON THEM
              </motion.button>
            ) : (
              <motion.button
                className="dbe-btn simulate"
                onClick={simulateIncoming}
                whileTap={{ scale: 0.95 }}
              >
                🎯 Simulate Drive-By
              </motion.button>
            )}
          </>
        ) : (
          <div className="dbe-phase-indicator">
            <span className={`dbe-phase phase-${activeEvent.phase}`}>
              {activeEvent.phase === 'incoming' && '🚗 INCOMING...'}
              {activeEvent.phase === 'active' && '🔥 ACTIVE — RETURN FIRE!'}
              {activeEvent.phase === 'retreating' && '🏃 RETREATING...'}
            </span>
            <span className="dbe-shots">
              🎯 {defenderShotCount} shots fired
            </span>
          </div>
        )}
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {resultBanner && (
          <motion.div
            className="dbe-result-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {resultBanner}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriveByEngine;

// ─── Export helper for external triggers ─────────────────────
export { DriveByEngine };
