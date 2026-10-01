// ============================================================
// DriveByGame - Updated with Car Crew Selection Flow
// Step 1: Pick gang members for each car seat (top-down car view)
// Step 2: Choose target block
// Step 3: Launch the drive-by shooter engine
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import CarCrewSelector, { type CarCrew } from './CarCrewSelector';
import DriveByEngine from './DriveByEngine';
import { vaultDeposit } from '../../utils/moneyRouter';
import { useCombatIntentStore } from '../../stores/combatIntentStore';
import { useGhostStore } from '../../stores/ghostCrewStore';
import { availablePassengerShooters } from './driveByParticipants';

interface GameStats {
  kills: number;
  killsByShooter: Record<string, number>;
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
  const completedRef = useRef(false);
  const activeRunIdRef = useRef<number | null>(null);
  const approvedShootersRef = useRef<Set<string>>(new Set());

  const handleCrewConfirm = useCallback((selectedCrew: CarCrew) => {
    completedRef.current = false;
    activeRunIdRef.current = null;
    approvedShootersRef.current = new Set();
    setCrew({
      seats: selectedCrew.seats.map(seat => ({ ...seat, allowedRoles: [...seat.allowedRoles] })),
      targetBlock: selectedCrew.targetBlock ? { ...selectedCrew.targetBlock } : null,
    });
    setPhase('mission');
  }, []);

  const handleRunStart = useCallback((runId: number) => {
    if (!crew) return;
    approvedShootersRef.current = new Set(
      availablePassengerShooters(crew, useGangStore.getState().members).map(member => member.id),
    );
    activeRunIdRef.current = runId;
    completedRef.current = false;
  }, [crew]);

  const handleComplete = useCallback((stats: GameStats, runId: number) => {
    // RAF and hit callbacks may race at an end boundary. Never pay twice for
    // the same mounted run. Durable receipts remain a separate #201 gate.
    if (completedRef.current || !crew || runId !== activeRunIdRef.current) return;
    completedRef.current = true;
    if (stats.moneyEarned > 0) {
      vaultDeposit(stats.moneyEarned, 'combat_loot', `Drive-by take $${stats.moneyEarned}`);
    } else if (stats.moneyEarned < 0) {
      updateMoney(stats.moneyEarned);
    }
    updateHeat(Math.min(stats.kills * 3 + stats.civilianHits * 10, 50));
    addXP(stats.kills * 20 + stats.blocksCleared * 50);

    // Ghost-crew grudge (#81): if the target block belonged to a rival crew,
    // a successful hit (kills on their turf) raises that crew's grudge, which
    // biases its next world-tick decision toward retaliation.
    const targetCrewId = useCombatIntentStore.getState().targetCrewId;
    const targetBlockId = crew?.targetBlock?.placeId ?? null;
    if (targetCrewId && targetBlockId && stats.kills > 0) {
      useGhostStore.getState().recordPlayerAttack(targetCrewId, targetBlockId);
    }
    
    // Kill credit is attached to the bullet's recorded passenger, not every
    // occupied seat. The driver cannot be credited for in-car firing.
    // Eligibility was checked again at firing time. A wound while that bullet
    // is in flight cannot retroactively erase its shooter's earned credit.
    const eligibleIds = approvedShootersRef.current;
    const credited = Object.entries(stats.killsByShooter ?? {})
      .filter(([id, kills]) => eligibleIds.has(id) && Number.isSafeInteger(kills) && kills > 0);
    if (credited.reduce((sum, [, kills]) => sum + kills, 0) <= stats.kills) {
      for (const [id, kills] of credited) {
        const current = useGangStore.getState().members.find(member => member.id === id);
        if (current) updateMember(id, {
          experience: current.experience + kills * 10,
          xp: (current.xp ?? current.experience) + kills * 10,
          kills: current.kills + kills,
        });
      }
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
        onRunStart={handleRunStart}
        onComplete={handleComplete}
        targetBlock={crew?.targetBlock ?? null}
        crew={crew}
      />
    </div>
  );
};

export default DriveByGame;
