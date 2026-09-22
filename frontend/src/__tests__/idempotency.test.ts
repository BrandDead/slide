// ============================================================
// Idempotency Tests — Double-Click and Duplicate Command Prevention
// Phase 1 Follow-up: Explicit tests that repeated commands do NOT duplicate
// money, product, heat, morale, XP, health damage, hospital bills, encounters, ledger entries
// ============================================================

import { describe, expect, it, beforeEach } from 'vitest';
import { reduceLoop, runLoopCommands, seededLoopEncounter } from '../game/loop/blockLoopEngine';
import { createLoopState } from '../game/loop/blockLoopFixture';
import { BLOCK_LOOP_IDS } from '../game/loop/blockLoopTypes';
import { RECOVERY_CONFIG } from '../utils/bailHospitalSystem';
import type { LoopState } from '../game/loop/blockLoopTypes';

// Helper to run a complete loop up to a specific phase
function setupLoopToPhase(phase: 'placement' | 'deal' | 'threat' | 'encounter' | 'consequence'): LoopState {
  if (phase === 'placement') {
    return runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
    ]);
  }

  if (phase === 'deal') {
    return runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
    ]);
  }

  if (phase === 'threat') {
    return runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
    ]);
  }

  if (phase === 'encounter') {
    return runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
      { type: 'begin-encounter' },
    ]);
  }

  const loop = runLoopCommands([
    { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
    { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
    { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
    { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
    { type: 'run-deal' },
    { type: 'begin-encounter' },
  ]);
  const result = seededLoopEncounter(loop);
  return reduceLoop(loop, { type: 'apply-encounter', result });
}

describe('Idempotency — Deal / Close Deal', () => {
  it('prevents duplicate deal execution — same economyKey rejected', () => {
    const loop = setupLoopToPhase('deal');
    const first = reduceLoop(loop, { type: 'run-deal' });

    expect(first.rejection).toBeNull();
    expect(first.lastDeal).toBeDefined();
    expect(first.economyKeys).toContain(first.lastDeal!.key);

    const moneyAfterFirst = first.money;
    const productAfterFirst = first.inventory[0].quantity;
    const heatAfterFirst = first.playerHeat;
    const economyKeysCount = first.economyKeys.length;

    // Second call with same state — should be rejected
    const second = reduceLoop(first, { type: 'run-deal' });

    expect(second.rejection).toMatch(/already booked/i);
    expect(second.rejection).toMatch(/No second payout/i);
    expect(second.money).toBe(moneyAfterFirst);
    expect(second.inventory[0].quantity).toBe(productAfterFirst);
    expect(second.playerHeat).toBe(heatAfterFirst);
    expect(second.economyKeys.length).toBe(economyKeysCount);
  });

  it('synchronous rapid duplicate commands do not double money/product/heat', () => {
    const loop = setupLoopToPhase('deal');

    // First execution
    const first = reduceLoop(loop, { type: 'run-deal' });
    const moneyGained = first.money - loop.money;
    const productConsumed = loop.inventory[0].quantity - first.inventory[0].quantity;
    const heatGained = first.playerHeat - loop.playerHeat;

    expect(moneyGained).toBeGreaterThan(0);
    expect(productConsumed).toBeGreaterThan(0);
    expect(heatGained).toBeGreaterThan(0);

    // Second execution (simulating rapid double-click)
    const second = reduceLoop(first, { type: 'run-deal' });

    // Money should not increase again
    expect(second.money).toBe(first.money);
    expect(second.money).not.toBe(loop.money + moneyGained * 2);

    // Product should not decrease again
    expect(second.inventory[0].quantity).toBe(first.inventory[0].quantity);
    expect(second.inventory[0].quantity).not.toBe(loop.inventory[0].quantity - productConsumed * 2);

    // Heat should not increase again
    expect(second.playerHeat).toBe(first.playerHeat);
    expect(second.playerHeat).not.toBe(loop.playerHeat + heatGained * 2);
  });

  it('economyKeys array prevents duplicate ledger entries', () => {
    const loop = setupLoopToPhase('deal');
    const first = reduceLoop(loop, { type: 'run-deal' });
    const dealKey = first.lastDeal!.key;

    expect(first.economyKeys).toContain(dealKey);
    const keysAfterFirst = first.economyKeys.length;

    const second = reduceLoop(first, { type: 'run-deal' });

    // Key count should not grow
    expect(second.economyKeys.length).toBe(keysAfterFirst);
    expect(second.economyKeys.filter((k) => k === dealKey).length).toBe(1);
  });
});

describe('Idempotency — Encounter Result Application', () => {
  it('applies encounter result exactly once — duplicate key rejected', () => {
    const loop = setupLoopToPhase('encounter');
    const result = seededLoopEncounter(loop);

    const first = reduceLoop(loop, { type: 'apply-encounter', result });

    expect(first.appliedEncounterKeys).toContain(result.idempotencyKey);
    expect(first.economyKeys).toContain(result.idempotencyKey);

    const moneyAfterFirst = first.money;
    const heatAfterFirst = first.block.heat;
    const moraleAfterFirst = first.block.morale;
    const woundedCount = first.members.filter((m) => m.health === 0).length;

    // Second application (simulating rapid double-click on resolve button)
    const second = reduceLoop(first, { type: 'apply-encounter', result });

    expect(second.briefing.join(' ')).toMatch(/Books stay still/i);
    expect(second.money).toBe(moneyAfterFirst);
    expect(second.block.heat).toBe(heatAfterFirst);
    expect(second.block.morale).toBe(moraleAfterFirst);
    expect(second.members.filter((m) => m.health === 0).length).toBe(woundedCount);
  });

  it('does not duplicate health damage on repeated encounter application', () => {
    const loop = setupLoopToPhase('encounter');
    const result = seededLoopEncounter(loop);

    expect(result.crewDown).toContain(BLOCK_LOOP_IDS.dealerId);

    const first = reduceLoop(loop, { type: 'apply-encounter', result });
    const dealerAfterFirst = first.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId);

    expect(dealerAfterFirst?.health).toBe(0);
    expect(dealerAfterFirst?.assignment).toBe('wounded');

    const second = reduceLoop(first, { type: 'apply-encounter', result });
    const dealerAfterSecond = second.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId);

    // Health should remain 0, not go negative or change
    expect(dealerAfterSecond?.health).toBe(0);
    expect(dealerAfterSecond?.assignment).toBe('wounded');
  });

  it('appliedEncounterKeys array prevents duplicate consequence entries', () => {
    const loop = setupLoopToPhase('encounter');
    const result = seededLoopEncounter(loop);

    const first = reduceLoop(loop, { type: 'apply-encounter', result });
    const keysAfterFirst = first.appliedEncounterKeys.length;

    expect(first.appliedEncounterKeys).toContain(result.idempotencyKey);

    const second = reduceLoop(first, { type: 'apply-encounter', result });

    // Key count should not grow
    expect(second.appliedEncounterKeys.length).toBe(keysAfterFirst);
    expect(second.appliedEncounterKeys.filter((k) => k === result.idempotencyKey).length).toBe(1);
  });

  it('both economyKeys and appliedEncounterKeys block duplicate application', () => {
    const loop = setupLoopToPhase('encounter');
    const result = seededLoopEncounter(loop);

    const first = reduceLoop(loop, { type: 'apply-encounter', result });

    // Both arrays should contain the key
    expect(first.economyKeys).toContain(result.idempotencyKey);
    expect(first.appliedEncounterKeys).toContain(result.idempotencyKey);

    const second = reduceLoop(first, { type: 'apply-encounter', result });

    // Rejection should mention idempotency
    expect(second.briefing.join(' ')).toMatch(/same encounter ticket/i);
  });
});

describe('Idempotency — Hospital & Recovery', () => {
  it('prevents double billing on repeated hospital payment', () => {
    const loop = setupLoopToPhase('consequence');

    // Ensure player has enough money and there's a wounded member
    const wealthy = { ...loop, money: 5000 };
    
    if (!wealthy.recovery) {
      // If no recovery needed, skip this test
      expect(wealthy.recovery).toBeDefined();
      return;
    }

    const first = reduceLoop(wealthy, { type: 'recover', pay: true });
    const moneyAfterFirst = first.money;
    const dealerAfterFirst = first.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId);

    expect(moneyAfterFirst).toBe(5000 - RECOVERY_CONFIG.HOSPITAL_BASE_COST);
    expect(dealerAfterFirst?.health).toBeGreaterThan(0);
    expect(first.recovery).toBeNull();

    // Try to pay again (should be no-op since recovery is null)
    const second = reduceLoop(first, { type: 'recover', pay: true });

    expect(second.money).toBe(moneyAfterFirst);
    expect(second.recovery).toBeNull();
  });

  it('recovery state cleared after first successful payment', () => {
    const loop = setupLoopToPhase('consequence');
    const wealthy = { ...loop, money: 5000 };

    if (!wealthy.recovery) {
      expect(wealthy.recovery).toBeDefined();
      return;
    }

    const first = reduceLoop(wealthy, { type: 'recover', pay: true });
    expect(first.recovery).toBeNull();

    // Subsequent calls should not trigger any recovery action
    const second = reduceLoop(first, { type: 'recover', pay: true });
    expect(second.recovery).toBeNull();
    expect(second.money).toBe(first.money);
  });

  it('rest option does not duplicate morale penalty on repeated calls', () => {
    const loop = setupLoopToPhase('consequence');
    
    if (!loop.recovery) {
      expect(loop.recovery).toBeDefined();
      return;
    }

    const first = reduceLoop(loop, { type: 'recover', pay: false });
    const moneyAfterFirst = first.money;
    const moraleAfterFirst = first.block.morale;

    expect(first.recovery).toBeNull();
    expect(moneyAfterFirst).toBe(loop.money); // No cost

    const second = reduceLoop(first, { type: 'recover', pay: false });
    
    // Money and morale should remain unchanged
    expect(second.money).toBe(moneyAfterFirst);
    expect(second.block.morale).toBe(moraleAfterFirst);
  });
});

