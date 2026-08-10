// ============================================================
// DriveByGame - Updated with Car Crew Selection Flow
// Step 1: Pick gang members for each car seat (top-down car view)
// Step 2: Choose target block
// Step 3: Launch the drive-by shooter engine
// ============================================================

import React, { useState, useCallback } from 'react';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import CarCrewSelector, { type CarCrew } from './CarCrewSelector';
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

type Phase = 'crew_select' | 'mission';

const DriveByGame: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { updateMoney, updateHeat, addXP } = usePlayerStore();
  const { updateMember } = useGangStore();
  
  const [phase, setPhase] = useState<Phase>('crew_select');
  const [crew, setCrew] = useState<CarCrew | null>(null);

  const handleCrewConfirm = useCallback((selectedCrew: CarCrew) => {
    setCrew(selectedCrew);
    setPhase('mission');
  }, []);

  const handleComplete = useCallback((stats: GameStats) => {
    // Apply rewards to game state
    updateMoney(stats.moneyEarned);
    updateHeat(Math.min(stats.kills * 3 + stats.civilianHits * 10, 50));
    addXP(stats.kills * 20 + stats.blocksCleared * 50);
    
    // Update crew member XP/stats based on performance
    if (crew) {
      crew.seats.forEach(seat => {
        if (seat.memberId && seat.position !== 'driver') {
          // Shooters gain XP from kills
          updateMember(seat.memberId, {
            xp: stats.kills * 10,
          });
        }
      });
    }
  }, [updateMoney, updateHeat, addXP, crew, updateMember]);

  const handleExit = useCallback(() => {
    if (phase === 'mission') {
      setPhase('crew_select');
      setCrew(null);
    } else {
      goBack();
    }
  }, [phase, goBack]);

  if (phase === 'crew_select') {
    return (
      <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
        <CarCrewSelector onConfirm={handleCrewConfirm} onCancel={goBack} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
      <DriveByEngine
        onExit={handleExit}
        onComplete={handleComplete}
        targetBlockAddress={crew?.targetBlock ?? null}
      />
    </div>
  );
};

export default DriveByGame;
