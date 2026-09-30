import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useBlockStore } from '../blockStore';
import { usePlayerStore } from '../gameStore';
import { useDrugInventory } from '../useDrugInventory';
import { useBlockLoopStore } from '../blockLoopStore';
import { useGhostStore } from '../ghostCrewStore';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';
import { LOOP_RE_UP, REST_RETURN_HEALTH } from '../../game/loop/blockLoopFixture';
import { applyDemoSeed } from '../../utils/demoSeed';
import { clearLoopLedger, readLoopLedger } from '../../game/loop/blockLoopPersist';
import BlockLoopDesk from '../../components/layout/BlockLoopDesk';

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
  useGhostStore.setState({ feed: [], appliedResponseKeys: [] });
  clearLoopLedger();
}

function finishFirstShift() {
  const store = useBlockLoopStore.getState();
  store.startLoop(true);
  store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
  store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
  store.place(BLOCK_LOOP_IDS.shooterId, 5, 3);
  store.assignProduct();
  store.runDeal();
  store.beginEncounter();
  store.resolveSeededEncounter();
}

describe('Strip shifts through the shared stores', () => {
  beforeEach(reset);

  it('keeps cash and heat earned in other apps instead of overwriting them', () => {
    applyDemoSeed();
    const store = useBlockLoopStore.getState();
    store.startLoop(true);
    store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
    // A DEALT run pays out while the Strip is mid-setup.
    const before = usePlayerStore.getState().player;
    usePlayerStore.getState().updatePlayer({ money: before.money + 2_500, heat: before.heat + 3.4 });
    store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
    expect(usePlayerStore.getState().player.money).toBe(before.money + 2_500);
    expect(useBlockLoopStore.getState().loop.money).toBe(before.money + 2_500);
    expect(useBlockLoopStore.getState().loop.playerHeat).toBe(before.heat + 3);
  });

  it('runs a second shift with lab product, then re-ups when the stash runs dry', () => {
    applyDemoSeed();
    finishFirstShift();
    const store = useBlockLoopStore.getState();
    store.recover(false);
    // The lab cooks a new product between shifts.
    useDrugInventory.getState().addDrug({
      id: 'drug-lab-1',
      name: 'Blue Static',
      tier: 'pure',
      quality: 88,
      quantity: 4,
      craftedAt: 1,
      effects: [],
    });
    store.nextShift();
    let loop = useBlockLoopStore.getState().loop;
    expect(loop.shiftIndex).toBe(2);
    expect(loop.members.find((member) => member.id === BLOCK_LOOP_IDS.dealerId)?.health).toBe(REST_RETURN_HEALTH);
    expect(loop.inventory.map((item) => item.name)).toEqual(['River Cut', 'Blue Static']);

    const cash = usePlayerStore.getState().player.money;
    store.assignProduct('drug-lab-1');
    store.runDeal();
    loop = useBlockLoopStore.getState().loop;
    expect(loop.lastDeal?.productName).toBe('Blue Static');
    expect(usePlayerStore.getState().player.money).toBeGreaterThan(cash);
    expect(useDrugInventory.getState().inventory['drug-lab-1'].quantity).toBe(loop.inventory[1].quantity);

    useDrugInventory.getState().restockDrug(BLOCK_LOOP_IDS.productId, -loop.inventory[0].quantity);
    const beforeReUp = usePlayerStore.getState().player.money;
    store.reUp();
    expect(usePlayerStore.getState().player.money).toBe(beforeReUp - LOOP_RE_UP.cost);
    expect(useDrugInventory.getState().inventory[BLOCK_LOOP_IDS.productId].quantity).toBe(LOOP_RE_UP.units);
    expect(readLoopLedger()?.shiftIndex).toBe(2);
  });

  it('offers the next shift from the desk once the recovery is decided', () => {
    applyDemoSeed();
    finishFirstShift();
    render(<BlockLoopDesk />);
    expect(screen.queryByTestId('next-shift')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /rest it off/i }));
    fireEvent.click(screen.getByTestId('next-shift'));
    expect(screen.getByTestId('strip-shift')).toHaveTextContent('2');
    expect(screen.getByRole('heading', { name: 'Equip product' })).toBeInTheDocument();
    expect(screen.getByTestId('assign-river-cut')).toHaveTextContent('Put River Cut on Dre');
  });

  it('does not spend below zero when another app uses the hospital cash', () => {
    applyDemoSeed();
    finishFirstShift();
    const store = useBlockLoopStore.getState();
    usePlayerStore.getState().updatePlayer({ money: 10 });
    store.recover(true);
    expect(usePlayerStore.getState().player.money).toBe(10);
    expect(useBlockLoopStore.getState().loop.recovery?.affordable).toBe(false);
    expect(useBlockLoopStore.getState().loop.rejection).toMatch(/cannot cover hospital/i);
  });

  it('updates hospital affordability on screen when cash changes in another app', () => {
    applyDemoSeed();
    finishFirstShift();
    const cost = useBlockLoopStore.getState().loop.recovery!.cost;
    usePlayerStore.getState().updatePlayer({ money: 10 });
    render(<BlockLoopDesk />);
    expect(screen.getByRole('button', { name: 'Pay hospital' })).toBeDisabled();
    act(() => usePlayerStore.getState().updatePlayer({ money: 5_000 }));
    expect(screen.getByRole('button', { name: 'Pay hospital' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Pay hospital' }));
    expect(usePlayerStore.getState().player.money).toBe(5_000 - cost);
  });

  it('shows fresh lab stock after leaving an empty stash and returning without a Strip command', () => {
    applyDemoSeed();
    finishFirstShift();
    const store = useBlockLoopStore.getState();
    store.recover(false);
    useDrugInventory.setState({ inventory: {}, assignments: {} });
    store.nextShift();
    const firstVisit = render(<BlockLoopDesk />);
    expect(screen.getByTestId('stash-empty')).toBeInTheDocument();
    firstVisit.unmount();
    useDrugInventory.getState().addDrug({ id: 'cooked-on-return', name: 'Blue Static', tier: 'pure', quality: 88, quantity: 4, craftedAt: 1, effects: [] });
    render(<BlockLoopDesk />);
    expect(screen.getByTestId('assign-cooked-on-return')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('assign-cooked-on-return'));
    expect(useBlockLoopStore.getState().loop.assignments[BLOCK_LOOP_IDS.dealerId]).toBe('cooked-on-return');
  });

  it('clears only the Strip dealer assignment when starting the next shift', () => {
    applyDemoSeed();
    finishFirstShift();
    useDrugInventory.setState({ assignments: { ...useDrugInventory.getState().assignments, 'other-block-dealer': BLOCK_LOOP_IDS.productId } });
    const store = useBlockLoopStore.getState();
    store.recover(false);
    store.nextShift();
    expect(useDrugInventory.getState().assignments['other-block-dealer']).toBe(BLOCK_LOOP_IDS.productId);
    expect(useDrugInventory.getState().assignments[BLOCK_LOOP_IDS.dealerId]).toBeUndefined();
  });

  it('retains income and placements added through the shared block between shifts', () => {
    applyDemoSeed();
    finishFirstShift();
    const store = useBlockLoopStore.getState();
    store.recover(false);
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    const added = { ...block.placements[0], memberId: BLOCK_LOOP_IDS.enforcerId, memberName: 'Kilo', role: 'enforcer' as const, x: 4, y: 2, zoneType: 'sidewalk' as const, health: 100 };
    useBlockStore.getState().upsertBlock({ ...block, placements: [...block.placements, added], pendingIncome: block.pendingIncome + 420 });
    store.nextShift();
    const live = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    expect(live.pendingIncome).toBe(block.pendingIncome + 420);
    expect(live.placements.find(item => item.memberId === BLOCK_LOOP_IDS.enforcerId)).toMatchObject({ x: 4, y: 2 });
  });

  it('does not resurrect stock deleted by passive consumption and cannot pay for a depleted deal', () => {
    applyDemoSeed();
    const store = useBlockLoopStore.getState();
    store.startLoop(true);
    store.selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId);
    store.place(BLOCK_LOOP_IDS.dealerId, 3, 1);
    store.place(BLOCK_LOOP_IDS.shooterId, 5, 3);
    store.assignProduct();
    const cash = usePlayerStore.getState().player.money;
    useDrugInventory.getState().consumeAssignedDrugs(10_000);
    expect(useDrugInventory.getState().inventory[BLOCK_LOOP_IDS.productId]).toBeUndefined();
    store.runDeal();
    expect(usePlayerStore.getState().player.money).toBe(cash);
    expect(useBlockLoopStore.getState().loop.inventory[0].quantity).toBe(0);
    expect(useBlockLoopStore.getState().loop.lastDeal).toBeNull();
  });
});
