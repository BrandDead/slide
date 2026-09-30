// #163 — a visible Ghost Crew attack on the Strip block becomes the Strip's
// named threat, resolves exactly once, and explains itself on return.
import { beforeEach, describe, expect, it } from 'vitest';
import { useBlockStore } from '../blockStore';
import { usePlayerStore } from '../gameStore';
import { useDrugInventory } from '../useDrugInventory';
import { findPendingRivalIncident, useBlockLoopStore } from '../blockLoopStore';
import {
  pendingRivalAttacks,
  rivalAttackReceiptKey,
  useGhostStore,
  type GhostFeedEvent,
} from '../ghostCrewStore';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';
import { applyDemoSeed } from '../../utils/demoSeed';
import { clearLoopLedger, readLoopLedger } from '../../game/loop/blockLoopPersist';
import { seededLoopEncounter } from '../../game/loop/blockLoopEngine';
import { rivalResolutionFor } from '../../game/loop/threatHandoff';
import { toCityBriefItems } from '../../components/layout/cityBriefingModel';
import { applyRivalDefenseOutcome, DEFAULT_GHOST_CREWS } from '../../utils/ghostCrewEngine';

const NOW = 1_780_000_000_000;

function attack(overrides: Partial<GhostFeedEvent> = {}): GhostFeedEvent {
  return {
    id: 'feed-tick-9:ghost-nightfall:attack',
    actionKey: 'tick-9:ghost-nightfall:attack',
    crewId: 'ghost-nightfall',
    crewName: 'Nightfall Crew',
    action: 'attack',
    description: 'Nightfall Crew is probing 1208 W Las Olas Blvd.',
    targetBlockId: BLOCK_LOOP_IDS.blockId,
    timestamp: NOW,
    reason: 'grudge-retaliation',
    ...overrides,
  };
}

function reset() {
  window.localStorage.clear();
  useBlockStore.setState({
    blocks: {},
    selectedBlockId: null,
    activeDriveBys: {},
    isPlacementMode: false,
    pendingPlacementMemberId: null,
    pendingPlacementMember: null,
  });
  useDrugInventory.setState({ inventory: {}, assignments: {} });
  useBlockLoopStore.setState({ started: false });
  useGhostStore.setState({
    crews: {},
    feed: [],
    tickActive: false,
    tickIndex: 0,
    appliedTickKeys: [],
    appliedResponseKeys: [],
  });
  clearLoopLedger();
}

function runToEncounter() {
  const store = useBlockLoopStore.getState();
  store.startLoop(true);
  store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
  store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
  store.place(BLOCK_LOOP_IDS.shooterId, 5, 3);
  store.assignProduct();
  store.runDeal();
  store.beginEncounter();
  return useBlockLoopStore.getState().loop;
}

describe('pending rival attacks', () => {
  beforeEach(reset);

  it('lists unanswered attacks on one block, newest first, and skips defense receipts', () => {
    const older = attack({ id: 'a-old', actionKey: 'k-old', timestamp: NOW - 1000 });
    const newer = attack({ id: 'a-new', actionKey: 'k-new', timestamp: NOW });
    const elsewhere = attack({ id: 'a-far', actionKey: 'k-far', targetBlockId: 'block-elsewhere' });
    const receipt = attack({ id: 'defense-k-x', actionKey: 'defense:k-x', reason: 'defense-held' });
    const pending = pendingRivalAttacks([older, elsewhere, receipt, newer], BLOCK_LOOP_IDS.blockId, ['k-old']);
    expect(pending.map((event) => event.id)).toEqual(['a-new']);
    expect(rivalAttackReceiptKey({ id: 'x', actionKey: undefined })).toBe('x');
  });

  it('names the rival from the crew record when the feed line is shorter', () => {
    useGhostStore.getState().seedCrews();
    useGhostStore.setState({ feed: [attack({ crewName: 'Nightfall' })] });
    expect(findPendingRivalIncident()?.crewName).toBe('Nightfall Crew');
  });
});

