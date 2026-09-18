import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AgeGate, { AGE_GATE_STORAGE_KEY, initialAgeAffirmed } from '../components/compliance/AgeGate';
import BlockLoopDesk from '../components/layout/BlockLoopDesk';
import { useBlockStore } from '../stores/blockStore';
import { useDrugInventory } from '../stores/useDrugInventory';
import { useGangStore, usePlayerStore } from '../stores/gameStore';
import { useBlockLoopStore } from '../stores/blockLoopStore';
import { applyDemoSeed, restoreLoopLedgerIfPresent } from '../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../game/loop/blockLoopTypes';
import { clearLoopLedger } from '../game/loop/blockLoopPersist';
import { composeDioramaScene } from '../render/dioramaAdapter';

vi.mock('../components/encounter/UnifiedEncounter', () => ({
  default: () => <div>Encounter board</div>,
}));

describe('Las Olas closed-beta one path', () => {
  beforeEach(() => {
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
    clearLoopLedger();
    applyDemoSeed();
  });

  it('does not treat a missing local acknowledgement as 18+ just because this is a demo build', () => {
    expect(initialAgeAffirmed({ getItem: () => null })).toBe(false);
    render(<AgeGate evaluationBuild onConfirm={() => undefined} />);
    expect(screen.getByRole('button', { name: /i am 18\+ — continue/i })).toBeInTheDocument();
    expect(window.localStorage.getItem(AGE_GATE_STORAGE_KEY)).toBeNull();
  });

  it('walks the seeded Las Olas desk from lock through deal, wound, and reload-safe books', () => {
    render(<BlockLoopDesk />);
    fireEvent.click(screen.getByRole('button', { name: /lock dre and rome/i }));
    expect(screen.getByRole('application', { name: /1208 las olas/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /street-near dre/i }));
    fireEvent.click(screen.getByRole('button', { name: /^shooter$/i }));
    fireEvent.click(screen.getByRole('button', { name: /storefront 5,3/i }));
    fireEvent.click(screen.getByRole('button', { name: /put river cut on dre/i }));
    const moneyAfterProduct = usePlayerStore.getState().player.money;
    const productQty = useDrugInventory.getState().inventory[BLOCK_LOOP_IDS.productId]?.quantity;
    fireEvent.click(screen.getByRole('button', { name: /close the deal/i }));
    expect(usePlayerStore.getState().player.money).toBeGreaterThan(moneyAfterProduct);
    fireEvent.click(screen.getByRole('button', { name: /enter slide/i }));
    fireEvent.click(screen.getByRole('button', { name: /book the wound/i }));
    fireEvent.click(screen.getByRole('button', { name: /return to desktop/i }));

    const money = usePlayerStore.getState().player.money;
    const heat = usePlayerStore.getState().player.heat;
    const dreHealth = useGangStore.getState().members.find((member) => member.id === BLOCK_LOOP_IDS.dealerId)?.health;
    const qty = useDrugInventory.getState().inventory[BLOCK_LOOP_IDS.productId]?.quantity;
    expect(qty).toBeLessThan(productQty ?? 99);

    applyDemoSeed();
    expect(restoreLoopLedgerIfPresent()).toBe(true);
    applyDemoSeed();
    expect(restoreLoopLedgerIfPresent()).toBe(true);
    expect(usePlayerStore.getState().player.money).toBe(money);
    expect(usePlayerStore.getState().player.heat).toBe(heat);
    expect(useGangStore.getState().members.find((member) => member.id === BLOCK_LOOP_IDS.dealerId)?.health).toBe(dreHealth);
    expect(useDrugInventory.getState().inventory[BLOCK_LOOP_IDS.productId]?.quantity).toBe(qty);
  });

  it('composes a playable Las Olas diorama without street tiles', () => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    const scene = composeDioramaScene({
      block,
      view: { width: 800, height: 450 },
      mapContext: { status: 'failed', reason: 'tiles down' },
    });
    expect(scene.playable).toBe(true);
    expect(scene.mapIndependent).toBe(true);
    expect(scene.mapNotice).toMatch(/optional/i);
    expect(scene.cells).toHaveLength(64);
  });

  it('puts the Las Olas run CTA above city briefing on the command desktop', async () => {
    const { default: OSShell } = await import('../components/layout/OSShell');
    const { useNavigationStore } = await import('../stores/gameStore');
    useNavigationStore.setState({ currentApp: 'home' });
    render(<OSShell gangMorale={75} incomePerMinute={12} />);
    const cta = screen.getByTestId('run-las-olas');
    const briefing = screen.getByRole('heading', { name: /city briefing/i });
    expect(cta.compareDocumentPosition(briefing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(cta);
    expect(useNavigationStore.getState().currentApp).toBe('block_loop');
  });
});
