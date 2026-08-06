// ============================================================
// getBackStore tests — Sprint 15-B
//
// The clock is wall-clock derived, so most of these tests inject an
// explicit `now` rather than faking timers. The cases that matter are
// the ones where a player backgrounds the app: a window must expire
// correctly on the next read, and morale must only ever be applied
// once per window.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useGetBackStore,
  GET_BACK_CONFIG,
  remainingMs,
  remainingFraction,
  isLapsed,
  urgency,
  formatClock,
  moraleSwing,
  isValidRevengeTarget,
  type OpenWindowInput,
} from '../getBackStore';
import type { GetBackWindow } from '../../types/game.types';

const baseInput: OpenWindowInput = {
  trigger: 'slide_casualty',
  lostMemberId: 'm_lost',
  lostMemberName: 'Cedric',
  offendingGangName: 'Northbound',
  offendingPlayerId: 'p_opp',
  wantedMemberIds: ['opp_1', 'opp_2'],
  wantedMemberNames: ['Smoke', 'Ghost'],
  offenderMoraleGained: 10,
};

/** Build a window object directly for testing pure helpers. */
function makeWindow(overrides: Partial<GetBackWindow> = {}): GetBackWindow {
  return {
    id: 'w1',
    trigger: 'slide_casualty',
    openedAt: 1_000_000,
    durationMs: 60_000,
    lostMemberId: 'm_lost',
    lostMemberName: 'Cedric',
    offendingGangName: 'Northbound',
    wantedMemberIds: ['opp_1'],
    wantedMemberNames: ['Smoke'],
    offenderMoraleGained: 10,
    outcome: 'pending',
    ...overrides,
  };
}

beforeEach(() => {
  useGetBackStore.getState().clearAll();
});

describe('remainingMs', () => {
  it('returns the full duration at the moment of opening', () => {
    const w = makeWindow();
    expect(remainingMs(w, w.openedAt)).toBe(60_000);
  });

  it('counts down with wall time', () => {
    const w = makeWindow();
    expect(remainingMs(w, w.openedAt + 20_000)).toBe(40_000);
  });

  it('clamps to zero rather than going negative', () => {
    const w = makeWindow();
    expect(remainingMs(w, w.openedAt + 999_999)).toBe(0);
  });

  it('reports zero for any resolved window regardless of clock', () => {
    const w = makeWindow({ outcome: 'success' });
    expect(remainingMs(w, w.openedAt)).toBe(0);
  });
});

describe('remainingFraction', () => {
  it('is 1 at open and 0.5 at the halfway point', () => {
    const w = makeWindow();
    expect(remainingFraction(w, w.openedAt)).toBe(1);
    expect(remainingFraction(w, w.openedAt + 30_000)).toBe(0.5);
  });

  it('does not divide by zero on a zero-length window', () => {
    const w = makeWindow({ durationMs: 0 });
    expect(remainingFraction(w, w.openedAt)).toBe(0);
  });
});

describe('isLapsed', () => {
  it('is false while time remains', () => {
    const w = makeWindow();
    expect(isLapsed(w, w.openedAt + 59_999)).toBe(false);
  });

  it('is true the instant the clock hits zero', () => {
    const w = makeWindow();
    expect(isLapsed(w, w.openedAt + 60_000)).toBe(true);
  });

  it('is false for an already-resolved window so morale is not re-applied', () => {
    const w = makeWindow({ outcome: 'expired' });
    expect(isLapsed(w, w.openedAt + 999_999)).toBe(false);
  });
});

describe('urgency', () => {
  it('is normal above the urgent threshold', () => {
    const w = makeWindow();
    expect(urgency(w, w.openedAt + 10_000)).toBe('normal');
  });

  it('flips to urgent at the threshold', () => {
    const w = makeWindow();
    // 25% of 60s remaining => 45s elapsed.
    expect(urgency(w, w.openedAt + 45_000)).toBe('urgent');
  });

  it('reports expired once the clock is out', () => {
    const w = makeWindow();
    expect(urgency(w, w.openedAt + 60_000)).toBe('expired');
  });
});

describe('formatClock', () => {
  it('shows minutes and seconds under an hour', () => {
    expect(formatClock(65_000)).toBe('01:05');
  });

  it('shows hours and minutes at or above an hour', () => {
    expect(formatClock(3 * 3_600_000 + 25 * 60_000)).toBe('03:25');
  });

  it('shows zeros for a dead clock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-500)).toBe('00:00');
  });
});

