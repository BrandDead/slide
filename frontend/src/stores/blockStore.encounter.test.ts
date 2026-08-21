import { beforeEach, describe, expect, it } from 'vitest';
import { useBlockStore } from './blockStore';
import type { BlockData } from '../types/block.types';
import type { CombatResult } from '../game/combat/types';

function block(): BlockData {
  return {
    id: 'block-1',
    address: 'Fictional Reference',
    lat: 0,
    lng: 0,
    owner: 'player',
    grid: [[{
      x: 0, y: 0, zoneType: 'sidewalk', incomeModifier: 60, exposureRisk: 50,
      coverScore: 0.3, passable: true, occupantId: 'crew-1',
    }]],
    placements: [{
      memberId: 'crew-1', memberName: 'Scout', role: 'shooter', x: 0, y: 0,
      zoneType: 'sidewalk', incomePerTick: 0, exposureRisk: 50, level: 1, health: 100,
    }],
    incomePerTick: 0,
    heat: 2,
    morale: 70,
    members: 1,
    viewMode: 'topdown',
    pendingIncome: 100,
  };
}

const result: CombatResult = {
  idempotencyKey: 'encounter-1:overrun',
  outcome: 'overrun',
  crewDown: ['crew-1'],
  oppositionDown: [],
  objectiveProgress: 0,
  heatDelta: 2,
  moraleDelta: -12,
  pendingIncomeDelta: -50,
  summary: 'The crew was overrun.',
};

describe('blockStore unified encounter outcomes', () => {
  beforeEach(() => {
    useBlockStore.setState({
      blocks: { 'block-1': block() },
      selectedBlockId: 'block-1',
      activeDriveBys: {},
      isPlacementMode: false,
      pendingPlacementMemberId: null,
      pendingPlacementMember: null,
    });
  });

  it('projects a result exactly once and bounds the durable consequences', () => {
    useBlockStore.getState().applyEncounterResult('block-1', result);
    useBlockStore.getState().applyEncounterResult('block-1', result);
    const resolved = useBlockStore.getState().blocks['block-1'];

    expect(resolved.placements[0].health).toBe(0);
    expect(resolved.heat).toBe(4);
    expect(resolved.morale).toBe(58);
    expect(resolved.pendingIncome).toBe(50);
    expect(resolved.appliedEncounterResultKeys).toEqual(['encounter-1:overrun']);
  });
});
