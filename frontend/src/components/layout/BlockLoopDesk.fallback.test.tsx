/**
 * When the Las Olas diorama throws, the RouteLoadBoundary fallback must be a
 * loop-aware 8×8 board: cell clicks call useBlockLoopStore.place, not only
 * the global blockStore placement path.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useBlockStore } from '../../stores/blockStore';
import { useDrugInventory } from '../../stores/useDrugInventory';
import { useBlockLoopStore } from '../../stores/blockLoopStore';
import { applyDemoSeed } from '../../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';
import { clearLoopLedger } from '../../game/loop/blockLoopPersist';
import { streetVsSafetyPreview } from '../../game/loop/placementRules';

vi.mock('../map/TacticalDiorama', () => ({
  default: () => {
    throw new Error('WebGL unavailable');
  },
}));

vi.mock('../encounter/UnifiedEncounter', () => ({
  default: () => <div>Encounter board</div>,
}));

import BlockLoopDesk from './BlockLoopDesk';

describe('BlockLoopDesk diorama fallback board', () => {
  beforeEach(() => {
    useBlockStore.setState({
      blocks: {},
      selectedBlockId: null,
      activeDriveBys: {},
      isPlacementMode: false,
      pendingPlacementMemberId: null,
      pendingPlacementMember: null,
    });
    useDrugInventory.setState({ inventory: {}, assignments: {} });
    useBlockLoopStore.setState({ started: false });
    clearLoopLedger();
    applyDemoSeed();
  });

  it('advances loop placement from a fallback board cell click', () => {
    render(<BlockLoopDesk />);

    fireEvent.click(screen.getByRole('button', { name: /lock dre and rome/i }));

    expect(screen.getByTestId('route-diorama-error')).toBeInTheDocument();
    expect(screen.getByText(/diorama could not load/i)).toBeInTheDocument();

    const loop = useBlockLoopStore.getState().loop;
    expect(loop.phase).toBe('placement');
    const preview = streetVsSafetyPreview(loop.block, loop.members[0]?.level ?? 2);

    // Place dealer on the street-near (high exposure) deployable cell via the board.
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`^${preview.street.zoneType} ${preview.street.x},${preview.street.y}`),
      }),
    );

    const afterDealer = useBlockLoopStore.getState().loop;
    expect(afterDealer.block.placements.some((p) => p.memberId === BLOCK_LOOP_IDS.dealerId)).toBe(true);
    expect(afterDealer.phase).toBe('placement');

    // Switch to shooter and place on the safer cell — proves both members/cells work.
    fireEvent.click(screen.getByRole('button', { name: /^shooter$/i }));
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`^${preview.safety.zoneType} ${preview.safety.x},${preview.safety.y}`),
      }),
    );

    const afterBoth = useBlockLoopStore.getState().loop;
    expect(afterBoth.block.placements.some((p) => p.memberId === BLOCK_LOOP_IDS.shooterId)).toBe(true);
    expect(afterBoth.phase).toBe('product');
    expect(screen.getByRole('button', { name: /put river cut on dre/i })).toBeInTheDocument();
  });
});
