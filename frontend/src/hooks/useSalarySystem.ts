// ============================================================
// useSalarySystem — Weekly gang member salary auto-deduction
// Checks every 60s if salary is due (7 days real-time).
// For testing, the interval is configurable via SALARY_INTERVAL_MS.
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore, useGangStore, useNotificationStore } from '../stores/gameStore';
import { MORALE_CONFIG } from '../utils/moraleSystem';

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

export function useSalarySystem() {
  const { player, updateMoney } = usePlayerStore();
  const { members, updateMember } = useGangStore();
  const { addNotification } = useNotificationStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nextPaymentIn, setNextPaymentIn] = useState('');
  const [totalWeeklySalary, setTotalWeeklySalary] = useState(0);
  const [canAfford, setCanAfford] = useState(true);

  const activeMembers = members.filter((m) => m.status === 'active');

  const processSalary = useCallback(() => {
    const now = Date.now();
    const lastPaid = parseInt(localStorage.getItem(LAST_SALARY_KEY) ?? '0', 10);
    const elapsed = now - lastPaid;

    if (elapsed < SALARY_INTERVAL_MS) return; // Not due yet

    const total = activeMembers.reduce(
      (sum, m) => sum + ((m as any).salary ?? 500),
      0
    );

    if (player.money >= total) {
      // Pay salaries
      updateMoney(-total);
      localStorage.setItem(LAST_SALARY_KEY, String(now));
      addNotification({
        id: `salary-${now}`,
        type: 'info',
        title: 'Salaries Paid',
        message: `Paid gang salaries: -$${total.toLocaleString()}`,
        timestamp: now,
        read: false,
      } as any);
    } else {
      // Can't afford — apply morale penalty
      for (const member of activeMembers) {
        const newMorale = Math.max(0, (member.morale ?? 75) + MORALE_CONFIG.SALARY_MISSED_PENALTY);
        updateMember(member.id, { morale: newMorale });
      }
      localStorage.setItem(LAST_SALARY_KEY, String(now)); // Reset timer even on failure
      addNotification({
        id: `salary-fail-${now}`,
        type: 'warning',
        title: 'MISSED PAYROLL',
        message: `Couldn't pay salaries ($${total.toLocaleString()}). Gang morale dropping!`,
        timestamp: now,
        read: false,
      } as any);
    }
  }, [activeMembers, player.money, updateMoney, updateMember, addNotification]);

  const updateDisplay = useCallback(() => {
    const now = Date.now();
    const lastPaid = parseInt(localStorage.getItem(LAST_SALARY_KEY) ?? '0', 10);
    const nextDue = lastPaid + SALARY_INTERVAL_MS;
    const remaining = nextDue - now;

    const total = activeMembers.reduce((sum, m) => sum + ((m as any).salary ?? 500), 0);
    setTotalWeeklySalary(total);
    setCanAfford(player.money >= total);
    setNextPaymentIn(formatTimeRemaining(remaining));

    processSalary();
  }, [activeMembers, player.money, processSalary]);

  useEffect(() => {
    updateDisplay();
    intervalRef.current = setInterval(updateDisplay, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateDisplay]);

  return { nextPaymentIn, totalWeeklySalary, canAfford };
}
