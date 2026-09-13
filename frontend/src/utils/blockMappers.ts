/**
 * Gate 0B — map Flask claim/my-blocks payloads into local BlockData.
 *
 * This is the canonical API-to-client bridge, and the place a claimed block's
 * tactical identity is restored. Precedence, strongest first:
 *
 *   1. `dnaSnapshot` — the server's authoritative record, written at claim time
 *      and carried by value. Preferred always: it survives both catalog growth
 *      and later balance edits to the card it came from.
 *   2. `dnaId` — a persisted id with no snapshot. Read the live card.
 *   3. The PINNED LEGACY RESOLVER — records claimed before snapshots shipped.
 *      These must use the v1 catalog: re-resolving them against the live
 *      catalog moved 485 of 610 sampled generic locations to a different card
 *      when the library grew 25 → 33, rewriting layout, income, heat decay,
 *      cover, morale and capacity under the player.
 *
 * Never call the current-catalog resolver for an existing block here.
 */

import type { BlockData, BlockPlacement, BlockZone, BlockZoneType } from '../types/block.types';
import { calculatePlacementIncome, generateGridForZoneLayout } from '../stores/blockStore';
import { getDNAById } from '../config/blockDNA';
import { buildZoneLayout, resolveLegacyBlockDNA } from './blockDNAResolver';
import { gridCellToAnchorId } from '../types/contracts/blockScene.types';

const ZONE_TYPES: readonly BlockZoneType[] = [
  'street', 'curb', 'sidewalk', 'storefront', 'alley', 'parking', 'rooftop', 'building',
];

const LEGACY_ZONE_INCOME: Record<BlockZoneType, number> = {
  street: 100,
  curb: 80,
  sidewalk: 60,
  storefront: 40,
  alley: 20,
  parking: 30,
  rooftop: 0,
  building: 0,
};

/** Server-written record of a block's tactical identity. */
export interface DNASnapshot {
  dnaId: string;
  catalogVersion?: string;
  zoneLayout: BlockZoneType[];
  incomeMultiplier: number;
  heatDecayMultiplier: number;
  globalCoverBonus?: number;
  startingMorale?: number;
  maxMembers: number;
  startingHeat?: number;
  hotBlock?: boolean;
}

function isValidZoneLayout(value: unknown): value is BlockZoneType[] {
  return (
    Array.isArray(value) &&
    value.length === 8 &&
    value.every((zone) => ZONE_TYPES.includes(zone as BlockZoneType))
  );
}

/**
 * Accept a snapshot only when it can actually rebuild the block. A truncated or
 * malformed payload falls through to the next source rather than producing a
 * half-built grid.
 */
function parseDNASnapshot(value: unknown): DNASnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.dnaId !== 'string' || !raw.dnaId) return null;
  if (!isValidZoneLayout(raw.zoneLayout)) return null;
  const numeric = (key: string) =>
    typeof raw[key] === 'number' && Number.isFinite(raw[key] as number)
      ? (raw[key] as number)
      : undefined;
  const incomeMultiplier = numeric('incomeMultiplier');
  const heatDecayMultiplier = numeric('heatDecayMultiplier');
  const maxMembers = numeric('maxMembers');
  if (
    incomeMultiplier === undefined
    || incomeMultiplier < 0
    || heatDecayMultiplier === undefined
    || heatDecayMultiplier < 0
    || maxMembers === undefined
    || !Number.isInteger(maxMembers)
    || maxMembers < 1
    || maxMembers > 64
  ) {
    return null;
  }
  const globalCoverBonus = numeric('globalCoverBonus');
  if (globalCoverBonus !== undefined && (globalCoverBonus < -1 || globalCoverBonus > 1)) {
    return null;
  }
  return {
    dnaId: raw.dnaId,
    catalogVersion: typeof raw.catalogVersion === 'string' ? raw.catalogVersion : undefined,
    zoneLayout: raw.zoneLayout,
    incomeMultiplier,
    heatDecayMultiplier,
    maxMembers,
    globalCoverBonus,
    startingMorale: numeric('startingMorale'),
    startingHeat: numeric('startingHeat'),
    hotBlock: typeof raw.hotBlock === 'boolean' ? raw.hotBlock : undefined,
  };
}

