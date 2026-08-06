// ============================================================
// MostWantedApp — route wrapper for the bounty board
// Sprint 15-B
//
// The board is its own app icon rather than a Market tab because it
// is not shopping — it is a public ledger of who wants who dead, and
// players will check it far more often than they buy a vest.
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from '../../stores/gameStore';
import MostWanted from './MostWanted';
import './MostWantedApp.css';

const formatMoney = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
};

const MostWantedApp: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player } = usePlayerStore();

  return (
    <div className="mwa-container">
      <div className="mwa-header">
        <motion.button className="mwa-back" onClick={goBack} whileTap={{ scale: 0.9 }}>
          Back
        </motion.button>
        <h1>MOST WANTED</h1>
        <span className="mwa-cash">{formatMoney(player.money)}</span>
      </div>

      <div className="mwa-body">
        <MostWanted />
      </div>
    </div>
  );
};

export default MostWantedApp;
