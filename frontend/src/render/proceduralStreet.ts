// ============================================================
// proceduralStreet — address-seeded street generation (Sprint 17)
//
// Builds the drive-by street from the SAME address the player
// entered, not from an AI-generated plate. Everything here is
// deterministic: the same block hash always yields the same
// storefronts, signs, colors, and lot layout, so a player's
// block looks like *their* block every time they slide on it.
//
// Pipeline position:
//   address → geocode → blockDNAResolver → ResolvedBlock
//        → generateStreetSegments()  ← this module
//        → DriveByStreetRenderer (perspective draw)
//
// Zone layout describes DEPTH from the near street to the far rooftop.
// It is first projected into ordered scene layers, then a separate,
// deterministic frontage sequence chooses the repeated facades that slide
// across the passenger window. Depth rows must never be consumed as columns.
// That keeps the drive-by view consistent with the top-down and 2.5D scenes.
// ============================================================

import type { BlockZoneType } from '../types/block.types';

// ─── Types ───────────────────────────────────────────────────

export type SegmentKind =
  | 'storefront'
  | 'alley'
  | 'parking'
  | 'wall'
  | 'lot';

/** Painter passes for the passenger-seat scene, sorted far → near. */
export type StreetDepthPass =
  | 'skyline'
  | 'setback'
  | 'facade'
  | 'sidewalk'
  | 'curb'
  | 'road';

/** One authoritative Block DNA row projected into the FPS scene. */
export interface StreetDepthLayer {
  /** Stable identity for future hit registration / environment damage. */
  id: string;
  /** Original 0-based Block DNA depth row; 0 is nearest to the street. */
  row: number;
  zone: BlockZoneType;
  pass: StreetDepthPass;
}

/**
 * The bridge from an authoritative 8-row Block DNA layout to the passenger
 * view. `depthLayers` is painter ordered far → near; `frontageZones` is a
 * distinct input for repeated horizontal lots.
 */
export interface StreetSceneProjection {
  depthLayers: readonly StreetDepthLayer[];
  frontageZones: readonly BlockZoneType[];
}

export interface StreetWindow {
  /** Normalized position within the facade. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Interior light on/off — drives the warm glow. */
  lit: boolean;
}

export interface StreetSegment {
  /** Stable id — used for hit registration and destruction state. */
  id: string;
  kind: SegmentKind;
  /** Along-street width in world metres. */
  widthM: number;
  /** Facade height in world metres. */
  heightM: number;
  facadeTone: string;
  trimTone: string;
  /** Neon sign color; null for unlit segments. */
  neonTone: string | null;
  /** Sign text — generic, never a real trademark. */
  sign: string | null;
  awning: boolean;
  awningTone: string;
  windows: StreetWindow[];
  /** Roll-down security gate over the shopfront. */
  shuttered: boolean;
  /** 0–1 graffiti density on the lower facade. */
  graffiti: number;
}

// ─── Deterministic RNG (mulberry32) ──────────────────────────
// Seeded from the block hash so a block's street never reshuffles.

export function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];

// ─── Style banks ─────────────────────────────────────────────
// Generic South Florida strip vocabulary. Deliberately NOT real
// business names — these are invented so nothing infringes.

const SIGN_WORDS: readonly string[] = [
  'LIQUORS', 'SMOKE SHOP', 'GOLD & PAWN', 'CAFE', 'BODEGA', 'WASH',
  'BARBER', 'CHECKS CASHED', 'WINGS', 'TIRES', 'NAILS', 'MARKET',
  'DISCOUNT', 'PHONE REPAIR', 'BOTANICA', 'CUBAN COFFEE',
];

const NEON_TONES: readonly string[] = [
  '#ff2d7a', '#2de1ff', '#39ff8b', '#ffb02d', '#b46cff', '#ff5a3c',
];

const FACADE_TONES: readonly string[] = [
  '#2a2530', '#332b2b', '#242b33', '#2e2a24', '#2b3030', '#38302c',
];

const AWNING_TONES: readonly string[] = [
  '#7a2233', '#1f4f45', '#2c3a63', '#6b4a18', '#4a2450',
];

/** Zone → visual layer in the passenger-seat depth stack. */
function passForZone(zone: BlockZoneType): StreetDepthPass {
  switch (zone) {
    case 'street': return 'road';
    case 'curb': return 'curb';
    case 'sidewalk': return 'sidewalk';
    case 'alley':
    case 'parking': return 'setback';
    case 'storefront':
    case 'building': return 'facade';
    case 'rooftop': return 'skyline';
  }
}

/** Only built-form rows may seed repeated horizontal frontage lots. */
function isFrontageSource(zone: BlockZoneType): boolean {
  return zone === 'storefront' || zone === 'building' || zone === 'alley' || zone === 'parking';
}

/** Zone source → what one horizontal frontage segment looks like. */
function kindForZone(zone: BlockZoneType, rng: () => number): SegmentKind {
  switch (zone) {
    case 'storefront': return 'storefront';
    case 'alley': return 'alley';
    case 'parking': return 'parking';
    case 'building': return 'wall';
    // This is only reached for the safe fallback when Block DNA has no built form.
    default: return rng() > 0.45 ? 'storefront' : 'lot';
  }
}

