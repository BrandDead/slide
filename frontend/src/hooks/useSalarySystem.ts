// ============================================================
// useSalarySystem — Weekly gang member salary system
//
// Pillar 1 upgrade:
//   - Runs the payroll clock via useShoeboxStore
//   - Routes dealer block income into the Shoebox (bankBalance)
//   - Exposes payroll cycle state for PayrollModal
//   - Tracks unpaid streaks with stacking loyalty hits
//   - Syncs bankBalance changes back to usePlayerStore for Shoebox UI
//
// MIGRATION NOTE for existing call sites:
//   ANY code doing `player.money += x` or `updateMoney(x)` for income:
//     useShoeboxStore.getState().deposit(x, 'deal_income', 'DEALT swipe sale')
//   ANY purchase doing `player.money -= x`:
//     const ok = useShoeboxStore.getState().withdraw(x, 'purchase', 'AK-47 from market')
//     if (!ok) → show "Shoebox can't cover it" toast, block the purchase.
// ============================================================

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePlayerStore, useGangStore, useNotificationStore } from '../stores/gameStore';
import { useBlockStore } from '../stores/blockStore';
import { useShoeboxStore } from '../stores/useShoeboxStore';
import type { BlockPayroll, PayrollLine } from '../types/economy.types';

/** How often the game clock ticks (income + payroll checks), ms. */
const CLOCK_TICK_MS = 5_000;

/** Income tick cadence: block.incomePerTick is treated as hourly; we pro-rate. */
const INCOME_TICKS_PER_HOUR = 3_600_000 / CLOCK_TICK_MS;

/** Legacy localStorage key kept for backward compat (no longer used for timing). */
const LAST_SALARY_KEY = 'dealt_last_salary_paid';

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Due now';
  const days    = Math.floor(ms / 86400000);
  const hours   = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Legacy summary type kept for backward compat with any existing consumers. */
export interface BlockPayrollSummary {
  blockId: string;
  address: string;
  memberCount: number;
  weeklyPayroll: number;
}

export function useSalarySystem() {
  const { player, updatePlayer } = usePlayerStore();
  const { members, updateMember } = useGangStore();
  const { addNotification } = useNotificationStore();
  const { blocks } = useBlockStore();

  const bankBalance    = useShoeboxStore((s) => s.bankBalance);
  const currentCycle   = useShoeboxStore((s) => s.currentCycle);
  const deposit        = useShoeboxStore((s) => s.deposit);
  const setWillPay     = useShoeboxStore((s) => s.setWillPay);
  const settlePayroll  = useShoeboxStore((s) => s.settlePayroll);
  const getBlockPayrolls = useShoeboxStore((s) => s.getBlockPayrolls);
  const tickPayrollClock = useShoeboxStore((s) => s.tickPayrollClock);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nextPaymentIn, setNextPaymentIn] = useState('');
  const [totalWeeklySalary, setTotalWeeklySalary] = useState(0);
  const [canAfford, setCanAfford] = useState(true);

  // ── Sync Shoebox bankBalance → player.bankBalance for legacy Shoebox UI ──
  useEffect(() => {
    if (bankBalance !== player.bankBalance) {
      updatePlayer({ bankBalance });
    }
  }, [bankBalance, player.bankBalance, updatePlayer]);

  // ── Seed Shoebox from player.bankBalance on first mount (migration) ──────
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && player.bankBalance > 0 && bankBalance === 0) {
      useShoeboxStore.getState().deposit(
        player.bankBalance,
        'block_income',
        'Initial Shoebox seed from player balance'
      );
    }
    seeded.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Game clock: income generation + payroll due check ────────────────────
  useEffect(() => {
    const tick = () => {
      // 1. Dealers on blocks generate money → straight into the Shoebox.
      for (const [blockId, block] of Object.entries(blocks)) {
        if (!block || (block as any).owner !== 'player') continue;
        const placements = (block as any).placements ?? [];
        const hasActiveDealer = placements.some(
          (p: any) => p.role === 'dealer' || p.type === 'dealer'
        );
        const incomePerTick = (block as any).incomePerTick ?? 0;
        if (!hasActiveDealer || incomePerTick <= 0) continue;
        const proRated = incomePerTick / INCOME_TICKS_PER_HOUR;
        if (proRated >= 1) {
          deposit(
            Math.round(proRated),
            'block_income',
            `Block income: ${(block as any).address ?? blockId}`,
            { blockId }
          );
        }
      }

      // 2. Payroll clock — opens a cycle when the week is up.
      tickPayrollClock(members, [], updateMember, (n) =>
        addNotification({ type: n.type as any, title: n.title, message: n.message })
      );
    };

    intervalRef.current = setInterval(tick, CLOCK_TICK_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, members]);

  // ── Display state (countdown + affordability) ────────────────────────────
  useEffect(() => {
    const update = () => {
      const nextDueAt = useShoeboxStore.getState().nextPayrollDueAt;
      const remaining = nextDueAt
        ? new Date(nextDueAt).getTime() - Date.now()
        : 0;
      setNextPaymentIn(formatTimeRemaining(remaining));

      const total = members
        .filter((m) => m.status === 'active')
        .reduce((sum, m) => {
          const { computeWage } = require('../config/wages');
          return sum + computeWage(m.role, m.level);
        }, 0);
      setTotalWeeklySalary(total);
      setCanAfford(bankBalance >= total);
    };

    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [members, bankBalance]);

  // ── Payroll modal state ───────────────────────────────────────────────────
  const payrollDue = currentCycle?.status === 'awaiting_selection';
  const payrollLines: PayrollLine[] = currentCycle?.lines ?? [];
  const totalDue = currentCycle?.totalDue ?? 0;
  const selectedTotal = payrollLines
    .filter((l) => l.willPay)
    .reduce((s, l) => s + l.wage, 0);
  const selectionAffordable = selectedTotal <= bankBalance;

  const togglePay = useCallback(
    (memberId: string) => {
      const line = useShoeboxStore
        .getState()
        .currentCycle?.lines.find((l) => l.memberId === memberId);
      if (line) setWillPay(memberId, !line.willPay);
    },
    [setWillPay]
  );

  const confirmPayroll = useCallback(() => {
    if (!selectionAffordable) return null;
    return settlePayroll(members, updateMember, (n) =>
      addNotification({ type: n.type as any, title: n.title, message: n.message })
    );
  }, [selectionAffordable, settlePayroll, members, updateMember, addNotification]);

  // ── Legacy blockPayrolls summary (backward compat) ───────────────────────
  const blockPayrolls: BlockPayrollSummary[] = useMemo(() => {
    const summaries: BlockPayrollSummary[] = [];
    for (const [blockId, block] of Object.entries(blocks)) {
      if (!block || (block as any).owner !== 'player') continue;
      const placements = (block as any).placements ?? [];
      if (placements.length === 0) continue;
      const { calculatePerBlockPayroll } = require('../config/wages');
      summaries.push({
        blockId,
        address: (block as any).address ?? blockId,
        memberCount: placements.length,
        weeklyPayroll: calculatePerBlockPayroll(placements),
      });
    }
    return summaries;
  }, [blocks]);

  return {
    // Legacy returns (backward compat)
    nextPaymentIn,
    totalWeeklySalary,
    canAfford,
    blockPayrolls,

    // New Pillar 1 returns
    bankBalance,
    payrollDue,
    payrollLines,
    totalDue,
    selectedTotal,
    selectionAffordable,
    togglePay,
    confirmPayroll,
    depositToShoebox: deposit,
  };
}
