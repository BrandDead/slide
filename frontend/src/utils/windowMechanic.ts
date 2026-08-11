// ============================================================
// windowMechanic — passenger window raise/lower (Sprint 17)
//
// From the drive-by HUD reference: "[2] LOWER / RAISE WINDOW".
// The window is a real risk/reward toggle, not decoration:
//
//   WINDOW DOWN  → can shoot, full accuracy, but incoming fire
//                  hits the player at full damage
//   WINDOW UP    → cannot shoot; glass absorbs most incoming
//                  damage until it takes enough hits and shatters
//   IN MOTION    → shooting locked out; partial protection scaled
//                  to how far the glass still covers the aperture
//
// That makes the toggle a live tactical decision during a run:
// pop the window to fire, drop it back before return fire lands.
// ============================================================

/** Seconds for the glass to travel its full range. */
export const WINDOW_TRAVEL_SECONDS = 0.55;

/** Hits the raised glass absorbs before it shatters. */
export const GLASS_HIT_POINTS = 3;

/** Damage multiplier applied to incoming fire when fully raised. */
export const GLASS_DAMAGE_REDUCTION = 0.25;

export interface WindowState {
  /** 0 = fully raised (closed), 1 = fully lowered (open). */
  openRatio: number;
  /** Where the glass is heading. */
  target: 0 | 1;
  /** Remaining glass integrity; 0 = shattered. */
  glassHp: number;
  /** Once shattered the aperture is permanently open for the run. */
  shattered: boolean;
}

export function createWindowState(startOpen = true): WindowState {
  return {
    openRatio: startOpen ? 1 : 0,
    target: startOpen ? 1 : 0,
    glassHp: GLASS_HIT_POINTS,
    shattered: false,
  };
}

/** Toggle the window. No-op once the glass is gone. */
export function toggleWindow(state: WindowState): WindowState {
  if (state.shattered) return state;
  return { ...state, target: state.target === 1 ? 0 : 1 };
}

/** Advance the glass toward its target. `dt` in seconds. */
export function tickWindow(state: WindowState, dt: number): WindowState {
  if (state.shattered) {
    return state.openRatio === 1 ? state : { ...state, openRatio: 1 };
  }
  if (state.openRatio === state.target) return state;

  const step = dt / WINDOW_TRAVEL_SECONDS;
  const delta = state.target - state.openRatio;
  const next =
    Math.abs(delta) <= step
      ? state.target
      : state.openRatio + Math.sign(delta) * step;

  return { ...state, openRatio: next };
}

/** The player can only fire through a fully lowered window. */
export function canShoot(state: WindowState): boolean {
  return state.shattered || state.openRatio >= 0.98;
}

/**
 * Incoming damage multiplier. Fully raised glass blocks most of a
 * hit; partially raised scales linearly with remaining coverage.
 */
export function incomingDamageMultiplier(state: WindowState): number {
  if (state.shattered) return 1;
  const coverage = 1 - state.openRatio;
  return 1 - coverage * (1 - GLASS_DAMAGE_REDUCTION);
}

/**
 * Register a hit on the glass. Returns the new state plus whether
 * this hit shattered it, so the caller can trigger sound/particles.
 */
export function applyGlassHit(state: WindowState): {
  state: WindowState;
  shatteredNow: boolean;
} {
  if (state.shattered || state.openRatio > 0.6) {
    return { state, shatteredNow: false };
  }
  const glassHp = state.glassHp - 1;
  if (glassHp <= 0) {
    return {
      state: { ...state, glassHp: 0, shattered: true, openRatio: 1, target: 1 },
      shatteredNow: true,
    };
  }
  return { state: { ...state, glassHp }, shatteredNow: false };
}

/** HUD label matching the reference art. */
export function windowHudLabel(state: WindowState): string {
  if (state.shattered) return 'WINDOW SHATTERED';
  if (state.openRatio !== state.target) {
    return state.target === 1 ? 'LOWERING...' : 'RAISING...';
  }
  return state.openRatio >= 0.98 ? '[2] RAISE WINDOW' : '[2] LOWER WINDOW';
}
