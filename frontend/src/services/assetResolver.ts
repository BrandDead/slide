// ============================================================
// SLIDE / DEALT — Asset Resolver
// Single lookup layer between game roles and the generated art
// in assetManifest. Components ask for art by role + context;
// this module guarantees the returned URL exists on disk so the
// UI never requests a missing file. (#78)
// ============================================================

import {
  characterAssets,
  environmentAssets,
  type CharacterAsset,
} from '../assets/assetManifest';
import type { MemberRole } from '../types/block.types';

// ─── Role → character kit ────────────────────────────────────
// Roles without dedicated art borrow the closest existing kit.

const ROLE_CHARACTER_ID: Record<MemberRole, string> = {
  dealer: 'dealer_male_001',
  shooter: 'shooter_male_001',
  enforcer: 'enforcer_male_001',
  lookout: 'lookout_female_001',
  driver: 'driver_male_001',
  chemist: 'dealer_male_001',
  runner: 'driver_male_001',
  boss: 'enforcer_male_001',
  recruit: 'dealer_male_001',
  k9: 'enforcer_male_001',
  police: 'shooter_male_001',
};

export function getCharacterForRole(role: string): CharacterAsset {
  const id = ROLE_CHARACTER_ID[role as MemberRole] ?? ROLE_CHARACTER_ID.dealer;
  return characterAssets[id];
}

export function getPortraitUrl(role: string): string {
  return getCharacterForRole(role).portrait;
}

// ─── Street-state sprites ────────────────────────────────────
// Only states whose files exist on disk WITH a real alpha channel
// are listed; manifest entries for not-yet-generated art (e.g. most
// streetIdle files) are deliberately absent. The shooter's standing
// pose borrows its fullbody cutout — the only fullbody with alpha.

export type StreetSpriteState = 'idle' | 'aim' | 'fire' | 'hit' | 'downed';

const STREET_STATES: Record<string, Partial<Record<StreetSpriteState, string>>> = {
  dealer_male_001: {
    aim: characterAssets.dealer_male_001.streetAim,
    hit: characterAssets.dealer_male_001.streetHit,
    downed: characterAssets.dealer_male_001.streetDowned,
  },
  enforcer_male_001: {
    idle: characterAssets.enforcer_male_001.streetIdle,
  },
  shooter_male_001: {
    idle: characterAssets.shooter_male_001.fullbody,
    hit: characterAssets.shooter_male_001.streetHit,
    downed: characterAssets.shooter_male_001.streetDowned,
  },
  lookout_female_001: {},
  driver_male_001: {},
};

const STATE_FALLBACKS: Record<StreetSpriteState, StreetSpriteState[]> = {
  idle: ['idle', 'aim'],
  aim: ['aim', 'idle'],
  fire: ['aim', 'idle'],
  hit: ['hit', 'downed', 'aim', 'idle'],
  downed: ['downed', 'hit'],
};

/**
 * Best available street-view sprite for a role in a given state,
 * or null when the role has no usable street art yet (falls back
 * to portrait chips / legacy rendering at the call site).
 */
export function getStreetSpriteUrl(role: string, state: StreetSpriteState): string | null {
  const character = getCharacterForRole(role);
  const available = STREET_STATES[character.id] ?? {};
  for (const candidate of STATE_FALLBACKS[state]) {
    const url = available[candidate];
    if (url) return url;
  }
  return null;
}

// ─── Environments ────────────────────────────────────────────

const DEFAULT_ENVIRONMENT_ID = 'block_stripplaza_miami_001';

export function getDefaultTopdownBgUrl(): string {
  return environmentAssets[DEFAULT_ENVIRONMENT_ID].topdownBg ?? '';
}

export function getDefaultStreetBackdropUrl(timeOfDay: 'day' | 'night' = 'night'): string {
  const env = environmentAssets[DEFAULT_ENVIRONMENT_ID];
  return (timeOfDay === 'night' ? env.streetBackdropNight : env.streetBackdropDay) ?? '';
}

// ─── Preload ─────────────────────────────────────────────────

let preloaded = false;

/** Warm the browser cache for block-mode art. Safe to call repeatedly. */
export function preloadBlockAssets(): void {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  const urls = new Set<string>();
  for (const id of Object.values(ROLE_CHARACTER_ID)) {
    urls.add(characterAssets[id].portrait);
  }
  for (const states of Object.values(STREET_STATES)) {
    for (const url of Object.values(states)) {
      if (url) urls.add(url);
    }
  }
  urls.add(getDefaultTopdownBgUrl());
  urls.add(getDefaultStreetBackdropUrl('night'));
  for (const url of urls) {
    if (!url) continue;
    const img = new Image();
    img.src = url;
  }
}

// ─── Canvas sprite loading with green-matte cleanup ──────────
// Several generated cutouts carry bright-green chroma residue on
// their alpha edges (see docs/graphics-audit). Until the sources
// are regenerated (#79), sprites destined for the canvas renderer
// are cleaned once at load time and cached.

const defringeCache = new Map<string, Promise<HTMLCanvasElement>>();

function defringe(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(image, 0, 0);
  try {
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = frame.data;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a === 0) continue;
      if (a < 32) {
        px[i + 3] = 0;
        continue;
      }
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const maxRB = Math.max(r, b);
      if (g > 90 && g > maxRB * 1.25) {
        px[i + 1] = maxRB;
      }
    }
    ctx.putImageData(frame, 0, 0);
  } catch {
    // Canvas tainted or too large — ship the raw image instead.
  }
  return canvas;
}

export function loadDefringedSprite(url: string): Promise<HTMLCanvasElement> {
  let pending = defringeCache.get(url);
  if (!pending) {
    pending = new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(defringe(img));
      img.onerror = () => reject(new Error(`Failed to load sprite: ${url}`));
      img.src = url;
    });
    defringeCache.set(url, pending);
  }
  return pending;
}
