/**
 * DEALT/SLIDE — NPCThreatBanner.tsx
 * Fixed-position banner showing the most recent unacknowledged NPC threat.
 * Animates in/out with framer-motion.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useNPCStore,
  selectUnacknowledgedThreats,
} from '../../stores/npcStore';

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  zIndex: 9999,
  backgroundColor: '#1a0505',
  borderBottom: '2px solid #ef4444',
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontFamily: 'monospace',
  color: '#ef4444',
  boxSizing: 'border-box',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const gangNameStyle: React.CSSProperties = {
  fontWeight: 'bold',
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const descStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#fca5a5',
};

const typeStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#f87171',
  textTransform: 'uppercase',
};

const dismissBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #ef4444',
  color: '#ef4444',
  fontSize: '16px',
  cursor: 'pointer',
  padding: '4px 10px',
  borderRadius: '4px',
  fontFamily: 'monospace',
};

const NPCThreatBanner: React.FC = () => {
  const unacknowledgedThreats = useNPCStore(selectUnacknowledgedThreats);
  const acknowledgeThreat = useNPCStore((state) => state.acknowledgeThreat);

  // Show the most recent unacknowledged threat
  const latestThreat =
    unacknowledgedThreats.length > 0
      ? unacknowledgedThreats[unacknowledgedThreats.length - 1]
      : null;

  return (
    <AnimatePresence>
      {latestThreat && (
        <motion.div
          key={latestThreat.id}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={bannerStyle}
          role="alert"
          aria-live="assertive"
        >
          <div style={contentStyle}>
            <span style={gangNameStyle}>⚠️ {latestThreat.gangName}</span>
            <span style={typeStyle}>{latestThreat.type}</span>
            <span style={descStyle}>{latestThreat.description}</span>
          </div>
          <button
            style={dismissBtnStyle}
            onClick={() => acknowledgeThreat(latestThreat.id)}
            aria-label="Dismiss threat"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NPCThreatBanner;
