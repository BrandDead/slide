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
  if (incomeMultiplier === undefined || heatDecayMultiplier === undefined || maxMembers === undefined) {
    return null;
  }
  return {
    dnaId: raw.dnaId,
    catalogVersion: typeof raw.catalogVersion === 'string' ? raw.catalogVersion : undefined,
    zoneLayout: raw.zoneLayout,
    incomeMultiplier,
    heatDecayMultiplier,
    maxMembers,
    globalCoverBonus: numeric('globalCoverBonus'),
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
    source: 'legacy-resolver',
  };
}

function findFirstOpenPassableZone(grid: BlockZone[][]): BlockZone | undefined {
  return grid.flat().find((zone) => zone.passable && !zone.occupantId);
}

export function apiBlockToBlockData(raw: Record<string, unknown>): BlockData {
  const coords = (raw.coordinates as { lat?: number; lng?: number } | undefined) || {};
  const address = String(raw.address ?? 'Unknown');
  const lat = Number(coords.lat ?? raw.lat ?? 0);
  const lng = Number(coords.lng ?? raw.lng ?? 0);
  const restored = restoreDNA(raw, lat, lng, address);
  const incomeMultiplier = Number(raw.incomeMultiplier ?? raw.income_multiplier ?? restored.incomeMultiplier);
  const placementsRaw = (raw.placements as Record<string, unknown>[] | undefined) || [];

  const placements: BlockPlacement[] = placementsRaw.map((p) => ({
    memberId: String(p.memberId ?? p.member_id ?? ''),
    memberName: String(p.memberName ?? p.member_name ?? 'Member'),
    role: (p.role as BlockPlacement['role']) || 'dealer',
    x: Number(p.gridX ?? p.x ?? 0),
    y: Number(p.gridY ?? p.y ?? 0),
    zoneType: (p.zoneType as BlockPlacement['zoneType']) || 'sidewalk',
    incomePerTick: Number(p.incomePerTick ?? p.income_per_tick ?? 0),
    exposureRisk: Number(p.exposureRisk ?? 50),
    level: Number(p.level ?? 1),
    health: Number(p.health ?? 100),
    portraitUrl: (p.portraitUrl as string | undefined),
    topdownUrl: (p.topdownUrl as string | undefined),
  }));

  const grid: BlockZone[][] = generateGridForZoneLayout(restored.zoneLayout);
  const normalizedPlacements = placements.flatMap((placement) => {
    const requestedZone = grid[placement.y]?.[placement.x];
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

  return {
    id: String(raw.id),
    address,
    lat,
    lng,
    owner: 'player',
    grid,
    placements: normalizedPlacements,
    incomePerTick: Number(raw.incomePerTick ?? raw.income_per_tick ?? 0),
    heat: Number(raw.heatLevel ?? raw.heat ?? 0),
    morale: Number(raw.morale ?? 80),
    members: normalizedPlacements.length,
    viewMode: (raw.viewMode as BlockData['viewMode']) ?? 'topdown',
    pendingIncome: Number(raw.pendingIncome ?? raw.pending_income ?? 0),
    streetBackdropUrl: raw.streetBackdropUrl as string | undefined,
    topdownBgUrl: raw.topdownBgUrl as string | undefined,
    dnaId: restored.dnaId,
    incomeMultiplier,
    heatDecayMultiplier: Number(raw.heatDecayMultiplier ?? raw.heat_decay_multiplier ?? restored.heatDecayMultiplier),
    maxMembers: Number(raw.maxMembers ?? raw.max_members ?? restored.maxMembers),
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
