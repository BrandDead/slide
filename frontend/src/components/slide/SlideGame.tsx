// ============================================================
// SlideGame.tsx — SLIDE Drive-By Battleship (Rebuilt)
//
// ATTACKER: Picks street stop positions, then shoots at the block.
// DEFENDER: Picks street squares to shoot back at the car.
// SHOT SPOTTER: Fires after each spin, reveals area.
// SPIN THE BLOCK: Attacker can go again, each spin costs ammo + heat.
// REINFORCEMENTS: Defender can call backup between spins.
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useGangStore, useNotificationStore } from '../../stores/gameStore';
import { addXp, xpForLevel, XP_CONFIG, type MemberLevel } from '../../utils/memberProgression';
import { soundManager } from '../../utils/SoundManager';
import {
  BLOCK_COLS,
  BLOCK_ROWS,
  STREET_ROW,
  BLOCK_ZONES,
  createSlideGrid,
  processAttackerShot,
  processDefenderShot,
  generateShotSpotterReport,
  calcSpinHeat,
  checkGameOver,
  getAttackerShotsAvailable,
  getDefenderShotsAvailable,
  type SlideMember,
  type SlideVehicle,
  type SlideGameState,
  type SlidePhase,
  type SpinResult,
  type ShotSpotterReport,
} from '../../utils/slideGameEngine';
import './SlideGame.css';

// ─── SEED DATA HELPERS ───────────────────────────────────────

function makeDefender(id: string, name: string, role: SlideMember['role'], row: number, col: number): SlideMember {
  const stats: Record<SlideMember['role'], { hp: number; ammo: number; damage: number; accuracy: number; weapon: string }> = {
    shooter:  { hp: 80,  ammo: 15, damage: 25, accuracy: 65, weapon: 'Glock 19' },
    dealer:   { hp: 60,  ammo: 0,  damage: 0,  accuracy: 0,  weapon: 'None' },
    enforcer: { hp: 100, ammo: 0,  damage: 0,  accuracy: 0,  weapon: 'Bat' },
    recruit:  { hp: 50,  ammo: 0,  damage: 0,  accuracy: 0,  weapon: 'Knife' },
    driver:   { hp: 70,  ammo: 0,  damage: 0,  accuracy: 0,  weapon: 'None' },
  };
  const s = stats[role];
  return {
    id, name, role,
    hp: s.hp, maxHp: s.hp,
    row, col,
    ammo: s.ammo, maxAmmo: s.ammo,
    weaponName: s.weapon,
    weaponDamage: s.damage,
    accuracy: s.accuracy,
    isAlive: true,
    isRevealed: false,
    armorLevel: 0,
  };
}

function makeAttacker(id: string, name: string, role: SlideMember['role']): SlideMember {
  return makeDefender(id, name, role, STREET_ROW, 0);
}

function createDefaultVehicle(members: SlideMember[]): SlideVehicle {
  return {
    id: 'slide-car',
    type: '4door',
    hp: 100, maxHp: 100,
    tiresBlown: false,
    engineDamaged: false,
    members,
    stopPositions: [],
  };
}

function createNPCDefenders(): SlideMember[] {
  return [
    makeDefender('d1', 'Lil Smoke',  'shooter',  1, 2),
    makeDefender('d2', 'Big T',      'shooter',  2, 5),
    makeDefender('d3', 'Ghost',      'dealer',   3, 1),
    makeDefender('d4', 'Razor',      'dealer',   3, 6),
    makeDefender('d5', 'Slim',       'enforcer', 4, 3),
    makeDefender('d6', 'Ace',        'enforcer', 5, 4),
  ];
}

// ─── ROLE ICONS & COLORS ─────────────────────────────────────

const ROLE_ICON: Record<string, string> = {
  shooter:  '🔫',
  dealer:   '💊',
  enforcer: '💪',
  recruit:  '👟',
  driver:   '🚗',
};

const ROLE_COLOR: Record<string, string> = {
  shooter:  '#ef4444',
  dealer:   '#4ade80',
  enforcer: '#f97316',
  recruit:  '#facc15',
  driver:   '#60a5fa',
};

