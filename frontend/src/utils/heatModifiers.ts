/**
 * heatModifiers.ts
 * ---------------------------------------------------------------------------
 * Connects the Morale & Heat system to the DealtMode (Tinder-style dealing)
 * mini-game. When block heat is high, undercover cops appear in the customer
 * queue, payouts shrink (nervous buyers), and the drug tier on the block
 * affects customer quality.
 *
 * Used by DealtMode's customer generator:
 *   const heat = useGameStore(s => s.heat);
 *   const tier = useDrugInventory(s => s.getBlockDrugTier());
 *   const mods = getDealtModeModifiers(heat, tier);
 *
 *   if (Math.random() < mods.undercoverCopChance) {
 *     customer = generateUndercoverCop(heat, tier);
 *   } else {
 *     customer = generateRegularCustomer(mods);
 *   }
 * ---------------------------------------------------------------------------
 */

import type { DrugTier } from '../stores/useDrugInventory';
import { TIER_CONFIG } from '../stores/useDrugInventory';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DealtModeModifiers {
  /** 0–1 probability that the next customer is an undercover cop. */
  undercoverCopChance: number;
  /** Multiplier applied to deal payouts (high heat = nervous buyers = less). */
  payoutModifier: number;
  /** 1–4, biases customer quality (higher tier drugs attract better buyers). */
  customerQualityTier: number;
  /** 0–1, affects how many "tells" an undercover cop reveals. */
  copSubtlety: number;
  /** Label for UI display. */
  heatWarning: string;
}

export type CustomerType = 'regular' | 'vip' | 'undercover_cop' | 'addict';

