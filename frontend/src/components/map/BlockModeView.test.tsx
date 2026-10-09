import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BlockModeView from './BlockModeView';
import { useBlockStore } from '../../stores/blockStore';
import { usePlayerStore } from '../../stores/gameStore';
import { commitEncounterResult } from '../../services/worldPersistence.service';
import type { CombatResult } from '../../game/combat/types';
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
  default: ({ onResolved }: { onResolved: (result: CombatResult) => void }) => <div>Encounter board
    <button type="button" onClick={() => {
      const result: CombatResult = { idempotencyKey: 'response-once', outcome: 'retreated', crewDown: [], oppositionDown: [], objectiveProgress: 0, heatDelta: 1, moraleDelta: -4, pendingIncomeDelta: -15, summary: 'Crew returned' };
      onResolved(result); onResolved(result);
    }}>Resolve twice</button>
  </div>,
}));
vi.mock('../ops/ModernOpsEncounter', () => ({
  default: () => <div>Modern ops</div>,
}));
vi.mock('../slide/BlockDriveByEngine', () => ({
  default: () => <div>Drive-by</div>,
}));

describe('BlockModeView beta chrome', () => {
  beforeEach(() => {
    vi.mocked(commitEncounterResult).mockClear();
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

  it('keeps diorama, board, and encounter as the only Strip tabs and forwards map failure', async () => {
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Encounter' })[0]);
    expect(await screen.findByText(/encounter board/i)).toBeInTheDocument();
  });

  it('applies player heat, block consequences and the server receipt only once', async () => {
    const heat = usePlayerStore.getState().player.heat;
    render(<BlockModeView initialBlockId={BLOCK_LOOP_IDS.blockId} autoStartEncounter />);
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve twice' }));
    expect(usePlayerStore.getState().player.heat).toBe(Math.min(5, heat + 1));
    expect(useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId].appliedEncounterResultKeys).toEqual(['response-once']);
    expect(commitEncounterResult).toHaveBeenCalledTimes(1);
  });

  it('keeps all-downed or foreign blocks in planning for auto and manual entry', () => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    useBlockStore.getState().upsertBlock({ ...block, placements: block.placements.map(p => ({ ...p, health: 0 })) });
    render(<BlockModeView initialBlockId={block.id} autoStartEncounter />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Encounter' })[1]);
    expect(screen.queryByText(/encounter board/i)).not.toBeInTheDocument();
    expect(screen.getByText(/position an active shooter/i)).toBeInTheDocument();
  });
});
