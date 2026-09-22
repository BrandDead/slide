// Tests for the Ghost Crew Engine (#81) — decision loop, claim economics,
// grudge memory, and deterministic behavior.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GHOST_CREWS,
  decideGhostAction,
  applyGhostAction,
  applyGhostActionChecked,
  buildGhostBlock,
  pickClaimTarget,
  addGrudge,
  ghostClaimCost,
  ghostBlockIncome,
  fictionalBlockLabel,
  validateGhostCrewState,
  GHOST_ATTACK_COST,
  type GhostAction,
  type GhostCrew,
  type GhostTickContext,
} from '../ghostCrewEngine';
import { BLOCK_DNA_LIBRARY, getDNAById } from '../../config/blockDNA';
import type { BlockData } from '../../types/block.types';
import { buildZoneLayout } from '../blockDNAResolver';
import { generateGridForZoneLayout } from '../../stores/blockStore';

function makeCtx(overrides: Partial<GhostTickContext> = {}): GhostTickContext {
  return {
    playerBlocks: [],
    ghostOwnedBlockIds: new Set<string>(),
    tickIndex: 1,
    tickKey: 'test-tick-1',
    seed: 1,
    ...overrides,
  };
}

function makeAction(overrides: Partial<GhostAction>): GhostAction {
  return {
    type: 'reinforce',
    crewId: DEFAULT_GHOST_CREWS[0].id,
    crewName: DEFAULT_GHOST_CREWS[0].name,
    description: 'Test action.',
    threatensPlayer: false,
    reason: 'hold-and-earn',
    trace: {
      tickKey: 'test-tick-1',
      seed: 1,
      decisionRoll: 0.25,
      targetRoll: 0.5,
    },
    ...overrides,
  };
}

function playerBlock(id: string, dnaId?: string): BlockData {
  return {
    id,
    address: '1 Player St',
    lat: 25.8,
    lng: -80.2,
    owner: 'player',
    grid: [],
    placements: [],
    incomePerTick: 0,
    heat: 0,
    morale: 70,
    members: 0,
    viewMode: 'topdown',
    pendingIncome: 0,
    dnaId,
  };
}

describe('DEFAULT_GHOST_CREWS', () => {
  it('seeds named crews with distinct personalities', () => {
    expect(DEFAULT_GHOST_CREWS.length).toBeGreaterThanOrEqual(3);
    const personalities = new Set(DEFAULT_GHOST_CREWS.map((c) => c.personality.type));
    expect(personalities.size).toBeGreaterThanOrEqual(3);
  });

  it('each crew has a roster and treasury', () => {
    for (const crew of DEFAULT_GHOST_CREWS) {
      expect(crew.roster.length).toBeGreaterThan(0);
      expect(crew.treasury).toBeGreaterThan(0);
      expect(crew.name).toBeTruthy();
    }
  });
});

describe('ghostClaimCost / ghostBlockIncome', () => {
  it('cost scales with tier', () => {
    const starter = BLOCK_DNA_LIBRARY.find((d) => d.tier === 'starter')!;
    const elite = BLOCK_DNA_LIBRARY.find((d) => d.tier === 'elite')!;
    expect(ghostClaimCost(elite)).toBeGreaterThan(ghostClaimCost(starter));
  });

  it('income scales with the DNA income multiplier', () => {
    const low = BLOCK_DNA_LIBRARY.reduce((a, b) => (a.incomeMultiplier < b.incomeMultiplier ? a : b));
    const high = BLOCK_DNA_LIBRARY.reduce((a, b) => (a.incomeMultiplier > b.incomeMultiplier ? a : b));
    expect(ghostBlockIncome(high)).toBeGreaterThan(ghostBlockIncome(low));
  });
});

