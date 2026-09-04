/**
 * Gate 0B — map Flask claim/my-blocks payloads into local BlockData.
 *
 * This is the canonical API-to-client bridge. It restores a persisted DNA
 * assignment before rebuilding an 8×8 grid, so catalog growth cannot silently
 * change an owned block's tactical identity on reload.
 */

import type { BlockData, BlockPlacement, BlockZone } from '../types/block.types';
import { generateGridForZoneLayout } from '../stores/blockStore';
import { getDNAById } from '../config/blockDNA';
import { buildZoneLayout, resolveBlockDNA } from './blockDNAResolver';
import { gridCellToAnchorId } from '../types/contracts/blockScene.types';

export function apiBlockToBlockData(raw: Record<string, unknown>): BlockData {
  const coords = (raw.coordinates as { lat?: number; lng?: number } | undefined) || {};
  const address = String(raw.address ?? 'Unknown');
  const lat = Number(coords.lat ?? raw.lat ?? 0);
  const lng = Number(coords.lng ?? raw.lng ?? 0);
  const rawDnaId = raw.dnaId ?? raw.dna_id;
  const storedDNA = typeof rawDnaId === 'string' ? getDNAById(rawDnaId) : undefined;
  const resolved = storedDNA
    ? { dna: storedDNA, zoneLayout: buildZoneLayout(storedDNA) }
    : resolveBlockDNA(lat, lng, address);
  const placementsRaw = (raw.placements as Record<string, unknown>[] | undefined) || [];

  const placements: BlockPlacement[] = placementsRaw.map((p) => {
    const x = Number(p.gridX ?? p.x ?? 0);
    const y = Number(p.gridY ?? p.y ?? 0);
    return {
      memberId: String(p.memberId ?? p.member_id ?? ''),
      memberName: String(p.memberName ?? p.member_name ?? 'Member'),
      role: (p.role as BlockPlacement['role']) || 'dealer',
      x,
      y,
      zoneType: (p.zoneType as BlockPlacement['zoneType']) || 'sidewalk',
      incomePerTick: Number(p.incomePerTick ?? p.income_per_tick ?? 0),
      exposureRisk: Number(p.exposureRisk ?? 50),
      level: Number(p.level ?? 1),
      health: Number(p.health ?? 100),
      portraitUrl: (p.portraitUrl as string | undefined),
      topdownUrl: (p.topdownUrl as string | undefined),
    };
  });

  const grid: BlockZone[][] = generateGridForZoneLayout(resolved.zoneLayout);
  const normalizedPlacements = placements.map((placement) => {
    const zone = grid[placement.y]?.[placement.x];
    if (!zone) return placement;
    zone.occupantId = placement.memberId;
    return {
      ...placement,
      zoneType: zone.zoneType,
      exposureRisk: zone.exposureRisk,
    };
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
    dnaId: resolved.dna.id,
    incomeMultiplier: Number(raw.incomeMultiplier ?? raw.income_multiplier ?? resolved.dna.incomeMultiplier),
    heatDecayMultiplier: Number(raw.heatDecayMultiplier ?? raw.heat_decay_multiplier ?? resolved.dna.heatDecayMultiplier),
    maxMembers: Number(raw.maxMembers ?? raw.max_members ?? resolved.dna.maxMembers),
  };
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
