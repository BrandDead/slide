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
import { buildZoneLayout } from './blockDNAResolver';
import { generateGridForZoneLayout } from '../stores/blockStore';
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

export type GhostActionReason =
  | 'roster-critical'
  | 'heat-caution'
  | 'grudge-retaliation'
  | 'territory-expansion'
  | 'opportunistic-pressure'
  | 'hold-and-earn'
  | 'insufficient-resources'
  | 'no-legal-action'
  | 'malformed-state';

export interface GhostDecisionTrace {
  /** Stable caller-owned identity used for exactly-once application. */
  tickKey: string;
  /** Integer seed supplied by the trusted tick boundary. */
  seed: number;
  /** Personality decision roll in the range [0, 1). */
  decisionRoll: number;
  /** Independent target-selection roll in the range [0, 1). */
  targetRoll: number;
}

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
  /** Stable explanation used by tests and operator-visible event data. */
  reason: GhostActionReason;
  /** Deterministic trace. It contains no secret or real-world targeting data. */
  trace: GhostDecisionTrace;
}

export interface GhostTickContext {
  /** Player-owned blocks, read from blockStore */
  playerBlocks: BlockData[];
  /** All blocks already owned by any ghost crew */
  ghostOwnedBlockIds: Set<string>;
  /** Monotonic tick counter used for deterministic seeds */
  tickIndex: number;
  /** Caller-owned replay key. Defaults to a local key for compatibility. */
  tickKey?: string;
  /** Explicit deterministic seed. Defaults to tickIndex for compatibility. */
  seed?: number;
  /** Highest current heat across this crew's shared territory. */
  crewHeat?: number;
}

export type GhostActionFailure =
  | 'malformed-state'
  | 'crew-mismatch'
  | 'missing-target'
  | 'invalid-ownership'
  | 'insufficient-treasury';

export interface GhostActionApplication {
  applied: boolean;
  reason?: GhostActionFailure;
  crew: GhostCrew;
  blockUpsert?: BlockData;
}

export interface GhostActionApplyContext {
  blocks: Record<string, BlockData>;
  occurredAt: number;
}

