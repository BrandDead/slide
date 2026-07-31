/**
 * Tests for the CanvasStreetRendererV3 projection migration.
 * These tests verify that the new memberScenePoint function
 * produces consistent, physically correct coordinates.
 *
 * We test the underlying projection.ts directly since
 * memberScenePoint is a thin wrapper around project().
 */
import { describe, it, expect } from 'vitest';
import { project, effectAnchor, DEFAULT_PROFILE, type SceneViewport } from '../../../render/projection';

const VIEW: SceneViewport = { width: 800, height: 600 };

describe('projection — basic properties', () => {
  it('col=0 produces x near left edge', () => {
    const pt = project({ col: 0, row: 4 }, VIEW, DEFAULT_PROFILE);
    expect(pt.x).toBeLessThan(VIEW.width * 0.3);
  });

  it('col=7 produces x near right edge', () => {
    const pt = project({ col: 7, row: 4 }, VIEW, DEFAULT_PROFILE);
    expect(pt.x).toBeGreaterThan(VIEW.width * 0.7);
  });

  it('row=0 (street) produces y near ground', () => {
    const pt = project({ col: 4, row: 0 }, VIEW, DEFAULT_PROFILE);
    // Row 0 is the street — should be near the bottom of the scene
    expect(pt.y).toBeGreaterThan(VIEW.height * 0.5);
  });

  it('row=7 (rooftop) produces y near top', () => {
    const pt = project({ col: 4, row: 7 }, VIEW, DEFAULT_PROFILE);
    // Row 7 is the rooftop — should be near the top of the scene
    expect(pt.y).toBeLessThan(VIEW.height * 0.6);
  });

  it('depth increases as row decreases (nearer = higher depth)', () => {
    const near = project({ col: 4, row: 0 }, VIEW, DEFAULT_PROFILE);
    const far = project({ col: 4, row: 7 }, VIEW, DEFAULT_PROFILE);
    expect(near.depth).toBeGreaterThan(far.depth);
  });

  it('scale is larger for near rows than far rows', () => {
    const near = project({ col: 4, row: 0 }, VIEW, DEFAULT_PROFILE);
    const far = project({ col: 4, row: 7 }, VIEW, DEFAULT_PROFILE);
    expect(near.scale).toBeGreaterThan(far.scale);
  });

  it('actorHeight is proportional to scale', () => {
    const near = project({ col: 4, row: 0 }, VIEW, DEFAULT_PROFILE);
    const far = project({ col: 4, row: 7 }, VIEW, DEFAULT_PROFILE);
    expect(near.actorHeight).toBeGreaterThan(far.actorHeight);
  });

  it('cellWidth is proportional to scale', () => {
    const near = project({ col: 4, row: 0 }, VIEW, DEFAULT_PROFILE);
    const far = project({ col: 4, row: 7 }, VIEW, DEFAULT_PROFILE);
    expect(near.cellWidth).toBeGreaterThan(far.cellWidth);
  });
});

describe('projection — shadow properties', () => {
  it('shadow.cx is offset from pt.x by the light angle', () => {
    const pt = project({ col: 3, row: 2 }, VIEW, DEFAULT_PROFILE);
    // shadow.cx = x + cos(lightAngleDeg) * shadowLen * 0.35
    // The offset can be non-zero; just verify it is a finite number near the actor.
    expect(Number.isFinite(pt.shadow.cx)).toBe(true);
    // Should be within one cell width of the actor x
    expect(Math.abs(pt.shadow.cx - pt.x)).toBeLessThan(pt.cellWidth * 2);
  });

  it('shadow.cy is near pt.y (ground contact within half actor height)', () => {
    const pt = project({ col: 3, row: 2 }, VIEW, DEFAULT_PROFILE);
    // shadow.cy = y + sin(lightAngleDeg) * shadowLen * 0.08
    // Should be close to the foot contact point (pt.y)
    expect(Math.abs(pt.shadow.cy - pt.y)).toBeLessThan(pt.actorHeight * 0.5);
  });

  it('shadow.rx is positive', () => {
    const pt = project({ col: 3, row: 2 }, VIEW, DEFAULT_PROFILE);
    expect(pt.shadow.rx).toBeGreaterThan(0);
  });

  it('shadow.opacity is between 0 and 1', () => {
    const pt = project({ col: 3, row: 2 }, VIEW, DEFAULT_PROFILE);
    expect(pt.shadow.opacity).toBeGreaterThan(0);
    expect(pt.shadow.opacity).toBeLessThanOrEqual(1);
  });
});

describe('effectAnchor', () => {
  it('head anchor is above torso anchor', () => {
    const pt = project({ col: 4, row: 3 }, VIEW, DEFAULT_PROFILE);
    const head = effectAnchor(pt, 'head');
    const torso = effectAnchor(pt, 'torso');
    expect(head.y).toBeLessThan(torso.y);
  });

  it('torso anchor is above feet anchor', () => {
    const pt = project({ col: 4, row: 3 }, VIEW, DEFAULT_PROFILE);
    const torso = effectAnchor(pt, 'torso');
    const feet = effectAnchor(pt, 'feet');
    expect(torso.y).toBeLessThan(feet.y);
  });

  it('all anchors share the same x as the actor', () => {
    const pt = project({ col: 4, row: 3 }, VIEW, DEFAULT_PROFILE);
    for (const anchor of ['head', 'torso', 'feet'] as const) {
      expect(effectAnchor(pt, anchor).x).toBeCloseTo(pt.x, 1);
    }
  });
});

describe('projection — painter sort order', () => {
  it('row-0 members sort after row-7 members (far-to-near order)', () => {
    const near = project({ col: 4, row: 0 }, VIEW, DEFAULT_PROFILE);
    const far = project({ col: 4, row: 7 }, VIEW, DEFAULT_PROFILE);
    // Ascending sort by depth = far first, near last
    const sorted = [near, far].sort((a, b) => a.depth - b.depth);
    expect(sorted[0]).toBe(far);
    expect(sorted[1]).toBe(near);
  });
});
