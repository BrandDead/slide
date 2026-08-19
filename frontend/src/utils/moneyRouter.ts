import type { TransactionType } from '../types/game.types';
import { usePlayerStore } from '../stores/gameStore';
import { useShoeboxStore } from '../stores/useShoeboxStore';

/**
 * Vault-first money router.
 *
 * Street cash (`player.money`) is raidable walking-around money.
 * The Shoebox (`useShoeboxStore.bankBalance`) is the gang vault and payroll source.
 */
export function vaultBalance(): number {
  return useShoeboxStore.getState().bankBalance;
}

export function streetCash(): number {
  return usePlayerStore.getState().player.money ?? 0;
}

export function totalLiquid(): number {
  return vaultBalance() + streetCash();
}

export function vaultDeposit(
  amount: number,
  type: TransactionType,
  description: string,
  meta?: { blockId?: string; memberId?: string },
): void {
  if (amount <= 0) return;
  useShoeboxStore.getState().deposit(amount, type, description, meta);
}

export function vaultSpend(
  amount: number,
  type: TransactionType,
  description: string,
  meta?: { blockId?: string; memberId?: string },
): boolean {
  if (amount <= 0) return true;
  return useShoeboxStore.getState().withdraw(amount, type, description, meta);
}

/** Move street cash into the vault. Returns false if street is short. */
export function stashStreetCash(amount: number): boolean {
  if (amount <= 0) return true;
  const player = usePlayerStore.getState().player;
  if ((player.money ?? 0) < amount) return false;
  usePlayerStore.getState().updateMoney(-amount);
  vaultDeposit(amount, 'launder', `Stashed ${amount.toLocaleString()} in the shoebox`);
  return true;
}

/** Pull vault cash onto the street. Returns false if the vault is short. */
export function pullStreetCash(amount: number): boolean {
  if (amount <= 0) return true;
  const ok = vaultSpend(amount, 'purchase', `Pulled ${amount.toLocaleString()} onto the street`);
  if (!ok) return false;
  usePlayerStore.getState().updateMoney(amount);
  return true;
}