interface RestoredDNA {
  dnaId: string;
  zoneLayout: BlockZoneType[];
  incomeMultiplier: number;
  heatDecayMultiplier: number;
  maxMembers: number;
  globalCoverBonus: number;
  startingMorale: number;
  /** How the identity was recovered — useful in tests and diagnostics. */
  source: 'snapshot' | 'stored-id' | 'legacy-resolver';
}

function restoreDNA(raw: Record<string, unknown>, lat: number, lng: number, address: string): RestoredDNA {
  const snapshot = parseDNASnapshot(raw.dnaSnapshot ?? raw.dna_snapshot);
  if (snapshot) {
    return {
      dnaId: snapshot.dnaId,
      zoneLayout: snapshot.zoneLayout,
      incomeMultiplier: snapshot.incomeMultiplier,
      heatDecayMultiplier: snapshot.heatDecayMultiplier,
      maxMembers: snapshot.maxMembers,
      globalCoverBonus: snapshot.globalCoverBonus ?? 0,
      startingMorale: snapshot.startingMorale ?? 80,
      source: 'snapshot',
    };
  }

  const rawDnaId = raw.dnaId ?? raw.dna_id;
  const storedDNA = typeof rawDnaId === 'string' ? getDNAById(rawDnaId) : undefined;
  if (storedDNA) {
    return {
      dnaId: storedDNA.id,
      zoneLayout: buildZoneLayout(storedDNA),
      incomeMultiplier: storedDNA.incomeMultiplier,
      heatDecayMultiplier: storedDNA.heatDecayMultiplier,
      maxMembers: storedDNA.maxMembers,
      globalCoverBonus: storedDNA.globalCoverBonus,
      startingMorale: storedDNA.startingMorale,
      source: 'stored-id',
    };
  }

  // No persisted identity: this record predates snapshots, so it must resolve
  // against the catalog that was live when it was claimed.
  const legacy = resolveLegacyBlockDNA(lat, lng, address);
  return {
    dnaId: legacy.dna.id,
    zoneLayout: legacy.zoneLayout,
    incomeMultiplier: legacy.incomeMultiplier,
    heatDecayMultiplier: legacy.dna.heatDecayMultiplier,
    maxMembers: legacy.maxMembers,
    globalCoverBonus: legacy.dna.globalCoverBonus,
    startingMorale: legacy.dna.startingMorale,
    source: 'legacy-resolver',
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DECIMAL_INTEGER = /^[+-]?\d+$/;

function finiteNumericInput(value: unknown): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && !DECIMAL_NUMBER.test(value.trim()))
  ) return null;
  const numeric = typeof value === 'number' ? value : Number(value.trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function finiteCoordinate(value: unknown): number {
  return finiteNumericInput(value) ?? 0;
}

function gridIndex(value: unknown): number {
  const numeric = finiteNumericInput(value);
  if (numeric === null) return Number.NaN;
  return Number.isInteger(numeric) ? numeric : Number.NaN;
}

function pythonInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string' || !DECIMAL_INTEGER.test(value.trim())) return null;
  const numeric = Number(value.trim());
  if (Number.isFinite(numeric) && Number.isInteger(numeric)) return numeric;
  // Python integers are unbounded; retain only the sign when an enormous
  // legacy value exceeds JavaScript's numeric range so callers can clamp it.
  return value.trim().startsWith('-') ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
}

function firstPresent(
  record: Record<string, unknown>,
  keys: readonly string[],
  fallback: unknown,
): unknown {
  const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate));
  return key === undefined ? fallback : record[key];
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) {
      return leftPoints[index] - rightPoints[index];
    }
  }
  return leftPoints.length - rightPoints.length;
}

/**
 * Consume only the explicitly versioned server board. Older nested grids were
 * generated before Block DNA owned the rows, so treating them as canonical
 * would recreate the client/server split this contract closes.
 */
