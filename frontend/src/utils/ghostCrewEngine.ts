// ============================================================
// DEALT/SLIDE — Ghost Crew Engine (#81)
//
// The computer as the rival gang. Persistent NPC crews play by the same
// rules as the player: they claim blocks from the Block DNA library,
// reinforce turf, retaliate when attacked, and expand into open ground.
//
// Design contract:
//   - Crew state is PERSISTENT (Zustand persist → localStorage) — never
//     regenerated per session. A named crew keeps its roster, treasury,
//     personality, grudges, and owned blocks across reloads.
//   - One world-tick decision per crew per tick: claim / reinforce /
//     attack / lay-low, chosen from a personality card.
//   - Claims come from the Block DNA library (#80) adjacent to the crew's
//     turf; contested blocks resolve through the normal combat path.
//   - Grudge memory: player attacks raise a persistent grudge score that
//     biases target selection toward revenge.
//   - City Feed surfacing: every visible consequence is pushed to the
//     notification store so the opposition feels alive.
//
// This engine owns territory through useBlockStore.blocks (owner: 'npc'),
// which is the same store the territory map, recon ring, and encounter
// systems read — so ghost turf shows up everywhere the player's does.
// ============================================================

import { BLOCK_DNA_LIBRARY, type BlockDNA } from '../config/blockDNA';
import { generateBlockHash } from '../config/mapbox.config';
import type { BlockData } from '../types/block.types';

// ─── Types ───────────────────────────────────────────────────

export type PersonalityType = 'territory-hungry' | 'revenge-driven' | 'money-crew' | 'chaotic';

export interface Personality {
  type: PersonalityType;
  /** 0-100: baseline willingness to attack */
  aggression: number;
  /** 0-100: desire to expand into open blocks */
  expansionDrive: number;
  /** 0-100: how strongly grudges bias target selection */
  grudgeWeight: number;
  /** 0-100: preference for defending/earning over fighting */
  caution: number;
}

export interface GhostMember {
  id: string;
  name: string;
  role: 'shooter' | 'dealer' | 'enforcer';
  level: number;
  alive: boolean;
}

export interface GrudgeEntry {
  /** Cumulative grudge score against the player (0-100) */
  score: number;
  /** Block the player last took from / attacked on this crew */
  lastIncidentBlockId?: string;
  /** ISO timestamp of last incident */
  lastIncidentAt?: string;
}

export interface GhostCrew {
  id: string;
  name: string;
  /** DNA-flavored home turf tag (e.g. 'downtown') */
  homeTag: string;
  personality: Personality;
  /** Liquid cash the crew can spend on claims/reinforcement */
  treasury: number;
  roster: GhostMember[];
  /** Block IDs this crew currently owns in blockStore */
  ownedBlockIds: string[];
  /** DNA ids this crew has already claimed (never reclaim the same card) */
  claimedDnaIds: string[];
  grudge: GrudgeEntry;
  /** Total income this crew banks per tick from its blocks */
  incomePerTick: number;
  /** ISO timestamp of last decision */
  lastTickAt: string;
  /** Human-readable last move for the feed / panel */
  lastMove?: string;
}

export type GhostActionType = 'claim' | 'reinforce' | 'attack' | 'lay-low';

export interface GhostAction {
  type: GhostActionType;
  crewId: string;
  crewName: string;
  /** Feed line shown to the player */
  description: string;
  /** Block affected, when relevant */
  targetBlockId?: string;
  targetBlockName?: string;
  /** DNA card claimed, when type === 'claim' */
  claimedDnaId?: string;
  /** Whether this move is a direct threat to the player */
  threatensPlayer: boolean;
}

export interface GhostTickContext {
  /** Player-owned blocks, read from blockStore */
  playerBlocks: BlockData[];
  /** All blocks already owned by any ghost crew */
  ghostOwnedBlockIds: Set<string>;
  /** Monotonic tick counter used for deterministic seeds */
  tickIndex: number;
}

// ─── Name pools (deterministic) ──────────────────────────────

const MEMBER_NAMES = [
  'Ghost', 'Smoke', 'Trey', 'Bricks', 'Slim', 'Ace', 'Dre', 'Boonie',
  'Casper', 'Havoc', 'Static', 'Murk', 'Reap', 'Yayo', 'Frost', 'Loco',
];

