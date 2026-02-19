// ============================================================
// SLIDE Combat - Battleship-Style Grid Combat
// Attacker (car) shoots at the block grid (macro 8x8)
// Defender shoots at the car grid (micro 16x16)
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import {
  MACRO_SIZE,
  MICRO_SIZE,
  type MacroCoord,
  type MicroCoord,
  type MacroCell,
  type MicroCell,
  type Vehicle,
  vehicleFootprint,
  stampVehicle,
  VEHICLE_TEMPLATE_2x4,
} from '../../utils/dualGrid';
import { patternTargets, type MacroPattern } from '../../utils/attackPatterns';
import { STREET_PROXIMITY_TABLE } from '../../types/slide.types';
import './SlideGame.css';

// ============ TYPES ============

type GamePhase = 'setup' | 'attacker_turn' | 'defender_turn' | 'resolution' | 'finished';
type PlayerRole = 'attacker' | 'defender';

interface PlacedUnit {
  id: string;
  name: string;
  type: 'dealer' | 'shooter' | 'enforcer' | 'pitbull';
  hp: number;
  maxHp: number;
  position: MacroCoord;
  isAlive: boolean;
}

interface GameState {
  phase: GamePhase;
  role: PlayerRole;
  turn: number;
  maxTurns: number;
  macroGrid: MacroCell[][];
  microGrid: MicroCell[][];
  vehicle: Vehicle;
  placedUnits: PlacedUnit[];
  attackerShots: MacroCoord[];
  defenderShots: MicroCoord[];
  attackerScore: number;
  defenderScore: number;
  combatLog: string[];
  shotsThisTurn: number;
  maxShotsPerTurn: number;
}

// ============ HELPERS ============

function createMacroGrid(): MacroCell[][] {
  return Array.from({ length: MACRO_SIZE }, (_, y) =>
    Array.from({ length: MACRO_SIZE }, (_, x) => ({
      coord: { x, y },
      revealed: false,
      hit: false,
    }))
  );
}

function createMicroGrid(): MicroCell[][] {
  return Array.from({ length: MICRO_SIZE }, (_, j) =>
    Array.from({ length: MICRO_SIZE }, (_, i) => ({
      coord: { i, j },
      revealed: false,
      hit: false,
    }))
  );
}

function createDefaultVehicle(): Vehicle {
  return {
    id: 'slide-vehicle',
    origin: { i: 7, j: 6 },
    facing: 'N',
    seats: {
      driver: { alive: true },
      passenger: { alive: true },
      rearLeft: { alive: true },
      rearRight: { alive: true },
    },
    hpByPart: {
      hood: 3,
      driver_seat: 2,
      passenger_seat: 2,
      rear_left: 2,
      rear_right: 2,
      trunk: 3,
    },
  };
}

function getRowType(y: number): string {
  if (y === 0 || y === 7) return 'street';
  if (y === 1 || y === 6) return 'sidewalk';
  if (y === 2 || y === 5) return 'alley';
  return 'building';
}

function getRowLabel(y: number): string {
  if (y === 0) return 'STREET';
  if (y === 1) return 'WALK';
  if (y === 2) return 'ALLEY';
  if (y === 3 || y === 4) return 'BLDG';
  if (y === 5) return 'ALLEY';
  if (y === 6) return 'WALK';
  return 'STREET';
}

const UNIT_EMOJIS: Record<string, string> = {
  dealer: '💊',
  shooter: '🔫',
  enforcer: '💪',
  pitbull: '🐕',
};

const UNIT_TEMPLATES = [
  { type: 'dealer' as const, name: 'Dealer', hp: 2, maxHp: 2 },
  { type: 'shooter' as const, name: 'Shooter', hp: 3, maxHp: 3 },
  { type: 'enforcer' as const, name: 'Enforcer', hp: 4, maxHp: 4 },
  { type: 'pitbull' as const, name: 'Pit Bull', hp: 2, maxHp: 2 },
];

// ============ COMPONENT ============

