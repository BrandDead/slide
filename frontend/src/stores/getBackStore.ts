// ============================================================
// getBackStore — the Get Back clock
// Sprint 15-B
//
// Revenge on a shot clock. When you lose a member, a window opens
// against the gang that did it. Catch one of the members who was
// present before the clock runs out and you take double morale off
// them. Let it expire and your own crew loses faith in you.
//
// The clock is wall-clock based, not tick based. A window opened
// before the app was backgrounded must still be expired correctly
// when the player comes back, so every read derives remaining time
// from `openedAt + durationMs` rather than decrementing a counter.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GetBackWindow,
  GetBackTrigger,
  GetBackOutcome,
} from '../types/game.types';

// ─── Tuning ──────────────────────────────────────────────────

export const GET_BACK_CONFIG = {
  /** Default window length by trigger. Slides get the shortest leash. */
  DURATION_MS: {
    slide_casualty: 24 * 60 * 60 * 1000,   // 24h
    bounty_fulfilled: 48 * 60 * 60 * 1000, // 48h — you were blindsided
    special_person: 72 * 60 * 60 * 1000,   // 72h — family, more rope
    block_attack: 24 * 60 * 60 * 1000,     // 24h
  } as Record<GetBackTrigger, number>,

  /** Multiplier applied to the offender's gained morale when you get back. */
  SUCCESS_MULTIPLIER: 2,

  /** Flat morale hit to your own gang when a window expires unanswered. */
  EXPIRY_MORALE_PENALTY: 12,

  /** Below this fraction remaining, the UI should go red and urgent. */
  URGENT_THRESHOLD: 0.25,

  /** Windows are dropped from history after this long. */
  HISTORY_RETENTION_MS: 14 * 24 * 60 * 60 * 1000, // 14 days
} as const;

// ─── Pure helpers (exported for testing) ─────────────────────

/** Remaining ms on a window. Zero once elapsed. Never negative. */
export function remainingMs(w: GetBackWindow, now: number = Date.now()): number {
  if (w.outcome !== 'pending') return 0;
  return Math.max(0, w.openedAt + w.durationMs - now);
}

/** Fraction of the window still on the clock, 0..1. */
export function remainingFraction(w: GetBackWindow, now: number = Date.now()): number {
  if (w.durationMs <= 0) return 0;
  return remainingMs(w, now) / w.durationMs;
}

/** True when the clock has run out but the window has not been resolved yet. */
export function isLapsed(w: GetBackWindow, now: number = Date.now()): boolean {
  return w.outcome === 'pending' && remainingMs(w, now) === 0;
}

/** Urgency band for UI treatment. */
export function urgency(
  w: GetBackWindow,
  now: number = Date.now(),
): 'expired' | 'urgent' | 'normal' {
  if (isLapsed(w, now)) return 'expired';
  return remainingFraction(w, now) <= GET_BACK_CONFIG.URGENT_THRESHOLD
    ? 'urgent'
    : 'normal';
}

