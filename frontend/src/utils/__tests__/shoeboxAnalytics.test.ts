import { describe, expect, it } from 'vitest';
import type { BlockData } from '../../types/block.types';
import type { GangMember } from '../../types/game.types';
import {
  computeBlockWeeklyCosts,
  computeEmpirePnl,
  computeMemberPnl,
  computeRolePnl,
  formatCash,
  liveBlocksToPayrollInput,
} from '../shoeboxAnalytics';

function member(partial: Partial<GangMember> & Pick<GangMember, 'id' | 'role'>): GangMember {
  return {
    gangId: 'g1',
    name: partial.name ?? 'Member',
    nickname: partial.nickname ?? 'Mem',
    avatarUrl: '',
    backstory: '',
    age: 22,
    region: 'miami',
    stats: { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 },
    level: partial.level ?? 1,
    experience: 0,
    skillPoints: 0,
    skills: [],
    loyalty: 80,
    morale: 80,
    respect: 50,
    kills: 0,
    arrests: 0,
    dealsCompleted: 0,
    moneyEarned: 0,
    status: 'active',
    currentAssignment: null,
    joinedAt: new Date().toISOString(),
    health: 100,
    maxHealth: 100,
    ...partial,
  };
}

function block(overrides: Partial<BlockData> = {}): BlockData {
  return {
    id: 'b1',
    address: '1208 W Las Olas Blvd',
    lat: 26.1224,
    lng: -80.1373,
    owner: 'player',
    grid: [],
    placements: [
      {
        memberId: 'd1',
        memberName: 'Dre',
        role: 'dealer',
        x: 2,
        y: 2,
        zoneType: 'sidewalk',
        incomePerTick: 67,
        exposureRisk: 50,
        level: 2,
        health: 100,
      },
      {
        memberId: 'e1',
        memberName: 'Rome',
        role: 'enforcer',
        x: 3,
        y: 4,
        zoneType: 'storefront',
        incomePerTick: 0,
        exposureRisk: 25,
        level: 3,
        health: 100,
      },
    ],
    incomePerTick: 67,
    heat: 5,
    morale: 80,
    members: 2,
    viewMode: 'topdown',
    pendingIncome: 200,
    ...overrides,
  };
}

describe('shoeboxAnalytics', () => {
  const crew = [
    member({ id: 'd1', role: 'dealer', name: 'Lil Dre', nickname: 'Dre', level: 2 }),
    member({ id: 'e1', role: 'enforcer', name: 'Big Rome', nickname: 'Rome', level: 3 }),
    member({ id: 's1', role: 'shooter', name: 'Ace', nickname: 'Ace', level: 1 }),
  ];

  it('projects dealer income and enforcer patrol separately', () => {
    const roles = computeRolePnl(crew, [block()]);
    const dealers = roles.find((r) => r.role === 'dealer');
    const enforcers = roles.find((r) => r.role === 'enforcer');
    const shooters = roles.find((r) => r.role === 'shooter');
    expect(dealers?.weeklyIncome).toBeGreaterThan(0);
    expect(enforcers?.weeklyIncome).toBeGreaterThan(0);
    expect(shooters?.weeklyIncome).toBe(0);
    expect(shooters?.weeklyWage).toBe(800);
  });

  it('shows weekly block cost vs take', () => {
    const costs = computeBlockWeeklyCosts(crew, [block()]);
    expect(costs).toHaveLength(1);
    expect(costs[0].weeklyCost).toBeGreaterThan(0);
    expect(costs[0].pendingIncome).toBe(200);
    expect(costs[0].weeklyIncome).toBeGreaterThan(costs[0].weeklyCost);
  });

  it('reports every crew member with attributable earnings, payroll, and deployment', () => {
    const rows = computeMemberPnl(crew, [block()]);
    const dealer = rows.find((row) => row.memberId === 'd1');
    const enforcer = rows.find((row) => row.memberId === 'e1');
    const shooter = rows.find((row) => row.memberId === 's1');

    expect(rows).toHaveLength(3);
    expect(dealer).toMatchObject({ deployed: true, blockId: 'b1', weeklyIncome: 11256 });
    expect(dealer!.weeklyWage).toBeGreaterThan(0);
    expect(enforcer!.weeklyIncome).toBeGreaterThan(0);
    expect(shooter).toMatchObject({ deployed: false, blockId: null, weeklyIncome: 0, weeklyWage: 800 });
  });

  it('shows unavailable crew while excluding them from the live payroll', () => {
    const rows = computeMemberPnl([
      ...crew,
      member({ id: 'j1', role: 'dealer', name: 'Locked Up', status: 'jailed' }),
    ], [block()]);
    const jailed = rows.find((row) => row.memberId === 'j1');

    expect(jailed).toMatchObject({ status: 'jailed', deployed: false, weeklyIncome: 0, weeklyWage: 0 });
  });

  it('adapts live BlockData into payroll input with placements as units', () => {
    const input = liveBlocksToPayrollInput({ b1: block() });
    expect(input[0].units.map((u) => u.gangMemberId)).toEqual(['d1', 'e1']);
  });

  it('rolls empire P&L and spending from the ledger', () => {
    const pnl = computeEmpirePnl({
      streetCash: 1200,
      vault: 5000,
      members: crew,
      blocks: [block()],
      ledger: [
        { id: '1', type: 'salary', amount: -1000, balanceAfter: 4000, description: 'Payroll', timestamp: new Date().toISOString() },
        { id: '2', type: 'purchase', amount: -250, balanceAfter: 3750, description: 'Glock', timestamp: new Date().toISOString() },
        { id: '3', type: 'block_income', amount: 840, balanceAfter: 4590, description: 'Las Olas', timestamp: new Date().toISOString() },
      ],
    });
    expect(pnl.pendingCollect).toBe(200);
    expect(pnl.spending[0].key).toBe('salary');
    expect(pnl.roleCards.some((r) => r.role === 'dealer')).toBe(true);
    expect(pnl.memberRows.map((row) => row.memberId)).toContain('d1');
    expect(formatCash(1150)).toBe('$1,150');
  });
});
