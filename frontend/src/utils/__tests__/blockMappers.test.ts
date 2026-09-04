import { describe, expect, it } from 'vitest';
import { apiBlockToBlockData } from '../blockMappers';

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
});
