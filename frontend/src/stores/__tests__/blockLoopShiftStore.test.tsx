import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