function parseCanonicalGrid(value: unknown): BlockZone[][] | null {
  const gridData = asRecord(value);
  const metadata = asRecord(gridData?.metadata);
  const contract = asRecord(metadata?.gridContract);
  if (contract?.name !== 'block-dna-grid' || contract.version !== 1) return null;
  if (contract.globalCoverBonusApplied !== true) return null;

  const nested = asRecord(gridData?.grid);
  const width = finiteNumber(nested?.width);
  const height = finiteNumber(nested?.height);
  const rows = nested?.tiles;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width !== 8 || height !== 8) return null;
  if (!Array.isArray(rows) || rows.length !== height) return null;

  const zoneLayout: BlockZoneType[] = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    if (!Array.isArray(row) || row.length !== width) return null;
    const first = asRecord(row[0]);
    const rowType = first?.type;
    if (typeof rowType !== 'string' || !ZONE_TYPES.includes(rowType as BlockZoneType)) return null;
    if (!row.every((item) => asRecord(item)?.type === rowType)) return null;
    zoneLayout.push(rowType as BlockZoneType);
  }

  const baseGrid = generateGridForZoneLayout(zoneLayout);
  const parsed: BlockZone[][] = [];
  for (let y = 0; y < rows.length; y += 1) {
    const rawRow = rows[y] as unknown[];
    const parsedRow: BlockZone[] = [];
    for (let x = 0; x < rawRow.length; x += 1) {
      const tile = asRecord(rawRow[x]);
      const cover = finiteNumber(tile?.cover);
      const visibility = finiteNumber(tile?.visibility);
      if (
        tile?.x !== x || tile?.y !== y
        || cover === null || cover < 0 || cover > 1
        || visibility === null || visibility < 0 || visibility > 1
        || typeof tile?.deployable !== 'boolean'
      ) return null;
      parsedRow.push({
        ...baseGrid[y][x],
        coverScore: cover,
        exposureRisk: visibility * 100,
        passable: tile.deployable,
      });
    }
    parsed.push(parsedRow);
  }
  return parsed;
}

/** Consume a complete unmarked legacy board without inventing missing tiles. */
function parseLegacyGrid(value: unknown): BlockZone[][] | null {
  const gridData = asRecord(value);
  if (!gridData) return null;
  const metadata = asRecord(gridData.metadata);
  const contract = asRecord(metadata?.gridContract);
  if (contract?.name === 'block-dna-grid') return null;
  // Snapshot-bearing records use the same DNA recovery ladder as Flask even
  // when their old board is unmarked. Never let a legacy board outrank DNA.
  if (asRecord(gridData.__dna__)) return null;

  const nested = asRecord(gridData.grid);
  const nestedRows = nested?.tiles;
  const rows = Array.isArray(nestedRows) && nestedRows.length > 0
    ? nestedRows
    : gridData.tiles;
  if (!Array.isArray(rows) || rows.length !== 8 || !Array.isArray(rows[0]) || rows[0].length !== 8) {
    return null;
  }
  const width = rows[0].length;
  const parsed: BlockZone[][] = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    if (!Array.isArray(row) || row.length !== width) return null;
    const parsedRow: BlockZone[] = [];
    for (let x = 0; x < row.length; x += 1) {
      const tile = asRecord(row[x]);
      const zoneType = tile?.type;
      if (
        !tile
        || tile.x !== x
        || tile.y !== y
        || typeof zoneType !== 'string'
        || !ZONE_TYPES.includes(zoneType as BlockZoneType)
      ) return null;
      const terrainBonus = asRecord(tile.terrain_bonus);
      const rawCover = Object.prototype.hasOwnProperty.call(tile, 'cover')
        ? tile.cover
        : terrainBonus?.cover;
      const rawVisibility = Object.prototype.hasOwnProperty.call(tile, 'visibility')
        ? tile.visibility
        : terrainBonus?.visibility;
      const cover = rawCover == null ? 0 : finiteNumber(rawCover);
      const visibility = rawVisibility == null ? 1 : finiteNumber(rawVisibility);
      if (
        cover === null || cover < 0 || cover > 1
        || visibility === null || visibility < 0 || visibility > 1
        || (tile.deployable != null && typeof tile.deployable !== 'boolean')
      ) return null;
      const typedZone = zoneType as BlockZoneType;
      const normalizedCover = Math.round(cover * 100) / 100;
      const normalizedVisibility = Math.round(visibility * 100) / 100;
      parsedRow.push({
        x,
        y,
        zoneType: typedZone,
        incomeModifier: LEGACY_ZONE_INCOME[typedZone],
        exposureRisk: normalizedVisibility * 100,
        coverScore: normalizedCover,
        passable: typeof tile.deployable === 'boolean'
          ? tile.deployable
          : !['street', 'building'].includes(typedZone),
        occupantId: null,
      });
    }
    parsed.push(parsedRow);
  }
  return parsed;
}