/**
 * Project the depth-only Block DNA rows into a renderable FPS scene contract.
 * The returned layers are far → near, while frontage inputs remain separate so
 * an eight-row depth layout can never accidentally become eight side-by-side
 * façades.
 */
export function projectStreetScene(zoneLayout: readonly BlockZoneType[]): StreetSceneProjection {
  const layout = zoneLayout.length ? zoneLayout : (['street', 'curb', 'sidewalk', 'storefront', 'alley', 'rooftop'] as BlockZoneType[]);
  const depthLayers = layout
    .map((zone, row) => ({
      id: `depth-${row}-${zone}`,
      row,
      zone,
      pass: passForZone(zone),
    }))
    .sort((a, b) => b.row - a.row);
  const frontageZones = layout.filter(isFrontageSource);

  return {
    depthLayers,
    frontageZones: frontageZones.length ? frontageZones : ['storefront'],
  };
}

/** Derive repeatable frontage independently from the vertical depth stack. */
function deriveFrontageZones(seed: string, sourceZones: readonly BlockZoneType[], count: number): BlockZoneType[] {
  const rng = makeRng(`${seed}:frontage`);
  const start = Math.floor(rng() * sourceZones.length) % sourceZones.length;
  return Array.from({ length: count }, (_, index) => sourceZones[(start + index + Math.floor(rng() * sourceZones.length)) % sourceZones.length]);
}

// ─── Segment builders ────────────────────────────────────────

function buildWindows(rng: () => number, cols: number, rows: number): StreetWindow[] {
  const out: StreetWindow[] = [];
  const marginX = 0.08;
  const usableW = 1 - marginX * 2;
  const cellW = usableW / cols;
  const cellH = 0.5 / Math.max(1, rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: marginX + c * cellW + cellW * 0.15,
        y: 0.08 + r * cellH + cellH * 0.15,
        w: cellW * 0.7,
        h: cellH * 0.65,
        lit: rng() > 0.42,
      });
    }
  }
  return out;
}

function buildSegment(index: number, zone: BlockZoneType, rng: () => number): StreetSegment {
  const kind = kindForZone(zone, rng);
  const id = `seg-${index}`;

  if (kind === 'alley') {
    return {
      id, kind, widthM: 4 + rng() * 3, heightM: 9 + rng() * 4,
      facadeTone: '#15161b', trimTone: '#0e0f13', neonTone: null,
      sign: null, awning: false, awningTone: '#000',
      windows: [], shuttered: false, graffiti: 0.55 + rng() * 0.45,
    };
  }

  if (kind === 'parking' || kind === 'lot') {
    return {
      id, kind, widthM: 10 + rng() * 8, heightM: 2.2,
      facadeTone: '#1a1c22', trimTone: '#2a2d36', neonTone: null,
      sign: null, awning: false, awningTone: '#000',
      windows: [], shuttered: false, graffiti: rng() * 0.3,
    };
  }

  if (kind === 'wall') {
    return {
      id, kind, widthM: 9 + rng() * 6, heightM: 12 + rng() * 6,
      facadeTone: pick(rng, FACADE_TONES), trimTone: '#14161a',
      neonTone: null, sign: null, awning: false, awningTone: '#000',
      windows: buildWindows(rng, 4, 3),
      shuttered: false, graffiti: 0.2 + rng() * 0.5,
    };
  }

  // storefront
  const shuttered = rng() > 0.78;
  return {
    id, kind,
    widthM: 7 + rng() * 5,
    heightM: 8 + rng() * 5,
    facadeTone: pick(rng, FACADE_TONES),
    trimTone: '#101216',
    neonTone: shuttered ? null : pick(rng, NEON_TONES),
    sign: pick(rng, SIGN_WORDS),
    awning: rng() > 0.5,
    awningTone: pick(rng, AWNING_TONES),
    windows: buildWindows(rng, 3, 1),
    shuttered,
    graffiti: rng() * 0.6,
  };
}

// ─── Public API ──────────────────────────────────────────────

export interface StreetGenOptions {
  /** Stable block hash from the player's geocoded address. */
  seed: string;
  /** 8-row zone layout from the resolved BlockDNA. */
  zoneLayout: readonly BlockZoneType[];
  /** How many segments to lay down; the strip loops seamlessly. */
  count?: number;
}

/**
 * Generate the repeating horizontal frontage for a block. The depth layout is
 * first projected by `projectStreetScene`; segment generation only consumes the
 * derived frontage sequence, never `zoneLayout` directly.
 */
export function generateStreetSegments({
  seed,
  zoneLayout,
  count = 14,
}: StreetGenOptions): StreetSegment[] {
  const projection = projectStreetScene(zoneLayout);
  const frontageZones = deriveFrontageZones(seed, projection.frontageZones, count);
  const rng = makeRng(`${seed}:facade-style`);
  return frontageZones.map((zone, index) => buildSegment(index, zone, rng));
}

/** Total looping length of the strip in metres. */
export function stripLengthM(segments: readonly StreetSegment[]): number {
  return segments.reduce((sum, s) => sum + s.widthM, 0);
}
