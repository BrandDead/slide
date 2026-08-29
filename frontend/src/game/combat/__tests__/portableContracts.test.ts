import { describe, expect, it } from 'vitest';
import {
  stableEncounterReplayHash,
  toEncounterPackageV1,
  toEncounterResultV1,
} from '../portableContracts';
import type { CombatResult, Combatant, EncounterPreparation } from '../types';

const terrain = Array.from({ length: 2 }, (_, y) => Array.from({ length: 2 }, (_, x) => ({
  x,
  y,
  zoneType: y === 0 ? 'street' as const : 'sidewalk' as const,
  passable: true,
  cover: x === 1 ? 0.6 : 0.1,
  exposure: y === 0 ? 0.9 : 0.3,
})));

function actor(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'crew-1',
    name: 'Lil Dre',
    team: 'crew',
    role: 'shooter',
    position: { x: 0, y: 0 },
    health: 100,
    maxHealth: 100,
    armor: 1,
    ammo: 8,
    maxAmmo: 8,
    reloadUntilTick: null,
    nextFireTick: 0,
    level: 4,
    lastSequence: -1,
    isDown: false,
    ...overrides,
  };
}

function preparation(): EncounterPreparation {
  return {
    sessionId: 'encounter-1208-las-olas-001',
    seed: 1208,
    sceneLabel: '1208 Las Olas — Night Strip',
    locationReference: 'Fictional South Florida reference',
    fictionNotice: 'Fictionalized location and characters.',
    terrain,
    crew: [actor({})],
    opposition: [actor({
      id: 'rival-1',
      name: 'Vice Runner',
      team: 'opposition',
      role: 'opposition',
      position: { x: 1, y: 1 },
      health: 70,
      maxHealth: 70,
    })],
    objective: {
      kind: 'extract',
      label: 'Secure the exit',
      extraction: { x: 0, y: 1 },
      requiredCrew: 1,
      progress: 0,
      target: 1,
    },
    heatAtStart: 2,
    moraleAtStart: 85,
    tacticalBrief: [],
  };
}

const securedResult: CombatResult = {
  idempotencyKey: 'encounter-1208-las-olas-001:secured',
  outcome: 'secured',
  crewDown: [],
  oppositionDown: ['rival-1'],
  objectiveProgress: 1,
  heatDelta: 1,
  moraleDelta: 4,
  pendingIncomeDelta: 75,
  summary: 'Secure exit reached.',
};

describe('portable encounter contracts', () => {
  it('creates the same JSON-safe encounter package from the same preparation', () => {
    const first = toEncounterPackageV1(preparation(), {
      blockId: '1208-las-olas',
      weaponIdByActor: { 'crew-1': 'weapon.compact-rifle.v1' },
    });
    const second = toEncounterPackageV1(preparation(), {
      blockId: '1208-las-olas',
      weaponIdByActor: { 'crew-1': 'weapon.compact-rifle.v1' },
    });

    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(1);
    expect(first.extraction).toEqual(first.objective.extraction);
    expect(first.loadout).toEqual([
      { actorId: 'crew-1', weaponId: 'weapon.compact-rifle.v1', ammoAtStart: 8 },
      { actorId: 'rival-1', weaponId: 'weapon.service-pistol.v1', ammoAtStart: 8 },
    ]);
  });

  it('creates a stable replay identity and computes authority-owned consequences', () => {
    const encounter = toEncounterPackageV1(preparation(), { blockId: '1208-las-olas' });
    const first = toEncounterResultV1(securedResult, {
      package: encounter,
      ammoAtEnd: { 'crew-1': 5, 'rival-1': 6 },
      capturedBlock: true,
    });
    const second = toEncounterResultV1(securedResult, {
      package: encounter,
      ammoAtEnd: { 'crew-1': 5, 'rival-1': 6 },
      capturedBlock: true,
    });

    expect(first).toEqual(second);
    expect(first.replayHash).toMatch(/^[a-f0-9]{8}$/);
    expect(first.replayHash).toBe(stableEncounterReplayHash(encounter, securedResult));
    expect(first.ammoConsumed).toEqual({ 'crew-1': 3, 'rival-1': 2 });
    expect(first.capturedBlock).toBe(true);
  });

  it('derives treatment-required injuries from downed crew by default', () => {
    const encounter = toEncounterPackageV1(preparation(), { blockId: '1208-las-olas' });
    const result = toEncounterResultV1({
      ...securedResult,
      outcome: 'overrun',
      crewDown: ['crew-1'],
      oppositionDown: [],
    }, { package: encounter });

    expect(result.injuries).toEqual([
      { memberId: 'crew-1', severity: 'serious', treatmentRequired: true },
    ]);
  });
});
