/**
 * GG-002: Block Attack must not leave setup until a driver seat and a
 * shooter seat are filled. An empty car, or a passenger who cannot shoot,
 * is not a launch.
 */
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TopDownShooter from '../TopDownShooter';
import { useGangStore, useNavigationStore } from '../../../stores/gameStore';
import type { GangMember } from '../../../types/game.types';

function crewMember(partial: Pick<GangMember, 'id' | 'name' | 'role'>): GangMember {
  return {
    gangId: 'demo-gang',
    nickname: partial.name,
    avatarUrl: '',
    backstory: '',
    age: 24,
    region: 'miami',
    stats: { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 },
    level: 2,
    experience: 0,
    skillPoints: 0,
    skills: [],
    loyalty: 80,
    morale: 80,
    respect: 40,
    kills: 0,
    arrests: 0,
    dealsCompleted: 0,
    moneyEarned: 0,
    status: 'active',
    currentAssignment: null,
    joinedAt: '2026-01-01T00:00:00.000Z',
    health: 100,
    maxHealth: 100,
    ...partial,
  };
}

const dealer = crewMember({ id: 'demo-dealer-1', name: 'Lil Dre', role: 'dealer' });
const lookout = crewMember({ id: 'demo-lookout-1', name: 'Tasha', role: 'lookout' });
const shooter = crewMember({ id: 'demo-shooter-1', name: 'Big Rome', role: 'shooter' });

function launchButton() {
  return screen.getByRole('button', { name: /launch attack/i });
}

describe('TopDownShooter empty seats', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      currentApp: 'topdown',
      previousApp: 'planner',
      appStack: ['home', 'planner', 'topdown'],
      isTransitioning: false,
    });
    useGangStore.setState({ members: [dealer, lookout, shooter], contacts: [] });
  });

  it('keeps Launch Attack disabled while the driver and shooter seats are empty', () => {
    render(<TopDownShooter />);

    expect(screen.getByText(/driver drives only/i)).toBeInTheDocument();
    expect(launchButton()).toBeDisabled();

    fireEvent.click(screen.getByText('5th & Main'));
    expect(launchButton()).toBeDisabled();
    fireEvent.click(launchButton());
    expect(screen.getByText(/load up the car/i)).toBeInTheDocument();
  });

  it('stays disabled when the passenger cannot shoot, then enables for a shooter', () => {
    render(<TopDownShooter />);
    fireEvent.click(screen.getByText('5th & Main'));

    fireEvent.click(screen.getByText('🏎️ Driver'));
    fireEvent.click(screen.getByText('Lil Dre'));

    fireEvent.click(screen.getByText('🔫 Front'));
    fireEvent.click(screen.getByText('Tasha'));
    expect(launchButton()).toBeDisabled();

    fireEvent.click(screen.getByText('🔫 Back L'));
    fireEvent.click(screen.getByText('Big Rome'));
    expect(launchButton()).toBeEnabled();
  });
});