function seeded(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pickName(seed: number, salt: number): string {
  return MEMBER_NAMES[Math.floor(seeded(seed, salt) * MEMBER_NAMES.length)];
}

// ─── Default crew roster (seeded once, then persisted) ───────

function makeMember(id: string, name: string, role: GhostMember['role'], level: number): GhostMember {
  return { id, name, role, level, alive: true };
}

export const DEFAULT_GHOST_CREWS: GhostCrew[] = [
  {
    id: 'ghost-nightfall',
    name: 'Nightfall Crew',
    homeTag: 'downtown',
    personality: { type: 'territory-hungry', aggression: 55, expansionDrive: 85, grudgeWeight: 40, caution: 30 },
    treasury: 2200,
    roster: [
      makeMember('nf-1', 'Olas King', 'enforcer', 4),
      makeMember('nf-2', 'Strip Boss', 'shooter', 4),
      makeMember('nf-3', 'Beach Boy', 'dealer', 3),
    ],
    ownedBlockIds: [],
    claimedDnaIds: [],
    grudge: { score: 0 },
    incomePerTick: 0,
    lastTickAt: new Date(Date.now() - 300_000).toISOString(),
    lastMove: 'Controlling downtown Las Olas',
  },
  {
    id: 'ghost-sistrunk',
    name: 'Sistrunk Ghosts',
    homeTag: 'eastside',
    personality: { type: 'revenge-driven', aggression: 80, expansionDrive: 45, grudgeWeight: 90, caution: 20 },
    treasury: 1500,
    roster: [
      makeMember('sg-1', 'Fed Buster', 'enforcer', 4),
      makeMember('sg-2', 'All-Day', 'shooter', 3),
      makeMember('sg-3', 'Zero Fed', 'shooter', 3),
    ],
    ownedBlockIds: [],
    claimedDnaIds: [],
    grudge: { score: 15 },
    incomePerTick: 0,
    lastTickAt: new Date(Date.now() - 600_000).toISOString(),
    lastMove: 'Watching Sistrunk Blvd',
  },
  {
    id: 'ghost-riverwalk',
    name: 'Riverwalk Money Crew',
    homeTag: 'southside',
    personality: { type: 'money-crew', aggression: 30, expansionDrive: 55, grudgeWeight: 25, caution: 80 },
    treasury: 3000,
    roster: [
      makeMember('rm-1', 'Lucky 7', 'dealer', 4),
      makeMember('rm-2', 'Down-Low', 'dealer', 3),
      makeMember('rm-3', 'Seven-Up', 'enforcer', 3),
    ],
    ownedBlockIds: [],
    claimedDnaIds: [],
    grudge: { score: 0 },
    incomePerTick: 0,
    lastTickAt: new Date(Date.now() - 900_000).toISOString(),
    lastMove: 'Running the Riverwalk docks',
  },
  {
    id: 'ghost-chaos',
    name: 'Westside Wolves',
    homeTag: 'westside',
    personality: { type: 'chaotic', aggression: 70, expansionDrive: 65, grudgeWeight: 55, caution: 10 },
    treasury: 1200,
    roster: [
      makeMember('ww-1', 'Cloud 9', 'shooter', 2),
      makeMember('ww-2', 'Nine-Life', 'dealer', 2),
      makeMember('ww-3', 'Lil Niner', 'enforcer', 2),
    ],
    ownedBlockIds: [],
    claimedDnaIds: [],
    grudge: { score: 5 },
    incomePerTick: 0,
    lastTickAt: new Date(Date.now() - 450_000).toISOString(),
    lastMove: 'Tagging the west side',
  },
];

// ─── Claim economics ─────────────────────────────────────────

/** Cost for a ghost crew to claim a DNA block (same scale as the player). */
export function ghostClaimCost(dna: BlockDNA): number {
  const tierCost: Record<BlockDNA['tier'], number> = {
    starter: 1000,
    mid: 2000,
    high: 3500,
    elite: 5000,
  };
  return tierCost[dna.tier];
}

/** Income a ghost crew banks per tick from an owned DNA block. */
export function ghostBlockIncome(dna: BlockDNA): number {
  return Math.round(120 * dna.incomeMultiplier);
}

/**
 * Pick the next DNA card a crew should claim.
 *
 * Preference order:
 *   1. Unclaimed cards the crew can afford
 *   2. Tier matching the crew's expansion drive (aggressive crews reach up,
 *      cautious crews stay in their lane)
 *   3. Deterministic tie-break on the tick seed so the same game state always
 *      produces the same move
 */
export function pickClaimTarget(
  crew: GhostCrew,
  ctx: GhostTickContext,
): BlockDNA | null {
  const affordable = BLOCK_DNA_LIBRARY.filter((dna) => {
    if (crew.claimedDnaIds.includes(dna.id)) return false;
    if (ctx.ghostOwnedBlockIds.has(`ghost-${dna.id}`)) return false;
    // The player already holds this block
    if (ctx.playerBlocks.some((b) => b.dnaId === dna.id)) return false;
    return ghostClaimCost(dna) <= crew.treasury;
  });
  if (affordable.length === 0) return null;

  const tierRank: Record<BlockDNA['tier'], number> = { starter: 0, mid: 1, high: 2, elite: 3 };
  // Expansion drive pushes the crew toward higher tiers.
  const reach = crew.personality.expansionDrive >= 70 ? 1 : 0;
  const scored = affordable
    .map((dna) => {
      const tierScore = tierRank[dna.tier] + reach;
      const jitter = seeded(ctx.tickIndex, crew.id.length + dna.id.length);
      return { dna, score: tierScore + jitter * 0.5 };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.dna ?? null;
}

/** Build the BlockData a ghost crew owns after claiming a DNA card. */
export function buildGhostBlock(crew: GhostCrew, dna: BlockDNA): BlockData {
  const id = `ghost-${dna.id}`;
  const seed = generateBlockHash(dna.lat, dna.lng);
  const grid = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      const zoneType = (dna.zoneOverrides?.[y] ?? 'sidewalk') as BlockData['grid'][0][0]['zoneType'];
      return {
        x, y, zoneType,
        incomeModifier: 0, exposureRisk: 0, coverScore: 0,
        passable: zoneType !== 'building' && zoneType !== 'street',
        occupantId: null,
      };
    }),
  );
  return {
    id,
    address: dna.address,
    lat: dna.lat,
    lng: dna.lng,
    owner: 'npc',
    ownerGangName: crew.name,
    grid,
    placements: [],
    incomePerTick: ghostBlockIncome(dna),
    heat: dna.startingHeat,
    morale: dna.startingMorale,
    members: crew.roster.filter((m) => m.alive).length,
    viewMode: 'topdown',
    pendingIncome: 0,
    dnaId: dna.id,
    incomeMultiplier: dna.incomeMultiplier,
    heatDecayMultiplier: dna.heatDecayMultiplier,
    maxMembers: dna.maxMembers,
    // Stable identity so the encounter pipeline resolves the same scene.
    taggedBy: undefined,
    taggedAt: undefined,
    ...(seed ? {} : {}),
  };
}

