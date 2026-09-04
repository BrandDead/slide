// ============================================================
// DEALT/SLIDE — Authoritative World Persistence
//
// Thin transport layer for the additive authoritative-world schema.
// It deliberately does not resolve combat, award money, or own a second
// client-state cache. The deterministic combat domain and Zustand stores
// remain the source of local interaction state.
// ============================================================

import { supabase } from './supabase';
import { IS_DEMO_MODE } from '../utils/demoSeed';
import type { CombatResult } from '../game/combat/types';
import type { GhostFeedEvent } from '../stores/ghostCrewStore';
import type {
  GhostActionType,
  GhostCrew,
  GhostMember,
  GrudgeEntry,
  Personality,
} from '../utils/ghostCrewEngine';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EncounterReceipt = {
  applied: boolean;
  resultId: string;
  resultKey: string;
};

type WorldEventRow = {
  id: string;
  crew_id: string | null;
  event_type: GhostActionType | 'encounter' | 'system';
  target_block_key: string | null;
  description: string;
  occurred_at: string;
};

type GhostCrewRow = {
  id: string;
  name: string;
  home_tag: string;
  personality: Personality;
  treasury: number;
  roster: GhostMember[];
  owned_block_ids: string[];
  claimed_dna_ids: string[];
  grudge: GrudgeEntry;
  income_per_tick: number;
  last_tick_at: string;
  last_move: string | null;
};

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asRecord<T extends object>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : fallback;
}

/** Maps the additive database row to the existing Ghost Crew domain type. */
export function toGhostCrew(row: GhostCrewRow): GhostCrew {
  return {
    id: row.id,
    name: row.name,
    homeTag: row.home_tag,
    personality: asRecord<Personality>(row.personality, {
      type: 'territory-hungry', aggression: 50, expansionDrive: 50, grudgeWeight: 50, caution: 50,
    }),
    treasury: Math.max(0, Number(row.treasury) || 0),
    roster: asArray<GhostMember>(row.roster),
    ownedBlockIds: asArray<string>(row.owned_block_ids),
    claimedDnaIds: asArray<string>(row.claimed_dna_ids),
    grudge: asRecord<GrudgeEntry>(row.grudge, { score: 0 }),
    incomePerTick: Math.max(0, Number(row.income_per_tick) || 0),
    lastTickAt: row.last_tick_at,
    lastMove: row.last_move ?? undefined,
  };
}

/** Maps a safe player-visible server event to the existing Ghost Feed shape. */
export function toGhostFeedEvent(row: WorldEventRow, crews: GhostCrew[]): GhostFeedEvent {
  const crew = row.crew_id ? crews.find((candidate) => candidate.id === row.crew_id) : undefined;
  return {
    id: `server-${row.id}`,
    crewId: row.crew_id ?? 'system',
    crewName: crew?.name ?? 'City Feed',
    // Encounter rows may contain a player loss or other high-consequence
    // result. System rows are informational. Neither should inherit the
    // low-priority green "lay low" presentation intended for a rival action.
    action: row.event_type === 'encounter' ? 'attack' : row.event_type === 'system' ? 'reinforce' : row.event_type,
    description: row.description,
    targetBlockId: row.target_block_key ?? undefined,
    timestamp: Date.parse(row.occurred_at) || Date.now(),
  };
}

/**
 * Load only the public rival state and events visible to this authenticated
 * profile. The caller overlays this data onto the existing Ghost Crew store.
 */
export async function loadAuthoritativeWorld(profileId: string): Promise<{
  crews: GhostCrew[];
  feed: GhostFeedEvent[];
}> {
  if (IS_DEMO_MODE || !profileId) return { crews: [], feed: [] };

  const db = supabase as any;
  const [{ data: crewRows, error: crewError }, { data: eventRows, error: eventError }] = await Promise.all([
    db.from('ghost_crews').select('*').order('name', { ascending: true }),
    db.from('world_events')
      .select('id, crew_id, event_type, target_block_key, description, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(50),
  ]);

  if (crewError) throw crewError;
  if (eventError) throw eventError;

  const crews = asArray<GhostCrewRow>(crewRows).map(toGhostCrew);
  const feed = asArray<WorldEventRow>(eventRows).map((row) => toGhostFeedEvent(row, crews));
  return { crews, feed };
}

/**
 * Persist a single idempotent receipt for an already-resolved deterministic
 * encounter. The function does not wait on the UI and never mutates the
 * combat-domain result.
 */
export async function commitEncounterResult(
  blockId: string,
  result: CombatResult,
): Promise<EncounterReceipt | null> {
  if (IS_DEMO_MODE || !isUuid(blockId) || !result.idempotencyKey) return null;

  const { data, error } = await (supabase as any).rpc('commit_encounter_result', {
    p_result_key: result.idempotencyKey,
    p_block_id: blockId,
    p_payload: result,
  });

  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Encounter receipt response was invalid.');
  }

  return {
    applied: Boolean(data.applied),
    resultId: String(data.resultId ?? ''),
    resultKey: String(data.resultKey ?? result.idempotencyKey),
  };
}

/** Exported only for focused unit tests and integration adapters. */
export const worldPersistenceInternals = { isUuid };