function seeded(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tickSeed(ctx: GhostTickContext): number {
  return Number.isFinite(ctx.seed) ? Math.trunc(ctx.seed!) : ctx.tickIndex;
}

function decisionTrace(
  crewId: string,
  ctx: GhostTickContext,
): GhostDecisionTrace {
  const seed = tickSeed(ctx);
  return {
    tickKey: ctx.tickKey ?? `local:${ctx.tickIndex}`,
    seed,
    decisionRoll: seeded(seed, hashString(`${crewId}:decision`)),
    targetRoll: seeded(seed, hashString(`${crewId}:target`)),
  };
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
      const jitter = seeded(tickSeed(ctx), hashString(`${crew.id}:${dna.id}`));
      return { dna, score: tierScore + jitter * 0.5 };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.dna ?? null;
}

/** Build the BlockData a ghost crew owns after claiming a DNA card. */
export function buildGhostBlock(crew: GhostCrew, dna: BlockDNA): BlockData {
  const id = `ghost-${dna.id}`;
  // Reuse the canonical eight-row Block DNA builder. The previous rival
  // projection created a second zero-stat grid and therefore disagreed with
  // placement and encounter preparation for the same dnaId.
  const grid = generateGridForZoneLayout(buildZoneLayout(dna)).map((row) =>
    row.map((zone) => ({
      ...zone,
      coverScore: Math.max(0, Math.min(1, Number(
        (zone.coverScore + dna.globalCoverBonus).toFixed(2),
      ))),
    })),
  );
  return {
    id,
    address: dna.address,
    lat: dna.lat,
    lng: dna.lng,
    owner: 'npc',
    ownerGangName: crew.name,
    grid,
    gridSource: 'dna-fallback',
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
    globalCoverBonus: dna.globalCoverBonus,
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
  const trace = decisionTrace(crew?.id ?? 'invalid-crew', ctx);
  if (validateGhostCrewState(crew)) {
    return {
      type: 'lay-low',
      crewId: typeof crew?.id === 'string' ? crew.id : 'invalid-crew',
      crewName: typeof crew?.name === 'string' ? crew.name : 'Unknown crew',
      threatensPlayer: false,
      description: 'Rival action was skipped because its saved state was invalid.',
      reason: 'malformed-state',
      trace,
    };
  }
  const alive = crew.roster.filter((m) => m.alive).length;
  const p = crew.personality;
  const roll = trace.decisionRoll;
  const base: Omit<GhostAction, 'type' | 'description' | 'reason'> = {
    crewId: crew.id,
    crewName: crew.name,
    threatensPlayer: false,
    trace,
  };

  // 1. Regroup when the crew is broken.
  if (alive <= 1) {
    return {
      ...base,
      type: 'lay-low',
      description: `${crew.name} is regrouping after losing too many members.`,
      reason: 'roster-critical',
    };
  }

  if ((ctx.crewHeat ?? 0) >= 4 && p.caution >= 70) {
    return {
      ...base,
      type: 'lay-low',
      description: `${crew.name} is cooling off while pressure is high.`,
      reason: 'heat-caution',
    };
  }

  // 2. Revenge-driven crews with a hot grudge go after the player.
  const wantsRevenge =
    crew.grudge.score > 30 &&
    ctx.playerBlocks.length > 0 &&
    roll * 100 < p.grudgeWeight;
  if (wantsRevenge) {
    if (crew.treasury < GHOST_ATTACK_COST) {
      return {
        ...base,
        type: 'lay-low',
        description: `${crew.name} cannot afford to move on its grudge yet.`,
        reason: 'insufficient-resources',
      };
    }
    const target = ctx.playerBlocks[Math.floor(trace.targetRoll * ctx.playerBlocks.length)];
    return {
      ...base,
      type: 'attack',
      targetBlockId: target.id,
      targetBlockName: target.address,
      threatensPlayer: true,
      description: `${crew.name} is coming for ${target.address} — payback for the last hit.`,
      reason: 'grudge-retaliation',
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
        reason: 'territory-expansion',
      };
    }
  }

  // 4. Aggressive crews raid the player even without a grudge.
  const wantsRaid =
    ctx.playerBlocks.length > 0 &&
    crew.treasury >= GHOST_ATTACK_COST &&
    roll * 100 < p.aggression * (1 - p.caution / 200);
  if (wantsRaid) {
    const target = ctx.playerBlocks[Math.floor(trace.targetRoll * ctx.playerBlocks.length)];
    return {
      ...base,
      type: 'attack',
      targetBlockId: target.id,
      targetBlockName: target.address,
      threatensPlayer: true,
      description: `${crew.name} is probing ${target.address}.`,
      reason: 'opportunistic-pressure',
    };
  }

  // 5. Hold existing turf. A crew with no valid territory and no legal move
  // lays low instead of minting treasury from an unverified income counter.
  if (crew.ownedBlockIds.length === 0) {
    return {
      ...base,
      type: 'lay-low',
      description: `${crew.name} found no legal move and is staying quiet.`,
      reason: 'no-legal-action',
    };
  }
  return {
    ...base,
    type: 'reinforce',
    description: `${crew.name} is reinforcing its turf and stacking cash.`,
    reason: 'hold-and-earn',
  };
}

export const GHOST_ATTACK_COST = 150;

/**
 * Apply a decided action to a crew, returning the updated crew.
 * Claim spends treasury and adds the block; reinforce banks income;
 * attack spends a little on the hit; lay-low heals and cools the grudge.
 */
export function applyGhostAction(
  crew: GhostCrew,
  action: GhostAction,
  occurredAt: number | string = Date.now(),
): GhostCrew {
  const updated: GhostCrew = {
    ...crew,
    lastTickAt: new Date(occurredAt).toISOString(),
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
        treasury: Math.max(0, crew.treasury - GHOST_ATTACK_COST),
        grudge: { ...crew.grudge, score: Math.max(0, crew.grudge.score - 10) },
      };
    case 'lay-low':
      return {
        ...updated,
        treasury: crew.treasury + Math.round(crew.incomePerTick * 0.5),
        grudge: { ...crew.grudge, score: Math.max(0, crew.grudge.score - 5) },
        roster: crew.roster.map((m, i) =>
          !m.alive && i === crew.roster.findIndex((x) => !x.alive)
            ? { ...m, alive: true }
            : m,
        ),
      };
    default:
      return updated;
  }
}

/**
 * Validate the durable rival record before a trusted boundary applies a tick.
 * The type is intentionally accepted at runtime: localStorage and remote JSON
 * can be damaged even when TypeScript callers are correct.
 */
