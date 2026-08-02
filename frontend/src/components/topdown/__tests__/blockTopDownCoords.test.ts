// ============================================================
// blockTopDownCoords.test.ts — unit tests for the Phaser top-down
// coordinate helpers (pure math, no Phaser import)
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  cellToPixel,
  pixelToCell,
  cellOrigin,
  CELL_W,
  CELL_H,
  TD_CANVAS_W,
  TD_CANVAS_H,
  GRID_COLS,
  GRID_ROWS,
  SPRITE_SCALE,
  SPRITE_SOURCE_SIZE,
  spriteUrlForRole,
  ROLE_TO_SPRITE,
} from '../blockTopDownCoords';

// ─── cellToPixel ──────────────────────────────────────────────

describe('cellToPixel', () => {
  it('maps (0,0) to the top-left cell centre', () => {
    const pos = cellToPixel(0, 0);
    expect(pos.x).toBeCloseTo(CELL_W / 2);
    expect(pos.y).toBeCloseTo(CELL_H / 2);
  });

  it('maps (7,7) to the bottom-right cell centre', () => {
    const pos = cellToPixel(7, 7);
    expect(pos.x).toBeCloseTo(TD_CANVAS_W - CELL_W / 2);
    expect(pos.y).toBeCloseTo(TD_CANVAS_H - CELL_H / 2);
  });

  it('advances by CELL_W per column', () => {
    const a = cellToPixel(2, 0);
    const b = cellToPixel(3, 0);
    expect(b.x - a.x).toBeCloseTo(CELL_W);
  });

  it('advances by CELL_H per row', () => {
    const a = cellToPixel(0, 2);
    const b = cellToPixel(0, 3);
    expect(b.y - a.y).toBeCloseTo(CELL_H);
  });
});

// ─── pixelToCell ──────────────────────────────────────────────

describe('pixelToCell', () => {
  it('round-trips through cellToPixel for all 64 cells', () => {
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        const world = cellToPixel(col, row);
        const back = pixelToCell(world.x, world.y);
        expect(back.col).toBe(col);
        expect(back.row).toBe(row);
      }
    }
  });

  it('clamps negative pixel coords to (0,0)', () => {
    const neg = pixelToCell(-100, -100);
    expect(neg.col).toBe(0);
    expect(neg.row).toBe(0);
  });

  it('clamps out-of-bounds pixel coords to (7,7)', () => {
    const over = pixelToCell(TD_CANVAS_W + 100, TD_CANVAS_H + 100);
    expect(over.col).toBe(GRID_COLS - 1);
    expect(over.row).toBe(GRID_ROWS - 1);
  });
});

// ─── cellOrigin ───────────────────────────────────────────────

describe('cellOrigin', () => {
  it('returns the top-left corner of the cell', () => {
    const origin = cellOrigin(2, 3);
    expect(origin.x).toBeCloseTo(2 * CELL_W);
    expect(origin.y).toBeCloseTo(3 * CELL_H);
  });

  it('(0,0) origin is (0,0)', () => {
    const origin = cellOrigin(0, 0);
    expect(origin.x).toBe(0);
    expect(origin.y).toBe(0);
  });

  it('differs from cellToPixel by half a cell', () => {
    const centre = cellToPixel(3, 3);
    const origin = cellOrigin(3, 3);
    expect(centre.x - origin.x).toBeCloseTo(CELL_W / 2);
    expect(centre.y - origin.y).toBeCloseTo(CELL_H / 2);
  });
});

// ─── sprite helpers ───────────────────────────────────────────

describe('spriteUrlForRole', () => {
  it('returns a URL ending in .png for known roles', () => {
    const roles = ['dealer', 'shooter', 'enforcer', 'lookout', 'driver'];
    for (const role of roles) {
      const url = spriteUrlForRole(role);
      expect(url).toMatch(/\.(png|webp)$/);
    }
  });

  it('falls back gracefully for unknown roles', () => {
    const url = spriteUrlForRole('unknown_role_xyz');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('ROLE_TO_SPRITE contains all standard roles', () => {
    const expectedRoles = ['dealer', 'shooter', 'enforcer', 'lookout', 'driver'];
    for (const role of expectedRoles) {
      expect(ROLE_TO_SPRITE).toHaveProperty(role);
    }
  });
});

// ─── scene constants ──────────────────────────────────────────

describe('scene constants', () => {
  it('TD_CANVAS_W and TD_CANVAS_H cover the full 8x8 grid', () => {
    expect(TD_CANVAS_W).toBe(CELL_W * GRID_COLS);
    expect(TD_CANVAS_H).toBe(CELL_H * GRID_ROWS);
  });

  it('CELL_W and CELL_H are positive numbers', () => {
    expect(CELL_W).toBeGreaterThan(0);
    expect(CELL_H).toBeGreaterThan(0);
  });

  it('GRID_COLS and GRID_ROWS are 8', () => {
    expect(GRID_COLS).toBe(8);
    expect(GRID_ROWS).toBe(8);
  });

  it('SPRITE_SCALE is positive and less than 1', () => {
    expect(SPRITE_SCALE).toBeGreaterThan(0);
    expect(SPRITE_SCALE).toBeLessThan(1);
  });

  it('SPRITE_SOURCE_SIZE is a positive integer', () => {
    expect(SPRITE_SOURCE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(SPRITE_SOURCE_SIZE)).toBe(true);
  });
});
