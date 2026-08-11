// ============================================================
// driveByTarget — structured drive-by target contract (#108)
//
// Replaces the old `CarCrew.targetBlock: string | null`. A target
// is either:
//   • 'geocoded'   — picked from the shared address-search
//                    autocomplete (AddressSearchBar) and carries
//                    real coordinates. The street scene is seeded
//                    from those coordinates via resolveBlockDNA.
//   • 'text-seed'  — OFFLINE FALLBACK. No geocoder was available,
//                    so the scene is seeded from a deterministic
//                    hash of the NORMALIZED address text. This is
//                    deliberately non-geographic: it must never be
//                    treated as a real location, and it is clearly
//                    labelled both here and in the UI.
//
// The gameplay path must not do any network work per frame, so the
// whole geocode → resolve → street pipeline lives in one pure
// function (resolveStreetForTarget) memoised by the caller.
// ============================================================

import { resolveBlockDNA } from './blockDNAResolver';
import { generateStreetSegments, type StreetSegment } from '../render/proceduralStreet';
import type { ResolvedBlock } from './blockDNAResolver';

// ─── Contract ────────────────────────────────────────────────

/**
 * A structured drive-by target.
 * Coordinates are optional ONLY for the offline text fallback.
 */
export interface DriveByTarget {
  /** Normalized display address (trimmed, whitespace-collapsed). */
  address: string;
  /** Latitude from geocoding; undefined in offline text-seed mode. */
  lat?: number;
  /** Longitude from geocoding; undefined in offline text-seed mode. */
  lng?: number;
  /** Geocoder place identifier when available. */
  placeId?: string;
  /** How the street seed was derived — see module header. */
  seedMode: 'geocoded' | 'text-seed';
}

// ─── Normalization ───────────────────────────────────────────

/**
 * Normalize a raw typed address for use as a target label / seed.
 * Trims, collapses whitespace, and lower-cases so "  Las Olas  BLVD "
 * and "las olas blvd" resolve to the same offline seed.
 */
export function normalizeAddressText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ─── Offline deterministic seed ──────────────────────────────
// FNV-1a 32-bit over the normalized address, rendered as a stable
// slug. NOT a geographic seed — it exists only so an offline typed
// target still produces a stable, distinct street. (#108 fallback)

export function textSeedFromAddress(normalizedAddress: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < normalizedAddress.length; i++) {
    h ^= normalizedAddress.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `addr_${(h >>> 0).toString(36)}`;
}

// ─── Resolution ──────────────────────────────────────────────

export interface ResolvedStreet {
  resolved: ResolvedBlock;
  segments: StreetSegment[];
  /** The seed actually used to generate the street. */
  seed: string;
  /** Echo of the target seed mode, for HUD/debug labelling. */
  seedMode: DriveByTarget['seedMode'];
}

/**
 * Resolve a structured target into a deterministic procedural street.
 *
 * Pure and synchronous — safe to memoise and call outside the render
 * loop. No network access. When the target carries coordinates the
 * seed comes from `generateBlockHash(lat, lng)`; otherwise the
 * labelled text-seed fallback is mixed into the coordinate seed so
 * two different typed addresses still produce distinct scenes even
 * when they keyword-match the same BlockDNA archetype.
 */
export function resolveStreetForTarget(target: DriveByTarget): ResolvedStreet {
  if (
    target.seedMode === 'geocoded' &&
    typeof target.lat === 'number' &&
    typeof target.lng === 'number' &&
    Number.isFinite(target.lat) &&
    Number.isFinite(target.lng)
  ) {
    const resolved = resolveBlockDNA(target.lat, target.lng, target.address);
    return {
      resolved,
      segments: generateStreetSegments({
        seed: resolved.seed,
        zoneLayout: resolved.zoneLayout,
      }),
      seed: resolved.seed,
      seedMode: 'geocoded',
    };
  }

  // Offline fallback: deterministic non-geographic seed from the
  // normalized address. Mix it into the coordinate seed so the scene
  // varies per address even when the archetype is identical.
  const textSeed = textSeedFromAddress(target.address);
  const resolved = resolveBlockDNA(0, 0, target.address);
  const seed = `${resolved.seed}|${textSeed}`;
  return {
    resolved,
    segments: generateStreetSegments({ seed, zoneLayout: resolved.zoneLayout }),
    seed,
    seedMode: 'text-seed',
  };
}
