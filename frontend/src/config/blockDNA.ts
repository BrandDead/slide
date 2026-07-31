/**
 * DEALT/SLIDE — Block DNA Library
 *
 * A "Block DNA" is a premade configuration for a city block that the player
 * can claim. Each DNA record encodes:
 *   - The real-world address and city
 *   - A projection profile override (camera angle, horizon, depth)
 *   - Zone layout overrides (which rows have which zone types)
 *   - Stat modifiers (income multiplier, heat decay, cover bonuses)
 *   - Flavour text and visual tags for the OSShell block-picker UI
 *
 * The player picks a block by entering an address; the engine finds the
 * nearest DNA record or falls back to the default Las Olas layout.
 *
 * DNA records are intentionally NOT exhaustive — they are curated presets
 * that give each block a distinct risk/reward personality.
 */

import type { ProjectionProfile } from '../render/projection';
import { DEFAULT_PROFILE } from '../render/projection';
import type { BlockZoneType } from '../types/block.types';

// ─── Types ───────────────────────────────────────────────────

export type BlockTier = 'starter' | 'mid' | 'high' | 'elite';
export type BlockTag =
  | 'corner-store'
  | 'open-air'
  | 'alley-heavy'
  | 'rooftop-access'
  | 'parking-lot'
  | 'beachfront'
  | 'strip-mall'
  | 'warehouse';

export interface BlockDNA {
  /** Unique slug — used as blockId prefix when the player claims this block */
  id: string;
  /** Display name shown in the block picker */
  name: string;
  /** Real-world address */
  address: string;
  city: string;
  state: string;
  /** Approximate lat/lng for Mapbox */
  lat: number;
  lng: number;
  /** Risk/reward tier */
  tier: BlockTier;
  tags: BlockTag[];
  /** One-line flavour description shown in the UI */
  flavour: string;
  /**
   * 8-row zone layout override.
   * Index 0 = row 0 (street / nearest), index 7 = row 7 (rooftop / farthest).
   * Omit a row to inherit the default ZONE_LAYOUT from blockStore.
   */
  zoneOverrides?: Partial<Record<number, BlockZoneType>>;
  /**
   * Projection profile overrides — only supply what differs from DEFAULT_PROFILE.
   * Lets each block feel visually distinct (wider street, higher horizon, etc.).
   */
  projectionOverrides?: Partial<ProjectionProfile>;
  /** Income multiplier applied to all dealer earnings on this block (1.0 = normal) */
  incomeMultiplier: number;
  /** Heat decay rate multiplier (>1 = heat drops faster, <1 = heat lingers) */
  heatDecayMultiplier: number;
  /** Cover bonus added to all cells (0-0.3) */
  globalCoverBonus: number;
  /** Starting morale when the player first claims this block */
  startingMorale: number;
  /** Max members that can be deployed on this block */
  maxMembers: number;
  /** Whether this block starts with a police presence (raises initial heat) */
  hotBlock: boolean;
  /** Initial heat level when claimed (0-5) */
  startingHeat: number;
}

// ─── Premade Block Library ────────────────────────────────────

