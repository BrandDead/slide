import { create } from 'zustand';
import { useBlockStore } from './blockStore';
import { useGangStore, usePlayerStore } from './gameStore';
import { useDrugInventory } from './useDrugInventory';
import { createLoopState } from '../game/loop/blockLoopFixture';
import { reduceLoop, seededLoopEncounter } from '../game/loop/blockLoopEngine';
import { toLoopLedger, writeLoopLedger } from '../game/loop/blockLoopPersist';
import { BLOCK_LOOP_IDS, type LoopCommand, type LoopLedgerV1, type LoopState } from '../game/loop/blockLoopTypes';
import type { CombatResult } from '../game/combat/types';

function projectToStores(loop: LoopState) {
  useBlockStore.getState().upsertBlock({
    ...loop.block,
    appliedEncounterResultKeys: loop.appliedEncounterKeys,
  });
  useBlockStore.getState().selectBlock(loop.block.id);
  usePlayerStore.getState().updatePlayer({
    money: loop.money,
    heat: loop.playerHeat,
    reputation: loop.reputation,
  });
  const drugs = useDrugInventory.getState();
  const product = loop.inventory[0];
  if (product) {
    useDrugInventory.setState({
      inventory: { ...drugs.inventory, [product.id]: { ...product } },
      assignments: { ...loop.assignments },
    });
  } else {
    useDrugInventory.setState({ assignments: { ...loop.assignments } });
  }
  const gang = useGangStore.getState();
  for (const member of loop.members) {
    gang.updateMember(member.id, {
      health: member.health,
      morale: member.morale,
      currentAssignment: member.assignment,
    });
  }
  writeLoopLedger(toLoopLedger(loop));
}

interface BlockLoopStore {
  loop: LoopState;
  started: boolean;
  startLoop: (forceReset?: boolean) => void;
  hydrateFromLedger: (ledger: LoopLedgerV1) => void;
  dispatch: (command: LoopCommand) => void;
  selectCrew: (dealerId: string, shooterId: string) => void;
  place: (memberId: string, x: number, y: number) => void;
  assignProduct: () => void;
  runDeal: () => void;
  beginEncounter: () => void;
  resolveEncounter: (result: CombatResult, healthWrite?: 'ok' | 'failed') => void;
  resolveSeededEncounter: () => void;
  retryHealth: () => void;
  recover: (pay: boolean) => void;
  returnToDesktop: () => void;
}

export const useBlockLoopStore = create<BlockLoopStore>((set, get) => ({
  loop: createLoopState(),
  started: false,

  startLoop: (forceReset = false) => {
    if (!forceReset && get().started && get().loop.phase !== 'crew' && get().loop.phase !== 'returned') {
      return;
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
    const loop = forceReset
      ? { ...fresh, members, rejection: null }
      : { ...fresh, members, rejection: null };
    projectToStores(loop);
    set({ loop, started: true });
  },

  hydrateFromLedger: (ledger) => {
    const loop = reduceLoop(createLoopState(), { type: 'hydrate-ledger', ledger });
    projectToStores(loop);
    set({ loop, started: true });
  },

  dispatch: (command) => {
    const loop = reduceLoop(get().loop, command);
    if (!loop.rejection) {
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
  assignProduct: () => get().dispatch({
    type: 'assign-product',
    dealerId: get().loop.selectedDealerId ?? BLOCK_LOOP_IDS.dealerId,
    productId: BLOCK_LOOP_IDS.productId,
  }),
  runDeal: () => get().dispatch({ type: 'run-deal' }),
  beginEncounter: () => get().dispatch({ type: 'begin-encounter' }),
  resolveEncounter: (result, healthWrite) => get().dispatch({ type: 'apply-encounter', result, healthWrite }),
  resolveSeededEncounter: () => {
    const result = seededLoopEncounter(get().loop);
    get().resolveEncounter(result);
  },
  retryHealth: () => get().dispatch({ type: 'retry-health' }),
  recover: (pay) => get().dispatch({ type: 'recover', pay }),
  returnToDesktop: () => get().dispatch({ type: 'return-desktop' }),
}));
