// ============================================================
// TopDownShooter - Block Attack Game (WoW/GTA-style top-down)
// Players send members in a car to attack a block.
// They can command the attack or take over a gang member.
// Units have avatars, health, loot (guns, money, drugs).
// Killed members lose loot and are permanently dead.
// ============================================================

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useNavigationStore,
  usePlayerStore,
  useGangStore,
  useEconomyStore,
  useNotificationStore,
} from '../../stores/gameStore';
import type { GangMember, InventoryItem } from '../../types/game.types';
import './TopDownShooter.css';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type GamePhase = 'setup' | 'combat' | 'results';
type ActionMode = 'command' | 'takeover';
type CombatAction = 'move' | 'shoot' | 'take_cover' | 'reload';

interface SeatAssignment {
  seat: 'driver' | 'front_passenger' | 'back_left' | 'back_right';
  memberId: string | null;
}

interface CombatUnit {
  id: string;
  memberId: string;
  name: string;
  nickname: string;
  role: string;
  avatarUrl?: string;
  
  // Position on grid
  x: number;
  y: number;
  facing: 'N' | 'S' | 'E' | 'W';
  
  // Stats
  hp: number;
  maxHp: number;
  accuracy: number;
  speed: number;
  nerve: number;
  
  // Equipment / Loot
  weapon: { name: string; damage: number; range: number; ammo: number; maxAmmo: number } | null;
  armor: number;
  cash: number;
  drugs: { name: string; quantity: number; value: number }[];
  
  // State
  isAlive: boolean;
  isInCover: boolean;
  isReloading: boolean;
  team: 'attacker' | 'defender';
  actionPoints: number;
  maxActionPoints: number;
  
  // Visual
  level: number;
}

interface GridTile {
  x: number;
  y: number;
  type: 'street' | 'sidewalk' | 'building' | 'alley' | 'corner' | 'vacant';
  coverScore: number;
  isOccupied: boolean;
  occupantId: string | null;
}

interface KillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  timestamp: number;
}

interface CombatResult {
  outcome: 'victory' | 'defeat' | 'draw';
  attackerKills: number;
  defenderKills: number;
  lootCollected: { name: string; quantity: number; value: number }[];
  casualties: { name: string; status: 'dead' | 'wounded'; killedBy?: string }[];
  moneyEarned: number;
  xpEarned: number;
  heatGenerated: number;
  moraleChange: number;
}

interface TargetBlock {
  id: string;
  name: string;
  gangName: string;
  gangColor: string;
  defenderCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'suicide';
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const GRID_SIZE = 10;
const MAX_ACTION_POINTS = 3;
const MOVE_COST = 1;
const SHOOT_COST = 1;
const COVER_COST = 1;
const RELOAD_COST = 1;

// Street layout: rows 4-5 are street, 3 and 6 are sidewalk, rest is buildings/alleys
const generateBlockGrid = (): GridTile[][] => {
  const grid: GridTile[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: GridTile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      let type: GridTile['type'] = 'building';
      let coverScore = 0.9;
      
      if (y === 4 || y === 5) {
        type = 'street';
        coverScore = 0;
      } else if (y === 3 || y === 6) {
        type = 'sidewalk';
        coverScore = 0.2;
      } else if (x === 0 || x === GRID_SIZE - 1) {
        type = 'alley';
        coverScore = 0.5;
      } else if ((y === 3 || y === 6) && (x === 0 || x === GRID_SIZE - 1)) {
        type = 'corner';
        coverScore = 0.6;
      } else if (Math.random() < 0.15) {
        type = 'vacant';
        coverScore = 0.3;
      }
      
      row.push({ x, y, type, coverScore, isOccupied: false, occupantId: null });
    }
    grid.push(row);
  }
  return grid;
};

const TILE_ICONS: Record<string, string> = {
  street: '',
  sidewalk: '░',
  building: '█',
  alley: '▒',
  corner: '▓',
  vacant: '·',
};

const ROLE_ICONS: Record<string, string> = {
  shooter: '🔫',
  dealer: '💊',
  enforcer: '💪',
  lookout: '👁️',
  driver: '🚗',
  default: '👤',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#44ff44',
  medium: '#ffaa00',
  hard: '#ff4444',
  suicide: '#ff00ff',
};

// ═══════════════════════════════════════════════════════════
// MOCK DATA GENERATORS
// ═══════════════════════════════════════════════════════════

