// ============================================
// DEALT/SLIDE COMBAT SYSTEM - Service
// Source: qwen3-coder:480b-cloud
// ============================================

import { 
  CombatSession, 
  CombatUnit, 
  CombatAction, 
  TurnResult, 
  CombatOutcome,
  Vehicle
} from '../types/combatTypes';
import { 
  UNIT_STATS, 
  VEHICLE_STATS, 
  createCombatUnit, 
  createVehicle, 
  isPositionValid, 
  getUnitsAtPosition, 
  isAdjacent, 
  updateFogOfWar,
  canUnitMove,
  canUnitAttack
} from '../utils/combatUtils';

export class CombatService {
  private sessions: Map<string, CombatSession> = new Map();

  initiateCombat(
    attackerId: string, 
    blockId: string, 
    units: {id: string, memberId: string, name: string, role: string}[], 
    vehicleType: string
  ): CombatSession {
    const vehicle = createVehicle(vehicleType);
    
    if (units.length > vehicle.passenger_capacity) {
      throw new Error(`Too many units for vehicle capacity of ${vehicle.passenger_capacity}`);
    }
    
    const attackerUnits: CombatUnit[] = units.map((unit, index) => {
      const x = index % 8;
      const y = index < 8 ? 6 : 7;
      return createCombatUnit(unit.id, unit.memberId, unit.name, unit.role, x, y, true);
    });
    
    const sessionId = `combat_${Date.now()}`;
    const session: CombatSession = {
      id: sessionId,
      attacker_id: attackerId,
      defender_id: `defender_${blockId}`,
      block_id: blockId,
      status: 'setup',
      current_turn: 0,
      active_player: 'attacker',
      attacker_units: attackerUnits,
      defender_units: [],
      vehicle,
      fog_of_war: Array(8).fill(null).map(() => Array(8).fill(false)),
      turns: []
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  setupDefenderUnits(
    combatId: string, 
    units: {id: string, memberId: string, name: string, role: string}[]
  ): void {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new Error(`Combat session ${combatId} not found`);
    }
    
    const defenderUnits: CombatUnit[] = units.map((unit, index) => {
      const x = index % 8;
      const y = index < 8 ? 0 : 1;
      return createCombatUnit(unit.id, unit.memberId, unit.name, unit.role, x, y, false);
    });
    
    session.defender_units = defenderUnits;
    session.status = 'active';
  }

  processAction(combatId: string, action: CombatAction): TurnResult {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new Error(`Combat session ${combatId} not found`);
    }
    
    if (session.status !== 'active') {
      throw new Error('Combat is not active');
    }

    const allUnits = [...session.attacker_units, ...session.defender_units];
    const unit = allUnits.find(u => u.id === action.unit_id);
    
    if (!unit) {
      throw new Error(`Unit ${action.unit_id} not found`);
    }
    
    if (unit.has_acted) {
      throw new Error(`Unit ${action.unit_id} has already acted this turn`);
    }
    
    if (unit.health <= 0) {
      throw new Error(`Unit ${action.unit_id} is dead`);
    }

    let result: TurnResult;
    
    switch (action.action_type) {
      case 'move':
        result = this.processMoveAction(session, unit, action);
        break;
      case 'attack':
        result = this.processAttackAction(session, unit, action);
        break;
      case 'retreat':
        result = this.processRetreatAction(session, unit);
        break;
      default:
        throw new Error(`Unknown action type: ${action.action_type}`);
    }
    
    if (result.success) {
      unit.has_acted = true;
    }
    
    // Check for combat end
    const outcome = this.checkCombatEnd(session);
    if (outcome) {
      session.status = 'ended';
      session.outcome = outcome;
      result.combat_ended = true;
      result.outcome = outcome;
      this.applyCombatResult(session);
    }
    
    // Check turn end
    this.checkTurnEnd(session);
    
    // Log turn
    if (!session.turns[session.current_turn]) {
      session.turns[session.current_turn] = {
        turn_number: session.current_turn,
        actions: []
      };
    }
    session.turns[session.current_turn].actions.push(result);
    
    return result;
  }

  private processMoveAction(session: CombatSession, unit: CombatUnit, action: CombatAction): TurnResult {
    const targetX = action.target_x!;
    const targetY = action.target_y!;
    
    if (!canUnitMove(unit, targetX, targetY)) {
      return { action, success: false, combat_ended: false };
    }
    
    // Check for collision
    const unitsAtTarget = getUnitsAtPosition(session, targetX, targetY);
    if (unitsAtTarget.length > 0) {
      return { action, success: false, combat_ended: false };
    }
    
    unit.position_x = targetX;
    unit.position_y = targetY;
    
    // Reveal adjacent units
    const positionsRevealed = updateFogOfWar(session, targetX, targetY);
    
    return {
      action,
      success: true,
      positions_revealed: positionsRevealed,
      combat_ended: false
    };
  }

