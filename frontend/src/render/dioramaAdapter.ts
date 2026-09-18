// ============================================================
// SLIDE — Tactical diorama presentation adapter (#77)
//
// Reads Block DNA + the canonical 8×8 board and projects them into a
// cinematic 2.5D scene. Strategy state stays in stores; this module never
// writes placements, heat, cash, morale, or encounter receipts.
// ============================================================

import { getDNAById, resolveProjectionProfile, type BlockDNA } from '../config/blockDNA';
import { GRID } from '../config/gridConfig';
import { resolveBlockDNA } from '../utils/blockDNAResolver';
import { getWorldActor } from './worldActorResolver';
import {
  getHeroStreetBackdropUrl,
  resolveBlockBackdropUrl,
} from '../services/assetResolver';
import {
  project,
  projectCellQuad,
  type ProjectionProfile,
  type ScenePoint,
  type SceneViewport,
} from './projection';
import type { BlockData, BlockPlacement, BlockZone, BlockZoneType } from '../types/block.types';

export const HERO_DNA_ID = 'las-olas-1208';

export interface DioramaMapContext {
  status: 'ready' | 'loading' | 'failed' | 'missing';
  reason?: string;
}

export interface EncounterBoardCell {
  x: number;
  y: number;
  zoneType: BlockZoneType;
  passable: boolean;
  coverScore: number;
  exposureRisk: number;
}

export interface DioramaCell {
  col: number;
  row: number;
  zoneType: BlockZoneType;
  passable: boolean;
  coverScore: number;
  exposureRisk: number;
  isStreet: boolean;
  isCover: boolean;
  isFacade: boolean;
  isSetback: boolean;
  isObjective: boolean;
  isExtraction: boolean;
  point: ScenePoint;
  corners: Array<{ x: number; y: number }>;
}

export interface DioramaActor {
  memberId: string;
  memberName: string;
  role: BlockPlacement['role'];
  col: number;
  row: number;
  zoneType: BlockZoneType;
  coverScore: number;
  exposureRisk: number;
  health: number;
  point: ScenePoint;
  spriteUrl: string | null;
  pivot: { x: number; y: number };
}

export interface DioramaScene {
  dnaId: string;
  dnaName: string;
  flavour: string;
  seed: string;
  profile: ProjectionProfile;
  view: SceneViewport;
  backdropUrl: string;
  playable: boolean;
  mapIndependent: true;
  mapNotice: string | null;
  cells: DioramaCell[];
  drawOrder: DioramaCell[];
  actors: DioramaActor[];
  encounterBoard: { dnaId: string; grid: EncounterBoardCell[][] };
}

export interface CrewSelectionProjection {
  memberId: string;
  memberName: string;
  col: number;
  row: number;
  zoneType: BlockZoneType;
  coverScore: number;
  exposureRisk: number;
  point: ScenePoint;
}

function resolvePresentationDna(block: BlockData): BlockDNA {
  if (block.dnaId) {
    const stored = getDNAById(block.dnaId);
    if (stored) return stored;
  }
  return resolveBlockDNA(block.lat, block.lng, block.address).dna;
}

function cellAt(block: BlockData, x: number, y: number): BlockZone | undefined {
  return block.grid[y]?.[x];
}

function findSafeOrigin(block: BlockData): { x: number; y: number } {
  const placed = block.placements[0];
  if (placed) return { x: placed.x, y: placed.y };
  const safe = block.grid.flat()
    .filter((zone) => zone.passable)
    .sort((left, right) => (right.coverScore - left.coverScore) || (left.exposureRisk - right.exposureRisk))[0];
  return safe ? { x: safe.x, y: safe.y } : { x: 3, y: 2 };
}

function pickObjectiveZone(block: BlockData): BlockZone | undefined {
  const storefronts = block.grid.flat().filter((zone) => zone.passable && zone.zoneType === 'storefront');
  const pool = storefronts.length > 0
    ? storefronts
    : block.grid.flat().filter((zone) => zone.passable && zone.zoneType !== 'street');
  return pool.sort((left, right) => {
    const leftDist = Math.abs(left.x - 3.5) + Math.abs(left.y - 3);
    const rightDist = Math.abs(right.x - 3.5) + Math.abs(right.y - 3);
    return leftDist - rightDist;
  })[0];
}

function pickExtractionZone(block: BlockData, origin: { x: number; y: number }, avoid?: BlockZone): BlockZone | undefined {
  return block.grid.flat()
    .filter((zone) => (
      zone.passable
      && zone.zoneType !== 'street'
      && (zone.x !== origin.x || zone.y !== origin.y)
      && (!avoid || zone.x !== avoid.x || zone.y !== avoid.y)
    ))
    .sort((left, right) => {
      const leftDistance = Math.abs(left.x - origin.x) + Math.abs(left.y - origin.y);
      const rightDistance = Math.abs(right.x - origin.x) + Math.abs(right.y - origin.y);
      const leftScore = leftDistance * 10 + (7 - left.y) * 5 + left.coverScore * 3 - left.exposureRisk / 100;
      const rightScore = rightDistance * 10 + (7 - right.y) * 5 + right.coverScore * 3 - right.exposureRisk / 100;
      return rightScore - leftScore;
    })[0];
}

