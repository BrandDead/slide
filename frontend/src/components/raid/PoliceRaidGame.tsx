// ============================================================
// SLIDE — Police Raid  (Sprint 14-B, Task 1)
// frontend/src/components/raid/PoliceRaidGame.tsx
//
// Renders the 8x8 grid, drives one animation-frame clock, and hands
// every rule decision to policeRaidEngine.
//
// The clock is a single rAF loop off performance.now() rather than a
// setInterval per unit. Police positions are a pure function of elapsed
// time, so a dropped frame or a backgrounded tab can never desync a
// unit from the member it is walking toward.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigationStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import {
  createRaidState,
  advanceRaid,
  expireRaid,
  tapMember,
  evacProgress,
  secondsRemaining,
  isTileThreatened,
  RAID_CONFIG,
  type RaidState,
} from '../../utils/policeRaidEngine';
import { applyRaidConsequences, type RaidConsequences } from './policeRaidRewards';
import './PoliceRaidGame.css';

const GRID = RAID_CONFIG.GRID_SIZE;
const CELLS = Array.from({ length: GRID * GRID }, (_, i) => i);

const OUTCOME_COPY = {
  clean: { title: 'BLOCK CLEARED', tone: 'good' },
  partial: { title: 'THEY GOT SOME', tone: 'warn' },
  disaster: { title: 'BLOCK SWEPT', tone: 'bad' },
} as const;

export const PoliceRaidGame: React.FC = () => {
  const { goBack } = useNavigationStore();
  const selectedBlockId = useBlockStore((s) => s.selectedBlockId);
  const blocks = useBlockStore((s) => s.blocks);

  const placements = useMemo(() => {
    const block = selectedBlockId ? blocks[selectedBlockId] : undefined;
    return block?.placements ?? [];
  }, [selectedBlockId, blocks]);

  const [state, setState] = useState<RaidState>(() =>
    createRaidState(placements, selectedBlockId),
  );
  const [consequences, setConsequences] = useState<RaidConsequences | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  const isOver = state.outcome !== 'in_progress';

  // ─── Clock ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOver) return;

    const step = () => {
      const now = performance.now();
      if (startedAtRef.current === null) startedAtRef.current = now;
      const elapsed = now - startedAtRef.current;

      setState((prev) => {
        if (prev.outcome !== 'in_progress') return prev;
        return elapsed >= RAID_CONFIG.DURATION_MS
          ? expireRaid(prev)
          : advanceRaid(prev, elapsed);
      });

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isOver]);

  // ─── Settle once ───────────────────────────────────────────
  useEffect(() => {
    if (!isOver || settledRef.current) return;
    settledRef.current = true;
    setConsequences(applyRaidConsequences(state));
  }, [isOver, state]);

  const handleTap = useCallback((memberId: string) => {
    setState((prev) => tapMember(prev, memberId));
  }, []);

  // ─── Derived view model ────────────────────────────────────

  const memberAt = useMemo(() => {
    const map = new Map<number, RaidState['members'][number]>();
    for (const m of state.members) map.set(m.y * GRID + m.x, m);
    return map;
  }, [state.members]);

  const unitAt = useMemo(() => {
    const set = new Set<number>();
    for (const u of state.units) set.add(u.y * GRID + u.x);
    return set;
  }, [state.units]);

  const seconds = secondsRemaining(state);
  const stillOut = state.members.filter(
    (m) => m.status === 'deployed' || m.status === 'evacuating',
  ).length;

  // ─── Empty block ───────────────────────────────────────────
  if (state.members.length === 0) {
    return (
      <div className="raid-root">
        <header className="raid-header">
          <h1 className="raid-title">POLICE RAID</h1>
        </header>
        <div className="raid-empty">
          <p>Nobody was working this block.</p>
          <p className="raid-sub">The sweep came up empty.</p>
          <button className="raid-primary" onClick={goBack}>BACK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="raid-root">
      <header className="raid-header">
        <h1 className="raid-title">POLICE RAID</h1>
        <div className={`raid-clock ${seconds <= 10 ? 'critical' : ''}`} role="timer">
          {seconds}s
        </div>
        <span className="raid-count">{stillOut} EXPOSED</span>
      </header>

      {!isOver && (
        <p className="raid-hint">Tap your people to pull them out. Takes 1.5s each.</p>
      )}

      <div className="raid-grid" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}>
        {CELLS.map((idx) => {
          const x = idx % GRID;
          const y = Math.floor(idx / GRID);
          const member = memberAt.get(idx);
          const hasUnit = unitAt.has(idx);
          const threatened = !hasUnit && isTileThreatened(state, x, y);

          return (
            <div
              key={idx}
              className={`raid-cell ${hasUnit ? 'cop' : ''} ${threatened ? 'threatened' : ''}`}
            >
              {hasUnit && <span className="raid-cop" aria-label="police unit">🚓</span>}

              {member && (
                <button
                  className={`raid-member status-${member.status}`}
                  onClick={() => handleTap(member.memberId)}
                  disabled={member.status !== 'deployed' || isOver}
                  aria-label={`${member.memberName} — ${member.status}`}
                >
                  <span className="raid-member-name">
                    {member.memberName.split(' ')[0]}
                  </span>
                  {member.status === 'evacuating' && (
                    <span
                      className="raid-evac-bar"
                      style={{ width: `${evacProgress(member, state.elapsedMs) * 100}%` }}
                    />
                  )}
                  {member.status === 'safe' && <span className="raid-badge good">OUT</span>}
                  {member.status === 'caught' && <span className="raid-badge bad">GOT</span>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isOver && state.outcome !== 'in_progress' && (
        <section className="raid-results">
          <h2 className={`raid-outcome ${OUTCOME_COPY[state.outcome].tone}`}>
            {OUTCOME_COPY[state.outcome].title}
          </h2>

          {consequences && (
            <div className="raid-summary">
              <div><span>Pulled out</span><span>{consequences.savedIds.length}</span></div>
              <div><span>Jailed</span><span>{consequences.jailedIds.length}</span></div>
              <div><span>Cash seized</span><span>${consequences.cashSeized.toLocaleString()}</span></div>
              <div><span>Product seized</span><span>{consequences.drugsSeized}</span></div>
            </div>
          )}

          {consequences && consequences.jailedIds.length > 0 && (
            <p className="raid-note">
              Bail your people out from the CREW app before they cost you morale.
            </p>
          )}

          <button className="raid-primary" onClick={goBack}>DONE</button>
        </section>
      )}
    </div>
  );
};

export default PoliceRaidGame;
