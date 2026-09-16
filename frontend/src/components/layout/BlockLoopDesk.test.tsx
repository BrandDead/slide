import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BlockLoopDesk from './BlockLoopDesk';
import { useBlockStore } from '../../stores/blockStore';
import { useDrugInventory } from '../../stores/useDrugInventory';
import { useBlockLoopStore } from '../../stores/blockLoopStore';
import { applyDemoSeed } from '../../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';
import { clearLoopLedger } from '../../game/loop/blockLoopPersist';

vi.mock('../encounter/UnifiedEncounter', () => ({
  default: () => <div>Encounter board</div>,
}));

describe('BlockLoopDesk', () => {
  beforeEach(() => {
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

  it('shows the dealer, shooter, block, product, money, and heat on the strip', () => {
    render(<BlockLoopDesk />);
    expect(screen.getByText('1208 Las Olas')).toBeInTheDocument();
    expect(screen.getAllByText(/las-olas-1208/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lil Dre').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Big Rome').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/River Cut/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /lock dre and rome/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open contacts/i })).toBeInTheDocument();
  });

  it('rejects a street cell and places a curb dealer with a visible income/exposure split', () => {
    render(<BlockLoopDesk />);
    fireEvent.click(screen.getByRole('button', { name: /lock dre and rome/i }));
    fireEvent.click(screen.getByRole('gridcell', { name: /street 0,0/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/not deployable|Street and building/i);
    fireEvent.click(screen.getByRole('button', { name: /street-near dre/i }));
    expect(screen.getByText(/Income \$/)).toBeInTheDocument();
    expect(screen.getByText(/exposure 80/i)).toBeInTheDocument();
  });

  it('runs a deal receipt then books a deterministic wound', async () => {
    render(<BlockLoopDesk />);
    fireEvent.click(screen.getByRole('button', { name: /lock dre and rome/i }));
    fireEvent.click(screen.getByRole('button', { name: /street-near dre/i }));
    fireEvent.click(screen.getByRole('button', { name: /^shooter$/i }));
    fireEvent.click(screen.getByRole('gridcell', { name: /storefront 5,3/i }));
    fireEvent.click(screen.getByRole('button', { name: /put river cut on dre/i }));
    fireEvent.click(screen.getByRole('button', { name: /close the deal/i }));
    expect(screen.getAllByText(/Street exposure \+18%/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /enter slide/i }));
    fireEvent.click(screen.getByRole('button', { name: /book the wound/i }));
    expect(screen.getByRole('heading', { name: 'Consequence' })).toBeInTheDocument();
    expect(useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId].appliedEncounterResultKeys?.length).toBeGreaterThan(0);
  });
});
