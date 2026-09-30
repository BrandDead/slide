/**
 * GG-002: OPS PLAN must not launch a Block Attack until a driver and a
 * shooter are assigned. Target-only launch is the empty-seat path.
 */
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AttackPlanner from '../AttackPlanner';
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
const shooter = crewMember({ id: 'demo-shooter-1', name: 'Big Rome', role: 'shooter' });

describe('AttackPlanner launch seats', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      currentApp: 'planner',
      previousApp: 'home',
      appStack: ['home', 'planner'],
      isTransitioning: false,
    });
    useGangStore.setState({ members: [dealer, shooter], contacts: [] });
  });

  it('keeps Launch Attack disabled when a target is chosen and the driver and shooter are empty', () => {
    render(<AttackPlanner />);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'dummy-target' } });

    const launch = screen.getByRole('button', { name: /launch attack/i });
    expect(launch).toBeDisabled();

    fireEvent.click(launch);
    expect(useNavigationStore.getState().currentApp).toBe('planner');
  });

  it('launches only after a driver and a different shooter are assigned', () => {
    render(<AttackPlanner />);
    const [target, , enforcer, driver] = screen.getAllByRole('combobox');

    fireEvent.change(target, { target: { value: 'dummy-target' } });
    fireEvent.change(driver, { target: { value: dealer.id } });
    expect(screen.getByRole('button', { name: /launch attack/i })).toBeDisabled();

    fireEvent.change(enforcer, { target: { value: shooter.id } });
    const launch = screen.getByRole('button', { name: /launch attack/i });
    expect(launch).toBeEnabled();

    fireEvent.click(launch);
    expect(useNavigationStore.getState().currentApp).toBe('topdown');
  });
});
