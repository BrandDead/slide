// ============================================================
// GetBackClock — NBA-style shot clock on revenge
// Sprint 15-B
//
// A persistent HUD badge that sits above the dock and counts down
// the window you have to get back for a lost member. Tapping it
// expands a panel listing who is wanted and what is at stake.
//
// The clock derives its display from wall time on every tick rather
// than decrementing a stored counter, so backgrounding the app or
// reloading does not desync it. A single one-second interval drives
// re-renders; expiry sweeping is handled here too so morale
// penalties land even if the player never opens the panel.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useGetBackStore,
  remainingMs,
  remainingFraction,
  formatClock,
  urgency,
  GET_BACK_CONFIG,
} from '../../stores/getBackStore';
import {
  useGangStore,
  useMoraleStore,
  useNotificationStore,
  useNavigationStore,
} from '../../stores/gameStore';
import type { GetBackWindow, GetBackTrigger } from '../../types/game.types';
import './GetBackClock.css';

const TRIGGER_LABELS: Record<GetBackTrigger, string> = {
  slide_casualty: 'LOST ON THE BLOCK',
  bounty_fulfilled: 'CONTRACT CASHED ON YOURS',
  special_person: 'THEY TOUCHED FAMILY',
  block_attack: 'LOST DEFENDING THE BLOCK',
};

const TRIGGER_COPY: Record<GetBackTrigger, string> = {
  slide_casualty:
    'Somebody slid on your block and took one of yours. Catch anybody who was in that car.',
  bounty_fulfilled:
    'Somebody cashed a contract on one of yours. The payout is public — you know who.',
  special_person:
    'They went after a member\u2019s people. Handle it or watch that member\u2019s loyalty go.',
  block_attack:
    'They came to your block and you lost somebody holding it down. Return the visit.',
};

interface GetBackClockProps {
  /** Hide the badge on screens that already own the bottom of the viewport. */
  hidden?: boolean;
}

const GetBackClock: React.FC<GetBackClockProps> = ({ hidden = false }) => {
  const windows = useGetBackStore((s) => s.windows);
  const sweepExpired = useGetBackStore((s) => s.sweepExpired);
  const { members } = useGangStore();
  const { applyMoraleChange } = useMoraleStore();
  const { addNotification } = useNotificationStore();
  const { navigateTo } = useNavigationStore();

  /**
   * There is no single gang-wide morale value — morale lives per member. A
   * gang-wide swing is applied to every active member so the roster drifts
   * together, which is what "the gang lost faith" actually means mechanically.
   */
  const applyGangWideMorale = useCallback(
    (delta: number) => {
      for (const m of members) {
        if (m.status !== 'active') continue;
        applyMoraleChange(m.id, delta, Math.round(delta / 2));
      }
    },
    [members, applyMoraleChange],
  );

  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);

  // One interval drives every countdown on screen.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = useMemo(
    () => windows.filter((w) => w.outcome === 'pending' && remainingMs(w, now) > 0),
    [windows, now],
  );

  const soonest: GetBackWindow | null = useMemo(() => {
    if (active.length === 0) return null;
    return active.reduce((best, w) =>
      remainingMs(w, now) < remainingMs(best, now) ? w : best,
    );
  }, [active, now]);

  // Sweep lapsed windows and apply the morale penalty for letting it slide.
  // Runs off the same tick so it happens whether or not the panel is open.
  useEffect(() => {
    const lapsed = windows.filter(
      (w) => w.outcome === 'pending' && remainingMs(w, now) === 0,
    );
    if (lapsed.length === 0) return;

    const results = sweepExpired(now);
    for (const r of results) {
      applyGangWideMorale(r.moraleSwing.retaliator);
      addNotification({
        type: 'danger',
        title: 'CLOCK RAN OUT',
        message:
          `Nobody answered for ${r.window.lostMemberName}. ` +
          `${r.window.offendingGangName} walked. Gang morale down ${Math.abs(r.moraleSwing.retaliator)}.`,
        timestamp: Date.now(),
      } as never);
    }
    // `now` is intentionally the only trigger — windows is read fresh each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const handleGoHunt = useCallback(() => {
    setExpanded(false);
    navigateTo('map');
  }, [navigateTo]);

  if (hidden || !soonest) return null;

  const band = urgency(soonest, now);
  const ms = remainingMs(soonest, now);
  const fraction = remainingFraction(soonest, now);

  return (
    <>
      <motion.button
        className={`gbc-badge ${band}`}
        onClick={() => setExpanded(true)}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        whileTap={{ scale: 0.96 }}
      >
        <span className="gbc-badge-label">GET BACK</span>
        <span className="gbc-badge-clock">{formatClock(ms)}</span>
        {active.length > 1 && (
          <span className="gbc-badge-more">+{active.length - 1}</span>
        )}
        <span
          className="gbc-badge-bar"
          style={{ width: `${Math.max(2, fraction * 100)}%` }}
        />
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="gbc-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
          >
            <motion.div
              className="gbc-panel"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="gbc-panel-head">
                <span className="gbc-panel-title">GET BACK</span>
                <span className="gbc-panel-sub">
                  {active.length} open {active.length === 1 ? 'debt' : 'debts'}
                </span>
              </div>

              <p className="gbc-explainer">
                Answer inside the clock and your gang takes{' '}
                {GET_BACK_CONFIG.SUCCESS_MULTIPLIER}x the morale they gained — and
                they lose it plus what they banked. Let it run out and your own crew
                drops {GET_BACK_CONFIG.EXPIRY_MORALE_PENALTY}.
              </p>

              <div className="gbc-list">
                {active
                  .slice()
                  .sort((a, b) => remainingMs(a, now) - remainingMs(b, now))
                  .map((w) => {
                    const wBand = urgency(w, now);
                    const wFraction = remainingFraction(w, now);
                    return (
                      <div key={w.id} className={`gbc-item ${wBand}`}>
                        <div className="gbc-item-head">
                          <span className="gbc-item-trigger">
                            {TRIGGER_LABELS[w.trigger]}
                          </span>
                          <span className={`gbc-item-clock ${wBand}`}>
                            {formatClock(remainingMs(w, now))}
                          </span>
                        </div>

                        <div className="gbc-item-track">
                          <div
                            className={`gbc-item-fill ${wBand}`}
                            style={{ width: `${Math.max(1, wFraction * 100)}%` }}
                          />
                        </div>

                        <div className="gbc-item-lost">
                          For <strong>{w.lostMemberName}</strong> · on{' '}
                          <strong>{w.offendingGangName}</strong>
                        </div>

                        <p className="gbc-item-copy">{TRIGGER_COPY[w.trigger]}</p>

                        {w.wantedMemberNames.length > 0 && (
                          <div className="gbc-wanted">
                            <span className="gbc-wanted-label">CATCH ANY OF THESE</span>
                            <div className="gbc-wanted-names">
                              {w.wantedMemberNames.map((n, i) => (
                                <span key={`${w.id}_${i}`} className="gbc-wanted-name">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="gbc-stakes">
                          <span>
                            Win: +{w.offenderMoraleGained * GET_BACK_CONFIG.SUCCESS_MULTIPLIER}{' '}
                            morale
                          </span>
                          <span className="gbc-stakes-loss">
                            Miss: &minus;{GET_BACK_CONFIG.EXPIRY_MORALE_PENALTY} morale
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <button className="gbc-hunt-btn" onClick={handleGoHunt}>
                OPEN THE MAP
              </button>
              <button className="gbc-close" onClick={() => setExpanded(false)}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GetBackClock;
