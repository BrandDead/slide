// ============================================================
// slide.types.ts - Types for the SLIDE (Battleship) combat system
// Includes both the macro grid (block defense) and micro grid (vehicle targeting)
// ============================================================

import type { MacroCoord, MicroCoord, Vehicle, VehiclePart } from '../utils/dualGrid';
import type { MacroPattern } from '../utils/attackPatterns';
import type { DriveBySeat } from '../utils/turnLogic';

// ============ GAME PHASES ============
export type SlidePhase =
  | 'setup'          // Defender places units on macro grid
  | 'attacker_turn'  // Attacker (car) picks macro targets
  | 'defender_turn'  // Defender shoots at micro (car) grid
  | 'resolution'     // Animate results
  | 'finished';      // Game over

// ============ PLAYER ROLES ============
export type SlideRole = 'attacker' | 'defender';

// ============ UNIT TYPES ON THE BLOCK ============
export type BlockUnitType = 'dealer' | 'shooter' | 'enforcer' | 'pitbull' | 'trap';

export interface BlockUnit {
  id: string;
  type: BlockUnitType;
  memberId: string;       // Reference to gang member
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  accuracy: number;        // 0-100, affects hit chance
  position: MacroCoord;
  isAlive: boolean;
  canCounterAttack: boolean;
  // Risk/reward positioning
  streetProximity: number; // 0 = far from street (safe), 7 = on the street (risky but profitable)
  incomeMultiplier: number; // Based on streetProximity
}

// ============ ATTACKER VEHICLE ============
export interface AttackerVehicle extends Vehicle {
  speed: number;
  armor: number;
  weaponTier: number;     // Determines available patterns
  passengers: {
    seat: DriveBySeat;
    memberId: string;
    name: string;
    accuracy: number;
    weaponPattern: MacroPattern;
  }[];
}

// ============ SHOT RECORDS ============
export interface AttackerShot {
  seat: DriveBySeat;
  target: MacroCoord;
  pattern: MacroPattern;
  timestamp: number;
}

export interface DefenderShot {
  shooterId: string;
  target: MicroCoord;
  timestamp: number;
}

// ============ TURN RESULT ============
export interface TurnResult {
  turnNumber: number;
  phase: 'attacker' | 'defender';
  shots: (AttackerShot | DefenderShot)[];
  hits: {
    targetId: string;
    damage: number;
    killed: boolean;
    part?: VehiclePart;
  }[];
  heatGenerated: number;
  moneyLost: number;
}

// ============ GAME STATE ============
export interface SlideGameState {
  id: string;
  blockId: string;
  attackerId: string;
  defenderId: string;
  phase: SlidePhase;
  currentTurn: number;
  maxTurns: number;

  // Grids
  defenderUnits: BlockUnit[];
  attackerVehicle: AttackerVehicle;

  // Turn history
  turnHistory: TurnResult[];

  // Scoring
  attackerScore: number;
  defenderScore: number;

  // Heat accumulated during combat
  combatHeat: number;

  // Winner
  winner?: SlideRole;
  endReason?: 'all_units_dead' | 'vehicle_destroyed' | 'max_turns' | 'retreat';
}

// ============ PLACEMENT RULES ============
export interface PlacementRule {
  unitType: BlockUnitType;
  maxCount: number;
  size: number;           // How many macro tiles it occupies
  canPlaceOnStreet: boolean;
  canPlaceOnBuilding: boolean;
  canPlaceOnAlley: boolean;
}

export const PLACEMENT_RULES: Record<BlockUnitType, PlacementRule> = {
  dealer: {
    unitType: 'dealer',
    maxCount: 4,
    size: 1,
    canPlaceOnStreet: true,
    canPlaceOnBuilding: true,
    canPlaceOnAlley: true,
  },
  shooter: {
    unitType: 'shooter',
    maxCount: 3,
    size: 1,
    canPlaceOnStreet: true,
    canPlaceOnBuilding: true,
    canPlaceOnAlley: true,
  },
  enforcer: {
    unitType: 'enforcer',
    maxCount: 2,
    size: 1,
    canPlaceOnStreet: true,
    canPlaceOnBuilding: true,
    canPlaceOnAlley: false,
  },
  pitbull: {
    unitType: 'pitbull',
    maxCount: 2,
    size: 1,
    canPlaceOnStreet: false,
    canPlaceOnBuilding: true,
    canPlaceOnAlley: true,
  },
  trap: {
    unitType: 'trap',
    maxCount: 3,
    size: 1,
    canPlaceOnStreet: true,
    canPlaceOnBuilding: false,
    canPlaceOnAlley: true,
  },
};

// ============ INCOME CALCULATION ============
/**
 * Street proximity affects income:
 * Row 0 (street): 2.0x income, but 90% chance of being hit
 * Row 1: 1.5x income, 70% chance
 * Row 2: 1.2x income, 50% chance
 * Row 3: 1.0x income, 30% chance
 * Row 4+: 0.8x income, 15% chance
 */
export const STREET_PROXIMITY_TABLE: { incomeMultiplier: number; hitChance: number }[] = [
  { incomeMultiplier: 2.0, hitChance: 0.90 },
  { incomeMultiplier: 1.5, hitChance: 0.70 },
  { incomeMultiplier: 1.2, hitChance: 0.50 },
  { incomeMultiplier: 1.0, hitChance: 0.30 },
  { incomeMultiplier: 0.8, hitChance: 0.15 },
  { incomeMultiplier: 0.7, hitChance: 0.10 },
  { incomeMultiplier: 0.6, hitChance: 0.05 },
  { incomeMultiplier: 0.5, hitChance: 0.02 },
];