// ─── Decision loop ───────────────────────────────────────────

/**
 * Decide one crew's move for this tick.
 *
 * Personality drives the choice:
 *   - lay-low     when out of members, out of cash, or cautious & hot
 *   - claim       when it can afford a DNA block and wants to expand
 *   - attack      when it holds a grudge or is aggressive and the player
 *                 owns blocks
 *   - reinforce   otherwise (bank income, heal, build treasury)
 */
export function decideGhostAction(crew: GhostCrew, ctx: GhostTickContext): GhostAction {
  const alive = crew.roster.filter((m) => m.alive).length;
  const p = crew.personality;
  const roll = seeded(ctx.tickIndex, crew.id.length * 7 + alive);
  const base: Omit<GhostAction, 'type' | 'description'> = {
    crewId: crew.id,
    crewName: crew.name,
    threatensPlayer: false,
  };

  // 1. Regroup when the crew is broken.
  if (alive <= 1) {
    return {
      ...base,
      type: 'lay-low',
      description: `${crew.name} is regrouping after losing too many members.`,
    };
  }

  // 2. Revenge-driven crews with a hot grudge go after the player.
  const wantsRevenge =
    crew.grudge.score > 30 &&
    ctx.playerBlocks.length > 0 &&
    roll * 100 < p.grudgeWeight;
  if (wantsRevenge) {
    const target = ctx.playerBlocks[Math.floor(seeded(ctx.tickIndex, 99) * ctx.playerBlocks.length)];
    return {
      ...base,
      type: 'attack',
      targetBlockId: target.id,
      targetBlockName: target.address,
      threatensPlayer: true,
      description: `${crew.name} is coming for ${target.address} — payback for the last hit.`,
    };
  }

  // 3. Expansion: claim a new DNA block when affordable and driven.
  const wantsExpand = roll * 100 < p.expansionDrive;
  if (wantsExpand) {
    const target = pickClaimTarget(crew, ctx);
    if (target) {
      return {
        ...base,
        type: 'claim',
        claimedDnaId: target.id,
        targetBlockId: `ghost-${target.id}`,
        targetBlockName: target.name,
        description: `${crew.name} claimed ${target.name}.`,
      };
    }
  }

  // 4. Aggressive crews raid the player even without a grudge.
  const wantsRaid =
    ctx.playerBlocks.length > 0 &&
    roll * 100 < p.aggression * (1 - p.caution / 200);
  if (wantsRaid) {
    const target = ctx.playerBlocks[Math.floor(seeded(ctx.tickIndex, 7) * ctx.playerBlocks.length)];
    return {
      ...base,
      type: 'attack',
      targetBlockId: target.id,
      targetBlockName: target.address,
      threatensPlayer: true,
      description: `${crew.name} is probing ${target.address}.`,
    };
  }

  // 5. Default: reinforce / bank income.
  return {
    ...base,
    type: 'reinforce',
    description: `${crew.name} is reinforcing its turf and stacking cash.`,
  };
}