describe('pickClaimTarget', () => {
  const crew = DEFAULT_GHOST_CREWS[2]; // money-crew, treasury 3000

  it('returns an affordable, unclaimed DNA card', () => {
    const target = pickClaimTarget(crew, makeCtx({ tickIndex: 3 }));
    expect(target).toBeTruthy();
    expect(ghostClaimCost(target!)).toBeLessThanOrEqual(crew.treasury);
    expect(crew.claimedDnaIds).not.toContain(target!.id);
  });

  it('is deterministic for the same game state', () => {
    const a = pickClaimTarget(crew, makeCtx({ tickIndex: 5 }));
    const b = pickClaimTarget(crew, makeCtx({ tickIndex: 5 }));
    expect(a?.id).toBe(b?.id);
  });

  it('uses the explicit seed to vary a claim target when variation is intended', () => {
    const rich: GhostCrew = {
      ...crew,
      treasury: 99999,
      personality: { ...crew.personality, expansionDrive: 100 },
    };
    const targets = new Set(
      Array.from({ length: 24 }, (_, index) => pickClaimTarget(
        rich,
        makeCtx({ tickIndex: index + 1, seed: index + 1 }),
      )?.id),
    );
    expect(targets.size).toBeGreaterThan(1);
  });

  it('returns null when the crew cannot afford any card', () => {
    const broke: GhostCrew = { ...crew, treasury: 0 };
    expect(pickClaimTarget(broke, makeCtx())).toBeNull();
  });

  it('skips DNA cards the player already owns', () => {
    const dna = BLOCK_DNA_LIBRARY[0];
    const rich: GhostCrew = { ...crew, treasury: 99999 };
    const ctx = makeCtx({ playerBlocks: [playerBlock('p1', dna.id)] });
    const target = pickClaimTarget(rich, ctx);
    expect(target?.id).not.toBe(dna.id);
  });
});

describe('decideGhostAction', () => {
  it('lays low when the roster is nearly wiped', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[0],
      roster: DEFAULT_GHOST_CREWS[0].roster.map((m, i) => ({ ...m, alive: i === 0 })),
    };
    const action = decideGhostAction(crew, makeCtx());
    expect(action.type).toBe('lay-low');
  });

  it('revenge-driven crews with a hot grudge attack the player', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[1], // revenge-driven, grudgeWeight 90
      grudge: { score: 80 },
    };
    const action = decideGhostAction(crew, makeCtx({ playerBlocks: [playerBlock('pb-1')], tickIndex: 7 }));
    expect(action.type).toBe('attack');
    expect(action.threatensPlayer).toBe(true);
    expect(action.targetBlockId).toBe('pb-1');
    expect(action.reason).toBe('grudge-retaliation');
    expect(action.trace).toMatchObject({ tickKey: 'test-tick-1', seed: 1 });
  });

  it('returns the exact same action and seed trace for the same input', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[0],
      personality: { ...DEFAULT_GHOST_CREWS[0].personality, expansionDrive: 100 },
    };
    const ctx = makeCtx({ tickIndex: 9, tickKey: 'world:9', seed: 9123 });
    expect(decideGhostAction(crew, ctx)).toEqual(decideGhostAction(crew, ctx));
  });

  it('lays low when a cautious crew has high territory heat', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[2],
      personality: { ...DEFAULT_GHOST_CREWS[2].personality, caution: 100 },
    };
    const action = decideGhostAction(crew, makeCtx({ crewHeat: 4 }));
    expect(action).toMatchObject({ type: 'lay-low', reason: 'heat-caution' });
  });

  it('fails closed to lay-low when retaliation is unaffordable', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[1],
      treasury: GHOST_ATTACK_COST - 1,
      grudge: { score: 100 },
      personality: { ...DEFAULT_GHOST_CREWS[1].personality, grudgeWeight: 100 },
    };
    const action = decideGhostAction(crew, makeCtx({ playerBlocks: [playerBlock('pb-1')] }));
    expect(action).toMatchObject({ type: 'lay-low', reason: 'insufficient-resources' });
  });

  it('returns an explicit no-legal-action fallback', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[2],
      treasury: 0,
      ownedBlockIds: [],
      claimedDnaIds: [],
      incomePerTick: 0,
      grudge: { score: 0 },
      personality: {
        ...DEFAULT_GHOST_CREWS[2].personality,
        aggression: 0,
        expansionDrive: 0,
      },
    };
    expect(decideGhostAction(crew, makeCtx())).toMatchObject({
      type: 'lay-low',
      reason: 'no-legal-action',
    });
  });

  it('expansion-driven crews claim new turf', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[0], // territory-hungry, expansionDrive 85
      grudge: { score: 0 },
    };
    // Try several ticks — at least one should choose expansion over the
    // deterministic roll.
    const types = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (t) => decideGhostAction(crew, makeCtx({ tickIndex: t })).type,
    );
    expect(types).toContain('claim');
  });

  it('money crews with no expansion target reinforce', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[2],
      treasury: 0, // cannot afford any claim
      personality: { ...DEFAULT_GHOST_CREWS[2].personality, aggression: 0 },
      grudge: { score: 0 },
    };
    const action = decideGhostAction(crew, makeCtx({ tickIndex: 4 }));
    expect(['reinforce', 'lay-low']).toContain(action.type);
  });
});