export interface CustomerProfile {
  id: string;
  name: string;
  avatar: string; // emoji or initial
  type: CustomerType;
  demeanor: string;
  offerAmount: number;
  quantityRequested: number;
  /** Subtle hint strings for undercover cops — empty for regulars. */
  tells: string[];
  /** True if accepting this customer triggers a bust. */
  isCop: boolean;
  /** Risk flavor text. */
  riskLabel: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Heat thresholds (0–100 scale). */
const HEAT_LOW = 20;
const HEAT_MEDIUM = 50;
const HEAT_HIGH = 80;

/** Max cop chance at 100 heat (before tier bonus). */
const MAX_BASE_COP_CHANCE = 0.18;

/** Additional cop chance per drug tier above 'street'. */
const TIER_COP_BONUS: Record<DrugTier, number> = {
  street: 0.0,
  pure: 0.03,
  exotic: 0.06,
  legendary: 0.10,
};

/** Cop tell strings — an observant player can spot these. */
const COP_TELLS = [
  'Asks for a specific weight — too precise for a street buy.',
  'Doesn\'t haggle. Accepts the first price without flinching.',
  'Keeps glancing at something in their jacket pocket.',
  'Speaks too clearly. No slang, no code words.',
  'Asks where "the rest of the crew" is.',
  'Wants to meet again tomorrow. Cops love follow-up busts.',
  'Shoes are too clean for this neighborhood.',
  'Pays with crisp, sequential bills.',
  'Asks if you\'re "the one in charge."',
  'Doesn\'t seem high. Pupils normal, speech steady.',
  'Wants to see the product up close — evidence collection.',
  'Mentions a "friend" who also wants to buy — bringing backup.',
];

/** Cop names (generic, forgettable — another subtle tell). */
const COP_NAMES = [
  'John Smith', 'Mike Jones', 'Dave Brown', 'Steve Davis',
  'Tom Wilson', 'Chris Miller', 'Pat Taylor', 'Mark Anderson',
  'Rob Thomas', 'Lee Harris', 'Dan Martin', 'Joe Thompson',
];

/** Regular customer names. */
const REGULAR_NAMES = [
  'Slim', 'T-Ray', 'Key-Key', 'Bookie', 'Munchies', 'D-Lo',
  'LaRonda', 'Pookie', 'Fresh', 'Noodles', 'Stix', 'Whisper',
  'C-Note', 'Breeze', 'Hustle Man', 'Miss Dee', 'Lil Bit', 'Spoon',
];

/** VIP customer names (attracted by exotic/legendary drugs). */
const VIP_NAMES = [
  'The Architect', 'Mr. Cleantop', 'Madame V', 'The Collector',
  'Mr. Crystal', 'Lady Silk', 'Diamond Dave', 'The Critic',
];

const ADDICT_NAMES = [
  'Jitterbug', 'Scratch', 'Wobble', 'Twitch', 'Ghost', 'Rabbit',
  'Fidget', 'Spin-out', 'Crash', 'Zero',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

/** Deterministic RNG from heat + time (so cop tells aren't fully random). */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Modifier calculation ────────────────────────────────────────────────────

/**
 * Compute DealtMode modifiers from current block heat and assigned drug tier.
 *
 * @param heat    Block heat level (0–100).
 * @param drugTier Highest drug tier assigned to any dealer, or null.
 */
export function getDealtModeModifiers(
  heat: number,
  drugTier: DrugTier | null,
): DealtModeModifiers {
  const tier = drugTier ?? 'street';
  const heatNorm = clamp(heat, 0, 100) / 100; // 0–1

  // Cop chance scales with heat, plus a tier bonus
  const baseCopChance = heatNorm * MAX_BASE_COP_CHANCE;
  const tierBonus = TIER_COP_BONUS[tier] * heatNorm; // tier bonus only matters when heat is high
  const undercoverCopChance = clamp01(baseCopChance + tierBonus);

  // Payout modifier: high heat = nervous buyers = lower payouts
  // At 0 heat: 1.2x (bold buyers). At 100 heat: 0.6x (scared buyers).
  const payoutModifier = lerp(1.2, 0.6, heatNorm);

  // Customer quality tier from drug tier
  const customerQualityTier = TIER_CONFIG[tier].dealtModeQuality;

  // Cop subtlety: higher heat = more experienced cops = fewer tells
  const copSubtlety = clamp01(heatNorm * 0.7);

  // Heat warning label
  let heatWarning: string;
  if (heat < HEAT_LOW) heatWarning = 'Streets are quiet';
  else if (heat < HEAT_MEDIUM) heatWarning = 'Police noticed activity';
  else if (heat < HEAT_HIGH) heatWarning = 'Undercover units deployed';
  else heatWarning = 'ACTIVE MANHUNT — extreme risk';

  return {
    undercoverCopChance,
    payoutModifier,
    customerQualityTier,
    copSubtlety,
    heatWarning,
  };
}

/**
 * Probabilistic check: should the next customer be an undercover cop?
 * Call this per-customer in the DealtMode card generator.
 */
export function shouldInjectCop(modifiers: DealtModeModifiers, rng: () => number = Math.random): boolean {
  return rng() < modifiers.undercoverCopChance;
}

// ── Customer generation ─────────────────────────────────────────────────────

/**
 * Generate an undercover cop customer card.
 * The cop has subtle "tells" — the number of visible tells decreases
 * as heat rises (more experienced cops at higher heat).
 *
 * If the player swipes right (accepts the deal), they get busted:
 *   - Heat spikes
 *   - Cash confiscated
 *   - Possibly lose the assigned dealer
 */
export function generateUndercoverCop(
  heat: number,
  drugTier: DrugTier | null,
  rng?: () => number,
): CustomerProfile {
  const seed = Math.floor(heat * 1000) + Date.now();
  const random = rng ?? seededRng(seed);

  const heatNorm = clamp(heat, 0, 100) / 100;
  const tier = drugTier ?? 'street';

  // Number of tells: 3-4 at low heat (sloppy cops), 1-2 at high heat (pros)
  const maxTells = Math.max(1, Math.round(4 - heatNorm * 2.5));
  const tells = pickN(COP_TELLS, maxTells, random);

  // Offer amount: cops offer slightly above market to entice the deal
  const baseOffer = 80 + TIER_CONFIG[tier].dealtModeQuality * 40;
  const offerAmount = Math.round(baseOffer * (1.1 + random() * 0.3));

  return {
    id: `cop_${Date.now()}_${Math.floor(random() * 10000)}`,
    name: pick(COP_NAMES, random),
    avatar: '👤',
    type: 'undercover_cop',
    demeanor: 'calm',
    offerAmount,
    quantityRequested: 1 + Math.floor(random() * 3),
    tells,
    isCop: true,
    riskLabel: heatNorm > 0.7 ? 'HIGH RISK' : 'SUSPICIOUS',
  };
}

/**
 * Generate a regular customer card, influenced by drug tier and heat.
 */
export function generateRegularCustomer(
  modifiers: DealtModeModifiers,
  rng?: () => number,
): CustomerProfile {
  const seed = Date.now() + Math.floor(Math.random() * 100000);
  const random = rng ?? seededRng(seed);

  const qualityTier = modifiers.customerQualityTier;

  // Customer type weighted by drug quality
  let type: CustomerType;
  const roll = random();
  if (qualityTier >= 3 && roll < 0.15) {
    type = 'vip';
  } else if (qualityTier >= 2 && roll < 0.25) {
    type = 'vip';
  } else if (roll < 0.35) {
    type = 'addict';
  } else {
    type = 'regular';
  }

  // Name by type
  let name: string;
  let avatar: string;
  let demeanor: string;
  let riskLabel: string;
  switch (type) {
    case 'vip':
      name = pick(VIP_NAMES, random);
      avatar = '💎';
      demeanor = 'confident';
      riskLabel = 'LOW';
      break;
    case 'addict':
      name = pick(ADDICT_NAMES, random);
      avatar = '😵';
      demeanor = 'desperate';
      riskLabel = 'LOW';
      break;
    default:
      name = pick(REGULAR_NAMES, random);
      avatar = '🧑';
      demeanor = random() > 0.5 ? 'casual' : 'nervous';
      riskLabel = 'LOW';
      break;
  }

  // Offer amount: base by type, modified by payout modifier and quality tier
  let baseOffer: number;
  switch (type) {
    case 'vip':     baseOffer = 200 + qualityTier * 60; break;
    case 'addict':  baseOffer = 30 + qualityTier * 10; break;
    default:        baseOffer = 60 + qualityTier * 25; break;
  }
  const offerAmount = Math.round(baseOffer * modifiers.payoutModifier * (0.9 + random() * 0.2));

  // Quantity requested
  let quantityRequested: number;
  switch (type) {
    case 'vip':     quantityRequested = 3 + Math.floor(random() * 4); break;
    case 'addict':  quantityRequested = 1; break;
    default:        quantityRequested = 1 + Math.floor(random() * 2); break;
  }

  return {
    id: `cust_${Date.now()}_${Math.floor(random() * 10000)}`,
    name,
    avatar,
    type,
    demeanor,
    offerAmount,
    quantityRequested,
    tells: [],
    isCop: false,
    riskLabel,
  };
}

/**
 * Convenience: generate the next customer card, automatically deciding
 * whether it's a cop or a regular based on the modifiers.
 */
export function generateNextCustomer(
  modifiers: DealtModeModifiers,
  heat: number,
  drugTier: DrugTier | null,
): CustomerProfile {
  if (shouldInjectCop(modifiers)) {
    return generateUndercoverCop(heat, drugTier);
  }
  return generateRegularCustomer(modifiers);
}

// ── Bust consequences ──────────────────────────────────────────────────────

export interface BustConsequence {
  heatIncrease: number;
  cashLoss: number;        // percentage of current cash (0–1)
  dealerLost: boolean;     // did the assigned dealer get arrested?
  dealerLostId: string | null;
  message: string;
}

/**
 * Compute the consequences of accepting an undercover cop's deal.
 * Called when the player swipes right on a cop card in DealtMode.
 *
 * @param heat     Current block heat (0–100).
 * @param drugTier Drug tier the dealer was pushing.
 * @param dealerId The dealer involved in the deal (if known).
 */
export function resolveBust(
  heat: number,
  drugTier: DrugTier | null,
  dealerId?: string,
): BustConsequence {
  const tier = drugTier ?? 'street';
  const heatNorm = clamp(heat, 0, 100) / 100;

  // Heat spike: bigger if you were already hot
  const heatIncrease = Math.round(15 + heatNorm * 20);

  // Cash loss: 20-50% of on-hand cash confiscated
  const cashLoss = clamp(0.2 + heatNorm * 0.3, 0.2, 0.5);

  // Dealer arrest chance: 30% at low heat, 60% at high heat
  // Higher tier drugs = more attention = higher arrest chance
  const tierArrestBonus: Record<DrugTier, number> = {
    street: 0.0, pure: 0.05, exotic: 0.1, legendary: 0.15,
  };
  const arrestChance = 0.3 + heatNorm * 0.3 + tierArrestBonus[tier];
  const dealerLost = Math.random() < arrestChance;

  const message = dealerLost
    ? `BUSTED! Undercover cop arrested your dealer. Heat +${heatIncrease}. Cash seized.`
    : `BUSTED! Undercover cop got you on camera. Heat +${heatIncrease}. Cash seized.`;

  return {
    heatIncrease,
    cashLoss,
    dealerLost,
    dealerLostId: dealerLost ? (dealerId ?? null) : null,
    message,
  };
}

// ── Payout helper ──────────────────────────────────────────────────────────

/**
 * Apply heat-modified payout to a successful deal.
 */
export function applyHeatToPayout(
  basePayout: number,
  heat: number,
): number {
  const heatNorm = clamp(heat, 0, 100) / 100;
  const modifier = lerp(1.2, 0.6, heatNorm);
  return Math.round(basePayout * modifier);
}