export const BLOCK_DNA_LIBRARY: BlockDNA[] = [
  // ── 1. Las Olas Blvd (the hero block — default scene) ────────
  {
    id: 'las-olas-1208',
    name: '1208 Las Olas',
    address: '1208 E Las Olas Blvd',
    city: 'Fort Lauderdale',
    state: 'FL',
    lat: 26.1201,
    lng: -80.1348,
    tier: 'mid',
    tags: ['corner-store', 'open-air'],
    flavour: 'Tourist strip with deep pockets. High visibility, high risk.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'storefront',
      4: 'alley',
      5: 'sidewalk',
      6: 'curb',
      7: 'rooftop',
    },
    projectionOverrides: DEFAULT_PROFILE,
    incomeMultiplier: 1.0,
    heatDecayMultiplier: 1.0,
    globalCoverBonus: 0,
    startingMorale: 70,
    maxMembers: 8,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 2. Overtown Corner (starter block — low heat, low income) ─
  {
    id: 'overtown-nw3',
    name: 'NW 3rd Ave Corner',
    address: '1400 NW 3rd Ave',
    city: 'Miami',
    state: 'FL',
    lat: 25.7875,
    lng: -80.2016,
    tier: 'starter',
    tags: ['corner-store', 'open-air'],
    flavour: 'Quiet corner. Good place to learn the game before the wolves find you.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'storefront',
      4: 'storefront',
      5: 'alley',
      6: 'parking',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.92,
      horizonYRatio: 0.30,
      actorHeightRatio: 0.24,
    },
    incomeMultiplier: 0.75,
    heatDecayMultiplier: 1.4,
    globalCoverBonus: 0.05,
    startingMorale: 80,
    maxMembers: 6,
    hotBlock: false,
    startingHeat: 0,
  },

  // ── 3. Liberty City Alley (alley-heavy, high cover) ──────────
  {
    id: 'liberty-city-alley',
    name: 'Liberty City Alley',
    address: '6200 NW 17th Ave',
    city: 'Miami',
    state: 'FL',
    lat: 25.8487,
    lng: -80.2298,
    tier: 'mid',
    tags: ['alley-heavy', 'open-air'],
    flavour: 'Maze of alleys. Dealers are hard to hit but deals take longer to close.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'alley',
      3: 'alley',
      4: 'alley',
      5: 'storefront',
      6: 'parking',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.93,
      horizonYRatio: 0.32,
      cellWidthRatio: 0.09,
    },
    incomeMultiplier: 0.85,
    heatDecayMultiplier: 1.2,
    globalCoverBonus: 0.15,
    startingMorale: 65,
    maxMembers: 7,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 4. Wynwood Warehouse (high income, slow heat decay) ───────
  {
    id: 'wynwood-warehouse',
    name: 'Wynwood Warehouse',
    address: '2700 NW 2nd Ave',
    city: 'Miami',
    state: 'FL',
    lat: 25.7999,
    lng: -80.1994,
    tier: 'high',
    tags: ['warehouse', 'alley-heavy'],
    flavour: 'Art district front. Big money moves here but the feds are watching.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'storefront',
      4: 'alley',
      5: 'alley',
      6: 'parking',
      7: 'building',
    },
    projectionOverrides: {
      groundYRatio: 0.95,
      horizonYRatio: 0.25,
      actorHeightRatio: 0.28,
      cellWidthRatio: 0.115,
    },
    incomeMultiplier: 1.5,
    heatDecayMultiplier: 0.7,
    globalCoverBonus: 0.1,
    startingMorale: 60,
    maxMembers: 10,
    hotBlock: true,
    startingHeat: 2,
  },

  // ── 5. South Beach Strip (beachfront, max exposure) ──────────
  {
    id: 'south-beach-ocean',
    name: 'Ocean Drive Strip',
    address: '1000 Ocean Dr',
    city: 'Miami Beach',
    state: 'FL',
    lat: 25.7814,
    lng: -80.1300,
    tier: 'elite',
    tags: ['beachfront', 'open-air', 'strip-mall'],
    flavour: 'Maximum visibility. Tourists spend big but every cop on the beach can see you.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'storefront',
      4: 'storefront',
      5: 'sidewalk',
      6: 'curb',
      7: 'street',
    },
    projectionOverrides: {
      groundYRatio: 0.90,
      horizonYRatio: 0.22,
      actorHeightRatio: 0.30,
      cellWidthRatio: 0.12,
      shadowLengthRatio: 0.55,
    },
    incomeMultiplier: 2.0,
    heatDecayMultiplier: 0.5,
    globalCoverBonus: -0.05,
    startingMorale: 55,
    maxMembers: 8,
    hotBlock: true,
    startingHeat: 3,
  },

  // ── 6. Opa-locka Parking Lot (parking-heavy, mid risk) ───────
  {
    id: 'opalocka-parking',
    name: 'Opa-locka Lot',
    address: '490 Ali Baba Ave',
    city: 'Opa-locka',
    state: 'FL',
    lat: 25.9016,
    lng: -80.2498,
    tier: 'mid',
    tags: ['parking-lot', 'open-air'],
    flavour: 'Abandoned lot. Plenty of cover but the Vipers run this side of town.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'parking',
      3: 'parking',
      4: 'parking',
      5: 'alley',
      6: 'storefront',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.91,
      horizonYRatio: 0.31,
      cellWidthRatio: 0.11,
    },
    incomeMultiplier: 0.9,
    heatDecayMultiplier: 1.1,
    globalCoverBonus: 0.08,
    startingMorale: 70,
    maxMembers: 7,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 7. Little Havana Storefront (rooftop access, high cover) ─
  {
    id: 'little-havana-8th',
    name: 'Calle Ocho Spot',
    address: '1600 SW 8th St',
    city: 'Miami',
    state: 'FL',
    lat: 25.7654,
    lng: -80.2201,
    tier: 'high',
    tags: ['rooftop-access', 'corner-store'],
    flavour: 'Three-story building. Rooftop shooters have line-of-sight on the whole block.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'storefront',
      4: 'storefront',
      5: 'alley',
      6: 'building',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.93,
      horizonYRatio: 0.20,
      actorHeightRatio: 0.27,
      zNear: 3.0,
      rowDepth: 0.65,
    },
    incomeMultiplier: 1.2,
    heatDecayMultiplier: 0.9,
    globalCoverBonus: 0.12,
    startingMorale: 72,
    maxMembers: 9,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 8. Carol City Strip Mall (elite, max members) ────────────
  {
    id: 'carol-city-183rd',
    name: 'Carol City Strip',
    address: '18300 NW 27th Ave',
    city: 'Miami Gardens',
    state: 'FL',
    lat: 25.9420,
    lng: -80.2498,
    tier: 'elite',
    tags: ['strip-mall', 'parking-lot', 'rooftop-access'],
    flavour: 'End-game territory. The most money in South Florida — and the most heat.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'storefront',
      4: 'storefront',
      5: 'parking',
      6: 'alley',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.94,
      horizonYRatio: 0.24,
      actorHeightRatio: 0.29,
      cellWidthRatio: 0.115,
      zNear: 3.2,
      rowDepth: 0.62,
    },
    incomeMultiplier: 1.8,
    heatDecayMultiplier: 0.65,
    globalCoverBonus: 0.05,
    startingMorale: 60,
    maxMembers: 12,
    hotBlock: true,
    startingHeat: 2,
  },
];

