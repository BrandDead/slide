import { describe, expect, it } from 'vitest';
import { advanceCombat, createCombatSession, dispatchCombatCommand, getCombatSnapshot } from '../combatSession';
import { prepareEncounter } from '../prepareEncounter';
import { apiBlockToBlockData } from '../../../utils/blockMappers';
import type { BlockData } from '../../../types/block.types';
import type { Combatant, EncounterPreparation } from '../types';

const terrain = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => ({
  x,
  y,
  zoneType: 'sidewalk' as const,
  passable: true,
  cover: x === 1 ? 0.65 : 0.2,
  exposure: x === 1 ? 0.2 : 0.7,
})));

function actor(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'crew-1',
    name: 'Scout',
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
    level: 1,
    lastSequence: -1,
    isDown: false,
    ...overrides,
  };
}

function preparation(): EncounterPreparation {
  return {
    sessionId: 'test-session',
    seed: 42,
    sceneLabel: 'Test Strip',
    locationReference: 'Fictional reference',
    fictionNotice: 'Fictional scene.',
    terrain,
    crew: [actor({})],
    opposition: [actor({
      id: 'opposition-1',
      name: 'Lookout',
      team: 'opposition',
      role: 'opposition',
      position: { x: 2, y: 0 },
      health: 55,
      maxHealth: 55,
    })],
    objective: {
      kind: 'extract',
      label: 'Reach exit',
      extraction: { x: 0, y: 2 },
      requiredCrew: 1,
      progress: 0,
      target: 1,
    },
    heatAtStart: 1,
    moraleAtStart: 80,
    tacticalBrief: [],
  };
}

