// ============================================================
// gridFactory.ts - Factory functions for creating game grids
// Used by the SLIDE combat system
// ============================================================

import {
  MACRO_SIZE,
  MICRO_SIZE,
  MacroCell,
  MicroCell,
  MacroCoord,
  MicroCoord,
} from './dualGrid';

/**
 * Create an empty macro grid (8x8) for the block defense layer.
 * Each cell starts unrevealed with no occupant.
 */
export function createMacroGrid(): MacroCell[][] {
  const grid: MacroCell[][] = [];
  for (let y = 0; y < MACRO_SIZE; y++) {
    const row: MacroCell[] = [];
    for (let x = 0; x < MACRO_SIZE; x++) {
      row.push({
        coord: { x, y },
        revealed: false,
        hit: false,
        occupantId: undefined,
        occupantHp: undefined,
      });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Create an empty micro grid (16x16) for the vehicle targeting layer.
 * Each cell starts unrevealed with no vehicle.
 */
export function createMicroGrid(): MicroCell[][] {
  const grid: MicroCell[][] = [];
  for (let j = 0; j < MICRO_SIZE; j++) {
    const row: MicroCell[] = [];
    for (let i = 0; i < MICRO_SIZE; i++) {
      row.push({
        coord: { i, j },
        revealed: false,
        hit: false,
        vehicleId: undefined,
        vehiclePart: undefined,
        partHp: undefined,
      });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Place an occupant (gang member) on the macro grid.
 * Returns false if the cell is already occupied or out of bounds.
 */
export function placeOccupant(
  grid: MacroCell[][],
  coord: MacroCoord,
  occupantId: string,
  hp: number = 1
): boolean {
  if (coord.x < 0 || coord.x >= MACRO_SIZE || coord.y < 0 || coord.y >= MACRO_SIZE) {
    return false;
  }
  const cell = grid[coord.y][coord.x];
  if (cell.occupantId) {
    return false; // Already occupied
  }
  cell.occupantId = occupantId;
  cell.occupantHp = hp;
  return true;
}

/**
 * Remove an occupant from the macro grid.
 */
export function removeOccupant(grid: MacroCell[][], coord: MacroCoord): boolean {
  if (coord.x < 0 || coord.x >= MACRO_SIZE || coord.y < 0 || coord.y >= MACRO_SIZE) {
    return false;
  }
  const cell = grid[coord.y][coord.x];
  cell.occupantId = undefined;
  cell.occupantHp = undefined;
  return true;
}

/**
 * Count remaining alive occupants on the macro grid.
 */
export function countAliveOccupants(grid: MacroCell[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.occupantId && (cell.occupantHp ?? 0) > 0) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Count revealed cells on the macro grid (for fog of war tracking).
 */
export function countRevealed(grid: MacroCell[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.revealed) count++;
    }
  }
  return count;
}

/**
 * Reset all revealed/hit flags on a grid (for new round).
 */
export function resetGridVisibility(grid: MacroCell[][]): void {
  for (const row of grid) {
    for (const cell of row) {
      cell.revealed = false;
      cell.hit = false;
    }
  }
}

/**
 * Generate a random block layout with terrain types.
 * Returns a 2D array of terrain types for the macro grid.
 */
export type TerrainType = 'street' | 'building' | 'alley' | 'corner' | 'park' | 'lot';

export function generateRandomBlockLayout(seed?: number): TerrainType[][] {
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;
  const layout: TerrainType[][] = [];

  for (let y = 0; y < MACRO_SIZE; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < MACRO_SIZE; x++) {
      // Street runs along the edges (y=0 is the street)
      if (y === 0) {
        row.push('street');
      } else if (x === 0 || x === MACRO_SIZE - 1) {
        row.push(rng() > 0.5 ? 'alley' : 'corner');
      } else if (y === MACRO_SIZE - 1) {
        row.push(rng() > 0.7 ? 'park' : 'lot');
      } else {
        // Interior: mostly buildings with some alleys
        const r = rng();
        if (r < 0.6) row.push('building');
        else if (r < 0.8) row.push('alley');
        else if (r < 0.9) row.push('corner');
        else row.push('lot');
      }
    }
    layout.push(row);
  }

  return layout;
}

/**
 * Simple seeded random number generator (mulberry32).
 */
function seededRandom(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
