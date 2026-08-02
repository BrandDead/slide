// ============================================================
// SLIDE — Bip N Dip  (Sprint 13, Task 1)
// frontend/src/components/topdown/BipNDipGame.tsx
//
// UI shell over bipNDipEngine. All rules live in the engine; this file
// owns rendering, input, and the two timers (alarm countdown, chase
// beat). Session state is a single object so a phase transition can
// never leave window/alarm/chase state disagreeing with each other.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigationStore, useGangStore } from '../../stores/gameStore';
import {
  createBipNDipSession,
  selectCar,
  breakWindowTap,
  revealLootSlot,
  tickSessionAlarm,
  bailOut,
  footChaseTap,
  generateCarLineup,
  calculateTotalLootValue,
  type BipNDipSession,
  type BipCar,
  type WindowBreakState,
} from '../../utils/bipNDipEngine';
import { applyBipRewards, type BipRewardSummary } from './bipNDipRewards';
import { resolveVehicleSprite } from './bipNDipAssets';
import './BipNDipGame.css';

type Side = WindowBreakState['windowSide'];

const SIDES: Side[] = ['driver', 'passenger', 'rear_left', 'rear_right'];
const SIDE_LABEL: Record<Side, string> = {
  driver: 'Driver',
  passenger: 'Passenger',
  rear_left: 'Rear L',
  rear_right: 'Rear R',
};

const TIER_CLASS: Record<BipCar['tier'], string> = {
  junk: 'bnd-tier-junk',
  standard: 'bnd-tier-standard',
  luxury: 'bnd-tier-luxury',
  exotic: 'bnd-tier-exotic',
};

/** Face value of a car's loot table — shown as an estimate, so it's fuzzed. */
function estimateLoot(car: BipCar): string {
  const total = car.lootTable.reduce(
    (sum, slot) => sum + slot.items.reduce((s, i) => s + i.value, 0),
    0,
  );
  const low = Math.floor((total * 0.6) / 10) * 10;
  const high = Math.ceil((total * 1.1) / 10) * 10;
  return `$${low}–$${high}`;
}

// ─── Foot chase ──────────────────────────────────────────────

type Arrow = 'up' | 'down' | 'left' | 'right';
const ARROWS: Arrow[] = ['up', 'down', 'left', 'right'];
const ARROW_GLYPH: Record<Arrow, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
const KEY_TO_ARROW: Record<string, Arrow> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

interface Cue {
  id: number;
  arrow: Arrow;
  spawnedAt: number;
}

/** Time a cue takes to travel from spawn to the hit line. */
const CUE_TRAVEL_MS = 1600;
/** Half-width of the window in which a tap counts at all. */
const HIT_WINDOW_MS = 400;

