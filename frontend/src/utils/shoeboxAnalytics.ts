import { computeWage } from '../config/wages';
import { calculateEnforcerContribution } from './enforcerEngine';
import type { BlockData, BlockPlacement, MemberRole } from '../types/block.types';
import type { ShoeboxEntry, PayrollBlockInput } from '../types/economy.types';
import type { GangMember } from '../types/game.types';

/** Treat placement incomePerTick as hourly for weekly empire math (payroll contract). */
export const HOURS_PER_WEEK = 24 * 7;

export const EARNER_ROLES = new Set<MemberRole | string>(['dealer', 'chemist', 'runner']);
export const ENFORCER_ROLES = new Set<MemberRole | string>(['enforcer']);
export const SHOOTER_ROLES = new Set<MemberRole | string>(['shooter', 'soldier', 'k9']);

export interface RolePnl {
  role: string;
  label: string;
  memberCount: number;
  weeklyIncome: number;
  weeklyWage: number;
  weeklyNet: number;
  note: string;
}

export interface BlockWeeklyCost {
  blockId: string;
  address: string;
  memberCount: number;
  weeklyIncome: number;
  weeklyCost: number;
  netWeekly: number;
  pendingIncome: number;
  heat: number;
  lines: Array<{ memberId: string; name: string; role: string; wage: number; income: number }>;
}

export interface SpendCategory {
  key: string;
  label: string;
  amount: number;
}

export interface EmpirePnl {
  streetCash: number;
  vault: number;
  pendingCollect: number;
  weeklyIncome: number;
  weeklyWages: number;
  weeklyNet: number;
  dealerWeekly: number;
  enforcerWeekly: number;
  shooterWeeklyWage: number;
  roleCards: RolePnl[];
  blocks: BlockWeeklyCost[];
  spending: SpendCategory[];
  nextPayrollLabel: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  dealer: 'Dealers',
  enforcer: 'Enforcers',
  shooter: 'Shooters',
  lookout: 'Lookouts',
  driver: 'Drivers',
  chemist: 'Chemists',
  runner: 'Runners',
  cook: 'Cooks',
  soldier: 'Soldiers',
  boss: 'Boss',
  recruit: 'Recruits',
};

const SPEND_LABEL: Record<string, string> = {
  salary: 'Crew payroll',
  salary_payment: 'Crew payroll',
  purchase: 'Market & stash',
  bribe: 'Bribes',
  bail: 'Bail / hospital',
  tax: 'Street tax',
  asset_seized: 'Seizures',
  launder: 'Laundry fee',
};

function weeklyFromHourly(hourly: number): number {
  return Math.round(hourly * HOURS_PER_WEEK);
}

function placementIncomeWeekly(p: BlockPlacement): number {
  if (EARNER_ROLES.has(p.role)) return weeklyFromHourly(p.incomePerTick);
  if (ENFORCER_ROLES.has(p.role)) {
    return weeklyFromHourly(calculateEnforcerContribution(p.memberId, p.memberName, p.level, p.y).patrolIncome);
  }
  return 0;
}

export function liveBlocksToPayrollInput(blocks: Record<string, BlockData> | BlockData[]): PayrollBlockInput[] {
  const list = Array.isArray(blocks) ? blocks : Object.values(blocks);
  return list
    .filter((b) => b.owner === 'player')
    .map((b) => ({
      id: b.id,
      address: b.address,
      incomePerTick: b.incomePerTick,
      units: b.placements.map((p) => ({
        gangMemberId: p.memberId,
        type: p.role,
      })),
    }));
}

export function computeBlockWeeklyCosts(
  members: GangMember[],
  blocks: BlockData[],
): BlockWeeklyCost[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  return blocks
    .filter((b) => b.owner === 'player')
    .map((block) => {
      const lines = block.placements.map((p) => {
        const member = byId.get(p.memberId);
        const role = p.role || member?.role || 'enforcer';
        const level = member?.level ?? p.level ?? 1;
        return {
          memberId: p.memberId,
          name: member?.nickname || member?.name || p.memberName,
          role,
          wage: computeWage(role, level),
          income: placementIncomeWeekly(p),
        };
      });
      const weeklyCost = lines.reduce((s, l) => s + l.wage, 0);
      const weeklyIncome = lines.reduce((s, l) => s + l.income, 0);
      return {
        blockId: block.id,
        address: block.address,
        memberCount: lines.length,
        weeklyIncome,
        weeklyCost,
        netWeekly: weeklyIncome - weeklyCost,
        pendingIncome: Math.max(0, Math.round(block.pendingIncome)),
        heat: block.heat,
        lines,
      };
    })
    .sort((a, b) => a.netWeekly - b.netWeekly);
}

