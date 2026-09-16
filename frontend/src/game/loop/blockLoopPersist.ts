import { BLOCK_LOOP_LEDGER_KEY, type LoopLedgerV1, type LoopState } from './blockLoopTypes';

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

export function clearLoopLedger(
  storage: Pick<Storage, 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  storage?.removeItem(BLOCK_LOOP_LEDGER_KEY);
}
