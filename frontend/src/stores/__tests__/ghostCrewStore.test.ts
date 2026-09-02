// Integration test for the Ghost Crew Store (#81).
// Verifies the acceptance criterion: a player who ignores the map for several
// ticks visibly loses ground to a named rival crew.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGhostStore } from '../ghostCrewStore';
import { useBlockStore } from '../blockStore';

function resetStores() {
  useGhostStore.setState({ crews: {}, feed: [], tickActive: false, tickIndex: 0 });
  useBlockStore.setState({ blocks: {}, selectedBlockId: null });
}

describe('ghostCrewStore', () => {
  beforeEach(resetStores);

  it('seeds the default crews once', () => {
    useGhostStore.getState().seedCrews();
    const crews = useGhostStore.getState().crews;
    expect(Object.keys(crews).length).toBeGreaterThanOrEqual(3);
    // Idempotent — a second seed does not wipe persisted progress.
    const nightfallTreasury = crews['ghost-nightfall'].treasury;
    useGhostStore.getState().seedCrews();
    expect(useGhostStore.getState().crews['ghost-nightfall'].treasury).toBe(nightfallTreasury);
  });

  it('a passive player loses ground over several ticks (acceptance)', () => {
    useGhostStore.getState().seedCrews();
    const before = Object.values(useGhostStore.getState().crews)
      .reduce((sum, c) => sum + c.ownedBlockIds.length, 0);
    expect(before).toBe(0);

    // Run enough ticks that expansion-driven crews claim turf. The player
    // does nothing (no blocks, no attacks).
    for (let i = 0; i < 12; i++) {
      useGhostStore.getState().runTick();
    }

    const crews = Object.values(useGhostStore.getState().crews);
    const after = crews.reduce((sum, c) => sum + c.ownedBlockIds.length, 0);
    expect(after).toBeGreaterThan(0);

    // … and the claimed turf is visible in blockStore as npc-owned blocks.
    const ghostBlocks = Object.values(useBlockStore.getState().blocks)
      .filter((b) => b.owner === 'npc');
    expect(ghostBlocks.length).toBe(after);
    expect(ghostBlocks[0].ownerGangName).toBeTruthy();
    expect(ghostBlocks[0].dnaId).toBeTruthy();
  });

  it('records a grudge when the player attacks ghost turf', () => {
    useGhostStore.getState().seedCrews();
    const crewId = 'ghost-sistrunk';
    const before = useGhostStore.getState().crews[crewId].grudge.score;
    useGhostStore.getState().recordPlayerAttack(crewId, 'ghost-block-x');
    const after = useGhostStore.getState().crews[crewId].grudge.score;
    expect(after).toBeGreaterThan(before);
  });

  it('crewForBlock resolves the owner of a claimed block', () => {
    useGhostStore.getState().seedCrews();
    // Run ticks until at least one crew owns a block (bounded).
    for (let i = 0; i < 12; i++) {
      useGhostStore.getState().runTick();
      if (Object.keys(useBlockStore.getState().blocks).length > 0) break;
    }
    const npcBlock = Object.values(useBlockStore.getState().blocks).find((b) => b.owner === 'npc');
    if (npcBlock) {
      const owner = useGhostStore.getState().crewForBlock(npcBlock.id);
      expect(owner).toBeTruthy();
      expect(owner!.ownedBlockIds).toContain(npcBlock.id);
    }
  });

  it('overlays durable Ghost Crew data while retaining a local fallback for an empty server response', () => {
    useGhostStore.getState().seedCrews();
    const originalCount = Object.keys(useGhostStore.getState().crews).length;
    const crew = {
      ...useGhostStore.getState().crews['ghost-nightfall'],
      treasury: 3333,
      lastMove: 'Applied from authoritative world.',
    };

    useGhostStore.getState().replaceAuthoritativeState([crew], [{
      id: 'server-event-1',
      crewId: crew.id,
      crewName: crew.name,
      action: 'reinforce',
      description: crew.lastMove!,
      timestamp: Date.now(),
    }]);

    expect(useGhostStore.getState().crews).toEqual({ [crew.id]: crew });
    expect(useGhostStore.getState().feed[0]?.id).toBe('server-event-1');

    useGhostStore.getState().replaceAuthoritativeState([], []);
    expect(Object.keys(useGhostStore.getState().crews)).toHaveLength(1);
    expect(originalCount).toBeGreaterThan(1);
  });
});
