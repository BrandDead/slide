/**
 * DEALT/SLIDE — GhostThreatBanner (#81)
 * Fixed-position banner that surfaces the latest ghost-crew move that
 * threatens the player (attack / contested claim). Dismissable; reads from
 * the persistent ghostCrewStore feed.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  rivalAttackReceiptKey,
  selectGhostFeed,
  useGhostStore,
  type GhostFeedEvent,
} from '../../stores/ghostCrewStore';
import { useNavigationStore } from '../../stores/gameStore';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';
import { isDefenseReason } from '../../utils/ghostCrewEngine';

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  zIndex: 9998,
  backgroundColor: '#12071c',
  borderBottom: '2px solid #a855f7',
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontFamily: 'monospace',
  color: '#d8b4fe',
  boxSizing: 'border-box',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const crewNameStyle: React.CSSProperties = {
  fontWeight: 'bold',
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const actionStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#c084fc',
  textTransform: 'uppercase',
};

const descStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#e9d5ff',
};

const dismissBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #a855f7',
  color: '#d8b4fe',
  fontSize: '16px',
  cursor: 'pointer',
  padding: '4px 10px',
  borderRadius: '4px',
  fontFamily: 'monospace',
};

/** Events that warrant a player-facing banner. */
const BANNER_ACTIONS = new Set<GhostFeedEvent['action']>(['attack', 'claim']);

const GhostThreatBanner: React.FC = () => {
  const feed = useGhostStore(selectGhostFeed);
  const answered = useGhostStore((state) => state.appliedResponseKeys);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  // The Strip desk shows rival pressure inline; a fixed banner there covered
  // the Dealer/Shooter placement controls on phones.
  const onStripDesk = useNavigationStore((state) => state.currentApp === 'block_loop');
  // Every threat the player has dismissed. A single id let the previous
  // alert return as soon as the next one was dismissed, so with two open
  // threats the banner could never be cleared (and it covers the top of
  // every phone screen, including the Contacts header).
  const [dismissedIds, setDismissedIds] = React.useState<ReadonlySet<string>>(() => new Set());

  // Only open threats: defense results and attacks the player already
  // answered on the Strip belong in the City Briefing, not an alert.
  const openThreats = feed.filter(
    (e) => BANNER_ACTIONS.has(e.action)
      && !dismissedIds.has(e.id)
      && !isDefenseReason(e.reason)
      && !(e.action === 'attack' && e.targetBlockId === BLOCK_LOOP_IDS.blockId && (answered ?? []).includes(rivalAttackReceiptKey(e))),
  );
  const latest = onStripDesk ? undefined : openThreats[0];
  // Dismissing clears everything showing now; only newer threats return.
  const dismissOpenThreats = () => setDismissedIds((prev) => {
    const next = new Set(prev);
    for (const event of openThreats) next.add(event.id);
    return next;
  });
  const onStrip = latest?.action === 'attack' && latest.targetBlockId === BLOCK_LOOP_IDS.blockId;

  return (
    <AnimatePresence>
      {latest && (
        <motion.div
          key={latest.id}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={bannerStyle}
          role="alert"
          aria-live="polite"
        >
          <div style={contentStyle}>
            <span style={crewNameStyle}>🏴 {latest.crewName}</span>
            <span style={actionStyle}>{latest.action}</span>
            <span style={descStyle}>{latest.description}</span>
          </div>
          {onStrip && (
            <button
              type="button"
              style={{ ...dismissBtnStyle, marginLeft: 'auto', marginRight: 8, fontSize: '12px' }}
              onClick={() => {
                setDismissedIds((prev) => new Set(prev).add(latest.id));
                navigateTo('block_loop');
              }}
            >
              Defend
            </button>
          )}
          <button
            type="button"
            style={dismissBtnStyle}
            onClick={dismissOpenThreats}
            aria-label="Dismiss rival activity"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GhostThreatBanner;