const generateDefenders = (count: number, gangColor: string): CombatUnit[] => {
  const names = ['Lil Smoke', 'Big T', 'Razor', 'Ghost', 'Slim', 'Bones', 'Trigger', 'Ace', 'Viper', 'Blaze'];
  const roles = ['shooter', 'dealer', 'enforcer', 'shooter', 'lookout'];
  const weapons = [
    { name: 'Glock 19', damage: 25, range: 4, ammo: 15, maxAmmo: 15 },
    { name: 'MAC-10', damage: 18, range: 3, ammo: 30, maxAmmo: 30 },
    { name: 'Mossberg 500', damage: 45, range: 2, ammo: 6, maxAmmo: 6 },
    { name: 'AK-47', damage: 35, range: 5, ammo: 30, maxAmmo: 30 },
    null,
  ];
  
  const defenders: CombatUnit[] = [];
  const sidewalkYs = [3, 6];
  
  for (let i = 0; i < count; i++) {
    const role = roles[i % roles.length];
    const weapon = role === 'dealer' ? null : weapons[Math.floor(Math.random() * (weapons.length - 1))];
    const y = sidewalkYs[i % 2];
    const x = 2 + Math.floor(Math.random() * 6);
    
    defenders.push({
      id: `def-${i}`,
      memberId: `def-member-${i}`,
      name: names[i % names.length],
      nickname: names[i % names.length],
      role,
      x, y,
      facing: y === 3 ? 'S' : 'N',
      hp: 80 + Math.floor(Math.random() * 40),
      maxHp: 100 + Math.floor(Math.random() * 20),
      accuracy: 0.3 + Math.random() * 0.4,
      speed: 2 + Math.floor(Math.random() * 2),
      nerve: 0.4 + Math.random() * 0.4,
      weapon: weapon ? { ...weapon } : null,
      armor: Math.random() > 0.7 ? 20 : 0,
      cash: Math.floor(Math.random() * 500),
      drugs: role === 'dealer' ? [{ name: 'Weed', quantity: Math.floor(Math.random() * 10) + 1, value: 20 }] : [],
      isAlive: true,
      isInCover: false,
      isReloading: false,
      team: 'defender',
      actionPoints: MAX_ACTION_POINTS,
      maxActionPoints: MAX_ACTION_POINTS,
      level: 1 + Math.floor(Math.random() * 5),
    });
  }
  return defenders;
};

