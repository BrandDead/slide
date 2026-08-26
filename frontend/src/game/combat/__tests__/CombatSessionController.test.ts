import { describe, expect, it, vi } from 'vitest';
import { CombatSessionController } from '../CombatSessionController';
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
    level: 2,
    lastSequence: -1,
    isDown: false,
    ...overrides,
  };
}

function preparation(): EncounterPreparation {
  return {
    sessionId: 'controller-session',
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

describe('CombatSessionController', () => {
  it('keeps the authoritative snapshot unchanged while cycling cameras', () => {
    const controller = new CombatSessionController(preparation());
    const before = controller.getSnapshot();

    expect(controller.cycleCameraMode()).toBe('first-person');
    expect(controller.cycleCameraMode()).toBe('third-person');
    expect(controller.getSnapshot()).toEqual(before);
  });

  it('shares deterministic command sequencing for movement and extraction', () => {
    const controller = new CombatSessionController(preparation(), 'first-person');

    controller.moveSelected(0, 1);
    const resolved = controller.interactSelected();

    expect(resolved.phase).toBe('resolved');
    expect(resolved.result?.outcome).toBe('secured');
    expect(resolved.result?.idempotencyKey).toBe('controller-session:secured');
  });

  it('blocks ticks and commands while paused without losing the session', () => {
    const controller = new CombatSessionController(preparation(), 'third-person');
    controller.setPaused(true);
    const paused = controller.getSnapshot();

    controller.moveSelected(0, 1);
    controller.advance(12);

    expect(controller.getSnapshot()).toEqual(paused);
    controller.setPaused(false);
    expect(controller.moveSelected(0, 1).combatants[0].position).toEqual({ x: 0, y: 2 });
  });

  it('derives stable HUD state and notifies subscribers on presentation or simulation changes', () => {
    const controller = new CombatSessionController(preparation());
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    controller.setCameraMode('first-person');
    controller.fireNearest();

    const hud = controller.getHudState();
    expect(hud.cameraMode).toBe('first-person');
    expect(hud.selectedName).toBe('Scout');
    expect(hud.ammo).toBe(7);
    expect(hud.activeOpposition).toBe(1);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    controller.setPaused(true);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('produces identical snapshots for identical controller inputs', () => {
    const first = new CombatSessionController(preparation());
    const second = new CombatSessionController(preparation());

    first.fireNearest();
    first.advance(6);
    second.fireNearest();
    second.advance(6);

    expect(first.getSnapshot()).toEqual(second.getSnapshot());
  });
});
