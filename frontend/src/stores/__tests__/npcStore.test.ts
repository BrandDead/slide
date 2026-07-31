/**
 * Tests for the NPC Ghost Crew Zustand store.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useNPCStore, selectNPCGangList, selectThreateningGangs, selectUnacknowledgedThreats } from '../npcStore';

function freshStore() {
  // Reset the store to a clean state before each test
  useNPCStore.setState({
    gangs: {},
    threatEvents: [],
    tickActive: false,
  });
}

describe('npcStore — seedDefaultGangs', () => {
  beforeEach(freshStore);

  it('seeds 5 default gangs', () => {
    useNPCStore.getState().seedDefaultGangs();
    const gangs = selectNPCGangList(useNPCStore.getState());
    expect(gangs).toHaveLength(5);
  });

  it('each gang has at least 3 members', () => {
    useNPCStore.getState().seedDefaultGangs();
    const gangs = selectNPCGangList(useNPCStore.getState());
    for (const gang of gangs) {
      expect(gang.members.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('gang difficulty is between 1 and 5', () => {
    useNPCStore.getState().seedDefaultGangs();
    const gangs = selectNPCGangList(useNPCStore.getState());
    for (const gang of gangs) {
      expect(gang.difficulty).toBeGreaterThanOrEqual(1);
      expect(gang.difficulty).toBeLessThanOrEqual(5);
    }
  });
});

describe('npcStore — applyTick', () => {
  beforeEach(() => {
    freshStore();
    useNPCStore.getState().seedDefaultGangs();
  });

  it('updates lastAction and lastActionType', () => {
    const gangs = selectNPCGangList(useNPCStore.getState());
    const gang = gangs[0];
    useNPCStore.getState().applyTick(gang.id, 'patrol', 'Patrolling the block');
    const updated = useNPCStore.getState().gangs[gang.id];
    expect(updated.lastAction).toBe('Patrolling the block');
    expect(updated.lastActionType).toBe('patrol');
    expect(updated.threatening).toBe(false);
  });

  it('sets threatening=true for retaliate action', () => {
    const gangs = selectNPCGangList(useNPCStore.getState());
    const gang = gangs[0];
    useNPCStore.getState().applyTick(gang.id, 'retaliate', 'Coming for you!', 'block-123');
    const updated = useNPCStore.getState().gangs[gang.id];
    expect(updated.threatening).toBe(true);
    expect(updated.lastTargetBlockId).toBe('block-123');
  });

  it('sets threatening=true for raid action', () => {
    const gangs = selectNPCGangList(useNPCStore.getState());
    const gang = gangs[0];
    useNPCStore.getState().applyTick(gang.id, 'raid', 'Raiding your block!', 'block-456');
    const updated = useNPCStore.getState().gangs[gang.id];
    expect(updated.threatening).toBe(true);
  });

  it('does nothing for unknown gangId', () => {
    const before = useNPCStore.getState().gangs;
    useNPCStore.getState().applyTick('nonexistent-gang', 'patrol', 'Test');
    const after = useNPCStore.getState().gangs;
    expect(after).toEqual(before);
  });
});

describe('npcStore — threat events', () => {
  beforeEach(() => {
    freshStore();
    useNPCStore.getState().seedDefaultGangs();
  });

  it('addThreatEvent appends a new event', () => {
    useNPCStore.getState().addThreatEvent({
      gangId: 'npc-scorpions',
      gangName: 'The Scorpions',
      type: 'raid',
      targetBlockId: 'block-1',
      description: 'Incoming raid!',
      timestamp: Date.now(),
    });
    const events = selectUnacknowledgedThreats(useNPCStore.getState());
    expect(events).toHaveLength(1);
    expect(events[0].gangId).toBe('npc-scorpions');
    expect(events[0].acknowledged).toBe(false);
  });

  it('acknowledgeThreat marks event as acknowledged', () => {
    useNPCStore.getState().addThreatEvent({
      gangId: 'npc-scorpions',
      gangName: 'The Scorpions',
      type: 'retaliate',
      description: 'Retaliation incoming!',
      timestamp: Date.now(),
    });
    const events = useNPCStore.getState().threatEvents;
    const eventId = events[0].id;
    useNPCStore.getState().acknowledgeThreat(eventId);
    const unacked = selectUnacknowledgedThreats(useNPCStore.getState());
    expect(unacked).toHaveLength(0);
  });

  it('caps threat events at 50', () => {
    for (let i = 0; i < 55; i++) {
      useNPCStore.getState().addThreatEvent({
        gangId: 'npc-scorpions',
        gangName: 'The Scorpions',
        type: 'patrol',
        description: `Event ${i}`,
        timestamp: Date.now(),
      });
    }
    expect(useNPCStore.getState().threatEvents.length).toBeLessThanOrEqual(50);
  });
});

describe('npcStore — applyPlayerDamage', () => {
  beforeEach(() => {
    freshStore();
    useNPCStore.getState().seedDefaultGangs();
  });

  it('kills the correct number of members', () => {
    const gang = selectNPCGangList(useNPCStore.getState())[0];
    const aliveBefore = gang.members.filter((m) => m.alive).length;
    useNPCStore.getState().applyPlayerDamage(gang.id, 2, 10);
    const updated = useNPCStore.getState().gangs[gang.id];
    const aliveAfter = updated.members.filter((m) => m.alive).length;
    expect(aliveAfter).toBe(aliveBefore - 2);
  });

  it('reduces gang wealth', () => {
    const gang = selectNPCGangList(useNPCStore.getState())[0];
    const wealthBefore = gang.wealth;
    useNPCStore.getState().applyPlayerDamage(gang.id, 0, 15);
    const updated = useNPCStore.getState().gangs[gang.id];
    expect(updated.wealth).toBe(Math.max(0, wealthBefore - 15));
  });

  it('wealth cannot go below 0', () => {
    const gang = selectNPCGangList(useNPCStore.getState())[0];
    useNPCStore.getState().applyPlayerDamage(gang.id, 0, 9999);
    const updated = useNPCStore.getState().gangs[gang.id];
    expect(updated.wealth).toBe(0);
  });
});

describe('npcStore — selectors', () => {
  beforeEach(() => {
    freshStore();
    useNPCStore.getState().seedDefaultGangs();
  });

  it('selectThreateningGangs returns only threatening gangs', () => {
    const gangs = selectNPCGangList(useNPCStore.getState());
    useNPCStore.getState().setThreatening(gangs[0].id, true);
    const threatening = selectThreateningGangs(useNPCStore.getState());
    expect(threatening).toHaveLength(1);
    expect(threatening[0].id).toBe(gangs[0].id);
  });
});
