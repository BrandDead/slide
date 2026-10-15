import { beforeEach, describe, expect, it } from 'vitest';
import { applyDemoSeed } from '../demoSeed';
import { useEconomyStore, useGangStore, usePlayerStore } from '../../stores/gameStore';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';

beforeEach(() => {
  localStorage.clear();
  usePlayerStore.setState({ player: { ...usePlayerStore.getInitialState().player, id: '' } });
  useGangStore.setState({ members: [], contacts: [] });
  useEconomyStore.setState({ inventory: [{ id: 'seed-product', itemId: 'river-cut', type: 'drug',
    name: 'River Cut', quantity: 3, quality: 72, tier: 2, odRisk: 12 }] });
  applyDemoSeed();
});

describe('demo carried inventory continuity', () => {
  it('keeps a real transferred item across two reseeds without restoring consumed stock or duplicating contacts', () => {
    expect(useEconomyStore.getState().transferItemToMember('river-cut', BLOCK_LOOP_IDS.dealerId, 1)).toBe(true);
    const carried = useGangStore.getState().getMemberById(BLOCK_LOOP_IDS.dealerId)?.inventory;
    applyDemoSeed();
    applyDemoSeed();
    expect(useGangStore.getState().getMemberById(BLOCK_LOOP_IDS.dealerId)?.inventory).toEqual(carried);
    expect(useGangStore.getState().getMemberById(BLOCK_LOOP_IDS.dealerId)?.inventory).toHaveLength(1);
    expect(useEconomyStore.getState().inventory[0].quantity).toBe(2);
    expect(useGangStore.getState().contacts.filter((contact) => contact.memberId === BLOCK_LOOP_IDS.dealerId)).toHaveLength(1);
  });

  it('keeps persisted carried metadata through hydration followed by the actual demo-startup reseed', async () => {
    expect(useEconomyStore.getState().transferItemToMember('river-cut', BLOCK_LOOP_IDS.dealerId, 1)).toBe(true);
    const snapshot = localStorage.getItem('dealt-slide-gang');
    useGangStore.setState({ members: [], contacts: [] });
    localStorage.setItem('dealt-slide-gang', snapshot!);
    await useGangStore.persist.rehydrate();
    applyDemoSeed();
    expect(useGangStore.getState().getMemberById(BLOCK_LOOP_IDS.dealerId)?.inventory?.[0]).toMatchObject({
      itemId: 'river-cut', quantity: 1, quality: 72, tier: 2, odRisk: 12,
    });
  });

  it('does not preserve carried inventory when the previous player is not the demo player', () => {
    useGangStore.getState().updateMember(BLOCK_LOOP_IDS.dealerId, { inventory: [{ itemId: 'foreign-item', type: 'armor', quantity: 1 }] });
    usePlayerStore.getState().updatePlayer({ id: 'another-account' });
    applyDemoSeed();
    expect(useGangStore.getState().getMemberById(BLOCK_LOOP_IDS.dealerId)?.inventory ?? []).toEqual([]);
  });

  it('does not preserve a matching member ID from a different gang', () => {
    useGangStore.getState().updateMember(BLOCK_LOOP_IDS.dealerId, {
      gangId: 'foreign-gang', inventory: [{ itemId: 'foreign-item', type: 'armor', quantity: 1 }],
    });
    applyDemoSeed();
    expect(useGangStore.getState().getMemberById(BLOCK_LOOP_IDS.dealerId)?.inventory ?? []).toEqual([]);
  });
});