const generateTargetBlocks = (): TargetBlock[] => [
  { id: 'block-1', name: '5th & Main', gangName: 'Eastside Crips', gangColor: '#4488ff', defenderCount: 3, difficulty: 'easy' },
  { id: 'block-2', name: 'MLK & Broadway', gangName: 'Bloods', gangColor: '#ff4444', defenderCount: 5, difficulty: 'medium' },
  { id: 'block-3', name: 'Compton Ave', gangName: 'Piru', gangColor: '#ff0066', defenderCount: 7, difficulty: 'hard' },
  { id: 'block-4', name: 'Imperial Courts', gangName: 'Grape Street', gangColor: '#8844ff', defenderCount: 10, difficulty: 'suicide' },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

const TopDownShooter: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat, addXP } = usePlayerStore();
  const { members, killMember, updateMember } = useGangStore();
  const { addNotification } = useNotificationStore();
  
  // Game state
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [actionMode, setActionMode] = useState<ActionMode>('command');
  const [currentAction, setCurrentAction] = useState<CombatAction>('shoot');
  
  // Setup state
  const [seats, setSeats] = useState<SeatAssignment[]>([
    { seat: 'driver', memberId: null },
    { seat: 'front_passenger', memberId: null },
    { seat: 'back_left', memberId: null },
    { seat: 'back_right', memberId: null },
  ]);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [targetBlock, setTargetBlock] = useState<TargetBlock | null>(null);
  
  // Combat state
  const [grid, setGrid] = useState<GridTile[][]>([]);
  const [attackers, setAttackers] = useState<CombatUnit[]>([]);
  const [defenders, setDefenders] = useState<CombatUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [takeoverUnit, setTakeoverUnit] = useState<string | null>(null);
  const [turn, setTurn] = useState(1);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [hitMarkers, setHitMarkers] = useState<{ id: string; x: number; y: number; damage: number }[]>([]);
  const [showCommandPanel, setShowCommandPanel] = useState(false);
  
  // Results
  const [results, setResults] = useState<CombatResult | null>(null);
  
  // Available members for car assignment
  const availableMembers = useMemo(() => 
    members.filter(m => m.status === 'active' && !seats.some(s => s.memberId === m.id)),
    [members, seats]
  );
  
  const assignedMembers = useMemo(() =>
    seats.filter(s => s.memberId !== null).map(s => ({
      ...s,
      member: members.find(m => m.id === s.memberId),
    })),
    [seats, members]
  );
  
  const canLaunch = useMemo(() => {
    const hasDriver = seats.find(s => s.seat === 'driver')?.memberId !== null;
    const hasShooter = seats.some(s => s.seat !== 'driver' && s.memberId !== null);
    return hasDriver && hasShooter && targetBlock !== null;
  }, [seats, targetBlock]);
  
  // ─── SETUP HANDLERS ───
  
  const handleSeatClick = (seatName: string) => {
    const seat = seats.find(s => s.seat === seatName);
    if (seat?.memberId) {
      // Remove member from seat
      setSeats(prev => prev.map(s => s.seat === seatName ? { ...s, memberId: null } : s));
    } else {
      setSelectedSeat(seatName);
    }
  };
  
  const handleMemberSelect = (memberId: string) => {
    if (!selectedSeat) return;
    setSeats(prev => prev.map(s => s.seat === selectedSeat ? { ...s, memberId } : s));
    setSelectedSeat(null);
  };
  
  const handleLaunchAttack = () => {
    if (!canLaunch || !targetBlock) return;
    
    // Create combat grid
    const newGrid = generateBlockGrid();
    
    // Create attacker units from assigned members
    const attackerUnits: CombatUnit[] = [];
    const entryY = 4; // Enter from the street
    
    seats.forEach((seat, idx) => {
      if (!seat.memberId) return;
      const member = members.find(m => m.id === seat.memberId);
      if (!member) return;
      
      const memberAny = member as any;
      const isDriver = seat.seat === 'driver';
      const canShoot = !isDriver && (memberAny.role !== 'dealer' || memberAny.shooting > 40);
      
      const weapon = canShoot ? {
        name: memberAny.inventory?.find((i: any) => i.type === 'weapon')?.name || 'Glock 19',
        damage: 20 + (memberAny.shooting || 50) / 5,
        range: 4,
        ammo: 15,
        maxAmmo: 15,
      } : null;
      
      attackerUnits.push({
        id: `atk-${idx}`,
        memberId: member.id,
        name: memberAny.name || 'Unknown',
        nickname: memberAny.nickname || memberAny.name || 'Unknown',
        role: memberAny.role || 'shooter',
        avatarUrl: memberAny.customAvatarUrl || memberAny.avatarUrl,
        x: idx,
        y: entryY,
        facing: 'N',
        hp: memberAny.health || memberAny.maxHealth || 100,
        maxHp: memberAny.maxHealth || 100,
        accuracy: (memberAny.shooting || 50) / 100,
        speed: 2,
        nerve: (memberAny.morale || 50) / 100,
        weapon,
        armor: memberAny.armor || 0,
        cash: Math.floor(Math.random() * 200),
        drugs: [],
        isAlive: true,
        isInCover: false,
        isReloading: false,
        team: 'attacker',
        actionPoints: MAX_ACTION_POINTS,
        maxActionPoints: MAX_ACTION_POINTS,
        level: memberAny.level || 1,
      });
    });
    
    // Place attackers on grid
    attackerUnits.forEach(unit => {
      if (newGrid[unit.y] && newGrid[unit.y][unit.x]) {
        newGrid[unit.y][unit.x].isOccupied = true;
        newGrid[unit.y][unit.x].occupantId = unit.id;
      }
    });
    
    // Generate defenders
    const defenderUnits = generateDefenders(targetBlock.defenderCount, targetBlock.gangColor);
    defenderUnits.forEach(unit => {
      if (newGrid[unit.y] && newGrid[unit.y][unit.x]) {
        newGrid[unit.y][unit.x].isOccupied = true;
        newGrid[unit.y][unit.x].occupantId = unit.id;
      }
    });
    
    setGrid(newGrid);
    setAttackers(attackerUnits);
    setDefenders(defenderUnits);
    setPhase('combat');
    setTurn(1);
    setIsPlayerTurn(true);
  };
  
  // ─── COMBAT HANDLERS ───
  
  const allUnits = useMemo(() => [...attackers, ...defenders], [attackers, defenders]);
  
  const getUnitAt = useCallback((x: number, y: number): CombatUnit | null => {
    return allUnits.find(u => u.x === x && u.y === y && u.isAlive) || null;
  }, [allUnits]);
  
  const getDistance = (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  };
  
  const resolveShot = useCallback((shooter: CombatUnit, target: CombatUnit): { hit: boolean; damage: number; critical: boolean } => {
    if (!shooter.weapon || shooter.weapon.ammo <= 0) return { hit: false, damage: 0, critical: false };
    
    const distance = getDistance(shooter.x, shooter.y, target.x, target.y);
    if (distance > shooter.weapon.range) return { hit: false, damage: 0, critical: false };
    
    // Hit calculation
    let hitChance = shooter.accuracy;
    hitChance -= distance * 0.05;
    if (target.isInCover) hitChance -= grid[target.y]?.[target.x]?.coverScore || 0;
    if (shooter.isInCover) hitChance += 0.1;
    hitChance = Math.max(0.05, Math.min(0.95, hitChance));
    
    const hit = Math.random() < hitChance;
    if (!hit) return { hit: false, damage: 0, critical: false };
    
    // Damage calculation
    const critical = Math.random() < 0.15;
    let damage = shooter.weapon.damage * (0.8 + Math.random() * 0.4);
    if (critical) damage *= 2;
    damage = Math.max(1, Math.floor(damage - target.armor * 0.5));
    
    return { hit, damage, critical };
  }, [grid]);
  
  const handleCellClick = useCallback((x: number, y: number) => {
    if (!isPlayerTurn) return;
    
    const unitAtCell = getUnitAt(x, y);
    
    if (actionMode === 'takeover' && takeoverUnit) {
      const unit = attackers.find(u => u.id === takeoverUnit);
      if (!unit || !unit.isAlive || unit.actionPoints <= 0) return;
      
      if (currentAction === 'move') {
        const dist = getDistance(unit.x, unit.y, x, y);
        if (dist <= unit.speed && !unitAtCell && grid[y]?.[x]?.type !== 'building') {
          // Move unit
          const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
          newGrid[unit.y][unit.x].isOccupied = false;
          newGrid[unit.y][unit.x].occupantId = null;
          newGrid[y][x].isOccupied = true;
          newGrid[y][x].occupantId = unit.id;
          
          setGrid(newGrid);
          setAttackers(prev => prev.map(u => 
            u.id === unit.id ? { ...u, x, y, actionPoints: u.actionPoints - MOVE_COST } : u
          ));
        }
      } else if (currentAction === 'shoot' && unitAtCell && unitAtCell.team === 'defender') {
        if (!unit.weapon || unit.weapon.ammo <= 0) return;
        
        const result = resolveShot(unit, unitAtCell);
        
        // Consume ammo
        setAttackers(prev => prev.map(u => 
          u.id === unit.id ? { 
            ...u, 
            actionPoints: u.actionPoints - SHOOT_COST,
            weapon: u.weapon ? { ...u.weapon, ammo: u.weapon.ammo - 1 } : null,
          } : u
        ));
        
        if (result.hit) {
          const newHp = Math.max(0, unitAtCell.hp - result.damage);
          const isDead = newHp <= 0;
          
          setDefenders(prev => prev.map(d => 
            d.id === unitAtCell.id ? { ...d, hp: newHp, isAlive: !isDead } : d
          ));
          
          // Hit marker
          setHitMarkers(prev => [...prev, { id: `hit-${Date.now()}`, x, y, damage: result.damage }]);
          setTimeout(() => setHitMarkers(prev => prev.filter(h => h.id !== `hit-${Date.now()}`)), 800);
          
          if (isDead) {
            setKillFeed(prev => [{
              id: `kill-${Date.now()}`,
              killer: unit.name,
              victim: unitAtCell.name,
              weapon: unit.weapon?.name || 'Unknown',
              timestamp: Date.now(),
            }, ...prev.slice(0, 4)]);
            
            // Clear grid cell
            const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
            newGrid[y][x].isOccupied = false;
            newGrid[y][x].occupantId = null;
            setGrid(newGrid);
          }
        }
      }
    } else if (actionMode === 'command') {
      // In command mode, clicking a friendly unit selects it
      if (unitAtCell && unitAtCell.team === 'attacker') {
        setSelectedUnit(unitAtCell.id);
      } else if (selectedUnit) {
        // Click on empty cell or enemy = command selected unit
        const unit = attackers.find(u => u.id === selectedUnit);
        if (!unit || !unit.isAlive || unit.actionPoints <= 0) return;
        
        if (unitAtCell && unitAtCell.team === 'defender' && unit.weapon && unit.weapon.ammo > 0) {
          // Auto-shoot at enemy
          const result = resolveShot(unit, unitAtCell);
          
          setAttackers(prev => prev.map(u => 
            u.id === unit.id ? {
              ...u,
              actionPoints: u.actionPoints - SHOOT_COST,
              weapon: u.weapon ? { ...u.weapon, ammo: u.weapon.ammo - 1 } : null,
            } : u
          ));
          
          if (result.hit) {
            const newHp = Math.max(0, unitAtCell.hp - result.damage);
            const isDead = newHp <= 0;
            
            setDefenders(prev => prev.map(d => 
              d.id === unitAtCell.id ? { ...d, hp: newHp, isAlive: !isDead } : d
            ));
            
            setHitMarkers(prev => [...prev, { id: `hit-${Date.now()}`, x, y, damage: result.damage }]);
            
            if (isDead) {
              setKillFeed(prev => [{
                id: `kill-${Date.now()}`,
                killer: unit.name,
                victim: unitAtCell.name,
                weapon: unit.weapon?.name || 'Unknown',
                timestamp: Date.now(),
              }, ...prev.slice(0, 4)]);
              
              const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
              newGrid[y][x].isOccupied = false;
              newGrid[y][x].occupantId = null;
              setGrid(newGrid);
            }
          }
        } else if (!unitAtCell && grid[y]?.[x]?.type !== 'building') {
          // Move to empty cell
          const dist = getDistance(unit.x, unit.y, x, y);
          if (dist <= unit.speed) {
            const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
            newGrid[unit.y][unit.x].isOccupied = false;
            newGrid[unit.y][unit.x].occupantId = null;
            newGrid[y][x].isOccupied = true;
            newGrid[y][x].occupantId = unit.id;
            
            setGrid(newGrid);
            setAttackers(prev => prev.map(u => 
              u.id === unit.id ? { ...u, x, y, actionPoints: u.actionPoints - MOVE_COST } : u
            ));
          }
        }
      }
    }
  }, [isPlayerTurn, actionMode, takeoverUnit, currentAction, selectedUnit, attackers, defenders, grid, getUnitAt, resolveShot]);
  
  // End turn
  const handleEndTurn = useCallback(() => {
    setIsPlayerTurn(false);
    
    // AI turn - defenders shoot at nearest attacker
    setTimeout(() => {
      const aliveDefenders = defenders.filter(d => d.isAlive);
      const aliveAttackers = attackers.filter(a => a.isAlive);
      
      let newAttackers = [...attackers];
      let newKillFeed = [...killFeed];
      let newGrid = grid.map(row => row.map(cell => ({ ...cell })));
      
      aliveDefenders.forEach(def => {
        if (!def.weapon || def.weapon.ammo <= 0) return;
        
        // Find nearest attacker
        let nearestAtk: CombatUnit | null = null;
        let nearestDist = Infinity;
        aliveAttackers.forEach(atk => {
          if (!atk.isAlive) return;
          const dist = getDistance(def.x, def.y, atk.x, atk.y);
          if (dist < nearestDist && dist <= (def.weapon?.range || 0)) {
            nearestDist = dist;
            nearestAtk = atk;
          }
        });
        
        if (nearestAtk) {
          const result = resolveShot(def, nearestAtk);
          if (result.hit) {
            const newHp = Math.max(0, (nearestAtk as CombatUnit).hp - result.damage);
            const isDead = newHp <= 0;
            
            newAttackers = newAttackers.map(a => 
              a.id === (nearestAtk as CombatUnit).id ? { ...a, hp: newHp, isAlive: !isDead } : a
            );
            
            if (isDead) {
              newKillFeed = [{
                id: `kill-${Date.now()}-${def.id}`,
                killer: def.name,
                victim: (nearestAtk as CombatUnit).name,
                weapon: def.weapon?.name || 'Unknown',
                timestamp: Date.now(),
              }, ...newKillFeed.slice(0, 4)];
              
              newGrid[(nearestAtk as CombatUnit).y][(nearestAtk as CombatUnit).x].isOccupied = false;
              newGrid[(nearestAtk as CombatUnit).y][(nearestAtk as CombatUnit).x].occupantId = null;
            }
          }
        }
      });
      
      setAttackers(newAttackers);
      setKillFeed(newKillFeed);
      setGrid(newGrid);
      
      // Reset action points for next turn
      setAttackers(prev => prev.map(u => ({ ...u, actionPoints: u.maxActionPoints })));
      setDefenders(prev => prev.map(u => ({ ...u, actionPoints: u.maxActionPoints })));
      setTurn(t => t + 1);
      setIsPlayerTurn(true);
      
      // Check win/loss conditions
      const atkAlive = newAttackers.filter(a => a.isAlive).length;
      const defAlive = defenders.filter(d => d.isAlive).length;
      
      if (atkAlive === 0 || defAlive === 0 || turn >= 15) {
        endCombat(newAttackers, defenders, newKillFeed);
      }
    }, 1200);
  }, [defenders, attackers, grid, killFeed, turn, resolveShot]);
  
  // Handle retreat
  const handleRetreat = useCallback(() => {
    endCombat(attackers, defenders, killFeed, true);
  }, [attackers, defenders, killFeed]);
  
  // End combat and calculate results
  const endCombat = (finalAttackers: CombatUnit[], finalDefenders: CombatUnit[], feed: KillFeedEntry[], retreated = false) => {
    const atkAlive = finalAttackers.filter(a => a.isAlive).length;
    const defAlive = finalDefenders.filter(d => d.isAlive).length;
    const atkDead = finalAttackers.filter(a => !a.isAlive);
    const defDead = finalDefenders.filter(d => !d.isAlive);
    
    let outcome: 'victory' | 'defeat' | 'draw' = 'draw';
    if (retreated) outcome = 'defeat';
    else if (defAlive === 0) outcome = 'victory';
    else if (atkAlive === 0) outcome = 'defeat';
    else if (atkAlive > defAlive) outcome = 'victory';
    else if (defAlive > atkAlive) outcome = 'defeat';
    
    // Collect loot from dead defenders
    const loot: { name: string; quantity: number; value: number }[] = [];
    let moneyFromLoot = 0;
    if (outcome === 'victory') {
      defDead.forEach(d => {
        moneyFromLoot += d.cash;
        d.drugs.forEach(drug => {
          loot.push({ name: drug.name, quantity: drug.quantity, value: drug.value * drug.quantity });
        });
        if (d.weapon) {
          loot.push({ name: d.weapon.name, quantity: 1, value: d.weapon.damage * 10 });
        }
      });
    }
    
    // Casualties
    const casualties = atkDead.map(a => ({
      name: a.name,
      status: 'dead' as const,
      killedBy: feed.find(f => f.victim === a.name)?.killer,
    }));
    
    // Apply permanent death to killed attackers
    atkDead.forEach(deadUnit => {
      killMember(deadUnit.memberId, `Killed by ${feed.find(f => f.victim === deadUnit.name)?.killer || 'enemy fire'}`);
    });
    
    const xpEarned = defDead.length * 30 + (outcome === 'victory' ? 100 : 0);
    const heatGenerated = Math.min(feed.length * 5 + defDead.length * 8, 50);
    
    const combatResult: CombatResult = {
      outcome,
      attackerKills: defDead.length,
      defenderKills: atkDead.length,
      lootCollected: loot,
      casualties,
      moneyEarned: moneyFromLoot,
      xpEarned,
      heatGenerated,
      moraleChange: outcome === 'victory' ? 5 : -10,
    };
    
    // Apply rewards
    updateMoney(moneyFromLoot);
    updateHeat(heatGenerated);
    addXP(xpEarned);
    
    setResults(combatResult);
    setPhase('results');
  };
  
  // Handle takeover toggle
  const handleTakeover = (unitId: string) => {
    if (actionMode === 'takeover' && takeoverUnit === unitId) {
      setActionMode('command');
      setTakeoverUnit(null);
    } else {
      setActionMode('takeover');
      setTakeoverUnit(unitId);
      setSelectedUnit(null);
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  
  const targetBlocks = useMemo(() => generateTargetBlocks(), []);
  
  // ─── SETUP PHASE ───
  if (phase === 'setup') {
    return (
      <div className="topdown-game">
        <div className="topdown-header">
          <button className="back-btn" onClick={goBack}>← Back</button>
          <span className="game-title">⚔️ Block Attack</span>
          <span className="round-info">Setup</span>
        </div>
        
        <div className="setup-phase">
          <h2>Load Up the Car</h2>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
            Assign members to seats. Driver drives only. Shooters ride and fire. Dealers/enforcers/lookouts can drive but won't shoot.
          </p>
          
          <div className="setup-section">
            <h3>🚗 Car Seats</h3>
            <div className="car-layout">
              {seats.map(seat => {
                const member = seat.memberId ? members.find(m => m.id === seat.memberId) : null;
                const memberAny = member as any;
                return (
                  <motion.div
                    key={seat.seat}
                    className={`car-seat ${seat.seat === 'driver' ? 'driver' : ''} ${member ? 'filled' : ''}`}
                    onClick={() => handleSeatClick(seat.seat)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="seat-label">
                      {seat.seat === 'driver' ? '🏎️ Driver' : 
                       seat.seat === 'front_passenger' ? '🔫 Front' :
                       seat.seat === 'back_left' ? '🔫 Back L' : '🔫 Back R'}
                    </span>
                    {member ? (
                      <>
                        <div className="seat-avatar">
                          {memberAny?.customAvatarUrl ? (
                            <img src={memberAny.customAvatarUrl} alt={memberAny.name} />
                          ) : (
                            ROLE_ICONS[memberAny?.role || 'default']
                          )}
                        </div>
                        <span className="seat-member-name">{memberAny?.name || 'Member'}</span>
                        <span className="seat-role">{memberAny?.role || 'unknown'}</span>
                      </>
                    ) : (
                      <span style={{ color: '#555', fontSize: 24 }}>+</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {/* Member picker */}
          <AnimatePresence>
            {selectedSeat && (
              <motion.div
                className="setup-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3>Select Member for {selectedSeat.replace('_', ' ')}</h3>
                <div className="member-picker">
                  {availableMembers.length === 0 ? (
                    <p style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 16 }}>
                      No available members. Recruit more in CREW.
                    </p>
                  ) : (
                    availableMembers.map(m => {
                      const ma = m as any;
                      const isDriverSeat = selectedSeat === 'driver';
                      const canDrive = ['dealer', 'enforcer', 'lookout', 'driver'].includes(ma.role || '');
                      const canShoot = ['shooter', 'enforcer'].includes(ma.role || '');
                      const isDisabled = isDriverSeat ? false : false; // Anyone can ride
                      
                      return (
                        <motion.div
                          key={m.id}
                          className={`member-pick-card ${isDisabled ? 'disabled' : ''}`}
                          onClick={() => !isDisabled && handleMemberSelect(m.id)}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="member-pick-avatar">
                            {ma.customAvatarUrl ? (
                              <img src={ma.customAvatarUrl} alt={ma.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              ROLE_ICONS[ma.role || 'default']
                            )}
                          </div>
                          <div className="member-pick-info">
                            <div className="member-pick-name">{ma.name || 'Member'}</div>
                            <div className="member-pick-stats">
                              {(ma.role || 'unknown').toUpperCase()} · LV{ma.level || 1} · 
                              🔫{ma.shooting || 50} · ❤️{ma.health || 100}
                              {isDriverSeat && canDrive && ' · Can Drive'}
                              {!isDriverSeat && canShoot && ' · Will Shoot'}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Target block selection */}
          <div className="setup-section">
            <h3>🎯 Target Block</h3>
            <div className="block-selector">
              {targetBlocks.map(block => (
                <motion.div
                  key={block.id}
                  className={`block-option ${targetBlock?.id === block.id ? 'selected' : ''}`}
                  onClick={() => setTargetBlock(block)}
                  whileTap={{ scale: 0.98 }}
                >
                  <div>
                    <div className="block-option-name">{block.name}</div>
                    <div className="block-option-gang" style={{ color: block.gangColor }}>{block.gangName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="block-option-defenders">👥 {block.defenderCount} defenders</div>
                    <div style={{ color: DIFFICULTY_COLORS[block.difficulty], fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {block.difficulty}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          
          <motion.button
            className="launch-attack-btn"
            onClick={handleLaunchAttack}
            disabled={!canLaunch}
            whileTap={{ scale: 0.98 }}
          >
            🔥 Launch Attack
          </motion.button>
        </div>
      </div>
    );
  }
  
  // ─── COMBAT PHASE ───
  if (phase === 'combat') {
    const activeUnit = takeoverUnit 
      ? attackers.find(u => u.id === takeoverUnit)
      : selectedUnit ? attackers.find(u => u.id === selectedUnit) : null;
    
    return (
      <div className="topdown-game">
        <div className="topdown-header">
          <button className="back-btn" onClick={handleRetreat}>🏳️ Retreat</button>
          <span className="game-title">⚔️ Block Attack</span>
          <span className="round-info">Turn {turn} · {isPlayerTurn ? 'Your Move' : 'Enemy Turn...'}</span>
        </div>
        
        {/* Combat HUD */}
        <div className="combat-hud">
          <div className="hud-section">
            <span className="hud-label">Your Crew</span>
            <span className={`hud-value ${attackers.filter(a => a.isAlive).length <= 1 ? 'danger' : 'safe'}`}>
              {attackers.filter(a => a.isAlive).length}/{attackers.length}
            </span>
          </div>
          <div className="hud-section">
            <span className="hud-label">Mode</span>
            <span className="hud-value" style={{ color: actionMode === 'takeover' ? '#ff4444' : '#4488ff' }}>
              {actionMode === 'takeover' ? '🎮 TAKEOVER' : '📋 COMMAND'}
            </span>
          </div>
          <div className="hud-section">
            <span className="hud-label">Enemies</span>
            <span className={`hud-value ${defenders.filter(d => d.isAlive).length > 3 ? 'danger' : 'warning'}`}>
              {defenders.filter(d => d.isAlive).length}/{defenders.length}
            </span>
          </div>
        </div>
        
        {/* Takeover indicator */}
        {actionMode === 'takeover' && takeoverUnit && (
          <div className="takeover-indicator">
            🎮 Playing as {attackers.find(u => u.id === takeoverUnit)?.name}
          </div>
        )}
        
        {/* Kill Feed */}
        <div className="kill-feed">
          <AnimatePresence>
            {killFeed.slice(0, 3).map(entry => (
              <motion.div
                key={entry.id}
                className="kill-entry"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="killer">{entry.killer}</span>
                {' '}
                <span className="weapon-icon">[{entry.weapon}]</span>
                {' '}
                <span className="victim">{entry.victim}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Battlefield Grid */}
        <div className="battlefield">
          <div
            className="battlefield-grid"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` }}
          >
            {grid.flat().map(tile => {
              const unit = getUnitAt(tile.x, tile.y);
              const isSelected = unit && (selectedUnit === unit.id || takeoverUnit === unit.id);
              
              return (
                <div
                  key={`${tile.x}-${tile.y}`}
                  className={`grid-cell ${tile.type}`}
                  onClick={() => handleCellClick(tile.x, tile.y)}
                  style={{ position: 'relative' }}
                >
                  {/* Tile background */}
                  {!unit && <span style={{ color: '#333', fontSize: 8 }}>{TILE_ICONS[tile.type]}</span>}
                  
                  {/* Unit token */}
                  {unit && (
                    <div className={`unit-token ${unit.team === 'attacker' ? 'friendly' : 'enemy'} ${isSelected ? 'selected' : ''} ${!unit.isAlive ? 'dead' : ''}`}>
                      {unit.avatarUrl ? (
                        <img src={unit.avatarUrl} alt={unit.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        ROLE_ICONS[unit.role] || '👤'
                      )}
                      <div className="unit-hp-bar">
                        <div
                          className={`unit-hp-fill ${unit.hp / unit.maxHp > 0.6 ? 'high' : unit.hp / unit.maxHp > 0.3 ? 'medium' : 'low'}`}
                          style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Hit markers */}
                  {hitMarkers.filter(h => h.x === tile.x && h.y === tile.y).map(h => (
                    <div key={h.id} className="hit-marker">-{h.damage}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Unit Info Panel */}
        {activeUnit && (
          <div className="unit-info-panel">
            <div className="unit-info-header">
              <div className="unit-info-avatar">
                {activeUnit.avatarUrl ? (
                  <img src={activeUnit.avatarUrl} alt={activeUnit.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  ROLE_ICONS[activeUnit.role] || '👤'
                )}
              </div>
              <div>
                <div className="unit-info-name">{activeUnit.name} <span style={{ color: '#888', fontSize: 10 }}>LV{activeUnit.level}</span></div>
                <div className="unit-info-role">{activeUnit.role}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ color: '#44ff44', fontSize: 12 }}>❤️ {activeUnit.hp}/{activeUnit.maxHp}</div>
                <div style={{ color: '#ffaa00', fontSize: 10 }}>AP: {activeUnit.actionPoints}/{activeUnit.maxActionPoints}</div>
              </div>
            </div>
            <div className="unit-info-stats">
              <div className="unit-stat">
                <div className="unit-stat-label">ACC</div>
                <div className="unit-stat-value">{Math.round(activeUnit.accuracy * 100)}%</div>
              </div>
              <div className="unit-stat">
                <div className="unit-stat-label">Weapon</div>
                <div className="unit-stat-value">{activeUnit.weapon?.name || 'None'}</div>
              </div>
              <div className="unit-stat">
                <div className="unit-stat-label">Ammo</div>
                <div className="unit-stat-value">{activeUnit.weapon?.ammo || 0}/{activeUnit.weapon?.maxAmmo || 0}</div>
              </div>
              <div className="unit-stat">
                <div className="unit-stat-label">Armor</div>
                <div className="unit-stat-value">{activeUnit.armor}</div>
              </div>
            </div>
            {/* Loot on body */}
            <div className="unit-loot">
              {activeUnit.cash > 0 && <span className="loot-item">💵 ${activeUnit.cash}</span>}
              {activeUnit.drugs.map((d, i) => (
                <span key={i} className="loot-item">💊 {d.quantity}x {d.name}</span>
              ))}
              {activeUnit.weapon && <span className="loot-item">🔫 {activeUnit.weapon.name}</span>}
            </div>
          </div>
        )}
        
        {/* Action Bar */}
        <div className="action-bar">
          {actionMode === 'takeover' ? (
            <>
              <button className={`action-btn ${currentAction === 'move' ? 'active' : ''}`} onClick={() => setCurrentAction('move')}>🏃 Move</button>
              <button className={`action-btn fire-btn ${currentAction === 'shoot' ? 'active' : ''}`} onClick={() => setCurrentAction('shoot')}>🔫 Shoot</button>
              <button className="action-btn" onClick={() => {
                if (takeoverUnit) {
                  setAttackers(prev => prev.map(u => u.id === takeoverUnit ? { ...u, isInCover: !u.isInCover, actionPoints: u.actionPoints - COVER_COST } : u));
                }
              }}>🛡️ Cover</button>
              <button className="action-btn" onClick={() => setActionMode('command')}>📋 Cmd</button>
            </>
          ) : (
            <>
              {attackers.filter(a => a.isAlive).map(unit => (
                <button
                  key={unit.id}
                  className={`action-btn ${selectedUnit === unit.id ? 'active' : ''}`}
                  onClick={() => setSelectedUnit(unit.id)}
                  style={{ fontSize: 9 }}
                >
                  {ROLE_ICONS[unit.role]} {unit.name.split(' ')[0]}
                </button>
              ))}
            </>
          )}
        </div>
        
        {/* Takeover / Command toggle */}
        <div className="action-bar" style={{ borderTop: 'none', paddingTop: 0 }}>
          {attackers.filter(a => a.isAlive).map(unit => (
            <button
              key={`to-${unit.id}`}
              className={`action-btn ${takeoverUnit === unit.id ? 'active' : ''}`}
              onClick={() => handleTakeover(unit.id)}
              style={{ fontSize: 9 }}
            >
              🎮 {unit.name.split(' ')[0]}
            </button>
          ))}
          <button className="action-btn retreat-btn" onClick={handleEndTurn} disabled={!isPlayerTurn}>
            ⏭️ End Turn
          </button>
        </div>
      </div>
    );
  }
  
  // ─── RESULTS PHASE ───
  if (phase === 'results' && results) {
    return (
      <div className="topdown-game">
        <div className="topdown-header">
          <button className="back-btn" onClick={goBack}>← Back</button>
          <span className="game-title">⚔️ Block Attack</span>
          <span className="round-info">Results</span>
        </div>
        
        <div className="results-screen">
          <div className={`results-title ${results.outcome}`}>
            {results.outcome === 'victory' ? '🏆 VICTORY' : results.outcome === 'defeat' ? '💀 DEFEAT' : '🤝 DRAW'}
          </div>
          <div className="results-subtitle">
            {results.outcome === 'victory' 
              ? `Block cleared in ${turn} turns. You run this now.`
              : results.outcome === 'defeat'
              ? 'Your crew got wiped. Regroup and try again.'
              : 'Both sides took heavy losses.'}
          </div>
          
          <div className="results-stats">
            <div className="result-stat">
              <div className="result-stat-label">Kills</div>
              <div className="result-stat-value" style={{ color: '#44ff44' }}>{results.attackerKills}</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-label">Losses</div>
              <div className="result-stat-value" style={{ color: '#ff4444' }}>{results.defenderKills}</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-label">Money</div>
              <div className="result-stat-value" style={{ color: '#ffaa00' }}>+${results.moneyEarned}</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-label">XP</div>
              <div className="result-stat-value" style={{ color: '#4488ff' }}>+{results.xpEarned}</div>
            </div>
          </div>
          
          {/* Loot */}
          {results.lootCollected.length > 0 && (
            <div className="results-loot">
              <h3>🎒 Loot Collected</h3>
              <div className="loot-list">
                {results.lootCollected.map((loot, i) => (
                  <div key={i} className="loot-entry">
                    <span>{loot.quantity}x {loot.name}</span>
                    <span style={{ color: '#ffaa00' }}>${loot.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Casualties */}
          {results.casualties.length > 0 && (
            <div className="results-casualties">
              <h3>🕊️ Fallen Soldiers</h3>
              {results.casualties.map((c, i) => (
                <div key={i} className="casualty-entry">
                  <span className="casualty-status">🕊️</span>
                  <span>{c.name}</span>
                  {c.killedBy && <span style={{ color: '#888' }}>killed by {c.killedBy}</span>}
                </div>
              ))}
            </div>
          )}
          
          <div style={{ color: '#ff8888', fontSize: 11, marginBottom: 16 }}>
            🔥 Heat +{results.heatGenerated}% · Morale {results.moraleChange > 0 ? '+' : ''}{results.moraleChange}
          </div>
          
          <div className="results-actions">
            <motion.button className="result-btn secondary" onClick={goBack} whileTap={{ scale: 0.95 }}>
              Go Home
            </motion.button>
            <motion.button className="result-btn primary" onClick={() => { setPhase('setup'); setResults(null); setSeats(seats.map(s => ({ ...s, memberId: null }))); }} whileTap={{ scale: 0.95 }}>
              Attack Again
            </motion.button>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
};

export default TopDownShooter;
