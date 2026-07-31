// ============================================================
// slidePhaser3Coords.ts — Pure coordinate helpers for the Phaser 3 SLIDE scene
//
// No Phaser import — safe to test in Node/jsdom environments.
// Imported by both SlidePhaser3Scene.ts and the test suite.
// ============================================================

import { BLOCK_COLS, BLOCK_ROWS, type SlideRole } from '../../utils/slideGameEngine';

export const CELL_SIZE = 52;
export const GRID_WIDTH = BLOCK_COLS * CELL_SIZE;   // 416
export const GRID_HEIGHT = BLOCK_ROWS * CELL_SIZE;  // 416
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 420;
export const GRID_OFFSET_X = (CANVAS_WIDTH - GRID_WIDTH) / 2; // 32
export const GRID_OFFSET_Y = 2;

// ─── Coordinate helpers ──────────────────────────────────────

export function colToX(col: number): number {
  return GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
}

export function rowToY(row: number): number {
  return GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
}

export function xToCol(x: number): number {
  return Math.floor((x - GRID_OFFSET_X) / CELL_SIZE);
}

export function yToRow(y: number): number {
  return Math.floor((y - GRID_OFFSET_Y) / CELL_SIZE);
}

export function isInGrid(col: number, row: number): boolean {
  return col >= 0 && col < BLOCK_COLS && row >= 0 && row < BLOCK_ROWS;
}

// ─── Role visuals ────────────────────────────────────────────

export const ROLE_COLORS: Record<SlideRole, number> = {
  shooter: 0xef4444,   // red
  dealer: 0x3b82f6,    // blue
  enforcer: 0xf97316,  // orange
  recruit: 0x8b5cf6,   // purple
  driver: 0x6b7280,    // grey
};

export const ROLE_LABELS: Record<SlideRole, string> = {
  shooter: 'SH',
  dealer: 'DL',
  enforcer: 'EN',
  recruit: 'RC',
  driver: 'DR',
};

// Row zone tint (Phaser hex color)
export function rowTint(row: number): number {
  if (row === 0) return 0x7f1d1d;              // street — dark red
  if (row >= 1 && row <= 3) return 0x78350f;  // mid — yellow/brown
  return 0x14532d;                             // back — green
}
