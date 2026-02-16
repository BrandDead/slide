// ============================================
// DEALT/SLIDE COMBAT SYSTEM - Zustand Store
// Source: qwen3-coder:480b-cloud
// ============================================

import { create } from 'zustand';
import { 
  CombatSession, 
  CombatUnit, 
  CombatAction, 
  TurnResult,
  CombatOutcome 
} from '../types/combatTypes';
import { supabase } from '../services/supabase';

interface CombatState {
  session: CombatSession | null;
  selectedUnit: CombatUnit | null;
  availableActions: ('move' | 'attack' | 'retreat')[];
  validTargets: { x: number; y: number }[];
  turnHistory: TurnResult[];
  isLoading: boolean;
  isProcessingAction: boolean;
  error: string | null;
}

interface CombatActions {
  initiateCombat: (blockId: string, unitIds: string[], vehicleType: string) => Promise<void>;
  selectUnit: (unitId: string) => void;
  performAction: (action: CombatAction) => Promise<TurnResult>;
  endTurn: () => void;
  surrender: () => Promise<void>;
  clearCombat: () => void;
  calculateValidMoves: (unit: CombatUnit) => { x: number; y: number }[];
  calculateValidAttacks: (unit: CombatUnit) => { x: number; y: number }[];
}

export const useCombatStore = create<CombatState & CombatActions>((set, get) => ({
  session: null,
  selectedUnit: null,
  availableActions: [],
  validTargets: [],
  turnHistory: [],
  isLoading: false,
  isProcessingAction: false,
  error: null,

  initiateCombat: async (blockId, unitIds, vehicleType) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase.functions.invoke('combat-initiate', {
        body: {
          target_block_id: blockId,
          attacker_units: unitIds,
          vehicle_type: vehicleType
        }
      });

      if (error) throw error;

      const session: CombatSession = {
        id: data.combat_id,
        attacker_id: '',
        defender_id: '',
        block_id: blockId,
        status: 'active',
        current_turn: 1,
        active_player: 'attacker',
        attacker_units: data.attacker_units.map((u: any, i: number) => ({
          id: u.id,
          member_id: u.id,
          name: u.name,
          role: u.role,
          health: 100,
          max_health: 100,
          position_x: i % 8,
          position_y: 6 + Math.floor(i / 8),
          is_revealed: false,
          accuracy: u.accuracy / 100,
          damage: 25,
          has_acted: false
        })),
        defender_units: data.defender_units.map((u: any, i: number) => ({
          id: u.id,
          member_id: u.id,
          name: u.name,
          role: u.role,
          health: 100,
          max_health: 100,
          position_x: i % 8,
          position_y: Math.floor(i / 8),
          is_revealed: true,
          accuracy: u.accuracy / 100,
          damage: 25,
          has_acted: false
        })),
        vehicle: {
          id: 'vehicle_1',
          type: vehicleType as any,
          size_x: 2,
          size_y: 2,
          passenger_capacity: 4,
          speed: 'balanced',
          armor: 2
        },
        fog_of_war: Array(8).fill(null).map(() => Array(8).fill(false)),
        turns: []
      };

      set({ session, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  selectUnit: (unitId) => {
    const { session } = get();
    if (!session) return;

    const allUnits = [...session.attacker_units, ...session.defender_units];
    const unit = allUnits.find(u => u.id === unitId);
    
    if (!unit || unit.has_acted) {
      set({ selectedUnit: null, availableActions: [], validTargets: [] });
      return;
    }

    const validMoves = get().calculateValidMoves(unit);
    const validAttacks = get().calculateValidAttacks(unit);
    
    const actions: ('move' | 'attack' | 'retreat')[] = [];
    if (validMoves.length > 0) actions.push('move');
    if (validAttacks.length > 0) actions.push('attack');
    if (session.attacker_units.includes(unit)) actions.push('retreat');

    set({ 
      selectedUnit: unit, 
      availableActions: actions,
      validTargets: [...validMoves, ...validAttacks]
    });
  },

  performAction: async (action) => {
    const { session } = get();
    if (!session) throw new Error('No active combat');

    set({ isProcessingAction: true });

    try {
      const { data, error } = await supabase.functions.invoke(`combat-${session.id}-action`, {
        body: action
      });

      if (error) throw error;

      const result: TurnResult = data.turn_result;
      
      if (result.success) {
        const updateUnits = (units: CombatUnit[]) => 
          units.map(u => u.id === action.unit_id ? { ...u, has_acted: true } : u);
        
        set(state => ({
          session: state.session ? {
            ...state.session,
            attacker_units: updateUnits(state.session.attacker_units),
            defender_units: updateUnits(state.session.defender_units)
          } : null,
          turnHistory: [...state.turnHistory, result],
          selectedUnit: null,
          availableActions: [],
          validTargets: []
        }));
      }

      set({ isProcessingAction: false });
      return result;
    } catch (error: any) {
      set({ error: error.message, isProcessingAction: false });
      throw error;
    }
  },

  endTurn: () => {
    set(state => {
      if (!state.session) return state;
      
      const resetUnits = (units: CombatUnit[]) => 
        units.map(u => ({ ...u, has_acted: false }));
      
      return {
        session: {
          ...state.session,
          active_player: state.session.active_player === 'attacker' ? 'defender' : 'attacker',
          current_turn: state.session.active_player === 'defender' 
            ? state.session.current_turn + 1 
            : state.session.current_turn,
          attacker_units: resetUnits(state.session.attacker_units),
          defender_units: resetUnits(state.session.defender_units)
        },
        selectedUnit: null,
        availableActions: [],
        validTargets: []
      };
    });
  },

  surrender: async () => {
    const { session } = get();
    if (!session) return;

    await supabase.functions.invoke(`combat-${session.id}-action`, {
      body: { action_type: 'retreat', unit_id: 'all' }
    });

    set({ 
      session: { ...session, status: 'ended', outcome: { winner: 'defender', reason: 'retreat', survivors: [] } }
    });
  },

  clearCombat: () => {
    set({
      session: null,
      selectedUnit: null,
      availableActions: [],
      validTargets: [],
      turnHistory: [],
      error: null
    });
  },

  calculateValidMoves: (unit) => {
    const { session } = get();
    if (!session) return [];

    const validPositions: { x: number; y: number }[] = [];
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        
        const newX = unit.position_x + dx;
        const newY = unit.position_y + dy;
        
        if (newX >= 0 && newX <= 7 && newY >= 0 && newY <= 7) {
          const occupied = [...session.attacker_units, ...session.defender_units]
            .some(u => u.position_x === newX && u.position_y === newY && u.health > 0);
          
          if (!occupied) {
            validPositions.push({ x: newX, y: newY });
          }
        }
      }
    }
    
    return validPositions;
  },

  calculateValidAttacks: (unit) => {
    const { session } = get();
    if (!session || unit.role === 'dealer') return [];

    const isAttacker = session.attacker_units.includes(unit);
    const enemies = isAttacker ? session.defender_units : session.attacker_units;
    
    return enemies
      .filter(e => e.is_revealed && e.health > 0)
      .map(e => ({ x: e.position_x, y: e.position_y }));
  }
}));
