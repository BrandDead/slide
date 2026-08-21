import { describe, expect, it } from 'vitest';
import { blockFootprint, toFeatureCollection } from '../BlockOverlay';
import { buildPlacementGeoJson } from '../TacticalPlacementOverlay';
import type { BlockData, BlockZone } from '../../../types/block.types';

function zone(x: number, y: number, overrides: Partial<BlockZone> = {}): BlockZone {
  return {
    x,
    y,
    zoneType: y === 0 ? 'street' : 'sidewalk',
    incomeModifier: 50,
    exposureRisk: y === 0 ? 80 : 35,
    coverScore: y === 0 ? 0.1 : 0.45,
    passable: true,
    occupantId: null,
    ...overrides,
  };
}

function block(): BlockData {
  return {
    id: 'las-olas-home',
    address: '1208 W Las Olas Blvd, Fort Lauderdale, FL 33312',
    lat: 26.1201,
    lng: -80.1348,
    owner: 'player',
    grid: [
      [zone(0, 0), zone(1, 0)],
      [zone(0, 1), zone(1, 1, { occupantId: 'crew-1' })],
    ],
    placements: [{
      memberId: 'crew-1',
      memberName: 'Scout',
      role: 'lookout',
      x: 1,
      y: 1,
      zoneType: 'sidewalk',
      incomePerTick: 0,
      exposureRisk: 35,
      level: 1,
      health: 100,
    }],
    incomePerTick: 0,
    heat: 1,
    morale: 80,
    members: 1,
    viewMode: 'topdown',
    pendingIncome: 0,
  };
}

describe('playable map geometry', () => {
  it('builds a closed, non-zero fictionalized block footprint around the selected coordinates', () => {
    const polygon = blockFootprint(26.1201, -80.1348);
    expect(polygon).toHaveLength(5);
    expect(polygon[0]).toEqual(polygon[4]);
    expect(polygon[0][0]).toBeLessThan(polygon[1][0]);
    expect(polygon[0][1]).toBeLessThan(polygon[3][1]);
  });

  it('marks the selected block consistently on both footprint and pin features', () => {
    const collection = toFeatureCollection([block()], 'las-olas-home');
    expect(collection.features).toHaveLength(2);
    expect(collection.features.every((feature) => feature.properties.selected === 1)).toBe(true);
    expect(collection.features.map((feature) => feature.properties.kind).sort()).toEqual(['footprint', 'pin']);
  });

  it('anchors every tactical cell and current member to the selected block', () => {
    const collection = buildPlacementGeoJson(block());
    const cells = collection.features.filter((feature) => feature.properties.kind === 'cell');
    const members = collection.features.filter((feature) => feature.properties.kind === 'member');

    expect(cells).toHaveLength(4);
    expect(members).toHaveLength(1);
    const cellProperties = cells.map((feature) => feature.properties as {
      x: number;
      y: number;
      occupied: number;
    });
    expect(cellProperties.find((properties) => properties.x === 1 && properties.y === 1)?.occupied).toBe(1);

    const allCoordinates = cells.flatMap((feature) => (
      feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : []
    ));
    expect(allCoordinates.every(([lng, lat]) => Math.abs(lng + 80.1348) < 0.001 && Math.abs(lat - 26.1201) < 0.001)).toBe(true);
  });
});
