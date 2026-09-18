import { beforeEach, describe, expect, it } from 'vitest';
import { useBlockStore } from '../blockStore';
import { useGangStore, usePlayerStore } from '../gameStore';
import { useDrugInventory } from '../useDrugInventory';
import { useBlockLoopStore } from '../blockLoopStore';
import { BLOCK_LOOP_IDS, BLOCK_LOOP_LEDGER_KEY } from '../../game/loop/blockLoopTypes';
import { applyDemoSeed, restoreLoopLedgerIfPresent } from '../../utils/demoSeed';
import { toLoopLedger, clearLoopLedger } from '../../game/loop/blockLoopPersist';
import { seededLoopEncounter } from '../../game/loop/blockLoopEngine';

function reset() {
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
  clearLoopLedger();
}

describe('blockLoopStore adapter', () => {
  beforeEach(reset);

  it('keeps the demo Las Olas DNA id on the live block store', () => {
    applyDemoSeed();
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    expect(block.dnaId).toBe('las-olas-1208');
    expect(block.grid[0][0].zoneType).toBe('street');
    expect(useDrugInventory.getState().inventory[BLOCK_LOOP_IDS.productId]?.name).toBe('River Cut');
  });

  it('places, assigns, deals, and applies an encounter ticket once through existing stores', () => {
    applyDemoSeed();
    const store = useBlockLoopStore.getState();
    store.startLoop(true);
    store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
    store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
    store.place(BLOCK_LOOP_IDS.shooterId, 5, 3);
    store.assignProduct();
    const moneyBefore = usePlayerStore.getState().player.money;
    store.runDeal();
    expect(usePlayerStore.getState().player.money).toBeGreaterThan(moneyBefore);
    store.beginEncounter();
    const result = seededLoopEncounter(useBlockLoopStore.getState().loop);
    store.resolveEncounter(result);
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    expect(block.appliedEncounterResultKeys).toContain(result.idempotencyKey);
    const heat = block.heat;
    store.resolveEncounter(result);
    expect(useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId].heat).toBe(heat);
  });

  it('rehydrates a ledger without duplicating deal or encounter economy', () => {
    applyDemoSeed();
    const store = useBlockLoopStore.getState();
    store.startLoop(true);
    store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
    store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
    store.place(BLOCK_LOOP_IDS.shooterId, 5, 3);
    store.assignProduct();
    store.runDeal();
    store.beginEncounter();
    store.resolveSeededEncounter();
    const done = useBlockLoopStore.getState().loop;
    const ledger = toLoopLedger(done);
    useBlockLoopStore.getState().hydrateFromLedger(ledger);
    expect(usePlayerStore.getState().player.money).toBe(done.money);
    expect(useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId].heat).toBe(done.block.heat);
    expect(useGangStore.getState().members.find((member) => member.id === BLOCK_LOOP_IDS.dealerId)?.health).toBe(0);
  });

  it('keeps the booked wound after a second demo seed, as persist hydration would', () => {
    applyDemoSeed();
    const store = useBlockLoopStore.getState();
    store.startLoop(true);
    store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
    store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
    store.place(BLOCK_LOOP_IDS.shooterId, 5, 3);
    store.assignProduct();
    store.runDeal();
    store.beginEncounter();
    store.resolveSeededEncounter();
    store.returnToDesktop();
    const money = usePlayerStore.getState().player.money;
    const heat = usePlayerStore.getState().player.heat;
    applyDemoSeed();
    expect(restoreLoopLedgerIfPresent()).toBe(true);
    applyDemoSeed();
    expect(restoreLoopLedgerIfPresent()).toBe(true);
    expect(usePlayerStore.getState().player.money).toBe(money);
    expect(usePlayerStore.getState().player.heat).toBe(heat);
    expect(useGangStore.getState().members.find((member) => member.id === BLOCK_LOOP_IDS.dealerId)?.health).toBe(0);
    expect(useBlockLoopStore.getState().loop.lastEncounter?.idempotencyKey).toMatch(/^loop:/);
    expect(useBlockLoopStore.getState().loop.phase).toBe('returned');
  });

  it('does not restore or overwrite the browser-only demo ledger for a signed-in player', () => {
    applyDemoSeed();
    const store = useBlockLoopStore.getState();
    store.startLoop(true);
    store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
    store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
    store.place(BLOCK_LOOP_IDS.shooterId, 5, 3);
    store.assignProduct();
    store.runDeal();
    store.beginEncounter();
    store.resolveSeededEncounter();

    const demoLedger = window.localStorage.getItem(BLOCK_LOOP_LEDGER_KEY);
    expect(demoLedger).not.toBeNull();

    usePlayerStore.getState().updatePlayer({ id: 'player-signed-in', money: 777 });
    useBlockLoopStore.setState({ started: false });
    useBlockLoopStore.getState().startLoop();

    expect(useBlockLoopStore.getState().loop.appliedEncounterKeys).toEqual([]);
    expect(usePlayerStore.getState().player.money).toBe(777);
    expect(window.localStorage.getItem(BLOCK_LOOP_LEDGER_KEY)).toBe(demoLedger);
  });
});