describe('applyGhostAction', () => {
  it('claim spends treasury and records the block + DNA', () => {
    const crew = DEFAULT_GHOST_CREWS[2]; // treasury 3000
    const target = pickClaimTarget(crew, makeCtx({ tickIndex: 3 }))!;
    const action = makeAction({
      type: 'claim',
      crewId: crew.id,
      crewName: crew.name,
      description: '',
      claimedDnaId: target.id,
      targetBlockId: `ghost-${target.id}`,
      reason: 'territory-expansion',
    });
    const updated = applyGhostAction(crew, action, 1_700_000_000_000);
    expect(updated.treasury).toBe(crew.treasury - ghostClaimCost(target));
    expect(updated.ownedBlockIds).toContain(`ghost-${target.id}`);
    expect(updated.claimedDnaIds).toContain(target.id);
    expect(updated.incomePerTick).toBeGreaterThan(0);
  });

  it('reinforce banks income into the treasury', () => {
    const crew: GhostCrew = { ...DEFAULT_GHOST_CREWS[0], incomePerTick: 300 };
    const action = makeAction({
      type: 'reinforce',
      crewId: crew.id,
      crewName: crew.name,
      description: '',
    });
    const updated = applyGhostAction(crew, action);
    expect(updated.treasury).toBe(crew.treasury + 300);
  });

  it('attack cools the grudge and costs the crew', () => {
    const crew: GhostCrew = { ...DEFAULT_GHOST_CREWS[1], grudge: { score: 60 } };
    const action = makeAction({
      type: 'attack',
      crewId: crew.id,
      crewName: crew.name,
      description: '',
      threatensPlayer: true,
      reason: 'grudge-retaliation',
    });
    const updated = applyGhostAction(crew, action);
    expect(updated.grudge.score).toBeLessThan(crew.grudge.score);
    expect(updated.treasury).toBeLessThan(crew.treasury);
  });

  it('lay-low revives a downed member', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[0],
      roster: DEFAULT_GHOST_CREWS[0].roster.map((m, i) => ({ ...m, alive: i !== 1 })),
    };
    const action = makeAction({
      type: 'lay-low',
      crewId: crew.id,
      crewName: crew.name,
      description: '',
      reason: 'roster-critical',
    });
    const updated = applyGhostAction(crew, action);
    expect(updated.roster.filter((m) => m.alive).length).toBe(crew.roster.length);
  });
});

describe('grudge memory', () => {
  it('player attacks raise the grudge score persistently', () => {
    const crew = DEFAULT_GHOST_CREWS[0];
    const hit1 = addGrudge(crew, 'block-a', 25);
    expect(hit1.grudge.score).toBe(25);
    const hit2 = addGrudge(hit1, 'block-a', 25);
    expect(hit2.grudge.score).toBe(50);
    expect(hit2.grudge.lastIncidentBlockId).toBe('block-a');
  });

  it('grudge is capped at 100', () => {
    const crew: GhostCrew = { ...DEFAULT_GHOST_CREWS[0], grudge: { score: 90 } };
    const hit = addGrudge(crew, 'block-b', 50);
    expect(hit.grudge.score).toBe(100);
  });
});

