/**
 * Bip N Dip — session transitions (engine) and reward wiring (stores).
 *
 * The component itself is a thin renderer over these two layers; testing
 * them directly avoids driving two real timers through a React tree.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBipNDipSession,
  selectCar,
  breakWindowTap,
  revealLootSlot,
  tickSessionAlarm,
  bailOut,
  footChaseTap,
  finalizeSession,
  openSlots,
  generateBipCar,
  calculateTotalLootValue,
  type BipNDipSession,
  type BipCar,
  type LootItem,
} from '../../../utils/bipNDipEngine';
import { applyBipRewards, FENCE_RATE } from '../bipNDipRewards';
import { usePlayerStore, useGangStore, useEconomyStore } from '../../../stores/gameStore';

// ─── Fixtures ────────────────────────────────────────────────

function makeCar(overrides: Partial<BipCar> = {}): BipCar {
  return {
    id: 'car-test',
    name: 'Test Whip',
    tier: 'standard',
    hasAlarm: false,
    alarmTimer: 0,
    windowStrength: 2,
    sellValue: 3000,
    hotWireDifficulty: 5,
    speed: 5,
    reliability: 6,
    protection: 4,
    lootTable: [
      { windowSide: 'driver', items: [loot('Wallet', 'cash', 80)] },
      { windowSide: 'passenger', items: [loot('Glock 19', 'weapon', 900)] },
      { windowSide: 'rear_left', items: [loot('Nothing', 'nothing', 0)] },
      { windowSide: 'rear_right', items: [loot('Gold Watch', 'jewelry', 800)] },
    ],
    ...overrides,
  };
}

function loot(name: string, type: LootItem['type'], value: number): LootItem {
  return { id: `l-${name}`, name, type, value, rarity: 'common', description: '' };
}

function sessionWithCar(car: BipCar): BipNDipSession {
  const base = createBipNDipSession();
  return selectCar({ ...base, lineup: [car] }, car.id);
}

/** Break a window fully, whatever its strength. */
function smashThrough(session: BipNDipSession, side: 'driver' | 'passenger' = 'driver') {
  let s = session;
  for (let i = 0; i < 20 && s.phase === 'window_breaking'; i++) {
    s = breakWindowTap(s, side);
  }
  return s;
}

// ─── Phase transitions ───────────────────────────────────────

describe('bipNDip — phase transitions', () => {
  it('starts in car selection with no car chosen', () => {
    const s = createBipNDipSession();
    expect(s.phase).toBe('car_selection');
    expect(s.car).toBeNull();
  });

  it('selecting a car moves to window breaking and seeds all four windows', () => {
    const s = sessionWithCar(makeCar());
    expect(s.phase).toBe('window_breaking');
    expect(Object.keys(s.windowStates)).toHaveLength(4);
  });

  it('selecting an unknown car id is a no-op', () => {
    const base = createBipNDipSession();
    expect(selectCar(base, 'not-a-car')).toBe(base);
  });

  it('taps accumulate and crack level tracks progress', () => {
    let s = sessionWithCar(makeCar({ windowStrength: 4 }));
    s = breakWindowTap(s, 'driver');
    expect(s.windowStates.driver.tapsCurrent).toBe(1);
    expect(s.windowStates.driver.crackLevel).toBe(25);
    expect(s.phase).toBe('window_breaking');
  });

  it('breaking through advances to scavenging', () => {
    const s = smashThrough(sessionWithCar(makeCar({ windowStrength: 2 })));
    expect(s.windowStates.driver.isBroken).toBe(true);
    expect(s.phase).toBe('scavenging');
  });

  it('openSlots reports only broken windows', () => {
    const s = smashThrough(sessionWithCar(makeCar()));
    expect(openSlots(s)).toEqual(['driver']);
  });
});

// ─── Loot ────────────────────────────────────────────────────

describe('bipNDip — loot reveal', () => {
  it('reveals a slot and totals its value', () => {
    let s = smashThrough(sessionWithCar(makeCar()));
    s = revealLootSlot(s, 'driver');
    expect(s.lootCollected).toHaveLength(1);
    expect(s.totalValue).toBe(80);
  });

  it('filters out "nothing" entries', () => {
    let s = smashThrough(sessionWithCar(makeCar()));
    s = revealLootSlot(s, 'rear_left');
    expect(s.lootCollected).toHaveLength(0);
  });

  it('re-revealing the same slot does not duplicate loot', () => {
    let s = smashThrough(sessionWithCar(makeCar()));
    s = revealLootSlot(s, 'driver');
    s = revealLootSlot(s, 'driver');
    expect(s.lootCollected).toHaveLength(1);
    expect(s.totalValue).toBe(80);
  });

  it('cannot scavenge before a window is broken', () => {
    const s = sessionWithCar(makeCar());
    expect(revealLootSlot(s, 'driver')).toBe(s);
  });

  it('accumulates across multiple slots', () => {
    let s = smashThrough(sessionWithCar(makeCar()));
    s = revealLootSlot(s, 'driver');
    s = revealLootSlot(s, 'rear_right');
    expect(calculateTotalLootValue(s.lootCollected)).toBe(880);
  });
});

// ─── Alarm ───────────────────────────────────────────────────

describe('bipNDip — alarm', () => {
  it('does not tick for a car without an alarm', () => {
    const s = sessionWithCar(makeCar({ hasAlarm: false }));
    expect(tickSessionAlarm(s, 5)).toBe(s);
  });

  it('counts down while breaking in', () => {
    const s = sessionWithCar(makeCar({ hasAlarm: true, alarmTimer: 10 }));
    expect(tickSessionAlarm(s, 3).alarm.timeRemaining).toBe(7);
  });

  it('forces a foot chase when the clock runs out', () => {
    let s = sessionWithCar(makeCar({ hasAlarm: true, alarmTimer: 2 }));
    s = tickSessionAlarm(s, 5, 1);
    expect(s.alarm.copsArrived).toBe(true);
    expect(s.phase).toBe('foot_chase');
    expect(s.footChase?.isActive).toBe(true);
  });
});

