// Sprint 17 — procedural drive-by street + window mechanic
import { describe, it, expect } from 'vitest';
import {
  generateStreetSegments,
  projectStreetScene,
  stripLengthM,
  makeRng,
} from '../proceduralStreet';
import {
  createWindowState, toggleWindow, tickWindow, canShoot,
  incomingDamageMultiplier, applyGlassHit,
  WINDOW_TRAVEL_SECONDS, GLASS_HIT_POINTS, GLASS_DAMAGE_REDUCTION,
} from '../../utils/windowMechanic';
import { BLOCK_DNA_LIBRARY } from '../../config/blockDNA';
import type { BlockZoneType } from '../../types/block.types';

const LAYOUT: BlockZoneType[] = [
  'street', 'curb', 'sidewalk', 'storefront',
  'storefront', 'alley', 'parking', 'building',
];

describe('proceduralStreet', () => {
  it('is deterministic — same seed yields an identical street', () => {
    const a = generateStreetSegments({ seed: 'blk-abc123', zoneLayout: LAYOUT });
    const b = generateStreetSegments({ seed: 'blk-abc123', zoneLayout: LAYOUT });
    expect(a).toEqual(b);
  });

  it('produces a different street for a different address seed', () => {
    const a = generateStreetSegments({ seed: 'blk-abc123', zoneLayout: LAYOUT });
    const b = generateStreetSegments({ seed: 'blk-zzz999', zoneLayout: LAYOUT });
    expect(a).not.toEqual(b);
  });

  it('uses built-form rows as frontage sources without treating depth rows as columns', () => {
    const scene = projectStreetScene([
      'street', 'curb', 'sidewalk', 'storefront', 'alley', 'rooftop',
    ] as BlockZoneType[]);
    const segs = generateStreetSegments({
      seed: 'frontage-only',
      zoneLayout: ['street', 'curb', 'sidewalk', 'storefront', 'alley', 'rooftop'] as BlockZoneType[],
      count: 12,
    });

    expect(scene.frontageZones).toEqual(['storefront', 'alley']);
    expect(segs.every((seg) => seg.kind === 'storefront' || seg.kind === 'alley')).toBe(true);
  });

  it('projects street, curb, sidewalk, facade, setback, and rooftop in far-to-near painter order', () => {
    const scene = projectStreetScene([
      'street', 'curb', 'sidewalk', 'storefront', 'alley', 'rooftop',
    ] as BlockZoneType[]);

    expect(scene.depthLayers.map((layer) => layer.pass)).toEqual([
      'skyline', 'setback', 'facade', 'sidewalk', 'curb', 'road',
    ]);
    expect(scene.depthLayers.map((layer) => layer.row)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(scene.depthLayers.map((layer) => layer.id)).toEqual([
      'depth-5-rooftop', 'depth-4-alley', 'depth-3-storefront',
      'depth-2-sidewalk', 'depth-1-curb', 'depth-0-street',
    ]);
  });

  it('keeps projection ordering and stable layer ids across three authored DNA archetypes', () => {
    const defaultLayout: BlockZoneType[] = [
      'street', 'curb', 'sidewalk', 'storefront',
      'alley', 'sidewalk', 'curb', 'rooftop',
    ];

    for (const dna of BLOCK_DNA_LIBRARY.slice(0, 3)) {
      const layout = defaultLayout.map((zone, row) => dna.zoneOverrides?.[row] ?? zone);
      const first = projectStreetScene(layout);
      const second = projectStreetScene(layout);

      expect(first.depthLayers).toEqual(second.depthLayers);
      expect(first.depthLayers.map((layer) => layer.row)).toEqual(
        [...first.depthLayers.map((layer) => layer.row)].sort((a, b) => b - a),
      );
      expect(new Set(first.depthLayers.map((layer) => layer.id)).size).toBe(layout.length);
    }
  });

  it('gives every segment positive width so the strip can loop', () => {
    const segs = generateStreetSegments({ seed: 'loop', zoneLayout: LAYOUT });
    expect(segs.every((s) => s.widthM > 0)).toBe(true);
    expect(stripLengthM(segs)).toBeGreaterThan(0);
  });

  it('never emits a real brand name on signage', () => {
    const segs = generateStreetSegments({ seed: 'brand', zoneLayout: LAYOUT, count: 40 });
    const banned = /walmart|starbucks|mcdonald|cvs|walgreens|7-eleven/i;
    expect(segs.every((s) => !s.sign || !banned.test(s.sign))).toBe(true);
  });

  it('rng stays within [0,1)', () => {
    const rng = makeRng('seed');
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('windowMechanic', () => {
  it('starts lowered so the player can shoot immediately', () => {
    const w = createWindowState(true);
    expect(canShoot(w)).toBe(true);
  });

  it('blocks shooting while the glass is up', () => {
    const w = createWindowState(false);
    expect(canShoot(w)).toBe(false);
  });

  it('blocks shooting mid-travel', () => {
    let w = toggleWindow(createWindowState(false)); // start raising -> lowering
    w = tickWindow(w, WINDOW_TRAVEL_SECONDS / 2);
    expect(w.openRatio).toBeGreaterThan(0);
    expect(w.openRatio).toBeLessThan(1);
    expect(canShoot(w)).toBe(false);
  });

  it('completes travel in the configured time', () => {
    let w = toggleWindow(createWindowState(true)); // lowering -> raising
    w = tickWindow(w, WINDOW_TRAVEL_SECONDS);
    expect(w.openRatio).toBe(0);
    expect(canShoot(w)).toBe(false);
  });

  it('raised glass reduces incoming damage', () => {
    const up = createWindowState(false);
    const down = createWindowState(true);
    expect(incomingDamageMultiplier(up)).toBeCloseTo(GLASS_DAMAGE_REDUCTION, 5);
    expect(incomingDamageMultiplier(down)).toBe(1);
  });

  it('shatters after enough hits and stays open', () => {
    let w = createWindowState(false);
    let shatteredNow = false;
    for (let i = 0; i < GLASS_HIT_POINTS; i++) {
      const r = applyGlassHit(w);
      w = r.state;
      shatteredNow = r.shatteredNow;
    }
    expect(shatteredNow).toBe(true);
    expect(w.shattered).toBe(true);
    expect(w.openRatio).toBe(1);
    expect(canShoot(w)).toBe(true);
    expect(incomingDamageMultiplier(w)).toBe(1);
  });

  it('ignores glass hits when the window is already down', () => {
    const w = createWindowState(true);
    const r = applyGlassHit(w);
    expect(r.state).toBe(w);
    expect(r.shatteredNow).toBe(false);
  });

  it('cannot be re-raised once shattered', () => {
    let w = createWindowState(false);
    for (let i = 0; i < GLASS_HIT_POINTS; i++) w = applyGlassHit(w).state;
    expect(toggleWindow(w)).toBe(w);
  });
});
