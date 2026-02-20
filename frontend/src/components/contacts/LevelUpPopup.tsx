// ============================================================
// LevelUpPopup.tsx - Animated popup when a member levels up
// ============================================================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LevelUpPopup.css';

interface StatBoost {
  stat: string;
  amount: number;
}

export interface LevelUpData {
  memberName: string;
  newLevel: number;
  statBoosts: StatBoost[];
  unlockedAbility?: string;
  heatIncrease: number;
}

interface LevelUpPopupProps {
  data: LevelUpData | null;
  onDismiss: () => void;
}

const RANK_TITLES: Record<number, string> = {
  1: 'Youngin',
  11: 'Soldier',
  21: 'Lieutenant',
  31: 'Captain',
  41: 'OG',
};

function getRankTitle(level: number): string {
  if (level >= 41) return 'OG';
  if (level >= 31) return 'Captain';
  if (level >= 21) return 'Lieutenant';
  if (level >= 11) return 'Soldier';
  return 'Youngin';
}

const STAT_EMOJIS: Record<string, string> = {
  shooting: '🎯',
  dealing: '💰',
  nerve: '💪',
  hustle: '🏃',
  stealth: '🤫',
};

const LevelUpPopup: React.FC<LevelUpPopupProps> = ({ data, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (data) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 500);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [data, onDismiss]);

  if (!data) return null;

  const rank = getRankTitle(data.newLevel);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="levelup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        >
          <motion.div
            className="levelup-card"
            initial={{ scale: 0.5, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: -30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Particle effects */}
            <div className="levelup-particles">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`particle particle-${i}`} />
              ))}
            </div>

            <div className="levelup-header">
              <div className="levelup-star">⭐</div>
              <h2 className="levelup-title">LEVEL UP!</h2>
            </div>

            <div className="levelup-member-name">{data.memberName}</div>

            <div className="levelup-level">
              <span className="level-number">LV{data.newLevel}</span>
              <span className="rank-title">{rank}</span>
            </div>

            {data.statBoosts.length > 0 && (
              <div className="levelup-stats">
                {data.statBoosts.map((boost, i) => (
                  <div key={i} className="stat-boost">
                    <span className="stat-emoji">{STAT_EMOJIS[boost.stat] || '📊'}</span>
                    <span className="stat-name">{boost.stat}</span>
                    <span className="stat-amount">+{boost.amount}</span>
                  </div>
                ))}
              </div>
            )}

            {data.unlockedAbility && (
              <div className="levelup-ability">
                <div className="ability-label">NEW ABILITY UNLOCKED</div>
                <div className="ability-name">{data.unlockedAbility}</div>
              </div>
            )}

            {data.heatIncrease > 0 && (
              <div className="levelup-heat-warning">
                ⚠️ High-profile member. Generates +{data.heatIncrease.toFixed(1)} heat/hour on the block.
              </div>
            )}

            <div className="levelup-tap-hint">Tap to dismiss</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LevelUpPopup;
