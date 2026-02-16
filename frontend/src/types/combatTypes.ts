// ============================================
// DEALT/SLIDE COMBAT SYSTEM - Types
// Source: qwen3-coder:480b-cloud
// ============================================

export interface CombatSession {
  id: string;
  attacker_id: string;
  defender_id: string;
  block_id: string;
  status: 'setup' | 'active' | 'ended';
  current_turn: number;
  active_player: 'attacker' | 'defender';
  attacker_units: CombatUnit[];
  defender_units: CombatUnit[];
  vehicle: Vehicle;
  fog_of_war: boolean[][];
  turns: TurnLog[];
  outcome?: CombatOutcome;
}

export interface CombatUnit {
  id: string;
  member_id: string;
  name: string;
  role: string;
  health: number;
  max_health: number;
  position_x: number;
  position_y: number;
  is_revealed: boolean;
  accuracy: number;
  damage: number;
  has_acted: boolean;
}

export interface Vehicle {
  id: string;
  type: '2-door' | '4-door' | 'suv' | 'van';
  size_x: number;
  size_y: number;
  passenger_capacity: number;
  speed: 'fast' | 'balanced' | 'slow';
  armor: number;
}

export interface CombatAction {
  unit_id: string;
  action_type: 'move' | 'attack' | 'retreat';
  target_x?: number;
  target_y?: number;
  target_unit_id?: string;
}

export interface TurnLog {
  turn_number: number;
  actions: TurnResult[];
}

export interface TurnResult {
  action: CombatAction;
  success: boolean;
  damage_dealt?: number;
  target_destroyed?: boolean;
  positions_revealed?: string[];
  combat_ended?: boolean;
  outcome?: CombatOutcome;
}

export interface CombatOutcome {
  winner: 'attacker' | 'defender' | 'draw';
  reason: 'elimination' | 'retreat' | 'turn_limit';
  survivors: string[];
}

export interface UnitStats {
  [role: string]: {
    health: number;
    accuracy: number;
    damage: number;
  };
}

export interface VehicleStats {
  [type: string]: {
    size: [number, number];
    passengers: number;
    speed: 'fast' | 'balanced' | 'slow';
    armor: number;
  };
}
