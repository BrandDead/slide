// ============================================================
// SLIDE — Canonical Grid Contract
// frontend/src/config/gridConfig.ts
//
// THE authoritative 8×8 grid definition. Every component — renderer,
// placement UI, targeting, combat, persistence — reads dimensions and
// zone rules from here. No component may declare its own.
//
// Replaces these divergent assumptions found on main-tL2525 @ d971f18:
//   • CanvasStreetRendererV3  hardcoded `/ 8` column divisor
//   • TopDownBlock            CSS-grid-only dimensions
//   • SecurityCamRenderer     canvas-specific scene bounds
//   • slideGameEngine         BLOCK_ZONES (8 rows — the correct model,
//                             now re-exported from here)
//
// The gameplay-authoritative state stays integer grid coordinates.
// This module owns dimensions + legality. projection.ts owns the
// grid → screen transform. Neither owns game rules.
// ============================================================

import type { BlockZoneType, MemberRole } from '../types/block.types';

// ─── Coordinates ─────────────────────────────────────────────

/** Authoritative gameplay position. ALWAYS integer in persisted state. */
export interface GridCoordinate {
  col: number;
  row: number;
}

/** Presentation-only position produced by projection.ts. Never persisted. */
export interface SceneCoordinate {
  /** Screen-space x of the ground-contact point, CSS px. */
  x: number;
  /** Screen-space y of the ground-contact point, CSS px. */
  y: number;
  /** Perspective scale at this depth. 1.0 at row 0. */
  scale: number;
  /** Painter's-algorithm key. Sort ascending → far drawn before near. */
  depth: number;
}

// ─── Placement zones ─────────────────────────────────────────

export interface PlacementZone {
  row: number;
  zoneType: BlockZoneType;
  label: string;
  shortLabel: string;
  /** 0–100: exposure to street fire. */
  exposureRisk: number;
  /** Dealer income multiplier for this row. */
  incomeMultiplier: number;
  /** 0–1: reduces incoming hit chance. */
  coverBonus: number;
  /** Can any unit stand here? */
  passable: boolean;
  /** Roles allowed on this row. Empty array = all roles. */
  allowedRoles: Array<MemberRole | 'recruit'>;
  /** Can a dealer earn here? Rooftop is a firing position, not a corner. */
  canEarn: boolean;
}

/**
 * The 8 rows. Values carried over verbatim from
 * slideGameEngine.BLOCK_ZONES so this refactor changes no balance.
 */
export const PLACEMENT_ZONES: readonly PlacementZone[] = [
  { row: 0, zoneType: 'street',     label: 'STREET',     shortLabel: 'ST',
    exposureRisk: 100, incomeMultiplier: 2.0, coverBonus: 0.0, passable: true,
    allowedRoles: [], canEarn: true },
  { row: 1, zoneType: 'curb',       label: 'CURB',       shortLabel: 'CB',
    exposureRisk: 90,  incomeMultiplier: 1.8, coverBonus: 0.1, passable: true,
    allowedRoles: [], canEarn: true },
  { row: 2, zoneType: 'sidewalk',   label: 'SIDEWALK',   shortLabel: 'WK',
    exposureRisk: 70,  incomeMultiplier: 1.5, coverBonus: 0.2, passable: true,
    allowedRoles: [], canEarn: true },
  { row: 3, zoneType: 'storefront', label: 'STOREFRONT', shortLabel: 'SF',
    exposureRisk: 50,  incomeMultiplier: 1.2, coverBonus: 0.4, passable: true,
    allowedRoles: [], canEarn: true },
  { row: 4, zoneType: 'alley',      label: 'ALLEY',      shortLabel: 'AL',
    exposureRisk: 30,  incomeMultiplier: 0.9, coverBonus: 0.6, passable: true,
    allowedRoles: [], canEarn: true },
  { row: 5, zoneType: 'alley',      label: 'ALLEY BACK', shortLabel: 'AB',
    exposureRisk: 20,  incomeMultiplier: 0.7, coverBonus: 0.7, passable: true,
    allowedRoles: [], canEarn: true },
  { row: 6, zoneType: 'parking',    label: 'PARKING',    shortLabel: 'PK',
    exposureRisk: 10,  incomeMultiplier: 0.6, coverBonus: 0.8, passable: true,
    allowedRoles: [], canEarn: true },
  { row: 7, zoneType: 'rooftop',    label: 'ROOFTOP',    shortLabel: 'RF',
    exposureRisk: 5,   incomeMultiplier: 0.5, coverBonus: 0.9, passable: true,
    // Sniper position only — block.types.ts documents "no dealing".
    allowedRoles: ['shooter', 'lookout'], canEarn: false },
] as const;

// ─── Vehicle path ────────────────────────────────────────────

