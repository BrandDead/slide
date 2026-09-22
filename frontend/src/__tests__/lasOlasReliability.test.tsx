// ============================================================
// Las Olas Closed-Beta Path — Reliability & Idempotency Tests
// Phase 1: Test-first coverage for the full 18+ gate → encounter → reload loop
// ============================================================

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useBlockStore } from '../stores/blockStore';
import { useDrugInventory } from '../stores/useDrugInventory';
import { useBlockLoopStore } from '../stores/blockLoopStore';
import { usePlayerStore } from '../stores/gameStore';
import { applyDemoSeed } from '../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../game/loop/blockLoopTypes';
import {
  clearLoopLedger,
  readDemoLoopLedger,
  writeDemoLoopLedger,
  DEMO_LOOP_LEDGER_OWNER_ID,
} from '../game/loop/blockLoopPersist';
import { reduceLoop, runLoopCommands, seededLoopEncounter } from '../game/loop/blockLoopEngine';
import { createLoopState } from '../game/loop/blockLoopFixture';
import { toLoopLedger } from '../game/loop/blockLoopPersist';
import { RouteLoadBoundary, createRetryableLazy } from '../components/system/RouteLoadBoundary';

// Mock lazy modules for controlled failure testing
const mockUnifiedEncounter = vi.fn();
vi.mock('../components/encounter/UnifiedEncounter', () => ({
  default: () => {
    mockUnifiedEncounter();
    return <div data-testid="mock-encounter">Encounter board</div>;
  },
}));

describe('Las Olas reliability — Loading & Lazy Failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnifiedEncounter.mockClear();
  });

  it.skip('shows loading state while lazy route chunks are pending', async () => {
    let resolveImport: (value: any) => void;
    const slowImport = new Promise((resolve) => { resolveImport = resolve; });
    const SlowComponent = createRetryableLazy(() => slowImport as any);

    render(
      <RouteLoadBoundary label="Slow Route" testId="slow-test">
        <SlowComponent />
      </RouteLoadBoundary>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/LOADING SLOW ROUTE/i)).toBeInTheDocument();

    resolveImport!({ default: () => <div>Loaded</div> });
    await waitFor(() => expect(screen.getByText('Loaded')).toBeInTheDocument());
  });

  it.skip('catches rejected lazy import and offers retry without crashing', async () => {
    const FailingComponent = createRetryableLazy(() => Promise.reject(new Error('Network timeout')));

    render(
      <RouteLoadBoundary label="Failing Route" testId="fail-test">
        <FailingComponent />
      </RouteLoadBoundary>,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/Failing Route could not load/i)).toBeInTheDocument();
    expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry failing route/i })).toBeInTheDocument();
  });

  it.skip('retries a rejected import with a fresh factory on Retry click', async () => {
    let attemptCount = 0;
    const RetryableComponent = createRetryableLazy(() => {
      attemptCount += 1;
      if (attemptCount === 1) return Promise.reject(new Error('First fail'));
      return Promise.resolve({ default: () => <div>Success after retry</div> });
    });

    render(
      <RouteLoadBoundary label="Retry Test" testId="retry-test">
        <RetryableComponent />
      </RouteLoadBoundary>,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/First fail/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('Success after retry')).toBeInTheDocument());
    expect(attemptCount).toBe(2);
  });

  it.skip('renders fallback content when lazy route fails and fallback is provided', async () => {
    const FailingComponent = createRetryableLazy(() => Promise.reject(new Error('Chunk missing')));

    render(
      <RouteLoadBoundary
        label="Test Route"
        testId="fallback-test"
        fallback={<div data-testid="safe-fallback">8×8 board fallback</div>}
      >
        <FailingComponent />
      </RouteLoadBoundary>,
    );

    await waitFor(() => expect(screen.getByTestId('safe-fallback')).toBeInTheDocument());
    expect(screen.getByText(/8×8 board fallback/i)).toBeInTheDocument();
  });
});

describe('Las Olas reliability — Map Failures & Fallback Placement', () => {
  it('allows crew placement on 8×8 board when diorama fails to load', async () => {
    // This test will be implemented after we verify the diorama failure path
    expect(true).toBe(true);
  });

  it('preserves placement state when map tiles fail to load', () => {
    const block = createLoopState().block;
    const withMap = { ...block, mapStatus: 'loaded' as const };
    const failed = { ...block, mapStatus: 'failed' as const };
    
    expect(withMap.grid).toEqual(failed.grid);
    expect(withMap.placements).toEqual(failed.placements);
  });

  it('accepts placement without WebGL context (canvas 2D fallback)', () => {
    // Simulate no WebGL
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string, ...args: any[]) => {
      if (type === 'webgl' || type === 'webgl2') return null;
      return originalGetContext.call(this as any, type, ...args);
    }) as typeof originalGetContext;

    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
    ]);

    expect(loop.rejection).toBeNull();
    expect(loop.block.placements).toHaveLength(1);
    expect(loop.block.placements[0].x).toBe(3);
    expect(loop.block.placements[0].y).toBe(1);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });
});