describe('Ghost Crew attack on the Strip (#163)', () => {
  beforeEach(reset);

  it('turns the attack into the named SLIDE threat and resolves it exactly once', () => {
    applyDemoSeed();
    useGhostStore.getState().seedCrews();
    const second = attack({ id: 'feed-tick-4:ghost-nightfall:attack', actionKey: 'tick-4:ghost-nightfall:attack', timestamp: NOW - 5000 });
    const other = attack({ id: 'feed-tick-9:ghost-chaos:attack', actionKey: 'tick-9:ghost-chaos:attack', crewId: 'ghost-chaos', crewName: 'Westside Wolves', timestamp: NOW - 9000 });
    useGhostStore.setState({ feed: [attack(), second, other] });
    const rosterBefore = useGhostStore.getState().crews['ghost-nightfall'].roster.filter((member) => member.alive).length;
    const grudgeBefore = useGhostStore.getState().crews['ghost-nightfall'].grudge.score;

    const live = runToEncounter();
    expect(live.threat?.route).toBe('slide');
    expect(live.rivalIncident?.crewName).toBe('Nightfall Crew');
    expect(live.rivalIncident?.receiptKey).toBe('tick-9:ghost-nightfall:attack');
    expect(live.threat?.reason).toMatch(/Nightfall Crew is sliding/);

    const result = seededLoopEncounter(live);
    expect(result.idempotencyKey).toContain('tick-9:ghost-nightfall:attack');
    useBlockLoopStore.getState().resolveEncounter(result);

    const loop = useBlockLoopStore.getState().loop;
    expect(loop.rivalResolution?.outcome).toBe('overrun');
    expect(loop.briefing[0]).toMatch(/Nightfall Crew overran/);

    const ghost = useGhostStore.getState();
    expect(ghost.appliedResponseKeys).toEqual(expect.arrayContaining([
      'tick-9:ghost-nightfall:attack',
      'tick-4:ghost-nightfall:attack',
      'defense:tick-9:ghost-nightfall:attack',
    ]));
    // The other crew's probe is still open.
    expect(findPendingRivalIncident()?.crewId).toBe('ghost-chaos');
    expect(ghost.crews['ghost-nightfall'].grudge.score).toBe(Math.max(0, grudgeBefore - 20));
    expect(ghost.crews['ghost-nightfall'].roster.filter((member) => member.alive)).toHaveLength(rosterBefore);
    expect(ghost.feed[0]).toMatchObject({ reason: 'defense-overrun', targetBlockId: BLOCK_LOOP_IDS.blockId });

    // Replaying the same encounter ticket changes nothing on either side.
    const feedLength = ghost.feed.length;
    const grudge = ghost.crews['ghost-nightfall'].grudge.score;
    useBlockLoopStore.getState().resolveEncounter(result);
    expect(useGhostStore.getState().feed).toHaveLength(feedLength);
    expect(useGhostStore.getState().crews['ghost-nightfall'].grudge.score).toBe(grudge);
    expect(useGhostStore.getState().resolveRivalAttack({
      crewId: 'ghost-nightfall',
      crewName: 'Nightfall Crew',
      blockId: BLOCK_LOOP_IDS.blockId,
      blockLabel: '1208 W Las Olas Blvd',
      receiptKey: 'tick-9:ghost-nightfall:attack',
      outcome: 'secured',
    })).toBe(false);

    // Return briefing and the persisted ledger both explain the rival result.
    useBlockLoopStore.getState().returnToDesktop();
    const returned = useBlockLoopStore.getState().loop;
    expect(returned.briefing[0]).toMatch(/Nightfall Crew overran/);
    const ledger = readLoopLedger();
    expect(ledger?.rivalResolution?.receiptKey).toBe('tick-9:ghost-nightfall:attack');
    expect(ledger?.threatReason).toMatch(/Nightfall Crew is sliding/);

    // The City Briefing leads with the defense result and routes to the Strip.
    const items = toCityBriefItems(useGhostStore.getState().feed, useGhostStore.getState().appliedResponseKeys);
    const [top] = items;
    expect(items.some((item) => item.id === 'feed-tick-9:ghost-nightfall:attack')).toBe(false);
    expect(top.category).toBe('DEFENSE RESULT');
    expect(top.tone).toBe('danger');
    expect(top.cta).toEqual({ label: 'REVIEW THE STRIP', destination: 'block_loop' });
  });

  it('keeps the generic SLIDE threat when no rival is attacking', () => {
    applyDemoSeed();
    useGhostStore.setState({ feed: [] });
    const live = runToEncounter();
    expect(live.rivalIncident).toBeNull();
    expect(live.threat?.route).toBe('slide');
    useBlockLoopStore.getState().resolveEncounter(seededLoopEncounter(live));
    expect(useBlockLoopStore.getState().loop.rivalResolution).toBeNull();
    expect(useGhostStore.getState().feed).toHaveLength(0);
  });

  it('leaves a newer attack open when it arrives during the snapshotted encounter', () => {
    applyDemoSeed();
    useGhostStore.getState().seedCrews();
    useGhostStore.setState({ feed: [attack()] });
    const live = runToEncounter();
    const newer = attack({ id: 'new-probe', actionKey: 'new-probe-key', timestamp: NOW + 1_000 });
    useGhostStore.setState({ feed: [newer, ...useGhostStore.getState().feed] });
    useBlockLoopStore.getState().resolveEncounter(seededLoopEncounter(live));
    expect(findPendingRivalIncident()?.receiptKey).toBe('new-probe-key');
    expect(useGhostStore.getState().appliedResponseKeys).not.toContain('new-probe-key');
  });

  it('keeps the booked defense visible across two demo reloads without repeating rival consequences', () => {
    applyDemoSeed();
    useGhostStore.getState().seedCrews();
    useGhostStore.setState({ feed: [attack()] });
    const live = runToEncounter();
    useBlockLoopStore.getState().resolveEncounter(seededLoopEncounter(live));
    const rival = useGhostStore.getState().crews['ghost-nightfall'];
    for (let reload = 0; reload < 2; reload++) {
      applyDemoSeed();
      const items = toCityBriefItems(useGhostStore.getState().feed, useGhostStore.getState().appliedResponseKeys);
      expect(items.some(item => item.category === 'DEFENSE RESULT' && item.description.includes('overran'))).toBe(true);
      expect(useGhostStore.getState().crews['ghost-nightfall']).toEqual(rival);
      expect(useGhostStore.getState().feed.filter(event => event.reason === 'defense-overrun')).toHaveLength(1);
    }
  });

  it('does not change rival state for a signed-in account', () => {
    applyDemoSeed();
    useGhostStore.getState().seedCrews();
    useGhostStore.setState({ feed: [attack()] });
    usePlayerStore.getState().updatePlayer({ id: 'account-123' });
    const live = runToEncounter();
    useBlockLoopStore.getState().resolveEncounter(seededLoopEncounter(live));
    expect(useGhostStore.getState().appliedResponseKeys).toEqual([]);
    usePlayerStore.getState().updatePlayer({ id: 'demo-player' });
  });
});

