import { calculatePlacementIncome } from '../../stores/blockStore';
import type { BlockData, BlockPlacement, BlockZone, MemberRole } from '../../types/block.types';
import type { LoopMember, PlacementRejectReason, StreetSafetyPreview } from './blockLoopTypes';

export function cellAt(block: BlockData, x: number, y: number): BlockZone | undefined {
  return block.grid[y]?.[x];
}

export function isDeployable(zone: BlockZone | undefined): boolean {
  return Boolean(zone?.passable && zone.zoneType !== 'building' && zone.zoneType !== 'street');
}

export function describePlacementReject(reason: PlacementRejectReason): string {
  switch (reason) {
    case 'out-of-bounds':
      return 'That cell is off the 8×8 board.';
    case 'not-passable':
      return 'Street and building cells are not deployable.';
    case 'not-deployable':
      return 'That cell cannot hold crew.';
    case 'occupied':
      return 'Another member already holds that cell.';
    case 'duplicate-cell':
      return 'Two members cannot share one cell.';
    case 'over-capacity':
      return 'This DNA card is at max crew.';
    case 'unknown-member':
      return 'That member is not on this loop roster.';
    case 'missing-block':
      return 'No claimed block is loaded.';
    default:
      return 'Placement rejected.';
  }
}

export function validatePlacement(
  block: BlockData,
  member: LoopMember | undefined,
  x: number,
  y: number,
): { ok: true; zone: BlockZone } | { ok: false; reason: PlacementRejectReason; message: string } {
  if (!block) {
    return { ok: false, reason: 'missing-block', message: describePlacementReject('missing-block') };
  }
  if (!member) {
    return { ok: false, reason: 'unknown-member', message: describePlacementReject('unknown-member') };
  }
  if (!Number.isInteger(x) || !Number.isInteger(y) || y < 0 || x < 0 || y >= 8 || x >= 8) {
    return { ok: false, reason: 'out-of-bounds', message: describePlacementReject('out-of-bounds') };
  }
  const zone = cellAt(block, x, y);
  if (!zone) {
    return { ok: false, reason: 'out-of-bounds', message: describePlacementReject('out-of-bounds') };
  }
  if (!zone.passable) {
    return { ok: false, reason: 'not-passable', message: describePlacementReject('not-passable') };
  }
  if (!isDeployable(zone)) {
    return { ok: false, reason: 'not-deployable', message: describePlacementReject('not-deployable') };
  }
  if (zone.occupantId && zone.occupantId !== member.id) {
    return { ok: false, reason: 'occupied', message: describePlacementReject('occupied') };
  }
  const alreadyPlaced = block.placements.some((placement) => placement.memberId === member.id);
  const cap = block.maxMembers ?? 8;
  if (!alreadyPlaced && block.placements.length >= cap) {
    return { ok: false, reason: 'over-capacity', message: describePlacementReject('over-capacity') };
  }
  return { ok: true, zone };
}

export function toPlacement(
  member: LoopMember,
  zone: BlockZone,
  grid: BlockData['grid'],
  incomeMultiplier: number,
): BlockPlacement {
  const draft: BlockPlacement = {
    memberId: member.id,
    memberName: member.name,
    role: member.role as MemberRole,
    x: zone.x,
    y: zone.y,
    zoneType: zone.zoneType,
    incomePerTick: 0,
    exposureRisk: zone.exposureRisk,
    level: member.level,
    health: member.health,
  };
  return {
    ...draft,
    incomePerTick: calculatePlacementIncome(draft, grid, incomeMultiplier),
  };
}

export function applyPlacement(block: BlockData, placement: BlockPlacement): BlockData {
  const filtered = block.placements.filter((item) => item.memberId !== placement.memberId);
  const grid = block.grid.map((row) => row.map((zone) => {
    if (zone.occupantId === placement.memberId) {
      return { ...zone, occupantId: null };
    }
    if (zone.x === placement.x && zone.y === placement.y) {
      return { ...zone, occupantId: placement.memberId };
    }
    return zone;
  }));
  const placements = [...filtered, placement];
  return {
    ...block,
    grid,
    placements,
    members: placements.length,
    incomePerTick: placements.reduce((sum, item) => sum + item.incomePerTick, 0),
  };
}

export function streetVsSafetyPreview(block: BlockData, dealerLevel: number): StreetSafetyPreview {
  const earning = block.grid.flat().filter((zone) => isDeployable(zone) && zone.incomeModifier > 0);
  const street = earning.reduce((best, zone) => (zone.exposureRisk > best.exposureRisk ? zone : best));
  const safety = earning.reduce((best, zone) => (zone.exposureRisk < best.exposureRisk ? zone : best));
  const dealer = { role: 'dealer' as const, level: dealerLevel, memberId: 'preview', memberName: 'preview', x: 0, y: 0, zoneType: street.zoneType, incomePerTick: 0, exposureRisk: 0, health: 100 };
  const streetIncome = calculatePlacementIncome({ ...dealer, x: street.x, y: street.y, zoneType: street.zoneType }, block.grid, block.incomeMultiplier ?? 1);
  const safetyIncome = calculatePlacementIncome({ ...dealer, x: safety.x, y: safety.y, zoneType: safety.zoneType }, block.grid, block.incomeMultiplier ?? 1);
  return {
    street: {
      x: street.x,
      y: street.y,
      zoneType: street.zoneType,
      incomePerTick: streetIncome,
      exposureRisk: street.exposureRisk,
    },
    safety: {
      x: safety.x,
      y: safety.y,
      zoneType: safety.zoneType,
      incomePerTick: safetyIncome,
      exposureRisk: safety.exposureRisk,
    },
    incomeDelta: streetIncome - safetyIncome,
    exposureDelta: street.exposureRisk - safety.exposureRisk,
    explanation: `Curb/street-near ${street.zoneType} pays $${streetIncome}/tick at ${street.exposureRisk} exposure. Deeper ${safety.zoneType} pays $${safetyIncome}/tick at ${safety.exposureRisk} exposure.`,
  };
}
