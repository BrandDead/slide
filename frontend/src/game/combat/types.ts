import type { BlockZoneType, MemberRole } from '../../types/block.types';

export type CombatPhase = 'briefing' | 'active' | 'resolved';
export type CombatTeam = 'crew' | 'opposition';
export type CombatObjectiveKind = 'extract';

export interface GridPoint {
  x: number;
  y: number;
}

export interface CombatTerrainCell extends GridPoint {
  zoneType: BlockZoneType;
  passable: boolean;
  cover: number;
  exposure: number;
}

export interface Combatant {
  id: string;
  name: string;
  team: CombatTeam;
  role: MemberRole | 'opposition';
  position: GridPoint;
  health: number;
  maxHealth: number;
  armor: number;
  ammo: number;
  maxAmmo: number;
  reloadUntilTick: number | null;
  nextFireTick: number;
  level: number;
  lastSequence: number;
  isDown: boolean;
}

export interface CombatObjective {
  kind: CombatObjectiveKind;
  label: string;
  extraction: GridPoint;
  requiredCrew: number;
  progress: number;
  target: number;
}

export type CombatCommand =
  | { type: 'move'; actorId: string; destination: GridPoint; sequence: number }
  | { type: 'aim-fire'; actorId: string; targetId: string; sequence: number }
  | { type: 'reload'; actorId: string; sequence: number }
  | { type: 'interact'; actorId: string; sequence: number }
  | { type: 'retreat'; actorId: string; sequence: number };

export type CombatEventType =
  | 'moved'
  | 'blocked'
  | 'weapon-fired'
  | 'impact-cover'
  | 'impact-actor'
  | 'actor-downed'
  | 'reload-start'
  | 'reload-complete'
  | 'objective-progress'
  | 'risk-changed'
  | 'retreated'
  | 'resolved';

export interface CombatEvent {
  id: string;
  tick: number;
  type: CombatEventType;
  actorId?: string;
  targetId?: string;
  amount?: number;
  message: string;
}

export interface CombatSession {
  id: string;
  seed: number;
  rngState: number;
  tick: number;
  phase: CombatPhase;
  terrain: CombatTerrainCell[][];
  combatants: Combatant[];
  objective: CombatObjective;
  heatAtStart: number;
  moraleAtStart: number;
  events: CombatEvent[];
  result: CombatResult | null;
}

export interface CombatResult {
  idempotencyKey: string;
  outcome: 'secured' | 'retreated' | 'overrun';
  crewDown: string[];
  oppositionDown: string[];
  objectiveProgress: number;
  heatDelta: number;
  moraleDelta: number;
  pendingIncomeDelta: number;
  summary: string;
}

export interface EncounterPreparation {
  sessionId: string;
  seed: number;
  sceneLabel: string;
  locationReference: string;
  fictionNotice: string;
  backgroundUrl?: string;
  terrain: CombatTerrainCell[][];
  crew: Combatant[];
  opposition: Combatant[];
  objective: CombatObjective;
  heatAtStart: number;
  moraleAtStart: number;
  tacticalBrief: string[];
}

export interface CombatSnapshot {
  tick: number;
  phase: CombatPhase;
  combatants: Combatant[];
  objective: CombatObjective;
  events: CombatEvent[];
  result: CombatResult | null;
}
