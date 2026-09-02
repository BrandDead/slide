import { z } from 'zod';
import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../_shared/utils.ts';
import { createAdminSupabaseClient } from '../_shared/supabaseClient.ts';

const GhostCrewStateSchema = z.object({
  id: z.string().min(1).max(120),
  treasury: z.number().finite().int().min(0).optional(),
  roster: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    role: z.enum(['shooter', 'dealer', 'enforcer']),
    level: z.number().finite().int().min(1).max(10),
    alive: z.boolean(),
  })).max(32).optional(),
  ownedBlockIds: z.array(z.string().min(1).max(160)).max(100).optional(),
  claimedDnaIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  grudge: z.object({
    score: z.number().finite().min(0).max(100),
    lastIncidentBlockId: z.string().max(160).optional(),
    lastIncidentAt: z.string().datetime().optional(),
  }).optional(),
  incomePerTick: z.number().finite().int().min(0).max(1000000).optional(),
  lastTickAt: z.string().datetime().optional(),
  lastMove: z.string().max(500).optional(),
});

const WorldEventSchema = z.object({
  eventKey: z.string().min(1).max(220).optional(),
  crewId: z.string().min(1).max(120).optional(),
  recipientProfileId: z.string().uuid().optional(),
  action: z.enum(['claim', 'reinforce', 'attack', 'lay-low', 'system']).optional(),
  targetBlockId: z.string().max(160).optional(),
  description: z.string().min(1).max(500),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const WorldTickSchema = z.object({
  tickKey: z.string().min(1).max(220),
  seed: z.number().finite().int().optional(),
  crews: z.array(GhostCrewStateSchema).min(1).max(20),
  events: z.array(WorldEventSchema).max(100).default([]),
});

/**
 * Commits a world tick selected by trusted server scheduling logic. It has no
 * player-accessible execution path: the x-cron-secret must match the deployed
 * function secret before a service-role RPC client is created.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const expectedSecret = Deno.env.get('WORLD_TICK_SECRET');
  if (!expectedSecret || req.headers.get('x-cron-secret') !== expectedSecret) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await parseBody<unknown>(req);
    const tick = WorldTickSchema.parse(body);
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc('apply_ghost_world_tick', {
      p_tick_key: tick.tickKey,
      p_crew_states: tick.crews,
      p_events: tick.events,
      p_seed: tick.seed ?? null,
    });

    if (error) return errorResponse(error.message, 400);
    return successResponse({ tick: data });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.issues[0]?.message ?? 'Invalid request'}`, 400);
    }
    return errorResponse(error instanceof Error ? error.message : 'Unexpected error', 500);
  }
});