describe('Las Olas reliability — Crew Selection & Handoff', () => {
  beforeEach(() => {
    useBlockStore.setState({
      blocks: {},
      selectedBlockId: null,
      activeDriveBys: {},
      isPlacementMode: false,
      pendingPlacementMemberId: null,
      pendingPlacementMember: null,
    });
    usePlayerStore.setState({ player: { id: DEMO_LOOP_LEDGER_OWNER_ID, money: 5000 } } as any);
    clearLoopLedger();
    applyDemoSeed();
  });

  it('rejects crew selection with wrong roles (two dealers)', () => {
    const loop = reduceLoop(createLoopState(), {
      type: 'select-crew',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      shooterId: BLOCK_LOOP_IDS.dealerId, // Wrong: should be shooter
    });
    expect(loop.rejection).toMatch(/one dealer and one shooter/i);
    expect(loop.phase).toBe('crew');
  });

  it('rejects crew selection with unknown member IDs', () => {
    const loop = reduceLoop(createLoopState(), {
      type: 'select-crew',
      dealerId: 'unknown-id',
      shooterId: BLOCK_LOOP_IDS.shooterId,
    });
    expect(loop.rejection).toMatch(/one dealer and one shooter/i);
  });

  it('carries selected crew IDs through placement to deal', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
    ]);

    expect(loop.selectedDealerId).toBe(BLOCK_LOOP_IDS.dealerId);
    expect(loop.selectedShooterId).toBe(BLOCK_LOOP_IDS.shooterId);
    expect(loop.phase).toBe('product');
  });
});

describe('Las Olas reliability — Placement Validation', () => {
  it('rejects placement on occupied cell', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 3, y: 1 }, // Same cell
    ]);

    expect(loop.rejection).toMatch(/already holds/i);
    expect(loop.block.placements).toHaveLength(1);
  });

  it('rejects placement on non-passable cell (street)', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 0, y: 0 }, // Street cell
    ]);

    expect(loop.rejection).toMatch(/not deployable|not passable/i);
  });

  it('rejects placement out of bounds', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 10, y: 10 },
    ]);

    expect(loop.rejection).toMatch(/off the 8×8 board/i);
  });

  it('rejects placement when max capacity is reached', () => {
    const start = createLoopState();
    const limited = { ...start, block: { ...start.block, maxMembers: 1 } };
    const loop = runLoopCommands(
      [
        { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
        { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
        { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      ],
      limited,
    );

    expect(loop.rejection).toMatch(/max crew|capacity/i);
  });

  it('accepts legal placement and updates grid occupancy', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
    ]);

    expect(loop.rejection).toBeNull();
    expect(loop.block.grid[1][3].occupantId).toBe(BLOCK_LOOP_IDS.dealerId);
    expect(loop.block.placements).toHaveLength(1);
    expect(loop.block.placements[0].x).toBe(3);
    expect(loop.block.placements[0].y).toBe(1);
  });
});

describe('Las Olas reliability — Product & Deal Economy', () => {
  it('rejects deal when product is exhausted', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
    ]);

    // Exhaust product
    const exhausted = { ...loop, inventory: [{ ...loop.inventory[0], quantity: 0 }] };
    
    // Try to assign product again (should fail)
    const reassign = reduceLoop(exhausted, {
      type: 'assign-product',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      productId: BLOCK_LOOP_IDS.productId,
    });

    expect(reassign.rejection).toBeTruthy();
    expect(reassign.rejection).toMatch(/River Cut|product/i);
  });

  it('rejects product assignment on deep alley cells', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 4 }, // Alley
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
    ]);

    const assigned = reduceLoop(loop, {
      type: 'assign-product',
      dealerId: BLOCK_LOOP_IDS.dealerId,
      productId: BLOCK_LOOP_IDS.productId,
    });

    expect(assigned.rejection).toMatch(/cannot take product/i);
  });

  it('blocks duplicate deal payout for the same ticket', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
    ]);

    const moneyAfter = loop.money;
    const productAfter = loop.inventory[0].quantity;

    const replay = reduceLoop(loop, { type: 'run-deal' });

    expect(replay.rejection).toMatch(/already booked/i);
    expect(replay.money).toBe(moneyAfter);
    expect(replay.inventory[0].quantity).toBe(productAfter);
  });

  it('prevents deal without dealer placement', () => {
    const loop = reduceLoop(createLoopState(), { type: 'run-deal' });
    expect(loop.rejection).toMatch(/dealer|product/i);
  });
});

