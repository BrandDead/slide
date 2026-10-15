import { beforeEach, describe, expect, it } from 'vitest';
import { useEconomyStore, useGangStore, useNotificationStore } from '../gameStore';
import type { GangMember, InventoryItem } from '../../types/game.types';

function member(overrides: Partial<GangMember> = {}): GangMember {
  return {
    id: 'crew-dealer', gangId: 'test-gang', name: 'Weezy', nickname: 'W',
    avatarUrl: '', backstory: 'A fictional test crew member.', age: 25, region: 'miami',
    stats: { strength: 5, agility: 5, intelligence: 5, charisma: 5, luck: 5, intimidation: 5 },
    level: 1, experience: 0, skillPoints: 0, skills: [], loyalty: 80, morale: 80,
    respect: 50, kills: 0, arrests: 0, dealsCompleted: 0, moneyEarned: 0,
    status: 'active', currentAssignment: null, joinedAt: '2026-10-15T00:00:00Z',
    role: 'dealer', health: 100, maxHealth: 100, inventory: [], ...overrides,
  };
}

function product(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'source-stack', itemId: 'river-cut', type: 'drug', name: 'River Cut', quantity: 3,
    quality: 72, potency: 40, odRisk: 12, tier: 2, value: 70,
    acquiredAt: '2026-10-14T00:00:00Z', data: { batch: 'fictional-batch' }, ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  useGangStore.setState({ members: [member()], contacts: [] });
  useEconomyStore.setState({ inventory: [product()], transactions: [], marketListings: [] });
  useNotificationStore.setState({ notifications: [] });
});

describe('crew inventory transfer boundary', () => {
  it('gives product without a CommonJS runtime failure and preserves its recorded metadata', () => {
    let result: unknown;
    expect(() => {
      result = useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1);
    }).not.toThrow();
    expect(result).toBe(true);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(2);
    expect(useGangStore.getState().members[0].inventory).toEqual([
      expect.objectContaining({ itemId: 'river-cut', quantity: 1, quality: 72, potency: 40,
        odRisk: 12, tier: 2, value: 70, data: { batch: 'fictional-batch' } }),
    ]);
  });

  it.each([0, -1, 0.5, NaN, Infinity, -Infinity, 4])('rejects invalid quantity %s without inventory mutation', (quantity) => {
    const stash = useEconomyStore.getState().inventory;
    const crew = useGangStore.getState().members;
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', quantity)).toBe(false);
    expect(useEconomyStore.getState().inventory).toEqual(stash);
    expect(useGangStore.getState().members).toEqual(crew);
  });

  it('deducts from only the first matching source stack, not every variant of an item', () => {
    useEconomyStore.setState({ inventory: [product(), product({ id: 'second-stack', quantity: 7, quality: 95 })] });
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1)).toBe(true);
    expect(useEconomyStore.getState().inventory.map((item) => item.quantity)).toEqual([2, 7]);
    expect(useGangStore.getState().members[0].inventory?.[0].quality).toBe(72);
  });

  it('gives the explicitly selected second stack rather than the first batch with that item ID', () => {
    useEconomyStore.setState({ inventory: [product(), product({ id: 'second-stack', quantity: 7, quality: 95 })] });
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1, 'second-stack')).toBe(true);
    expect(useEconomyStore.getState().inventory.map((item) => item.quantity)).toEqual([3, 6]);
    expect(useGangStore.getState().members[0].inventory?.[0].quality).toBe(95);
  });

  it('preserves recorded armor protection and gives unique carried-item IDs for repeated legitimate actions', () => {
    useEconomyStore.setState({ inventory: [product({ type: 'armor', itemId: 'vest', defense: 45, quantity: 2 })] });
    expect(useEconomyStore.getState().transferItemToMember('vest', 'crew-dealer', 1)).toBe(true);
    expect(useEconomyStore.getState().transferItemToMember('vest', 'crew-dealer', 1)).toBe(true);
    const carried = useGangStore.getState().members[0].inventory ?? [];
    expect(carried.map((item) => item.defense)).toEqual([45, 45]);
    expect(new Set(carried.map((item) => item.id)).size).toBe(2);
    expect(useEconomyStore.getState().inventory).toEqual([]);
  });

  it.each(['hospitalized', 'jailed', 'missing'] as const)('denies transfers after the recipient becomes %s', (status) => {
    useGangStore.getState().updateMember('crew-dealer', { status });
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1)).toBe(false);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(3);
    expect(useGangStore.getState().members[0].inventory).toEqual([]);
  });

  it('rejects a role change to shooter instead of giving it dealer product', () => {
    useGangStore.getState().updateMember('crew-dealer', { role: 'shooter' });
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1)).toBe(false);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(3);
    expect(useGangStore.getState().members[0].inventory).toEqual([]);
    expect(useNotificationStore.getState().notifications[0].title).toBe('Cannot Equip');
  });

  it('rejects missing source and recipient records', () => {
    expect(useEconomyStore.getState().transferItemToMember('missing', 'crew-dealer', 1)).toBe(false);
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'missing', 1)).toBe(false);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(3);
    expect(useGangStore.getState().members[0].inventory).toEqual([]);
  });

  it('does not invent an equipment category for unclassified legacy weapons', () => {
    useEconomyStore.setState({ inventory: [product({ type: 'weapon', itemId: 'legacy-weapon', damage: 30, accuracy: 60 })] });
    useGangStore.getState().updateMember('crew-dealer', { role: 'shooter' });
    expect(useEconomyStore.getState().transferItemToMember('legacy-weapon', 'crew-dealer', 1)).toBe(false);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(3);
    expect(useGangStore.getState().members[0].inventory).toEqual([]);
  });

  it('rechecks current stock on retry and never transfers the same last unit twice', () => {
    useEconomyStore.setState({ inventory: [product({ quantity: 1 })] });
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1)).toBe(true);
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1)).toBe(false);
    expect(useGangStore.getState().members[0].inventory?.map((item) => item.quantity)).toEqual([1]);
    expect(useEconomyStore.getState().inventory).toEqual([]);
  });

  it('restores transferred metadata and remaining stash through the existing local persistence', async () => {
    expect(useEconomyStore.getState().transferItemToMember('river-cut', 'crew-dealer', 1)).toBe(true);
    const gangSnapshot = localStorage.getItem('dealt-slide-gang');
    const stashSnapshot = localStorage.getItem('dealt-slide-economy');
    useGangStore.setState({ members: [], contacts: [] });
    useEconomyStore.setState({ inventory: [] });
    localStorage.setItem('dealt-slide-gang', gangSnapshot!);
    localStorage.setItem('dealt-slide-economy', stashSnapshot!);
    await useGangStore.persist.rehydrate();
    await useEconomyStore.persist.rehydrate();
    expect(useGangStore.getState().members[0].inventory?.[0]).toMatchObject({ quantity: 1, quality: 72, odRisk: 12, data: { batch: 'fictional-batch' } });
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(2);
  });
});
