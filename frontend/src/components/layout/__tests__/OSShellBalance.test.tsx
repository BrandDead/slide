import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OSShell from '../OSShell';
import { usePlayerStore, useGangStore } from '../../../stores/gameStore';
import { useGhostStore } from '../../../stores/ghostCrewStore';
import { useBlockLoopStore } from '../../../stores/blockLoopStore';
import { createLoopState } from '../../../game/loop/blockLoopFixture';

vi.mock('../../common/GameSprite', () => ({ GameSprite: ({ fallback }: { fallback: string }) => <span>{fallback}</span> }));

describe('command desk authoritative street cash', () => {
  beforeEach(() => {
    useGhostStore.setState({ feed: [], appliedResponseKeys: [] });
    useGangStore.setState({ members: [] });
    useBlockLoopStore.setState({ loop: createLoopState(), started: false });
  });

  it.each(['account-123', 'demo-player'])('shows and refreshes the live player balance for %s', id => {
    usePlayerStore.getState().updatePlayer({ id, money: 320 });
    render(<OSShell />);
    const card = screen.getByRole('region', { name: 'Your block: 1208 Las Olas' });
    expect(card).toHaveTextContent('street cash $320');
    act(() => usePlayerStore.getState().updatePlayer({ money: 570 }));
    expect(card).toHaveTextContent('street cash $570');
    expect(useBlockLoopStore.getState().loop.money).toBe(12_000);
  });
});
