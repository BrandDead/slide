/**
 * Graffiti → territory wiring.
 *
 * A successful tag has to be visible to the block store, otherwise the
 * territory layer has no idea the block was attacked.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyTagToBlock,
  createNpcBlockStub,
  clampHeat,
  clampMorale,
  BLOCK_HEAT_MAX,
  BLOCK_MORALE_MAX,
} from '../graffitiTerritory';
import { useBlockStore } from '../../../stores/blockStore';

const GANG = 'BROWNIE$';

function reset() {
  useBlockStore.setState({ blocks: {}, selectedBlockId: null } as never);
}

function seedPlayerBlock(id: string, heat = 1, morale = 60) {
  const block = { ...createNpcBlockStub(id, 'Seeded Block'), owner: 'player' as const, heat, morale };
  useBlockStore.getState().upsertBlock(block);
  return block;
}

describe('graffitiTerritory — clamps', () => {
  it('keeps block heat inside the 0-5 band', () => {
    expect(clampHeat(-3)).toBe(0);
    expect(clampHeat(99)).toBe(BLOCK_HEAT_MAX);
    expect(clampHeat(3)).toBe(3);
  });

  it('keeps morale inside 0-100', () => {
    expect(clampMorale(-10)).toBe(0);
    expect(clampMorale(500)).toBe(BLOCK_MORALE_MAX);
    expect(clampMorale(42)).toBe(42);
  });
});

describe('graffitiTerritory — applyTagToBlock', () => {
  beforeEach(reset);

  it('creates an npc-owned entry for a block the store has never seen', () => {
    const result = applyTagToBlock({
      blockId: 'npc-block-1',
      blockName: 'Sistrunk & 7th',
      gangName: GANG,
      heatGained: 2,
      moraleChange: 10,
    });

    expect(result).not.toBeNull();
    expect(result?.owner).toBe('npc');
    expect(useBlockStore.getState().getBlock('npc-block-1')).toBeDefined();
  });

  it('records the tagging gang and a timestamp', () => {
    const result = applyTagToBlock({
      blockId: 'b1', blockName: 'B1', gangName: GANG, heatGained: 1, moraleChange: 5,
    });
    expect(result?.taggedBy).toBe(GANG);
    expect(result?.taggedAt).toBeTruthy();
  });

  it('raises block heat by the amount gained', () => {
    seedPlayerBlock('b2', 1, 60);
    const result = applyTagToBlock({
      blockId: 'b2', blockName: 'B2', gangName: GANG, heatGained: 2, moraleChange: 0,
    });
    expect(result?.heat).toBe(3);
  });

  it('lowers the defending block morale by the attacker morale boost', () => {
    seedPlayerBlock('b3', 0, 60);
    const result = applyTagToBlock({
      blockId: 'b3', blockName: 'B3', gangName: GANG, heatGained: 0, moraleChange: 15,
    });
    expect(result?.morale).toBe(45);
  });

  it('clamps heat at the top of the band rather than overflowing', () => {
    seedPlayerBlock('b4', 4, 50);
    const result = applyTagToBlock({
      blockId: 'b4', blockName: 'B4', gangName: GANG, heatGained: 40, moraleChange: 0,
    });
    expect(result?.heat).toBe(BLOCK_HEAT_MAX);
  });

  it('clamps morale at zero rather than going negative', () => {
    seedPlayerBlock('b5', 0, 10);
    const result = applyTagToBlock({
      blockId: 'b5', blockName: 'B5', gangName: GANG, heatGained: 0, moraleChange: 90,
    });
    expect(result?.morale).toBe(0);
  });

  it('does not change the block owner — tagging pressures, it does not capture', () => {
    seedPlayerBlock('b6');
    const result = applyTagToBlock({
      blockId: 'b6', blockName: 'B6', gangName: GANG, heatGained: 1, moraleChange: 5,
    });
    expect(result?.owner).toBe('player');
  });

  it('preserves placements and pending income on an existing block', () => {
    const seeded = seedPlayerBlock('b7');
    useBlockStore.getState().upsertBlock({ ...seeded, pendingIncome: 250 });

    const result = applyTagToBlock({
      blockId: 'b7', blockName: 'B7', gangName: GANG, heatGained: 1, moraleChange: 5,
    });
    expect(result?.pendingIncome).toBe(250);
  });

  it('returns null when there is no block to attribute the tag to', () => {
    expect(applyTagToBlock({
      blockId: '', blockName: '', gangName: GANG, heatGained: 1, moraleChange: 1,
    })).toBeNull();
  });

  it('a second tag stacks onto the first', () => {
    applyTagToBlock({ blockId: 'b8', blockName: 'B8', gangName: GANG, heatGained: 1, moraleChange: 5 });
    const second = applyTagToBlock({
      blockId: 'b8', blockName: 'B8', gangName: 'OTHER', heatGained: 1, moraleChange: 5,
    });
    expect(second?.heat).toBe(2);
    expect(second?.taggedBy).toBe('OTHER');
  });
});

describe('graffitiTerritory — npc stub', () => {
  beforeEach(reset);

  it('builds a full 8x8 grid so territory views can render it', () => {
    const stub = createNpcBlockStub('x', 'X Block');
    expect(stub.grid).toHaveLength(8);
    expect(stub.grid[0]).toHaveLength(8);
  });

  it('carries no phantom income or placements', () => {
    const stub = createNpcBlockStub('x', 'X Block');
    expect(stub.placements).toHaveLength(0);
    expect(stub.incomePerTick).toBe(0);
    expect(stub.pendingIncome).toBe(0);
  });
});
