// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE — Economy Types (Pillar 1)
// The Shoebox is the single source of money truth. Everything flows through it.
// Adapted from Fable AI Pillar 1 output to match the repo's existing type system.
// ═══════════════════════════════════════════════════════════════════════════

import type { UnitType, TransactionType } from './game.types';

/** Slim block shape the payroll engine needs — works with live BlockData. */
export interface PayrollBlockInput {
  id: string;
  address: string;
  incomePerTick: number;
  units: Array<{ gangMemberId: string; type: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOEBOX LEDGER
// ─────────────────────────────────────────────────────────────────────────────

export interface ShoeboxState {
  /** The gang's central bank. All block income deposits here. */
  bankBalance: number;
  /** Lifetime deposits, for stats/flexing. */
  totalDeposited: number;
  /** Lifetime withdrawals. */
  totalWithdrawn: number;
  /** Rolling ledger, newest first, capped client-side at 200 entries. */
  ledger: ShoeboxEntry[];
}

export interface ShoeboxEntry {
  id: string;
  type: TransactionType;
  /** Positive = deposit, negative = withdrawal */
  amount: number;
  balanceAfter: number;
  /** Which block generated/consumed this transaction */
  blockId?: string;
  /** Which member (salary, bail, hospital) */
  memberId?: string;
  description: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL
// ─────────────────────────────────────────────────────────────────────────────

/** One member's line on the payroll sheet. */
export interface PayrollLine {
  memberId: string;
  memberName: string;
  nickname: string;
  role: UnitType | string;
  level: number;
  wage: number;
  /** Block this member is deployed to; null if benched at HQ. */
  blockId: string | null;
  blockAddress: string | null;
  morale: number;
  loyalty: number;
  consecutiveUnpaidWeeks: number;
  /** Player's choice this cycle. Defaults true; toggled in PayrollModal when short. */
  willPay: boolean;
}

/** Per-block payroll rollup — "the weekly cost of the block". */
export interface BlockPayroll {
  blockId: string;
  blockAddress: string;
  memberCount: number;
  weeklyCost: number;
  /** Projected weekly income from dealers on the block */
  weeklyIncome: number;
  /** income - cost; negative blocks are bleeding you dry */
  netWeekly: number;
  lines: PayrollLine[];
}

export interface PayrollCycle {
  id: string;
  cycleNumber: number;
  dueAt: string;
  /** Full sheet: every member, grouped later by block. */
  lines: PayrollLine[];
  totalDue: number;
  shoeboxBalanceAtOpen: number;
  /** true when Shoebox can't cover totalDue — triggers selective payment UI */
  insufficientFunds: boolean;
  status: 'pending' | 'awaiting_selection' | 'settled';
  settledAt: string | null;
  result: PayrollResult | null;
}

export interface PayrollResult {
  paidMemberIds: string[];
  unpaidMemberIds: string[];
  totalPaid: number;
  moraleFallout: MoraleFallout[];
  gangMoraleBefore: number;
  gangMoraleAfter: number;
}

export interface MoraleFallout {
  memberId: string;
  memberName: string;
  moraleBefore: number;
  moraleAfter: number;
  loyaltyBefore: number;
  loyaltyAfter: number;
  /** Member has been skipped UNPAID_WEEKS_BEFORE_EXIT_RISK+ consecutive weeks */
  atExitRisk: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// REINFORCEMENTS ("Call Backup")
// ─────────────────────────────────────────────────────────────────────────────

export interface BackupRequest {
  combatSessionId: string;
  blockId: string;
  memberIds: string[];
  /** Ticks until they arrive on the grid — distance/driver dependent. */
  etaTicks: number;
  requestedAt: string;
}

export interface BackupArrival {
  memberId: string;
  /** Entry tile assigned on arrival (spawn edge of the grid). */
  entryTile: { x: number; y: number };
  arrivedAtTick: number;
}