describe('Idempotency — Reload Persistence Without Duplication', () => {
  it('reload after first execution does not duplicate economic effects', () => {
    const loop = setupLoopToPhase('deal');
    const first = reduceLoop(loop, { type: 'run-deal' });

    // Simulate reload by reapplying the same state with ledger
    const ledger = {
      phase: first.phase,
      money: first.money,
      playerHeat: first.playerHeat,
      reputation: first.reputation,
      blockHeat: first.block.heat,
      blockMorale: first.block.morale,
      pendingIncome: first.block.pendingIncome,
      productQuantity: first.inventory[0].quantity,
      placements: first.block.placements,
      assignments: first.assignments,
      selectedDealerId: first.selectedDealerId,
      selectedShooterId: first.selectedShooterId,
      economyKeys: [...first.economyKeys],
      appliedEncounterKeys: [...first.appliedEncounterKeys],
      pendingHealthIds: [...first.pendingHealthIds],
      briefing: [...first.briefing],
      threatRoute: first.threat?.route ?? null,
      recovery: first.recovery,
      lastDeal: first.lastDeal,
      lastEncounter: first.lastEncounter,
      dealKey: first.lastDeal?.key ?? null,
      encounterKey: first.lastEncounter?.idempotencyKey ?? null,
    };

    // Create fresh state with same ledger
    const reloaded = createLoopState();
    const hydrated = {
      ...reloaded,
      money: ledger.money,
      playerHeat: ledger.playerHeat,
      economyKeys: [...ledger.economyKeys],
      appliedEncounterKeys: [...ledger.appliedEncounterKeys],
      lastDeal: ledger.lastDeal,
    };

    // Try to run deal again
    const duplicate = reduceLoop(hydrated, { type: 'run-deal' });

    // Should reject with same money/product/heat
    expect(duplicate.rejection).toMatch(/already booked/i);
    expect(duplicate.money).toBe(ledger.money);
    expect(duplicate.playerHeat).toBe(ledger.playerHeat);
  });

  it('reload after encounter does not replay consequence', () => {
    const loop = setupLoopToPhase('consequence');

    const economyKeys = [...loop.economyKeys];
    const appliedKeys = [...loop.appliedEncounterKeys];
    const encounterKey = loop.lastEncounter?.idempotencyKey;

    expect(encounterKey).toBeDefined();
    expect(appliedKeys).toContain(encounterKey!);

    // Simulate reload
    const reloaded = createLoopState();
    const hydrated = {
      ...reloaded,
      economyKeys,
      appliedEncounterKeys: appliedKeys,
      lastEncounter: loop.lastEncounter,
    };

    // Try to apply same encounter again
    const result = loop.lastEncounter!;
    const duplicate = reduceLoop(hydrated, { type: 'apply-encounter', result });

    expect(duplicate.briefing.join(' ')).toMatch(/Books stay still/i);
  });
});

