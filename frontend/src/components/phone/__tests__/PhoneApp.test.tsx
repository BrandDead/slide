import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PhoneApp from '../PhoneApp';
import { useGangStore, usePlayerStore } from '../../../stores/gameStore';

vi.mock('../../gang/PhotoMemberCreator', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="photo-member-creator">
      <button onClick={onClose}>Close creator</button>
    </div>
  ),
}));

describe('PhoneApp personal crew contacts', () => {
  beforeEach(() => {
    usePlayerStore.setState(state => ({
      ...state,
      player: { ...state.player, money: 12000 },
    }));
    useGangStore.setState(state => ({
      ...state,
      members: [{
        id: 'friend-1',
        gangId: 'demo-gang',
        name: 'Jay',
        nickname: 'J',
        avatarUrl: '/jay.png',
        customAvatarUrl: '/jay.png',
        portraitUrl: '/jay.png',
        backstory: 'Custom member',
        age: 21,
        region: 'miami',
        stats: { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 },
        level: 1,
        experience: 0,
        skillPoints: 0,
        skills: [],
        loyalty: 80,
        morale: 80,
        respect: 50,
        kills: 0,
        arrests: 0,
        dealsCompleted: 0,
        moneyEarned: 0,
        status: 'active',
        currentAssignment: null,
        joinedAt: new Date(0).toISOString(),
        role: 'dealer',
      }],
      contacts: [],
    }));
  });

  it('shows the current roster beside the existing service contacts', () => {
    render(<PhoneApp />);
    expect(screen.getByText('Jay')).toBeTruthy();
    expect(screen.getByText('The Cleaner')).toBeTruthy();
    expect(screen.getByText('Lawyer')).toBeTruthy();
  });

  it('opens the custom member creator from Contacts', () => {
    render(<PhoneApp />);
    fireEvent.click(screen.getByRole('button', { name: /add custom member/i }));
    expect(screen.getByTestId('photo-member-creator')).toBeTruthy();
  });
});
