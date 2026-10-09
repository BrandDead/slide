import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TerritoryMap from './TerritoryMap';
import { useCombatIntentStore } from '../../stores/combatIntentStore';
import { useBlockStore } from '../../stores/blockStore';
import { useGangStore } from '../../stores/gameStore';
import { applyDemoSeed } from '../../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';

const launched = vi.hoisted(() => [] as string[]);
vi.mock('./PlayableMap', () => ({ default: () => <div>Street imagery unavailable</div> }));
vi.mock('./BlockModeView', () => ({
  default: function MockBlockModeView({ initialBlockId, autoStartEncounter, onAutoEncounterStarted }: {
    initialBlockId: string; autoStartEncounter: boolean; onAutoEncounterStarted: () => void;
  }) {
    useEffect(() => {
      if (autoStartEncounter) { launched.push(initialBlockId); onAutoEncounterStarted(); }
    }, [initialBlockId, autoStartEncounter, onAutoEncounterStarted]);
    return <div>Block planning {initialBlockId}</div>;
  },
}));

describe('MAP consumes the canonical response once', () => {
  beforeEach(() => {
    launched.length = 0;
    useBlockStore.setState({ blocks: {}, selectedBlockId: null });
    applyDemoSeed();
    useCombatIntentStore.getState().reset();
  });

  it('opens the selected existing encounter while optional street imagery is absent', () => {
    useCombatIntentStore.getState().queueBlockResponse(BLOCK_LOOP_IDS.blockId);
    const { unmount } = render(<TerritoryMap />);
    expect(launched).toEqual([BLOCK_LOOP_IDS.blockId]);
    expect(useCombatIntentStore.getState().pendingEncounterBlockId).toBeNull();
    unmount();
    render(<TerritoryMap />);
    expect(launched).toHaveLength(1);
  });

  it('does not substitute a scout when crew becomes invalid before the route loads', () => {
    useCombatIntentStore.getState().queueBlockResponse(BLOCK_LOOP_IDS.blockId);
    useGangStore.getState().updateMember('demo-enforcer-1', { status: 'hospitalized' });
    render(<TerritoryMap />);
    expect(launched).toEqual([]);
    expect(screen.getByText(/crew or block changed/i)).toBeInTheDocument();
  });
});