export interface VehiclePath {
  /** Rows the vehicle physically travels along. */
  rows: number[];
  /** Entry side of the block. */
  entry: 'west' | 'east';
  /** Fractional column where the vehicle starts, off-screen. */
  startCol: number;
  /** Fractional column where it exits, off-screen. */
  endCol: number;
  /** Which rows a shooter in the vehicle can reach. */
  engageableRows: number[];
  /** Rows that count as "near side" — take more damage from the street. */
  nearSideRows: number[];
}

export const DEFAULT_VEHICLE_PATH: VehiclePath = {
  rows: [0],
  entry: 'west',
  startCol: -2.5,
  endCol: 10.5,
  engageableRows: [0, 1, 2, 3],
  nearSideRows: [0, 1],
};

// ─── Grid configuration ──────────────────────────────────────

export interface GridConfiguration {
  cols: number;
  rows: number;
  /** Rows a vehicle drives through during a SLIDE. */
  attackLaneRows: readonly number[];
  /** Rows where crew normally stands (everything not the street lane). */
  blockRows: readonly number[];
  zones: readonly PlacementZone[];
  vehiclePath: VehiclePath;
}

export const GRID: GridConfiguration = {
  cols: 8,
  rows: 8,
  attackLaneRows: [0],
  blockRows: [1, 2, 3, 4, 5, 6, 7],
  zones: PLACEMENT_ZONES,
  vehiclePath: DEFAULT_VEHICLE_PATH,
};

export const GRID_COLS = GRID.cols;
export const GRID_ROWS = GRID.rows;
export const GRID_CELL_COUNT = GRID.cols * GRID.rows;

// ─── Lookup ──────────────────────────────────────────────────

export function zoneForRow(row: number): PlacementZone {
  const clamped = Math.min(GRID.rows - 1, Math.max(0, Math.round(row)));
  return PLACEMENT_ZONES[clamped];
}

export function zoneTypeForRow(row: number): BlockZoneType {
  return zoneForRow(row).zoneType;
}

// ─── Validation ──────────────────────────────────────────────

export interface PlacementCheck {
  legal: boolean;
  reason?: string;
}

export function isInBounds(c: GridCoordinate): boolean {
  return (
    Number.isFinite(c.col) && Number.isFinite(c.row) &&
    c.col >= 0 && c.col < GRID.cols &&
    c.row >= 0 && c.row < GRID.rows
  );
}

/** Clamp any coordinate into the grid. Fractional input stays fractional. */
export function clampToGrid(c: GridCoordinate): GridCoordinate {
  return {
    col: Math.min(GRID.cols - 1, Math.max(0, c.col)),
    row: Math.min(GRID.rows - 1, Math.max(0, c.row)),
  };
}

/** Snap a fractional coordinate to the authoritative integer cell. */
export function snapToCell(c: GridCoordinate): GridCoordinate {
  const clamped = clampToGrid(c);
  return { col: Math.round(clamped.col), row: Math.round(clamped.row) };
}

/** Stable key for occupancy maps and React lists. */
export function cellKey(c: GridCoordinate): string {
  return `${c.col},${c.row}`;
}

/**
 * Single legality check for placement. Every placement path must call this
 * — TopDownBlock, StreetBlock, SLIDE placement, and the backend validator.
 */
export function canPlace(
  coord: GridCoordinate,
  role: MemberRole | 'recruit',
  occupied: ReadonlySet<string> = new Set(),
): PlacementCheck {
  if (!isInBounds(coord)) {
    return { legal: false, reason: 'Off the block.' };
  }
  const cell = snapToCell(coord);
  const zone = zoneForRow(cell.row);

  if (!zone.passable) {
    return { legal: false, reason: `${zone.label} is impassable.` };
  }
  if (zone.allowedRoles.length > 0 && !zone.allowedRoles.includes(role)) {
    return { legal: false, reason: `${role} can't hold the ${zone.label.toLowerCase()}.` };
  }
  if (occupied.has(cellKey(cell))) {
    return { legal: false, reason: 'Someone is already there.' };
  }
  return { legal: true };
}

/** Would a dealer here actually earn? Drives placement-preview UI. */
export function canEarnAt(coord: GridCoordinate): boolean {
  return isInBounds(coord) && zoneForRow(coord.row).canEarn;
}

/** Chebyshev distance — diagonals cost the same, matching combat reach. */
export function gridDistance(a: GridCoordinate, b: GridCoordinate): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** Near-side targets take extra damage from a street-lane attack. */
export function isNearSide(coord: GridCoordinate): boolean {
  return GRID.vehiclePath.nearSideRows.includes(snapToCell(coord).row);
}

/** Can a vehicle-borne shooter reach this cell at all? */
export function isEngageableFromVehicle(coord: GridCoordinate): boolean {
  return GRID.vehiclePath.engageableRows.includes(snapToCell(coord).row);
}

/** Iterate every cell once, row-major. */
export function forEachCell(fn: (c: GridCoordinate, index: number) => void): void {
  let i = 0;
  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) fn({ col, row }, i++);
  }
}