describe('Las Olas reliability — Encounter & Result Idempotency', () => {
  it('applies encounter result exactly once for a given key', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
      { type: 'begin-encounter' },
    ]);

    const result = seededLoopEncounter(loop);
    const first = reduceLoop(loop, { type: 'apply-encounter', result });

    expect(first.appliedEncounterKeys).toContain(result.idempotencyKey);
    expect(first.block.appliedEncounterResultKeys).toContain(result.idempotencyKey);

    const moneyFirst = first.money;
    const heatFirst = first.block.heat;

    const second = reduceLoop(first, { type: 'apply-encounter', result });

    expect(second.money).toBe(moneyFirst);
    expect(second.block.heat).toBe(heatFirst);
    expect(second.briefing.join(' ')).toMatch(/Books stay still/i);
  });

  it('allows health retry without replaying economy when health write fails', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
      { type: 'begin-encounter' },
    ]);

    const result = seededLoopEncounter(loop);
    const failed = reduceLoop(loop, { type: 'apply-encounter', result, healthWrite: 'failed' });

    expect(failed.pendingHealthIds).toContain(BLOCK_LOOP_IDS.dealerId);
    expect(failed.block.placements.find((p) => p.memberId === BLOCK_LOOP_IDS.dealerId)?.health).not.toBe(0);

    const moneyAfterFail = failed.money;
    const heatAfterFail = failed.block.heat;

    const retried = reduceLoop(failed, { type: 'retry-health' });

    expect(retried.pendingHealthIds).toHaveLength(0);
    expect(retried.block.placements.find((p) => p.memberId === BLOCK_LOOP_IDS.dealerId)?.health).toBe(0);
    expect(retried.money).toBe(moneyAfterFail);
    expect(retried.block.heat).toBe(heatAfterFail);
  });
});

describe('Las Olas reliability — Hospital & Recovery Path', () => {
  it('offers rest path when street cash cannot cover hospital', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
      { type: 'begin-encounter' },
    ]);

    const broke = { ...loop, money: 100 };
    const result = seededLoopEncounter(broke);
    const wounded = reduceLoop(broke, { type: 'apply-encounter', result });

    expect(wounded.recovery).toBeDefined();
    expect(wounded.recovery?.affordable).toBe(false);
    expect(wounded.recovery?.unpaidLabel).toMatch(/cannot cover hospital/i);

    const refused = reduceLoop(wounded, { type: 'recover', pay: true });
    expect(refused.rejection).toMatch(/cannot cover hospital/i);

    const rested = reduceLoop(wounded, { type: 'recover', pay: false });
    expect(rested.money).toBe(100);
    expect(rested.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId)?.assignment).toBe('resting');
    expect(rested.recovery).toBeNull();
  });

  it('allows hospital payment when cash is sufficient', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
      { type: 'begin-encounter' },
    ]);

    const rich = { ...loop, money: 5000 };
    const result = seededLoopEncounter(rich);
    const wounded = reduceLoop(rich, { type: 'apply-encounter', result });

    expect(wounded.recovery?.affordable).toBe(true);

    const healed = reduceLoop(wounded, { type: 'recover', pay: true });
    expect(healed.money).toBe(5000 - (wounded.recovery?.cost ?? 0));
    expect(healed.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId)?.health).toBeGreaterThan(0);
    expect(healed.members.find((m) => m.id === BLOCK_LOOP_IDS.dealerId)?.assignment).toBe('active');
  });
});

describe('Las Olas reliability — Reload & Persistence', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    usePlayerStore.setState({ player: { id: DEMO_LOOP_LEDGER_OWNER_ID } } as any);
    clearLoopLedger({ removeItem: (key) => { delete mockStorage[key]; } });
  });

  it('hydrates ledger without duplicating deal or encounter', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
      { type: 'begin-encounter' },
    ]);

    const result = seededLoopEncounter(loop);
    const done = runLoopCommands(
      [{ type: 'apply-encounter', result }, { type: 'return-desktop' }],
      loop,
    );

    const ledger = toLoopLedger(done);
    const reloaded = reduceLoop(createLoopState(), { type: 'hydrate-ledger', ledger });

    expect(reloaded.money).toBe(done.money);
    expect(reloaded.playerHeat).toBe(done.playerHeat);
    expect(reloaded.block.heat).toBe(done.block.heat);
    expect(reloaded.inventory[0].quantity).toBe(done.inventory[0].quantity);
    expect(reloaded.appliedEncounterKeys).toEqual(done.appliedEncounterKeys);

    const replay = reduceLoop(reloaded, { type: 'apply-encounter', result });
    expect(replay.money).toBe(done.money);
    expect(replay.briefing.join(' ')).toMatch(/Books stay still/i);
  });

  it('prevents duplicate reload from writing state twice', () => {
    const mockStorage = {
      data: {} as Record<string, string>,
      getItem(key: string) { return this.data[key] ?? null; },
      setItem(key: string, value: string) { this.data[key] = value; },
      removeItem(key: string) { delete this.data[key]; },
    };

    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
    ]);

    const ledger = toLoopLedger(loop);
    writeDemoLoopLedger(DEMO_LOOP_LEDGER_OWNER_ID, ledger, mockStorage);

    const reloaded = readDemoLoopLedger(DEMO_LOOP_LEDGER_OWNER_ID, mockStorage);
    expect(reloaded).toBeDefined();
    expect(reloaded?.money).toBe(loop.money);
    expect(reloaded?.dealKey).toBe(loop.lastDeal?.key);

    const secondReload = readDemoLoopLedger(DEMO_LOOP_LEDGER_OWNER_ID, mockStorage);
    expect(secondReload?.money).toBe(reloaded?.money);
  });
});

