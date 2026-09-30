import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Contacts from '../Contacts';
import { useGangStore, useNavigationStore } from '../../../stores/gameStore';
import type { GangMember } from '../../../types/game.types';

function photoRecruit(): GangMember {
  return {
    id: 'photo-recruit-1',
    gangId: 'demo-gang',
    name: 'Jay',
    nickname: '',
    avatarUrl: '/generated/jay-portrait.webp',
    customAvatarUrl: '/generated/jay-portrait.webp',
    backstory: 'Joined the crew from your Contacts.',
    age: 21,
    region: 'miami',
    stats: {
      strength: 50,
      agility: 50,
      intelligence: 50,
      charisma: 50,
      luck: 50,
      intimidation: 50,
    },
    level: 1,
    experience: 0,
    xp: 0,
    skillPoints: 0,
    skills: [],
    loyalty: 80,
    morale: 75,
    respect: 10,
    kills: 0,
    arrests: 0,
    dealsCompleted: 0,
    moneyEarned: 0,
    status: 'active',
    currentAssignment: null,
    joinedAt: new Date(0).toISOString(),
    hiredAt: new Date(0).toISOString(),
    role: 'dealer',
    health: 100,
    maxHealth: 100,
    inventory: [],
  };
}

describe('Contacts photo recruit detail', () => {
  beforeEach(() => {
    const member = photoRecruit();
    useNavigationStore.setState({ currentApp: 'contacts', previousApp: 'home', appStack: ['home', 'contacts'] });
    useGangStore.setState({
      members: [member],
      contacts: [{
        id: member.id,
        memberId: member.id,
        name: member.name,
        nickname: member.nickname,
        role: member.role ?? 'dealer',
        status: 'active',
        customAvatarUrl: member.customAvatarUrl,
      }],
    });
  });

  it('shows the generated photo recruit backstory in the contact profile', () => {
    render(<Contacts />);

    fireEvent.click(screen.getByRole('button', { name: "Open Jay's profile" }));

    expect(screen.getByRole('heading', { name: 'Backstory' })).toBeInTheDocument();
    expect(screen.getByText('Joined the crew from your Contacts.')).toBeInTheDocument();
  });
});
