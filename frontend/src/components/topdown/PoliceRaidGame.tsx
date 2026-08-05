// ============================================================
// PoliceRaidGame.tsx — Police Raid mini-game (Sprint 14-A/B)
//
// Triggered when block heat >= 5.  A timed grid-clear:
//   • Police advance from top and bottom edges (time-based rAF)
//   • Player taps members to begin evacuation
//   • Caught members go to jail; their product is seized
//   • Results feed back to blockStore + gangStore
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createRaidState,
  tapMember,
  advanceRaid,
  expireRaid,
  caughtMembers,
  savedMembers,
  secondsRemaining,
  evacProgress,
  isTileThreatened,
  RAID_CONFIG,
  type RaidState,
  type RaidMember,
  type PoliceUnit,
} from '../../utils/policeRaidEngine';
import { useBlockStore } from '../../stores/blockStore';
import { useGangStore, usePlayerStore } from '../../stores/gameStore';
import './PoliceRaidGame.css';

const GRID_SIZE = RAID_CONFIG.GRID_SIZE;

interface PoliceRaidGameProps {
  blockId: string;
  onResolved: (caught: string[], cashSeized: number) => void;
}

const CELL_SIZE = 52; // px per grid cell

const ROLE_COLORS: Record<string, string> = {
  dealer:   '#4ade80',
  shooter:  '#ef4444',
  enforcer: '#f97316',
  lookout:  '#facc15',
  driver:   '#60a5fa',
  chemist:  '#a78bfa',
  runner:   '#fb7185',
  boss:     '#fbbf24',
};