describe('applyRivalDefenseOutcome', () => {
  const crew = { ...DEFAULT_GHOST_CREWS[0], grudge: { score: 50 } };

  it('costs the rival a shooter when the player holds, but never its last member', () => {
    const held = applyRivalDefenseOutcome(crew, 'secured', BLOCK_LOOP_IDS.blockId, NOW);
    expect(held.roster.filter((member) => member.alive)).toHaveLength(crew.roster.filter((member) => member.alive).length - 1);
    expect(held.grudge.score).toBe(60);
    const lastOne = { ...crew, roster: [{ ...crew.roster[0], alive: true }] };
    expect(applyRivalDefenseOutcome(lastOne, 'secured', BLOCK_LOOP_IDS.blockId, NOW).roster[0].alive).toBe(true);
  });

  it('pays the rival when it overruns or the crew backs off', () => {
    expect(applyRivalDefenseOutcome(crew, 'overrun', BLOCK_LOOP_IDS.blockId, NOW)).toMatchObject({
      treasury: crew.treasury + 200,
      grudge: { score: 30 },
    });
    expect(applyRivalDefenseOutcome(crew, 'retreated', BLOCK_LOOP_IDS.blockId, NOW)).toMatchObject({
      treasury: crew.treasury + 50,
      grudge: { score: 45 },
    });
  });

  it('names the actual fallback casualty and reports no loss for a sole survivor', () => {
    const noShooter = { ...crew, roster: [
      { ...crew.roster[0], id: 'dealer-only', role: 'dealer' as const, alive: true },
      { ...crew.roster[0], id: 'enforcer-only', role: 'enforcer' as const, alive: true },
    ] };
    const held = applyRivalDefenseOutcome(noShooter, 'secured', BLOCK_LOOP_IDS.blockId, NOW);
    expect(held.lastMove).toMatch(/lost an? enforcer/i);
    expect(held.lastMove).not.toMatch(/lost a shooter/i);
    const alone = applyRivalDefenseOutcome({ ...noShooter, roster: noShooter.roster.slice(0, 1) }, 'secured', BLOCK_LOOP_IDS.blockId, NOW);
    expect(alone.lastMove).toMatch(/no roster loss/i);
    expect(alone.roster[0].alive).toBe(true);
  });

  it('does not invent a shooter casualty in the feed or pure loop receipt', () => {
    reset();
    const survivor = { ...crew, roster: [{ ...crew.roster[0], alive: true }] };
    useGhostStore.setState({ crews: { [crew.id]: survivor }, feed: [] });
    useGhostStore.getState().resolveRivalAttack({ crewId: crew.id, crewName: crew.name, blockId: BLOCK_LOOP_IDS.blockId, blockLabel: '1208', receiptKey: 'sole-survivor', outcome: 'secured', occurredAt: NOW });
    expect(useGhostStore.getState().feed[0].description).not.toMatch(/lost a shooter/i);
    const receipt = rivalResolutionFor({ receiptKey: 'sole-survivor', eventId: 'a', crewId: crew.id, crewName: crew.name, description: 'probe', occurredAt: NOW }, { outcome: 'secured', crewDown: [] }, '1208');
    expect(receipt.line).not.toMatch(/lost a shooter/i);
  });
});
