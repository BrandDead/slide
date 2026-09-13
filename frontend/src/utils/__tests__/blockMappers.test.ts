import { describe, expect, it } from 'vitest';
import { apiBlockToBlockData, withClaimBackdrop } from '../blockMappers';
import { prepareEncounter } from '../../game/combat/prepareEncounter';

const allRows = (zoneType: 'sidewalk' | 'parking' | 'alley') =>
  Array.from({ length: 8 }, () => zoneType);

function dnaSnapshot(zoneLayout = allRows('sidewalk')) {
  return {
    dnaId: 'harbor-spur',
    catalogVersion: 'v2',
    zoneLayout,
    incomeMultiplier: 1.45,
    heatDecayMultiplier: 0.8,
    globalCoverBonus: 0.12,
    startingMorale: 76,
    maxMembers: 6,
  };
}

function canonicalGrid(zoneType: 'sidewalk' | 'parking' = 'parking') {
  const tiles = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({
    x,
    y,
    type: zoneType,
    cover: x === 2 && y === 3 ? 0.77 : 0.35,
    visibility: x === 2 && y === 3 ? 0.12 : 0.4,
    deployable: true,
  })));
  return {
    grid: { width: 8, height: 8, tiles },
    metadata: {
      gridContract: {
        name: 'block-dna-grid',
        version: 1,
        layoutSource: 'block-dna-snapshot',
        globalCoverBonusApplied: true,
      },
    },
  };
}