describe('moraleSwing', () => {
  it('doubles the retaliator gain on success', () => {
    const w = makeWindow({ offenderMoraleGained: 10 });
    expect(moraleSwing(w, 'success').retaliator).toBe(
      10 * GET_BACK_CONFIG.SUCCESS_MULTIPLIER,
    );
  });

  it('makes the offender lose the doubled amount plus what they banked', () => {
    const w = makeWindow({ offenderMoraleGained: 10 });
    // Doubled 20 plus the original 10 they gained.
    expect(moraleSwing(w, 'success').offender).toBe(-30);
  });

  it('penalises the retaliator and spares the offender on expiry', () => {
    const w = makeWindow({ offenderMoraleGained: 10 });
    const swing = moraleSwing(w, 'expired');
    expect(swing.retaliator).toBe(-GET_BACK_CONFIG.EXPIRY_MORALE_PENALTY);
    expect(swing.offender).toBe(0);
  });

  it('treats a negative banked morale as zero rather than rewarding the offender', () => {
    const w = makeWindow({ offenderMoraleGained: -5 });
    const swing = moraleSwing(w, 'success');
    // Compared numerically because -0 and 0 are distinct under deep equality
    // but identical as game state.
    expect(swing.retaliator).toBe(0);
    expect(swing.offender === 0).toBe(true);
  });
});

describe('isValidRevengeTarget', () => {
  it('accepts a member who was present', () => {
    const w = makeWindow({ wantedMemberIds: ['opp_1', 'opp_2'] });
    expect(isValidRevengeTarget(w, 'opp_2')).toBe(true);
  });

  it('rejects a member who was not', () => {
    const w = makeWindow({ wantedMemberIds: ['opp_1'] });
    expect(isValidRevengeTarget(w, 'someone_else')).toBe(false);
  });

  it('rejects everyone once the window is resolved', () => {
    const w = makeWindow({ wantedMemberIds: ['opp_1'], outcome: 'success' });
    expect(isValidRevengeTarget(w, 'opp_1')).toBe(false);
  });
});

describe('openWindow', () => {
  it('stores a pending window with the trigger default duration', () => {
    const w = useGetBackStore.getState().openWindow(baseInput);
    expect(w.outcome).toBe('pending');
    expect(w.durationMs).toBe(GET_BACK_CONFIG.DURATION_MS.slide_casualty);
    expect(useGetBackStore.getState().windows).toHaveLength(1);
  });

  it('honours an explicit duration override', () => {
    const w = useGetBackStore
      .getState()
      .openWindow({ ...baseInput, durationMs: 5_000 });
    expect(w.durationMs).toBe(5_000);
  });

  it('gives family contracts a longer leash than slides', () => {
    expect(GET_BACK_CONFIG.DURATION_MS.special_person).toBeGreaterThan(
      GET_BACK_CONFIG.DURATION_MS.slide_casualty,
    );
  });

  it('copies the wanted arrays so later mutation of the input is not reflected', () => {
    const ids = ['opp_1'];
    const w = useGetBackStore
      .getState()
      .openWindow({ ...baseInput, wantedMemberIds: ids });
    ids.push('opp_9');
    expect(w.wantedMemberIds).toEqual(['opp_1']);
  });
});

describe('resolveWindow', () => {
  it('resolves a pending window and returns the morale swing', () => {
    const w = useGetBackStore.getState().openWindow(baseInput);
    const res = useGetBackStore.getState().resolveWindow(w.id, 'success', 'opp_1');
    expect(res).not.toBeNull();
    expect(res!.window.outcome).toBe('success');
    expect(res!.window.resolvedAgainstMemberId).toBe('opp_1');
    expect(res!.moraleSwing.retaliator).toBe(20);
  });

  it('returns null on an unknown id', () => {
    expect(useGetBackStore.getState().resolveWindow('nope', 'success')).toBeNull();
  });

  it('refuses to resolve twice so morale cannot be double-applied', () => {
    const w = useGetBackStore.getState().openWindow(baseInput);
    expect(useGetBackStore.getState().resolveWindow(w.id, 'success')).not.toBeNull();
    expect(useGetBackStore.getState().resolveWindow(w.id, 'success')).toBeNull();
  });
});

