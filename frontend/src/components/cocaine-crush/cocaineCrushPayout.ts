// ============================================================
// SLIDE — Cocaine Crush session payout  (Sprint 13, Task 2)
// frontend/src/components/cocaine-crush/cocaineCrushPayout.ts
//
// Per-match economy (inventory deduction + cash) is already handled
// inside CocaineCrush.verifyAndApplyEconomy. What was missing is the
// SESSION-level tie-back: a corner that just moved product should show
// that on the block, so the territory loop and the shoebox agree about
// where money came from.
//
// Extracted so the wiring can be tested without driving an 8x8 board
// through a full match cascade.
// ============================================================

import { useBlockStore } from '../../stores/blockStore';

export interface SessionPayoutResult {
  blockId: string;
  /** pendingIncome on the block after the deposit. */
  pendingIncome: number;
  deposited: number;
}

/**
 * Add a finished session's takings to the selected block's pending income.
 *
 * Returns null — and deposits nothing — when there is no selected block or
 * the block is unknown. Grinding the minigame from a menu with no corner
 * selected still pays the player directly via updateMoney(); it just has no
 * territory to credit, and inventing one would put income on a block the
 * player may not hold.
 */
export function depositSessionEarnings(earnings: number): SessionPayoutResult | null {
  if (!Number.isFinite(earnings) || earnings <= 0) return null;

  const store = useBlockStore.getState();
  const blockId = store.selectedBlockId;
  if (!blockId) return null;

  const block = store.getBlock(blockId);
  if (!block) return null;

  const amount = Math.floor(earnings);
  const pendingIncome = block.pendingIncome + amount;

  store.upsertBlock({ ...block, pendingIncome });

  return { blockId, pendingIncome, deposited: amount };
}
