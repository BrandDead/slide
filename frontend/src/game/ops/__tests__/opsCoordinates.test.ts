import { describe, expect, it } from 'vitest';
import { gridToWorld, movementToGridStep, worldToGrid } from '../opsCoordinates';

describe('Modern Ops coordinates', () => {
  it('round-trips every authoritative combat cell', () => {
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(worldToGrid(gridToWorld({ x, y }))).toEqual({ x, y });
      }
    }
  });

  it('maps camera-relative input to a single cardinal grid step', () => {
    expect(movementToGridStep(1, 0, 0)).toEqual({ x: 0, y: 1 });
    expect(movementToGridStep(1, 0, Math.PI / 2)).toEqual({ x: 1, y: 0 });
    expect(movementToGridStep(0, -1, 0)).toEqual({ x: -1, y: 0 });
    expect(movementToGridStep(0, 0, 0)).toBeNull();
  });
});
