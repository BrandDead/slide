/**
 * Characterization of the legacy topdown route on main-tL2525 (issue #192).
 *
 * FOUNDER DECISION: do not treat this file as a new seat rule. A probe that
 * required AttackPlanner to stay off the topdown route failed because
 * handleLaunch calls navigateTo('topdown') whenever a target is selected.
 * Issue #192 still chooses between the canonical BlockModeView encounter
 * and a labeled non-authoritative practice route. This test records what
 * the current launch path does, including that it does not write
 * encounter consequences and does not call applyEncounterResult.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AttackPlanner from './AttackPlanner';
import OSShell from '../layout/OSShell';
import TopDownShooter from '../topdown/TopDownShooter';
import { useGangStore, useNavigationStore, usePlayerStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { useGhostStore } from '../../stores/ghostCrewStore';
import { useBlockLoopStore } from '../../stores/blockLoopStore';
import { createLoopState } from '../../game/loop/blockLoopFixture';
import type { CombatResult } from '../../game/combat/types';
import type { GangMember } from '../../types/game.types';

vi.mock('../common/GameSprite', () => ({
  GameSprite: ({ fallback }: { fallback: string }) => <span>{fallback}</span>,
}));

const member = {
  id: 'member-shooter',
  gangId: 'gang-1',
  name: 'Trigger',
  nickname: 'Trigger',
  avatarUrl: '',
  backstory: '',
  age: 24,
  region: 'miami',
  stats: { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 },
  level: 2,
  experience: 0,
  skillPoints: 0,
  skills: [],
  loyalty: 80,
  morale: 80,
  respect: 40,
  kills: 0,
  arrests: 0,
  dealsCompleted: 0,
  moneyEarned: 0,
  status: 'active',
  currentAssignment: null,
  joinedAt: '2026-01-01',
  role: 'shooter',
  health: 100,
  maxHealth: 100,
} as GangMember;

const rivalBlock = { id: 'rival-block', owner: 'npc' };

function economySnapshot() {
  const player = usePlayerStore.getState().player;
  const gang = useGangStore.getState();
  return {
    money: player.money,
    heat: player.heat,
    xp: player.xp,
    memberIds: gang.members.map((item) => item.id),
    memberStatuses: gang.members.map((item) => item.status),
    blocks: JSON.stringify(useBlockStore.getState().blocks),
  };
}

function watchConsequenceWriters() {
  const calls = { encounter: 0, kill: 0, money: 0, heat: 0, xp: 0 };
  const apply = useBlockStore.getState().applyEncounterResult;
  const kill = useGangStore.getState().killMember;
  const money = usePlayerStore.getState().updateMoney;
  const heat = usePlayerStore.getState().updateHeat;
  const xp = usePlayerStore.getState().addXP;
  useBlockStore.setState({
    applyEncounterResult: (blockId: string, result: CombatResult) => {
      calls.encounter += 1;
      apply(blockId, result);
    },
  });
  useGangStore.setState({
    killMember: (id: string, cause: string, killedBy?: string) => {
      calls.kill += 1;
      kill(id, cause, killedBy);
    },
  });
  usePlayerStore.setState({
    updateMoney: (amount: number) => {
      calls.money += 1;
      money(amount);
    },
    updateHeat: (amount: number) => {
      calls.heat += 1;
      heat(amount);
    },
    addXP: (amount: number) => {
      calls.xp += 1;
      xp(amount);
    },
  });
  return calls;
}

describe('legacy topdown assignedRoles route (characterization, issue #192)', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      currentApp: 'home',
      previousApp: '',
      appStack: ['home'],
      isTransitioning: false,
    });
    usePlayerStore.getState().updatePlayer({ money: 5000, heat: 0, xp: 0 });
    useGangStore.setState({ members: [member], contacts: [] });
    useBlockStore.setState({
      blocks: { 'rival-block': rivalBlock as never },
      selectedBlockId: null,
    });
    useGhostStore.setState({ feed: [], appliedResponseKeys: [] });
    useBlockLoopStore.setState({ loop: createLoopState(), started: false });
  });

  it('opens the topdown route from AttackPlanner when a target is selected and driver and shooter are empty, without writing encounter consequences', () => {
    const calls = watchConsequenceWriters();
    const before = economySnapshot();
    render(<AttackPlanner />);

    const [target, scout, enforcer, driver] = screen.getAllByRole('combobox');
    fireEvent.change(target, { target: { value: 'dummy-target' } });
    expect(scout).toHaveValue('');
    expect(enforcer).toHaveValue('');
    expect(driver).toHaveValue('');
    expect(screen.getByRole('button', { name: /launch attack/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /launch attack/i }));

    expect(useNavigationStore.getState().currentApp).toBe('topdown');
    expect(useNavigationStore.getState().appStack).toEqual(['home', 'topdown']);
    expect(economySnapshot()).toEqual(before);
    expect(calls).toEqual({ encounter: 0, kill: 0, money: 0, heat: 0, xp: 0 });
  });

  it('opens TopDownShooter from the OSShell ATTACK icon with no role payload and no encounter writes', () => {
    const calls = watchConsequenceWriters();
    const before = economySnapshot();
    render(<OSShell />);

    fireEvent.click(screen.getByRole('button', { name: 'ATTACK' }));

    expect(useNavigationStore.getState().currentApp).toBe('topdown');
    expect(useNavigationStore.getState().appStack).toEqual(['home', 'topdown']);
    expect(economySnapshot()).toEqual(before);
    expect(calls).toEqual({ encounter: 0, kill: 0, money: 0, heat: 0, xp: 0 });
  });

  it('keeps an empty-seat TopDownShooter on setup and does not apply encounter consequences', () => {
    const calls = watchConsequenceWriters();
    const before = economySnapshot();
    render(<TopDownShooter />);

    expect(screen.getByText('Setup')).toBeInTheDocument();
    const launch = screen.getByRole('button', { name: /launch attack/i });
    expect(launch).toBeDisabled();
    fireEvent.click(launch);

    expect(screen.getByText('Setup')).toBeInTheDocument();
    expect(screen.queryByText(/Turn 1/)).not.toBeInTheDocument();
    expect(economySnapshot()).toEqual(before);
    expect(calls).toEqual({ encounter: 0, kill: 0, money: 0, heat: 0, xp: 0 });
    expect(useNavigationStore.getState().currentApp).toBe('home');
  });
});
