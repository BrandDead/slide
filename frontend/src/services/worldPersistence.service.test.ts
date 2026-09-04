import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { rpc },
}));

vi.mock('../utils/demoSeed', () => ({
  IS_DEMO_MODE: false,
}));

import {
  commitEncounterResult,
  toGhostCrew,
  toGhostFeedEvent,
  worldPersistenceInternals,
} from './worldPersistence.service';

const result = {
  idempotencyKey: 'result-001',
  outcome: 'secured' as const,
  crewDown: ['crew-1'],
  oppositionDown: ['rival-1'],
  objectiveProgress: 1,
  heatDelta: 1,
  moraleDelta: -2,
  pendingIncomeDelta: 125,
  summary: 'Block secured.',
};

describe('worldPersistence.service', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('maps durable Ghost Crew data into the existing deterministic domain shape', () => {
    const crew = toGhostCrew({
      id: 'ghost-nightfall',
      name: 'Nightfall Crew',
      home_tag: 'downtown',
      personality: { type: 'territory-hungry', aggression: 55, expansionDrive: 85, grudgeWeight: 40, caution: 30 },
      treasury: 2200,
      roster: [{ id: 'nf-1', name: 'Olas King', role: 'enforcer', level: 4, alive: true }],
      owned_block_ids: ['ghost-las-olas'],
      claimed_dna_ids: ['las-olas'],
      grudge: { score: 25 },
      income_per_tick: 120,
      last_tick_at: '2026-09-01T00:00:00.000Z',
      last_move: 'Claimed a block.',
    });

    expect(crew).toMatchObject({
      id: 'ghost-nightfall',
      homeTag: 'downtown',
      ownedBlockIds: ['ghost-las-olas'],
      claimedDnaIds: ['las-olas'],
      incomePerTick: 120,
      grudge: { score: 25 },
    });
  });

  it('maps a server world event without exposing an address or creating a new feed contract', () => {
    const event = toGhostFeedEvent(
      {
        id: 'event-1',
        crew_id: 'ghost-nightfall',
        event_type: 'attack',
        target_block_key: 'block-uuid-only',
        description: 'Nightfall Crew is applying pressure.',
        occurred_at: '2026-09-01T00:00:00.000Z',
      },
      [{
        id: 'ghost-nightfall',
        name: 'Nightfall Crew',
        homeTag: 'downtown',
        personality: { type: 'territory-hungry', aggression: 55, expansionDrive: 85, grudgeWeight: 40, caution: 30 },
        treasury: 0,
        roster: [],
        ownedBlockIds: [],
        claimedDnaIds: [],
        grudge: { score: 0 },
        incomePerTick: 0,
        lastTickAt: '2026-09-01T00:00:00.000Z',
      }],
    );

    expect(event).toMatchObject({
      id: 'server-event-1',
      crewName: 'Nightfall Crew',
      action: 'attack',
      targetBlockId: 'block-uuid-only',
    });
  });

  it('maps consequential encounter rows to a high-priority rival-pressure action and system rows to an informational action', () => {
    const crew = [{
      id: 'ghost-nightfall',
      name: 'Nightfall Crew',
      homeTag: 'downtown',
      personality: { type: 'territory-hungry' as const, aggression: 55, expansionDrive: 85, grudgeWeight: 40, caution: 30 },
      treasury: 0,
      roster: [],
      ownedBlockIds: [],
      claimedDnaIds: [],
      grudge: { score: 0 },
      incomePerTick: 0,
      lastTickAt: '2026-09-01T00:00:00.000Z',
    }];

    expect(toGhostFeedEvent({
      id: 'encounter-overrun', crew_id: 'ghost-nightfall', event_type: 'encounter', target_block_key: 'block-a',
      description: 'Your crew was overrun.', occurred_at: '2026-09-01T00:00:00.000Z',
    }, crew).action).toBe('attack');
    expect(toGhostFeedEvent({
      id: 'system-tick', crew_id: null, event_type: 'system', target_block_key: null,
      description: 'World state refreshed.', occurred_at: '2026-09-01T00:00:00.000Z',
    }, crew).action).toBe('reinforce');
  });

  it('does not submit a local placeholder block to the authoritative receipt endpoint', async () => {
    await expect(commitEncounterResult('home-block', result)).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('submits one typed receipt keyed by the deterministic result idempotency key', async () => {
    rpc.mockResolvedValue({
      data: { applied: true, resultId: 'receipt-1', resultKey: result.idempotencyKey },
      error: null,
    });

    await expect(commitEncounterResult('11111111-1111-4111-8111-111111111111', result)).resolves.toEqual({
      applied: true,
      resultId: 'receipt-1',
      resultKey: result.idempotencyKey,
    });
    expect(rpc).toHaveBeenCalledWith('commit_encounter_result', {
      p_result_key: result.idempotencyKey,
      p_block_id: '11111111-1111-4111-8111-111111111111',
      p_payload: result,
    });
  });

  it('recognizes UUID block IDs only', () => {
    expect(worldPersistenceInternals.isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(worldPersistenceInternals.isUuid('home-block')).toBe(false);
  });
});
