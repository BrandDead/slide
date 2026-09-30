import { describe, expect, it } from 'vitest';
import { BLOCK_LOOP_IDS } from '../blockLoopTypes';
import { LOOP_RE_UP, REST_RETURN_HEALTH, createLoopState } from '../blockLoopFixture';
import { reduceLoop, retreatLoopEncounter, runLoopCommands, seededLoopEncounter } from '../blockLoopEngine';
import { toLoopLedger } from '../blockLoopPersist';
import type { LoopState } from '../blockLoopTypes';

const CREW = [
  { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
  { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
  { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
] as const;

const ASSIGN = { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId } as const;

/** One full shift ending in Dre's wound. */
function woundedShift(initial: LoopState = createLoopState()): LoopState {
  const live = runLoopCommands([...CREW, ASSIGN, { type: 'run-deal' }, { type: 'begin-encounter' }], initial);
  return reduceLoop(live, { type: 'apply-encounter', result: seededLoopEncounter(live) });
}

function dealer(state: LoopState) {
  return state.members.find((member) => member.id === BLOCK_LOOP_IDS.dealerId)!;
}

describe('repeatable Strip shifts', () => {
  it('will not start a new shift mid-shift or with an open recovery', () => {
    const placed = runLoopCommands([...CREW]);
    expect(reduceLoop(placed, { type: 'next-shift' }).rejection).toMatch(/Finish this shift/);
    const hurt = woundedShift();
    expect(hurt.recovery?.memberName).toBe('Lil Dre');
    expect(reduceLoop(hurt, { type: 'next-shift' }).rejection).toMatch(/Decide on Lil Dre first/);
  });

  it('brings a rested dealer back hurt and books a second, separate shift', () => {
    const first = woundedShift();
    const rested = reduceLoop(first, { type: 'recover', pay: false });
    expect(dealer(rested).health).toBe(0);
    const shift2 = reduceLoop(rested, { type: 'next-shift' });
    expect(shift2.rejection).toBeNull();
    expect(shift2.shiftIndex).toBe(2);
    expect(shift2.phase).toBe('product');
    expect(dealer(shift2).health).toBe(REST_RETURN_HEALTH);
    expect(shift2.block.placements.find((item) => item.memberId === BLOCK_LOOP_IDS.dealerId)?.health).toBe(REST_RETURN_HEALTH);
    expect(shift2.playerHeat).toBeLessThan(first.playerHeat);
    expect(shift2.lastDeal).toBeNull();
    expect(shift2.lastEncounter).toBeNull();
    expect(shift2.briefing[0]).toMatch(/^Shift 2 on 1208 W Las Olas Blvd/);

    const dealt = reduceLoop(reduceLoop(shift2, ASSIGN), { type: 'run-deal' });
    expect(dealt.rejection).toBeNull();
    expect(dealt.lastDeal?.key).toMatch(/:2$/);
    expect(dealt.lastDeal?.key).not.toBe(first.lastDeal?.key);
    expect(dealt.money).toBeGreaterThan(shift2.money);

    const live = reduceLoop(dealt, { type: 'begin-encounter' });
    const result = seededLoopEncounter(live);
    expect(result.idempotencyKey).toMatch(/:shift-2$/);
    const booked = reduceLoop(live, { type: 'apply-encounter', result });
    expect(booked.briefing[0]).not.toMatch(/Same encounter ticket/);
    expect(booked.appliedEncounterKeys).toHaveLength(2);
  });

  it('keeps a paid hospital visit on the board so the dealer fights at full health', () => {
    const paid = reduceLoop(woundedShift(), { type: 'recover', pay: true });
    expect(paid.block.placements.find((item) => item.memberId === BLOCK_LOOP_IDS.dealerId)?.health).toBe(100);
    const shift2 = reduceLoop(paid, { type: 'next-shift' });
    expect(dealer(shift2).health).toBe(100);
  });

  it('re-ups River Cut for cash and refuses when the cash is short', () => {
    const state = createLoopState();
    const bought = reduceLoop(state, { type: 're-up' });
    expect(bought.money).toBe(state.money - LOOP_RE_UP.cost);
    expect(bought.inventory[0].quantity).toBe(state.inventory[0].quantity + LOOP_RE_UP.units);
    const broke = reduceLoop({ ...state, money: LOOP_RE_UP.cost - 1 }, { type: 're-up' });
    expect(broke.rejection).toMatch(/re-up costs/i);
    expect(broke.inventory[0].quantity).toBe(state.inventory[0].quantity);
  });

  it('deals a lab-cooked product the same way as River Cut', () => {
    const cooked = {
      id: 'drug-lab-1',
      name: 'Blue Static',
      tier: 'pure' as const,
      quality: 88,
      quantity: 6,
      craftedAt: 1,
      effects: [],
    };
    const shift2 = reduceLoop(reduceLoop(woundedShift(), { type: 'recover', pay: true }), {
      type: 'next-shift',
      stock: [{ ...createLoopState().inventory[0], quantity: 0 }, cooked],
    });
    expect(shift2.briefing[2]).toMatch(/Blue Static ×6/);
    const dealt = runLoopCommands([
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: cooked.id },
      { type: 'run-deal' },
    ], shift2);
    expect(dealt.rejection).toBeNull();
    expect(dealt.lastDeal?.productName).toBe('Blue Static');
    expect(dealt.lastDeal?.explanation).toMatch(/Blue Static moved/);
    expect(dealt.inventory.find((item) => item.id === cooked.id)?.quantity).toBeLessThan(6);
  });

  it('retreats without a wound', () => {
    const live = runLoopCommands([...CREW, ASSIGN, { type: 'run-deal' }, { type: 'begin-encounter' }]);
    const result = retreatLoopEncounter(live);
    expect(result.outcome).toBe('retreated');
    const after = reduceLoop(live, { type: 'apply-encounter', result });
    expect(after.recovery).toBeNull();
    expect(dealer(after).health).toBe(100);
    expect(reduceLoop(after, { type: 'next-shift' }).shiftIndex).toBe(2);
  });

  it('restores shift, stash, and crew condition from the ledger', () => {
    const rested = reduceLoop(woundedShift(), { type: 'recover', pay: false });
    const shift2 = reduceLoop(rested, { type: 'next-shift' });
    const reloaded = reduceLoop(createLoopState(), { type: 'hydrate-ledger', ledger: toLoopLedger(shift2) });
    expect(reloaded.shiftIndex).toBe(2);
    expect(dealer(reloaded).health).toBe(REST_RETURN_HEALTH);
    expect(reloaded.inventory).toEqual(shift2.inventory);
    const legacy = { ...toLoopLedger(shift2), shiftIndex: undefined, stock: undefined, crew: undefined };
    const old = reduceLoop(createLoopState(), { type: 'hydrate-ledger', ledger: legacy });
    expect(old.shiftIndex).toBe(1);
    expect(old.inventory[0].quantity).toBe(shift2.inventory[0].quantity);
  });

  it('requires a recovery decision for each downed member, including after reload', () => {
    const live = runLoopCommands([...CREW, ASSIGN, { type: 'run-deal' }, { type: 'begin-encounter' }]);
    const result = { ...seededLoopEncounter(live), crewDown: [BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId] };
    const wounded = reduceLoop(live, { type: 'apply-encounter', result });
    const paid = reduceLoop(wounded, { type: 'recover', pay: true });
    expect(paid.recovery?.memberId).toBe(BLOCK_LOOP_IDS.shooterId);
    expect(reduceLoop(paid, { type: 'next-shift' }).shiftIndex).toBe(1);
    const restored = reduceLoop(createLoopState(), { type: 'hydrate-ledger', ledger: toLoopLedger(paid) });
    const rested = reduceLoop(restored, { type: 'recover', pay: false });
    const next = reduceLoop(rested, { type: 'next-shift' });
    expect(next.shiftIndex).toBe(2);
    expect(dealer(next).health).toBe(100);
    expect(next.members.find(member => member.id === BLOCK_LOOP_IDS.shooterId)?.health).toBe(REST_RETURN_HEALTH);
    expect(next.money).toBe(wounded.money - wounded.recovery!.cost);
  });

  it('does not silently revive a downed member who has not elected rest', () => {
    const wounded = woundedShift();
    const next = reduceLoop({ ...wounded, recovery: null }, { type: 'next-shift' });
    expect(dealer(next).health).toBe(0);
    expect(next.shiftIndex).toBe(1);
    expect(next.recovery?.memberId).toBe(BLOCK_LOOP_IDS.dealerId);
  });
});
