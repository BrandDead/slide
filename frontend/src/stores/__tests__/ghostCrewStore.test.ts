// Integration test for the Ghost Crew Store (#81).
// Verifies the acceptance criterion: a player who ignores the map for several
// ticks visibly loses ground to a named rival crew.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGhostStore } from '../ghostCrewStore';
import { useBlockStore } from '../blockStore';
import {
  DEFAULT_GHOST_CREWS,
  buildGhostBlock,
  type GhostCrew,
} from '../../utils/ghostCrewEngine';
import { BLOCK_DNA_LIBRARY } from '../../config/blockDNA';
import { prepareEncounter } from '../../game/combat/prepareEncounter';
import type { CombatResult } from '../../game/combat/types';

function resetStores() {
  window.localStorage.clear();
  useGhostStore.setState({
    crews: {},
    feed: [],
    tickActive: false,
    tickIndex: 0,
    appliedTickKeys: [],
    appliedResponseKeys: [],
  });
  useBlockStore.setState({ blocks: {}, selectedBlockId: null, activeDriveBys: {} });
}

function installOwnedGhostBlock(crewTemplate = DEFAULT_GHOST_CREWS[0]) {
  const dna = BLOCK_DNA_LIBRARY.find((candidate) => candidate.tier === 'starter')!;
  const block = buildGhostBlock(crewTemplate, dna);
  const crew: GhostCrew = {
    ...crewTemplate,
    ownedBlockIds: [block.id],
    claimedDnaIds: [dna.id],
    incomePerTick: block.incomePerTick,
  };
  useGhostStore.setState({ crews: { [crew.id]: crew } });
  useBlockStore.getState().upsertBlock(block);
  return { crew, block };
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

  it('three deterministic ticks visibly expand rival turf and create stable feed identities', () => {
    useGhostStore.getState().seedCrews();
    const before = Object.values(useGhostStore.getState().crews)
      .reduce((sum, c) => sum + c.ownedBlockIds.length, 0);
    expect(before).toBe(0);

    const receipts = [1, 2, 3].map((index) => useGhostStore.getState().runTick({
      tickKey: `acceptance:${index}`,
      seed: 8100 + index,
      occurredAt: 1_700_000_000_000 + index * 60_000,
    }));
    expect(receipts.every((receipt) => receipt.applied)).toBe(true);

    const crews = Object.values(useGhostStore.getState().crews);
    const after = crews.reduce((sum, c) => sum + c.ownedBlockIds.length, 0);
    expect(after).toBeGreaterThan(0);

    // … and the claimed turf is visible in blockStore as npc-owned blocks.
    const ghostBlocks = Object.values(useBlockStore.getState().blocks)
      .filter((b) => b.owner === 'npc');
    expect(ghostBlocks.length).toBe(after);
    expect(ghostBlocks[0].ownerGangName).toBeTruthy();
    expect(ghostBlocks[0].dnaId).toBeTruthy();
    expect(ghostBlocks[0].gridSource).toBe('dna-fallback');
    expect(useGhostStore.getState().feed).toHaveLength(12);
    expect(new Set(useGhostStore.getState().feed.map((event) => event.id)).size).toBe(12);
    expect(useGhostStore.getState().appliedTickKeys).toEqual([
      'acceptance:1', 'acceptance:2', 'acceptance:3',
    ]);
  });

  it('replaying a tick key does not double-spend, double-claim, or duplicate events', () => {
    useGhostStore.getState().seedCrews();
    const options = { tickKey: 'world:duplicate', seed: 441, occurredAt: 1_700_000_000_000 };
    const first = useGhostStore.getState().runTick(options);
    expect(first.applied).toBe(true);
    const snapshot = JSON.stringify({
      crews: useGhostStore.getState().crews,
      feed: useGhostStore.getState().feed,
      blocks: useBlockStore.getState().blocks,
    });

    expect(useGhostStore.getState().runTick(options)).toMatchObject({
      applied: false,
      reason: 'duplicate-tick',
      tickKey: options.tickKey,
    });
    expect(JSON.stringify({
      crews: useGhostStore.getState().crews,
      feed: useGhostStore.getState().feed,
      blocks: useBlockStore.getState().blocks,
    })).toBe(snapshot);
  });

  it('rejects malformed persisted rival state without partially applying the tick', () => {
    const malformed = {
      ...DEFAULT_GHOST_CREWS[0],
      treasury: Number.NaN,
    } as GhostCrew;
    useGhostStore.setState({ crews: { [malformed.id]: malformed } });

    expect(useGhostStore.getState().runTick({ tickKey: 'bad-state', seed: 1 })).toMatchObject({
      applied: false,
      reason: 'malformed-state',
    });
    expect(useGhostStore.getState().tickIndex).toBe(0);
    expect(useGhostStore.getState().feed).toEqual([]);
    expect(useBlockStore.getState().blocks).toEqual({});
  });

  it('records a grudge when the player attacks ghost turf', () => {
    const { crew, block } = installOwnedGhostBlock(DEFAULT_GHOST_CREWS[1]);
    const crewId = crew.id;
    const before = crew.grudge.score;
    expect(useGhostStore.getState().recordPlayerAttack(
      crewId,
      block.id,
      'encounter:grudge-1',
      1_700_000_000_000,
    )).toBe(true);
    const after = useGhostStore.getState().crews[crewId].grudge.score;
    expect(after).toBeGreaterThan(before);
    expect(useGhostStore.getState().recordPlayerAttack(
      crewId,
      block.id,
      'encounter:grudge-1',
      1_700_000_100_000,
    )).toBe(false);
    expect(useGhostStore.getState().crews[crewId].grudge.score).toBe(after);
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

    expect(useGhostStore.getState().crews[crew.id]).toEqual(crew);
    expect(Object.keys(useGhostStore.getState().crews)).toHaveLength(originalCount);
    expect(useGhostStore.getState().feed[0]?.id).toBe('server-event-1');

    useGhostStore.getState().replaceAuthoritativeState([], []);
    expect(Object.keys(useGhostStore.getState().crews)).toHaveLength(originalCount);
    expect(originalCount).toBeGreaterThan(1);
  });

  it('rehydrates claimed DNA into the shared territory store without overwriting player ownership', () => {
    const dna = BLOCK_DNA_LIBRARY[0];
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[0],
      ownedBlockIds: [`ghost-${dna.id}`],
      claimedDnaIds: [dna.id],
      incomePerTick: 120,
      lastTickAt: '2026-09-14T12:00:00.000Z',
    };

    useGhostStore.getState().replaceAuthoritativeState([crew], []);
    expect(useBlockStore.getState().blocks[`ghost-${dna.id}`]).toMatchObject({
      owner: 'npc',
      ownerGangName: crew.name,
      dnaId: dna.id,
      gridSource: 'dna-fallback',
    });

    const playerBlock = {
      ...buildGhostBlock(crew, dna),
      id: 'player-same-dna',
      owner: 'player' as const,
      ownerGangName: 'Player Crew',
    };
    useBlockStore.setState({ blocks: { 'player-same-dna': playerBlock } });
    useGhostStore.getState().replaceAuthoritativeState([crew], []);
    expect(useBlockStore.getState().blocks[`ghost-${dna.id}`]).toBeUndefined();
    expect(useBlockStore.getState().blocks['player-same-dna'].owner).toBe('player');
  });

  it('uses the existing encounter preparation and result ledgers for a replay-safe rival response', () => {
    const { crew, block } = installOwnedGhostBlock();
    const preparation = prepareEncounter(block);
    expect(preparation.sceneLabel).toBeTruthy();
    expect(preparation.terrain).toHaveLength(8);

    const result: CombatResult = {
      idempotencyKey: `${preparation.sessionId}:secured`,
      outcome: 'secured',
      crewDown: [],
      oppositionDown: ['opposition-1'],
      objectiveProgress: 1,
      heatDelta: 1,
      moraleDelta: 4,
      pendingIncomeDelta: 75,
      summary: 'Rival pressure answered.',
    };

    useBlockStore.getState().applyEncounterResult(block.id, result);
    expect(useGhostStore.getState().recordPlayerAttack(
      crew.id,
      block.id,
      result.idempotencyKey,
      1_700_000_000_000,
    )).toBe(true);
    const afterFirst = {
      block: useBlockStore.getState().blocks[block.id],
      grudge: useGhostStore.getState().crews[crew.id].grudge.score,
      feedCount: useGhostStore.getState().feed.length,
    };

    useBlockStore.getState().applyEncounterResult(block.id, result);
    expect(useGhostStore.getState().recordPlayerAttack(
      crew.id,
      block.id,
      result.idempotencyKey,
      1_700_000_100_000,
    )).toBe(false);
    const replayed = useBlockStore.getState().blocks[block.id];
    expect(replayed.heat).toBe(afterFirst.block.heat);
    expect(replayed.morale).toBe(afterFirst.block.morale);
    expect(replayed.pendingIncome).toBe(afterFirst.block.pendingIncome);
    expect(replayed.appliedEncounterResultKeys).toEqual([result.idempotencyKey]);
    expect(useGhostStore.getState().crews[crew.id].grudge.score).toBe(afterFirst.grudge);
    expect(useGhostStore.getState().feed).toHaveLength(afterFirst.feedCount);
  });

  it('restores rival state, event identity, tick receipt, response receipt, and territory after reload', async () => {
    useGhostStore.getState().seedCrews();
    const tick = useGhostStore.getState().runTick({
      tickKey: 'reload:tick-1',
      seed: 77,
      occurredAt: 1_700_000_000_000,
    });
    expect(tick.applied).toBe(true);
    const claimedBlock = Object.values(useBlockStore.getState().blocks).find((block) => block.owner === 'npc')!;
    const owner = useGhostStore.getState().crewForBlock(claimedBlock.id)!;
    expect(useGhostStore.getState().recordPlayerAttack(
      owner.id,
      claimedBlock.id,
      'reload:result-1',
      1_700_000_100_000,
    )).toBe(true);

    const savedGhost = window.localStorage.getItem('slide-ghost-crews');
    expect(savedGhost).toBeTruthy();
    const eventIds = useGhostStore.getState().feed.map((event) => event.id);

    useGhostStore.setState({
      crews: {}, feed: [], tickIndex: 0, tickActive: false,
      appliedTickKeys: [], appliedResponseKeys: [],
    });
    useBlockStore.setState({ blocks: {} });
    window.localStorage.setItem('slide-ghost-crews', savedGhost!);
    window.localStorage.removeItem('dealt-slide-blocks');

    await useGhostStore.persist.rehydrate();
    // App mount calls seedCrews; when rivals already exist this repairs only
    // their shared Block Store projection.
    useGhostStore.getState().seedCrews();

    expect(useGhostStore.getState().appliedTickKeys).toContain('reload:tick-1');
    expect(useGhostStore.getState().appliedResponseKeys).toContain('reload:result-1');
    expect(useGhostStore.getState().feed.map((event) => event.id)).toEqual(eventIds);
    expect(useBlockStore.getState().blocks[claimedBlock.id]).toMatchObject({
      owner: 'npc',
      dnaId: claimedBlock.dnaId,
    });
  });
});


describe('authoritative Ghost Crew hydration ordering', () => {
  beforeEach(resetStores);

  it('lets the authenticated server snapshot override a newer local demo timestamp', () => {
    useGhostStore.getState().seedCrews();
    const local = {
      ...useGhostStore.getState().crews['ghost-nightfall'],
      treasury: 7777,
      lastTickAt: '2026-09-02T20:30:00.000Z',
    };
    useGhostStore.setState({ crews: { ...useGhostStore.getState().crews, [local.id]: local } });

    useGhostStore.getState().replaceAuthoritativeState([{
      ...local,
      treasury: 100,
      lastTickAt: '2026-09-02T20:00:00.000Z',
    }], []);

    expect(useGhostStore.getState().crews[local.id].treasury).toBe(100);
  });
});