describe('apiBlockToBlockData', () => {
  it('rebuilds an owned block from its persisted Block DNA layout', () => {
    const block = apiBlockToBlockData({
      id: 'harbor-claim',
      address: 'A legacy address that should not change this claim',
      lat: 40.7128,
      lng: -74.006,
      dnaId: 'harbor-spur',
      placements: [{ memberId: 'rome', memberName: 'Rome', role: 'shooter', x: 0, y: 2 }],
    });

    expect(block.dnaId).toBe('harbor-spur');
    expect(block.grid[2][0].zoneType).toBe('parking');
    expect(block.grid[2][0].occupantId).toBe('rome');
    expect(block.placements[0]).toMatchObject({ zoneType: 'parking', exposureRisk: 40 });
    expect(block.incomeMultiplier).toBe(1.45);
  });

  it('moves a legacy placement off a newly impassable DNA row and recalculates its cell income', () => {
    const block = apiBlockToBlockData({
      id: 'legacy-harbor-claim',
      address: 'Freight Spur & Dockside Ave',
      lat: 25.7752,
      lng: -80.1748,
      dnaId: 'harbor-spur',
      placements: [{ memberId: 'dealer-1', memberName: 'Solo', role: 'dealer', x: 2, y: 6, incomePerTick: 60, level: 1 }],
    });

    expect(block.grid[6][2].zoneType).toBe('building');
    expect(block.grid[6][2].occupantId).toBeNull();
    expect(block.placements[0]).toMatchObject({ x: 0, y: 1, zoneType: 'curb', incomePerTick: 116 });
    expect(block.grid[1][0].occupantId).toBe('dealer-1');
  });

  it('uses a newly resolved DNA layout when no persisted assignment exists', () => {
    const block = apiBlockToBlockData({
      id: 'canal-claim',
      address: 'Canal Court & Lantern Bridge',
      lat: 26.0437,
      lng: -80.1518,
      placements: [],
    });

    expect(block.dnaId).toBe('canal-court');
    expect(block.grid[3][0].zoneType).toBe('alley');
    expect(block.grid[5][0].zoneType).toBe('parking');
    expect(block.maxMembers).toBe(6);
  });

  it('hydrates the marked canonical grid without rewriting its tactical values', () => {
    const block = apiBlockToBlockData({
      id: 'canonical-claim',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaSnapshot: dnaSnapshot(allRows('sidewalk')),
      gridData: canonicalGrid('parking'),
      metadata: {
        appliedEncounterResultKeys: ['encounter-0:retreated'],
        lastEncounterResultKey: 'encounter-1:secured',
      },
      liveRevision: 7,
      placements: [{
        memberId: 'rome', memberName: 'Rome', role: 'shooter', x: 2, y: 3,
        health: 0,
      }],
    });

    expect(block.gridSource).toBe('server');
    expect(block.grid).toHaveLength(8);
    expect(block.grid.every((row) => row.length === 8)).toBe(true);
    expect(block.grid[3][2]).toMatchObject({
      x: 2,
      y: 3,
      zoneType: 'parking',
      coverScore: 0.77,
      exposureRisk: 12,
      passable: true,
      occupantId: 'rome',
    });
    expect(block.placements[0]).toMatchObject({ x: 2, y: 3, health: 0 });
    expect(block.appliedEncounterResultKeys).toEqual([
      'encounter-0:retreated', 'encounter-1:secured',
    ]);
    expect(block.liveRevision).toBe(7);
  });

  it('uses Python-compatible code-point ordering for deterministic legacy relocation', () => {
    const privateUseId = '\uE000';
    const astralId = '\u{10000}';
    const block = apiBlockToBlockData({
      id: 'ordinal-relocation',
      address: 'Fictional Ordinal Reference',
      lat: 25.7752,
      lng: -80.1748,
      gridData: canonicalGrid('parking'),
      placements: [
        { memberId: astralId, memberName: 'Astral', role: 'shooter', x: 0, y: 0 },
        { memberId: privateUseId, memberName: 'Private', role: 'shooter', x: 0, y: 0 },
      ],
    });

    expect(block.placements.map((placement) => ({
      memberId: placement.memberId, x: placement.x, y: placement.y,
    }))).toEqual([
      { memberId: privateUseId, x: 0, y: 0 },
      { memberId: astralId, x: 1, y: 0 },
    ]);
  });

  it('rejects a malformed marked grid as a whole and uses the saved DNA fallback', () => {
    const malformed = canonicalGrid('parking');
    malformed.grid.tiles[4][5].x = 99;
    const block = apiBlockToBlockData({
      id: 'malformed-grid-claim',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaSnapshot: dnaSnapshot(allRows('alley')),
      gridData: malformed,
      placements: [],
    });

    expect(block.gridSource).toBe('dna-fallback');
    expect(block.grid[4][5]).toMatchObject({
      x: 5,
      y: 4,
      zoneType: 'alley',
      coverScore: 0.92,
      exposureRisk: 10,
    });
    const encounter = prepareEncounter(block);
    for (const row of block.grid) {
      for (const zone of row) {
        expect(encounter.terrain[zone.y][zone.x]).toEqual({
          x: zone.x,
          y: zone.y,
          zoneType: zone.zoneType,
          passable: zone.passable,
          cover: zone.coverScore,
          exposure: zone.exposureRisk / 100,
        });
      }
    }
  });

  it('does not accept legacy terrain bonuses in place of canonical root values', () => {
    const malformed = canonicalGrid('parking');
    const tile = malformed.grid.tiles[4][5] as unknown as Record<string, unknown>;
    delete tile.cover;
    tile.terrain_bonus = { cover: 0.99, visibility: 0.01 };
    const block = apiBlockToBlockData({
      id: 'missing-root-cover',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaSnapshot: dnaSnapshot(allRows('alley')),
      gridData: malformed,
      placements: [],
    });

    expect(block.gridSource).toBe('dna-fallback');
    expect(block.grid[4][5]).toMatchObject({
      zoneType: 'alley',
      coverScore: 0.92,
      exposureRisk: 10,
    });
  });

  it('uses the same stored-id and pinned-legacy identity for a truncated snapshot', () => {
    const malformed = canonicalGrid('parking');
    malformed.grid.tiles[2][3].x = 99;
    const truncated = { ...dnaSnapshot(allRows('alley')), incomeMultiplier: 9.9 };
    delete (truncated as Partial<typeof truncated>).maxMembers;
    const tacticalValues = (value: ReturnType<typeof apiBlockToBlockData>) => value.grid.map(
      row => row.map(zone => ({
        x: zone.x,
        y: zone.y,
        type: zone.zoneType,
        cover: zone.coverScore,
        visibility: zone.exposureRisk / 100,
        deployable: zone.passable,
      })),
    );

    const byStoredId = apiBlockToBlockData({
      id: 'truncated-known-id',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaId: 'harbor-spur',
      dnaSnapshot: truncated,
      gridData: malformed,
      placements: [],
    });
    const expectedStoredId = apiBlockToBlockData({
      id: 'expected-known-id',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaId: 'harbor-spur',
      placements: [],
    });
    expect(tacticalValues(byStoredId)).toEqual(tacticalValues(expectedStoredId));
    expect(byStoredId.incomeMultiplier).toBe(expectedStoredId.incomeMultiplier);
    expect(byStoredId.incomeMultiplier).not.toBe(9.9);

    const unknownSnapshot = { ...truncated, dnaId: 'unknown-dna-id' };
    const byPinnedLegacy = apiBlockToBlockData({
      id: 'truncated-unknown-id',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaId: 'unknown-dna-id',
      dnaSnapshot: unknownSnapshot,
      gridData: malformed,
      placements: [],
    });
    const expectedPinnedLegacy = apiBlockToBlockData({
      id: 'expected-legacy-id',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      placements: [],
    });
    expect(tacticalValues(byPinnedLegacy)).toEqual(tacticalValues(expectedPinnedLegacy));
    expect(byPinnedLegacy.dnaId).toBe(expectedPinnedLegacy.dnaId);
  });

  it('rejects out-of-domain snapshot balance values and falls back by stored id', () => {
    const malformed = { ...dnaSnapshot(), incomeMultiplier: -1 };
    const block = apiBlockToBlockData({
      id: 'negative-income-snapshot',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaId: 'harbor-spur',
      dnaSnapshot: malformed,
      placements: [],
    });

    expect(block.dnaId).toBe('harbor-spur');
    expect(block.incomeMultiplier).toBe(1.45);
  });

  it('hydrates a validated unmarked legacy board for the same encounter terrain', () => {
    const tiles = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({
      x,
      y,
      type: x === 1 ? 'alley' : 'sidewalk',
      terrain_bonus: { cover: 0.4, visibility: x === 1 && y === 1 ? 0.333 : 0.6 },
    })));
    Object.assign(tiles[0][0], { cover: null, visibility: null });
    const block = apiBlockToBlockData({
      id: 'legacy-board',
      address: 'Fictional Legacy Board',
      lat: 25.775,
      lng: -80.175,
      gridData: { tiles },
      placements: [{
        memberId: 'legacy-lookout', memberName: 'Lookout', role: 'lookout',
        gridX: 1, gridY: 1, health: 100,
      }],
    });

    expect(block.gridSource).toBe('legacy');
    expect(block.grid).toHaveLength(8);
    expect(block.grid[0]).toHaveLength(8);
    expect(block.grid[0][0]).toMatchObject({ coverScore: 0, exposureRisk: 100 });
    expect(block.grid[1][1]).toMatchObject({
      zoneType: 'alley', coverScore: 0.4, exposureRisk: 33,
      passable: true, occupantId: 'legacy-lookout',
    });
    expect(prepareEncounter(block).terrain[1][1]).toEqual({
      x: 1,
      y: 1,
      zoneType: 'alley',
      passable: true,
      cover: 0.4,
      exposure: 0.33,
    });
  });

  it('lets snapshot identity outrank an unmarked legacy board', () => {
    const tiles = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({
      x, y, type: 'parking', cover: 0.35, visibility: 0.4, deployable: true,
    })));
    const snapshot = dnaSnapshot(allRows('alley'));
    const block = apiBlockToBlockData({
      id: 'snapshot-before-legacy',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaSnapshot: snapshot,
      gridData: { __dna__: snapshot, tiles },
      placements: [],
    });

    expect(block.gridSource).toBe('dna-fallback');
    expect(block.grid[4][5]).toMatchObject({ zoneType: 'alley', coverScore: 0.92 });
  });

  it('matches JavaScript half-up cover rounding on a DNA fallback tie', () => {
    const snapshot = { ...dnaSnapshot(), globalCoverBonus: 0.005 };
    const malformed = canonicalGrid('parking');
    malformed.grid.tiles[0][0].x = 99;
    const block = apiBlockToBlockData({
      id: 'cover-rounding-tie',
      address: 'Fictional Rounding Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaSnapshot: snapshot,
      gridData: malformed,
      placements: [],
    });

    expect(block.gridSource).toBe('dna-fallback');
    expect(block.grid[0][0].coverScore).toBe(0.31);
  });

  it('rejects string-wrapped boards and sanitizes malformed legacy coordinates', () => {
    const expected = apiBlockToBlockData({
      id: 'expected-sanitized',
      address: 'Unknown',
      lat: 0,
      lng: 0,
      placements: [],
    });
    const malformedCoordinates = apiBlockToBlockData({
      id: 'malformed-coordinates',
      address: 'Unknown',
      lat: [25.7752],
      lng: [-80.1748],
      gridData: JSON.stringify(canonicalGrid('parking')),
      placements: [],
    });
    const hexCoordinates = apiBlockToBlockData({
      id: 'hex-coordinates',
      address: 'Unknown',
      lat: '0x28',
      lng: -74,
      placements: [],
    });
    const underscoredCoordinates = apiBlockToBlockData({
      id: 'underscored-coordinates',
      address: 'Unknown',
      lat: '4_0',
      lng: -74,
      placements: [],
    });
    const stringNested = apiBlockToBlockData({
      id: 'string-nested-grid',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaSnapshot: dnaSnapshot(allRows('alley')),
      gridData: {
        ...canonicalGrid('parking'),
        grid: JSON.stringify(canonicalGrid('parking').grid),
      },
      placements: [],
    });
    const validLegacyTiles = Array.from({ length: 8 }, (_, y) => Array.from(
      { length: 8 },
      (_, x) => ({
        x, y, type: 'sidewalk', cover: 0.3, visibility: 0.5, deployable: true,
      }),
    ));
    const malformedNestedLegacy = apiBlockToBlockData({
      id: 'malformed-nested-legacy',
      address: 'Fictional Legacy Reference',
      lat: 25.77,
      lng: -80.18,
      gridData: {
        grid: { tiles: 'malformed-nested-value' },
        tiles: validLegacyTiles,
      },
      placements: [],
    });
    const oversizedLegacy = apiBlockToBlockData({
      id: 'oversized-legacy',
      address: 'Fictional Legacy Reference',
      lat: 25.77,
      lng: -80.18,
      gridData: { tiles: [...validLegacyTiles, validLegacyTiles[0]] },
      placements: [],
    });

    expect(malformedCoordinates).toMatchObject({
      lat: 0,
      lng: 0,
      dnaId: expected.dnaId,
      gridSource: 'dna-fallback',
    });
    expect(hexCoordinates).toMatchObject({ lat: 0, lng: -74 });
    expect(underscoredCoordinates).toMatchObject({ lat: 0, lng: -74 });
    expect(stringNested.gridSource).toBe('dna-fallback');
    expect(stringNested.grid[4][0]).toMatchObject({ zoneType: 'alley', coverScore: 0.92 });
    expect(malformedNestedLegacy.gridSource).toBe('legacy');
    expect(oversizedLegacy.gridSource).toBe('dna-fallback');
  });

  it('sanitizes legacy placement numerics without NaN or hexadecimal drift', () => {
    const malformedHealth = apiBlockToBlockData({
      id: 'malformed-health', address: 'Fictional Reference', lat: 0, lng: 0,
      gridData: canonicalGrid('parking'),
      placements: [{ memberId: 'bad-health', health: null, x: 0, y: 0 }],
    });
    const underscoredHealth = apiBlockToBlockData({
      id: 'underscored-health', address: 'Fictional Reference', lat: 0, lng: 0,
      gridData: canonicalGrid('parking'),
      placements: [{ memberId: 'bad-health', health: '1_0', x: 0, y: 0 }],
    });
    const malformedLevel = apiBlockToBlockData({
      id: 'malformed-level', address: 'Fictional Reference', lat: 0, lng: 0,
      gridData: canonicalGrid('parking'),
      placements: [{ memberId: 'safe-level', level: 'oops', x: 1, y: 0 }],
    });
    const hexadecimalPosition = apiBlockToBlockData({
      id: 'hex-position', address: 'Fictional Reference', lat: 0, lng: 0,
      gridData: canonicalGrid('parking'),
      placements: [{ memberId: 'relocated', gridX: '0x2', gridY: 0 }],
    });
    const boundedHealth = apiBlockToBlockData({
      id: 'bounded-health', address: 'Fictional Reference', lat: 0, lng: 0,
      gridData: canonicalGrid('parking'),
      placements: [
        { memberId: 'low-health', health: -1, x: 0, y: 0 },
        { memberId: 'high-health', health: 101, x: 1, y: 0 },
      ],
    });

    expect(malformedHealth.placements).toEqual([]);
    expect(underscoredHealth.placements).toEqual([]);
    expect(malformedLevel.placements[0]).toMatchObject({ level: 1, x: 1, y: 0 });
    expect(hexadecimalPosition.placements[0]).toMatchObject({ x: 0, y: 0 });
    expect(boundedHealth.placements.map((placement) => placement.health).sort()).toEqual([0, 100]);
  });

  it('keeps the persisted cover bonus when a Supabase projection has only a DNA id', () => {
    const block = apiBlockToBlockData({
      id: 'persisted-cover-claim',
      address: 'Fictional Harbor Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaId: 'harbor-spur',
      globalCoverBonus: -0.07,
      placements: [],
    });

    expect(block.gridSource).toBe('dna-fallback');
    expect(block.globalCoverBonus).toBe(-0.07);
  });

  it('adds a claim backdrop without rewriting server-authored state or a valid zero', () => {
    const serverBlock = apiBlockToBlockData({
      id: 'server-claim',
      address: 'Verified Address',
      lat: 25.77,
      lng: -80.18,
      heatLevel: 0,
      dnaSnapshot: dnaSnapshot(allRows('sidewalk')),
      gridData: canonicalGrid('parking'),
      placements: [],
    });

    const projected = withClaimBackdrop(serverBlock, '/verified-satellite.webp');

    expect(projected).toMatchObject({
      address: 'Verified Address',
      lat: 25.77,
      lng: -80.18,
      heat: 0,
      dnaId: 'harbor-spur',
      incomeMultiplier: 1.45,
      maxMembers: 6,
      topdownBgUrl: '/verified-satellite.webp',
    });
    expect(projected.grid).toBe(serverBlock.grid);
  });
});
