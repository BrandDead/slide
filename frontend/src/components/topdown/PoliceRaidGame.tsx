// ============================================================
// PoliceRaidGame.tsx — Police Raid mini-game
//
// Triggered when block heat >= 5.  A timed grid-clear:
//   • Police advance from top and bottom edges
//   • Player taps members to begin evacuation
//   • Caught members go to jail; their product is seized
//   • Results feed back to blockStore + gangStore
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createRaidState,
  startEvacuation,
  tickRaid,
  getRaidSummary,
  type RaidState,
  type RaidMember,
  type PoliceUnit,
  RAID_GRID_COLS,
  RAID_GRID_ROWS,
} from '../../utils/policeRaidEngine';
import { useBlockStore } from '../../stores/blockStore';
import { useGangStore, usePlayerStore } from '../../stores/gameStore';
import './PoliceRaidGame.css';

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
  const { members, updateMember } = useGangStore();
  const { updateMoney } = usePlayerStore();

  const block = blocks[blockId];
  const [raidState, setRaidState] = useState<RaidState | null>(null);
  const [showResults, setShowResults] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedRef = useRef(false);

  // ── Initialise ──────────────────────────────────────────
  useEffect(() => {
    if (!block) return;
    const policeCount = Math.min(2 + block.heat, 6); // scales with heat
    const placements = block.placements.map((p) => ({
      memberId: p.memberId,
      memberName: p.memberName,
      role: p.role,
      x: p.x,
      y: p.y,
      heldCash: Math.floor(p.incomePerTick * 3),
      heldDrugs: 1,
    }));
    const initial = createRaidState(placements, policeCount);
    setRaidState({ ...initial, phase: 'active' });
  }, [blockId]);

  // ── Tick loop ────────────────────────────────────────────
  useEffect(() => {
    if (!raidState || raidState.phase === 'resolved') return;
    tickRef.current = setInterval(() => {
      setRaidState((prev) => {
        if (!prev || prev.phase === 'resolved') return prev;
        return tickRaid(prev);
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [raidState?.phase]);

  // ── Detect resolution ────────────────────────────────────
  useEffect(() => {
    if (!raidState || raidState.phase !== 'resolved' || resolvedRef.current) return;
    resolvedRef.current = true;
    if (tickRef.current) clearInterval(tickRef.current);
    setShowResults(true);

    // Apply consequences
    const summary = getRaidSummary(raidState);

    // Jail caught members
    for (const m of raidState.caught) {
      updateMember(m.memberId, { status: 'jailed' });
      removeMemberFromBlock(blockId, m.memberId);
    }

    // Seize cash
    if (summary.cashSeized > 0) {
      updateMoney(-summary.cashSeized);
    }

    // Reduce block heat (raid "satisfied" the police)
    if (block && summary.heatReduction > 0) {
      upsertBlock({ ...block, heat: Math.max(0, block.heat - summary.heatReduction) });
    }
  }, [raidState?.phase]);

  const handleMemberTap = useCallback((memberId: string) => {
    setRaidState((prev) => prev ? startEvacuation(prev, memberId) : prev);
  }, []);

  const handleDone = useCallback(() => {
    if (!raidState) return;
    const caught = raidState.caught.map((m) => m.memberId);
    onResolved(caught, raidState.cashSeized);
  }, [raidState, onResolved]);

  if (!raidState) {
    return <div className="raid-loading">Initialising raid...</div>;
  }

  const summary = raidState.phase === 'resolved' ? getRaidSummary(raidState) : null;

  return (
    <div className="police-raid-game">
      {/* Header */}
      <div className="raid-header">
        <div className="raid-title">🚔 POLICE RAID</div>
        <div className={`raid-timer ${raidState.ticksRemaining <= 10 ? 'urgent' : ''}`}>
          {raidState.ticksRemaining}s
        </div>
        <div className="raid-hint">TAP MEMBERS TO EVACUATE</div>
      </div>

      {/* Grid */}
      <div
        className="raid-grid"
        style={{
          width: RAID_GRID_COLS * CELL_SIZE,
          height: RAID_GRID_ROWS * CELL_SIZE,
        }}
      >
        {/* Zone cells */}
        {Array.from({ length: RAID_GRID_ROWS }, (_, r) =>
          Array.from({ length: RAID_GRID_COLS }, (_, c) => (
            <div
              key={`cell-${c}-${r}`}
              className="raid-cell"
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
        {raidState.police.map((cop: PoliceUnit) => (
          <motion.div
            key={cop.id}
            className="raid-police"
            style={{
              left: cop.col * CELL_SIZE + CELL_SIZE / 2,
              top: cop.row * CELL_SIZE + CELL_SIZE / 2,
            }}
            animate={{ left: cop.col * CELL_SIZE + CELL_SIZE / 2, top: cop.row * CELL_SIZE + CELL_SIZE / 2 }}
            transition={{ duration: 0.4, ease: 'linear' }}
          >
            🚔
          </motion.div>
        ))}

        {/* Member sprites */}
        {raidState.members.map((m: RaidMember) => (
          <motion.div
            key={m.memberId}
            className={`raid-member status-${m.status}`}
            style={{
              left: m.col * CELL_SIZE + CELL_SIZE / 2,
              top: m.row * CELL_SIZE + CELL_SIZE / 2,
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
                  style={{ width: `${((2 - m.evacTicksLeft) / 2) * 100}%` }}
                />
              </div>
            )}
          </motion.div>
        ))}

        {/* Evacuated flash */}
        {raidState.evacuated.map((m: RaidMember) => (
          <motion.div
            key={`evac-${m.memberId}`}
            className="raid-evacuated-flash"
            style={{
              left: m.col * CELL_SIZE + CELL_SIZE / 2,
              top: m.row * CELL_SIZE + CELL_SIZE / 2,
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
        <span>Safe: {raidState.evacuated.length}</span>
        <span>Caught: {raidState.caught.length}</span>
        <span>At Risk: {raidState.members.length}</span>
      </div>

      {/* Results overlay */}
      <AnimatePresence>
        {showResults && summary && (
          <motion.div
            className="raid-results"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2>RAID OVER</h2>
            <div className="raid-results-grid">
              <div className="rr-item good">
                <span className="rr-val">{summary.evacuated}</span>
                <span className="rr-label">Escaped</span>
              </div>
              <div className="rr-item bad">
                <span className="rr-val">{summary.caught}</span>
                <span className="rr-label">Jailed</span>
              </div>
              <div className="rr-item bad">
                <span className="rr-val">${summary.cashSeized.toLocaleString()}</span>
                <span className="rr-label">Cash Seized</span>
              </div>
              <div className="rr-item bad">
                <span className="rr-val">{summary.drugsSeized}</span>
                <span className="rr-label">Drugs Seized</span>
              </div>
            </div>
            {summary.caught > 0 && (
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
