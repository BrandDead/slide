import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GhostThreatBanner from './GhostThreatBanner';
import { useGhostStore, type GhostFeedEvent } from '../../stores/ghostCrewStore';
import { useNavigationStore } from '../../stores/gameStore';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';

const stripAttack: GhostFeedEvent = {
  id: 'feed-tick-2:ghost-nightfall:attack',
  actionKey: 'tick-2:ghost-nightfall:attack',
  crewId: 'ghost-nightfall',
  crewName: 'Nightfall Crew',
  action: 'attack',
  description: 'Nightfall Crew is probing 1208 W Las Olas Blvd.',
  targetBlockId: BLOCK_LOOP_IDS.blockId,
  timestamp: 2,
};

describe('GhostThreatBanner', () => {
  beforeEach(() => {
    useGhostStore.setState({ feed: [], appliedResponseKeys: [] });
    useNavigationStore.getState().navigateTo('home');
  });

  it('routes an open Strip attack to the Strip', async () => {
    useGhostStore.setState({ feed: [stripAttack] });
    render(<GhostThreatBanner />);
    expect(screen.getByText(/probing 1208/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Defend' }));
    expect(useNavigationStore.getState().currentApp).toBe('block_loop');
    // On the Strip desk the banner gets out of the way of the placement controls.
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('stays quiet for answered attacks and defense results', () => {
    useGhostStore.setState({
      feed: [
        { ...stripAttack, id: 'defense-x', actionKey: 'defense:x', reason: 'defense-held', description: 'Your crew held.' },
        stripAttack,
      ],
      appliedResponseKeys: [stripAttack.actionKey!],
    });
    render(<GhostThreatBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => {
      useGhostStore.setState({ appliedResponseKeys: [] });
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/probing 1208/i);
  });

  it('shows the retaliation warning for a booked player attack on rival turf', () => {
    useGhostStore.setState({
      feed: [{ ...stripAttack, targetBlockId: 'ghost-nightfall-turf', actionKey: 'player-hit', description: 'Nightfall will remember your hit.' }],
      appliedResponseKeys: ['player-hit'],
    });
    render(<GhostThreatBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('Nightfall will remember your hit.');
  });

});