describe('buildGhostBlock', () => {
  it('creates an npc-owned block stamped with the DNA identity', () => {
    const crew = DEFAULT_GHOST_CREWS[0];
    const dna = getDNAById('las-olas-1208')!;
    const block = buildGhostBlock(crew, dna);
    expect(block.owner).toBe('npc');
    expect(block.ownerGangName).toBe(crew.name);
    expect(block.dnaId).toBe(dna.id);
    expect(block.id).toBe(`ghost-${dna.id}`);
    expect(block.incomeMultiplier).toBe(dna.incomeMultiplier);
    expect(block.maxMembers).toBe(dna.maxMembers);
    expect(block.grid).toHaveLength(8);
    expect(block.gridSource).toBe('dna-fallback');
    const canonical = generateGridForZoneLayout(buildZoneLayout(dna));
    expect(block.grid[0][0]).toMatchObject({
      zoneType: canonical[0][0].zoneType,
      incomeModifier: canonical[0][0].incomeModifier,
      exposureRisk: canonical[0][0].exposureRisk,
      passable: canonical[0][0].passable,
    });
    expect(block.grid[0][0].coverScore).toBe(
      Math.max(0, Math.min(1, Number((canonical[0][0].coverScore + dna.globalCoverBonus).toFixed(2)))),
    );
  });
});

describe('fictional player-facing block labels', () => {
  it('uses the DNA display name instead of exposing the raw address', () => {
    const target = playerBlock('demo-block-las-olas', 'las-olas-1208');
    target.address = '1208 W Las Olas Blvd, Fort Lauderdale';

    expect(fictionalBlockLabel(target)).toBe('1208 Las Olas');
    expect(fictionalBlockLabel(target)).not.toContain('Fort Lauderdale');
    expect(fictionalBlockLabel(target)).not.toContain('W Las Olas Blvd');
  });
});

describe('applyGhostActionChecked', () => {
  const occurredAt = 1_700_000_000_000;

  it('rejects malformed crew state without applying a projection', () => {
    const malformed = { ...DEFAULT_GHOST_CREWS[0], treasury: Number.NaN } as GhostCrew;
    expect(validateGhostCrewState(malformed)).toBe('malformed-state');
    const result = applyGhostActionChecked(malformed, makeAction({
      crewId: malformed.id,
      crewName: malformed.name,
      type: 'lay-low',
    }), { blocks: {}, occurredAt });
    expect(result).toMatchObject({ applied: false, reason: 'malformed-state', crew: malformed });
  });

  it('rejects a missing attack target, invalid ownership, and insufficient treasury', () => {
    const crew = DEFAULT_GHOST_CREWS[0];
    const attack = makeAction({
      crewId: crew.id,
      crewName: crew.name,
      type: 'attack',
      targetBlockId: 'target',
      threatensPlayer: true,
      reason: 'opportunistic-pressure',
    });
    expect(applyGhostActionChecked(crew, attack, { blocks: {}, occurredAt }).reason).toBe('missing-target');

    const npcTarget = { ...playerBlock('target'), owner: 'npc' as const };
    expect(applyGhostActionChecked(crew, attack, {
      blocks: { target: npcTarget }, occurredAt,
    }).reason).toBe('invalid-ownership');

    const broke = { ...crew, treasury: GHOST_ATTACK_COST - 1 };
    expect(applyGhostActionChecked(broke, attack, {
      blocks: { target: playerBlock('target') }, occurredAt,
    }).reason).toBe('insufficient-treasury');
  });

  it('rejects a claim when its DNA is already present in shared territory', () => {
    const crew = { ...DEFAULT_GHOST_CREWS[0], treasury: 99999 };
    const dna = BLOCK_DNA_LIBRARY[0];
    const action = makeAction({
      crewId: crew.id,
      crewName: crew.name,
      type: 'claim',
      claimedDnaId: dna.id,
      targetBlockId: `ghost-${dna.id}`,
      reason: 'territory-expansion',
    });
    expect(applyGhostActionChecked(crew, action, {
      blocks: { player: playerBlock('player', dna.id) },
      occurredAt,
    }).reason).toBe('invalid-ownership');
  });

  it('recomputes reinforcement income from owned shared blocks', () => {
    const dna = BLOCK_DNA_LIBRARY[0];
    const block = buildGhostBlock(DEFAULT_GHOST_CREWS[0], dna);
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[0],
      ownedBlockIds: [block.id],
      claimedDnaIds: [dna.id],
      incomePerTick: 999999,
    };
    const action = makeAction({ crewId: crew.id, crewName: crew.name });
    const result = applyGhostActionChecked(crew, action, {
      blocks: { [block.id]: block },
      occurredAt,
    });
    expect(result.applied).toBe(true);
    expect(result.crew.incomePerTick).toBe(block.incomePerTick);
    expect(result.crew.treasury).toBe(crew.treasury + block.incomePerTick);
  });
});
