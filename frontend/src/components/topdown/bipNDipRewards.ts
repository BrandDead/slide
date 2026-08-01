// ============================================================
// SLIDE — Bip N Dip reward application  (Sprint 13, Task 1)
// frontend/src/components/topdown/bipNDipRewards.ts
//
// bipNDipEngine is deliberately pure — it never imports a store, which
// is why it is testable without a React tree. This module is the one
// place that translates a finished session into game state.
// ============================================================

import {
  usePlayerStore,
  useGangStore,
  useEconomyStore,
} from '../../stores/gameStore';
import {
  calculateTotalLootValue,
  type BipNDipSession,
  type LootItem,
} from '../../utils/bipNDipEngine';

export interface BipRewardSummary {
  cash: number;
  xp: number;
  itemsBanked: LootItem[];
  jailed: boolean;
}

/** Cash-type loot is spendable directly; everything else is an object. */
function isCash(item: LootItem): boolean {
  return item.type === 'cash';
}

/**
 * Loot types map onto inventory types. `jewelry` and `valuable` have no
 * inventory equivalent, so they are fenced on the spot and paid out as
 * cash rather than being silently dropped.
 */
function inventoryTypeFor(item: LootItem): 'drug' | 'weapon' | null {
  if (item.type === 'drug') return 'drug';
  if (item.type === 'weapon') return 'weapon';
  return null;
}

/** Fence rate for goods with no inventory slot. Below face value on purpose. */
export const FENCE_RATE = 0.6;

/**
 * Apply a finished session to the stores.
 *
 * Safe to call once per session only — it mutates balances. The caller
 * is expected to guard re-entry (BipNDipGame does this with a ref).
 */
export function applyBipRewards(
  session: BipNDipSession,
  memberId?: string,
): BipRewardSummary {
  const jailed = session.phase === 'arrested';

  // finalizeSession already stripped loot on an arrest, but callers can
  // hand us a raw session, so do not trust the array to already be empty.
  const loot = jailed ? [] : session.lootCollected;

  let cash = 0;
  const itemsBanked: LootItem[] = [];

  for (const item of loot) {
    if (isCash(item)) {
      cash += item.value;
      continue;
    }
    const invType = inventoryTypeFor(item);
    if (!invType) {
      cash += Math.floor(item.value * FENCE_RATE);
      continue;
    }
    itemsBanked.push(item);
  }

  if (cash > 0) usePlayerStore.getState().updateMoney(cash);

  const economy = useEconomyStore.getState();
  for (const item of itemsBanked) {
    economy.addInventoryItem({
      id: item.id,
      itemId: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      type: inventoryTypeFor(item) as 'drug' | 'weapon',
      name: item.name,
      quantity: 1,
      value: item.value,
      acquiredAt: new Date().toISOString(),
    } as Parameters<typeof economy.addInventoryItem>[0]);
  }

  const xp = session.xpEarned;
  const gang = useGangStore.getState();

  if (memberId) {
    if (jailed) {
      gang.jailMember(memberId);
    } else if (xp > 0) {
      const member = gang.members.find((m) => m.id === memberId);
      if (member) {
        gang.updateMember(memberId, {
          experience: (member.experience ?? 0) + xp,
          xp: (member.xp ?? member.experience ?? 0) + xp,
        });
      }
    }
  }

  // Player XP tracks crew XP so the account level moves with the crew.
  if (!jailed && xp > 0) usePlayerStore.getState().addXP(xp);

  return { cash, xp, itemsBanked, jailed };
}

/** Display helper — face value of what a session is holding right now. */
export function pendingLootValue(session: BipNDipSession): number {
  return calculateTotalLootValue(session.lootCollected);
}
