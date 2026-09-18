import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BlockModeView from './BlockModeView';
import { useBlockStore } from '../../stores/blockStore';
import { applyDemoSeed } from '../../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';

vi.mock('../../services/worldPersistence.service', () => ({
  commitEncounterResult: vi.fn(async () => null),
}));
vi.mock('./TacticalDiorama', () => ({
  default: ({ mapContext }: { mapContext?: { status: string } }) => (
    <div>Diorama scene {mapContext?.status ?? 'none'}</div>
  ),
}));
vi.mock('./TopDownBlock', () => ({
  default: () => <div>Legal board fallback</div>,
}));
vi.mock('../encounter/UnifiedEncounter', () => ({
  default: () => <div>Encounter board</div>,
}));
vi.mock('../ops/ModernOpsEncounter', () => ({
  default: () => <div>Modern ops</div>,
}));
vi.mock('../slide/BlockDriveByEngine', () => ({
  default: () => <div>Drive-by</div>,
}));

describe('BlockModeView beta chrome', () => {
  beforeEach(() => {
    useBlockStore.setState({
      blocks: {},
      selectedBlockId: null,
      activeDriveBys: {},
      isPlacementMode: false,
      pendingPlacementMemberId: null,
      pendingPlacementMember: null,
    });
    applyDemoSeed();
  });

  it('keeps diorama, board, and encounter as the only Strip tabs and forwards map failure', () => {
    render(
      <BlockModeView
        initialBlockId={BLOCK_LOOP_IDS.blockId}
        mapContext={{ status: 'failed', reason: 'tiles down' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Diorama' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Encounter' }).length).toBe(2);
    expect(screen.queryByRole('button', { name: /ops 3d/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /raid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /drugs/i })).not.toBeInTheDocument();
    expect(screen.getByText(/diorama scene failed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(screen.getByText(/legal board fallback/i)).toBeInTheDocument();
  });
});
