import { describe, expect, it } from 'vitest';
import { CURRENT_RESOLVER_CATALOG_VERSION } from '../../../config/blockDNA';
import { prepareEncounter } from '../../combat/prepareEncounter';
import { BLOCK_LOOP_IDS } from '../blockLoopTypes';
import { createAuthoritativeLoopBlock, createLoopState } from '../blockLoopFixture';
import { reduceLoop, runLoopCommands, seededLoopEncounter } from '../blockLoopEngine';
import { streetVsSafetyPreview, validatePlacement } from '../placementRules';
import { resolveLoopDeal } from '../dealResolver';
import { toLoopLedger } from '../blockLoopPersist';

function placedLoop() {
  return runLoopCommands([
    { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
    { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
    { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
    { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
  ]);
}

describe('authoritative block loop fixture', () => {
  it('loads a fictional Las Olas DNA snapshot on the canonical 8×8 board', () => {
    const block = createAuthoritativeLoopBlock();
    expect(block.dnaId).toBe('las-olas-1208');
    expect(block.grid).toHaveLength(8);
    expect(block.grid[0]).toHaveLength(8);
    expect(block.grid[0][0].zoneType).toBe('street');
    expect(block.grid[1][0].zoneType).toBe('curb');
    expect(block.grid[4][0].zoneType).toBe('alley');
    expect(block.gridSource).toBe('dna-fallback');
    expect(createLoopState().catalogVersion).toBe(CURRENT_RESOLVER_CATALOG_VERSION);
  });
});

describe('placement rules', () => {
  it('accepts a passable unoccupied cell and rejects illegal ones', () => {
    const block = createAuthoritativeLoopBlock();
    const dealer = createLoopState().members[0];
    expect(validatePlacement(block, dealer, 3, 1).ok).toBe(true);
    expect(validatePlacement(block, dealer, 0, 0)).toMatchObject({ ok: false, reason: 'not-passable' });
    expect(validatePlacement(block, dealer, 9, 1)).toMatchObject({ ok: false, reason: 'out-of-bounds' });
    expect(validatePlacement(block, undefined, 3, 1)).toMatchObject({ ok: false, reason: 'unknown-member' });
  });

  it('rejects occupied, duplicate, and over-capacity placements', () => {
    const start = createLoopState();
    const withDealer = reduceLoop(start, {
      type: 'select-crew',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      shooterId: BLOCK_LOOP_IDS.shooterId,
    });
    const placed = reduceLoop(withDealer, { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 });
    const occupied = reduceLoop(placed, { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 3, y: 1 });
    expect(occupied.rejection).toMatch(/already holds/i);

    const capped = {
      ...placed,
      block: { ...placed.block, maxMembers: 1 },
    };
    const over = reduceLoop(capped, { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 4, y: 2 });
    expect(over.rejection).toMatch(/max crew/i);
  });

  it('pays more and exposes more on street-near cells than deep cells', () => {
    const block = createAuthoritativeLoopBlock();
    const preview = streetVsSafetyPreview(block, 2);
    expect(preview.street.exposureRisk).toBeGreaterThan(preview.safety.exposureRisk);
    expect(preview.street.incomePerTick).toBeGreaterThan(preview.safety.incomePerTick);
    expect(preview.street.y).toBe(1);
    expect(preview.safety.y).toBe(4);
    expect(preview.incomeDelta).toBeGreaterThan(0);
  });
});

describe('product assignment and deal', () => {
  it('assigns River Cut and consumes quantity on a deterministic deal', () => {
    const before = placedLoop();
    const after = reduceLoop(before, { type: 'run-deal' });
    expect(after.lastDeal?.moneyDelta).toBeGreaterThan(0);
    expect(after.money).toBe(before.money + (after.lastDeal?.moneyDelta ?? 0));
    expect(after.inventory[0].quantity).toBeLessThan(before.inventory[0].quantity);
    expect(after.lastDeal?.explanation).toMatch(/Street exposure \+\d+%/);
    expect(after.lastDeal?.explanation).toMatch(/heat \+/);
  });

  it('uses the curb 80-exposure identity: +18% demand, heat +4, exposure +7', () => {
    const dealer = placedLoop().block.placements[0];
    const receipt = resolveLoopDeal({
      blockId: BLOCK_LOOP_IDS.blockId,
      dealer,
      product: createLoopState().inventory[0],
      incomeMultiplier: 1,
    });
    expect(dealer.exposureRisk).toBe(80);
    expect(receipt.demandBonusPct).toBe(18);
    expect(receipt.heatDelta).toBe(4);
    expect(receipt.exposureDelta).toBe(7);
  });

  it('refuses a second payout for the same deal ticket', () => {
    const dealt = reduceLoop(placedLoop(), { type: 'run-deal' });
    const replay = reduceLoop(dealt, { type: 'run-deal' });
    expect(replay.money).toBe(dealt.money);
    expect(replay.inventory[0].quantity).toBe(dealt.inventory[0].quantity);
    expect(replay.rejection).toMatch(/already booked/i);
  });

  it('blocks product on alley cells', () => {
    const start = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 4 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
    ]);
    const assigned = reduceLoop(start, {
      type: 'assign-product',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      productId: BLOCK_LOOP_IDS.productId,
    });
    expect(assigned.rejection).toMatch(/cannot take product/i);
  });
});

describe('threat, encounter, and reload', () => {
  it('hands a sub-threshold street deal to SLIDE on the selected DNA board', () => {
    const dealt = reduceLoop(placedLoop(), { type: 'run-deal' });
    expect(dealt.threat?.route).toBe('slide');
    const live = reduceLoop(dealt, { type: 'begin-encounter' });
    const encounter = prepareEncounter(live.block);
    expect(encounter.crew.some((actor) => actor.id === BLOCK_LOOP_IDS.dealerId)).toBe(true);
    expect(encounter.crew.some((actor) => actor.id === BLOCK_LOOP_IDS.shooterId)).toBe(true);
    expect(encounter.terrain[1][3].zoneType).toBe('curb');
    expect(live.block.dnaId).toBe('las-olas-1208');
  });

  it('applies one wound, then ignores a duplicate encounter ticket', () => {
    const live = reduceLoop(reduceLoop(placedLoop(), { type: 'run-deal' }), { type: 'begin-encounter' });
    const result = seededLoopEncounter(live);
    const once = reduceLoop(live, { type: 'apply-encounter', result });
    expect(once.block.placements.find((item) => item.memberId === BLOCK_LOOP_IDS.dealerId)?.health).toBe(0);
    expect(once.block.heat).toBeGreaterThan(live.block.heat);
    const moneyAfter = once.money;
    const twice = reduceLoop(once, { type: 'apply-encounter', result });
    expect(twice.block.heat).toBe(once.block.heat);
    expect(twice.block.morale).toBe(once.block.morale);
    expect(twice.block.pendingIncome).toBe(once.block.pendingIncome);
    expect(twice.money).toBe(moneyAfter);
    expect(twice.briefing.join(' ')).toMatch(/Books stay still/i);
  });

  it('retries a failed health write without replaying economy', () => {
    const live = reduceLoop(reduceLoop(placedLoop(), { type: 'run-deal' }), { type: 'begin-encounter' });
    const result = seededLoopEncounter(live);
    const failed = reduceLoop(live, { type: 'apply-encounter', result, healthWrite: 'failed' });
    expect(failed.block.heat).toBeGreaterThan(live.block.heat);
    expect(failed.block.placements.find((item) => item.memberId === BLOCK_LOOP_IDS.dealerId)?.health).toBe(100);
    const retried = reduceLoop(failed, { type: 'retry-health' });
    expect(retried.block.placements.find((item) => item.memberId === BLOCK_LOOP_IDS.dealerId)?.health).toBe(0);
    expect(retried.block.heat).toBe(failed.block.heat);
    expect(retried.money).toBe(failed.money);
  });

  it('rehydrates the consequence from a ledger without duplicating it', () => {
    const live = reduceLoop(reduceLoop(placedLoop(), { type: 'run-deal' }), { type: 'begin-encounter' });
    const result = seededLoopEncounter(live);
    const done = reduceLoop(reduceLoop(live, { type: 'apply-encounter', result }), { type: 'return-desktop' });
    const ledger = toLoopLedger(done);
    const reloaded = reduceLoop(createLoopState(), { type: 'hydrate-ledger', ledger });
    expect(reloaded.money).toBe(done.money);
    expect(reloaded.block.placements.find((item) => item.memberId === BLOCK_LOOP_IDS.dealerId)?.health).toBe(0);
    expect(reloaded.block.heat).toBe(done.block.heat);
    expect(reloaded.inventory[0].quantity).toBe(done.inventory[0].quantity);
    const replay = reduceLoop(reloaded, { type: 'apply-encounter', result });
    expect(replay.money).toBe(done.money);
    expect(replay.block.heat).toBe(done.block.heat);
    const rewritten = toLoopLedger(reloaded);
    expect(rewritten.dealKey).toBe(ledger.dealKey);
    expect(rewritten.encounterKey).toBe(ledger.encounterKey);
    expect(rewritten.lastEncounter?.idempotencyKey).toBe(ledger.encounterKey);
  });

  it('offers a rest path when hospital cash is short', () => {
    const live = reduceLoop(reduceLoop(placedLoop(), { type: 'run-deal' }), { type: 'begin-encounter' });
    const broke = { ...live, money: 200 };
    const result = seededLoopEncounter(broke);
    const wounded = reduceLoop(broke, { type: 'apply-encounter', result });
    expect(wounded.recovery?.affordable).toBe(false);
    const refused = reduceLoop(wounded, { type: 'recover', pay: true });
    expect(refused.rejection).toMatch(/cannot cover hospital/i);
    const rested = reduceLoop(wounded, { type: 'recover', pay: false });
    expect(rested.money).toBe(200);
    expect(rested.members.find((member) => member.id === BLOCK_LOOP_IDS.dealerId)?.assignment).toBe('resting');
  });
});
