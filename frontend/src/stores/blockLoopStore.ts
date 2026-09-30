import { create } from 'zustand';
import { useBlockStore } from './blockStore';
import { useGangStore, usePlayerStore } from './gameStore';
import { useDrugInventory, type CraftedDrug } from './useDrugInventory';
import {
  pendingRivalAttacks,
  rivalAttackReceiptKey,
  useGhostStore,
  type GhostStoreState,
} from './ghostCrewStore';
import { BLOCK_LOOP_PRODUCT, createLoopState } from '../game/loop/blockLoopFixture';
import {
  loopBlockLabel,
  reduceLoop,
  retreatLoopEncounter,
  seededLoopEncounter,
} from '../game/loop/blockLoopEngine';
import {
  canUseDemoLoopLedger,
  toLoopLedger,
  writeDemoLoopLedger,
  readDemoLoopLedger,
} from '../game/loop/blockLoopPersist';
import {
  BLOCK_LOOP_IDS,
  type LoopCommand,
  type LoopLedgerV1,
  type LoopState,
  type RivalIncident,
} from '../game/loop/blockLoopTypes';
import type { CombatResult } from '../game/combat/types';

function projectToStores(loop: LoopState) {
  const playerId = usePlayerStore.getState().player.id;
  if (!canUseDemoLoopLedger(playerId)) return;

  useBlockStore.getState().upsertBlock({
    ...loop.block,
    appliedEncounterResultKeys: [...new Set([...(loop.block.appliedEncounterResultKeys ?? []), ...loop.appliedEncounterKeys])],
  });
  useBlockStore.getState().selectBlock(loop.block.id);
  usePlayerStore.getState().updatePlayer({
    money: loop.money,
    heat: loop.playerHeat,
    reputation: loop.reputation,
  });
  const drugs = useDrugInventory.getState();
  const stash = { ...drugs.inventory };
  for (const item of loop.inventory) stash[item.id] = { ...item };
  useDrugInventory.setState({
    inventory: stash,
    assignments: { ...loop.assignments },
  });
  const gang = useGangStore.getState();
  for (const member of loop.members) {
    gang.updateMember(member.id, {
      health: member.health,
      morale: member.morale,
      currentAssignment: member.assignment,
    });
  }
  writeDemoLoopLedger(playerId, toLoopLedger(loop));
}

/**
 * The newest unanswered Ghost Crew attack on the Strip block, if any. Read
 * from the existing Ghost Crew feed; the store's response receipts decide
 * whether it is still open.
 */
export function findPendingRivalIncident(
  blockId: string = BLOCK_LOOP_IDS.blockId,
  ghost: Pick<GhostStoreState, 'feed' | 'appliedResponseKeys' | 'crews'> = useGhostStore.getState(),
): RivalIncident | null {
  const [event] = pendingRivalAttacks(ghost.feed, blockId, ghost.appliedResponseKeys ?? []);
  if (!event) return null;
  return {
    receiptKey: rivalAttackReceiptKey(event),
    eventId: event.id,
    crewId: event.crewId,
    crewName: ghost.crews[event.crewId]?.name ?? event.crewName,
    description: event.description,
    occurredAt: event.timestamp,
  };
}

/** Close the rival's attack once, after the Strip books the encounter. */
function settleRivalAttack(previous: LoopState, next: LoopState) {
  const resolution = next.rivalResolution;
  if (!resolution || previous.rivalResolution || !next.rivalIncident) return;
  if (!canUseDemoLoopLedger(usePlayerStore.getState().player.id)) return;
  useGhostStore.getState().resolveRivalAttack({
    crewId: resolution.crewId,
    crewName: resolution.crewName,
    blockId: next.block.id,
    blockLabel: loopBlockLabel(next),
    receiptKey: resolution.receiptKey,
    outcome: resolution.outcome,
    attackOccurredAt: next.rivalIncident.occurredAt,
  });
}

/**
 * The Strip's stash as the rest of the game sees it: River Cut first, then
 * anything cooked in the lab (or otherwise stocked) that still has quantity.
 */
export function stashForLoop(loop: Pick<LoopState, 'inventory'>): CraftedDrug[] {
  const drugs = useDrugInventory.getState().inventory;
  const riverCut = drugs[BLOCK_LOOP_IDS.productId]
    ?? { ...(loop.inventory.find((item) => item.id === BLOCK_LOOP_IDS.productId) ?? BLOCK_LOOP_PRODUCT), quantity: 0 };
  const others = Object.values(drugs)
    .filter((item) => item.id !== BLOCK_LOOP_IDS.productId && item.quantity > 0);
  return [{ ...riverCut }, ...others.map((item) => ({ ...item }))];
}

/**
 * Other apps (DEALT, the lab, bail and hospital) move the same cash, heat,
 * reputation, and stash. Read them back before each Strip command so the
 * Strip never overwrites progress made elsewhere.
 */
