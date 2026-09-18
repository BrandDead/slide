import { beforeEach, describe, expect, it } from 'vitest';
import { getDNAById, resolveProjectionProfile } from '../../config/blockDNA';
import { buildZoneLayout } from '../../utils/blockDNAResolver';
import { generateGridForZoneLayout } from '../../stores/blockStore';
import { useBlockStore } from '../../stores/blockStore';
import { prepareEncounter } from '../../game/combat/prepareEncounter';
import { environmentAssets } from '../../assets/assetManifest';
import { GRID, snapToCell } from '../../config/gridConfig';
import {
  project,
  unproject,
  clearProjectionCache,
  type SceneViewport,
} from '../projection';
import {
  HERO_DNA_ID,
  composeDioramaScene,
  projectCrewSelection,
  snapshotEncounterBoard,
} from '../dioramaAdapter';
import type { BlockData, BlockPlacement } from '../../types/block.types';

const VIEW: SceneViewport = { width: 1280, height: 720 };
const MOBILE: SceneViewport = { width: 390, height: 844 };
const SEED = 'hero-las-olas-contract';

function heroBlock(overrides: Partial<BlockData> = {}): BlockData {
  const dna = getDNAById(HERO_DNA_ID)!;
  const grid = generateGridForZoneLayout(buildZoneLayout(dna));
  const dealer: BlockPlacement = {
    memberId: 'demo-dealer-1',
    memberName: 'Lil Dre',
    role: 'dealer',
    x: 3,
    y: 1,
    zoneType: grid[1][3].zoneType,
    incomePerTick: 80,
    exposureRisk: grid[1][3].exposureRisk,
    level: 2,
    health: 100,
  };
  grid[1][3].occupantId = dealer.memberId;
  return {
    id: 'demo-block-las-olas',
    address: `${dna.address}, ${dna.city}`,
    lat: dna.lat,
    lng: dna.lng,
    owner: 'player',
    ownerGangName: 'The Demo Crew',
    grid,
    gridSource: 'dna-fallback',
    placements: [dealer],
    incomePerTick: dealer.incomePerTick,
    heat: dna.startingHeat,
    morale: dna.startingMorale,
    members: 1,
    viewMode: 'street',
    pendingIncome: 0,
    dnaId: dna.id,
    incomeMultiplier: dna.incomeMultiplier,
    heatDecayMultiplier: dna.heatDecayMultiplier,
    maxMembers: dna.maxMembers,
    globalCoverBonus: dna.globalCoverBonus,
    streetBackdropUrl: environmentAssets.block_lasolas_miami_001.streetBackdropNight,
    topdownBgUrl: environmentAssets.block_lasolas_miami_001.topdownBg,
    appliedEncounterResultKeys: [],
    ...overrides,
  };
}

beforeEach(() => {
  clearProjectionCache();
  useBlockStore.setState({
    blocks: {},
    selectedBlockId: null,
    activeDriveBys: {},
    isPlacementMode: false,
    pendingPlacementMemberId: null,
    pendingPlacementMember: null,
  });
});

describe('hero Block DNA + viewport → stable world positions', () => {
  it('projects every DNA cell deterministically for the same viewport and seed', () => {
    const block = heroBlock();
    const a = composeDioramaScene({ block, view: VIEW, seed: SEED });
    const b = composeDioramaScene({ block, view: VIEW, seed: SEED });

    expect(a.dnaId).toBe('las-olas-1208');
    expect(a.cells).toHaveLength(GRID.cols * GRID.rows);
    expect(a.profile).toEqual(resolveProjectionProfile(getDNAById(HERO_DNA_ID)!));
    expect(a.cells.map((cell) => ({
      col: cell.col,
      row: cell.row,
      x: cell.point.x,
      y: cell.point.y,
      depth: cell.point.depth,
    }))).toEqual(b.cells.map((cell) => ({
      col: cell.col,
      row: cell.row,
      x: cell.point.x,
      y: cell.point.y,
      depth: cell.point.depth,
    })));
  });

  it('uses the shared projection helper, not a second geometry system', () => {
    const scene = composeDioramaScene({ block: heroBlock(), view: VIEW, seed: SEED });
    const curb = scene.cells.find((cell) => cell.col === 3 && cell.row === 1)!;
    const expected = project({ col: 3, row: 1 }, VIEW, scene.profile);
    expect(curb.point.x).toBeCloseTo(expected.x, 10);
    expect(curb.point.y).toBeCloseTo(expected.y, 10);
    expect(curb.point.depth).toBeCloseTo(expected.depth, 10);
  });

  it('sorts far rows before near rows with a stable column tie-break', () => {
    const scene = composeDioramaScene({ block: heroBlock(), view: VIEW, seed: SEED });
    const depths = scene.drawOrder.map((cell) => cell.point.depth);
    expect(depths).toEqual([...depths].sort((left, right) => left - right));
    expect(scene.drawOrder[0].row).toBe(7);
    expect(scene.drawOrder[scene.drawOrder.length - 1].row).toBe(0);
  });
});