// ─── Foot chase ──────────────────────────────────────────────

describe('bipNDip — foot chase', () => {
  function chasing() {
    let s = smashThrough(sessionWithCar(makeCar({ hasAlarm: true, alarmTimer: 1 })));
    s = revealLootSlot(s, 'driver');
    return tickSessionAlarm(s, 2, 1);
  }

  it('on-beat taps advance the beat counter', () => {
    const s = footChaseTap(chasing(), 1);
    expect(s.footChase?.currentBeat).toBe(1);
    expect(s.phase).toBe('foot_chase');
  });

  it('four consecutive misses trip twice and end in arrest', () => {
    let s = chasing();
    for (let i = 0; i < 4; i++) s = footChaseTap(s, 0);
    expect(s.phase).toBe('arrested');
  });

  it('clearing every beat escapes with the loot', () => {
    let s = chasing();
    const beats = s.footChase!.totalBeats;
    for (let i = 0; i < beats; i++) s = footChaseTap(s, 1);
    expect(s.phase).toBe('escape_success');
    expect(s.totalValue).toBe(80);
  });

  it('an arrest forfeits collected loot', () => {
    let s = chasing();
    expect(s.lootCollected).toHaveLength(1);
    for (let i = 0; i < 4; i++) s = footChaseTap(s, 0);
    expect(s.lootCollected).toHaveLength(0);
    expect(s.totalValue).toBe(0);
  });

  it('bailing out banks what is in hand', () => {
    let s = smashThrough(sessionWithCar(makeCar()));
    s = revealLootSlot(s, 'driver');
    s = bailOut(s);
    expect(s.phase).toBe('escape_success');
    expect(s.totalValue).toBe(80);
    expect(s.xpEarned).toBeGreaterThan(0);
  });
});

// ─── Reward wiring ───────────────────────────────────────────

describe('bipNDip — reward wiring', () => {
  const MEMBER_ID = 'm-bip-1';

  beforeEach(() => {
    usePlayerStore.setState({
      player: { ...usePlayerStore.getState().player, money: 1000, experience: 0 },
    } as never);
    useEconomyStore.setState({ inventory: [] } as never);
    useGangStore.setState({
      members: [
        {
          id: MEMBER_ID,
          name: 'Test Runner',
          role: 'recruit',
          level: 1,
          experience: 0,
          status: 'active',
        },
      ],
      contacts: [],
    } as never);
  });

  function escapedWith(items: LootItem[]): BipNDipSession {
    const base = sessionWithCar(makeCar());
    return finalizeSession({ ...base, phase: 'escape_success', lootCollected: items });
  }

  it('pays cash loot straight to the player', () => {
    const before = usePlayerStore.getState().player.money;
    const summary = applyBipRewards(escapedWith([loot('Wallet', 'cash', 80)]), MEMBER_ID);
    expect(summary.cash).toBe(80);
    expect(usePlayerStore.getState().player.money).toBe(before + 80);
  });

  it('banks drugs and weapons into the economy inventory', () => {
    const summary = applyBipRewards(
      escapedWith([loot('Glock 19', 'weapon', 900), loot('Bag of Weed', 'drug', 50)]),
      MEMBER_ID,
    );
    expect(summary.itemsBanked).toHaveLength(2);
    const inv = useEconomyStore.getState().inventory;
    expect(inv.map((i) => i.type).sort()).toEqual(['drug', 'weapon']);
  });

  it('fences jewelry, which has no inventory slot, at the fence rate', () => {
    const summary = applyBipRewards(escapedWith([loot('Gold Watch', 'jewelry', 800)]), MEMBER_ID);
    expect(summary.cash).toBe(Math.floor(800 * FENCE_RATE));
    expect(summary.itemsBanked).toHaveLength(0);
  });

  it('awards XP to the member on a clean escape', () => {
    applyBipRewards(escapedWith([loot('Wallet', 'cash', 80)]), MEMBER_ID);
    const member = useGangStore.getState().members.find((m) => m.id === MEMBER_ID);
    expect(member?.experience).toBeGreaterThan(0);
  });

  it('jails the member and pays nothing on an arrest', () => {
    const before = usePlayerStore.getState().player.money;
    const arrested = finalizeSession({
      ...sessionWithCar(makeCar()),
      phase: 'arrested',
      lootCollected: [loot('Wallet', 'cash', 80)],
    });
    const summary = applyBipRewards(arrested, MEMBER_ID);

    expect(summary.jailed).toBe(true);
    expect(summary.cash).toBe(0);
    expect(usePlayerStore.getState().player.money).toBe(before);
    expect(useGangStore.getState().members.find((m) => m.id === MEMBER_ID)?.status).toBe('jailed');
  });

  it('applies without a member id (empty crew) without throwing', () => {
    expect(() => applyBipRewards(escapedWith([loot('Wallet', 'cash', 80)]))).not.toThrow();
  });
});

// ─── Generation sanity ───────────────────────────────────────

describe('bipNDip — car generation', () => {
  it('always produces four loot slots', () => {
    for (let i = 0; i < 25; i++) {
      expect(generateBipCar().lootTable).toHaveLength(4);
    }
  });

  it('junk cars never carry alarms', () => {
    const junk = Array.from({ length: 40 }, () => generateBipCar()).filter((c) => c.tier === 'junk');
    expect(junk.every((c) => !c.hasAlarm)).toBe(true);
  });
});
