import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Leaderboard from './Leaderboard';
import { usePlayerStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';

const localBlock = {
  id: 'local-block',
  address: 'Fictional Las Olas Block',
  owner: 'player' as const,
  incomePerTick: 325,
  heat: 2,
  morale: 74,
  grid: [],
  placements: [],
  members: 0,
  pendingIncome: 0,
  viewMode: 'topdown' as const,
};

describe('Leaderboard local-only fallback', () => {
  beforeEach(() => {
    usePlayerStore.setState((state) => ({
      player: {
        ...state.player,
        id: 'demo-player',
        username: 'Demo Boss',
        gangName: 'Local Crew',
      },
    }));
    useBlockStore.setState({ blocks: { [localBlock.id]: localBlock } as any });
  });

  it('labels the player row as a local snapshot without claiming a global rank', async () => {
    render(<Leaderboard />);

    expect(await screen.findByText('Local Snapshot')).toBeInTheDocument();
    expect(screen.getByText(/global rankings are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getAllByText('Local Crew')).toHaveLength(2);
    expect(screen.queryByText('Your Rank')).not.toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
  });

  it('does not offer a network retry when global rankings are intentionally disabled', async () => {
    useBlockStore.setState({ blocks: {} });

    render(<Leaderboard />);

    expect(await screen.findByText(/global rankings are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});
