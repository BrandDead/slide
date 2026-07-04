// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE — Shoebox Store (Pillar 1)
//
// Responsibilities:
//   - ALL income deposits to bankBalance (never loose cash)
//   - ALL purchases & dues withdraw from bankBalance first
//   - Per-block payroll (weekly block cost = sum of deployed member wages)
//   - Selective non-payment with individual + gang morale fallout
//   - Unpaid streak tracking (loyalty stacks week-over-week)
//
// NOTE: This store is separate from the existing useEconomyStore (which
// handles inventory/market/transaction logging) to avoid conflicts.
// It syncs bankBalance with usePlayerStore so the Shoebox UI stays accurate.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import {
  computeWage,
  UNPAID_MORALE_HIT,
  UNPAID_LOYALTY_HIT,
  PAID_MORALE_BONUS,
  UNPAID_WEEKS_BEFORE_EXIT_RISK,
  PAYROLL_CYCLE_MS,
} from '../config/wages';
import type {
  ShoeboxEntry,
  PayrollCycle,
  PayrollLine,
  PayrollResult,
  MoraleFallout,
  BlockPayroll,
} from '../types/economy.types';
import type { TransactionType, GangMember, Block } from '../types/game.types';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LEDGER_CAP = 200;

// ─────────────────────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

interface ShoeboxStoreState {
  // Shoebox balance
  bankBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  ledger: ShoeboxEntry[];

  // Payroll
  currentCycle: PayrollCycle | null;
  cycleHistory: PayrollCycle[];
  nextPayrollDueAt: string | null;
  /** Tracks consecutive unpaid weeks per member id. */
  unpaidStreaks: Record<string, number>;

  // ── Shoebox core ──────────────────────────────────────────────────────────
  /** THE deposit path. Block income, deal income, combat loot — all land here. */
  deposit: (
    amount: number,
    type: TransactionType,
    description: string,
    meta?: { blockId?: string; memberId?: string }
  ) => void;
  /**
   * THE withdrawal path. Returns true if funds covered it, false if declined.
   * Purchases and dues MUST go through this — never touch player.money directly.
   */
  withdraw: (
    amount: number,
    type: TransactionType,
    description: string,
    meta?: { blockId?: string; memberId?: string }
  ) => boolean;
  canAfford: (amount: number) => boolean;

