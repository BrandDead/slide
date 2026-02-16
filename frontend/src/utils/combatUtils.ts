// ============================================
// DEALT/SLIDE COMBAT SYSTEM - Utilities
// Source: qwen3-coder:480b-cloud
// ============================================

import { CombatSession, CombatUnit, Vehicle, UnitStats, VehicleStats } from '../types/combatTypes';

export const UNIT_STATS: UnitStats = {
  soldier: {
    health: 100,
    accuracy: 0.7,
    damage: 25
  },
  enforcer: {
    health: 150,
    accuracy: 0.5,
    damage: 40
  },
  dealer: {
    health: 75,
    accuracy: 0,
    damage: 0
  }
};

export const VEHICLE_STATS: VehicleStats = {
  '2-door': {
    size: [2, 1],
    passengers: 2,
    speed: 'fast',
    armor: 1
  },
  '4-door': {
    size: [2, 2],
    passengers: 4,
    speed: 'balanced',
    armor: 2
  },
  'suv': {
    size: [2, 2],
    passengers: 4,
    speed: 'balanced',
    armor: 3
  },
  'van': {
    size: [3, 2],
    passengers: 6,
    speed: 'slow',
    armor: 4
  }
};

export function createCombatUnit(
  id: string,
  memberId: string,
  name: string,
  role: string,
  x: number,
  y: number,
  isAttacker: boolean
): CombatUnit {
  const stats = UNIT_STATS[role] || UNIT_STATS.soldier;
  
  return {
    id,
    member_id: memberId,
    name,
    role,
    health: stats.health,
    max_health: stats.health,
    position_x: x,
    position_y: y,
    is_revealed: !isAttacker, // Defenders start revealed, attackers hidden
    accuracy: stats.accuracy,
    damage: stats.damage,
    has_acted: false
  };
}

export function createVehicle(type: string): Vehicle {
  const stats = VEHICLE_STATS[type];
  if (!stats) throw new Error(`Unknown vehicle type: ${type}`);
  
  return {
    id: `vehicle_${Date.now()}`,
    type: type as Vehicle['type'],
    size_x: stats.size[0],
    size_y: stats.size[1],
    passenger_capacity: stats.passengers,
    speed: stats.speed,
    armor: stats.armor
  };
}

export function isPositionValid(x: number, y: number, unit?: CombatUnit): boolean {
  if (x < 0 || x > 7 || y < 0 || y > 7) return false;
  
  if (unit) {
    if (unit.role === 'dealer') {
      return (y >= 6 && y <= 7);
    }
  }
  
  return true;
}

export function getUnitsAtPosition(session: CombatSession, x: number, y: number): CombatUnit[] {
  const units = [...session.attacker_units, ...session.defender_units];
  return units.filter(unit => unit.position_x === x && unit.position_y === y);
}

export function isAdjacent(pos1: {x: number, y: number}, pos2: {x: number, y: number}): boolean {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
}

export function updateFogOfWar(session: CombatSession, x: number, y: number): string[] {
  const revealedUnits: string[] = [];
  
  const unitsAtPosition = getUnitsAtPosition(session, x, y);
  unitsAtPosition.forEach(unit => {
    if (!unit.is_revealed) {
      unit.is_revealed = true;
      revealedUnits.push(unit.id);
    }
  });
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      
      const adjX = x + dx;
      const adjY = y + dy;
      
      if (adjX >= 0 && adjX <= 7 && adjY >= 0 && adjY <= 7) {
        const adjacentUnits = getUnitsAtPosition(session, adjX, adjY);
        adjacentUnits.forEach(unit => {
          if (!unit.is_revealed) {
            unit.is_revealed = true;
            revealedUnits.push(unit.id);
          }
        });
      }
    }
  }
  
  return revealedUnits;
}

export function canUnitMove(unit: CombatUnit, targetX: number, targetY: number): boolean {
  if (!isPositionValid(targetX, targetY)) return false;
  
  const dx = Math.abs(unit.position_x - targetX);
  const dy = Math.abs(unit.position_y - targetY);
  
  return (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
}

export function canUnitAttack(unit: CombatUnit, targetX: number, targetY: number, session: CombatSession): boolean {
  if (unit.role === 'dealer') return false;
  if (!isPositionValid(targetX, targetY)) return false;
  
  const unitsAtTarget = getUnitsAtPosition(session, targetX, targetY);
  const enemyUnits = unitsAtTarget.filter(u => 
    (session.attacker_units.includes(unit) ? session.defender_units : session.attacker_units).includes(u)
  );
  
  return enemyUnits.length > 0;
}
