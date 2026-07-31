// ============================================================
// phaserBridge.test.ts — Pure logic tests for the Phaser 3 bridge
// No DOM, no Phaser instantiation. Tests coordinate math and visual helpers.
// ============================================================

import { describe, it, expect } from 'vitest';

import {
  colToX, rowToY, xToCol, yToRow, isInGrid,
  CELL_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y,
  ROLE_COLORS, ROLE_LABELS, rowTint,
  CANVAS_WIDTH, GRID_WIDTH, GRID_HEIGHT,
} from '../slidePhaser3Coords';

import { BLOCK_COLS, BLOCK_ROWS } from '../../../utils/slideGameEngine';

describe('canvas dimensions', () => {
  it('GRID_WIDTH equals BLOCK_COLS * CELL_SIZE', () => {
    expect(GRID_WIDTH).toBe(BLOCK_COLS * CELL_SIZE);
  });
  it('GRID_HEIGHT equals BLOCK_ROWS * CELL_SIZE', () => {
    expect(GRID_HEIGHT).toBe(BLOCK_ROWS * CELL_SIZE);
  });
  it('CANVAS_WIDTH >= GRID_WIDTH', () => {
    expect(CANVAS_WIDTH).toBeGreaterThanOrEqual(GRID_WIDTH);
  });
  it('GRID_OFFSET_X centers the grid', () => {
    expect(GRID_OFFSET_X).toBe((CANVAS_WIDTH - GRID_WIDTH) / 2);
  });
});

describe('grid coordinate math', () => {
  it('colToX returns center of cell at col 0', () => {
    expect(colToX(0)).toBe(GRID_OFFSET_X + CELL_SIZE / 2);
  });
  it('colToX returns center of cell at col 3', () => {
    expect(colToX(3)).toBe(GRID_OFFSET_X + 3 * CELL_SIZE + CELL_SIZE / 2);
  });
  it('rowToY returns center of cell at row 0', () => {
    expect(rowToY(0)).toBe(GRID_OFFSET_Y + CELL_SIZE / 2);
  });
  it('rowToY returns center of cell at row 5', () => {
    expect(rowToY(5)).toBe(GRID_OFFSET_Y + 5 * CELL_SIZE + CELL_SIZE / 2);
  });
  it('xToCol is inverse of colToX', () => {
    for (let col = 0; col < BLOCK_COLS; col++) {
      expect(xToCol(colToX(col))).toBe(col);
    }
  });
  it('yToRow is inverse of rowToY', () => {
    for (let row = 0; row < BLOCK_ROWS; row++) {
      expect(yToRow(rowToY(row))).toBe(row);
    }
  });
});

describe('isInGrid', () => {
  it('returns true for valid cells', () => {
    expect(isInGrid(0, 0)).toBe(true);
    expect(isInGrid(BLOCK_COLS - 1, BLOCK_ROWS - 1)).toBe(true);
  });
  it('returns false for negative col', () => {
    expect(isInGrid(-1, 0)).toBe(false);
  });
  it('returns false for negative row', () => {
    expect(isInGrid(0, -1)).toBe(false);
  });
  it('returns false for col >= BLOCK_COLS', () => {
    expect(isInGrid(BLOCK_COLS, 0)).toBe(false);
  });
  it('returns false for row >= BLOCK_ROWS', () => {
    expect(isInGrid(0, BLOCK_ROWS)).toBe(false);
  });
});

describe('ROLE_COLORS', () => {
  it('has a numeric color for each role', () => {
    const roles = ['shooter', 'dealer', 'enforcer', 'recruit', 'driver'] as const;
    for (const role of roles) {
      expect(typeof ROLE_COLORS[role]).toBe('number');
    }
  });
  it('shooter is 0xef4444 (red)', () => {
    expect(ROLE_COLORS.shooter).toBe(0xef4444);
  });
});

describe('ROLE_LABELS', () => {
  it('each label is at most 3 chars', () => {
    const roles = ['shooter', 'dealer', 'enforcer', 'recruit', 'driver'] as const;
    for (const role of roles) {
      expect(ROLE_LABELS[role].length).toBeLessThanOrEqual(3);
    }
  });
});

describe('rowTint', () => {
  it('returns a number', () => {
    expect(typeof rowTint(0)).toBe('number');
    expect(typeof rowTint(7)).toBe('number');
  });
  it('street row differs from back row', () => {
    expect(rowTint(0)).not.toBe(rowTint(7));
  });
  it('is deterministic', () => {
    expect(rowTint(3)).toBe(rowTint(3));
  });
});
