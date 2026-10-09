import { create } from 'zustand';
import type { DriveByTarget } from '../utils/driveByTarget';
import type { BlockData, BlockPlacement } from '../types/block.types';
import type { GangMember } from '../types/game.types';
import { getEncounterPlacements, useBlockStore } from './blockStore';
import { useGangStore } from './gameStore';

/** The same confirmed roster used by prepareEncounter, never a preview scout. */
export function getBlockResponseReadiness(block: BlockData | undefined, members: GangMember[]): {
  canLaunch: boolean; crew: BlockPlacement[]; reason: string;
} {
  if (!block || block.owner !== 'player') {
    return { canLaunch: false, crew: [], reason: 'Choose one of your claimed blocks. Rival takeovers are not available yet.' };
  }
  const crew = getEncounterPlacements(block);
  const memberIds = new Set<string>();
  const cells = new Set<string>();
  for (const placement of crew) {
    const member = members.find(candidate => candidate.id === placement.memberId);
    const cell = `${placement.x}:${placement.y}`;
    if (!member || member.role !== placement.role || memberIds.has(placement.memberId) || cells.has(cell)
      || !block.grid[placement.y]?.[placement.x]?.passable
      || (placement.health > 0 && (member.status !== 'active' || (member.health ?? placement.health) <= 0))) {
      return { canLaunch: false, crew, reason: 'Crew changed or placement is unavailable. Review your crew and positions before responding.' };
    }
    memberIds.add(placement.memberId);
    cells.add(cell);
  }
  if (!crew.some(placement => placement.health > 0 && ['shooter', 'enforcer', 'boss'].includes(placement.role))) {
    return { canLaunch: false, crew, reason: 'Position an active shooter or enforcer on this block before responding.' };
  }
  return { canLaunch: true, crew, reason: 'Your confirmed positions, cover and crew condition carry into this fight.' };
}

interface CombatIntentState {
  pendingTarget: DriveByTarget | null;
  /** Ghost crew that owns the pending target block, when known (#81). */
  targetCrewId: string | null;
  /** Ephemeral navigation intent only. Block/crew state remains in existing stores. */
  pendingEncounterBlockId: string | null;
  queueBlockResponse: (blockId: string) => boolean;
  consumeBlockResponse: () => string | null;
  setPendingTarget: (target: DriveByTarget | null, targetCrewId?: string | null) => void;
  consumePendingTarget: () => DriveByTarget | null;
  reset: () => void;
}

export const useCombatIntentStore = create<CombatIntentState>((set, get) => ({
  pendingTarget: null,
  targetCrewId: null,
  pendingEncounterBlockId: null,
  queueBlockResponse: blockId => {
    if (get().pendingEncounterBlockId) return false;
    const { blocks, selectBlock } = useBlockStore.getState();
    if (!getBlockResponseReadiness(blocks[blockId], useGangStore.getState().members).canLaunch) return false;
    selectBlock(blockId);
    set({ pendingEncounterBlockId: blockId });
    return true;
  },
  consumeBlockResponse: () => {
    const blockId = get().pendingEncounterBlockId;
    set({ pendingEncounterBlockId: null });
    if (!blockId || !getBlockResponseReadiness(useBlockStore.getState().blocks[blockId], useGangStore.getState().members).canLaunch) return null;
    useBlockStore.getState().selectBlock(blockId);
    return blockId;
  },
  setPendingTarget: (target, targetCrewId = null) =>
    set({ pendingTarget: target, targetCrewId }),
  consumePendingTarget: () => {
    const target = get().pendingTarget;
    set({ pendingTarget: null });
    return target;
  },
  reset: () => set({ pendingTarget: null, targetCrewId: null, pendingEncounterBlockId: null }),
}));
