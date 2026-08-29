import { create } from 'zustand';
import type { DriveByTarget } from '../utils/driveByTarget';

interface CombatIntentState {
  pendingTarget: DriveByTarget | null;
  /** Ghost crew that owns the pending target block, when known (#81). */
  targetCrewId: string | null;
  setPendingTarget: (target: DriveByTarget | null, targetCrewId?: string | null) => void;
  consumePendingTarget: () => DriveByTarget | null;
  reset: () => void;
}

export const useCombatIntentStore = create<CombatIntentState>((set, get) => ({
  pendingTarget: null,
  targetCrewId: null,
  setPendingTarget: (target, targetCrewId = null) =>
    set({ pendingTarget: target, targetCrewId }),
  consumePendingTarget: () => {
    const target = get().pendingTarget;
    set({ pendingTarget: null });
    return target;
  },
  reset: () => set({ pendingTarget: null, targetCrewId: null }),
}));
