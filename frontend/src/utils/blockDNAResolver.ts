// ============================================================
// blockDNAResolver — Deterministic address → BlockDNA mapping
//
// Given a geocoded result (lat, lng, address), this function
// deterministically selects the best matching BlockDNA archetype
// from the library. The same coordinates always return the same
// archetype (stable seed via generateBlockHash).
//
// Selection priority:
//   1. Exact address keyword match (blvd/ave/st → corner-store, etc.)
//   2. Nearest DNA record by geographic distance
//   3. Seed-based fallback from the full library
//
// Sprint: address-block-pipeline
// ============================================================
import {
  BLOCK_DNA_LIBRARY,
  getNearestDNA,
  type BlockDNA,
  type BlockTag,
} from '../config/blockDNA';
import { generateBlockHash } from '../config/mapbox.config';
import type { BlockZoneType } from '../types/block.types';

// ─── Types ───────────────────────────────────────────────────
export interface ResolvedBlock {
  /** The matched BlockDNA archetype */
  dna: BlockDNA;
  /** Stable hash seed for this location */
  seed: string;
  /** Zone layout for the 8 rows (row 0 = nearest street) */
  zoneLayout: BlockZoneType[];
  /** Income multiplier from the DNA */
  incomeMultiplier: number;
  /** Starting morale */
  startingMorale: number;
  /** Starting heat */
  startingHeat: number;
  /** Max members */
  maxMembers: number;
}

// ─── Address keyword → tag mapping ───────────────────────────
interface KeywordRule {
  patterns: RegExp[];
  preferredTags: BlockTag[];
}

const KEYWORD_RULES: KeywordRule[] = [
  // Boulevards, avenues, main streets → corner store / open air
  {
    patterns: [/\bblvd\b/i, /\bboulevard\b/i, /\bave\b/i, /\bavenue\b/i, /\bmain\b/i, /\bbroadway\b/i],
    preferredTags: ['corner-store', 'open-air'],
  },
  // Parks, plazas, greens
  {
    patterns: [/\bpark\b/i, /\bplaza\b/i, /\bgreen\b/i, /\bcommons\b/i, /\bsquare\b/i],
    preferredTags: ['open-air'],
  },
  // Alleys, courts, lanes, ways → trap house / alley heavy
  {
    patterns: [/\bally\b/i, /\balley\b/i, /\bct\b/i, /\bcourt\b/i, /\bln\b/i, /\blane\b/i, /\bway\b/i, /\bpl\b/i, /\bplace\b/i],
    preferredTags: ['alley-heavy'],
  },
  // Warehouses, industrial
  {
    patterns: [/\bwarehouse\b/i, /\bindustrial\b/i, /\bdock\b/i, /\bport\b/i, /\byard\b/i],
    preferredTags: ['warehouse'],
  },
  // Beach, ocean, waterfront
  {
    patterns: [/\bocean\b/i, /\bbeach\b/i, /\bbay\b/i, /\bshore\b/i, /\bcoast\b/i, /\bharbor\b/i],
    preferredTags: ['beachfront'],
  },
  // Strip malls, shopping
  {
    patterns: [/\bstrip\b/i, /\bmall\b/i, /\bshopping\b/i, /\bplaza\b/i, /\bcenter\b/i],
    preferredTags: ['strip-mall'],
  },
  // Parking lots
  {
    patterns: [/\bparking\b/i, /\blot\b/i, /\bgarage\b/i],
    preferredTags: ['parking-lot'],
  },
  // Rooftop / high-rise
  {
    patterns: [/\btower\b/i, /\bhigh.?rise\b/i, /\bpenthouse\b/i, /\bterrace\b/i],
    preferredTags: ['rooftop-access'],
  },
];

// ─── Core resolver ───────────────────────────────────────────

/**
 * Detect which BlockTag best matches the address string.
 * Returns null if no keyword matches.
 */
function detectTagFromAddress(address: string): BlockTag | null {
  for (const rule of KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(address)) {
        return rule.preferredTags[0];
      }
    }
  }
  return null;
}

/**
 * Find the best DNA record that has the given tag.
 * If multiple records match, pick by seed-based index.
 */
function findDNAByTag(tag: BlockTag, seed: string): BlockDNA | null {
  const matches = BLOCK_DNA_LIBRARY.filter(dna => dna.tags.includes(tag));
  if (matches.length === 0) return null;
  // Use the seed to deterministically pick from matches
  const seedNum = seedToNumber(seed);
  return matches[seedNum % matches.length];
}

/**
 * Convert a hash string to a stable integer for indexing.
 */
function seedToNumber(seed: string): number {
  let n = 0;
  for (let i = 0; i < seed.length; i++) {
    n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return n;
}

/**
 * Build the 8-row zone layout from a BlockDNA's zoneOverrides,
 * falling back to a sensible default layout.
 */
function buildZoneLayout(dna: BlockDNA): BlockZoneType[] {
  const defaultLayout: BlockZoneType[] = [
    'street',     // row 0 — closest to street
    'curb',       // row 1
    'sidewalk',   // row 2
    'storefront', // row 3
    'alley',      // row 4
    'sidewalk',   // row 5
    'curb',       // row 6
    'rooftop',    // row 7 — farthest
  ];

  if (!dna.zoneOverrides) return defaultLayout;

  return defaultLayout.map((zone, row) =>
    dna.zoneOverrides?.[row] ?? zone
  );
}

/**
 * Main resolver — given lat, lng, and address string, returns
 * a fully resolved block configuration.
 *
 * @param lat  Latitude from geocoding
 * @param lng  Longitude from geocoding
 * @param address  Full formatted address string
 */
export function resolveBlockDNA(
  lat: number,
  lng: number,
  address: string,
): ResolvedBlock {
  const seed = generateBlockHash(lat, lng);

  // 1. Try keyword match from address string
  const detectedTag = detectTagFromAddress(address);
  let dna: BlockDNA | null = null;

  if (detectedTag) {
    dna = findDNAByTag(detectedTag, seed);
  }

  // 2. Fall back to nearest DNA by geographic distance
  if (!dna) {
    dna = getNearestDNA(lat, lng);
  }

  // 3. Final fallback: seed-based pick from full library
  if (!dna) {
    const idx = seedToNumber(seed) % BLOCK_DNA_LIBRARY.length;
    dna = BLOCK_DNA_LIBRARY[idx];
  }

  return {
    dna,
    seed,
    zoneLayout: buildZoneLayout(dna),
    incomeMultiplier: dna.incomeMultiplier,
    startingMorale: dna.startingMorale,
    startingHeat: dna.startingHeat,
    maxMembers: dna.maxMembers,
  };
}

// ─── Convenience exports ──────────────────────────────────────

/**
 * Quick check: does this address resolve to a specific DNA ID?
 * Useful for testing.
 */
export function resolveBlockDNAId(lat: number, lng: number, address: string): string {
  return resolveBlockDNA(lat, lng, address).dna.id;
}

/**
 * Get the display name for a resolved block.
 */
export function getResolvedBlockName(lat: number, lng: number, address: string): string {
  return resolveBlockDNA(lat, lng, address).dna.name;
}
