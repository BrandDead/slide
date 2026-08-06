/**
 * Gate 0B — map Flask claim/my-blocks payloads into local BlockData.
 */

import type { BlockData, BlockPlacement, BlockZone } from '../types/block.types';
import { useBlockStore } from '../stores/blockStore';
import { gridCellToAnchorId } from '../types/contracts/blockScene.types';

export function apiBlockToBlockData(raw: Record<string, unknown>): BlockData {
  const generateDefaultGrid = useBlockStore.getState().generateDefaultGrid;
  const coords = (raw.coordinates as { lat?: number; lng?: number } | undefined) || {};
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

  const grid: BlockZone[][] = generateDefaultGrid();
  for (const p of placements) {
    if (grid[p.y]?.[p.x]) {
      grid[p.y][p.x].occupantId = p.memberId;
    }
  }

  return {
    id: String(raw.id),
    address: String(raw.address ?? 'Unknown'),
    lat: Number(coords.lat ?? raw.lat ?? 0),
    lng: Number(coords.lng ?? raw.lng ?? 0),
    owner: 'player',
    grid,
    placements,
    incomePerTick: Number(raw.incomePerTick ?? 0),
    heat: Number(raw.heatLevel ?? raw.heat ?? 0),
    morale: 80,
    members: placements.length,
    viewMode: 'topdown',
    pendingIncome: Number(raw.pendingIncome ?? 0),
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