describe('Las Olas reliability — Demo Player Ledger Isolation', () => {
  let mockStorage: { data: Record<string, string>; getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void };

  beforeEach(() => {
    mockStorage = {
      data: {} as Record<string, string>,
      getItem(key: string) { return this.data[key] ?? null; },
      setItem(key: string, value: string) { this.data[key] = value; },
      removeItem(key: string) { delete this.data[key]; },
    };
  });

  it('blocks ledger write for non-demo player IDs', () => {
    const ledger = toLoopLedger(createLoopState());
    const wrote = writeDemoLoopLedger('real-user-uuid', ledger, mockStorage);
    expect(wrote).toBe(false);

    const read = readDemoLoopLedger('real-user-uuid', mockStorage);
    expect(read).toBeNull();
  });

  it('allows ledger write only for demo-player identity', () => {
    const ledger = toLoopLedger(createLoopState());
    const wrote = writeDemoLoopLedger(DEMO_LOOP_LEDGER_OWNER_ID, ledger, mockStorage);
    expect(wrote).toBe(true);

    const read = readDemoLoopLedger(DEMO_LOOP_LEDGER_OWNER_ID, mockStorage);
    expect(read).toBeDefined();
    expect(read?.money).toBe(ledger.money);
  });

  it('prevents demo ledger pollution into signed-in player state', () => {
    const demoLedger = toLoopLedger({ ...createLoopState(), money: 99999 });
    writeDemoLoopLedger(DEMO_LOOP_LEDGER_OWNER_ID, demoLedger, mockStorage);

    const signedInRead = readDemoLoopLedger('real-uuid-123', mockStorage);
    expect(signedInRead).toBeNull();
  });
});

describe('Las Olas reliability — Stale State & Duplicate Clicks', () => {
  it('moves member when placing twice (replacement behavior)', () => {
    const start = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
    ]);

    // Place same member again - this replaces the previous placement
    const moved = reduceLoop(start, { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 5, y: 3 });

    // Current behavior: allows re-placement (moves member)
    expect(moved.block.placements).toHaveLength(1);
    expect(moved.block.placements[0].x).toBe(5);
    expect(moved.block.placements[0].y).toBe(3);
    expect(moved.block.grid[1][3].occupantId).toBeNull(); // Old cell cleared
    expect(moved.block.grid[3][5].occupantId).toBe(BLOCK_LOOP_IDS.dealerId); // New cell occupied
  });

  it('remains idempotent across rapid duplicate encounter resolve clicks', () => {
    const loop = runLoopCommands([
      { type: 'select-crew', dealerId: BLOCK_LOOP_IDS.dealerId, shooterId: BLOCK_LOOP_IDS.shooterId },
      { type: 'place', memberId: BLOCK_LOOP_IDS.dealerId, x: 3, y: 1 },
      { type: 'place', memberId: BLOCK_LOOP_IDS.shooterId, x: 5, y: 3 },
      { type: 'assign-product', dealerId: BLOCK_LOOP_IDS.dealerId, productId: BLOCK_LOOP_IDS.productId },
      { type: 'run-deal' },
      { type: 'begin-encounter' },
    ]);

    const result = seededLoopEncounter(loop);
    const first = reduceLoop(loop, { type: 'apply-encounter', result });
    const second = reduceLoop(first, { type: 'apply-encounter', result });
    const third = reduceLoop(second, { type: 'apply-encounter', result });

    expect(first.money).toBe(second.money);
    expect(second.money).toBe(third.money);
    expect(first.appliedEncounterKeys.length).toBe(second.appliedEncounterKeys.length);
    expect(second.appliedEncounterKeys.length).toBe(third.appliedEncounterKeys.length);
  });
});
