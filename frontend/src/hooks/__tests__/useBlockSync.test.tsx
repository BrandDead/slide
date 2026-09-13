import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useBlockSync } from '../useBlockSync';
import { useBlockStore } from '../../stores/blockStore';
import { usePlayerStore } from '../../stores/gameStore';
import type { BlockData } from '../../types/block.types';

const {
  loadPlayerBlocks,
  loadPlacements,
  persistBlock,
  persistPlacements,
} = vi.hoisted(() => ({
  loadPlayerBlocks: vi.fn(),
  loadPlacements: vi.fn(),
  persistBlock: vi.fn(),
  persistPlacements: vi.fn(),
}));

vi.mock('../../services/blockPersistence.service', () => ({
  loadPlayerBlocks,
  loadPlacements,
  persistBlock,
  persistPlacements,
}));

function existingBlock(): BlockData {
  return {
    id: 'block-1',
    address: 'Flask canonical block',
    lat: 25.77,
    lng: -80.18,
    owner: 'player',
    grid: [],
    placements: [],
    incomePerTick: 0,
    heat: 2,
    morale: 70,
    members: 0,
    viewMode: 'topdown',
    pendingIncome: 0,
  };
}

describe('useBlockSync hydration receipts', () => {
  beforeEach(() => {
    loadPlayerBlocks.mockReset();
    loadPlacements.mockReset();
    persistBlock.mockReset();
    persistPlacements.mockReset();
    loadPlayerBlocks.mockResolvedValue([]);
    loadPlacements.mockResolvedValue([]);
    persistBlock.mockResolvedValue(true);
    persistPlacements.mockResolvedValue(undefined);
    usePlayerStore.setState((state) => ({
      ...state,
      player: { ...state.player, id: 'player-1' },
    }));
    useBlockStore.setState({ blocks: { 'block-1': existingBlock() } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('imports Supabase receipts into an existing Flask block without replacing its grid state', async () => {
    loadPlayerBlocks.mockResolvedValue([{
      id: 'block-1',
      address: 'Partial Supabase projection',
      appliedEncounterResultKeys: ['encounter-1:overrun'],
      heat: 4,
      morale: 58,
      pendingIncome: 50,
      liveRevision: 4,
    }]);

    const hook = renderHook(() => useBlockSync(true));
    await waitFor(() => expect(
      useBlockStore.getState().blocks['block-1'].appliedEncounterResultKeys,
    ).toEqual(['encounter-1:overrun']));

    const hydrated = useBlockStore.getState().blocks['block-1'];
    expect(hydrated.address).toBe('Flask canonical block');
    expect(hydrated).toMatchObject({
      heat: 4,
      morale: 58,
      pendingIncome: 50,
    });
    expect(hydrated.liveRevision).toBeUndefined();
    expect(loadPlacements).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('does not regress consequence fields when Supabase repeats an already-known receipt', async () => {
    useBlockStore.setState({
      blocks: {
        'block-1': {
          ...existingBlock(),
          heat: 4,
          morale: 58,
          pendingIncome: 50,
          appliedEncounterResultKeys: ['encounter-1:overrun'],
        },
      },
    });
    loadPlayerBlocks.mockResolvedValue([{
      id: 'block-1',
      appliedEncounterResultKeys: ['encounter-1:overrun'],
      heat: 2,
      morale: 70,
      pendingIncome: 100,
    }]);

    const hook = renderHook(() => useBlockSync(true));
    await waitFor(() => expect(loadPlayerBlocks).toHaveBeenCalled());

    expect(useBlockStore.getState().blocks['block-1']).toMatchObject({
      heat: 4,
      morale: 58,
      pendingIncome: 50,
    });
    hook.unmount();
  });

  it('unions an unrelated older receipt without importing its stale consequence fields', async () => {
    useBlockStore.setState({
      blocks: {
        'block-1': {
          ...existingBlock(),
          heat: 4,
          morale: 58,
          pendingIncome: 50,
          appliedEncounterResultKeys: ['encounter-current:overrun'],
        },
      },
    });
    loadPlayerBlocks.mockResolvedValue([{
      id: 'block-1',
      appliedEncounterResultKeys: ['encounter-older:secured'],
      heat: 1,
      morale: 90,
      pendingIncome: 500,
    }]);

    const hook = renderHook(() => useBlockSync(true));
    await waitFor(() => expect(
      useBlockStore.getState().blocks['block-1'].appliedEncounterResultKeys,
    ).toEqual(['encounter-older:secured', 'encounter-current:overrun']));

    expect(useBlockStore.getState().blocks['block-1']).toMatchObject({
      heat: 4,
      morale: 58,
      pendingIncome: 50,
    });
    hook.unmount();
  });

  it('re-checks Flask ownership after an in-flight placement hydration', async () => {
    useBlockStore.setState({ blocks: {} });
    let resolvePlacements!: (placements: []) => void;
    loadPlayerBlocks.mockResolvedValue([{
      id: 'block-1',
      address: 'Partial Supabase projection',
      appliedEncounterResultKeys: ['encounter-race:secured'],
    }]);
    loadPlacements.mockReturnValue(new Promise<[]>(resolve => {
      resolvePlacements = resolve;
    }));

    const hook = renderHook(() => useBlockSync(true));
    await waitFor(() => expect(loadPlacements).toHaveBeenCalledWith('block-1'));

    act(() => {
      useBlockStore.getState().upsertBlock(existingBlock());
      resolvePlacements([]);
    });
    await waitFor(() => expect(
      useBlockStore.getState().blocks['block-1'].appliedEncounterResultKeys,
    ).toEqual(['encounter-race:secured']));

    expect(useBlockStore.getState().blocks['block-1'].address).toBe('Flask canonical block');
    hook.unmount();
  });

  it('leaves destructive placement persistence to Flask when block projection is rejected', async () => {
    vi.useFakeTimers();
    persistBlock.mockResolvedValue(false);

    const hook = renderHook(() => useBlockSync(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(persistBlock).toHaveBeenCalled();
    expect(persistPlacements).not.toHaveBeenCalled();
    hook.unmount();
  });
});