export function computeRolePnl(
  members: GangMember[],
  blocks: BlockData[],
): RolePnl[] {
  const deployed = new Map<string, BlockPlacement>();
  for (const block of blocks) {
    if (block.owner !== 'player') continue;
    for (const p of block.placements) deployed.set(p.memberId, p);
  }

  const buckets = new Map<string, RolePnl>();
  const ensure = (role: string): RolePnl => {
    const key = role.toLowerCase();
    let card = buckets.get(key);
    if (!card) {
      card = {
        role: key,
        label: ROLE_LABEL[key] ?? `${key[0]?.toUpperCase() ?? ''}${key.slice(1)}s`,
        memberCount: 0,
        weeklyIncome: 0,
        weeklyWage: 0,
        weeklyNet: 0,
        note: '',
      };
      buckets.set(key, card);
    }
    return card;
  };

  for (const m of members) {
    if (m.status !== 'active' && m.status !== 'injured') continue;
    const role = (deployed.get(m.id)?.role || m.role || 'enforcer').toLowerCase();
    const card = ensure(role);
    card.memberCount += 1;
    card.weeklyWage += computeWage(role, m.level ?? 1);
    const placement = deployed.get(m.id);
    if (placement) card.weeklyIncome += placementIncomeWeekly(placement);
  }

  for (const card of buckets.values()) {
    card.weeklyNet = card.weeklyIncome - card.weeklyWage;
    if (EARNER_ROLES.has(card.role)) {
      card.note = 'Product on the strip';
    } else if (ENFORCER_ROLES.has(card.role)) {
      card.note = 'Strong-arm tax + heat cover';
    } else if (SHOOTER_ROLES.has(card.role)) {
      card.note = 'Defense payroll — they cost, they hold';
    } else {
      card.note = 'Support payroll';
    }
  }

  const order = ['dealer', 'enforcer', 'shooter', 'lookout', 'driver', 'chemist', 'runner'];
  return [...buckets.values()].sort((a, b) => {
    const ai = order.indexOf(a.role);
    const bi = order.indexOf(b.role);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function computeSpending(ledger: ShoeboxEntry[]): SpendCategory[] {
  const totals = new Map<string, number>();
  for (const entry of ledger) {
    if (entry.amount >= 0) continue;
    const key = String(entry.type);
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(entry.amount));
  }
  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      label: SPEND_LABEL[key] ?? key.replace(/_/g, ' '),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeEmpirePnl(args: {
  streetCash: number;
  vault: number;
  members: GangMember[];
  blocks: BlockData[];
  ledger: ShoeboxEntry[];
  nextPayrollDueAt?: string | null;
}): EmpirePnl {
  const playerBlocks = args.blocks.filter((b) => b.owner === 'player');
  const blockCards = computeBlockWeeklyCosts(args.members, playerBlocks);
  const roleCards = computeRolePnl(args.members, playerBlocks);
  const weeklyIncome = blockCards.reduce((s, b) => s + b.weeklyIncome, 0);
  const weeklyWages = args.members
    .filter((m) => m.status === 'active' || m.status === 'injured')
    .reduce((s, m) => s + computeWage(m.role, m.level ?? 1), 0);
  const dealerWeekly = roleCards.find((r) => r.role === 'dealer')?.weeklyIncome ?? 0;
  const enforcerWeekly = roleCards.find((r) => r.role === 'enforcer')?.weeklyIncome ?? 0;
  const shooterWeeklyWage = roleCards.find((r) => r.role === 'shooter')?.weeklyWage ?? 0;

  return {
    streetCash: args.streetCash,
    vault: args.vault,
    pendingCollect: blockCards.reduce((s, b) => s + b.pendingIncome, 0),
    weeklyIncome,
    weeklyWages,
    weeklyNet: weeklyIncome - weeklyWages,
    dealerWeekly,
    enforcerWeekly,
    shooterWeeklyWage,
    roleCards,
    blocks: blockCards,
    spending: computeSpending(args.ledger),
    nextPayrollLabel: args.nextPayrollDueAt ?? null,
  };
}

export function formatCash(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatSignedCash(amount: number): string {
  if (amount > 0) return `+${formatCash(amount)}`;
  return formatCash(amount);
}
