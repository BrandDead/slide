import { describe, expect, it } from 'vitest';
import { createCombatSession, dispatchCombatCommand, getCombatSnapshot } from '../combatSession';
import { CombatSessionController } from '../CombatSessionController';
import type {
  CombatAimRay,
  CombatImpactCandidate,
  Combatant,
  EncounterPreparation,
} from '../types';

const terrain = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => ({
  x,
  y,
  zoneType: 'sidewalk' as const,
  passable: true,
  cover: x === 1 ? 0.5 : 0.1,
  exposure: x === 1 ? 0.25 : 0.65,
})));

function actor(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'crew-1',
    name: 'Lil Dre',
    team: 'crew',
    role: 'shooter',
    position: { x: 0, y: 1 },
    health: 100,
    maxHealth: 100,
    armor: 0,
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
    sessionId: 'aimed-fire-session',
    seed: 1208,
    sceneLabel: '1208 Las Olas',
    locationReference: 'Fictional South Florida reference',
    fictionNotice: 'Fictional scene.',
    terrain,
    crew: [actor({})],
    opposition: [actor({
      id: 'rival-1',
      name: 'Vice Runner',
      team: 'opposition',
      role: 'opposition',
      position: { x: 2, y: 1 },
      health: 100,
      maxHealth: 100,
      armor: 1,
    })],
    objective: {
      kind: 'extract',
      label: 'Reach exit',
      extraction: { x: 0, y: 2 },
      requiredCrew: 1,
      progress: 0,
      target: 1,
    },
    heatAtStart: 2,
    moraleAtStart: 85,
    tacticalBrief: [],
  };
}

function ray(overrides: Partial<CombatAimRay> = {}): CombatAimRay {
  return {
    origin: { x: 0, y: 1.5, z: 0 },
    direction: { x: 1, y: 0, z: 0 },
    maxDistance: 40,
    clientTick: 0,
    ...overrides,
  };
}

function actorImpact(hitZone: 'head' | 'torso' | 'arm' | 'leg'): CombatImpactCandidate {
  return {
    kind: 'actor',
    entityId: 'rival-1',
    hitZone,
    point: { x: 10, y: 1.5, z: 0 },
    distance: 10,
  };
}

function fire(candidate: CombatImpactCandidate) {
  return dispatchCombatCommand(createCombatSession(preparation()), {
    type: 'aim-fire-ray',
    actorId: 'crew-1',
    ray: ray(),
    candidate,
    sequence: 1,
  });
}

describe('renderer-neutral aimed fire', () => {
  it('resolves confirmed physical actor hits deterministically and records hit-zone metadata', () => {
    const first = fire(actorImpact('head'));
    const second = fire(actorImpact('head'));

    expect(getCombatSnapshot(first)).toEqual(getCombatSnapshot(second));
    expect(first.combatants.find((candidate) => candidate.id === 'rival-1')?.health).toBeLessThan(100);
    expect(first.combatants.find((candidate) => candidate.id === 'crew-1')?.ammo).toBe(7);
    expect(first.events.some((event) => event.type === 'impact-actor' && event.hitZone === 'head')).toBe(true);
    expect(first.events.find((event) => event.type === 'weapon-fired')?.impact).toEqual(actorImpact('head'));
  });

  it('makes a confirmed head impact stronger than a torso impact from the same seed', () => {
    const head = fire(actorImpact('head'));
    const torso = fire(actorImpact('torso'));
    const headHealth = head.combatants.find((candidate) => candidate.id === 'rival-1')?.health ?? 100;
    const torsoHealth = torso.combatants.find((candidate) => candidate.id === 'rival-1')?.health ?? 100;

    expect(headHealth).toBeLessThan(torsoHealth);
  });

  it('records physical cover and miss impacts without applying actor damage', () => {
    const cover = fire({
      kind: 'cover',
      entityId: 'cover-1-1',
      point: { x: 8, y: 1.5, z: 0 },
      distance: 8,
    });
    const miss = fire({
      kind: 'miss',
      point: { x: 20, y: 1.5, z: 0 },
      distance: 20,
    });

    expect(cover.events.at(-1)?.type).toBe('impact-cover');
    expect(miss.events.at(-1)?.type).toBe('impact-miss');
    expect(cover.combatants.find((candidate) => candidate.id === 'rival-1')?.health).toBe(100);
    expect(miss.combatants.find((candidate) => candidate.id === 'rival-1')?.health).toBe(100);
    expect(cover.combatants.find((candidate) => candidate.id === 'crew-1')?.ammo).toBe(7);
    expect(miss.combatants.find((candidate) => candidate.id === 'crew-1')?.ammo).toBe(7);
  });

  it('blocks malformed trajectories and friendly-fire target spoofing without consuming ammo', () => {
    const malformed = dispatchCombatCommand(createCombatSession(preparation()), {
      type: 'aim-fire-ray',
      actorId: 'crew-1',
      ray: ray({ direction: { x: 8, y: 0, z: 0 } }),
      candidate: actorImpact('torso'),
      sequence: 1,
    });
    const friendly = dispatchCombatCommand(createCombatSession({
      ...preparation(),
      crew: [actor({}), actor({ id: 'crew-2', name: 'Stacks', position: { x: 1, y: 1 } })],
    }), {
      type: 'aim-fire-ray',
      actorId: 'crew-1',
      ray: ray(),
      candidate: { ...actorImpact('torso'), entityId: 'crew-2' },
      sequence: 1,
    });

    expect(malformed.events.at(-1)?.type).toBe('blocked');
    expect(friendly.events.at(-1)?.type).toBe('blocked');
    expect(malformed.combatants.find((candidate) => candidate.id === 'crew-1')?.ammo).toBe(8);
    expect(friendly.combatants.find((candidate) => candidate.id === 'crew-1')?.ammo).toBe(8);
  });

  it('routes camera-ray fire through the shared controller sequence and cadence', () => {
    const controller = new CombatSessionController(preparation(), 'third-person');
    const first = controller.fireRay(ray(), actorImpact('torso'));
    const blockedByCadence = controller.fireRay(ray(), actorImpact('torso'));

    expect(first.combatants.find((candidate) => candidate.id === 'crew-1')?.ammo).toBe(7);
    expect(blockedByCadence.combatants.find((candidate) => candidate.id === 'crew-1')?.ammo).toBe(7);
    expect(blockedByCadence.events.at(-1)?.type).toBe('blocked');
    controller.dispose();
  });
});