const ZONE_COLORS: Record<number, string> = {
  0: '#1a1a2e',  // street
  1: '#16213e',  // curb
  2: '#0f3460',  // sidewalk
  3: '#1b4332',  // storefront
  4: '#212529',  // alley
  5: '#1c1c1c',  // alley back
  6: '#2d2d2d',  // parking
  7: '#4a1942',  // rooftop
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

const SlideGame: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat, addXP } = usePlayerStore();
  const { members } = useGangStore();

  const [role, setRole] = useState<'attacker' | 'defender' | null>(null);
  const [gameState, setGameState] = useState<SlideGameState | null>(null);
  const [selectedStops, setSelectedStops] = useState<number[]>([]);
  const [selectedShots, setSelectedShots] = useState<Array<{ row: number; col: number }>>([]);
  const [defenderSelectedCols, setDefenderSelectedCols] = useState<number[]>([]);
  const [shotSpotterMsg, setShotSpotterMsg] = useState<ShotSpotterReport | null>(null);
  const [animatingKill, setAnimatingKill] = useState<string | null>(null);
  const killFeedRef = useRef<HTMLDivElement>(null);

  // ── INIT GAME ──
  const startGame = useCallback((chosenRole: 'attacker' | 'defender') => {
    setRole(chosenRole);

    const defenders = createNPCDefenders();
    const attackerMembers = [
      makeAttacker('a1', 'You',     'shooter'),
      makeAttacker('a2', 'Trigger', 'shooter'),
      makeAttacker('a3', 'Ghost',   'driver'),
    ];
    const vehicle = createDefaultVehicle(attackerMembers);
    const grid = createSlideGrid(defenders);

    setGameState({
      phase: chosenRole === 'attacker' ? 'pick_stop' : 'setup_attacker',
      spinNumber: 1,
      maxSpins: 5,
      vehicle,
      defenders,
      grid,
      spinHistory: [],
      killFeed: [{ message: chosenRole === 'attacker' ? '🚗 Pick where to stop on the street' : '🏠 Defend the block', timestamp: Date.now(), type: 'system' }],
      pendingReinforcements: 0,
      attackerRetreat: false,
      vehicleDestroyed: false,
      allDefendersDown: false,
      totalHeatGenerated: 0,
    });
  }, []);

  // ── SCROLL KILL FEED ──
  useEffect(() => {
    if (killFeedRef.current) {
      killFeedRef.current.scrollTop = killFeedRef.current.scrollHeight;
    }
  }, [gameState?.killFeed]);

  // ── ATTACKER: PICK STOP POSITIONS ──
  const toggleStopPosition = (col: number) => {
    if (!gameState || gameState.phase !== 'pick_stop') return;
    const maxStops = gameState.vehicle.members.filter((m) => m.role === 'shooter').length;
    setSelectedStops((prev) => {
      if (prev.includes(col)) return prev.filter((c) => c !== col);
      if (prev.length >= maxStops) return prev;
      return [...prev, col];
    });
  };

  const confirmStopPositions = () => {
    if (!gameState || selectedStops.length === 0) return;
    setGameState((prev) => {
      if (!prev) return null;
      const newVehicle = { ...prev.vehicle, stopPositions: selectedStops };
      return {
        ...prev,
        phase: 'attacker_shooting',
        vehicle: newVehicle,
        killFeed: [...prev.killFeed, { message: `🚗 Car stopped at col(s) ${selectedStops.join(', ')}. Pick targets!`, timestamp: Date.now(), type: 'system' }],
      };
    });
  };

  // ── ATTACKER: PICK BLOCK SQUARES TO SHOOT ──
  const toggleAttackerShot = (row: number, col: number) => {
    if (!gameState || gameState.phase !== 'attacker_shooting') return;
    if (row === STREET_ROW) return;  // can't shoot the street itself
    const maxShots = getAttackerShotsAvailable(gameState.vehicle);
    setSelectedShots((prev) => {
      const exists = prev.some((s) => s.row === row && s.col === col);
      if (exists) return prev.filter((s) => !(s.row === row && s.col === col));
      if (prev.length >= maxShots) return prev;
      return [...prev, { row, col }];
    });
  };

  const fireAttackerShots = () => {
    if (!gameState || selectedShots.length === 0) return;

    const newDefenders = [...gameState.defenders.map((d) => ({ ...d }))];
    const newGrid = gameState.grid.map((row) => row.map((cell) => ({ ...cell })));
    const spinShots: SpinResult['attackerShots'] = [];
    const newKillFeed = [...gameState.killFeed];
    const killedIds: string[] = [];

    const shooters = gameState.vehicle.members.filter((m) => m.isAlive && m.role === 'shooter');

    for (let i = 0; i < selectedShots.length; i++) {
      const { row, col } = selectedShots[i];
      const shooter = shooters[i % shooters.length];
      if (!shooter) continue;

      const result = processAttackerShot(shooter, row, col, gameState.vehicle.stopPositions[0] ?? 0, newDefenders, newGrid);

      newGrid[row][col].wasShot = true;
      spinShots.push({ col, row, hit: result.hit, memberId: result.memberId, damage: result.damage });
      newKillFeed.push({ message: result.message, timestamp: Date.now(), type: result.hit ? (result.killed ? 'kill' : 'hit') : 'miss' });

      if (result.memberId && result.damage) {
        const defIdx = newDefenders.findIndex((d) => d.id === result.memberId);
        if (defIdx >= 0) {
          newDefenders[defIdx].hp = Math.max(0, newDefenders[defIdx].hp - result.damage);
          newDefenders[defIdx].isRevealed = true;
          newGrid[newDefenders[defIdx].row][newDefenders[defIdx].col].wasHit = true;
          if (newDefenders[defIdx].hp <= 0) {
            newDefenders[defIdx].isAlive = false;
            killedIds.push(result.memberId);
            setAnimatingKill(result.memberId);
            setTimeout(() => setAnimatingKill(null), 1000);
          }
        }
      }

      // Consume ammo
      const shooterIdx = gameState.vehicle.members.findIndex((m) => m.id === shooter.id);
      if (shooterIdx >= 0) {
        gameState.vehicle.members[shooterIdx].ammo = Math.max(0, shooter.ammo - 1);
      }
    }

    // Partial spin result (defender shots come next)
    const partialSpin: Omit<SpinResult, 'shotSpotter'> = {
      spinNumber: gameState.spinNumber,
      attackerShots: spinShots,
      defenderShots: [],
      membersKilled: killedIds,
      carDamageThisSpin: 0,
      heatGenerated: 0,
    };

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        defenders: newDefenders,
        grid: newGrid,
        killFeed: newKillFeed,
        phase: 'defender_shooting',
      };
    });

    setSelectedShots([]);
    // Store partial spin for later completion
    sessionStorage.setItem('partialSpin', JSON.stringify(partialSpin));
  };

  // ── DEFENDER: PICK STREET SQUARES TO SHOOT AT ──
  const toggleDefenderShot = (col: number) => {
    if (!gameState || gameState.phase !== 'defender_shooting') return;
    const maxShots = getDefenderShotsAvailable(gameState.defenders);
    setDefenderSelectedCols((prev) => {
      if (prev.includes(col)) return prev.filter((c) => c !== col);
      if (prev.length >= maxShots) return prev;
      return [...prev, col];
    });
  };

  const fireDefenderShots = () => {
    if (!gameState) return;

    const newVehicle = { ...gameState.vehicle, members: gameState.vehicle.members.map((m) => ({ ...m })) };
    const newKillFeed = [...gameState.killFeed];
    const defenderShotResults: SpinResult['defenderShots'] = [];
    let carDamageThisSpin = 0;

    const defenderShooters = gameState.defenders.filter((d) => d.isAlive && d.role === 'shooter');
    const gangStore = useGangStore.getState();
    const notifStore = useNotificationStore.getState();

    for (let i = 0; i < defenderSelectedCols.length; i++) {
      const col = defenderSelectedCols[i];
      const shooter = defenderShooters[i % Math.max(1, defenderShooters.length)];
      if (!shooter) {
        defenderShotResults.push({ col, hit: false });
        newKillFeed.push({ message: 'No shooters available to return fire.', timestamp: Date.now(), type: 'miss' });
        continue;
      }

      const result = processDefenderShot(shooter, col, newVehicle);
      defenderShotResults.push({ col, hit: result.hit, carDamage: result.carDamage, memberKilled: result.memberKilled });
      newKillFeed.push({ message: result.message, timestamp: Date.now(), type: result.hit ? 'hit' : 'miss' });

      if (result.hit && result.carDamage) {
        newVehicle.hp = Math.max(0, newVehicle.hp - result.carDamage);
        carDamageThisSpin += result.carDamage;
      }

      if (result.memberKilled) {
        const mIdx = newVehicle.members.findIndex((m) => m.id === result.memberKilled);
        if (mIdx >= 0) {
          const victimName = newVehicle.members[mIdx].name;
          newVehicle.members[mIdx].isAlive = false;
          newKillFeed.push({ message: `💀 ${victimName} in the car was hit!`, timestamp: Date.now(), type: 'kill' });
        }
        // Award XP to the shooter who got the kill
        const gangMember = gangStore.members.find(
          (m) => m.name === shooter.name || m.id === shooter.id
        );
        if (gangMember) {
          const currentLevel: MemberLevel = {
            level: gangMember.level ?? 1,
            xp: gangMember.experience ?? 0,
            xpToNext: xpForLevel(gangMember.level ?? 1),
            totalXp: gangMember.experience ?? 0,
          };
          const { level: newLevel, levelUps } = addXp(currentLevel, XP_CONFIG.XP_PER_KILL, 'shooter');
          gangStore.updateMember(gangMember.id, {
            level: newLevel.level,
            experience: newLevel.totalXp,
            kills: (gangMember.kills ?? 0) + 1,
          });
          for (const lu of levelUps) {
            notifStore.addNotification({
              type: 'info',
              title: `⬆️ ${gangMember.name} leveled up!`,
              message: `${gangMember.name} reached Level ${lu.newLevel}.${
                lu.unlockedAbility ? ` Unlocked: ${lu.unlockedAbility}` : ''
              }`,
              priority: 'normal',
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // Complete the spin result
    const partialSpin: Omit<SpinResult, 'shotSpotter'> = JSON.parse(sessionStorage.getItem('partialSpin') || '{}');
    const completeSpin: Omit<SpinResult, 'shotSpotter'> = {
      ...partialSpin,
      defenderShots: defenderShotResults,
      carDamageThisSpin,
      membersKilled: partialSpin.membersKilled || [],
      heatGenerated: calcSpinHeat(gameState.spinNumber, (partialSpin.membersKilled || []).length, carDamageThisSpin > 0),
    };

    const spotter = generateShotSpotterReport(completeSpin, newVehicle);
    const fullSpin: SpinResult = { ...completeSpin, shotSpotter: spotter };

    setShotSpotterMsg(spotter);
    newKillFeed.push({ message: spotter.message, timestamp: Date.now(), type: 'spotter' });

    const vehicleDestroyed = newVehicle.hp <= 0 || !newVehicle.members.find((m) => m.role === 'driver' && m.isAlive);
    const allDefendersDown = gameState.defenders.every((d) => !d.isAlive);

    updateHeat(completeSpin.heatGenerated);

    setGameState((prev) => {
      if (!prev) return null;
      const newState: SlideGameState = {
        ...prev,
        vehicle: newVehicle,
        killFeed: newKillFeed,
        spinHistory: [...prev.spinHistory, fullSpin],
        totalHeatGenerated: prev.totalHeatGenerated + completeSpin.heatGenerated,
        vehicleDestroyed,
        allDefendersDown,
        phase: vehicleDestroyed || allDefendersDown ? 'resolved' : 'spin_decision',
      };
      return newState;
    });

    setDefenderSelectedCols([]);
    sessionStorage.removeItem('partialSpin');
  };

  // ── SPIN AGAIN ──
  const spinAgain = () => {
    if (!gameState) return;
    setSelectedStops([]);
    setSelectedShots([]);
    setShotSpotterMsg(null);

    // Apply pending reinforcements
    let newDefenders = [...gameState.defenders];
    if (gameState.pendingReinforcements > 0) {
      for (let i = 0; i < gameState.pendingReinforcements; i++) {
        const newShooter = makeDefender(
          `reinf-${Date.now()}-${i}`,
          `Backup ${i + 1}`,
          'shooter',
          1 + Math.floor(Math.random() * 4),
          Math.floor(Math.random() * BLOCK_COLS),
        );
        newDefenders.push(newShooter);
      }
    }

    const newGrid = createSlideGrid(newDefenders);

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        phase: 'pick_stop',
        spinNumber: prev.spinNumber + 1,
        defenders: newDefenders,
        grid: newGrid,
        pendingReinforcements: 0,
        killFeed: [...prev.killFeed, { message: `🔄 SPIN ${prev.spinNumber + 1} — Back around the block`, timestamp: Date.now(), type: 'system' }],
      };
    });
  };

  // ── CALL REINFORCEMENTS ──
  const callReinforcements = () => {
    if (!gameState || gameState.phase !== 'spin_decision') return;
    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        pendingReinforcements: prev.pendingReinforcements + 1,
        killFeed: [...prev.killFeed, { message: '📞 Backup called! 1 Shooter arriving next spin.', timestamp: Date.now(), type: 'system' }],
      };
    });
  };

  // ── RETREAT ──
  const retreat = () => {
    if (!gameState) return;
    setGameState((prev) => {
      if (!prev) return null;
      return { ...prev, attackerRetreat: true, phase: 'resolved' };
    });
  };

  // ── COLLECT REWARDS ──
  const collectRewards = () => {
    if (!gameState) return;
    const attackerWon = gameState.allDefendersDown;
    const reward = attackerWon ? 800 + gameState.spinNumber * 100 : 200;
    updateMoney(reward);
    addXP(attackerWon ? 200 : 50);
    goBack();
  };

  // ─── RENDER ──────────────────────────────────────────────────

  if (!role || !gameState) {
    return (
      <div className="slide-game">
        <div className="slide-header">
          <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
          <div className="slide-title"><span className="title-icon">🚗</span><span className="title-text">SLIDE</span></div>
          <div />
        </div>
        <div className="role-selection">
          <h2 className="role-title">CHOOSE YOUR ROLE</h2>
          <p className="role-subtitle">Drive-by Battleship</p>
          <motion.div className="role-card attacker-card" onClick={() => startGame('attacker')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <span className="role-emoji">🚗</span>
            <h3>SLIDE ON THEM</h3>
            <p>Stop on the street and pick squares to shoot. Spin the block for more damage. Watch the shot spotter.</p>
            <div className="role-stats"><span>Shots = your shooters</span><span>Max 5 spins</span><span>+Heat each spin</span></div>
          </motion.div>
          <motion.div className="role-card defender-card" onClick={() => startGame('defender')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <span className="role-emoji">🏠</span>
            <h3>HOLD THE BLOCK</h3>
            <p>Your shooters return fire at the street. Guess where the car stopped. Call backup between spins.</p>
            <div className="role-stats"><span>Shots = your shooters</span><span>Call reinforcements</span><span>Destroy the car</span></div>
          </motion.div>
        </div>
      </div>
    );
  }

  const gameOver = checkGameOver(gameState);
  const aliveDefenders = gameState.defenders.filter((d) => d.isAlive);
  const aliveShootersOnBlock = aliveDefenders.filter((d) => d.role === 'shooter').length;
  const attackerShootersAlive = gameState.vehicle.members.filter((m) => m.isAlive && m.role === 'shooter').length;
  const totalAmmoLeft = gameState.vehicle.members.reduce((sum, m) => sum + m.ammo, 0);

  return (
    <div className="slide-game">
      {/* Header */}
      <div className="slide-header">
        <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
        <div className="slide-title">
          <span className="title-icon">🚗</span>
          <span className="title-text">SLIDE — Spin {gameState.spinNumber}/{gameState.maxSpins}</span>
        </div>
        <div className="slide-stats">
          <span className="stat-chip">🔫 {attackerShootersAlive} shooters</span>
          <span className="stat-chip">💊 {totalAmmoLeft} ammo</span>
          <span className="stat-chip">🏠 {aliveShootersOnBlock} defenders</span>
        </div>
      </div>

      {/* Phase Banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={gameState.phase}
          className={`phase-banner phase-${gameState.phase}`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {gameState.phase === 'pick_stop' && '🚗 Pick where to STOP on the street (row 0)'}
          {gameState.phase === 'attacker_shooting' && `🔫 Pick squares to SHOOT (${getAttackerShotsAvailable(gameState.vehicle) - selectedShots.length} shots left)`}
          {gameState.phase === 'defender_shooting' && `🏠 Pick STREET squares to return fire (${getDefenderShotsAvailable(gameState.defenders) - defenderSelectedCols.length} shots left)`}
          {gameState.phase === 'spin_decision' && '🔄 Spin again or retreat?'}
          {gameState.phase === 'resolved' && (gameOver.winner === 'attacker' ? '🏆 Block taken!' : '🛡️ Block held!')}
        </motion.div>
      </AnimatePresence>

      {/* Shot Spotter Alert */}
      <AnimatePresence>
        {shotSpotterMsg && shotSpotterMsg.triggered && (
          <motion.div
            className={`shot-spotter-alert severity-${shotSpotterMsg.severity}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="spotter-icon">📡</span>
            <span className="spotter-text">{shotSpotterMsg.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div className="slide-grid-container">
        <div className="slide-grid" style={{ gridTemplateColumns: `repeat(${BLOCK_COLS}, 1fr)` }}>
          {Array.from({ length: BLOCK_ROWS }, (_, row) =>
            Array.from({ length: BLOCK_COLS }, (_, col) => {
              const cell = gameState.grid[row]?.[col];
              const zone = BLOCK_ZONES[row];
              const isStreet = row === STREET_ROW;
              const defender = gameState.defenders.find((d) => d.row === row && d.col === col);
              const isSelectedStop = selectedStops.includes(col) && isStreet;
              const isSelectedShot = selectedShots.some((s) => s.row === row && s.col === col);
              const isDefenderSelected = defenderSelectedCols.includes(col) && isStreet;
              const isCarStop = gameState.vehicle.stopPositions.includes(col) && isStreet;
              const isSpotterRevealed = shotSpotterMsg?.revealedCols.includes(col) && isStreet;

              return (
                <motion.div
                  key={`${row}-${col}`}
                  className={[
                    'slide-cell',
                    `zone-row-${row}`,
                    isStreet ? 'street-row' : '',
                    isSelectedStop ? 'selected-stop' : '',
                    isSelectedShot ? 'selected-shot' : '',
                    isDefenderSelected ? 'defender-selected' : '',
                    isCarStop && gameState.phase !== 'pick_stop' ? 'car-stop-revealed' : '',
                    isSpotterRevealed ? 'spotter-revealed' : '',
                    cell?.wasShot ? 'was-shot' : '',
                    cell?.wasHit ? 'was-hit' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ backgroundColor: ZONE_COLORS[row] }}
                  onClick={() => {
                    if (isStreet && gameState.phase === 'pick_stop') toggleStopPosition(col);
                    else if (!isStreet && gameState.phase === 'attacker_shooting') toggleAttackerShot(row, col);
                    else if (isStreet && gameState.phase === 'defender_shooting') toggleDefenderShot(col);
                  }}
                  whileTap={{ scale: 0.92 }}
                >
                  {/* Row label on first column */}
                  {col === 0 && <span className="zone-label">{zone.shortLabel}</span>}

                  {/* Car stop indicator */}
                  {isStreet && isCarStop && gameState.phase !== 'pick_stop' && (
                    <span className="car-icon">🚗</span>
                  )}

                  {/* Defender unit */}
                  {defender && (
                    <motion.div
                      className={`defender-token role-${defender.role} ${!defender.isAlive ? 'dead' : ''} ${animatingKill === defender.id ? 'kill-anim' : ''}`}
                      animate={animatingKill === defender.id ? { scale: [1, 1.5, 0], rotate: [0, 15, -15, 0] } : {}}
                    >
                      <span className="token-icon">{ROLE_ICON[defender.role]}</span>
                      {defender.isRevealed && (
                        <div className="token-hp-bar">
                          <div className="token-hp-fill" style={{ width: `${(defender.hp / defender.maxHp) * 100}%`, backgroundColor: ROLE_COLOR[defender.role] }} />
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Shot markers */}
                  {cell?.wasShot && !cell.wasHit && <span className="miss-marker">·</span>}
                  {cell?.wasHit && <span className="hit-marker">✕</span>}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="slide-actions">
        {gameState.phase === 'pick_stop' && (
          <motion.button
            className="action-btn primary"
            onClick={confirmStopPositions}
            disabled={selectedStops.length === 0}
            whileTap={{ scale: 0.95 }}
          >
            🚗 STOP HERE ({selectedStops.length} spot{selectedStops.length !== 1 ? 's' : ''}) — SHOOT
          </motion.button>
        )}

        {gameState.phase === 'attacker_shooting' && (
          <motion.button
            className="action-btn fire-btn"
            onClick={fireAttackerShots}
            disabled={selectedShots.length === 0}
            whileTap={{ scale: 0.95 }}
          >
            🔥 FIRE ({selectedShots.length} shot{selectedShots.length !== 1 ? 's' : ''})
          </motion.button>
        )}

        {gameState.phase === 'defender_shooting' && (
          <motion.button
            className="action-btn fire-btn"
            onClick={fireDefenderShots}
            whileTap={{ scale: 0.95 }}
          >
            🔫 RETURN FIRE ({defenderSelectedCols.length} shot{defenderSelectedCols.length !== 1 ? 's' : ''})
          </motion.button>
        )}

        {gameState.phase === 'spin_decision' && (
          <div className="spin-decision-row">
            <motion.button
              className="action-btn primary"
              onClick={spinAgain}
              disabled={gameState.spinNumber >= gameState.maxSpins || totalAmmoLeft === 0}
              whileTap={{ scale: 0.95 }}
            >
              🔄 SPIN AGAIN ({gameState.maxSpins - gameState.spinNumber} left)
            </motion.button>
            <motion.button
              className="action-btn secondary"
              onClick={callReinforcements}
              whileTap={{ scale: 0.95 }}
            >
              📞 CALL BACKUP (+1 Shooter next spin)
            </motion.button>
            <motion.button
              className="action-btn danger"
              onClick={retreat}
              whileTap={{ scale: 0.95 }}
            >
              🏃 RETREAT
            </motion.button>
          </div>
        )}

        {gameState.phase === 'resolved' && (
          <motion.button
            className="action-btn primary"
            onClick={collectRewards}
            whileTap={{ scale: 0.95 }}
          >
            {gameOver.winner === 'attacker' ? '🏆 Collect Loot' : '🛡️ Collect Reward'}
          </motion.button>
        )}
      </div>

      {/* Kill Feed */}
      <div className="kill-feed" ref={killFeedRef}>
        {gameState.killFeed.slice(-8).map((entry, i) => (
          <motion.div
            key={`${entry.timestamp}-${i}`}
            className={`kill-entry type-${entry.type}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {entry.message}
          </motion.div>
        ))}
      </div>

      {/* Vehicle HP Bar */}
      <div className="vehicle-status">
        <span className="vehicle-label">🚗 Car HP</span>
        <div className="vehicle-hp-bar">
          <motion.div
            className="vehicle-hp-fill"
            animate={{ width: `${(gameState.vehicle.hp / gameState.vehicle.maxHp) * 100}%` }}
            style={{ backgroundColor: gameState.vehicle.hp < 30 ? '#ef4444' : '#4ade80' }}
          />
        </div>
        <span className="vehicle-hp-text">{gameState.vehicle.hp}/{gameState.vehicle.maxHp}</span>
      </div>
    </div>
  );
};

export default SlideGame;