export function validateGhostCrewState(crew: GhostCrew): GhostActionFailure | null {
  const personalityTypes: PersonalityType[] = [
    'territory-hungry', 'revenge-driven', 'money-crew', 'chaotic',
  ];
  if (!crew || typeof crew !== 'object') return 'malformed-state';
  if (typeof crew.id !== 'string' || !crew.id || typeof crew.name !== 'string' || !crew.name) {
    return 'malformed-state';
  }
  if (!Number.isFinite(crew.treasury) || crew.treasury < 0) return 'malformed-state';
  if (!crew.personality || !personalityTypes.includes(crew.personality.type)) return 'malformed-state';
  const scores = [
    crew.personality.aggression,
    crew.personality.expansionDrive,
    crew.personality.grudgeWeight,
    crew.personality.caution,
  ];
  if (scores.some((score) => !Number.isFinite(score) || score < 0 || score > 100)) {
    return 'malformed-state';
  }
  if (!Array.isArray(crew.roster) || crew.roster.length === 0) return 'malformed-state';
  const memberIds = new Set<string>();
  for (const member of crew.roster) {
    if (
      !member || typeof member.id !== 'string' || !member.id || memberIds.has(member.id)
      || typeof member.name !== 'string' || !member.name
      || !['shooter', 'dealer', 'enforcer'].includes(member.role)
      || !Number.isInteger(member.level) || member.level < 1 || member.level > 10
      || typeof member.alive !== 'boolean'
    ) return 'malformed-state';
    memberIds.add(member.id);
  }
  if (!Array.isArray(crew.ownedBlockIds) || !Array.isArray(crew.claimedDnaIds)) {
    return 'malformed-state';
  }
  if ([...crew.ownedBlockIds, ...crew.claimedDnaIds].some((id) => typeof id !== 'string' || !id)) {
    return 'malformed-state';
  }
  if (new Set(crew.ownedBlockIds).size !== crew.ownedBlockIds.length) return 'malformed-state';
  if (new Set(crew.claimedDnaIds).size !== crew.claimedDnaIds.length) return 'malformed-state';
  if (!crew.grudge || !Number.isFinite(crew.grudge.score) || crew.grudge.score < 0 || crew.grudge.score > 100) {
    return 'malformed-state';
  }
  if (!Number.isFinite(crew.incomePerTick) || crew.incomePerTick < 0) return 'malformed-state';
  if (typeof crew.lastTickAt !== 'string' || !Number.isFinite(Date.parse(crew.lastTickAt))) {
    return 'malformed-state';
  }
  return null;
}

/**
 * Economy/ownership guard for the offline authoritative adapter. Policy stays
 * pure in decideGhostAction; this boundary checks the shared Block Store just
 * before returning a state projection.
 */
export function applyGhostActionChecked(
  crew: GhostCrew,
  action: GhostAction,
  ctx: GhostActionApplyContext,
): GhostActionApplication {
  if (validateGhostCrewState(crew)) return { applied: false, reason: 'malformed-state', crew };
  if (action.crewId !== crew.id || action.crewName !== crew.name) {
    return { applied: false, reason: 'crew-mismatch', crew };
  }

  const blocks = Object.values(ctx.blocks);
  switch (action.type) {
    case 'claim': {
      const dna = BLOCK_DNA_LIBRARY.find((candidate) => candidate.id === action.claimedDnaId);
      const expectedBlockId = dna ? `ghost-${dna.id}` : null;
      if (!dna || action.targetBlockId !== expectedBlockId) {
        return { applied: false, reason: 'missing-target', crew };
      }
      const existingTerritory = blocks.find(
        (block) => block.id === expectedBlockId || block.dnaId === dna.id,
      );
      if (
        existingTerritory
        || crew.ownedBlockIds.includes(expectedBlockId)
        || crew.claimedDnaIds.includes(dna.id)
      ) {
        return { applied: false, reason: 'invalid-ownership', crew };
      }
      if (crew.treasury < ghostClaimCost(dna)) {
        return { applied: false, reason: 'insufficient-treasury', crew };
      }
      const updated = applyGhostAction(crew, action, ctx.occurredAt);
      return { applied: true, crew: updated, blockUpsert: buildGhostBlock(updated, dna) };
    }
    case 'attack': {
      if (!action.targetBlockId || !ctx.blocks[action.targetBlockId]) {
        return { applied: false, reason: 'missing-target', crew };
      }
      if (ctx.blocks[action.targetBlockId].owner !== 'player') {
        return { applied: false, reason: 'invalid-ownership', crew };
      }
      if (crew.treasury < GHOST_ATTACK_COST) {
        return { applied: false, reason: 'insufficient-treasury', crew };
      }
      return { applied: true, crew: applyGhostAction(crew, action, ctx.occurredAt) };
    }
    case 'reinforce': {
      const owned = crew.ownedBlockIds.map((blockId) => ctx.blocks[blockId]);
      if (owned.some((block) => !block)) {
        return { applied: false, reason: 'missing-target', crew };
      }
      if (owned.some((block) => block.owner !== 'npc' || block.ownerGangName !== crew.name)) {
        return { applied: false, reason: 'invalid-ownership', crew };
      }
      const authoritativeIncome = owned.reduce((total, block) => total + block.incomePerTick, 0);
      return {
        applied: true,
        crew: applyGhostAction({ ...crew, incomePerTick: authoritativeIncome }, action, ctx.occurredAt),
      };
    }
    case 'lay-low':
      return { applied: true, crew: applyGhostAction(crew, action, ctx.occurredAt) };
    default:
      return { applied: false, reason: 'missing-target', crew };
  }
}

/** Raise a crew's grudge after the player attacks one of its blocks. */
export function addGrudge(
  crew: GhostCrew,
  blockId: string,
  amount: number,
  occurredAt: number | string = Date.now(),
): GhostCrew {
  return {
    ...crew,
    grudge: {
      score: Math.min(100, crew.grudge.score + amount),
      lastIncidentBlockId: blockId,
      lastIncidentAt: new Date(occurredAt).toISOString(),
    },
  };
}
