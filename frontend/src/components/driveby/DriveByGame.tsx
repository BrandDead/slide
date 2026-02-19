// ============================================================
// DriveByGame - Wrapper that connects DriveByEngine to game stores
// ============================================================

import React, { useCallback } from 'react';
import { useNavigationStore, usePlayerStore } from '../../stores/gameStore';
import DriveByEngine from './DriveByEngine';

interface GameStats {
  kills: number;
  civilianHits: number;
  accuracy: number;
  shotsHit: number;
  shotsFired: number;
  blocksCleared: number;
  moneyEarned: number;
}

const DriveByGame: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { updateMoney, updateHeat, addXP } = usePlayerStore();

  const handleComplete = useCallback((stats: GameStats) => {
    // Apply rewards to game state
    updateMoney(stats.moneyEarned);
    updateHeat(Math.min(stats.kills * 3 + stats.civilianHits * 10, 50));
    addXP(stats.kills * 20 + stats.blocksCleared * 50);
  }, [updateMoney, updateHeat, addXP]);

  const handleExit = useCallback(() => {
    goBack();
  }, [goBack]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
      <DriveByEngine onExit={handleExit} onComplete={handleComplete} />
    </div>
  );
};

export default DriveByGame;
