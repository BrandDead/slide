/**
 * Police Raid — engine rules and store consequences.
 *
 * The engine advances off an explicit elapsed-ms value, so a whole
 * 30-second raid resolves synchronously here with no fake timers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRaidState,
  createRaidMember,
  spawnUnits,
  tapMember,
  advanceRaid,
  expireRaid,
  evacProgress,
  secondsRemaining,
  caughtMembers,
  savedMembers,
  estimateHeld,
  isTileThreatened,
  RAID_CONFIG,
  type RaidState,
} from '../../../utils/policeRaidEngine';
import { applyRaidConsequences } from '../policeRaidRewards';
import { selectRaidTarget, suppressesBackgroundRaid, RAID_TRIGGER_CONFIG } from '../../../utils/raidTrigger';
import { usePlayerStore, useGangStore, useEconomyStore } from '../../../stores/gameStore';
import { useBlockStore } from '../../../stores/blockStore';
import type { BlockPlacement, BlockData } from '../../../types/block.types';

// ─── Fixtures ────────────────────────────────────────────────

function placement(over: Partial<BlockPlacement> = {}): BlockPlacement {
  return {
    memberId: 'm1',
    memberName: 'Trap Mike',
    role: 'dealer',
    x: 3,
    y: 4,
    zoneType: 'corner',
    incomePerTick: 60,
    exposureRisk: 20,
    level: 2,
    health: 100,
    ...over,
  } as BlockPlacement;
}

function block(over: Partial<BlockData> = {}): BlockData {
  return {
    id: 'blk-1',
    address: 'Test Block',
    lat: 0,
    lng: 0,
    owner: 'player',
    grid: useBlockStore.getState().generateDefaultGrid(),
    placements: [placement()],
    incomePerTick: 60,
    heat: 5,
    morale: 60,
    members: 1,
    viewMode: 'topdown',
    pendingIncome: 0,
    ...over,
  } as BlockData;
}

// ─── Setup ───────────────────────────────────────────────────

describe('policeRaid — setup', () => {
  it('starts in progress with no seizures', () => {
    const s = createRaidState([placement()]);
    expect(s.outcome).toBe('in_progress');
    expect(s.seizedCash).toBe(0);
    expect(s.elapsedMs).toBe(0);
  });

  it('spawns a unit at each edge of every occupied column', () => {
    const members = [placement({ x: 2 }), placement({ memberId: 'm2', x: 5 })].map(createRaidMember);
    const units = spawnUnits(members);
    expect(units).toHaveLength(4);
    expect(units.filter((u) => u.y === 0)).toHaveLength(2);
    expect(units.filter((u) => u.y === RAID_CONFIG.GRID_SIZE - 1)).toHaveLength(2);
  });

  it('does not spawn duplicate lanes for two members in one column', () => {
    const members = [placement({ x: 4, y: 2 }), placement({ memberId: 'm2', x: 4, y: 6 })].map(createRaidMember);
    expect(spawnUnits(members)).toHaveLength(2);
  });

  it('still spawns a token pair when nobody is deployed', () => {
    expect(spawnUnits([])).toHaveLength(2);
  });

  it('derives held cash and product from the corner income', () => {
    const held = estimateHeld(placement({ incomePerTick: 60 }));
    expect(held.cash).toBe(480);
    expect(held.drugs).toBe(5);
  });

  it('a zero-income placement still carries at least one unit of product', () => {
    expect(estimateHeld(placement({ incomePerTick: 0 })).drugs).toBe(1);
  });
});

// ─── Evacuation ──────────────────────────────────────────────

describe('policeRaid — evacuation', () => {
  it('tapping a member starts their evac clock', () => {
    const s = tapMember(createRaidState([placement()]), 'm1');
    expect(s.members[0].status).toBe('evacuating');
    expect(s.members[0].evacStartedAt).toBe(0);
  });

  it('an unknown member id is a no-op', () => {
    const s = createRaidState([placement()]);
    expect(tapMember(s, 'nobody')).toBe(s);
  });

  it('re-tapping does not restart the timer', () => {
    let s = tapMember(createRaidState([placement()]), 'm1');
    s = advanceRaid(s, 500);
    const retapped = tapMember(s, 'm1');
    expect(retapped.members[0].evacStartedAt).toBe(0);
  });

  it('completes after the evac duration', () => {
    let s = tapMember(createRaidState([placement({ x: 0, y: 4 })]), 'm1');
    s = advanceRaid(s, RAID_CONFIG.EVAC_DURATION_MS);
    expect(s.members[0].status).toBe('safe');
  });

  it('is still in flight one tick before completion', () => {
    let s = tapMember(createRaidState([placement({ x: 0, y: 4 })]), 'm1');
    s = advanceRaid(s, RAID_CONFIG.EVAC_DURATION_MS - 100);
    expect(s.members[0].status).toBe('evacuating');
  });

  it('reports progress between 0 and 1', () => {
    let s = tapMember(createRaidState([placement({ x: 0, y: 4 })]), 'm1');
    s = advanceRaid(s, 750);
    expect(evacProgress(s.members[0], s.elapsedMs)).toBeCloseTo(0.5, 1);
  });
});

// ─── Police advance & capture ────────────────────────────────

describe('policeRaid — capture', () => {
  it('units advance one tile per second', () => {
    const s = advanceRaid(createRaidState([placement({ x: 3, y: 4 })]), 3_000);
    expect(s.units.find((u) => u.direction === 1)?.y).toBe(3);
  });

  it('units stop at the far edge instead of walking off the grid', () => {
    const s = advanceRaid(createRaidState([placement({ x: 3, y: 4 })]), 60_000);
    expect(s.units.every((u) => u.y >= 0 && u.y < RAID_CONFIG.GRID_SIZE)).toBe(true);
  });

  it('advancing is idempotent — many small steps land where one big step does', () => {
    // Regression: units were previously advanced from their CURRENT row
    // rather than their spawn row, so each call compounded. The component
    // drives this from requestAnimationFrame (~60 calls/sec), which made
    // police cross the whole board almost instantly.
    // y=3 sits outside the 2s reach of both lanes (top gets to y=2, bottom
    // to y=5), so the raid stays in progress and units keep advancing.
    const start = createRaidState([placement({ x: 3, y: 3 })]);

    let stepped = start;
    for (let t = 100; t <= 2_000; t += 100) stepped = advanceRaid(stepped, t);
    const jumped = advanceRaid(start, 2_000);

    expect(stepped.units.map((u) => u.y)).toEqual(jumped.units.map((u) => u.y));
  });

  it('holds the advertised one-tile-per-second pace under a frame-rate loop', () => {
    let s = createRaidState([placement({ x: 3, y: 3 })]);
    for (let t = 16; t <= 2_000; t += 16) s = advanceRaid(s, t);
    expect(s.units.find((u) => u.direction === 1)?.y).toBe(2);
    expect(s.units.find((u) => u.direction === -1)?.y).toBe(5);
  });

  it('catches a member who was never tapped', () => {
    // Top unit starts at y=0 and needs 2s to reach y=2.
    const s = advanceRaid(createRaidState([placement({ x: 3, y: 2 })]), 2_000);
    expect(s.members[0].status).toBe('caught');
    expect(caughtMembers(s)).toHaveLength(1);
  });

  it('seizes what a caught member was holding', () => {
    const s = advanceRaid(createRaidState([placement({ x: 3, y: 2, incomePerTick: 60 })]), 2_000);
    expect(s.seizedCash).toBe(480);
    expect(s.seizedDrugs).toBe(5);
  });

  it('a member who got out first is not caught when the unit arrives', () => {
    let s = createRaidState([placement({ x: 3, y: 2 })]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, RAID_CONFIG.EVAC_DURATION_MS);
    s = advanceRaid(s, 2_000);
    expect(s.members[0].status).toBe('safe');
    expect(s.seizedCash).toBe(0);
  });

  it('a tie between evac completion and arrival goes to the player', () => {
    // Unit reaches y=3 at t=3000; evac started at 1500 completes at 3000.
    let s = createRaidState([placement({ x: 3, y: 3 })]);
    s = advanceRaid(s, 1_500);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 3_000);
    expect(s.members[0].status).toBe('safe');
  });

  it('an evacuation still in flight when police arrive fails', () => {
    let s = createRaidState([placement({ x: 3, y: 2 })]);
    s = advanceRaid(s, 1_500);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, 2_000);
    expect(s.members[0].status).toBe('caught');
  });

  it('flags tiles a unit is about to step onto', () => {
    const s = advanceRaid(createRaidState([placement({ x: 3, y: 4 })]), 2_000);
    expect(isTileThreatened(s, 3, 3)).toBe(true);
    expect(isTileThreatened(s, 0, 0)).toBe(false);
  });
});

// ─── Outcomes ────────────────────────────────────────────────

describe('policeRaid — outcomes', () => {
  it('everyone out is a clean result', () => {
    let s = createRaidState([placement({ x: 0, y: 4 })]);
    s = tapMember(s, 'm1');
    s = advanceRaid(s, RAID_CONFIG.EVAC_DURATION_MS);
    expect(s.outcome).toBe('clean');
    expect(savedMembers(s)).toHaveLength(1);
  });

  it('everyone taken is a disaster', () => {
    const s = advanceRaid(createRaidState([placement({ x: 3, y: 2 })]), 2_000);
    expect(s.outcome).toBe('disaster');
  });

  it('a mixed result is partial', () => {
    let s = createRaidState([
      placement({ memberId: 'm1', x: 3, y: 2 }),
      placement({ memberId: 'm2', x: 5, y: 4 }),
    ]);
    s = tapMember(s, 'm2');
    s = advanceRaid(s, RAID_CONFIG.EVAC_DURATION_MS);
    s = advanceRaid(s, 2_000);
    expect(s.outcome).toBe('partial');
  });

  it('anyone still out when the clock expires is caught', () => {
    const s = expireRaid(createRaidState([placement({ x: 0, y: 4 })]));
    expect(s.members[0].status).toBe('caught');
    expect(s.outcome).toBe('disaster');
  });

  it('a resolved raid ignores further advances', () => {
    const done = expireRaid(createRaidState([placement({ x: 0, y: 4 })]));
    expect(advanceRaid(done, 99_000)).toBe(done);
  });

  it('counts remaining seconds down from the full duration', () => {
    const s = createRaidState([placement()]);
    expect(secondsRemaining(s)).toBe(30);
    expect(secondsRemaining(advanceRaid(s, 10_000))).toBe(20);
  });
});

// ─── Store consequences ──────────────────────────────────────

describe('policeRaid — consequences', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      player: { ...usePlayerStore.getState().player, money: 10_000 },
    } as never);
    useEconomyStore.setState({
      inventory: [
        { id: '1', type: 'drug', itemId: 'weed', name: 'Cannabis', quantity: 10, value: 20 },
        { id: '2', type: 'drug', itemId: 'coke', name: 'Cocaine', quantity: 10, value: 80 },
      ],
    } as never);
    useGangStore.setState({
      members: [{ id: 'm1', name: 'Trap Mike', role: 'dealer', level: 2, status: 'active' }],
      contacts: [],
    } as never);
    useBlockStore.setState({ blocks: {}, selectedBlockId: null } as never);
  });

  function raidedState(): RaidState {
    useBlockStore.getState().upsertBlock(block());
    return advanceRaid(createRaidState([placement({ x: 3, y: 2 })], 'blk-1'), 2_000);
  }

  it('jails every caught member', () => {
    const result = applyRaidConsequences(raidedState());
    expect(result.jailedIds).toEqual(['m1']);
    expect(useGangStore.getState().members[0].status).toBe('jailed');
  });

  it('takes the seized cash off the player', () => {
    const result = applyRaidConsequences(raidedState());
    expect(result.cashSeized).toBe(480);
    expect(usePlayerStore.getState().player.money).toBe(10_000 - 480);
  });

  it('never seizes more cash than the player has', () => {
    usePlayerStore.setState({
      player: { ...usePlayerStore.getState().player, money: 100 },
    } as never);
    const result = applyRaidConsequences(raidedState());
    expect(result.cashSeized).toBe(100);
    expect(usePlayerStore.getState().player.money).toBe(0);
  });

  it('draws product from the cheapest stock first', () => {
    applyRaidConsequences(raidedState());
    const inv = useEconomyStore.getState().inventory;
    expect(inv.find((i) => i.itemId === 'weed')?.quantity).toBe(5);
    expect(inv.find((i) => i.itemId === 'coke')?.quantity).toBe(10);
  });

  it('drops block heat after the raid', () => {
    const result = applyRaidConsequences(raidedState());
    expect(result.blockHeatAfter).toBe(RAID_CONFIG.POST_RAID_HEAT);
    expect(useBlockStore.getState().getBlock('blk-1')?.heat).toBe(RAID_CONFIG.POST_RAID_HEAT);
  });

  it('pulls caught members off the block grid', () => {
    applyRaidConsequences(raidedState());
    expect(useBlockStore.getState().getBlock('blk-1')?.placements).toHaveLength(0);
  });

  it('a clean raid costs nothing and jails nobody', () => {
    useBlockStore.getState().upsertBlock(block());
    let s = createRaidState([placement({ x: 0, y: 4 })], 'blk-1');
    s = tapMember(s, 'm1');
    s = advanceRaid(s, RAID_CONFIG.EVAC_DURATION_MS);

    const result = applyRaidConsequences(s);
    expect(result.jailedIds).toHaveLength(0);
    expect(result.cashSeized).toBe(0);
    expect(usePlayerStore.getState().player.money).toBe(10_000);
  });
});

// ─── Trigger ─────────────────────────────────────────────────

describe('policeRaid — trigger', () => {
  beforeEach(() => {
    useBlockStore.setState({ blocks: {}, selectedBlockId: null } as never);
  });

  it('fires on a player block at max heat with crew deployed', () => {
    const decision = selectRaidTarget({ 'blk-1': block({ heat: 5 }) }, {}, 0);
    expect(decision?.blockId).toBe('blk-1');
    expect(suppressesBackgroundRaid(decision)).toBe(true);
  });

  it('does not fire below the heat threshold', () => {
    expect(selectRaidTarget({ 'blk-1': block({ heat: 4 }) }, {}, 0)).toBeNull();
  });

  it('does not fire on an empty block — nothing is at stake', () => {
    expect(selectRaidTarget({ 'blk-1': block({ placements: [] }) }, {}, 0)).toBeNull();
  });

  it('ignores blocks the player does not own', () => {
    expect(selectRaidTarget({ 'blk-1': block({ owner: 'npc' }) }, {}, 0)).toBeNull();
  });

  it('respects the per-block cooldown', () => {
    const blocks = { 'blk-1': block() };
    expect(selectRaidTarget(blocks, { 'blk-1': 0 }, 3)).toBeNull();
    expect(selectRaidTarget(blocks, { 'blk-1': 0 }, RAID_TRIGGER_CONFIG.COOLDOWN_TICKS)).not.toBeNull();
  });

  it('picks the busiest block when several are maxed', () => {
    const busy = block({
      id: 'blk-2',
      placements: [placement(), placement({ memberId: 'm2', x: 5 })],
    });
    const decision = selectRaidTarget({ 'blk-1': block(), 'blk-2': busy }, {}, 0);
    expect(decision?.blockId).toBe('blk-2');
  });

  it('lets the background roll through when nothing qualifies', () => {
    expect(suppressesBackgroundRaid(null)).toBe(false);
  });
});