/** Shot-clock display string. Hours:minutes above an hour, else minutes:seconds. */
export function formatClock(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Morale swing for a resolved window.
 *
 * Success is deliberately lopsided: the retaliating gang gains double what
 * the offender originally took, and the offender loses that same doubled
 * amount plus the morale they banked from the original hit. Getting back
 * should feel like it erases the whole exchange and then some.
 */
export function moraleSwing(
  w: GetBackWindow,
  outcome: Exclude<GetBackOutcome, 'pending'>,
): { retaliator: number; offender: number } {
  const gained = Math.max(0, w.offenderMoraleGained);
  if (outcome === 'success') {
    const doubled = gained * GET_BACK_CONFIG.SUCCESS_MULTIPLIER;
    return { retaliator: doubled, offender: -(doubled + gained) };
  }
  // Expired or forfeited — the offender keeps what they took, you eat a penalty.
  return { retaliator: -GET_BACK_CONFIG.EXPIRY_MORALE_PENALTY, offender: 0 };
}

/** True when catching this member satisfies the window. */
export function isValidRevengeTarget(w: GetBackWindow, memberId: string): boolean {
  return w.outcome === 'pending' && w.wantedMemberIds.includes(memberId);
}

// ─── Store ───────────────────────────────────────────────────

export interface OpenWindowInput {
  trigger: GetBackTrigger;
  lostMemberId: string;
  lostMemberName: string;
  offendingGangName: string;
  offendingPlayerId?: string;
  wantedMemberIds: string[];
  wantedMemberNames: string[];
  offenderMoraleGained: number;
  /** Override the trigger's default duration. */
  durationMs?: number;
}

export interface ResolveResult {
  window: GetBackWindow;
  moraleSwing: { retaliator: number; offender: number };
}

interface GetBackState {
  windows: GetBackWindow[];

  openWindow: (input: OpenWindowInput) => GetBackWindow;

  /**
   * Resolve a window explicitly. Returns null when the id is unknown or the
   * window was already resolved, so callers can't double-apply morale.
   */
  resolveWindow: (
    windowId: string,
    outcome: Exclude<GetBackOutcome, 'pending'>,
    resolvedAgainstMemberId?: string,
  ) => ResolveResult | null;

  /**
   * Called when a member is caught. Resolves the first pending window that
   * lists them as a wanted target. Returns null when they aren't wanted.
   */
  registerCatch: (memberId: string) => ResolveResult | null;

  /**
   * Sweep lapsed windows to `expired`. Safe to call on every render or on a
   * timer. Returns the windows that flipped so the caller can apply morale.
   */
  sweepExpired: (now?: number) => ResolveResult[];

  activeWindows: (now?: number) => GetBackWindow[];
  /** The window closest to expiry — what the HUD clock should show. */
  mostUrgentWindow: (now?: number) => GetBackWindow | null;
  isMemberWanted: (memberId: string) => boolean;
  /** All member ids currently hunted across every open window. */
  allWantedMemberIds: () => string[];
  pruneHistory: (now?: number) => void;
  clearAll: () => void;
}

function makeId(): string {
  return `gbw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useGetBackStore = create<GetBackState>()(
  persist(
    (set, get) => ({
      windows: [],

      openWindow: (input) => {
        const now = Date.now();
        const window: GetBackWindow = {
          id: makeId(),
          trigger: input.trigger,
          openedAt: now,
          durationMs:
            input.durationMs ?? GET_BACK_CONFIG.DURATION_MS[input.trigger],
          lostMemberId: input.lostMemberId,
          lostMemberName: input.lostMemberName,
          offendingGangName: input.offendingGangName,
          offendingPlayerId: input.offendingPlayerId,
          wantedMemberIds: [...input.wantedMemberIds],
          wantedMemberNames: [...input.wantedMemberNames],
          offenderMoraleGained: input.offenderMoraleGained,
          outcome: 'pending',
        };
        set((state) => ({ windows: [window, ...state.windows] }));
        return window;
      },

      resolveWindow: (windowId, outcome, resolvedAgainstMemberId) => {
        const existing = get().windows.find((w) => w.id === windowId);
        if (!existing || existing.outcome !== 'pending') return null;

        const resolved: GetBackWindow = {
          ...existing,
          outcome,
          resolvedAt: Date.now(),
          resolvedAgainstMemberId,
        };

        set((state) => ({
          windows: state.windows.map((w) => (w.id === windowId ? resolved : w)),
        }));

        return { window: resolved, moraleSwing: moraleSwing(resolved, outcome) };
      },

      registerCatch: (memberId) => {
        const now = Date.now();
        // Oldest pending window first — the debt you've owed longest clears first.
        const target = [...get().windows]
          .filter((w) => w.outcome === 'pending' && !isLapsed(w, now))
          .sort((a, b) => a.openedAt - b.openedAt)
          .find((w) => w.wantedMemberIds.includes(memberId));

        if (!target) return null;
        return get().resolveWindow(target.id, 'success', memberId);
      },

      sweepExpired: (now = Date.now()) => {
        const lapsed = get().windows.filter((w) => isLapsed(w, now));
        if (lapsed.length === 0) return [];

        const results: ResolveResult[] = lapsed.map((w) => {
          const resolved: GetBackWindow = {
            ...w,
            outcome: 'expired' as const,
            resolvedAt: now,
          };
          return { window: resolved, moraleSwing: moraleSwing(resolved, 'expired') };
        });

        const lapsedIds = new Set(lapsed.map((w) => w.id));
        set((state) => ({
          windows: state.windows.map((w) =>
            lapsedIds.has(w.id)
              ? { ...w, outcome: 'expired' as const, resolvedAt: now }
              : w,
          ),
        }));

        return results;
      },

      activeWindows: (now = Date.now()) =>
        get().windows.filter((w) => w.outcome === 'pending' && !isLapsed(w, now)),

      mostUrgentWindow: (now = Date.now()) => {
        const active = get().activeWindows(now);
        if (active.length === 0) return null;
        return active.reduce((soonest, w) =>
          remainingMs(w, now) < remainingMs(soonest, now) ? w : soonest,
        );
      },

      isMemberWanted: (memberId) =>
        get()
          .activeWindows()
          .some((w) => w.wantedMemberIds.includes(memberId)),

      allWantedMemberIds: () => {
        const ids = new Set<string>();
        for (const w of get().activeWindows()) {
          for (const id of w.wantedMemberIds) ids.add(id);
        }
        return [...ids];
      },

      pruneHistory: (now = Date.now()) =>
        set((state) => ({
          windows: state.windows.filter(
            (w) =>
              w.outcome === 'pending' ||
              (w.resolvedAt ?? 0) > now - GET_BACK_CONFIG.HISTORY_RETENTION_MS,
          ),
        })),

      clearAll: () => set({ windows: [] }),
    }),
    { name: 'slide-getback-store' },
  ),
);
