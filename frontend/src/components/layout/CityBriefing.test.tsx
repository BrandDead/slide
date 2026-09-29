import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CityBriefing from './CityBriefing';
import {
  formatCityBriefTime,
  getCityBriefAction,
  toCityBriefItems,
} from './cityBriefingModel';
import { useGhostStore, type GhostFeedEvent } from '../../stores/ghostCrewStore';

vi.mock('../common/GameSprite', () => ({
  GameSprite: ({ fallback }: { fallback: string }) => <span data-testid="game-sprite">{fallback}</span>,
}));

const baseEvent: GhostFeedEvent = {
  id: 'server-event-1',
  crewId: 'ghost-nightfall',
  crewName: 'Nightfall',
  action: 'attack',
  description: 'Nightfall is pressing your eastern block.',
  targetBlockId: 'block-east',
  timestamp: 1_700_000_000_000,
};

function resetGhostStore() {
  useGhostStore.setState({ crews: {}, feed: [], tickActive: false, tickIndex: 0 });
}

describe('cityBriefing', () => {
  beforeEach(resetGhostStore);

  it('prioritizes the newest bounded events and maps a threat to the map action', () => {
    const items = toCityBriefItems([
      { ...baseEvent, id: 'old', timestamp: 10 },
      { ...baseEvent, id: 'newest', timestamp: 30, action: 'reinforce' },
      { ...baseEvent, id: 'middle', timestamp: 20, action: 'claim' },
      { ...baseEvent, id: 'fourth', timestamp: 15, action: 'lay-low' },
    ]);

    expect(items.map((item) => item.id)).toEqual(['newest', 'middle', 'fourth']);
    expect(getCityBriefAction('attack')).toEqual({ label: 'REVIEW DEFENSE', destination: 'map' });
    expect(formatCityBriefTime(1_000, 61_000)).toBe('1M AGO');
  });

  it('shows an understandable empty state and opens the map from it', () => {
    const onNavigate = vi.fn();
    render(<CityBriefing onNavigate={onNavigate} />);

    expect(screen.getByText('City is quiet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review map' }));
    expect(onNavigate).toHaveBeenCalledWith('map');
  });

  it('shows durable feed details and opens the corresponding defense action', () => {
    useGhostStore.setState({ feed: [baseEvent] });
    const onNavigate = vi.fn();
    render(<CityBriefing onNavigate={onNavigate} />);

    expect(screen.getByText('Nightfall')).toBeInTheDocument();
    expect(screen.getByText('Nightfall is pressing your eastern block.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'REVIEW DEFENSE' }));
    expect(onNavigate).toHaveBeenCalledWith('map', 'block-east');
  });
});

describe('Strip routing (#163)', () => {
  const base = {
    id: 'feed-a',
    crewId: 'ghost-nightfall',
    crewName: 'Nightfall Crew',
    action: 'attack' as const,
    description: 'Nightfall Crew is probing 1208 W Las Olas Blvd.',
    targetBlockId: 'demo-block-las-olas',
    timestamp: 10,
  };

  it('sends a Strip-block attack to the Strip and keeps other attacks on the map', () => {
    const [strip] = toCityBriefItems([base]);
    expect(strip.cta).toEqual({ label: 'DEFEND THE STRIP', destination: 'block_loop' });
    const [elsewhere] = toCityBriefItems([{ ...base, targetBlockId: 'block-2' }]);
    expect(elsewhere.cta).toEqual({ label: 'REVIEW DEFENSE', destination: 'map' });
  });

  it('labels a defense result by outcome', () => {
    const [held] = toCityBriefItems([{ ...base, id: 'defense-a', reason: 'defense-held' as const }]);
    expect(held).toMatchObject({ category: 'DEFENSE RESULT', tone: 'success' });
    expect(held.cta.destination).toBe('block_loop');
  });
});
