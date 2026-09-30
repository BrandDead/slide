/**
 * GG-003: reseeding the demo crew must not leave two contact cards
 * with the same id. removeMember drops the member and addMember
 * appends another contact.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyDemoSeed } from '../demoSeed';
import { useGangStore } from '../../stores/gameStore';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';

const DEMO_IDS = [
  BLOCK_LOOP_IDS.dealerId,
  BLOCK_LOOP_IDS.shooterId,
  BLOCK_LOOP_IDS.lookoutId,
  BLOCK_LOOP_IDS.enforcerId,
];

describe('demo contact ids', () => {
  beforeEach(() => {
    useGangStore.setState({ members: [], contacts: [] });
  });

  it('keeps one contact per demo id when the seed runs twice', () => {
    applyDemoSeed();
    applyDemoSeed();

    const contacts = useGangStore.getState().contacts;
    const ids = contacts.map((contact) => contact.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of DEMO_IDS) {
      expect(contacts.filter((contact) => contact.id === id)).toHaveLength(1);
    }
    expect(useGangStore.getState().members.filter((member) => member.id === BLOCK_LOOP_IDS.dealerId)).toHaveLength(1);
  });

  it('keeps a non-demo contact when the demo crew is reseeded', () => {
    applyDemoSeed();
    useGangStore.getState().addContact({
      id: 'custom-jay',
      name: 'Jay',
      role: 'dealer',
      status: 'active',
    });
    applyDemoSeed();

    const contacts = useGangStore.getState().contacts;
    expect(contacts.filter((contact) => contact.id === 'custom-jay')).toHaveLength(1);
    expect(new Set(contacts.map((contact) => contact.id)).size).toBe(contacts.length);
  });
});