  // ── Payroll ───────────────────────────────────────────────────────────────
  /** Build this week's sheet from live gang state. */
  openPayrollCycle: (members: GangMember[], ownedBlocks: Block[]) => PayrollCycle;
  /** Per-block cost rollups for the UI ("this block runs you $2,400/wk"). */
  getBlockPayrolls: (members: GangMember[], ownedBlocks: Block[]) => BlockPayroll[];
  /** Toggle a member's willPay flag during selective payment. */
  setWillPay: (memberId: string, willPay: boolean) => void;
  /**
   * Execute payroll: pay the willPay lines, punish the rest.
   * Requires callbacks to update member morale/loyalty and fire notifications.
   */
  settlePayroll: (
    members: GangMember[],
    updateMember: (id: string, updates: Partial<GangMember>) => void,
    addNotification: (n: { type: string; title: string; message: string }) => void
  ) => PayrollResult | null;
  /** Called by the game clock. Opens a cycle when one is due. */
  tickPayrollClock: (
    members: GangMember[],
    ownedBlocks: Block[],
    updateMember: (id: string, updates: Partial<GangMember>) => void,
    addNotification: (n: { type: string; title: string; message: string }) => void
  ) => void;

  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function buildLines(
  members: GangMember[],
  ownedBlocks: Block[],
  unpaidStreaks: Record<string, number>
): PayrollLine[] {
  // Map memberId → block via deployed units
  const memberBlock = new Map<string, Block>();
  for (const block of ownedBlocks) {
    for (const unit of block.units) {
      memberBlock.set(unit.gangMemberId, block);
    }
  }

  return members
    .filter((m) => m.status === 'active' || m.status === 'injured')
    .map((m) => {
      const block = memberBlock.get(m.id) ?? null;
      const unit = block?.units.find((u) => u.gangMemberId === m.id);
      // Prefer deployed unit type, then member's role field, then infer from skills
      const role: string = unit?.type ?? m.role ?? inferRole(m);
      return {
        memberId: m.id,
        memberName: m.name,
        nickname: m.nickname,
        role,
        level: m.level,
        wage: computeWage(role, m.level),
        blockId: block?.id ?? null,
        blockAddress: block?.geoBlock?.address ?? null,
        morale: m.morale,
        loyalty: m.loyalty,
        consecutiveUnpaidWeeks: unpaidStreaks[m.id] ?? 0,
        willPay: true,
      };
    });
}

function inferRole(m: GangMember): string {
  if (!m.skills || m.skills.length === 0) return 'enforcer';
  const top = [...m.skills].sort((a, b) => b.level - a.level)[0];
  switch (top?.category) {
    case 'dealing':   return 'dealer';
    case 'combat':    return 'shooter';
    case 'driving':   return 'driver';
    case 'stealth':   return 'lookout';
    default:          return 'enforcer';
  }
}

function avgMorale(members: GangMember[]): number {
  const active = members.filter(
    (m) => m.status === 'active' || m.status === 'injured'
  );
  if (active.length === 0) return 0;
  return active.reduce((sum, m) => sum + m.morale, 0) / active.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useShoeboxStore = create<ShoeboxStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        bankBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        ledger: [],
        currentCycle: null,
        cycleHistory: [],
        nextPayrollDueAt: null,
        unpaidStreaks: {},

        deposit: (amount, type, description, meta) => {
          if (amount <= 0) return;
          set((s) => {
            const balanceAfter = s.bankBalance + amount;
            const entry: ShoeboxEntry = {
              id: uid(),
              type,
              amount,
              balanceAfter,
              blockId: meta?.blockId,
              memberId: meta?.memberId,
              description,
              timestamp: new Date().toISOString(),
            };
            return {
              bankBalance: balanceAfter,
              totalDeposited: s.totalDeposited + amount,
              ledger: [entry, ...s.ledger].slice(0, LEDGER_CAP),
            };
          });
        },

        withdraw: (amount, type, description, meta) => {
          if (amount <= 0) return true;
          const { bankBalance } = get();
          if (bankBalance < amount) return false; // Shoebox first, no overdraft
          set((s) => {
            const balanceAfter = s.bankBalance - amount;
            const entry: ShoeboxEntry = {
              id: uid(),
              type,
              amount: -amount,
              balanceAfter,
              blockId: meta?.blockId,
              memberId: meta?.memberId,
              description,
              timestamp: new Date().toISOString(),
            };
            return {
              bankBalance: balanceAfter,
              totalWithdrawn: s.totalWithdrawn + amount,
              ledger: [entry, ...s.ledger].slice(0, LEDGER_CAP),
            };
          });
          return true;
        },

        canAfford: (amount) => get().bankBalance >= amount,

        openPayrollCycle: (members, ownedBlocks) => {
          const lines = buildLines(members, ownedBlocks, get().unpaidStreaks);
          const totalDue = lines.reduce((sum, l) => sum + l.wage, 0);
          const balance = get().bankBalance;
          const insufficient = balance < totalDue;

          const cycle: PayrollCycle = {
            id: uid(),
            cycleNumber: get().cycleHistory.length + 1,
            dueAt: new Date().toISOString(),
            lines,
            totalDue,
            shoeboxBalanceAtOpen: balance,
            insufficientFunds: insufficient,
            status: insufficient ? 'awaiting_selection' : 'pending',
            settledAt: null,
            result: null,
          };
          set({ currentCycle: cycle });
          return cycle;
        },

        getBlockPayrolls: (members, ownedBlocks) => {
          const lines = buildLines(members, ownedBlocks, get().unpaidStreaks);
          const byBlock = new Map<string, PayrollLine[]>();
          for (const line of lines) {
            if (!line.blockId) continue;
            byBlock.set(line.blockId, [
              ...(byBlock.get(line.blockId) ?? []),
              line,
            ]);
          }
          return ownedBlocks.map((block): BlockPayroll => {
            const blockLines = byBlock.get(block.id) ?? [];
            const weeklyCost = blockLines.reduce((sum, l) => sum + l.wage, 0);
            // incomePerTick is treated as hourly; 24h × 7 days = weekly
            const weeklyIncome = Math.round(block.incomePerTick * 24 * 7);
            return {
              blockId: block.id,
              blockAddress: block.geoBlock?.address ?? block.id,
              memberCount: blockLines.length,
              weeklyCost,
              weeklyIncome,
              netWeekly: weeklyIncome - weeklyCost,
              lines: blockLines,
            };
          });
        },

        setWillPay: (memberId, willPay) => {
          set((s) => {
            if (!s.currentCycle) return s;
            return {
              currentCycle: {
                ...s.currentCycle,
                lines: s.currentCycle.lines.map((l) =>
                  l.memberId === memberId ? { ...l, willPay } : l
                ),
              },
            };
          });
        },

        settlePayroll: (members, updateMember, addNotification) => {
          const cycle = get().currentCycle;
          if (!cycle || cycle.status === 'settled') return null;

          const toPay = cycle.lines.filter((l) => l.willPay);
          const toSkip = cycle.lines.filter((l) => !l.willPay);
          const payTotal = toPay.reduce((sum, l) => sum + l.wage, 0);

          // Guard: selection still exceeds funds → refuse, UI keeps modal open
          if (payTotal > get().bankBalance) return null;

          const gangMoraleBefore = avgMorale(members);
          const fallout: MoraleFallout[] = [];
          const newStreaks = { ...get().unpaidStreaks };

          // Pay the chosen — one ledger entry each so the books read clean
          for (const line of toPay) {
            get().withdraw(
              line.wage,
              'salary',
              `Payroll: ${line.nickname || line.memberName} (${line.role})`,
              { memberId: line.memberId, blockId: line.blockId ?? undefined }
            );
            newStreaks[line.memberId] = 0;
            const m = members.find((mm) => mm.id === line.memberId);
            if (m) {
              updateMember(m.id, {
                morale: Math.min(100, m.morale + PAID_MORALE_BONUS),
              });
            }
          }

          // Punish the skipped — individual hit drags the gang average down
          for (const line of toSkip) {
            const m = members.find((mm) => mm.id === line.memberId);
            if (!m) continue;
            const streak = (newStreaks[line.memberId] ?? 0) + 1;
            newStreaks[line.memberId] = streak;
            const moraleAfter = Math.max(0, m.morale - UNPAID_MORALE_HIT);
            // Loyalty hit stacks: each additional unpaid week hits harder
            const loyaltyAfter = Math.max(
              0,
              m.loyalty - UNPAID_LOYALTY_HIT * streak
            );
            updateMember(m.id, { morale: moraleAfter, loyalty: loyaltyAfter });
            fallout.push({
              memberId: m.id,
              memberName: m.nickname || m.name,
              moraleBefore: m.morale,
              moraleAfter,
              loyaltyBefore: m.loyalty,
              loyaltyAfter,
              atExitRisk: streak >= UNPAID_WEEKS_BEFORE_EXIT_RISK,
            });
          }

          const gangMoraleAfter = avgMorale(
            // Re-read updated members by applying the changes we just made
            members.map((m) => {
              const f = fallout.find((fl) => fl.memberId === m.id);
              if (f) return { ...m, morale: f.moraleAfter };
              const paid = toPay.find((l) => l.memberId === m.id);
              if (paid) return { ...m, morale: Math.min(100, m.morale + PAID_MORALE_BONUS) };
              return m;
            })
          );

          const result: PayrollResult = {
            paidMemberIds: toPay.map((l) => l.memberId),
            unpaidMemberIds: toSkip.map((l) => l.memberId),
            totalPaid: payTotal,
            moraleFallout: fallout,
            gangMoraleBefore,
            gangMoraleAfter,
          };

          const settled: PayrollCycle = {
            ...cycle,
            status: 'settled',
            settledAt: new Date().toISOString(),
            result,
          };

          set((s) => ({
            currentCycle: null,
            cycleHistory: [settled, ...s.cycleHistory].slice(0, 52),
            unpaidStreaks: newStreaks,
            nextPayrollDueAt: new Date(
              Date.now() + PAYROLL_CYCLE_MS
            ).toISOString(),
          }));

          if (toSkip.length > 0) {
            addNotification({
              type: 'warning',
              title: 'Payday came up short',
              message: `${toSkip.length} member${
                toSkip.length > 1 ? 's' : ''
              } didn't get paid. Gang morale ${gangMoraleBefore.toFixed(
                0
              )} → ${gangMoraleAfter.toFixed(0)}.`,
            });
          }

          return result;
        },

        tickPayrollClock: (members, ownedBlocks, updateMember, addNotification) => {
          const { nextPayrollDueAt, currentCycle } = get();
          // A cycle is already open/awaiting player selection — don't open another
          if (currentCycle) return;
          if (!nextPayrollDueAt) {
            set({
              nextPayrollDueAt: new Date(
                Date.now() + PAYROLL_CYCLE_MS
              ).toISOString(),
            });
            return;
          }
          if (Date.now() >= new Date(nextPayrollDueAt).getTime()) {
            const cycle = get().openPayrollCycle(members, ownedBlocks);
            // Fully funded? Auto-settle immediately. Short? UI takes over (PayrollModal).
            if (!cycle.insufficientFunds) {
              get().settlePayroll(members, updateMember, addNotification);
            }
          }
        },

        reset: () =>
          set({
            bankBalance: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            ledger: [],
            currentCycle: null,
            cycleHistory: [],
            nextPayrollDueAt: null,
            unpaidStreaks: {},
          }),
      }),
      { name: 'slide-shoebox' }
    ),
    { name: 'ShoeboxStore' }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS (use these in components for memoized access)
// ─────────────────────────────────────────────────────────────────────────────

export const selectShoeboxBalance = (s: ShoeboxStoreState) => s.bankBalance;
export const selectPayrollPending = (s: ShoeboxStoreState) =>
  s.currentCycle?.status === 'awaiting_selection';
export const selectSelectedPayTotal = (s: ShoeboxStoreState) =>
  s.currentCycle?.lines
    .filter((l) => l.willPay)
    .reduce((sum, l) => sum + l.wage, 0) ?? 0;