const SlideGame: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat, addXP } = usePlayerStore();
  const { members } = useGangStore();

  // Role selection
  const [selectedRole, setSelectedRole] = useState<PlayerRole | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<number>(0);

  // Game state
  const [game, setGame] = useState<GameState | null>(null);

  // Initialize game
  const startGame = useCallback((role: PlayerRole) => {
    const macroGrid = createMacroGrid();
    const microGrid = createMicroGrid();
    const vehicle = createDefaultVehicle();

    // Stamp vehicle onto micro grid
    stampVehicle(vehicle, microGrid);

    // If attacker, place NPC defenders
    let placedUnits: PlacedUnit[] = [];
    if (role === 'attacker') {
      // NPC places units randomly
      const positions: MacroCoord[] = [];
      for (let i = 0; i < 6; i++) {
        let pos: MacroCoord;
        do {
          pos = { x: Math.floor(Math.random() * MACRO_SIZE), y: 1 + Math.floor(Math.random() * 6) };
        } while (positions.some(p => p.x === pos.x && p.y === pos.y));
        positions.push(pos);
      }

      placedUnits = positions.map((pos, i) => {
        const template = UNIT_TEMPLATES[i % UNIT_TEMPLATES.length];
        return {
          id: `npc-${i}`,
          name: `${template.name} ${i + 1}`,
          type: template.type,
          hp: template.hp,
          maxHp: template.maxHp,
          position: pos,
          isAlive: true,
        };
      });

      // Place units on macro grid (hidden from attacker)
      placedUnits.forEach(unit => {
        macroGrid[unit.position.y][unit.position.x].occupantId = unit.id;
        macroGrid[unit.position.y][unit.position.x].occupantHp = unit.hp;
      });
    }

    setGame({
      phase: role === 'defender' ? 'setup' : 'attacker_turn',
      role,
      turn: 1,
      maxTurns: 5,
      macroGrid,
      microGrid,
      vehicle,
      placedUnits,
      attackerShots: [],
      defenderShots: [],
      attackerScore: 0,
      defenderScore: 0,
      combatLog: [role === 'defender' ? '📍 Place your units on the block' : '🚗 Pick targets on the block!'],
      shotsThisTurn: 0,
      maxShotsPerTurn: 3,
    });
  }, []);

  // Setup phase: place a unit on the macro grid (defender only)
  const placeUnit = useCallback((coord: MacroCoord) => {
    if (!game || game.phase !== 'setup') return;
    if (game.placedUnits.length >= 6) return;

    // Can't place on street rows
    if (coord.y === 0 || coord.y === 7) return;

    // Can't place on occupied cell
    if (game.macroGrid[coord.y][coord.x].occupantId) return;

    const template = UNIT_TEMPLATES[selectedUnitType];
    const newUnit: PlacedUnit = {
      id: `unit-${game.placedUnits.length}`,
      name: `${template.name} ${game.placedUnits.length + 1}`,
      type: template.type,
      hp: template.hp,
      maxHp: template.maxHp,
      position: coord,
      isAlive: true,
    };

    const newGrid = game.macroGrid.map(row => row.map(cell => ({ ...cell })));
    newGrid[coord.y][coord.x].occupantId = newUnit.id;
    newGrid[coord.y][coord.x].occupantHp = newUnit.hp;

    setGame(prev => prev ? {
      ...prev,
      macroGrid: newGrid,
      placedUnits: [...prev.placedUnits, newUnit],
      combatLog: [...prev.combatLog, `${UNIT_EMOJIS[template.type]} ${newUnit.name} placed at (${coord.x}, ${coord.y})`],
    } : null);
  }, [game, selectedUnitType]);

  // Start combat after setup
  const startCombat = useCallback(() => {
    if (!game || game.placedUnits.length < 3) return;
    setGame(prev => prev ? {
      ...prev,
      phase: 'defender_turn',
      combatLog: [...prev.combatLog, '⚔️ Combat begins! Defend your block!'],
    } : null);
  }, [game]);

  // Attacker shoots at macro grid
  const attackerShoot = useCallback((coord: MacroCoord) => {
    if (!game || game.phase !== 'attacker_turn') return;
    if (game.shotsThisTurn >= game.maxShotsPerTurn) return;
    if (game.macroGrid[coord.y][coord.x].revealed) return;

    const newGrid = game.macroGrid.map(row => row.map(cell => ({ ...cell })));
    const cell = newGrid[coord.y][coord.x];
    cell.revealed = true;
    cell.hit = true;

    let log = `💥 Shot at (${coord.x}, ${coord.y}) — `;
    let scoreAdd = 0;

    if (cell.occupantId) {
      const unit = game.placedUnits.find(u => u.id === cell.occupantId);
      cell.occupantHp = Math.max(0, (cell.occupantHp ?? 1) - 1);

      if (cell.occupantHp === 0) {
        cell.occupantId = undefined;
        log += `💀 ${unit?.name || 'Unit'} KILLED!`;
        scoreAdd = 100;
      } else {
        log += `🎯 HIT ${unit?.name || 'Unit'}! (${cell.occupantHp} HP left)`;
        scoreAdd = 25;
      }
    } else {
      log += 'MISS! Water...';
    }

    const newUnits = game.placedUnits.map(u => {
      if (u.id === newGrid[coord.y][coord.x].occupantId || 
          (game.macroGrid[coord.y][coord.x].occupantId === u.id && cell.occupantHp === 0)) {
        return { ...u, hp: cell.occupantHp ?? 0, isAlive: (cell.occupantHp ?? 0) > 0 };
      }
      return u;
    });

    const newShotsThisTurn = game.shotsThisTurn + 1;
    const allDead = newUnits.every(u => !u.isAlive);

    setGame(prev => prev ? {
      ...prev,
      macroGrid: newGrid,
      placedUnits: newUnits,
      attackerShots: [...prev.attackerShots, coord],
      attackerScore: prev.attackerScore + scoreAdd,
      shotsThisTurn: newShotsThisTurn,
      combatLog: [...prev.combatLog, log],
      phase: allDead ? 'finished' : (newShotsThisTurn >= prev.maxShotsPerTurn ? 'defender_turn' : 'attacker_turn'),
    } : null);
  }, [game]);

  // Defender shoots at micro grid (targeting the car)
  const defenderShoot = useCallback((coord: MicroCoord) => {
    if (!game || game.phase !== 'defender_turn') return;
    if (game.shotsThisTurn >= game.maxShotsPerTurn) return;
    if (game.microGrid[coord.j][coord.i].revealed) return;

    const newMicroGrid = game.microGrid.map(row => row.map(cell => ({ ...cell })));
    const cell = newMicroGrid[coord.j][coord.i];
    cell.revealed = true;
    cell.hit = true;

    let log = `🔫 Shot at car (${coord.i}, ${coord.j}) — `;
    let scoreAdd = 0;

    const newVehicle = JSON.parse(JSON.stringify(game.vehicle)) as Vehicle;

    if (cell.vehicleId === game.vehicle.id && cell.vehiclePart) {
      const part = cell.vehiclePart;
      newVehicle.hpByPart[part] = Math.max(0, newVehicle.hpByPart[part] - 1);
      cell.partHp = newVehicle.hpByPart[part];

      if (newVehicle.hpByPart[part] === 0) {
        if (part === 'passenger_seat') newVehicle.seats.passenger.alive = false;
        if (part === 'rear_left') newVehicle.seats.rearLeft.alive = false;
        if (part === 'rear_right') newVehicle.seats.rearRight.alive = false;
        log += `💥 ${part.replace('_', ' ')} DESTROYED!`;
        scoreAdd = 75;
      } else {
        log += `🎯 HIT ${part.replace('_', ' ')}! (${newVehicle.hpByPart[part]} HP)`;
        scoreAdd = 20;
      }
    } else {
      log += 'MISS!';
    }

    const newShotsThisTurn = game.shotsThisTurn + 1;

    // Check if vehicle is destroyed (driver dead or all shooters dead)
    const vehicleDestroyed = !newVehicle.seats.driver.alive ||
      (!newVehicle.seats.passenger.alive && !newVehicle.seats.rearLeft.alive && !newVehicle.seats.rearRight.alive);

    setGame(prev => prev ? {
      ...prev,
      microGrid: newMicroGrid,
      vehicle: newVehicle,
      defenderShots: [...prev.defenderShots, coord],
      defenderScore: prev.defenderScore + scoreAdd,
      shotsThisTurn: newShotsThisTurn,
      combatLog: [...prev.combatLog, log],
      phase: vehicleDestroyed ? 'finished' : (newShotsThisTurn >= prev.maxShotsPerTurn ? 'attacker_turn' : 'defender_turn'),
    } : null);
  }, [game]);

  // End turn
  const endTurn = useCallback(() => {
    if (!game) return;

    const nextPhase: GamePhase = game.phase === 'attacker_turn' ? 'defender_turn' : 'attacker_turn';
    const newTurn = game.phase === 'defender_turn' ? game.turn + 1 : game.turn;

    if (newTurn > game.maxTurns) {
      setGame(prev => prev ? { ...prev, phase: 'finished', combatLog: [...prev.combatLog, '⏰ Time\'s up!'] } : null);
      return;
    }

    setGame(prev => prev ? {
      ...prev,
      phase: nextPhase,
      turn: newTurn,
      shotsThisTurn: 0,
      combatLog: [...prev.combatLog, `--- Turn ${newTurn} | ${nextPhase === 'attacker_turn' ? '🚗 Attacker' : '🏠 Defender'} ---`],
    } : null);
  }, [game]);

  // Collect rewards
  const collectRewards = useCallback(() => {
    if (!game) return;
    const isWinner = (game.role === 'attacker' && game.attackerScore > game.defenderScore) ||
                     (game.role === 'defender' && game.defenderScore > game.attackerScore);
    const reward = isWinner ? 500 + game.turn * 100 : 100;
    const heat = game.role === 'attacker' ? 15 : 5;

    updateMoney(reward);
    updateHeat(heat);
    addXP(50 + (isWinner ? 100 : 0));
    goBack();
  }, [game, updateMoney, updateHeat, addXP, goBack]);

  // ============ RENDER ============

  // Role selection screen
  if (!selectedRole || !game) {
    return (
      <div className="slide-game">
        <div className="slide-header">
          <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
          <div className="slide-title">
            <span className="title-icon">🎯</span>
            <span className="title-text">SLIDE</span>
          </div>
          <div />
        </div>

        <div className="role-selection">
          <h2 className="role-title">CHOOSE YOUR ROLE</h2>
          <p className="role-subtitle">Battleship-style combat on the block</p>

          <motion.div
            className="role-card attacker-card"
            onClick={() => { setSelectedRole('attacker'); startGame('attacker'); }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="role-emoji">🚗</span>
            <h3>SLIDE ON THEM</h3>
            <p>Drive by the block and shoot at hidden targets. Pick grid squares to find and eliminate defenders.</p>
            <div className="role-stats">
              <span>3 shots/turn</span>
              <span>5 turns</span>
              <span>+15 Heat</span>
            </div>
          </motion.div>

          <motion.div
            className="role-card defender-card"
            onClick={() => { setSelectedRole('defender'); startGame('defender'); }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="role-emoji">🏠</span>
            <h3>DEFEND THE BLOCK</h3>
            <p>Place your crew on the block, then shoot at the sliding car. Closer to street = more money but more danger.</p>
            <div className="role-stats">
              <span>6 units to place</span>
              <span>3 shots/turn</span>
              <span>+5 Heat</span>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Setup phase (defender places units)
  if (game.phase === 'setup') {
    return (
      <div className="slide-game">
        <div className="slide-header">
          <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
          <div className="slide-title">
            <span className="title-icon">📍</span>
            <span className="title-text">SETUP</span>
          </div>
          <span className="unit-count">{game.placedUnits.length}/6</span>
        </div>

        <div className="setup-instructions">
          <p>Place your crew on the block. Closer to the street = more money but easier to hit!</p>
        </div>

        {/* Unit type selector */}
        <div className="unit-selector">
          {UNIT_TEMPLATES.map((t, i) => (
            <motion.button
              key={t.type}
              className={`unit-type-btn ${selectedUnitType === i ? 'selected' : ''}`}
              onClick={() => setSelectedUnitType(i)}
              whileTap={{ scale: 0.95 }}
            >
              <span>{UNIT_EMOJIS[t.type]}</span>
              <span className="unit-type-name">{t.name}</span>
              <span className="unit-type-hp">{t.hp}HP</span>
            </motion.button>
          ))}
        </div>

        {/* Macro grid for placement */}
        <div className="macro-grid-container">
          <div className="grid-labels">
            {Array.from({ length: MACRO_SIZE }, (_, y) => (
              <div key={y} className={`row-label ${getRowType(y)}`}>{getRowLabel(y)}</div>
            ))}
          </div>
          <div className="macro-grid setup-mode">
            {game.macroGrid.map((row, y) =>
              row.map((cell, x) => {
                const unit = game.placedUnits.find(u => u.position.x === x && u.position.y === y);
                const rowType = getRowType(y);
                const proximity = STREET_PROXIMITY_TABLE[Math.min(y, MACRO_SIZE - 1 - y)] || STREET_PROXIMITY_TABLE[4];
                const isStreet = y === 0 || y === 7;

                return (
                  <motion.div
                    key={`${x}-${y}`}
                    className={`macro-cell ${rowType} ${unit ? 'occupied' : ''} ${isStreet ? 'no-place' : ''}`}
                    onClick={() => !isStreet && placeUnit({ x, y })}
                    whileHover={!isStreet ? { scale: 1.1 } : {}}
                    whileTap={!isStreet ? { scale: 0.9 } : {}}
                  >
                    {unit ? (
                      <span className="cell-unit">{UNIT_EMOJIS[unit.type]}</span>
                    ) : !isStreet ? (
                      <span className="cell-income">{proximity.incomeMultiplier}x</span>
                    ) : (
                      <span className="cell-street">🚗</span>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {game.placedUnits.length >= 3 && (
          <motion.button
            className="start-combat-btn"
            onClick={startCombat}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.95 }}
          >
            ⚔️ START COMBAT ({game.placedUnits.length}/6 placed)
          </motion.button>
        )}
      </div>
    );
  }

  // Combat phase
  const isAttackerTurn = game.phase === 'attacker_turn';
  const isDefenderTurn = game.phase === 'defender_turn';
  const isFinished = game.phase === 'finished';

  const winner = game.attackerScore > game.defenderScore ? 'attacker' : 
                 game.defenderScore > game.attackerScore ? 'defender' : 'draw';

  return (
    <div className="slide-game">
      <div className="slide-header">
        <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
        <div className="slide-title">
          <span className="title-icon">🎯</span>
          <span className="title-text">SLIDE</span>
        </div>
        <div className="turn-info">
          <span className="turn-number">T{game.turn}/{game.maxTurns}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="score-bar">
        <div className="score attacker-score">
          <span className="score-label">🚗 ATK</span>
          <span className="score-value">{game.attackerScore}</span>
        </div>
        <div className="phase-indicator">
          {isFinished ? '🏁 FINISHED' : isAttackerTurn ? '🚗 ATTACKER SHOOTS' : '🏠 DEFENDER SHOOTS'}
        </div>
        <div className="score defender-score">
          <span className="score-label">🏠 DEF</span>
          <span className="score-value">{game.defenderScore}</span>
        </div>
      </div>

      {/* Shots remaining */}
      {!isFinished && (
        <div className="shots-remaining">
          <span>Shots: {game.maxShotsPerTurn - game.shotsThisTurn} remaining</span>
          <motion.button
            className="end-turn-btn"
            onClick={endTurn}
            whileTap={{ scale: 0.95 }}
          >
            END TURN →
          </motion.button>
        </div>
      )}

      {/* Grid area */}
      <div className="combat-grids">
        {/* Macro grid (block) */}
        <div className="grid-section">
          <h3 className="grid-title">🏠 THE BLOCK (8x8)</h3>
          <div className="macro-grid combat-mode">
            {game.macroGrid.map((row, y) =>
              row.map((cell, x) => {
                const unit = game.placedUnits.find(u => u.position.x === x && u.position.y === y && u.isAlive);
                const isRevealed = cell.revealed;
                const canShoot = isAttackerTurn && !isRevealed && game.role === 'attacker';
                const showUnit = game.role === 'defender' || isRevealed;

                return (
                  <motion.div
                    key={`m-${x}-${y}`}
                    className={`macro-cell ${getRowType(y)} ${isRevealed ? 'revealed' : ''} ${cell.occupantId && isRevealed ? 'hit-unit' : ''} ${canShoot ? 'targetable' : ''}`}
                    onClick={() => canShoot && attackerShoot({ x, y })}
                    whileHover={canShoot ? { scale: 1.15, boxShadow: '0 0 10px rgba(255,0,0,0.5)' } : {}}
                    whileTap={canShoot ? { scale: 0.9 } : {}}
                  >
                    {showUnit && unit ? (
                      <span className="cell-unit">{UNIT_EMOJIS[unit.type]}</span>
                    ) : isRevealed && cell.hit ? (
                      cell.occupantId ? <span className="cell-hit">💥</span> : <span className="cell-miss">•</span>
                    ) : (
                      <span className="cell-fog">?</span>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Micro grid (car) */}
        <div className="grid-section">
          <h3 className="grid-title">🚗 THE CAR (16x16)</h3>
          <div className="micro-grid">
            {game.microGrid.map((row, j) =>
              row.map((cell, i) => {
                const isRevealed = cell.revealed;
                const isVehicle = !!cell.vehicleId;
                const canShoot = isDefenderTurn && !isRevealed && game.role === 'defender';
                const showPart = game.role === 'attacker' || isRevealed;

                return (
                  <motion.div
                    key={`u-${i}-${j}`}
                    className={`micro-cell ${isVehicle && showPart ? `vehicle-part ${cell.vehiclePart || ''}` : ''} ${isRevealed ? 'revealed' : ''} ${canShoot ? 'targetable' : ''}`}
                    onClick={() => canShoot && defenderShoot({ i, j })}
                    whileHover={canShoot ? { scale: 1.3 } : {}}
                    whileTap={canShoot ? { scale: 0.8 } : {}}
                  >
                    {isRevealed && cell.hit ? (
                      isVehicle ? <span className="micro-hit">💥</span> : <span className="micro-miss">·</span>
                    ) : null}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Combat log */}
      <div className="combat-log">
        <h4>📋 Combat Log</h4>
        <div className="log-entries">
          {game.combatLog.slice(-6).map((entry, i) => (
            <motion.div
              key={i}
              className="log-entry"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {entry}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Finished overlay */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            className="finish-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="finish-card"
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <h2 className="finish-title">
                {winner === game.role ? '🏆 VICTORY!' : winner === 'draw' ? '🤝 DRAW' : '💀 DEFEAT'}
              </h2>
              <div className="finish-scores">
                <div className="finish-score">
                  <span>🚗 Attacker</span>
                  <span className="big-score">{game.attackerScore}</span>
                </div>
                <span className="vs">VS</span>
                <div className="finish-score">
                  <span>🏠 Defender</span>
                  <span className="big-score">{game.defenderScore}</span>
                </div>
              </div>
              <div className="finish-rewards">
                <span>💰 +${winner === game.role ? 500 + game.turn * 100 : 100}</span>
                <span>⭐ +{50 + (winner === game.role ? 100 : 0)} XP</span>
                <span>🔥 +{game.role === 'attacker' ? 15 : 5} Heat</span>
              </div>
              <motion.button
                className="collect-btn"
                onClick={collectRewards}
                whileTap={{ scale: 0.95 }}
              >
                COLLECT REWARDS
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SlideGame;
