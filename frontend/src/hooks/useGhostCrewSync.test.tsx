import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGhostCrewSync } from './useGhostCrewSync';
import { useGhostStore } from '../stores/ghostCrewStore';
import { useNotificationStore } from '../stores/gameStore';

const { loadAuthoritativeWorld } = vi.hoisted(() => ({
  loadAuthoritativeWorld: vi.fn(),
}));

vi.mock('../services/worldPersistence.service', () => ({
  loadAuthoritativeWorld,
}));

vi.mock('../utils/demoSeed', () => ({
  IS_DEMO_MODE: false,
}));

const serverEvent = {
  id: 'server-world-event-42',
  crewId: 'ghost-nightfall',
  crewName: 'Nightfall',
  action: 'attack' as const,
  description: 'Nightfall tested the edge of your fictional turf.',
  targetBlockId: 'block-a',
  timestamp: 1_700_000_000_000,
};

describe('useGhostCrewSync', () => {
  beforeEach(() => {
    loadAuthoritativeWorld.mockReset();
    useGhostStore.setState({ crews: {}, feed: [], tickActive: false, tickIndex: 0 });
    useNotificationStore.setState({ notifications: [] });
  });

  it('mirrors a hydrated durable event once and preserves the stable event identity', async () => {
    loadAuthoritativeWorld.mockResolvedValue({ crews: [], feed: [serverEvent] });

    const first = renderHook(() => useGhostCrewSync('player-42', true));
    await waitFor(() => expect(useNotificationStore.getState().notifications).toHaveLength(1));

    expect(useNotificationStore.getState().notifications[0]).toMatchObject({
      type: 'danger',
      title: 'RIVAL PRESSURE: Nightfall',
      data: { worldEventId: 'server-world-event-42', source: 'authoritative-world' },
    });

    first.unmount();
    renderHook(() => useGhostCrewSync('player-42', true));

    await waitFor(() => expect(loadAuthoritativeWorld).toHaveBeenCalledTimes(2));
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it('does not mirror local fallback events as authoritative return-state notifications', async () => {
    loadAuthoritativeWorld.mockResolvedValue({
      crews: [],
      feed: [{ ...serverEvent, id: 'feed-local-1' }],
    });

    renderHook(() => useGhostCrewSync('player-42', true));
    await waitFor(() => expect(useGhostStore.getState().feed).toHaveLength(1));
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});
