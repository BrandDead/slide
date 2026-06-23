// ============================================================
// blockPersistence.service.ts
// Supabase persistence layer for the block store.
// Syncs BlockData and BlockPlacement to/from the blocks and
// block_placements tables. Gracefully no-ops when Supabase
// is not configured (offline / dev mode).
// Sprint: wire-morale-supabase-batch3
// ============================================================

import { supabase } from './supabase';
import type { BlockData, BlockPlacement } from '../types/block.types';

// ─── Helpers ─────────────────────────────────────────────────

function isSupabaseConfigured(): boolean {
  try {
    // If supabase client was created without env vars it throws during import.
    // We catch that at module level; here we just check the client exists.
    return !!supabase;
  } catch {
    return false;
  }
}

// ─── Block CRUD ──────────────────────────────────────────────

/**
 * Upsert a block record into the `blocks` table.
 * Maps BlockData fields to the DB schema.
 */
export async function persistBlock(block: BlockData, userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

   
  const { error } = await (supabase as any).from('blocks').upsert(
    {
      id: block.id,
      address: block.address,
      // Supabase geography point: POINT(lng lat)
      location: `POINT(${block.lng} ${block.lat})`,
      owner_id: block.owner === 'player' ? userId : null,
      status: block.owner === 'player' ? 'claimed' : block.owner === 'npc' ? 'claimed' : 'unclaimed',
      block_heat: block.heat * 20, // 0-5 → 0-100
      base_income: block.incomePerTick,
      updated_at: new Date().toISOString(),
      // Store grid, placements, morale as JSONB metadata
      metadata: {
        morale: block.morale,
        pendingIncome: block.pendingIncome,
        viewMode: block.viewMode,
        streetBackdropUrl: block.streetBackdropUrl,
        topdownBgUrl: block.topdownBgUrl,
      },
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.warn('[BlockPersistence] Failed to upsert block:', error.message);
  }
}

/**
 * Load all blocks owned by the current user from Supabase.
 * Returns an array of partial BlockData (grid is not stored in DB — regenerated locally).
 */
export async function loadPlayerBlocks(userId: string): Promise<Partial<BlockData>[]> {
  if (!isSupabaseConfigured()) return [];

   
  const { data, error } = await (supabase as any)
    .from('blocks')
    .select('id, address, block_heat, base_income, metadata, status')
    .eq('owner_id', userId);

  if (error || !data) {
    console.warn('[BlockPersistence] Failed to load blocks:', error?.message);
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    address: row.address,
    owner: 'player' as const,
    heat: Math.round((row.block_heat ?? 0) / 20),
    incomePerTick: row.base_income ?? 0,
    morale: row.metadata?.morale ?? 80,
    pendingIncome: row.metadata?.pendingIncome ?? 0,
    viewMode: row.metadata?.viewMode ?? 'topdown',
    streetBackdropUrl: row.metadata?.streetBackdropUrl,
    topdownBgUrl: row.metadata?.topdownBgUrl,
  }));
}

// ─── Placement CRUD ──────────────────────────────────────────

/**
 * Upsert all placements for a block into `block_placements` table.
 * Uses a custom table — see migration below.
 */
export async function persistPlacements(
  blockId: string,
  placements: BlockPlacement[]
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  // Delete existing placements for this block then re-insert
   
  const { error: delError } = await (supabase as any)
    .from('block_placements')
    .delete()
    .eq('block_id', blockId);

  if (delError) {
    console.warn('[BlockPersistence] Failed to clear placements:', delError.message);
    return;
  }

  if (placements.length === 0) return;

  const rows = placements.map((p) => ({
    block_id: blockId,
    member_id: p.memberId,
    member_name: p.memberName,
    role: p.role,
    grid_x: p.x,
    grid_y: p.y,
    zone_type: p.zoneType,
    income_per_tick: p.incomePerTick,
    exposure_risk: p.exposureRisk,
    level: p.level,
    health: p.health,
    portrait_url: p.portraitUrl ?? null,
    topdown_url: p.topdownUrl ?? null,
    updated_at: new Date().toISOString(),
  }));

   
  const { error } = await (supabase as any).from('block_placements').insert(rows);
  if (error) {
    console.warn('[BlockPersistence] Failed to insert placements:', error.message);
  }
}

/**
 * Load placements for a block from Supabase.
 */
export async function loadPlacements(blockId: string): Promise<BlockPlacement[]> {
  if (!isSupabaseConfigured()) return [];

   
  const { data, error } = await (supabase as any)
    .from('block_placements')
    .select('*')
    .eq('block_id', blockId);

  if (error || !data) {
    console.warn('[BlockPersistence] Failed to load placements:', error?.message);
    return [];
  }

  return data.map((row: any) => ({
    memberId:      row.member_id,
    memberName:    row.member_name,
    role:          row.role,
    x:             row.grid_x,
    y:             row.grid_y,
    zoneType:      row.zone_type,
    incomePerTick: row.income_per_tick,
    exposureRisk:  row.exposure_risk,
    level:         row.level,
    health:        row.health,
    portraitUrl:   row.portrait_url ?? undefined,
    topdownUrl:    row.topdown_url ?? undefined,
  }));
}