export function snapshotEncounterBoard(block: BlockData): { dnaId: string; grid: EncounterBoardCell[][] } {
  return {
    dnaId: resolvePresentationDna(block).id,
    grid: block.grid.map((row) => row.map((zone) => ({
      x: zone.x,
      y: zone.y,
      zoneType: zone.zoneType,
      passable: zone.passable,
      coverScore: zone.coverScore,
      exposureRisk: zone.exposureRisk,
    }))),
  };
}

export function projectCrewSelection(
  block: BlockData,
  memberId: string,
  view: SceneViewport,
): CrewSelectionProjection | null {
  const placement = block.placements.find((item) => item.memberId === memberId);
  if (!placement) return null;
  const dna = resolvePresentationDna(block);
  const profile = resolveProjectionProfile(dna);
  const zone = cellAt(block, placement.x, placement.y);
  return {
    memberId: placement.memberId,
    memberName: placement.memberName,
    col: placement.x,
    row: placement.y,
    zoneType: placement.zoneType,
    coverScore: zone?.coverScore ?? 0,
    exposureRisk: placement.exposureRisk,
    point: project({ col: placement.x, row: placement.y }, view, profile),
  };
}

export function composeDioramaScene(input: {
  block: BlockData;
  view: SceneViewport;
  seed?: string;
  mapContext?: DioramaMapContext | null;
}): DioramaScene {
  const { block, view } = input;
  const dna = resolvePresentationDna(block);
  const profile = resolveProjectionProfile(dna);
  const origin = findSafeOrigin(block);
  const objective = pickObjectiveZone(block);
  const extraction = pickExtractionZone(block, origin, objective);
  const mapFailed = input.mapContext?.status === 'failed' || input.mapContext?.status === 'missing';

  const cells: DioramaCell[] = [];
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let col = 0; col < GRID.cols; col += 1) {
      const zone = cellAt(block, col, row);
      if (!zone) continue;
      const footprint = projectCellQuad({ col, row }, view, profile);
      cells.push({
        col,
        row,
        zoneType: zone.zoneType,
        passable: zone.passable,
        coverScore: zone.coverScore,
        exposureRisk: zone.exposureRisk,
        isStreet: zone.zoneType === 'street',
        isCover: zone.coverScore >= 0.5,
        isFacade: zone.zoneType === 'storefront',
        isSetback: zone.zoneType === 'alley' || zone.zoneType === 'building' || zone.zoneType === 'rooftop',
        isObjective: Boolean(objective && objective.x === col && objective.y === row),
        isExtraction: Boolean(extraction && extraction.x === col && extraction.y === row),
        point: footprint.center,
        corners: footprint.corners,
      });
    }
  }

  const drawOrder = [...cells].sort((left, right) => (
    left.point.depth - right.point.depth || left.col - right.col
  ));

  const actors: DioramaActor[] = block.placements.map((placement) => {
    const zone = cellAt(block, placement.x, placement.y);
    const state = placement.health <= 0 ? 'downed' : 'idle';
    const sprite = getWorldActor(placement.role, state, 'street');
    return {
      memberId: placement.memberId,
      memberName: placement.memberName,
      role: placement.role,
      col: placement.x,
      row: placement.y,
      zoneType: placement.zoneType,
      coverScore: zone?.coverScore ?? 0,
      exposureRisk: placement.exposureRisk,
      health: placement.health,
      point: project({ col: placement.x, row: placement.y }, view, profile),
      spriteUrl: sprite?.url ?? null,
      pivot: sprite?.pivot ?? { x: 0.5, y: 1 },
    };
  }).sort((left, right) => left.point.depth - right.point.depth);

  return {
    dnaId: dna.id,
    dnaName: dna.name,
    flavour: dna.flavour,
    seed: input.seed ?? `${dna.id}:${view.width}x${view.height}`,
    profile,
    view,
    backdropUrl: resolveBlockBackdropUrl({
      dnaId: dna.id,
      streetBackdropUrl: block.streetBackdropUrl ?? (dna.id === HERO_DNA_ID ? getHeroStreetBackdropUrl() : undefined),
    }),
    playable: true,
    mapIndependent: true,
    mapNotice: mapFailed
      ? (input.mapContext?.reason
        ? `Street map imagery is optional (${input.mapContext.reason}). The Strip board stays playable.`
        : 'Street map imagery is optional. The Strip board stays playable.')
      : null,
    cells,
    drawOrder,
    actors,
    encounterBoard: snapshotEncounterBoard(block),
  };
}

export function toPercent(point: { x: number; y: number }, view: SceneViewport): { x: number; y: number } {
  return {
    x: view.width === 0 ? 0 : (point.x / view.width) * 100,
    y: view.height === 0 ? 0 : (point.y / view.height) * 100,
  };
}
