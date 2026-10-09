import { beforeEach, describe, expect, it } from 'vitest';
import { getBlockResponseReadiness, useCombatIntentStore } from '../combatIntentStore';
import { useBlockStore } from '../blockStore';
import { useGangStore, usePlayerStore } from '../gameStore';
import { applyDemoSeed } from '../../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';

describe('canonical block response handoff', () => {
  beforeEach(() => {
    useBlockStore.setState({ blocks: {}, selectedBlockId: null });
    applyDemoSeed();
    useCombatIntentStore.getState().reset();
  });

  it('uses the same confirmed placements as encounter preparation', () => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    const readiness = getBlockResponseReadiness(block, useGangStore.getState().members);
    expect(readiness.canLaunch).toBe(true);
    expect(readiness.crew.map(p => p.memberId)).toEqual(block.placements.map(p => p.memberId));
  });

  it.each(['npc', 'unclaimed'] as const)('rejects %s targets without changing the books', owner => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    useBlockStore.getState().upsertBlock({ ...block, owner });
    const before = usePlayerStore.getState().player;
    expect(useCombatIntentStore.getState().queueBlockResponse(block.id)).toBe(false);
    expect(useCombatIntentStore.getState().pendingEncounterBlockId).toBeNull();
    expect(usePlayerStore.getState().player).toEqual(before);
  });

  it('rejects a missing block and a removed roster member', () => {
    expect(useCombatIntentStore.getState().queueBlockResponse('missing')).toBe(false);
    useGangStore.setState({ members: [] });
    expect(useCombatIntentStore.getState().queueBlockResponse(BLOCK_LOOP_IDS.blockId)).toBe(false);
  });

  it('queues once, consumes once, and keeps DRIVE intent independent', () => {
    const intent = useCombatIntentStore.getState();
    intent.setPendingTarget({ address: 'fictional practice', seedMode: 'text-seed' });
    expect(intent.queueBlockResponse(BLOCK_LOOP_IDS.blockId)).toBe(true);
    expect(intent.queueBlockResponse(BLOCK_LOOP_IDS.blockId)).toBe(false);
    expect(intent.consumeBlockResponse()).toBe(BLOCK_LOOP_IDS.blockId);
    expect(intent.consumeBlockResponse()).toBeNull();
    expect(useCombatIntentStore.getState().pendingTarget?.address).toBe('fictional practice');
  });

  it('revalidates crew at consumption after a valid queue', () => {
    const intent = useCombatIntentStore.getState();
    expect(intent.queueBlockResponse(BLOCK_LOOP_IDS.blockId)).toBe(true);
    useGangStore.getState().updateMember('demo-enforcer-1', { health: 0 });
    expect(intent.consumeBlockResponse()).toBeNull();
    expect(useCombatIntentStore.getState().pendingEncounterBlockId).toBeNull();
  });

  it('rejects empty, all-downed, and illegal-cell placements without a replacement crew', () => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    const members = useGangStore.getState().members;
    expect(getBlockResponseReadiness({ ...block, placements: [] }, members).canLaunch).toBe(false);
    expect(getBlockResponseReadiness({ ...block, placements: block.placements.map(p => ({ ...p, health: 0 })) }, members).canLaunch).toBe(false);
    expect(getBlockResponseReadiness({ ...block, placements: block.placements.map(p => ({ ...p, x: 99 })) }, members).canLaunch).toBe(false);
  });
});