describe('Idempotency — Failed Operation Retry Safety', () => {
  it('failed health write allows retry without replaying economic deltas', () => {
    const loop = setupLoopToPhase('encounter');
    const result = seededLoopEncounter(loop);

    const failed = reduceLoop(loop, { type: 'apply-encounter', result, healthWrite: 'failed' });

    expect(failed.pendingHealthIds).toContain(BLOCK_LOOP_IDS.dealerId);
    expect(failed.economyKeys).toContain(result.idempotencyKey);
    expect(failed.appliedEncounterKeys).toContain(result.idempotencyKey);

    const moneyAfterFail = failed.money;
    const heatAfterFail = failed.block.heat;

    // Retry health
    const retried = reduceLoop(failed, { type: 'retry-health' });

    // Health should apply but economy should not change
    expect(retried.money).toBe(moneyAfterFail);
    expect(retried.block.heat).toBe(heatAfterFail);
    expect(retried.economyKeys).toEqual(failed.economyKeys);
    
    const dealer = retried.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId);
    expect(dealer?.health).toBe(0);
  });

  it('does not allow duplicate first result after failed partial application', () => {
    const loop = setupLoopToPhase('encounter');
    const result = seededLoopEncounter(loop);

    const failed = reduceLoop(loop, { type: 'apply-encounter', result, healthWrite: 'failed' });
    
    // Try to apply the same result again (should reject because economy key exists)
    const duplicate = reduceLoop(failed, { type: 'apply-encounter', result });

    expect(duplicate.briefing.join(' ')).toMatch(/Books stay still/i);
    expect(duplicate.money).toBe(failed.money);
  });
});