export const BipNDipGame: React.FC = () => {
  const { goBack } = useNavigationStore();
  const members = useGangStore((s) => s.members);

  const [session, setSession] = useState<BipNDipSession>(() => {
    const base = createBipNDipSession();
    // Three cars, per the brief — the engine defaults to five.
    return { ...base, lineup: generateCarLineup(3) };
  });
  const [activeSide, setActiveSide] = useState<Side>('driver');
  const [revealed, setRevealed] = useState<Side[]>([]);
  const [summary, setSummary] = useState<BipRewardSummary | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const settledRef = useRef(false);
  const cueIdRef = useRef(0);

  // Recruits run this game; fall back to level 1 when the crew is empty.
  const runner = useMemo(
    () => members.find((m) => m.status === 'active') ?? members[0] ?? null,
    [members],
  );
  const runnerLevel = runner?.level ?? 1;

  const phase = session.phase;
  const car = session.car;

  // ─── Alarm countdown ───────────────────────────────────────
  useEffect(() => {
    if (!session.alarm.isTriggered) return;
    if (phase !== 'window_breaking' && phase !== 'scavenging') return;

    const id = window.setInterval(() => {
      setSession((prev) => tickSessionAlarm(prev, 1, runnerLevel));
    }, 1000);
    return () => window.clearInterval(id);
  }, [session.alarm.isTriggered, phase, runnerLevel]);

  // ─── Chase cue spawner ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'foot_chase' || !session.footChase) return;

    const beatMs = (60_000 / session.footChase.bpm) / session.footChase.speedMultiplier;
    const id = window.setInterval(() => {
      cueIdRef.current += 1;
      setCues((prev) => [
        ...prev.filter((c) => performance.now() - c.spawnedAt < CUE_TRAVEL_MS + HIT_WINDOW_MS),
        {
          id: cueIdRef.current,
          arrow: ARROWS[Math.floor(Math.random() * ARROWS.length)],
          spawnedAt: performance.now(),
        },
      ]);
    }, Math.max(500, beatMs));
    return () => window.clearInterval(id);
  }, [phase, session.footChase?.bpm, session.footChase?.speedMultiplier]);

  // ─── Settle once, on any terminal phase ────────────────────
  useEffect(() => {
    if (phase !== 'escape_success' && phase !== 'arrested') return;
    if (settledRef.current) return;
    settledRef.current = true;
    setSummary(applyBipRewards(session, runner?.id));
  }, [phase, session, runner?.id]);

  // ─── Input ─────────────────────────────────────────────────

  const handleSelectCar = useCallback((carId: string) => {
    setSession((prev) => selectCar(prev, carId));
    setActiveSide('driver');
  }, []);

  const handleSmash = useCallback(() => {
    setSession((prev) => breakWindowTap(prev, activeSide));
  }, [activeSide]);

  const handleReveal = useCallback((side: Side) => {
    if (revealed.includes(side)) return;
    setRevealed((prev) => [...prev, side]);
    setSession((prev) => revealLootSlot(prev, side));
  }, [revealed]);

  const handleBail = useCallback(() => {
    setSession((prev) => bailOut(prev));
  }, []);

  const handleChaseInput = useCallback((arrow: Arrow) => {
    const now = performance.now();
    setCues((prevCues) => {
      // Score against the cue nearest the hit line, matching arrow first.
      const candidates = prevCues
        .map((c) => ({ cue: c, delta: Math.abs(now - c.spawnedAt - CUE_TRAVEL_MS) }))
        .sort((a, b) => a.delta - b.delta);

      const match = candidates.find(
        (c) => c.cue.arrow === arrow && c.delta <= HIT_WINDOW_MS,
      );

      // Accuracy degrades linearly across the hit window; the engine's
      // 0.6 threshold then decides hit vs miss.
      const accuracy = match ? 1 - match.delta / HIT_WINDOW_MS : 0;
      setSession((prev) => footChaseTap(prev, accuracy));
      setFeedback(accuracy >= 0.6 ? 'ON BEAT' : 'MISS');
      window.setTimeout(() => setFeedback(null), 300);

      return match ? prevCues.filter((c) => c.id !== match.cue.id) : prevCues;
    });
  }, []);

  useEffect(() => {
    if (phase !== 'foot_chase') return;
    const onKey = (e: KeyboardEvent) => {
      const arrow = KEY_TO_ARROW[e.key];
      if (!arrow) return;
      e.preventDefault();
      handleChaseInput(arrow);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleChaseInput]);

  // ─── Render ────────────────────────────────────────────────

  const windowState = car ? session.windowStates[activeSide] : undefined;
  const lootValue = calculateTotalLootValue(session.lootCollected);

  return (
    <div className="bnd-root">
      <header className="bnd-header">
        <button className="bnd-back" onClick={goBack} aria-label="Back">{'<'}</button>
        <h1 className="bnd-title">BIP N DIP</h1>
        <span className="bnd-purse">${lootValue}</span>
      </header>

      {session.alarm.isTriggered &&
        (phase === 'window_breaking' || phase === 'scavenging') && (
          <div
            className={`bnd-alarm ${session.alarm.timeRemaining <= 5 ? 'critical' : ''}`}
            role="timer"
          >
            ALARM — {session.alarm.timeRemaining}s
          </div>
        )}

      {/* PHASE 1 — CAR SELECTION */}
      {phase === 'car_selection' && (
        <section className="bnd-phase bnd-lineup">
          <p className="bnd-hint">Pick a mark. Alarms mean a clock.</p>
          <div className="bnd-car-grid">
            {session.lineup.map((c) => (
              <button
                key={c.id}
                className={`bnd-car-card ${TIER_CLASS[c.tier]}`}
                onClick={() => handleSelectCar(c.id)}
              >
                <img className="bnd-car-thumb" src={resolveVehicleSprite(c.tier)} alt="" />
                <span className="bnd-car-name">{c.name}</span>
                <span className="bnd-tier-badge">{c.tier.toUpperCase()}</span>
                <span className={`bnd-alarm-chip ${c.hasAlarm ? 'on' : 'off'}`}>
                  {c.hasAlarm ? `ALARM ${c.alarmTimer}s` : 'NO ALARM'}
                </span>
                <span className="bnd-strength-label">Glass</span>
                <div className="bnd-strength-bar">
                  <div style={{ width: `${(c.windowStrength / 10) * 100}%` }} />
                </div>
                <span className="bnd-car-loot">{estimateLoot(c)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* PHASE 2 — WINDOW BREAKING */}
      {phase === 'window_breaking' && car && (
        <section className="bnd-phase bnd-smash">
          <div className="bnd-side-picker">
            {SIDES.map((s) => (
              <button
                key={s}
                className={`bnd-side ${activeSide === s ? 'active' : ''} ${
                  session.windowStates[s]?.isBroken ? 'broken' : ''
                }`}
                onClick={() => setActiveSide(s)}
              >
                {SIDE_LABEL[s]}
              </button>
            ))}
          </div>

          <button className="bnd-car-stage" onClick={handleSmash} aria-label="Break window">
            <img className="bnd-car-large" src={resolveVehicleSprite(car.tier)} alt={car.name} />
            <span className="bnd-smash-prompt">TAP TO SMASH</span>
          </button>

          <div className="bnd-strength-bar large">
            <div style={{ width: `${windowState?.crackLevel ?? 0}%` }} />
          </div>
          <p className="bnd-hint">
            {windowState?.tapsCurrent ?? 0} / {windowState?.tapsRequired ?? car.windowStrength}
          </p>
        </section>
      )}

      {/* PHASE 3 — SCAVENGING */}
      {phase === 'scavenging' && car && (
        <section className="bnd-phase bnd-scavenge">
          <p className="bnd-hint">Glass is out. Grab what you can.</p>
          <div className="bnd-loot-zones">
            {SIDES.map((s) => {
              const isOpen = session.windowStates[s]?.isBroken;
              const done = revealed.includes(s);
              return (
                <button
                  key={s}
                  className={`bnd-zone ${done ? 'revealed' : ''} ${isOpen ? '' : 'sealed'}`}
                  disabled={!isOpen || done}
                  onClick={() => handleReveal(s)}
                >
                  <span className="bnd-zone-label">{SIDE_LABEL[s]}</span>
                  <span className="bnd-zone-state">
                    {!isOpen ? 'SEALED' : done ? 'CLEARED' : 'SEARCH'}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="bnd-loot-list">
            {session.lootCollected.map((item) => (
              <li key={item.id} className={`bnd-loot-item rarity-${item.rarity}`}>
                <span>{item.name}</span>
                <span>${item.value}</span>
              </li>
            ))}
            {session.lootCollected.length === 0 && (
              <li className="bnd-loot-empty">Nothing yet.</li>
            )}
          </ul>

          <div className="bnd-actions">
            <button className="bnd-primary" onClick={handleBail}>
              DIP WITH ${lootValue}
            </button>
            <button
              className="bnd-secondary"
              onClick={() => setSession((prev) => ({ ...prev, phase: 'window_breaking' }))}
            >
              ANOTHER WINDOW
            </button>
          </div>
        </section>
      )}

      {/* PHASE 4 — FOOT CHASE */}
      {phase === 'foot_chase' && session.footChase && (
        <section className="bnd-phase bnd-chase">
          <p className="bnd-chase-status">
            BEAT {session.footChase.currentBeat}/{session.footChase.totalBeats} · TRIPS{' '}
            {session.footChase.trips}/2
          </p>

          <div className="bnd-lane-stack">
            {cues.map((c) => {
              const progress = Math.min(1, (performance.now() - c.spawnedAt) / CUE_TRAVEL_MS);
              return (
                <span
                  key={c.id}
                  className={`bnd-cue lane-${c.arrow}`}
                  style={{ top: `${progress * 100}%` }}
                >
                  {ARROW_GLYPH[c.arrow]}
                </span>
              );
            })}
            <div className="bnd-hit-line" />
          </div>

          {feedback && <div className="bnd-feedback">{feedback}</div>}

          <div className="bnd-arrow-pad">
            {ARROWS.map((a) => (
              <button
                key={a}
                className={`bnd-arrow-btn lane-${a}`}
                onClick={() => handleChaseInput(a)}
                aria-label={a}
              >
                {ARROW_GLYPH[a]}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* PHASE 5 — RESULTS */}
      {(phase === 'escape_success' || phase === 'arrested') && (
        <section className="bnd-phase bnd-results">
          <h2 className={phase === 'arrested' ? 'bnd-bad' : 'bnd-good'}>
            {phase === 'arrested' ? 'CAUGHT' : 'CLEAN GETAWAY'}
          </h2>

          {phase === 'arrested' ? (
            <p className="bnd-hint">
              {runner?.name ?? 'Your runner'} got knocked. Loot went into evidence.
            </p>
          ) : (
            <ul className="bnd-loot-list">
              {session.lootCollected.map((item) => (
                <li key={item.id} className={`bnd-loot-item rarity-${item.rarity}`}>
                  <span>{item.name}</span>
                  <span>${item.value}</span>
                </li>
              ))}
            </ul>
          )}

          {summary && (
            <div className="bnd-summary">
              <div><span>Cash</span><span>${summary.cash}</span></div>
              <div><span>Stashed</span><span>{summary.itemsBanked.length}</span></div>
              <div><span>XP</span><span>{summary.xp}</span></div>
            </div>
          )}

          <button className="bnd-primary" onClick={goBack}>DONE</button>
        </section>
      )}
    </div>
  );
};

export default BipNDipGame;
