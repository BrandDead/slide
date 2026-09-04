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
    address: '1208 W Las Olas Blvd',
    city: 'Fort Lauderdale',
    state: 'FL',
    lat: 26.1186239,
    lng: -80.1574818,
    tier: 'mid',
    tags: ['corner-store', 'open-air'],
    flavour: 'Sailboat Bend corridor near the river. Low-rise frontage, palms, water-adjacent escape routes, and neighborhood traffic.',
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

  // ── 9. Brownsville Court (Class 1 — urban decay starter) ─────
  {
    id: 'brownsville-court',
    name: 'Brownsville Court',
    address: '5100 NW 24th Ct',
    city: 'Miami',
    state: 'FL',
    lat: 25.8190,
    lng: -80.2410,
    tier: 'starter',
    tags: ['alley-heavy', 'corner-store'],
    flavour: 'Boarded-up court. Nobody looks twice here — perfect first trap.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'alley',
      3: 'alley',
      4: 'storefront',
      5: 'alley',
      6: 'parking',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.92,
      horizonYRatio: 0.31,
      actorHeightRatio: 0.24,
    },
    incomeMultiplier: 0.7,
    heatDecayMultiplier: 1.5,
    globalCoverBonus: 0.12,
    startingMorale: 82,
    maxMembers: 5,
    hotBlock: false,
    startingHeat: 0,
  },

  // ── 10. Pompano Strip Mall (Class 2 — suburban, mid income) ──
  {
    id: 'pompano-strip',
    name: 'Pompano Strip Plaza',
    address: '1400 N Federal Hwy',
    city: 'Pompano Beach',
    state: 'FL',
    lat: 26.2478,
    lng: -80.1120,
    tier: 'mid',
    tags: ['strip-mall', 'parking-lot'],
    flavour: 'Suburban sprawl. Soccer moms by day, steady handoffs by night.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'parking',
      3: 'parking',
      4: 'storefront',
      5: 'storefront',
      6: 'sidewalk',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.93,
      horizonYRatio: 0.27,
      actorHeightRatio: 0.26,
      cellWidthRatio: 0.105,
    },
    incomeMultiplier: 1.1,
    heatDecayMultiplier: 1.0,
    globalCoverBonus: 0.06,
    startingMorale: 72,
    maxMembers: 8,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 11. Coral Gables Estate Wall (Class 3 — gated estates) ───
  {
    id: 'coral-gables-estate',
    name: 'Gables Estate Wall',
    address: '1200 Coral Way',
    city: 'Coral Gables',
    state: 'FL',
    lat: 25.7492,
    lng: -80.2615,
    tier: 'elite',
    tags: ['rooftop-access', 'open-air'],
    flavour: 'Gated money. Rich clients pay double — private security shoots first.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'sidewalk',
      4: 'storefront',
      5: 'building',
      6: 'building',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.94,
      horizonYRatio: 0.19,
      actorHeightRatio: 0.29,
      zNear: 3.3,
      rowDepth: 0.6,
    },
    incomeMultiplier: 2.2,
    heatDecayMultiplier: 0.45,
    globalCoverBonus: -0.02,
    startingMorale: 58,
    maxMembers: 9,
    hotBlock: true,
    startingHeat: 3,
  },

  // ── 12. Hialeah Warehouse Row (Class 1 — industrial decay) ───
  {
    id: 'hialeah-warehouse-row',
    name: 'Hialeah Warehouse Row',
    address: '2200 W 76th St',
    city: 'Hialeah',
    state: 'FL',
    lat: 25.8894,
    lng: -80.2920,
    tier: 'mid',
    tags: ['warehouse', 'alley-heavy'],
    flavour: 'Rust-belt loading docks. Cheap to hold, hard to raid.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'parking',
      3: 'alley',
      4: 'alley',
      5: 'storefront',
      6: 'parking',
      7: 'building',
    },
    projectionOverrides: {
      groundYRatio: 0.95,
      horizonYRatio: 0.26,
      actorHeightRatio: 0.27,
      cellWidthRatio: 0.11,
    },
    incomeMultiplier: 1.05,
    heatDecayMultiplier: 1.15,
    globalCoverBonus: 0.14,
    startingMorale: 68,
    maxMembers: 9,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 13. Hollywood Beach Broadwalk (Class 3 — tourist elite) ──
  {
    id: 'hollywood-broadwalk',
    name: 'Hollywood Broadwalk',
    address: '300 N Broadwalk',
    city: 'Hollywood',
    state: 'FL',
    lat: 26.0189,
    lng: -80.1168,
    tier: 'elite',
    tags: ['beachfront', 'open-air'],
    flavour: 'Tourist cash on the sand. Zero cover — bring your own crowd.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'sidewalk',
      4: 'storefront',
      5: 'sidewalk',
      6: 'curb',
      7: 'street',
    },
    projectionOverrides: {
      groundYRatio: 0.90,
      horizonYRatio: 0.21,
      actorHeightRatio: 0.30,
      cellWidthRatio: 0.12,
      shadowLengthRatio: 0.6,
    },
    incomeMultiplier: 2.1,
    heatDecayMultiplier: 0.5,
    globalCoverBonus: -0.06,
    startingMorale: 56,
    maxMembers: 8,
    hotBlock: true,
    startingHeat: 3,
  },

  // ── 14. Liberty Square Projects (Class 1 — urban decay, hot) ─
  {
    id: 'liberty-square-projects',
    name: 'Liberty Square',
    address: '1400 NW 63rd St',
    city: 'Miami',
    state: 'FL',
    lat: 25.8415,
    lng: -80.2213,
    tier: 'starter',
    tags: ['open-air', 'alley-heavy'],
    flavour: 'The Pork & Beans. Everyone knows everyone — word travels fast.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'alley',
      4: 'storefront',
      5: 'alley',
      6: 'curb',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.92,
      horizonYRatio: 0.30,
      actorHeightRatio: 0.24,
    },
    incomeMultiplier: 0.85,
    heatDecayMultiplier: 0.9,
    globalCoverBonus: 0.1,
    startingMorale: 75,
    maxMembers: 6,
    hotBlock: true,
    startingHeat: 2,
  },

  // ── 15. Plantation Acres Ranch (Class 2 — suburban low heat) ─
  {
    id: 'plantation-acres',
    name: 'Plantation Acres',
    address: '11500 W Broward Blvd',
    city: 'Plantation',
    state: 'FL',
    lat: 26.1217,
    lng: -80.2660,
    tier: 'mid',
    tags: ['open-air', 'parking-lot'],
    flavour: 'Horse country at the edge of the suburbs. Slow money, zero heat.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'parking',
      3: 'parking',
      4: 'parking',
      5: 'sidewalk',
      6: 'curb',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.91,
      horizonYRatio: 0.33,
      actorHeightRatio: 0.23,
      cellWidthRatio: 0.10,
    },
    incomeMultiplier: 0.95,
    heatDecayMultiplier: 1.6,
    globalCoverBonus: 0.04,
    startingMorale: 78,
    maxMembers: 7,
    hotBlock: false,
    startingHeat: 0,
  },

  // ── 16. Downtown Brickell High-Rise (Class 3 — gated estates) ─
  {
    id: 'brickell-highrise',
    name: 'Brickell High-Rise',
    address: '950 Brickell Ave',
    city: 'Miami',
    state: 'FL',
    lat: 25.7630,
    lng: -80.1918,
    tier: 'elite',
    tags: ['rooftop-access', 'warehouse'],
    flavour: 'Condo towers and valet lanes. Vertical turf for the endgame crew.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'sidewalk',
      3: 'storefront',
      4: 'building',
      5: 'building',
      6: 'building',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.95,
      horizonYRatio: 0.18,
      actorHeightRatio: 0.28,
      zNear: 3.4,
      rowDepth: 0.58,
    },
    incomeMultiplier: 2.4,
    heatDecayMultiplier: 0.55,
    globalCoverBonus: 0.08,
    startingMorale: 62,
    maxMembers: 11,
    hotBlock: true,
    startingHeat: 2,
  },

  // ── 17. Dania Jai-Alai Lot (Class 2 — suburban mid risk) ─────
  {
    id: 'dania-jai-alai',
    name: 'Dania Jai-Alai Lot',
    address: '301 E Dania Beach Blvd',
    city: 'Dania Beach',
    state: 'FL',
    lat: 26.0523,
    lng: -80.1439,
    tier: 'mid',
    tags: ['parking-lot', 'strip-mall'],
    flavour: 'Old fronton parking lot. Night crowd pays cash and asks nothing.',
    zoneOverrides: {
      0: 'street',
      1: 'curb',
      2: 'parking',
      3: 'parking',
      4: 'storefront',
      5: 'alley',
      6: 'parking',
      7: 'rooftop',
    },
    projectionOverrides: {
      groundYRatio: 0.92,
      horizonYRatio: 0.28,
      actorHeightRatio: 0.25,
      cellWidthRatio: 0.108,
    },
    incomeMultiplier: 1.15,
    heatDecayMultiplier: 0.95,
    globalCoverBonus: 0.07,
    startingMorale: 70,
    maxMembers: 8,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 18. Harbor Spur (industrial high capacity) ────────────────
  {
    id: 'harbor-spur',
    name: 'Harbor Spur',
    address: 'Freight Spur & Dockside Ave',
    city: 'South Coast',
    state: 'FL',
    lat: 25.7752,
    lng: -80.1748,
    tier: 'high',
    tags: ['warehouse', 'parking-lot'],
    flavour: 'Container lanes and loading bays. Wide approaches pay well but leave a crew exposed.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'parking', 3: 'parking', 4: 'storefront', 5: 'alley', 6: 'building', 7: 'rooftop' },
    projectionOverrides: { groundYRatio: 0.96, horizonYRatio: 0.27, actorHeightRatio: 0.28, cellWidthRatio: 0.12 },
    incomeMultiplier: 1.45,
    heatDecayMultiplier: 0.72,
    globalCoverBonus: 0.13,
    startingMorale: 64,
    maxMembers: 10,
    hotBlock: true,
    startingHeat: 2,
  },

  // ── 19. Rail Market (street commerce, hot) ────────────────────
  {
    id: 'rail-market',
    name: 'Rail Market',
    address: 'Viaduct Market & Ember St',
    city: 'South Coast',
    state: 'FL',
    lat: 25.7896,
    lng: -80.1862,
    tier: 'high',
    tags: ['corner-store', 'rooftop-access'],
    flavour: 'Late trains and stacked storefronts. The turnover is fast, and so is the attention.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'sidewalk', 3: 'storefront', 4: 'storefront', 5: 'alley', 6: 'building', 7: 'rooftop' },
    projectionOverrides: { groundYRatio: 0.93, horizonYRatio: 0.22, actorHeightRatio: 0.29, rowDepth: 0.61 },
    incomeMultiplier: 1.35,
    heatDecayMultiplier: 0.76,
    globalCoverBonus: 0.11,
    startingMorale: 69,
    maxMembers: 9,
    hotBlock: true,
    startingHeat: 2,
  },

  // ── 20. Canal Court (defensive starter) ────────────────────────
  {
    id: 'canal-court',
    name: 'Canal Court',
    address: 'Canal Court & Lantern Bridge',
    city: 'South Coast',
    state: 'FL',
    lat: 26.0437,
    lng: -80.1518,
    tier: 'starter',
    tags: ['open-air', 'alley-heavy'],
    flavour: 'A quiet bridge choke point with rear lanes to disappear into when pressure rises.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'sidewalk', 3: 'alley', 4: 'alley', 5: 'parking', 6: 'building', 7: 'rooftop' },
    projectionOverrides: { groundYRatio: 0.91, horizonYRatio: 0.31, actorHeightRatio: 0.24, cellWidthRatio: 0.095 },
    incomeMultiplier: 0.82,
    heatDecayMultiplier: 1.42,
    globalCoverBonus: 0.19,
    startingMorale: 84,
    maxMembers: 6,
    hotBlock: false,
    startingHeat: 0,
  },

  // ── 21. Stadium Service (elite service district) ───────────────
  {
    id: 'stadium-service',
    name: 'Stadium Service',
    address: 'Service Gate & Floodlight Way',
    city: 'South Coast',
    state: 'FL',
    lat: 26.1592,
    lng: -80.2191,
    tier: 'elite',
    tags: ['parking-lot', 'warehouse'],
    flavour: 'Floodlit service lanes and a fenced utility yard. Capacity comes with pressure.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'parking', 3: 'parking', 4: 'storefront', 5: 'building', 6: 'building', 7: 'rooftop' },
    projectionOverrides: { groundYRatio: 0.95, horizonYRatio: 0.23, actorHeightRatio: 0.29, cellWidthRatio: 0.125, zNear: 3.25 },
    incomeMultiplier: 1.9,
    heatDecayMultiplier: 0.58,
    globalCoverBonus: 0.08,
    startingMorale: 61,
    maxMembers: 12,
    hotBlock: true,
    startingHeat: 3,
  },

  // ── 22. Night Market (balanced commerce) ───────────────────────
  {
    id: 'night-market',
    name: 'Night Market',
    address: 'Neon Market & Glasshouse Ave',
    city: 'South Coast',
    state: 'FL',
    lat: 25.8091,
    lng: -80.2074,
    tier: 'mid',
    tags: ['corner-store', 'open-air'],
    flavour: 'A dense night strip with a clean street-facing front and one useful rear exit.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'sidewalk', 3: 'storefront', 4: 'storefront', 5: 'alley', 6: 'parking', 7: 'rooftop' },
    projectionOverrides: { groundYRatio: 0.92, horizonYRatio: 0.28, actorHeightRatio: 0.26, cellWidthRatio: 0.105 },
    incomeMultiplier: 1.28,
    heatDecayMultiplier: 0.88,
    globalCoverBonus: 0.07,
    startingMorale: 74,
    maxMembers: 8,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 23. Courtyard Walkups (resilient residential) ──────────────
  {
    id: 'courtyard-walkups',
    name: 'Courtyard Walkups',
    address: 'Courtyard Row & Garden Walk',
    city: 'South Coast',
    state: 'FL',
    lat: 25.8338,
    lng: -80.2366,
    tier: 'starter',
    tags: ['alley-heavy', 'rooftop-access'],
    flavour: 'Tight walkups and connected courtyards. A smaller crew can hold this ground.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'sidewalk', 3: 'alley', 4: 'storefront', 5: 'building', 6: 'building', 7: 'rooftop' },
    projectionOverrides: { groundYRatio: 0.93, horizonYRatio: 0.29, actorHeightRatio: 0.25, rowDepth: 0.66 },
    incomeMultiplier: 0.92,
    heatDecayMultiplier: 1.18,
    globalCoverBonus: 0.18,
    startingMorale: 88,
    maxMembers: 7,
    hotBlock: false,
    startingHeat: 0,
  },

  // ── 24. Floodgate Repair (waterfront service) ──────────────────
  {
    id: 'floodgate-repair',
    name: 'Floodgate Repair',
    address: 'Floodgate Lane & Drydock Rd',
    city: 'South Coast',
    state: 'FL',
    lat: 26.0756,
    lng: -80.1289,
    tier: 'mid',
    tags: ['parking-lot', 'open-air'],
    flavour: 'A repair lane between water and workshop doors. Its lanes reward mixed placement.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'parking', 3: 'sidewalk', 4: 'storefront', 5: 'alley', 6: 'parking', 7: 'rooftop' },
    projectionOverrides: { groundYRatio: 0.94, horizonYRatio: 0.27, actorHeightRatio: 0.26, cellWidthRatio: 0.11 },
    incomeMultiplier: 1.12,
    heatDecayMultiplier: 1.04,
    globalCoverBonus: 0.14,
    startingMorale: 71,
    maxMembers: 8,
    hotBlock: false,
    startingHeat: 1,
  },

  // ── 25. Ring Road Underpass (covered control point) ────────────
  {
    id: 'ring-road-underpass',
    name: 'Ring Road Underpass',
    address: 'Ring Road & Pillar 17',
    city: 'South Coast',
    state: 'FL',
    lat: 25.8704,
    lng: -80.2602,
    tier: 'mid',
    tags: ['parking-lot', 'alley-heavy'],
    flavour: 'Covered frontage and hidden parking. Low profile, limited scale, dependable cover.',
    zoneOverrides: { 0: 'street', 1: 'curb', 2: 'parking', 3: 'alley', 4: 'alley', 5: 'storefront', 6: 'parking', 7: 'building' },
    projectionOverrides: { groundYRatio: 0.95, horizonYRatio: 0.30, actorHeightRatio: 0.25, cellWidthRatio: 0.108 },
    incomeMultiplier: 0.98,
    heatDecayMultiplier: 1.26,
    globalCoverBonus: 0.21,
    startingMorale: 76,
    maxMembers: 7,
    hotBlock: false,
    startingHeat: 1,
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
