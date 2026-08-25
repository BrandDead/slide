import { describe, expect, it } from 'vitest';
import {
  BULLET_CAM_PRESETS,
  BulletCamEngine,
  type DriveByShot,
} from '../BulletCamEngine';

const SHOT: DriveByShot = {
  shotId: 'shot-42',
  shooterId: 'driveby-player',
  startX: 560,
  startY: 450,
  targetX: 180,
  targetY: 220,
  hit: true,
  damage: 100,
  timestamp: 1_700_000_000_000,
  isLethal: true,
  isCritical: true,
  fxSeed: 12345,
  preset: 'cinematic',
};

describe('BulletCamEngine', () => {
  it('advances through launch, chase, terminal, impact, xray, and resolved', () => {
    const engine = new BulletCamEngine();
    engine.start(SHOT, 1_000);

    expect(engine.update(1_000)?.stage).toBe('launch');
    expect(engine.update(1_650)?.stage).toBe('chase');
    expect(engine.update(2_260)?.stage).toBe('terminal');
    expect(engine.update(2_310)?.stage).toBe('impact');
    expect(engine.update(2_500)?.stage).toBe('xray');
    expect(engine.update(1_000 + engine.getTotalDuration())?.stage).toBe('resolved');
    expect(engine.isActive()).toBe(false);
  });

  it('follows the configured curved path and lands exactly on its target', () => {
    const engine = new BulletCamEngine();
    engine.start({ ...SHOT, controlX: 350, controlY: 80 }, 0);

    const halfway = engine.update(BULLET_CAM_PRESETS.cinematic.travel / 2)!;
    expect(halfway.phase).toBe('travel');
    expect(halfway.pathProgress).toBeCloseTo(0.5, 6);
    expect(halfway.bulletX).toBeCloseTo(360, 5);
    expect(halfway.bulletY).toBeCloseTo(207.5, 5);

    const impact = engine.update(BULLET_CAM_PRESETS.cinematic.travel)!;
    expect(impact.phase).toBe('impact');
    expect(impact.bulletX).toBe(SHOT.targetX);
    expect(impact.bulletY).toBe(SHOT.targetY);
  });

  it('uses the brief profile when requested', () => {
    const engine = new BulletCamEngine();
    engine.start({ ...SHOT, preset: 'brief' }, 50);
    const expected = Object.values(BULLET_CAM_PRESETS.brief).reduce((sum, value) => sum + value, 0);
    expect(engine.getTotalDuration()).toBe(expected);
    expect(engine.update(50 + expected)?.phase).toBe('resolved');
  });

  it('generates identical fractures for the same visual seed', () => {
    const first = new BulletCamEngine();
    const second = new BulletCamEngine();
    first.start(SHOT, 0);
    second.start(SHOT, 0);

    const xrayTime = BULLET_CAM_PRESETS.cinematic.travel + BULLET_CAM_PRESETS.cinematic.impact + 100;
    const firstFrame = first.update(xrayTime)!;
    const secondFrame = second.update(xrayTime)!;
    expect(firstFrame.fractureCount).toBeGreaterThan(0);
    expect(Array.from(firstFrame.fractures)).toEqual(Array.from(secondFrame.fractures));
  });

  it('keeps buffers isolated across engine instances', () => {
    const first = new BulletCamEngine();
    const second = new BulletCamEngine();
    first.start(SHOT, 0);
    second.start({ ...SHOT, fxSeed: 999 }, 0);
    expect(first.update(300)?.trail).not.toBe(second.update(300)?.trail);
  });
});
