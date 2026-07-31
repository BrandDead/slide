// ============================================================
// SLIDE — World Actor Resolver  (#78)
// frontend/src/render/worldActorResolver.ts
//
// Resolves a crew member's ROLE + STATE + VIEW to a world sprite,
// driven entirely by the generated runtimeManifest.json. One manifest →
// one resolver → one preloader → every renderer.
//
// Rules this enforces, from the assignment:
//   • a portrait is NEVER a world actor. Portraits are for cards, rosters,
//     notifications and HUD chips only. getWorldActor() will not return one.
//   • deterministic fallback chain, no randomness
//   • a missing asset degrades to the nearest sibling state, never to a
//     blank scene, an emoji, or a coloured circle
//   • one warning per missing key, not a console storm
//
// Replaces the hardcoded STREET_STATES table in services/assetResolver.ts,
// which existed only because the old manifest declared paths that were not
// on disk. The generated manifest cannot drift from disk — the audit gate
// fails the build if it does.
// ============================================================

import runtimeManifest from '../assets/runtimeManifest.json';

export type ActorView = 'street' | 'topdown' | 'fullbody';

export type ActorState =
  | 'idle' | 'walk' | 'aim' | 'fire' | 'reload'
  | 'hit' | 'wounded' | 'downed' | 'dead' | 'arrested'
  | 'seated' | 'driving' | 'alert';

export interface RuntimeAsset {
  id: string;
  runtimePath: string;
  sourcePath: string;
  class: string;
  role: string | null;
  state: string | null;
  width: number;
  height: number;
  bytes: number;
  hasAlpha: boolean;
  fringeRatio: number;
  pivot: { x: number; y: number };
  alphaRepaired: boolean;
}

export interface ResolvedActor {
  url: string;
  /** Pivot in normalised sprite space. (0.5, 1.0) = foot contact. */
  pivot: { x: number; y: number };
  width: number;
  height: number;
  /** The state actually resolved — may differ from the one requested. */
  resolvedState: ActorState;
  /** True when we fell back rather than finding an exact match. */
  isFallback: boolean;
}

const ASSETS = (runtimeManifest.entries ?? []) as RuntimeAsset[];

// ─── Index ───────────────────────────────────────────────────

const VIEW_CLASS: Record<ActorView, string> = {
  street: 'actor-street',
  topdown: 'actor-topdown',
  fullbody: 'actor-fullbody',
};

/** `${view}|${role}|${state}` → asset */
const index = new Map<string, RuntimeAsset>();
/** `${view}|${role}` → any asset for that role, for last-resort matching. */
const byRole = new Map<string, RuntimeAsset[]>();

for (const a of ASSETS) {
  const view = (Object.keys(VIEW_CLASS) as ActorView[]).find((v) => VIEW_CLASS[v] === a.class);
  if (!view || !a.role) continue;
  const roleKey = `${view}|${a.role}`;
  if (!byRole.has(roleKey)) byRole.set(roleKey, []);
  byRole.get(roleKey)!.push(a);
  if (a.state) index.set(`${view}|${a.role}|${a.state}`, a);
}

// ─── Fallback chains ─────────────────────────────────────────
// Deterministic and ordered. Each state degrades to the nearest sibling
// that still reads correctly to a player: a missing 'fire' shows 'aim',
// not an idle pose, because an idle actor mid-gunfight looks broken.

const STATE_CHAIN: Record<ActorState, ActorState[]> = {
  idle:     ['idle', 'front', 'walk', 'aim'] as ActorState[],
  walk:     ['walk', 'idle', 'front'] as ActorState[],
  aim:      ['aim', 'fire', 'idle', 'front'] as ActorState[],
  fire:     ['fire', 'aim', 'idle'] as ActorState[],
  reload:   ['reload', 'aim', 'idle'] as ActorState[],
  alert:    ['alert', 'aim', 'idle', 'front'] as ActorState[],
  hit:      ['hit', 'wounded', 'downed', 'idle'] as ActorState[],
  wounded:  ['wounded', 'hit', 'idle'] as ActorState[],
  downed:   ['downed', 'dead', 'hit'] as ActorState[],
  dead:     ['dead', 'downed', 'hit'] as ActorState[],
  arrested: ['arrested', 'downed', 'idle'] as ActorState[],
  seated:   ['seated', 'driving', 'idle'] as ActorState[],
  driving:  ['driving', 'seated', 'idle'] as ActorState[],
};

/**
 * Roles without dedicated art borrow the closest kit that reads correctly.
 * A recruit borrowing a dealer is fine — both are unarmed civilians on a
 * corner. A recruit borrowing a shooter would misinform the player about
 * the threat on that tile, so those pairings are deliberate.
 */
const ROLE_CHAIN: Record<string, string[]> = {
  dealer:   ['dealer', 'enforcer', 'shooter'],
  shooter:  ['shooter', 'enforcer', 'dealer'],
  enforcer: ['enforcer', 'shooter', 'dealer'],
  lookout:  ['lookout', 'dealer', 'enforcer'],
  driver:   ['driver', 'dealer', 'enforcer'],
  recruit:  ['recruit', 'dealer', 'lookout'],
  chemist:  ['chemist', 'dealer'],
  runner:   ['runner', 'driver', 'dealer'],
  boss:     ['boss', 'enforcer', 'shooter'],
};

