import { create } from 'zustand';
import type { DriveByTarget } from '../utils/driveByTarget';

interface CombatIntentState {
  pendingTarget: DriveByTarget | null;
  setPendingTarget: (target: DriveByTarget | null) => void;
  consumePendingTarget: () => DriveByTarget | null;
  reset: () => void;
}

export const useCombatIntentStore = create<CombatIntentState>((set, get) => ({
  pendingTarget: null,
  setPendingTarget: (target) => set({ pendingTarget: target }),
  consumePendingTarget: () => {
    const target = get().pendingTarget;
    set({ pendingTarget: null });
    return target;
  },
  reset: () => set({ pendingTarget: null }),
}));
