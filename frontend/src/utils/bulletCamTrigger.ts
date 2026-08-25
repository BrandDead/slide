import type { BulletCamPreset } from './BulletCamEngine';

export type BulletCamTargetType = 'gang' | 'civilian' | 'leader';

export const BULLET_CAM_COOLDOWN_MS = 8_000;

export interface BulletCamTriggerContext {
  targetType: BulletCamTargetType;
  lethal: boolean;
  critical: boolean;
  now: number;
  lastTriggeredAt: number;
  cooldownMs?: number;
}

/**
 * Keep the camera special: hostile critical kills and leader takedowns only.
 * Civilian hits never receive a celebratory replay.
 */
export function shouldTriggerBulletCam(context: BulletCamTriggerContext): boolean {
  if (!context.lethal || context.targetType === 'civilian') return false;
  if (!context.critical && context.targetType !== 'leader') return false;

  const cooldown = context.cooldownMs ?? BULLET_CAM_COOLDOWN_MS;
  return context.lastTriggeredAt <= 0 || context.now - context.lastTriggeredAt >= cooldown;
}

export function bulletCamPresetFor(
  targetType: BulletCamTargetType,
  critical: boolean,
): BulletCamPreset {
  return critical || targetType === 'leader' ? 'cinematic' : 'brief';
}

/** Stable 32-bit visual seed from the local projectile and impacted actor IDs. */
export function createBulletCamFxSeed(projectileId: number, targetId: number): number {
  let hash = 2166136261;
  hash = Math.imul(hash ^ (projectileId >>> 0), 16777619);
  hash = Math.imul(hash ^ (targetId >>> 0), 16777619);
  return (hash >>> 0) || 1;
}