/** View degradation: a street pose beats a top-down chip beats a full body. */
const VIEW_CHAIN: Record<ActorView, ActorView[]> = {
  street:   ['street', 'fullbody', 'topdown'],
  topdown:  ['topdown', 'street', 'fullbody'],
  fullbody: ['fullbody', 'street', 'topdown'],
};

// ─── Warning suppression ─────────────────────────────────────
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  if (typeof console !== 'undefined') console.warn(`[worldActor] ${message}`);
}

/** Test hook. */
export function resetWarnings(): void { warned.clear(); }

// ─── Resolution ──────────────────────────────────────────────

/**
 * Best available world sprite. Returns null ONLY when the manifest has no
 * art at all for any role in any view — at which point the caller should
 * draw a silhouette placeholder, never an emoji or a coloured circle.
 */
export function getWorldActor(
  role: string,
  state: ActorState = 'idle',
  view: ActorView = 'street',
): ResolvedActor | null {
  const roles = ROLE_CHAIN[role] ?? [role, 'dealer'];
  const views = VIEW_CHAIN[view];
  const states = STATE_CHAIN[state] ?? [state, 'idle'];

  // Pass 1 — exhaust every (view, role, state) triple in the declared
  // chains before considering anything outside them.
  for (const v of views) {
    for (const s of states) {
      for (const r of roles) {
        const hit = index.get(`${v}|${r}|${s}`);
        if (!hit) continue;
        return {
          url: hit.runtimePath,
          pivot: hit.pivot,
          width: hit.width,
          height: hit.height,
          resolvedState: s as ActorState,
          isFallback: !(v === view && r === role && s === state),
        };
      }
    }
  }

  // Pass 2 — last resort. Only reached when nothing in any chain matched.
  //
  // Ordered by state first, then role, so a downed member borrows ANOTHER
  // ROLE'S downed pose rather than its own standing idle. Showing a downed
  // actor upright misreports the tactical state of the tile, which is worse
  // than showing a slightly wrong silhouette.
  for (const v of views) {
    for (const s of states) {
      const match = ASSETS.find(
        (a) => VIEW_CLASS[v] === a.class && a.state === s,
      );
      if (!match) continue;
      warnOnce(`${view}|${role}|${state}`,
        `no "${state}" for ${role} (${view}); borrowing ${match.role}'s "${s}" — ${match.id}`);
      return {
        url: match.runtimePath, pivot: match.pivot,
        width: match.width, height: match.height,
        resolvedState: s as ActorState,
        isFallback: true,
      };
    }
  }

  // Pass 3 — any art for the role at all, in the requested view family.
  for (const v of views) {
    for (const r of roles) {
      const any = byRole.get(`${v}|${r}`)?.[0];
      if (!any) continue;
      warnOnce(`${view}|${role}|${state}`,
        `no "${state}" art anywhere for ${role} (${view}); using ${any.id}`);
      return {
        url: any.runtimePath, pivot: any.pivot,
        width: any.width, height: any.height,
        resolvedState: (any.state as ActorState) ?? 'idle',
        isFallback: true,
      };
    }
  }

  warnOnce(`none|${role}`, `no world art for role "${role}" in any view`);
  return null;
}

/**
 * Portraits — cards, rosters, notifications, HUD chips ONLY.
 * Deliberately a separate function so a world renderer cannot reach a
 * portrait by accident. This is the misuse the assignment calls out.
 */
export function getPortrait(role: string): string | null {
  const roles = ROLE_CHAIN[role] ?? [role];
  for (const r of roles) {
    const hit = ASSETS.find((a) => a.class === 'portrait' && a.role === r);
    if (hit) return hit.runtimePath;
  }
  return null;
}

// ─── Preload ─────────────────────────────────────────────────

const preloaded = new Set<string>();

/**
 * Warm only what the next interaction needs. Scene-scoped, not global —
 * preloading the whole library was part of what made first paint slow.
 */
export function preloadActors(
  roles: string[],
  states: ActorState[] = ['idle', 'aim', 'hit', 'downed'],
  view: ActorView = 'street',
): void {
  if (typeof Image === 'undefined') return;
  for (const role of roles) {
    for (const state of states) {
      const a = getWorldActor(role, state, view);
      if (!a || preloaded.has(a.url)) continue;
      preloaded.add(a.url);
      const img = new Image();
      img.decoding = 'async';
      img.src = a.url;
    }
  }
}

// ─── Canvas sprite cache ─────────────────────────────────────
// Straight Image decode. No getImageData pass — the matte is baked out at
// build time by scripts/assets/process.mjs, so the old runtime defringe is
// dead cost and has been removed.

const spriteCache = new Map<string, Promise<HTMLImageElement>>();

export function loadSprite(url: string): Promise<HTMLImageElement> {
  let pending = spriteCache.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`sprite load failed: ${url}`));
      img.src = url;
    });
    spriteCache.set(url, pending);
  }
  return pending;
}

/** Diagnostics for the audit report and the dev overlay. */
export function manifestStats() {
  return {
    total: ASSETS.length,
    indexed: index.size,
    roles: [...new Set(ASSETS.map((a) => a.role).filter(Boolean))],
    missingAlpha: ASSETS.filter((a) => !a.hasAlpha && a.class.startsWith('actor')).map((a) => a.id),
    repaired: ASSETS.filter((a) => a.alphaRepaired).map((a) => a.id),
  };
}