/**
 * Apply a decided action to a crew, returning the updated crew.
 * Claim spends treasury and adds the block; reinforce banks income;
 * attack spends a little on the hit; lay-low heals and cools the grudge.
 */
export function applyGhostAction(crew: GhostCrew, action: GhostAction): GhostCrew {
  const updated: GhostCrew = {
    ...crew,
    lastTickAt: new Date().toISOString(),
    lastMove: action.description,
  };

  switch (action.type) {
    case 'claim': {
      const dna = BLOCK_DNA_LIBRARY.find((d) => d.id === action.claimedDnaId);
      if (!dna) return updated;
      const cost = ghostClaimCost(dna);
      return {
        ...updated,
        treasury: Math.max(0, crew.treasury - cost),
        ownedBlockIds: [...crew.ownedBlockIds, `ghost-${dna.id}`],
        claimedDnaIds: [...crew.claimedDnaIds, dna.id],
        incomePerTick: crew.incomePerTick + ghostBlockIncome(dna),
      };
    }
    case 'reinforce':
      return { ...updated, treasury: crew.treasury + crew.incomePerTick };
    case 'attack':
      return {
        ...updated,
        treasury: Math.max(0, crew.treasury - 150),
        grudge: { ...crew.grudge, score: Math.max(0, crew.grudge.score - 10) },
      };
    case 'lay-low':
      return {
        ...updated,
        treasury: crew.treasury + Math.round(crew.incomePerTick * 0.5),
        grudge: { ...crew.grudge, score: Math.max(0, crew.grudge.score - 5) },
        roster: crew.roster.map((m, i) =>
          !m.alive && i === crew.roster.findIndex((x) => !x.alive)
            ? { ...m, alive: true, name: pickName(action.crewId.length, Date.now() % 97) }
            : m,
        ),
      };
    default:
      return updated;
  }
}

/** Raise a crew's grudge after the player attacks one of its blocks. */
export function addGrudge(crew: GhostCrew, blockId: string, amount: number): GhostCrew {
  return {
    ...crew,
    grudge: {
      score: Math.min(100, crew.grudge.score + amount),
      lastIncidentBlockId: blockId,
      lastIncidentAt: new Date().toISOString(),
    },
  };
}
