import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getDNAById } from '../../config/blockDNA';
import { buildZoneLayout } from '../../utils/blockDNAResolver';
import { generateGridForZoneLayout, useBlockStore } from '../../stores/blockStore';
import { environmentAssets } from '../../assets/assetManifest';
import TacticalDiorama from './TacticalDiorama';
import type { BlockData, BlockPlacement } from '../../types/block.types';

function heroBlock(): BlockData {
  const dna = getDNAById('las-olas-1208')!;
  const grid = generateGridForZoneLayout(buildZoneLayout(dna));
  const dealer: BlockPlacement = {
    memberId: 'demo-dealer-1',
    memberName: 'Lil Dre',
    role: 'dealer',
    x: 3,
    y: 1,
    zoneType: 'curb',
    incomePerTick: 80,
    exposureRisk: 80,
    level: 2,
    health: 100,
  };
  grid[1][3].occupantId = dealer.memberId;
  return {
    id: 'demo-block-las-olas',
    address: `${dna.address}, ${dna.city}`,
    lat: dna.lat,
    lng: dna.lng,
    owner: 'player',
    grid,
    gridSource: 'dna-fallback',
    placements: [dealer],
    incomePerTick: 80,
    heat: 1,
    morale: 70,
    members: 1,
    viewMode: 'street',
    pendingIncome: 0,
    dnaId: dna.id,
    streetBackdropUrl: environmentAssets.block_lasolas_miami_001.streetBackdropNight,
  };
}

describe('TacticalDiorama player path', () => {
  beforeEach(() => {
    useBlockStore.setState({
      blocks: {},
      selectedBlockId: null,
      activeDriveBys: {},
      isPlacementMode: false,
      pendingPlacementMemberId: null,
      pendingPlacementMember: null,
    });
  });

  it('renders the Las Olas street plate with cover, street, crew, objective, and extraction', () => {
    render(<TacticalDiorama block={heroBlock()} />);
    expect(screen.getByRole('img', { name: /1208 las olas/i })).toBeInTheDocument();
    expect(screen.getByText(/Lil Dre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/objective/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/extraction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street 0,0/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/curb 3,1/i)).toBeInTheDocument();
  });

  it('selects crew on the projected curb without writing strategy state', () => {
    const block = heroBlock();
    render(<TacticalDiorama block={block} />);
    fireEvent.click(screen.getByRole('button', { name: /^lil dre$/i }));
    const context = screen.getByRole('complementary', { name: /selected crew cover/i });
    expect(context).toHaveTextContent(/curb/i);
    expect(context).toHaveTextContent(/cover/i);
    expect(useBlockStore.getState().blocks).toEqual({});
    expect(block.placements[0]).toMatchObject({ memberId: 'demo-dealer-1', x: 3, y: 1 });
  });

  it('keeps the legal board available as a fallback without requiring map tiles', () => {
    render(
      <TacticalDiorama
        block={heroBlock()}
        mapContext={{ status: 'failed', reason: 'tiles down' }}
      />,
    );
    expect(screen.getByRole('button', { name: /legal board/i })).toBeInTheDocument();
    expect(screen.getByText(/street map/i)).toBeInTheDocument();
  });
});
