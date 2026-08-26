import type { GridPoint } from '../combat/types';

export const OPS_GRID_SIZE = 8;
export const OPS_CELL_SIZE = 3.5;

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export function gridToWorld(point: GridPoint, y = 0): WorldPoint {
  const half = (OPS_GRID_SIZE - 1) / 2;
  return {
    x: (point.x - half) * OPS_CELL_SIZE,
    y,
    z: (point.y - half) * OPS_CELL_SIZE,
  };
}

export function worldToGrid(point: Pick<WorldPoint, 'x' | 'z'>): GridPoint {
  const half = (OPS_GRID_SIZE - 1) / 2;
  return {
    x: Math.max(0, Math.min(OPS_GRID_SIZE - 1, Math.round(point.x / OPS_CELL_SIZE + half))),
    y: Math.max(0, Math.min(OPS_GRID_SIZE - 1, Math.round(point.z / OPS_CELL_SIZE + half))),
  };
}

/** Convert camera-relative movement into one cardinal grid command. */
export function movementToGridStep(
  forward: number,
  strafe: number,
  yawRadians: number,
): GridPoint | null {
  if (Math.abs(forward) < 0.1 && Math.abs(strafe) < 0.1) return null;

  const worldX = Math.sin(yawRadians) * forward + Math.cos(yawRadians) * strafe;
  const worldZ = Math.cos(yawRadians) * forward - Math.sin(yawRadians) * strafe;

  if (Math.abs(worldX) > Math.abs(worldZ)) {
    return { x: Math.sign(worldX), y: 0 };
  }
  return { x: 0, y: Math.sign(worldZ) };
}