export const PoliceRaidGame: React.FC<PoliceRaidGameProps> = ({ blockId, onResolved }) => {
  const { blocks, upsertBlock, removeMemberFromBlock } = useBlockStore();
  const { updateMember } = useGangStore();
  const { updateMoney } = usePlayerStore();

  const block = blocks[blockId];
  const [raidState, setRaidState] = useState<RaidState | null>(null);
  const [showResults, setShowResults] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);

  // ── Initialise ──────────────────────────────────────────
  useEffect(() => {
    if (!block) return;
    const placements = block.placements ?? [];
    const initial = createRaidState(placements, blockId);
    setRaidState(initial);
    startTimeRef.current = null;
    resolvedRef.current = false;
  }, [blockId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── rAF game loop ────────────────────────────────────────
  useEffect(() => {
    if (!raidState || raidState.outcome !== 'in_progress') return;

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;

      setRaidState((prev) => {
        if (!prev || prev.outcome !== 'in_progress') return prev;
        if (elapsed >= RAID_CONFIG.DURATION_MS) {
          return expireRaid(prev);
        }
        return advanceRaid(prev, elapsed);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [raidState?.outcome]);

  // ── Detect resolution ────────────────────────────────────
  useEffect(() => {
    if (!raidState || raidState.outcome === 'in_progress' || resolvedRef.current) return;
    resolvedRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setShowResults(true);

    const caught = caughtMembers(raidState);
    const cashSeized = raidState.seizedCash;

    // Jail caught members
    for (const m of caught) {
      updateMember(m.memberId, { status: 'jailed' });
      removeMemberFromBlock(blockId, m.memberId);
    }

    // Seize cash
    if (cashSeized > 0) {
      updateMoney(-cashSeized);
    }

    // Reduce block heat after raid
    if (block) {
      upsertBlock({ ...block, heat: RAID_CONFIG.POST_RAID_HEAT });
    }
  }, [raidState?.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMemberTap = useCallback((memberId: string) => {
    setRaidState((prev) => prev ? tapMember(prev, memberId) : prev);
  }, []);

  const handleDone = useCallback(() => {
    if (!raidState) return;
    const caught = caughtMembers(raidState).map((m) => m.memberId);
    onResolved(caught, raidState.seizedCash);
  }, [raidState, onResolved]);

  if (!raidState) {
    return <div className="raid-loading">Initialising raid...</div>;
  }

  const secsLeft = secondsRemaining(raidState);
  const caught = caughtMembers(raidState);
  const safe = savedMembers(raidState);

  return (
    <div className="police-raid-game">
      {/* Header */}
      <div className="raid-header">
        <div className="raid-title">🚔 POLICE RAID</div>
        <div className={`raid-timer ${secsLeft <= 10 ? 'urgent' : ''}`}>
          {secsLeft}s
        </div>
        <div className="raid-hint">TAP MEMBERS TO EVACUATE</div>
      </div>

      {/* Grid */}
      <div
        className="raid-grid"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
        }}
      >
        {/* Zone cells */}
        {Array.from({ length: GRID_SIZE }, (_, r) =>
          Array.from({ length: GRID_SIZE }, (_, c) => (
            <div
              key={`cell-${c}-${r}`}
              className={`raid-cell${isTileThreatened(raidState, c, r) ? ' threatened' : ''}`}
              style={{
                left: c * CELL_SIZE,
                top: r * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            />
          ))
        )}

        {/* Police units */}
        {raidState.units.map((cop: PoliceUnit) => (
          <motion.div
            key={cop.id}
            className="raid-police"
            style={{
              left: cop.x * CELL_SIZE + CELL_SIZE / 2,
              top: cop.y * CELL_SIZE + CELL_SIZE / 2,
            }}
            animate={{ left: cop.x * CELL_SIZE + CELL_SIZE / 2, top: cop.y * CELL_SIZE + CELL_SIZE / 2 }}
            transition={{ duration: 0.4, ease: 'linear' }}
          >
            🚔
          </motion.div>
        ))}

        {/* Member sprites */}
        {raidState.members.map((m: RaidMember) => {
          const progress = evacProgress(m, raidState.elapsedMs);
          return (
            <motion.div
              key={m.memberId}
              className={`raid-member status-${m.status}`}
              style={{
                left: m.x * CELL_SIZE + CELL_SIZE / 2,
                top: m.y * CELL_SIZE + CELL_SIZE / 2,
                borderColor: ROLE_COLORS[m.role] ?? '#fff',
              }}
              onClick={() => handleMemberTap(m.memberId)}
              whileTap={{ scale: 0.9 }}
            >
              <span className="raid-member-role">{m.role.slice(0, 3).toUpperCase()}</span>
              {m.status === 'evacuating' && (
                <div className="raid-evac-bar">
                  <div
                    className="raid-evac-fill"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Safe flash */}
        {safe.map((m: RaidMember) => (
          <motion.div
            key={`safe-${m.memberId}`}
            className="raid-evacuated-flash"
            style={{
              left: m.x * CELL_SIZE + CELL_SIZE / 2,
              top: m.y * CELL_SIZE + CELL_SIZE / 2,
            }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.6 }}
          >
            ✅
          </motion.div>
        ))}
      </div>

      {/* Status bar */}
      <div className="raid-status-bar">
        <span>Safe: {safe.length}</span>
        <span>Caught: {caught.length}</span>
        <span>At Risk: {raidState.members.filter(m => m.status === 'deployed' || m.status === 'evacuating').length}</span>
      </div>

      {/* Results overlay */}
      <AnimatePresence>
        {showResults && raidState.outcome !== 'in_progress' && (
          <motion.div
            className="raid-results"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2>RAID OVER</h2>
            <div className="raid-results-grid">
              <div className="rr-item good">
                <span className="rr-val">{safe.length}</span>
                <span className="rr-label">Escaped</span>
              </div>
              <div className="rr-item bad">
                <span className="rr-val">{caught.length}</span>
                <span className="rr-label">Jailed</span>
              </div>
              <div className="rr-item bad">
                <span className="rr-val">${raidState.seizedCash.toLocaleString()}</span>
                <span className="rr-label">Cash Seized</span>
              </div>
              <div className="rr-item bad">
                <span className="rr-val">{raidState.seizedDrugs}</span>
                <span className="rr-label">Drugs Seized</span>
              </div>
            </div>
            {caught.length > 0 && (
              <p className="rr-note">
                Jailed members can be bailed out from the Contacts app.
              </p>
            )}
            <motion.button
              className="rr-done-btn"
              onClick={handleDone}
              whileTap={{ scale: 0.95 }}
            >
              Continue
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PoliceRaidGame;
