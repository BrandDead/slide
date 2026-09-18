import { BLOCK_LOOP_LEDGER_KEY, type LoopLedgerV1, type LoopState } from './blockLoopTypes';

/**
 * The Block Loop ledger is a closed-beta demo convenience, not an
 * authenticated save format. Keep it unavailable to real accounts so a
 * previous browser demo cannot restore its cash, injuries, or receipts over a
 * server-backed session.
 */
export const DEMO_LOOP_LEDGER_OWNER_ID = 'demo-player';

export function canUseDemoLoopLedger(playerId: string | null | undefined): boolean {
  return playerId === DEMO_LOOP_LEDGER_OWNER_ID;
}

export function toLoopLedger(state: LoopState): LoopLedgerV1 {
  const product = state.inventory[0];
  return {
    version: 1,
    phase: state.phase,
    money: state.money,
    playerHeat: state.playerHeat,
    reputation: state.reputation,
    blockHeat: state.block.heat,
    blockMorale: state.block.morale,
    pendingIncome: state.block.pendingIncome,
    productQuantity: product?.quantity ?? 0,
    assignments: { ...state.assignments },
    placements: state.block.placements.map((placement) => ({ ...placement })),
    appliedEncounterKeys: [...state.appliedEncounterKeys],
    economyKeys: [...state.economyKeys],
    dealKey: state.lastDeal?.key ?? null,
    encounterKey: state.lastEncounter?.idempotencyKey ?? null,
    lastDeal: state.lastDeal ? { ...state.lastDeal } : null,
    lastEncounter: state.lastEncounter ? { ...state.lastEncounter } : null,
    selectedDealerId: state.selectedDealerId,
    selectedShooterId: state.selectedShooterId,
    briefing: [...state.briefing],
    threatRoute: state.threat?.route ?? null,
    pendingHealthIds: [...state.pendingHealthIds],
    recovery: state.recovery ? { ...state.recovery } : null,
  };
}

export function readLoopLedger(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): LoopLedgerV1 | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(BLOCK_LOOP_LEDGER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoopLedgerV1;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLoopLedger(
  ledger: LoopLedgerV1,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  if (!storage) return;
  storage.setItem(BLOCK_LOOP_LEDGER_KEY, JSON.stringify(ledger));
}

export function readDemoLoopLedger(
  playerId: string | null | undefined,
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): LoopLedgerV1 | null {
  return canUseDemoLoopLedger(playerId) ? readLoopLedger(storage) : null;
}

export function writeDemoLoopLedger(
  playerId: string | null | undefined,
  ledger: LoopLedgerV1,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): boolean {
  if (!canUseDemoLoopLedger(playerId)) return false;
  writeLoopLedger(ledger, storage);
  return true;
}

export function clearLoopLedger(
  storage: Pick<Storage, 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  storage?.removeItem(BLOCK_LOOP_LEDGER_KEY);
}
