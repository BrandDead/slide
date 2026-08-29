/**
 * DEALT/SLIDE — GhostThreatBanner (#81)
 * Fixed-position banner that surfaces the latest ghost-crew move that
 * threatens the player (attack / contested claim). Dismissable; reads from
 * the persistent ghostCrewStore feed.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostStore, selectGhostFeed, type GhostFeedEvent } from '../../stores/ghostCrewStore';

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
  const [dismissedId, setDismissedId] = React.useState<string | null>(null);

  const latest = feed.find(
    (e) => BANNER_ACTIONS.has(e.action) && e.id !== dismissedId,
  );

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
          <button
            style={dismissBtnStyle}
            onClick={() => setDismissedId(latest.id)}
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
