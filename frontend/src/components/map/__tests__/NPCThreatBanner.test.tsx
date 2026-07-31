/**
 * Tests for NPCThreatBanner component
 * Uses vitest + @testing-library/react
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock the npcStore before importing the component
const mockAcknowledgeThreat = vi.fn();

let mockThreats: Array<{
  id: string;
  gangId: string;
  gangName: string;
  type: string;
  description: string;
  timestamp: number;
  acknowledged: boolean;
}> = [];

vi.mock('../../../stores/npcStore', () => ({
  useNPCStore: (selector: (state: any) => any) => {
    const state = {
      threatEvents: mockThreats,
      acknowledgeThreat: mockAcknowledgeThreat,
    };
    return selector(state);
  },
  selectUnacknowledgedThreats: (state: any) =>
    state.threatEvents.filter((e: any) => !e.acknowledged),
}));

import NPCThreatBanner from '../NPCThreatBanner';

describe('NPCThreatBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThreats = [];
  });

  it('renders when there is an unacknowledged threat', () => {
    mockThreats = [
      {
        id: 'threat-1',
        gangId: 'npc-scorpions',
        gangName: 'The Scorpions',
        type: 'raid',
        description: 'The Scorpions are raiding your block!',
        timestamp: Date.now(),
        acknowledged: false,
      },
    ];

    render(<NPCThreatBanner />);

    // Multiple elements may contain 'The Scorpions' — use getAllByText
    const scorpionEls = screen.getAllByText(/The Scorpions/i);
    expect(scorpionEls.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/raid/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/The Scorpions are raiding your block!/i).length
    ).toBeGreaterThan(0);
  });

  it('does NOT render when all threats are acknowledged', () => {
    mockThreats = [
      {
        id: 'threat-1',
        gangId: 'npc-scorpions',
        gangName: 'The Scorpions',
        type: 'raid',
        description: 'The Scorpions are raiding your block!',
        timestamp: Date.now(),
        acknowledged: true,
      },
    ];

    render(<NPCThreatBanner />);

    expect(screen.queryByText(/The Scorpions/i)).not.toBeInTheDocument();
  });

  it('does NOT render when there are no threats', () => {
    mockThreats = [];

    render(<NPCThreatBanner />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls acknowledgeThreat when dismiss button is clicked', () => {
    mockThreats = [
      {
        id: 'threat-abc',
        gangId: 'npc-deadend',
        gangName: 'Dead End Boys',
        type: 'retaliate',
        description: 'Dead End Boys are retaliating!',
        timestamp: Date.now(),
        acknowledged: false,
      },
    ];

    render(<NPCThreatBanner />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(mockAcknowledgeThreat).toHaveBeenCalledTimes(1);
    expect(mockAcknowledgeThreat).toHaveBeenCalledWith('threat-abc');
  });

  it('shows the most recent unacknowledged threat when multiple exist', () => {
    mockThreats = [
      {
        id: 'threat-old',
        gangId: 'npc-1',
        gangName: 'Old Gang',
        type: 'patrol',
        description: 'Old threat',
        timestamp: Date.now() - 10000,
        acknowledged: false,
      },
      {
        id: 'threat-new',
        gangId: 'npc-2',
        gangName: 'New Gang',
        type: 'raid',
        description: 'New threat',
        timestamp: Date.now(),
        acknowledged: false,
      },
    ];

    render(<NPCThreatBanner />);

    // Should show the most recent (last in array)
    expect(screen.getByText(/New Gang/i)).toBeInTheDocument();
    expect(screen.getByText(/New threat/i)).toBeInTheDocument();
  });
});