function withSharedBooks(loop: LoopState): LoopState {
  const player = usePlayerStore.getState().player;
  if (!canUseDemoLoopLedger(player.id)) return loop;
  const block = useBlockStore.getState().blocks[loop.block.id];
  const cash = Math.round(player.money);
  return {
    ...loop,
    // Heat decays continuously elsewhere; the Strip books whole points.
    money: cash,
    playerHeat: Math.round(player.heat),
    reputation: player.reputation,
    inventory: stashForLoop(loop),
    assignments: { ...useDrugInventory.getState().assignments },
    block: block ?? loop.block,
    recovery: loop.recovery ? { ...loop.recovery, affordable: cash >= loop.recovery.cost } : null,
  };
}

interface BlockLoopStore {
  loop: LoopState;
  started: boolean;
  startLoop: (forceReset?: boolean) => void;
  hydrateFromLedger: (ledger: LoopLedgerV1) => void;
  dispatch: (command: LoopCommand) => void;
  /** Refresh the demo projection for display without writing shared state. */
  syncSharedBooks: () => void;
  selectCrew: (dealerId: string, shooterId: string) => void;
  place: (memberId: string, x: number, y: number) => void;
  assignProduct: (productId?: string) => void;
  runDeal: () => void;
  beginEncounter: () => void;
  resolveEncounter: (result: CombatResult, healthWrite?: 'ok' | 'failed') => void;
  resolveSeededEncounter: () => void;
  /** Back off the board: books a retreat instead of a wound. */
  retreatEncounter: () => void;
  nextShift: () => void;
  reUp: () => void;
  retryHealth: () => void;
  recover: (pay: boolean) => void;
  returnToDesktop: () => void;
}

export const useBlockLoopStore = create<BlockLoopStore>((set, get) => ({
  loop: createLoopState(),
  started: false,

  startLoop: (forceReset = false) => {
    if (!forceReset) {
      if (get().started) return;
      const existing = readDemoLoopLedger(usePlayerStore.getState().player.id);
      if (existing && (existing.dealKey || existing.encounterKey || existing.appliedEncounterKeys.length)) {
        get().hydrateFromLedger(existing);
        return;
      }
    }
    const fresh = createLoopState();
    const gang = useGangStore.getState().members;
    const members = fresh.members.map((member) => {
      const live = gang.find((item) => item.id === member.id);
      return live
        ? {
            ...member,
            health: live.health ?? member.health,
            morale: live.morale ?? member.morale,
            name: live.name,
            level: live.level ?? member.level,
          }
        : member;
    });
    const loop = { ...fresh, members, rejection: null };
    projectToStores(loop);
    set({ loop, started: true });
  },

  hydrateFromLedger: (ledger) => {
    const loop = reduceLoop(createLoopState(), { type: 'hydrate-ledger', ledger });
    projectToStores(loop);
    set({ loop, started: true });
  },

  syncSharedBooks: () => {
    const current = get().loop;
    const loop = withSharedBooks(current);
    if (loop !== current) set({ loop });
  },

  dispatch: (command) => {
    const previous = command.type === 'hydrate-ledger' ? get().loop : withSharedBooks(get().loop);
    const loop = reduceLoop(previous, command);
    if (!loop.rejection) {
      settleRivalAttack(previous, loop);
      if (command.type === 'place') {
        const placement = loop.block.placements.find((item) => item.memberId === command.memberId);
        if (placement) {
          useBlockStore.getState().placeMember(loop.block.id, placement);
          const live = useBlockStore.getState().blocks[loop.block.id];
          if (live) {
            const synced = { ...loop, block: live };
            projectToStores(synced);
            set({ loop: synced });
            return;
          }
        }
      }
      if (command.type === 'apply-encounter' && command.healthWrite !== 'failed') {
        useBlockStore.getState().applyEncounterResult(loop.block.id, command.result);
        const live = useBlockStore.getState().blocks[loop.block.id];
        const synced = live ? { ...loop, block: { ...loop.block, ...live, placements: live.placements } } : loop;
        projectToStores(synced);
        set({ loop: synced });
        return;
      }
    }
    if (!loop.rejection) projectToStores(loop);
    set({ loop });
  },

  selectCrew: (dealerId, shooterId) => get().dispatch({ type: 'select-crew', dealerId, shooterId }),
  place: (memberId, x, y) => get().dispatch({ type: 'place', memberId, x, y }),
  assignProduct: (productId = BLOCK_LOOP_IDS.productId) => get().dispatch({
    type: 'assign-product',
    dealerId: get().loop.selectedDealerId ?? BLOCK_LOOP_IDS.dealerId,
    productId,
  }),
  runDeal: () => get().dispatch({
    type: 'run-deal',
    rivalIncident: findPendingRivalIncident(get().loop.block.id),
  }),
  beginEncounter: () => get().dispatch({ type: 'begin-encounter' }),
  resolveEncounter: (result, healthWrite) => get().dispatch({ type: 'apply-encounter', result, healthWrite }),
  resolveSeededEncounter: () => {
    const result = seededLoopEncounter(get().loop);
    get().resolveEncounter(result);
  },
  retreatEncounter: () => {
    get().resolveEncounter(retreatLoopEncounter(get().loop));
  },
  nextShift: () => get().dispatch({ type: 'next-shift' }),
  reUp: () => get().dispatch({ type: 're-up' }),
  retryHealth: () => get().dispatch({ type: 'retry-health' }),
  recover: (pay) => get().dispatch({ type: 'recover', pay }),
  returnToDesktop: () => get().dispatch({ type: 'return-desktop' }),
}));
