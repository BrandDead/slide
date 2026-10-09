import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import AttackPlanner from '../AttackPlanner';
import { useGangStore, useNavigationStore, usePlayerStore } from '../../../stores/gameStore';
import { useBlockStore } from '../../../stores/blockStore';
import { useCombatIntentStore } from '../../../stores/combatIntentStore';
import { applyDemoSeed } from '../../../utils/demoSeed';
import { BLOCK_LOOP_IDS } from '../../../game/loop/blockLoopTypes';

describe('AttackPlanner canonical block response', () => {
  beforeEach(() => {
    useBlockStore.setState({ blocks: {}, selectedBlockId: null });
    applyDemoSeed();
    useCombatIntentStore.getState().reset();
    useNavigationStore.setState({ currentApp: 'planner', appStack: ['home', 'planner'] });
  });

  it('shows the actual crew and carries the selected block to MAP exactly once', () => {
    render(<AttackPlanner />);
    expect(screen.getByText('Lil Dre')).toBeInTheDocument();
    expect(screen.getByText('Kilo')).toBeInTheDocument();
    const before = usePlayerStore.getState().player;
    const launch = screen.getByRole('button', { name: /launch response/i });
    act(() => { launch.click(); launch.click(); });
    expect(useNavigationStore.getState().currentApp).toBe('map');
    expect(useNavigationStore.getState().appStack).toEqual(['home', 'planner', 'map']);
    expect(useCombatIntentStore.getState().pendingEncounterBlockId).toBe(BLOCK_LOOP_IDS.blockId);
    expect(usePlayerStore.getState().player).toEqual(before);
  });

  it('never offers NPC, unclaimed, or fabricated targets', () => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    useBlockStore.getState().upsertBlock({ ...block, id: 'rival', owner: 'npc', address: 'Rival block' });
    useBlockStore.getState().upsertBlock({ ...block, id: 'empty', owner: 'unclaimed', address: 'Empty block' });
    render(<AttackPlanner />);
    const select = screen.getByRole('combobox', { name: /your block/i });
    expect(select).not.toHaveTextContent('Rival block');
    expect(select).not.toHaveTextContent('Empty block');
    expect(select).not.toHaveTextContent('187th');
  });

  it('uses the newly selected block instead of the prior target', () => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    useBlockStore.getState().upsertBlock({ ...block, id: 'second-block', address: 'Second strip' });
    render(<AttackPlanner />);
    fireEvent.change(screen.getByRole('combobox', { name: /your block/i }), { target: { value: 'second-block' } });
    fireEvent.click(screen.getByRole('button', { name: /launch response/i }));
    expect(useCombatIntentStore.getState().pendingEncounterBlockId).toBe('second-block');
    expect(useBlockStore.getState().selectedBlockId).toBe('second-block');
  });

  it('denies launch after a previously valid shooter becomes unavailable', () => {
    render(<AttackPlanner />);
    act(() => useGangStore.getState().updateMember('demo-enforcer-1', { status: 'hospitalized' }));
    const launch = screen.getByRole('button', { name: /launch response/i });
    expect(launch).toBeDisabled();
    fireEvent.click(launch);
    expect(useNavigationStore.getState().currentApp).toBe('planner');
    expect(useCombatIntentStore.getState().pendingEncounterBlockId).toBeNull();
  });

  it('keeps empty blocks in planning instead of inventing a scout', () => {
    const block = useBlockStore.getState().blocks[BLOCK_LOOP_IDS.blockId];
    useBlockStore.getState().upsertBlock({ ...block, placements: [] });
    render(<AttackPlanner />);
    expect(screen.getByRole('button', { name: /launch response/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /position crew/i })).toBeEnabled();
  });
});