describe('CombatSession', () => {
  it('resolves the same command sequence deterministically from the same seed', () => {
    const first = dispatchCombatCommand(createCombatSession(preparation()), {
      type: 'aim-fire', actorId: 'crew-1', targetId: 'opposition-1', sequence: 1,
    });
    const second = dispatchCombatCommand(createCombatSession(preparation()), {
      type: 'aim-fire', actorId: 'crew-1', targetId: 'opposition-1', sequence: 1,
    });

    expect(getCombatSnapshot(first)).toEqual(getCombatSnapshot(second));
  });

  it('requires a valid adjacent route before moving', () => {
    const session = createCombatSession(preparation());
    const invalid = dispatchCombatCommand(session, {
      type: 'move', actorId: 'crew-1', destination: { x: 2, y: 2 }, sequence: 1,
    });

    expect(invalid.combatants[0].position).toEqual({ x: 0, y: 1 });
    expect(invalid.events.at(-1)?.type).toBe('blocked');
  });

  it('allows the crew to reach the exit and resolves a secured result', () => {
    const moved = dispatchCombatCommand(createCombatSession(preparation()), {
      type: 'move', actorId: 'crew-1', destination: { x: 0, y: 2 }, sequence: 1,
    });
    const resolved = dispatchCombatCommand(moved, {
      type: 'interact', actorId: 'crew-1', sequence: 2,
    });

    expect(resolved.phase).toBe('resolved');
    expect(resolved.result?.outcome).toBe('secured');
    expect(resolved.result?.idempotencyKey).toBe('test-session:secured');
  });

  it('turns a claimed location archetype into deterministic terrain and a fallback scene brief', () => {
    const block = apiBlockToBlockData({
      id: 'alley-reference', address: '6200 NW 17th Ave', lat: 25.8487, lng: -80.2298,
      placements: [], heat: 1, morale: 70,
      topdownBgUrl: '/assets/reference.webp',
    });

    const first = prepareEncounter(block);
    const second = prepareEncounter(block);

    expect(first.seed).toBe(second.seed);
    expect(first.terrain[2][0].zoneType).toBe('alley');
    expect(first.backgroundUrl).toBe('/assets/reference.webp');
    expect(first.objective.extraction).not.toEqual(first.crew[0].position);
    expect(first.tacticalBrief[0]).toContain('Liberty City Alley');
  });

  it('carries a batch-one harbor archetype into the existing encounter terrain and tactical brief', () => {
    const harborBlock = apiBlockToBlockData({
      id: 'harbor-reference', address: 'Freight Spur & Dockside Ave', lat: 25.7752, lng: -80.1748,
      dnaId: 'harbor-spur', placements: [], heat: 2, morale: 64,
    });

    const preparation = prepareEncounter(harborBlock);

    expect(preparation.terrain[2][0].zoneType).toBe('parking');
    expect(preparation.terrain[5][0].zoneType).toBe('alley');
    expect(preparation.tacticalBrief[0]).toContain('Harbor Spur');
  });

  it('keeps an owned block’s stored DNA terrain stable as the catalog grows', () => {
    const storedCanalBlock = apiBlockToBlockData({
      id: 'stable-canal-reference', address: '1 Broadway, New York, NY 10004', lat: 40.7128, lng: -74.006,
      placements: [], heat: 1, morale: 70, dnaId: 'canal-court',
    });

    const preparation = prepareEncounter(storedCanalBlock);

    expect(preparation.sceneLabel).toBe('Canal Court');
    expect(preparation.terrain[3][0].zoneType).toBe('alley');
    expect(preparation.terrain[5][0].zoneType).toBe('parking');
  });

  it('uses exact canonical cover and visibility without reapplying DNA balance', () => {
    const grid = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({
      x,
      y,
      zoneType: 'sidewalk' as const,
      incomeModifier: 60,
      exposureRisk: x === 2 && y === 3 ? 83 : 50,
      coverScore: x === 2 && y === 3 ? 0.17 : 0.3,
      passable: true,
      occupantId: null,
    })));
    const canonicalBlock: BlockData = {
      id: 'canonical-terrain', address: 'Fictional Harbor Reference', lat: 25.7752, lng: -80.1748,
      owner: 'player', grid, gridSource: 'server', globalCoverBonus: 0.2,
      placements: [], incomePerTick: 0, heat: 1, morale: 70, members: 0,
      viewMode: 'topdown', pendingIncome: 0, dnaId: 'harbor-spur',
    };

    const encounter = prepareEncounter(canonicalBlock);

    expect(encounter.terrain[3][2]).toEqual({
      x: 2,
      y: 3,
      zoneType: 'sidewalk',
      passable: true,
      cover: 0.17,
      exposure: 0.83,
    });
  });

  it('carries every saved living defender allowed by Block DNA into the encounter', () => {
    const grid = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({
      x, y, zoneType: 'sidewalk' as const, incomeModifier: 60, exposureRisk: 50,
      coverScore: 0.3, passable: true, occupantId: null,
    })));
    const placements = Array.from({ length: 6 }, (_, index) => ({
      memberId: `crew-${index + 1}`,
      memberName: `Crew ${index + 1}`,
      role: 'shooter' as const,
      x: index,
      y: 2,
      zoneType: 'sidewalk' as const,
      incomePerTick: 0,
      exposureRisk: 50,
      level: 1,
      health: 100,
    }));
    const block: BlockData = {
      id: 'six-defenders', address: 'Fictional Six Defender Block', lat: 0, lng: 0,
      owner: 'player', grid, gridSource: 'server', placements, incomePerTick: 0,
      heat: 1, morale: 70, members: placements.length, viewMode: 'topdown', pendingIncome: 0,
    };

    const encounter = prepareEncounter(block);

    expect(encounter.crew.map((member) => member.id)).toEqual(
      placements.map((placement) => placement.memberId),
    );
    expect(encounter.crew[5].position).toEqual({ x: 5, y: 2 });
  });

  it('keeps a persisted all-downed roster down instead of inventing a healthy scout', () => {
    const grid = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({
      x, y, zoneType: 'sidewalk' as const, incomeModifier: 60, exposureRisk: 50,
      coverScore: 0.3, passable: true, occupantId: null,
    })));
    const downedBlock: BlockData = {
      id: 'downed-defenders', address: 'Fictional Downed Block', lat: 0, lng: 0,
      owner: 'player', grid, gridSource: 'server', placements: [{
        memberId: 'crew-downed', memberName: 'Downed Crew', role: 'shooter', x: 2, y: 3,
        zoneType: 'sidewalk', incomePerTick: 0, exposureRisk: 50, level: 1, health: 0,
      }], incomePerTick: 0, heat: 1, morale: 70, members: 1,
      viewMode: 'topdown', pendingIncome: 0,
    };

    const encounter = prepareEncounter(downedBlock);
    expect(encounter.crew).toEqual([
      expect.objectContaining({
        id: 'crew-downed', position: { x: 2, y: 3 }, health: 0, isDown: true,
      }),
    ]);
    expect(advanceCombat(createCombatSession(encounter), 1).result?.outcome).toBe('overrun');
  });

  it('keeps opening opposition fire survivable long enough for player input', () => {
    const advanced = advanceCombat(createCombatSession(preparation()), 40);
    const crew = advanced.combatants.find((candidate) => candidate.id === 'crew-1');

    expect(advanced.phase).toBe('active');
    expect(crew?.health).toBeGreaterThan(0);
    expect(advanced.events.some((event) => event.type === 'weapon-fired')).toBe(true);
  });

  it('uses bounded reload timing and ignores stale commands', () => {
    const empty = createCombatSession({
      ...preparation(),
      crew: [actor({ ammo: 0, maxAmmo: 8 })],
    });
    const reloading = dispatchCombatCommand(empty, {
      type: 'reload', actorId: 'crew-1', sequence: 1,
    });
    const advanced = advanceCombat(reloading, 20);
    const stale = dispatchCombatCommand(advanced, {
      type: 'move', actorId: 'crew-1', destination: { x: 0, y: 2 }, sequence: 1,
    });

    expect(advanced.combatants[0].ammo).toBe(8);
    expect(stale.events.at(-1)?.type).toBe('blocked');
  });
});
