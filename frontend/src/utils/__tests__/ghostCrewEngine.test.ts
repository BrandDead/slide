// Tests for the Ghost Crew Engine (#81) — decision loop, claim economics,
// grudge memory, and deterministic behavior.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GHOST_CREWS,
  decideGhostAction,
  applyGhostAction,
  buildGhostBlock,
  pickClaimTarget,
  addGrudge,
  ghostClaimCost,
  ghostBlockIncome,
  type GhostCrew,
  type GhostTickContext,
} from '../ghostCrewEngine';
import { BLOCK_DNA_LIBRARY, getDNAById } from '../../config/blockDNA';
import type { BlockData } from '../../types/block.types';

function makeCtx(overrides: Partial<GhostTickContext> = {}): GhostTickContext {
  return {
    playerBlocks: [],
    ghostOwnedBlockIds: new Set<string>(),
    tickIndex: 1,
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
    const action = {
      type: 'claim' as const,
      crewId: crew.id,
      crewName: crew.name,
      description: '',
      claimedDnaId: target.id,
      targetBlockId: `ghost-${target.id}`,
      threatensPlayer: false,
    };
    const updated = applyGhostAction(crew, action);
    expect(updated.treasury).toBe(crew.treasury - ghostClaimCost(target));
    expect(updated.ownedBlockIds).toContain(`ghost-${target.id}`);
    expect(updated.claimedDnaIds).toContain(target.id);
    expect(updated.incomePerTick).toBeGreaterThan(0);
  });

  it('reinforce banks income into the treasury', () => {
    const crew: GhostCrew = { ...DEFAULT_GHOST_CREWS[0], incomePerTick: 300 };
    const action = {
      type: 'reinforce' as const,
      crewId: crew.id,
      crewName: crew.name,
      description: '',
      threatensPlayer: false,
    };
    const updated = applyGhostAction(crew, action);
    expect(updated.treasury).toBe(crew.treasury + 300);
  });

  it('attack cools the grudge and costs the crew', () => {
    const crew: GhostCrew = { ...DEFAULT_GHOST_CREWS[1], grudge: { score: 60 } };
    const action = {
      type: 'attack' as const,
      crewId: crew.id,
      crewName: crew.name,
      description: '',
      threatensPlayer: true,
    };
    const updated = applyGhostAction(crew, action);
    expect(updated.grudge.score).toBeLessThan(crew.grudge.score);
    expect(updated.treasury).toBeLessThan(crew.treasury);
  });

  it('lay-low revives a downed member', () => {
    const crew: GhostCrew = {
      ...DEFAULT_GHOST_CREWS[0],
      roster: DEFAULT_GHOST_CREWS[0].roster.map((m, i) => ({ ...m, alive: i !== 1 })),
    };
    const action = {
      type: 'lay-low' as const,
      crewId: crew.id,
      crewName: crew.name,
      description: '',
      threatensPlayer: false,
    };
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
  });
});