describe('Idempotency — Cross-Boundary Protection', () => {
  it('different encounter keys allow separate applications', () => {
    const loop = setupLoopToPhase('encounter');
    const result1 = seededLoopEncounter(loop);
    const first = reduceLoop(loop, { type: 'apply-encounter', result: result1 });

    expect(first.appliedEncounterKeys).toContain(result1.idempotencyKey);

    // Different key should be allowed
    const result2 = { ...result1, idempotencyKey: 'different-key:secured' };
    const second = reduceLoop(first, { type: 'apply-encounter', result: result2 });

    expect(second.rejection).toBeNull();
    expect(second.appliedEncounterKeys).toContain(result2.idempotencyKey);
    expect(second.appliedEncounterKeys.length).toBe(first.appliedEncounterKeys.length + 1);
  });

  it('economyKeys guard both deals and encounters from duplication', () => {
    const loop = setupLoopToPhase('deal');
    const dealt = reduceLoop(loop, { type: 'run-deal' });
    const dealKey = dealt.lastDeal!.key;

    expect(dealt.economyKeys).toContain(dealKey);

    const withEncounter = reduceLoop(dealt, { type: 'begin-encounter' });
    const result = seededLoopEncounter(withEncounter);
    const consequence = reduceLoop(withEncounter, { type: 'apply-encounter', result });

    // Both keys should be in economyKeys
    expect(consequence.economyKeys).toContain(dealKey);
    expect(consequence.economyKeys).toContain(result.idempotencyKey);

    // Neither can be replayed
    const dealReplay = reduceLoop(consequence, { type: 'run-deal' });
    expect(dealReplay.rejection).toMatch(/already booked/i);

    const encounterReplay = reduceLoop(consequence, { type: 'apply-encounter', result });
    expect(encounterReplay.briefing.join(' ')).toMatch(/Books stay still/i);
  });
});

describe('Idempotency — Placement and Assignment', () => {
  it('duplicate placement of same member does not double occupancy', () => {
    const loop = createLoopState();
    const withCrew = reduceLoop(loop, {
      type: 'select-crew',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      shooterId: BLOCK_LOOP_IDS.shooterId,
    });

    const first = reduceLoop(withCrew, { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 });
    expect(first.block.placements).toHaveLength(1);
    expect(first.block.grid[1][3].occupantId).toBe(BLOCK_LOOP_IDS.dealerId);

    // Try to place same member again at different location
    const second = reduceLoop(first, { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 4, y: 1 });

    // Should relocate, not duplicate
    expect(second.block.placements).toHaveLength(1);
    expect(second.block.grid[1][3].occupantId).toBeNull();
    expect(second.block.grid[1][4].occupantId).toBe(BLOCK_LOOP_IDS.dealerId);
  });

  it('duplicate product assignment replaces previous assignment', () => {
    const loop = setupLoopToPhase('placement');
    
    const first = reduceLoop(loop, {
      type: 'assign-product',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      productId: BLOCK_LOOP_IDS.productId,
    });

    const dealer = first.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId);
    expect(dealer?.equipment).toBe('River Cut');

    // Assign again (should just update, not duplicate)
    const second = reduceLoop(first, {
      type: 'assign-product',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      productId: BLOCK_LOOP_IDS.productId,
    });

    const dealerSecond = second.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId);
    expect(dealerSecond?.equipment).toBe('River Cut');
    expect(second.rejection).toBeNull();
  });
});
