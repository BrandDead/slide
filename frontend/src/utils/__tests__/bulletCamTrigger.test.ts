import { describe, expect, it } from 'vitest';
import {
  BULLET_CAM_COOLDOWN_MS,
  bulletCamPresetFor,
  createBulletCamFxSeed,
  shouldTriggerBulletCam,
} from '../bulletCamTrigger';

describe('shouldTriggerBulletCam', () => {
  it('plays for a lethal hostile critical hit', () => {
    expect(shouldTriggerBulletCam({
      targetType: 'gang',
      lethal: true,
      critical: true,
      now: 10_000,
      lastTriggeredAt: 0,
    })).toBe(true);
  });

  it('plays for a lethal leader takedown even when it is not critical', () => {
    expect(shouldTriggerBulletCam({
      targetType: 'leader',
      lethal: true,
      critical: false,
      now: 10_000,
      lastTriggeredAt: 0,
    })).toBe(true);
  });

  it('never celebrates civilian damage or non-lethal hits', () => {
    expect(shouldTriggerBulletCam({
      targetType: 'civilian',
      lethal: true,
      critical: true,
      now: 10_000,
      lastTriggeredAt: 0,
    })).toBe(false);
    expect(shouldTriggerBulletCam({
      targetType: 'gang',
      lethal: false,
      critical: true,
      now: 10_000,
      lastTriggeredAt: 0,
    })).toBe(false);
  });

  it('enforces the replay cooldown', () => {
    expect(shouldTriggerBulletCam({
      targetType: 'gang',
      lethal: true,
      critical: true,
      now: 10_000,
      lastTriggeredAt: 10_000 - BULLET_CAM_COOLDOWN_MS + 1,
    })).toBe(false);
    expect(shouldTriggerBulletCam({
      targetType: 'gang',
      lethal: true,
      critical: true,
      now: 10_000,
      lastTriggeredAt: 10_000 - BULLET_CAM_COOLDOWN_MS,
    })).toBe(true);
  });
});

describe('bullet-cam replay metadata', () => {
  it('selects the cinematic profile for critical hits and leaders', () => {
    expect(bulletCamPresetFor('gang', true)).toBe('cinematic');
    expect(bulletCamPresetFor('leader', false)).toBe('cinematic');
    expect(bulletCamPresetFor('gang', false)).toBe('brief');
  });

  it('builds a stable, target-sensitive visual seed', () => {
    expect(createBulletCamFxSeed(42, 7)).toBe(createBulletCamFxSeed(42, 7));
    expect(createBulletCamFxSeed(42, 7)).not.toBe(createBulletCamFxSeed(42, 8));
  });
});