// ─── Lookup helpers ───────────────────────────────────────────

/** Find a DNA record by ID. Returns undefined if not found. */
export function getDNAById(id: string): BlockDNA | undefined {
  return BLOCK_DNA_LIBRARY.find((dna) => dna.id === id);
}

/**
 * Find the nearest DNA record to a lat/lng.
 * Used when the player enters a custom address that doesn't match any preset.
 */
export function getNearestDNA(lat: number, lng: number): BlockDNA {
  let nearest = BLOCK_DNA_LIBRARY[0];
  let nearestDist = Infinity;
  for (const dna of BLOCK_DNA_LIBRARY) {
    const dlat = dna.lat - lat;
    const dlng = dna.lng - lng;
    const dist = dlat * dlat + dlng * dlng;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = dna;
    }
  }
  return nearest;
}

/**
 * Build a resolved ProjectionProfile for a block DNA.
 * Merges the DNA's projectionOverrides on top of DEFAULT_PROFILE.
 */
export function resolveProjectionProfile(dna: BlockDNA): ProjectionProfile {
  if (!dna.projectionOverrides) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...dna.projectionOverrides };
}

/** Filter library by tier. */
export function getDNAByTier(tier: BlockTier): BlockDNA[] {
  return BLOCK_DNA_LIBRARY.filter((dna) => dna.tier === tier);
}

/** All DNA records sorted by income multiplier descending. */
export const BLOCK_DNA_BY_INCOME: BlockDNA[] = [...BLOCK_DNA_LIBRARY].sort(
  (a, b) => b.incomeMultiplier - a.incomeMultiplier,
);
