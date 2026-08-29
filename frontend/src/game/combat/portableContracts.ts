import type {
  CombatObjective,
  CombatResult,
  CombatTerrainCell,
  Combatant,
  EncounterPreparation,
  GridPoint,
} from './types';

export interface EncounterLoadoutEntry {
  actorId: string;
  weaponId: string;
  ammoAtStart: number;
}

export interface EncounterPackageV1 {
  schemaVersion: 1;
  encounterId: string;
  blockId: string;
  sceneLabel: string;
  locationReference: string;
  seed: number;
  terrain: CombatTerrainCell[][];
  crew: Combatant[];
  opposition: Combatant[];
  loadout: EncounterLoadoutEntry[];
  objective: CombatObjective;
  extraction: GridPoint;
  heatAtStart: number;
  moraleAtStart: number;
}

export interface EncounterInjury {
  memberId: string;
  severity: 'minor' | 'serious' | 'critical';
  treatmentRequired: boolean;
}

export interface EncounterInventoryDelta {
  itemId: string;
  quantityDelta: number;
  reason: 'consumed' | 'lost' | 'recovered' | 'rewarded' | 'seized';
}

export interface EncounterResultV1 {
  schemaVersion: 1;
  encounterId: string;
  idempotencyKey: string;
  outcome: CombatResult['outcome'];
  crewDown: string[];
  oppositionDown: string[];
  injuries: EncounterInjury[];
  ammoConsumed: Record<string, number>;
  inventoryChanges: EncounterInventoryDelta[];
  heatDelta: number;
  moraleDelta: number;
  pendingIncomeDelta: number;
  capturedBlock: boolean;
  replayHash: string;
  summary: string;
}

export interface EncounterPackageOptions {
  blockId: string;
  weaponIdByActor?: Readonly<Record<string, string>>;
  defaultWeaponId?: string;
}

const DEFAULT_WEAPON_ID = 'weapon.service-pistol.v1';

export function toEncounterPackageV1(
  preparation: EncounterPreparation,
  options: EncounterPackageOptions,
): EncounterPackageV1 {
  const allActors = [...preparation.crew, ...preparation.opposition];
  const defaultWeaponId = options.defaultWeaponId ?? DEFAULT_WEAPON_ID;
  return {
    schemaVersion: 1,
    encounterId: preparation.sessionId,
    blockId: options.blockId,
    sceneLabel: preparation.sceneLabel,
    locationReference: preparation.locationReference,
    seed: preparation.seed >>> 0,
    terrain: preparation.terrain,
    crew: preparation.crew,
    opposition: preparation.opposition,
    loadout: allActors.map((actor) => ({
      actorId: actor.id,
      weaponId: options.weaponIdByActor?.[actor.id] ?? defaultWeaponId,
      ammoAtStart: actor.ammo,
    })),
    objective: preparation.objective,
    extraction: preparation.objective.extraction,
    heatAtStart: preparation.heatAtStart,
    moraleAtStart: preparation.moraleAtStart,
  };
}

export interface EncounterResultOptions {
  package: EncounterPackageV1;
  ammoAtEnd?: Readonly<Record<string, number>>;
  injuries?: EncounterInjury[];
  inventoryChanges?: EncounterInventoryDelta[];
  capturedBlock?: boolean;
  replayHash?: string;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function stableEncounterReplayHash(
  encounter: EncounterPackageV1,
  result: CombatResult,
): string {
  const replayIdentity = JSON.stringify({
    schemaVersion: encounter.schemaVersion,
    encounterId: encounter.encounterId,
    seed: encounter.seed,
    outcome: result.outcome,
    crewDown: [...result.crewDown].sort(),
    oppositionDown: [...result.oppositionDown].sort(),
    objectiveProgress: result.objectiveProgress,
    heatDelta: result.heatDelta,
    moraleDelta: result.moraleDelta,
    pendingIncomeDelta: result.pendingIncomeDelta,
  });
  return fnv1a(replayIdentity);
}

export function toEncounterResultV1(
  result: CombatResult,
  options: EncounterResultOptions,
): EncounterResultV1 {
  const ammoAtEnd = options.ammoAtEnd ?? {};
  const ammoConsumed = Object.fromEntries(
    options.package.loadout.map((entry) => [
      entry.actorId,
      Math.max(0, entry.ammoAtStart - (ammoAtEnd[entry.actorId] ?? entry.ammoAtStart)),
    ]),
  );
  const injuries = options.injuries ?? result.crewDown.map((memberId) => ({
    memberId,
    severity: 'serious' as const,
    treatmentRequired: true,
  }));

  return {
    schemaVersion: 1,
    encounterId: options.package.encounterId,
    idempotencyKey: result.idempotencyKey,
    outcome: result.outcome,
    crewDown: [...result.crewDown],
    oppositionDown: [...result.oppositionDown],
    injuries,
    ammoConsumed,
    inventoryChanges: options.inventoryChanges ?? [],
    heatDelta: result.heatDelta,
    moraleDelta: result.moraleDelta,
    pendingIncomeDelta: result.pendingIncomeDelta,
    capturedBlock: options.capturedBlock ?? false,
    replayHash: options.replayHash ?? stableEncounterReplayHash(options.package, result),
    summary: result.summary,
  };
}
