import { LAS_OLAS_LAT, LAS_OLAS_LNG } from '../config/mapboxToken';
import { formatDistance, haversineMeters, offsetLatLng } from './geo';

export type ReconOwner = 'player' | 'npc' | 'unclaimed';
export type ReconAction = 'hold' | 'attack' | 'claim' | 'scout';

export interface ReconBlock {
  id: string;
  address: string;
  lat: number;
  lng: number;
  owner: ReconOwner;
  distanceMeters: number;
  income: number;
  heat: number;
  members: number;
  gangName?: string;
  action: ReconAction;
}

export interface LiveMapBlock {
  id: string;
  address: string;
  lat: number;
  lng: number;
  owner: ReconOwner;
  income?: number;
  heat?: number;
  members?: number;
  gangName?: string;
}

export interface OriginPoint {
  lat: number;
  lng: number;
}

const RING: Array<{
  id: string;
  address: string;
  north: number;
  east: number;
  owner: ReconOwner;
  income: number;
  heat: number;
  members: number;
  gangName?: string;
}> = [
  { id: 'recon-rival-sistrunk', address: 'Sistrunk Blvd & NW 7th Ave', north: 420, east: -180, owner: 'npc', income: 340, heat: 48, members: 5, gangName: 'Eastside Ghosts' },
  { id: 'recon-rival-sunrise', address: 'Sunrise Blvd strip', north: -80, east: 620, owner: 'npc', income: 280, heat: 36, members: 4, gangName: 'Westside Crew' },
  { id: 'recon-lot-las-olas', address: 'Vacant lot · Las Olas Isles', north: 160, east: 280, owner: 'unclaimed', income: 0, heat: 4, members: 0 },
  { id: 'recon-rival-flagler', address: 'Flagler Village warehouse', north: 760, east: 90, owner: 'npc', income: 410, heat: 62, members: 7, gangName: 'Northside' },
  { id: 'recon-lot-riverwalk', address: 'Riverwalk loading dock', north: -540, east: -220, owner: 'unclaimed', income: 0, heat: 8, members: 0 },
  { id: 'recon-rival-andrews', address: 'Andrews Ave overpass', north: 90, east: -780, owner: 'npc', income: 190, heat: 28, members: 3, gangName: 'Downtown Ghosts' },
];

export function actionForOwner(owner: ReconOwner): ReconAction {
  if (owner === 'player') return 'hold';
  if (owner === 'npc') return 'attack';
  return 'claim';
}

export function withDistance(origin: OriginPoint, block: Omit<ReconBlock, 'distanceMeters' | 'action'> & { action?: ReconAction }): ReconBlock {
  return {
    ...block,
    distanceMeters: haversineMeters(origin.lat, origin.lng, block.lat, block.lng),
    action: block.action ?? actionForOwner(block.owner),
  };
}

/** Procedural attack/claim targets in a ring around the player's strip. */
export function seedReconRing(origin: OriginPoint): ReconBlock[] {
  return RING.map((spot) => {
    const pos = offsetLatLng(origin.lat, origin.lng, spot.north, spot.east);
    return withDistance(origin, {
      id: spot.id,
      address: spot.address,
      lat: pos.lat,
      lng: pos.lng,
      owner: spot.owner,
      income: spot.income,
      heat: spot.heat,
      members: spot.members,
      gangName: spot.gangName,
    });
  });
}

function nearlySame(a: LiveMapBlock, b: ReconBlock): boolean {
  return haversineMeters(a.lat, a.lng, b.lat, b.lng) < 40;
}

/**
 * Merge live owned/watched blocks with a recon ring so the hood map always
 * has attackable and claimable neighbors around the player.
 */
export function buildNearbyRecon(
  liveBlocks: LiveMapBlock[],
  origin?: OriginPoint | null,
): ReconBlock[] {
  const home = liveBlocks.find((b) => b.owner === 'player');
  const center: OriginPoint = origin ?? (
    home
      ? { lat: home.lat, lng: home.lng }
      : { lat: LAS_OLAS_LAT, lng: LAS_OLAS_LNG }
  );

  const live = liveBlocks
    .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
    .map((b) => withDistance(center, {
      id: b.id,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      owner: b.owner,
      income: b.income ?? 0,
      heat: b.heat ?? 0,
      members: b.members ?? 0,
      gangName: b.gangName,
    }));

  const ring = seedReconRing(center).filter(
    (spot) => !live.some((b) => b.id === spot.id || nearlySame(b, spot)),
  );

  return [...live, ...ring].sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function searchRecon(blocks: ReconBlock[], query: string): ReconBlock[] {
  const q = query.trim().toLowerCase();
  if (!q) return blocks;
  return blocks.filter((b) => {
    const hay = `${b.address} ${b.gangName ?? ''} ${b.owner} ${b.action}`.toLowerCase();
    return hay.includes(q);
  });
}

export function attackableNearby(blocks: ReconBlock[]): ReconBlock[] {
  return blocks.filter((b) => b.owner === 'npc');
}

export function describeRecon(block: ReconBlock): string {
  const dist = formatDistance(block.distanceMeters);
  if (block.owner === 'npc') return `${dist} · rival · ${block.gangName ?? 'unknown crew'}`;
  if (block.owner === 'player') return `${dist} · yours`;
  return `${dist} · open strip`;
}

/**
 * Grand-strategy pick: richest nearby rival that is not already on fire.
 * Falls back to the highest-income rival if every strip is hot.
 */
export function recommendHit(blocks: ReconBlock[]): ReconBlock | null {
  const rivals = attackableNearby(blocks);
  if (rivals.length === 0) return null;
  const cool = rivals.filter((b) => b.heat < 60);
  const pool = cool.length > 0 ? cool : rivals;
  return [...pool].sort((a, b) => b.income - a.income || a.distanceMeters - b.distanceMeters)[0] ?? null;
}

/** Rank rival strips by weekly-ish take for the war briefing. */
export function rankThreats(blocks: ReconBlock[], limit = 3): ReconBlock[] {
  return [...attackableNearby(blocks)]
    .sort((a, b) => b.income - a.income || a.heat - b.heat)
    .slice(0, limit);
}
