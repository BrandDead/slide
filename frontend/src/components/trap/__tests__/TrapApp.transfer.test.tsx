import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TrapApp from '../TrapApp';
import { useEconomyStore, useGangStore, useNotificationStore } from '../../../stores/gameStore';
import type { GangMember } from '../../../types/game.types';

const dealer: GangMember = {
  id: 'trap-dealer', gangId: 'test-gang', name: 'Weezy', nickname: 'W', avatarUrl: '',
  backstory: 'A fictional test dealer.', age: 25, region: 'miami',
  stats: { strength: 5, agility: 5, intelligence: 5, charisma: 5, luck: 5, intimidation: 5 },
  level: 1, experience: 0, skillPoints: 0, skills: [], loyalty: 80, morale: 80,
  respect: 50, kills: 0, arrests: 0, dealsCompleted: 0, moneyEarned: 0,
  status: 'active', currentAssignment: null, joinedAt: '2026-10-15T00:00:00Z',
  role: 'dealer', health: 100, maxHealth: 100, inventory: [],
};

beforeEach(() => {
  localStorage.clear();
  useGangStore.setState({ members: [{ ...dealer, inventory: [] }], contacts: [] });
  useEconomyStore.setState({ inventory: [{ id: 'trap-product', itemId: 'river-cut', type: 'drug',
    name: 'River Cut', quantity: 3, quality: 72, tier: 2, odRisk: 12, value: 70 }] });
  useNotificationStore.setState({ notifications: [] });
});
afterEach(cleanup);

function selectGift() {
  fireEvent.click(screen.getByText('River Cut'));
  fireEvent.click(screen.getByText('Weezy'));
  return screen.getByRole('button', { name: 'GIVE' });
}

function successMessages() {
  return useNotificationStore.getState().notifications.filter((notification) => notification.title === 'Item Given');
}

describe('THE TRAP transfer confirmation', () => {
  it('gives the selected product, retains its stats, and reports actual success', () => {
    render(<TrapApp />);
    expect(() => fireEvent.click(selectGift())).not.toThrow();
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(2);
    expect(useGangStore.getState().members[0].inventory?.[0]).toMatchObject({ quantity: 1, quality: 72, tier: 2, odRisk: 12 });
    expect(successMessages()).toHaveLength(1);
  });

  it('reports role denial without a success message and allows another eligible recipient', () => {
    useGangStore.setState({ members: [{ ...dealer, role: 'shooter' }, { ...dealer, id: 'trap-slim', name: 'Slim' }] });
    render(<TrapApp />);
    expect(() => fireEvent.click(selectGift())).not.toThrow();
    expect(successMessages()).toHaveLength(0);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(3);
    expect(screen.getByRole('button', { name: 'GIVE' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("can't hold drugs");
    fireEvent.click(screen.getByText('Slim'));
    fireEvent.click(screen.getByRole('button', { name: 'GIVE' }));
    expect(successMessages()).toHaveLength(1);
    expect(useGangStore.getState().members.find((member) => member.id === 'trap-slim')?.inventory?.[0].quantity).toBe(1);
  });

  it('does not report success when stock changes after the gift panel opens', () => {
    render(<TrapApp />);
    const give = selectGift();
    act(() => useEconomyStore.setState({ inventory: [] }));
    fireEvent.click(give);
    expect(successMessages()).toHaveLength(0);
    expect(useGangStore.getState().members[0].inventory).toEqual([]);
    expect(useNotificationStore.getState().notifications.some((notification) => notification.type === 'warning')).toBe(true);
  });

  it('submits a selected give once for two same-frame taps', () => {
    render(<TrapApp />);
    const give = selectGift();
    act(() => {
      fireEvent.click(give);
      fireEvent.click(give);
    });
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(2);
    expect(useGangStore.getState().members[0].inventory).toHaveLength(1);
    expect(successMessages()).toHaveLength(1);
  });

  it('permits another legitimate give after explicitly selecting the stash again', () => {
    const { container } = render(<TrapApp />);
    fireEvent.click(selectGift());
    fireEvent.click(container.querySelector('.trap-item')!);
    fireEvent.click(container.querySelector('.trap-member-card')!);
    fireEvent.click(screen.getAllByRole('button', { name: 'GIVE' }).at(-1)!);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(1);
    expect(useGangStore.getState().members[0].inventory).toHaveLength(2);
    expect(successMessages()).toHaveLength(2);
  });

  it('gives the selected named batch when two stash rows share an item ID', () => {
    useEconomyStore.setState({ inventory: [
      { id: 'batch-one', itemId: 'river-cut', type: 'drug', name: 'River Cut', quantity: 3, quality: 72 },
      { id: 'batch-two', itemId: 'river-cut', type: 'drug', name: 'River Cut Reserve', quantity: 5, quality: 95 },
    ] });
    render(<TrapApp />);
    fireEvent.click(screen.getByText('River Cut Reserve'));
    fireEvent.click(screen.getByText('Weezy'));
    fireEvent.click(screen.getByRole('button', { name: 'GIVE' }));
    expect(useEconomyStore.getState().inventory.map((item) => item.quantity)).toEqual([3, 4]);
    expect(useGangStore.getState().members[0].inventory?.[0].quality).toBe(95);
  });
});