describe('registerCatch', () => {
  it('resolves the window listing the caught member', () => {
    useGetBackStore.getState().openWindow(baseInput);
    const res = useGetBackStore.getState().registerCatch('opp_2');
    expect(res).not.toBeNull();
    expect(res!.window.outcome).toBe('success');
    expect(res!.window.resolvedAgainstMemberId).toBe('opp_2');
  });

  it('returns null when the member is not wanted anywhere', () => {
    useGetBackStore.getState().openWindow(baseInput);
    expect(useGetBackStore.getState().registerCatch('stranger')).toBeNull();
  });

  it('clears the oldest debt first when two windows list the same member', () => {
    const store = useGetBackStore.getState();
    const older = store.openWindow({ ...baseInput, wantedMemberIds: ['shared'] });
    // Force a later openedAt so ordering is unambiguous.
    useGetBackStore.setState((s) => ({
      windows: s.windows.map((w) =>
        w.id === older.id ? { ...w, openedAt: w.openedAt - 10_000 } : w,
      ),
    }));
    const newer = useGetBackStore
      .getState()
      .openWindow({ ...baseInput, wantedMemberIds: ['shared'] });

    const res = useGetBackStore.getState().registerCatch('shared');
    expect(res!.window.id).toBe(older.id);
    expect(
      useGetBackStore.getState().windows.find((w) => w.id === newer.id)!.outcome,
    ).toBe('pending');
  });

  it('ignores windows whose clock already ran out', () => {
    useGetBackStore.getState().openWindow({ ...baseInput, durationMs: 1 });
    // Push openedAt into the past so the window is lapsed.
    useGetBackStore.setState((s) => ({
      windows: s.windows.map((w) => ({ ...w, openedAt: w.openedAt - 10_000 })),
    }));
    expect(useGetBackStore.getState().registerCatch('opp_1')).toBeNull();
  });
});

describe('sweepExpired', () => {
  it('does nothing when every window still has time', () => {
    useGetBackStore.getState().openWindow(baseInput);
    expect(useGetBackStore.getState().sweepExpired()).toEqual([]);
  });

  it('flips lapsed windows to expired and reports the penalty', () => {
    useGetBackStore.getState().openWindow({ ...baseInput, durationMs: 1_000 });
    const later = Date.now() + 5_000;
    const results = useGetBackStore.getState().sweepExpired(later);
    expect(results).toHaveLength(1);
    expect(results[0].window.outcome).toBe('expired');
    expect(results[0].moraleSwing.retaliator).toBe(
      -GET_BACK_CONFIG.EXPIRY_MORALE_PENALTY,
    );
    expect(useGetBackStore.getState().windows[0].outcome).toBe('expired');
  });

  it('is idempotent so a repeated sweep does not re-penalise', () => {
    useGetBackStore.getState().openWindow({ ...baseInput, durationMs: 1_000 });
    const later = Date.now() + 5_000;
    expect(useGetBackStore.getState().sweepExpired(later)).toHaveLength(1);
    expect(useGetBackStore.getState().sweepExpired(later)).toHaveLength(0);
  });
});

describe('selectors', () => {
  it('activeWindows excludes resolved and lapsed windows', () => {
    const store = useGetBackStore.getState();
    const keep = store.openWindow(baseInput);
    const resolved = store.openWindow(baseInput);
    useGetBackStore.getState().resolveWindow(resolved.id, 'success');
    const active = useGetBackStore.getState().activeWindows();
    expect(active.map((w) => w.id)).toEqual([keep.id]);
  });

  it('mostUrgentWindow picks the one closest to expiry', () => {
    const store = useGetBackStore.getState();
    store.openWindow({ ...baseInput, durationMs: 100_000 });
    const soon = store.openWindow({ ...baseInput, durationMs: 10_000 });
    expect(useGetBackStore.getState().mostUrgentWindow()!.id).toBe(soon.id);
  });

  it('mostUrgentWindow is null with nothing open', () => {
    expect(useGetBackStore.getState().mostUrgentWindow()).toBeNull();
  });

  it('isMemberWanted reflects open windows only', () => {
    const w = useGetBackStore.getState().openWindow(baseInput);
    expect(useGetBackStore.getState().isMemberWanted('opp_1')).toBe(true);
    useGetBackStore.getState().resolveWindow(w.id, 'success');
    expect(useGetBackStore.getState().isMemberWanted('opp_1')).toBe(false);
  });

  it('allWantedMemberIds dedupes across windows', () => {
    const store = useGetBackStore.getState();
    store.openWindow({ ...baseInput, wantedMemberIds: ['a', 'b'] });
    store.openWindow({ ...baseInput, wantedMemberIds: ['b', 'c'] });
    expect(useGetBackStore.getState().allWantedMemberIds().sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('pruneHistory', () => {
  it('keeps pending windows no matter how old', () => {
    useGetBackStore.getState().openWindow(baseInput);
    useGetBackStore.getState().pruneHistory(Date.now() + 10 * 365 * 24 * 3_600_000);
    expect(useGetBackStore.getState().windows).toHaveLength(1);
  });

  it('drops resolved windows past the retention horizon', () => {
    const w = useGetBackStore.getState().openWindow(baseInput);
    useGetBackStore.getState().resolveWindow(w.id, 'success');
    useGetBackStore
      .getState()
      .pruneHistory(Date.now() + GET_BACK_CONFIG.HISTORY_RETENTION_MS + 1_000);
    expect(useGetBackStore.getState().windows).toHaveLength(0);
  });
});
