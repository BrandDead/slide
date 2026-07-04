// ============================================================
// useSalarySystem — Weekly gang member salary auto-deduction
// REFACTORED: Role-based wages, draws from Shoebox (bankBalance),
// selective non-payment (pays who it can afford, penalizes the rest).
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore, useGangStore, useNotificationStore } from '../stores/gameStore';
import { useBlockStore } from '../stores/blockStore';
import { MORALE_CONFIG } from '../utils/moraleSystem';
import { getWageForRole, calculatePerBlockPayroll } from '../config/wages';

// In production: 7 days = 604800000ms
// For testing: 10 minutes = 600000ms
const SALARY_INTERVAL_MS = parseInt(
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SALARY_INTERVAL_MS) ?? '604800000',
  10
);

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nextPaymentIn, setNextPaymentIn] = useState('');
  const [totalWeeklySalary, setTotalWeeklySalary] = useState(0);
  const [canAfford, setCanAfford] = useState(true);
  const [blockPayrolls, setBlockPayrolls] = useState<BlockPayrollSummary[]>([]);

  const activeMembers = members.filter((m) => m.status === 'active');

  // Calculate per-block payroll summaries
  const computeBlockPayrolls = useCallback((): BlockPayrollSummary[] => {
    const summaries: BlockPayrollSummary[] = [];
    for (const [blockId, block] of Object.entries(blocks)) {
      if (!block || (block as any).owner !== 'player') continue;
      const placements = (block as any).placements ?? [];
      if (placements.length === 0) continue;
      summaries.push({
        blockId,
        address: (block as any).address ?? blockId,
        memberCount: placements.length,
        weeklyPayroll: calculatePerBlockPayroll(placements),
      });
    }
    return summaries;
  }, [blocks]);

  const processSalary = useCallback(() => {
    const now = Date.now();
    const lastPaid = parseInt(localStorage.getItem(LAST_SALARY_KEY) ?? '0', 10);
    const elapsed = now - lastPaid;

    if (elapsed < SALARY_INTERVAL_MS) return; // Not due yet

    // Calculate total using role-based wages
    const memberWages = activeMembers.map((m) => ({
      id: m.id,
      name: m.name,
      wage: getWageForRole(m.role),
    }));
    const total = memberWages.reduce((sum, mw) => sum + mw.wage, 0);

    // Draw from Shoebox (bankBalance)
    const shoebox = player.bankBalance ?? 0;

    if (shoebox >= total) {
      // Full payment from Shoebox
      updatePlayer({ bankBalance: shoebox - total });
      localStorage.setItem(LAST_SALARY_KEY, String(now));
      addNotification({
        type: 'info',
        title: 'Salaries Paid',
        message: `Paid gang salaries from Shoebox: -$${total.toLocaleString()}`,
      });
    } else {
      // SELECTIVE NON-PAYMENT: pay who we can afford, penalize the rest
      let remaining = shoebox;
      const paid: string[] = [];
      const unpaid: string[] = [];

      // Sort by wage ascending (pay cheapest first to maximize who gets paid)
      const sorted = [...memberWages].sort((a, b) => a.wage - b.wage);

      for (const mw of sorted) {
        if (remaining >= mw.wage) {
          remaining -= mw.wage;
          paid.push(mw.name);
        } else {
          unpaid.push(mw.name);
          // Apply morale penalty to this specific unpaid member
          const member = activeMembers.find((m) => m.id === mw.id);
          if (member) {
            const newMorale = Math.max(0, (member.morale ?? 75) + MORALE_CONFIG.SALARY_MISSED_PENALTY);
            updateMember(mw.id, { morale: newMorale });
          }
        }
      }

      // Deduct what we could afford
      updatePlayer({ bankBalance: remaining });
      localStorage.setItem(LAST_SALARY_KEY, String(now));

      addNotification({
        type: 'warning',
        title: 'PARTIAL PAYROLL',
        message: `Paid ${paid.length} member(s). ${unpaid.length} unpaid — morale dropping! (${unpaid.slice(0, 3).join(', ')}${unpaid.length > 3 ? '...' : ''})`,
      });
    }
  }, [activeMembers, player.bankBalance, updatePlayer, updateMember, addNotification]);

  const updateDisplay = useCallback(() => {
    const now = Date.now();
    const lastPaid = parseInt(localStorage.getItem(LAST_SALARY_KEY) ?? '0', 10);
    const nextDue = lastPaid + SALARY_INTERVAL_MS;
    const remaining = nextDue - now;

    const total = activeMembers.reduce((sum, m) => sum + getWageForRole(m.role), 0);
    setTotalWeeklySalary(total);
    setCanAfford((player.bankBalance ?? 0) >= total);
    setNextPaymentIn(formatTimeRemaining(remaining));
    setBlockPayrolls(computeBlockPayrolls());

    processSalary();
  }, [activeMembers, player.bankBalance, processSalary, computeBlockPayrolls]);

  useEffect(() => {
    updateDisplay();
    intervalRef.current = setInterval(updateDisplay, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateDisplay]);

  return { nextPaymentIn, totalWeeklySalary, canAfford, blockPayrolls };
}
