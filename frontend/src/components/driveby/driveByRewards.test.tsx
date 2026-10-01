import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { GangMember } from '../../types/game.types';
import { useGangStore } from '../../stores/gameStore';
import type { CarCrew } from './CarCrewSelector';

const member = (id: string, role: string): GangMember => ({
  id, gangId: 'test-gang', name: id, nickname: id, avatarUrl: '', backstory: '', age: 25,
  region: 'miami', stats: { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 },
  level: 2, experience: 100, xp: 100, skillPoints: 0, skills: [], loyalty: 80, morale: 80,
  respect: 50, kills: 0, arrests: 0, dealsCompleted: 0, moneyEarned: 0, status: 'active',
  currentAssignment: null, joinedAt: new Date(0).toISOString(), role,
});
const crew: CarCrew = {
  targetBlock: { address: 'Fictional Test Block', seedMode: 'text-seed' },
  seats: [
    { position: 'driver', label: 'Driver', allowedRoles: ['shooter'], memberId: 'Wheel' },
    { position: 'passenger', label: 'Passenger', allowedRoles: ['shooter'], memberId: 'Rome' },
    { position: 'back_left', label: 'Rear left', allowedRoles: ['shooter'], memberId: 'Nia' },
    { position: 'back_right', label: 'Rear right', allowedRoles: ['shooter'], memberId: null },
  ],
};
let mockRunId = 0;
vi.mock('./CarCrewSelector', () => ({
  default: ({ onConfirm }: { onConfirm: (value: CarCrew) => void }) => (
    <button type="button" onClick={() => onConfirm(crew)}>Confirm crew</button>
  ),
}));
// The canvas loop is external to this parent test; assert actual Zustand member outcomes.
vi.mock('./DriveByEngine', () => ({
  default: ({ onComplete, onRunStart }: { onComplete: (stats: object, runId: number) => void; onRunStart?: (runId: number) => void }) => (
    <>
      <button type="button" onClick={() => onRunStart?.(++mockRunId)}>Start run</button>
      <button type="button" onClick={() => onComplete({
        kills: 2, civilianHits: 0, accuracy: 100, shotsHit: 2, shotsFired: 2,
        blocksCleared: 0, moneyEarned: 0, killsByShooter: { Rome: 2 },
      }, mockRunId)}>Finish mission</button>
      <button type="button" onClick={() => onComplete({
        kills: 2, civilianHits: 0, accuracy: 100, shotsHit: 2, shotsFired: 2,
        blocksCleared: 0, moneyEarned: 0, killsByShooter: { Rome: 2 },
      }, mockRunId - 1)}>Finish previous run</button>
    </>
  ),
}));
vi.mock('../../utils/moneyRouter', () => ({ vaultDeposit: vi.fn() }));

import DriveByGame from './DriveByGame';
describe('legacy DRIVE named rewards', () => {
  beforeEach(() => {
    mockRunId = 0;
    crew.seats[1].memberId = 'Rome';
    useGangStore.setState({ members: [member('Wheel', 'shooter'), member('Rome', 'shooter'), member('Nia', 'shooter')] });
  });
  it('credits only the actual killer and never books a second completion', () => {
    render(<DriveByGame />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm crew' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    // The selector is no longer the mission authority after confirmation.
    crew.seats[1].memberId = 'Wheel';
    const finish = screen.getByRole('button', { name: 'Finish mission' });
    fireEvent.click(finish);
    fireEvent.click(finish);
    const byId = Object.fromEntries(useGangStore.getState().members.map(m => [m.id, m]));
    expect(byId.Wheel.experience).toBe(100);
    expect(byId.Nia.experience).toBe(100);
    expect(byId.Rome.experience).toBe(120);
    expect(byId.Rome.kills).toBe(2);
  });
  it('settles each replay once, not only the first run with this crew', () => {
    render(<DriveByGame />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm crew' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish mission' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish mission' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish previous run' }));
    expect(useGangStore.getState().members.find(m => m.id === 'Rome')?.experience).toBe(120);
    fireEvent.click(screen.getByRole('button', { name: 'Finish mission' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish mission' }));
    const rome = useGangStore.getState().members.find(m => m.id === 'Rome')!;
    expect(rome.experience).toBe(140);
    expect(rome.kills).toBe(4);
  });
  it('preserves credit for a shot approved before the shooter or driver becomes unavailable', () => {
    render(<DriveByGame />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm crew' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    act(() => useGangStore.setState({ members: useGangStore.getState().members.map(m =>
      m.id === 'Rome' || m.id === 'Wheel' ? { ...m, status: 'injured' as const } : m) }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish mission' }));
    expect(useGangStore.getState().members.find(m => m.id === 'Rome')?.experience).toBe(120);
    expect(useGangStore.getState().members.find(m => m.id === 'Wheel')?.experience).toBe(100);
  });
});