function parseAppliedResultKeys(raw: Record<string, unknown>): string[] | undefined {
  const metadata = asRecord(raw.metadata);
  const candidate = raw.appliedEncounterResultKeys
    ?? raw.applied_encounter_result_keys
    ?? metadata?.appliedEncounterResultKeys;
  const keys = Array.isArray(candidate)
    ? candidate.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const lastKey = raw.lastEncounterResultKey
    ?? raw.last_encounter_result_key
    ?? metadata?.lastEncounterResultKey;
  if (typeof lastKey === 'string' && lastKey && !keys.includes(lastKey)) keys.push(lastKey);
  return keys.length > 0 ? [...new Set(keys)].slice(-24) : undefined;
}

function findFirstOpenPassableZone(grid: BlockZone[][]): BlockZone | undefined {
  return grid.flat().find((zone) => zone.passable && !zone.occupantId);
}

function applyFallbackCoverBonus(grid: BlockZone[][], coverBonus: number): BlockZone[][] {
  return grid.map((row) => row.map((zone) => ({
    ...zone,
    // Python serializes tactical values to two decimals; mirror that so a
    // damaged marked board has byte-stable cover in every consumer.
    coverScore: Math.round(Math.max(0, Math.min(1, zone.coverScore + coverBonus)) * 100) / 100,
  })));
}

/** Map the placement server's normalized response back onto a known board. */
export function apiPlacementsToBlockPlacements(
  value: unknown,
  grid: BlockZone[][],
  incomeMultiplier = 1,
): BlockPlacement[] {
  const placementsRaw = Array.isArray(value)
    ? value.filter((candidate): candidate is Record<string, unknown> => (
      Boolean(candidate) && typeof candidate === 'object' && !Array.isArray(candidate)
    )).sort((left, right) => {
      // Python's sorted(str) is ordinal/code-point based. Use the same order
      // so compatibility relocation selects identical cells for every ID.
      const leftId = String(left.memberId ?? left.member_id ?? '');
      const rightId = String(right.memberId ?? right.member_id ?? '');
      return compareCodePoints(leftId, rightId);
    })
    : [];
  const placements: BlockPlacement[] = placementsRaw.flatMap((p) => {
    const memberId = String(p.memberId ?? p.member_id ?? '').trim();
    if (!memberId) return [];
    const health = pythonInteger(firstPresent(p, ['health'], 100));
    // Python's snapshot builder drops a placement whose saved health cannot be
    // interpreted safely. Mirror that choice instead of emitting NaN or
    // silently resurrecting a malformed/downed defender.
    if (health === null) return [];
    const normalizedHealth = Math.max(0, Math.min(100, health));
    const rawLevel = pythonInteger(firstPresent(p, ['level'], 1));
    const level = rawLevel === null ? 1 : Math.max(1, Math.min(10, rawLevel));
    return [{
      memberId,
      memberName: String(p.memberName ?? p.member_name ?? 'Member'),
      role: (p.role as BlockPlacement['role']) || 'dealer',
      x: gridIndex(firstPresent(p, ['gridX', 'grid_x', 'x'], 0)),
      y: gridIndex(firstPresent(p, ['gridY', 'grid_y', 'y'], 0)),
      zoneType: (p.zoneType ?? p.zone_type ?? 'sidewalk') as BlockPlacement['zoneType'],
      incomePerTick: finiteNumericInput(p.incomePerTick ?? p.income_per_tick) ?? 0,
      exposureRisk: finiteNumericInput(p.exposureRisk ?? p.exposure_risk) ?? 50,
      level,
      health: normalizedHealth,
      portraitUrl: (p.portraitUrl ?? p.portrait_url) as string | undefined,
      topdownUrl: (p.topdownUrl ?? p.topdown_url) as string | undefined,
    }];
  });

  return placements.flatMap((placement) => {
    const requestedZone = Number.isInteger(placement.x) && Number.isInteger(placement.y)
      ? grid[placement.y]?.[placement.x]
      : undefined;
    // Legacy/default-layout placement data can become illegal when the block
    // is restored with its DNA-specific rows. Preserve the crew member by
    // moving only an illegal or occupied location to the first open legal cell.
    const zone = requestedZone?.passable && !requestedZone.occupantId
      ? requestedZone
      : findFirstOpenPassableZone(grid);
    if (!zone) return [];

    zone.occupantId = placement.memberId;
    const normalized = {
      ...placement,
      x: zone.x,
      y: zone.y,
      zoneType: zone.zoneType,
      exposureRisk: zone.exposureRisk,
    };
    return [{
      ...normalized,
      incomePerTick: calculatePlacementIncome(normalized, grid, incomeMultiplier),
    }];
  });
}

