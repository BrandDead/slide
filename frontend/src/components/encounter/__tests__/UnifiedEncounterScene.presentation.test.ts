import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorldActor } from '../../../render/worldActorResolver';
import { createCombatSession } from '../../../game/combat/combatSession';
import type { Combatant, EncounterPreparation, CombatEvent } from '../../../game/combat/types';

const renderer = vi.hoisted(() => {
  class Node {
    x = 0; y = 0; alpha = 1; visible = true; key = ''; text = ''; color = 0;
    constructor(public kind: string) {}
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    setAlpha(alpha: number) { this.alpha = alpha; return this; }
    setTexture(key: string) { this.key = key; return this; }
    setText(text: string) { this.text = text; return this; }
    setVisible(visible: boolean) { this.visible = visible; return this; }
    setScale() { return this; } setOrigin() { return this; } setTint() { return this; }
    setSize() { return this; } setDisplaySize() { return this; } setStrokeStyle() { return this; }
    setLineWidth() { return this; } add() { return this; } destroy() { return this; }
    fillGradientStyle() { return this; } fillRect() { return this; } fillStyle() { return this; }
  }
  const nodes: Node[] = [], assets = new Map<string, string>(), failedUrls = new Set<string>();
  const emit = vi.fn();
  const node = (kind: string, x = 0, y = 0) => { const n = new Node(kind).setPosition(x, y); nodes.push(n); return n; };
  class Scene {
    load = { image: vi.fn((key: string, url: string) => assets.set(key, url)) };
    textures = { exists: (key: string) => assets.has(key) && !failedUrls.has(assets.get(key)!) };
    events = { emit }; time = { now: 0 }; cameras = { main: { shake: vi.fn() } };
    input = { on: vi.fn(), keyboard: { on: vi.fn() }, gamepad: { on: vi.fn() } };
    add = {
      container: () => node('container'), graphics: () => node('graphics'),
      image: (x: number, y: number, key: string) => { const n = node('image', x, y); n.key = key; return n; },
      text: (x: number, y: number, text: string) => { const n = node('text', x, y); n.text = text; return n; },
      rectangle: (x: number, y: number) => node('rectangle', x, y),
      circle: (x: number, y: number, _radius: number, color: number) => { const n = node('circle', x, y); n.color = color; return n; },
      line: () => node('line'),
    };
  }
  return { Scene, nodes, assets, failedUrls, emit };
});
vi.mock('phaser', () => ({ default: { Scene: renderer.Scene } }));
import { UnifiedEncounterScene } from '../UnifiedEncounterScene';

function actor(overrides: Partial<Combatant> = {}): Combatant {
  return { id: 'crew-1', name: 'Rome', team: 'crew', role: 'shooter', position: { x: 2, y: 2 },
    health: 100, maxHealth: 100, armor: 0, ammo: 8, maxAmmo: 8, reloadUntilTick: null,
    nextFireTick: 0, level: 3, lastSequence: -1, isDown: false, ...overrides };
}
function preparation(): EncounterPreparation {
  return { sessionId: 'nightfall-proof', seed: 42, sceneLabel: 'Fictional Strip', locationReference: 'Fictional district', fictionNotice: 'Fictional.',
    terrain: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({ x, y, zoneType: 'sidewalk' as const, passable: true, cover: 0, exposure: 0.5 }))),
    crew: [actor()], opposition: [actor({ id: 'rival-1', name: 'Nightfall 1', team: 'opposition', role: 'opposition', position: { x: 3, y: 2 }, health: 1, maxHealth: 55 })],
    objective: { kind: 'extract', label: 'Reach exit', extraction: { x: 7, y: 7 }, requiredCrew: 1, progress: 0, target: 1 },
    heatAtStart: 1, moraleAtStart: 80, tacticalBrief: [] };
}
function start() {
  const scene = new UnifiedEncounterScene(); scene.configure(preparation(), true); scene.preload(); scene.create(); return scene;
}
function rivalImage() {
  return renderer.nodes.find(n => n.kind === 'image' && n.x === 420 && n.y === 216.125);
}

describe('Nightfall encounter presentation', () => {
  beforeEach(() => { renderer.nodes.length = 0; renderer.assets.clear(); renderer.failedUrls.clear(); renderer.emit.mockClear(); });
  it('preloads registered idle and downed art for crew and fictional opposition', () => {
    start();
    expect([...renderer.assets.values()]).toContain(getWorldActor('shooter', 'idle', 'topdown')!.url);
    expect([...renderer.assets.values()]).toContain(getWorldActor('shooter', 'downed', 'topdown')!.url);
  });
  it('renders opposition as resolver-backed actors in unchanged tactical cells', () => {
    start(); const image = rivalImage(); expect(image).toBeDefined();
    expect(renderer.assets.get(image!.key)).toBe(getWorldActor('shooter', 'idle', 'topdown')!.url);
  });
  it('switches a downed rival to registered downed art and preserves its identity', () => {
    const scene = start(); scene.fireNearestSelected();
    expect(renderer.assets.get(rivalImage()!.key)).toBe(getWorldActor('shooter', 'downed', 'topdown')!.url);
    expect(renderer.nodes.some(n => n.text === 'Nightfall 1 · DOWN')).toBe(true);
  });
  it('presents same-tick events once even when their IDs collide', () => {
    const scene = start();
    const events: CombatEvent[] = [
      { id: 'same-tick', tick: 0, type: 'weapon-fired', actorId: 'crew-1', targetId: 'rival-1', message: 'Rome fires.' },
      { id: 'same-tick', tick: 0, type: 'weapon-fired', actorId: 'rival-1', targetId: 'crew-1', message: 'Nightfall fires.' },
    ];
    Object.defineProperty(scene, 'session', { value: { ...createCombatSession(preparation()), events }, writable: true });
    scene.reloadSelected(); scene.reloadSelected();
    expect(renderer.nodes.filter(n => n.kind === 'line')).toHaveLength(2);
  });
  it('retains labels, controls and result authority when an actor image fails', () => {
    renderer.failedUrls.add(getWorldActor('shooter', 'idle', 'topdown')!.url);
    const scene = start();
    expect(renderer.nodes.some(n => n.text === 'Nightfall 1')).toBe(true);
    expect(() => scene.retreatSelected()).not.toThrow();
    const results = renderer.emit.mock.calls.filter(([name]) => name === 'combatResult');
    expect(results).toHaveLength(1); expect(results[0][1].outcome).toBe('retreated');
  });
});