  private processAttackAction(session: CombatSession, unit: CombatUnit, action: CombatAction): TurnResult {
    const targetUnitId = action.target_unit_id;
    if (!targetUnitId) {
      return { action, success: false, combat_ended: false };
    }
    
    const allUnits = [...session.attacker_units, ...session.defender_units];
    const targetUnit = allUnits.find(u => u.id === targetUnitId);
    
    if (!targetUnit || targetUnit.health <= 0) {
      return { action, success: false, combat_ended: false };
    }
    
    if (!canUnitAttack(unit, targetUnit.position_x, targetUnit.position_y, session)) {
      return { action, success: false, combat_ended: false };
    }
    
    const hit = this.calculateHit(unit, targetUnit);
    
    if (!hit) {
      return { action, success: true, combat_ended: false };
    }
    
    const damage = this.calculateDamage(unit, targetUnit);
    targetUnit.health -= damage;
    
    let positionsRevealed: string[] = [];
    if (!unit.is_revealed) {
      unit.is_revealed = true;
      positionsRevealed.push(unit.id);
      const adjRevealed = updateFogOfWar(session, unit.position_x, unit.position_y);
      positionsRevealed = [...positionsRevealed, ...adjRevealed];
    }
    
    if (!targetUnit.is_revealed) {
      targetUnit.is_revealed = true;
      positionsRevealed.push(targetUnit.id);
    }
    
    const targetDestroyed = targetUnit.health <= 0;
    
    return {
      action,
      success: true,
      damage_dealt: damage,
      target_destroyed: targetDestroyed,
      positions_revealed: positionsRevealed,
      combat_ended: false
    };
  }

  private processRetreatAction(session: CombatSession, unit: CombatUnit): TurnResult {
    if (!session.attacker_units.includes(unit)) {
      return {
        action: { unit_id: unit.id, action_type: 'retreat' },
        success: false,
        combat_ended: false
      };
    }
    
    session.attacker_units = session.attacker_units.filter(u => u.id !== unit.id);
    
    return {
      action: { unit_id: unit.id, action_type: 'retreat' },
      success: true,
      combat_ended: true,
      outcome: {
        winner: 'defender',
        reason: 'retreat',
        survivors: [
          ...session.defender_units.map(u => u.id), 
          ...session.attacker_units.map(u => u.id)
        ]
      }
    };
  }

  calculateHit(attacker: CombatUnit, defender: CombatUnit): boolean {
    return Math.random() < attacker.accuracy;
  }

  calculateDamage(attacker: CombatUnit, defender: CombatUnit): number {
    const damageMultiplier = 0.8 + Math.random() * 0.4;
    return Math.round(attacker.damage * damageMultiplier);
  }

  checkCombatEnd(session: CombatSession): CombatOutcome | null {
    const livingAttackers = session.attacker_units.filter(u => u.health > 0);
    if (livingAttackers.length === 0) {
      return {
        winner: 'defender',
        reason: 'elimination',
        survivors: session.defender_units.filter(u => u.health > 0).map(u => u.id)
      };
    }
    
    const livingDefenders = session.defender_units.filter(u => u.health > 0);
    if (livingDefenders.length === 0) {
      return {
        winner: 'attacker',
        reason: 'elimination',
        survivors: livingAttackers.map(u => u.id)
      };
    }
    
    if (session.current_turn >= 20) {
      return {
        winner: 'draw',
        reason: 'turn_limit',
        survivors: [
          ...livingAttackers.map(u => u.id),
          ...livingDefenders.map(u => u.id)
        ]
      };
    }
    
    return null;
  }

  private checkTurnEnd(session: CombatSession): void {
    const currentPlayerUnits = session.active_player === 'attacker' 
      ? session.attacker_units 
      : session.defender_units;
    
    const allActed = currentPlayerUnits.every(u => u.has_acted || u.health <= 0);
    
    if (allActed) {
      [...session.attacker_units, ...session.defender_units].forEach(u => {
        u.has_acted = false;
      });
      
      session.active_player = session.active_player === 'attacker' ? 'defender' : 'attacker';
      
      if (session.active_player === 'attacker') {
        session.current_turn++;
      }
    }
  }

  applyCombatResult(session: CombatSession): void {
    console.log(`Combat ${session.id} ended:`, session.outcome);
    // TODO: Update database with results
  }

  getCombatSession(id: string): CombatSession | undefined {
    return this.sessions.get(id);
  }
}

export const combatService = new CombatService();
