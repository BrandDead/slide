/**
 * Cocaine Crush — session earnings routed to the active block.
 *
 * Per-match inventory deduction already lives in the component
 * (verifyAndApplyEconomy) and is exercised through the economy store
 * below; the session-level tie-back is what this file covers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { depositSessionEarnings } from '../cocaineCrushPayout';
import { useBlockStore } from '../../../stores/blockStore';
import { useEconomyStore } from '../../../stores/gameStore';
import { createNpcBlockStub } from '../../graffiti/graffitiTerritory';

function resetBlocks() {
  useBlockStore.setState({ blocks: {}, selectedBlockId: null } as never);
}

function seedSelectedBlock(id = 'corner-1', pendingIncome = 0) {
  const block = { ...createNpcBlockStub(id, 'Corner'), owner: 'player' as const, pendingIncome };
  useBlockStore.getState().upsertBlock(block);
  useBlockStore.getState().selectBlock(id);
  return block;
}

describe('cocaineCrush — session payout', () => {
  beforeEach(resetBlocks);

  it('credits earnings to the selected block as pending income', () => {
    seedSelectedBlock('corner-1', 0);
    const result = depositSessionEarnings(450);

    expect(result?.blockId).toBe('corner-1');
    expect(result?.deposited).toBe(450);
    expect(useBlockStore.getState().getBlock('corner-1')?.pendingIncome).toBe(450);
  });

  it('adds to income already pending rather than replacing it', () => {
    seedSelectedBlock('corner-2', 200);
    const result = depositSessionEarnings(300);
    expect(result?.pendingIncome).toBe(500);
  });

  it('floors fractional earnings', () => {
    seedSelectedBlock('corner-3', 0);
    expect(depositSessionEarnings(99.9)?.deposited).toBe(99);
  });

  it('deposits nothing when no block is selected', () => {
    useBlockStore.getState().upsertBlock(createNpcBlockStub('corner-4', 'Corner'));
    expect(depositSessionEarnings(500)).toBeNull();
  });

  it('deposits nothing when the selected block is unknown', () => {
    useBlockStore.setState({ blocks: {}, selectedBlockId: 'ghost' } as never);
    expect(depositSessionEarnings(500)).toBeNull();
  });

  it('ignores a zero-earning session', () => {
    seedSelectedBlock('corner-5', 100);
    expect(depositSessionEarnings(0)).toBeNull();
    expect(useBlockStore.getState().getBlock('corner-5')?.pendingIncome).toBe(100);
  });

  it('ignores non-finite input rather than writing NaN to the block', () => {
    seedSelectedBlock('corner-6', 100);
    expect(depositSessionEarnings(Number.NaN)).toBeNull();
    expect(useBlockStore.getState().getBlock('corner-6')?.pendingIncome).toBe(100);
  });

  it('leaves the rest of the block untouched', () => {
    seedSelectedBlock('corner-7', 0);
    depositSessionEarnings(120);
    const block = useBlockStore.getState().getBlock('corner-7');
    expect(block?.owner).toBe('player');
    expect(block?.grid).toHaveLength(8);
  });
});

describe('cocaineCrush — inventory consumption', () => {
  beforeEach(() => {
    useEconomyStore.setState({
      inventory: [
        { id: '1', type: 'drug', itemId: 'weed', name: 'Cannabis', quantity: 5, value: 20 },
      ],
    } as never);
  });

  it('a cleared match consumes stock from the economy store', () => {
    useEconomyStore.getState().removeInventoryItem('weed', 3);
    expect(useEconomyStore.getState().inventory.find((i) => i.itemId === 'weed')?.quantity).toBe(2);
  });

  it('running a drug to zero removes it from inventory, ending the board refill', () => {
    useEconomyStore.getState().removeInventoryItem('weed', 5);
    expect(useEconomyStore.getState().inventory.find((i) => i.itemId === 'weed')).toBeUndefined();
  });

  it('never drives a stock count negative', () => {
    useEconomyStore.getState().removeInventoryItem('weed', 999);
    expect(useEconomyStore.getState().inventory).toHaveLength(0);
  });
});