export function apiBlockToBlockData(raw: Record<string, unknown>): BlockData {
  const coords = (raw.coordinates as { lat?: number; lng?: number } | undefined) || {};
  const address = typeof raw.address === 'string' && raw.address
    ? raw.address
    : 'Unknown';
  const lat = finiteCoordinate(coords.lat ?? raw.lat ?? 0);
  const lng = finiteCoordinate(coords.lng ?? raw.lng ?? 0);
  const restored = restoreDNA(raw, lat, lng, address);
  const incomeMultiplier = Number(raw.incomeMultiplier ?? raw.income_multiplier ?? restored.incomeMultiplier);
  const canonicalGrid = parseCanonicalGrid(raw.gridData ?? raw.grid_data);
  const legacyGrid = canonicalGrid ? null : parseLegacyGrid(raw.gridData ?? raw.grid_data);
  const savedCoverBonus = finiteNumber(raw.globalCoverBonus ?? raw.global_cover_bonus);
  const revisionValue = finiteNumber(raw.liveRevision ?? raw.live_revision);
  const liveRevision = revisionValue !== null
    && Number.isInteger(revisionValue)
    && revisionValue >= 0
    ? revisionValue
    : null;
  const fallbackCoverBonus = savedCoverBonus ?? restored.globalCoverBonus;
  const grid: BlockZone[][] = canonicalGrid ?? legacyGrid ?? applyFallbackCoverBonus(
    generateGridForZoneLayout(restored.zoneLayout),
    fallbackCoverBonus,
  );
  const normalizedPlacements = apiPlacementsToBlockPlacements(
    raw.placements,
    grid,
    incomeMultiplier,
  );

  return {
    id: String(raw.id),
    address,
    lat,
    lng,
    owner: 'player',
    grid,
    placements: normalizedPlacements,
    ...(liveRevision !== null ? { liveRevision } : {}),
    incomePerTick: Number(raw.incomePerTick ?? raw.income_per_tick ?? 0),
    heat: Number(raw.heatLevel ?? raw.heat ?? 0),
    morale: Number(raw.morale ?? restored.startingMorale),
    members: normalizedPlacements.length,
    viewMode: (raw.viewMode as BlockData['viewMode']) ?? 'topdown',
    pendingIncome: Number(raw.pendingIncome ?? raw.pending_income ?? 0),
    appliedEncounterResultKeys: parseAppliedResultKeys(raw),
    streetBackdropUrl: raw.streetBackdropUrl as string | undefined,
    topdownBgUrl: raw.topdownBgUrl as string | undefined,
    dnaId: restored.dnaId,
    incomeMultiplier,
    heatDecayMultiplier: Number(raw.heatDecayMultiplier ?? raw.heat_decay_multiplier ?? restored.heatDecayMultiplier),
    maxMembers: Number(raw.maxMembers ?? raw.max_members ?? restored.maxMembers),
    gridSource: canonicalGrid ? 'server' : legacyGrid ? 'legacy' : 'dna-fallback',
    globalCoverBonus: fallbackCoverBonus,
  };
}

/** Add a visual fallback without rewriting any server-authored claim state. */
export function withClaimBackdrop(block: BlockData, satelliteUrl?: string): BlockData {
  return {
    ...block,
    topdownBgUrl: block.topdownBgUrl ?? satelliteUrl,
  };
}

/**
 * How a block's DNA identity was recovered. Exposed for tests and diagnostics —
 * 'legacy-resolver' means the record still has no server-side snapshot.
 */
export function describeDNASource(raw: Record<string, unknown>): RestoredDNA['source'] {
  const coords = (raw.coordinates as { lat?: number; lng?: number } | undefined) || {};
  return restoreDNA(
    raw,
    Number(coords.lat ?? raw.lat ?? 0),
    Number(coords.lng ?? raw.lng ?? 0),
    String(raw.address ?? 'Unknown'),
  ).source;
}

export function placementsToApiPayload(placements: BlockPlacement[]) {
  return placements.map((p) => ({
    memberId: p.memberId,
    memberName: p.memberName,
    role: p.role,
    gridX: p.x,
    gridY: p.y,
    x: p.x,
    y: p.y,
    zoneType: p.zoneType,
    incomePerTick: p.incomePerTick,
    exposureRisk: p.exposureRisk,
    level: p.level,
    health: p.health,
    anchorId: gridCellToAnchorId(p.x, p.y),
  }));
}
