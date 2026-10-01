import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { GangMember } from '../../types/game.types';
import { useGangStore } from '../../stores/gameStore';
import type { CarCrew } from './CarCrewSelector';
import DriveByEngine from './DriveByEngine';
import { availablePassengerShooters } from './driveByParticipants';

export const member = (id: string, role: string, status: GangMember['status'] = 'active'): GangMember => ({
  id, gangId: 'test-gang', name: id, nickname: id, avatarUrl: '', backstory: '', age: 25,
  region: 'miami', stats: { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 },
  level: 2, experience: 100, xp: 100, skillPoints: 0, skills: [], loyalty: 80, morale: 80,
  respect: 50, kills: 0, arrests: 0, dealsCompleted: 0, moneyEarned: 0, status,
  currentAssignment: null, joinedAt: new Date(0).toISOString(), role,
});
export const crew = (driver: string, ...passengers: string[]): CarCrew => ({
  targetBlock: { address: 'Fictional Test Block', seedMode: 'text-seed' },
  seats: [
    { position: 'driver', label: 'Driver', allowedRoles: ['dealer', 'recruit', 'shooter'], memberId: driver },
    { position: 'passenger', label: 'Front passenger', allowedRoles: ['shooter'], memberId: passengers[0] ?? null },
    { position: 'back_left', label: 'Rear left', allowedRoles: ['shooter'], memberId: passengers[1] ?? null },
    { position: 'back_right', label: 'Rear right', allowedRoles: ['shooter'], memberId: null },
  ],
});

beforeEach(() => {
  useGangStore.setState({ members: [member('Wheel', 'shooter'), member('Rome', 'shooter'), member('Nia', 'shooter')] });
});

describe('legacy DRIVE passenger participant contract', () => {
  it('offers only the confirmed shooter passengers as playable firing members, even with a shooter driver', () => {
    render(<DriveByEngine crew={crew('Wheel', 'Rome', 'Nia')} />);
    expect(screen.getByRole('button', { name: /fire as rome/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fire as nia/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fire as wheel/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fire as nia/i }));
    expect(screen.getByText(/current shooter: nia/i)).toBeInTheDocument();
  });

  it('does not let a stale or non-shooter passenger start a mission', () => {
    useGangStore.setState({ members: [member('Wheel', 'dealer'), member('Rome', 'shooter', 'injured')] });
    render(<DriveByEngine crew={crew('Wheel', 'Rome')} />);
    expect(screen.getByRole('button', { name: /start mission/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /fire as rome/i })).not.toBeInTheDocument();
  });

  it('removes a selected shooter who becomes unavailable mid-run without silently switching to another', () => {
    render(<DriveByEngine crew={crew('Wheel', 'Rome', 'Nia')} />);
    fireEvent.click(screen.getByRole('button', { name: /fire as nia/i }));
    act(() => useGangStore.setState({ members: [member('Wheel', 'shooter'), member('Rome', 'shooter'), member('Nia', 'shooter', 'injured')] }));
    expect(screen.getByText(/current shooter: unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fire as nia/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fire as rome/i }));
    expect(screen.getByText(/current shooter: rome/i)).toBeInTheDocument();
  });

  it('ignores a forged duplicate driver ID in a passenger seat', () => {
    expect(availablePassengerShooters(crew('Wheel', 'Wheel', 'Rome'), useGangStore.getState().members)
      .map(shooter => shooter.id)).toEqual(['Rome']);
  });

  it('does not turn an unknown seat position into a shooting passenger', () => {
    const forged = crew('Wheel', 'Rome');
    forged.seats[1].position = 'trunk' as typeof forged.seats[number]['position'];
    expect(availablePassengerShooters(forged, useGangStore.getState().members)).toEqual([]);
  });
});