describe('cover / street / passable / extraction agree with the DNA 8×8 board', () => {
  it('mirrors canonical DNA zone, cover, passable, and exposure on every cell', () => {
    const block = heroBlock();
    const scene = composeDioramaScene({ block, view: VIEW, seed: SEED });

    expect(block.grid[0][0].zoneType).toBe('street');
    expect(block.grid[1][0].zoneType).toBe('curb');
    expect(block.grid[3][0].zoneType).toBe('storefront');
    expect(block.grid[4][0].zoneType).toBe('alley');
    expect(block.grid[7][0].zoneType).toBe('rooftop');

    for (const cell of scene.cells) {
      const zone = block.grid[cell.row][cell.col];
      expect(cell.zoneType).toBe(zone.zoneType);
      expect(cell.passable).toBe(zone.passable);
      expect(cell.coverScore).toBe(zone.coverScore);
      expect(cell.exposureRisk).toBe(zone.exposureRisk);
      expect(cell.isStreet).toBe(zone.zoneType === 'street');
      expect(cell.isCover).toBe(zone.coverScore >= 0.5);
      expect(cell.isFacade).toBe(zone.zoneType === 'storefront');
      expect(cell.isSetback).toBe(zone.zoneType === 'alley' || zone.zoneType === 'building' || zone.zoneType === 'rooftop');
    }
  });

  it('places objective and extraction markers on legal DNA cells', () => {
    const block = heroBlock();
    const scene = composeDioramaScene({ block, view: VIEW, seed: SEED });
    const objective = scene.cells.find((cell) => cell.isObjective)!;
    const extraction = scene.cells.find((cell) => cell.isExtraction)!;

    expect(objective.passable).toBe(true);
    expect(objective.zoneType).toBe('storefront');
    expect(extraction.passable).toBe(true);
    expect(extraction.zoneType).not.toBe('street');
    expect(extraction.isStreet).toBe(false);
    expect(block.grid[extraction.row][extraction.col].passable).toBe(true);
  });
});

describe('crew selection projects without mutating strategy state', () => {
  it('projects Lil Dre to the curb cell he occupies', () => {
    const block = heroBlock();
    const before = JSON.stringify(block);
    const selection = projectCrewSelection(block, 'demo-dealer-1', VIEW);
    const expected = project({ col: 3, row: 1 }, VIEW, resolveProjectionProfile(getDNAById(HERO_DNA_ID)!));

    expect(selection).not.toBeNull();
    expect(selection!.col).toBe(3);
    expect(selection!.row).toBe(1);
    expect(selection!.point.x).toBeCloseTo(expected.x, 10);
    expect(selection!.point.y).toBeCloseTo(expected.y, 10);
    expect(JSON.stringify(block)).toBe(before);
    expect(useBlockStore.getState().blocks).toEqual({});
  });
});

describe('optional map failure keeps the Strip diorama playable', () => {
  it('still composes a playable scene when map context is missing or failed', () => {
    const block = heroBlock({ streetBackdropUrl: undefined, topdownBgUrl: undefined });
    const missing = composeDioramaScene({ block, view: VIEW, seed: SEED, mapContext: null });
    const failed = composeDioramaScene({
      block,
      view: VIEW,
      seed: SEED,
      mapContext: { status: 'failed', reason: 'street tiles unavailable' },
    });

    expect(missing.playable).toBe(true);
    expect(failed.playable).toBe(true);
    expect(missing.cells).toHaveLength(64);
    expect(failed.cells).toHaveLength(64);
    expect(missing.backdropUrl).toBe(environmentAssets.block_lasolas_miami_001.streetBackdropNight);
    expect(missing.backdropUrl).toBe(failed.backdropUrl);
    expect(missing.mapIndependent).toBe(true);
  });
});

describe('encounter handoff keeps the original DNA board', () => {
  it('hands the original DNA grid to prepareEncounter and does not book an outcome', () => {
    const block = heroBlock();
    const keysBefore = [...(block.appliedEncounterResultKeys ?? [])];
    const scene = composeDioramaScene({ block, view: VIEW, seed: SEED });
    const board = snapshotEncounterBoard(block);
    const encounter = prepareEncounter(block);

    expect(board.dnaId).toBe('las-olas-1208');
    expect(encounter.terrain).toHaveLength(8);
    expect(encounter.terrain[0][0].zoneType).toBe(block.grid[0][0].zoneType);
    expect(encounter.terrain[1][3].zoneType).toBe('curb');
    expect(encounter.terrain[1][3].passable).toBe(block.grid[1][3].passable);
    expect(encounter.crew.some((actor) => actor.id === 'demo-dealer-1')).toBe(true);
    expect(block.appliedEncounterResultKeys).toEqual(keysBefore);
    expect(scene.encounterBoard.grid[0][0]).toEqual({
      x: 0,
      y: 0,
      zoneType: block.grid[0][0].zoneType,
      passable: block.grid[0][0].passable,
      coverScore: block.grid[0][0].coverScore,
      exposureRisk: block.grid[0][0].exposureRisk,
    });

    scene.encounterBoard.grid[0][0].zoneType = 'rooftop';
    expect(block.grid[0][0].zoneType).toBe('street');
  });
});

describe('projection footprint stays invertible on the hero camera', () => {
  it('round-trips a tap on a DNA curb cell back to that cell', () => {
    const scene = composeDioramaScene({ block: heroBlock(), view: MOBILE, seed: SEED });
    const curb = scene.cells.find((cell) => cell.col === 3 && cell.row === 1)!;
    const back = snapToCell(unproject(curb.point.x, curb.point.y, MOBILE, scene.profile));
    expect(back).toEqual({ col: 3, row: 1 });
    expect(scene.profile).toEqual(resolveProjectionProfile(getDNAById(HERO_DNA_ID)!));
  });
});
