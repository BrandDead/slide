import { z } from 'zod';
import { corsHeaders } from '../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../_shared/utils.ts';
import { createSupabaseClient } from '../../_shared/supabaseClient.ts';

const EncounterResultSchema = z.object({
  idempotencyKey: z.string().min(1).max(160),
  outcome: z.enum(['secured', 'retreated', 'overrun']),
  crewDown: z.array(z.string().min(1)).max(32),
  oppositionDown: z.array(z.string().min(1)).max(32),
  objectiveProgress: z.number().finite().min(0),
  heatDelta: z.number().finite().int().min(-5).max(5),
  moraleDelta: z.number().finite().int().min(-100).max(100),
  pendingIncomeDelta: z.number().finite().int().min(-1000000).max(1000000),
  summary: z.string().min(1).max(500),
});

const CommitEncounterResultSchema = z.object({
  blockId: z.string().uuid(),
  result: EncounterResultSchema,
});

/**
 * Records an already-resolved deterministic encounter result. The database
 * RPC binds the receipt to auth.uid() and makes retries idempotent; this
 * endpoint deliberately does not calculate combat or trust a profile ID.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await parseBody<unknown>(req);
    const { blockId, result } = CommitEncounterResultSchema.parse(body);
    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) return errorResponse('Unauthorized', 401);

    const { data, error } = await supabase.rpc('commit_encounter_result', {
      p_result_key: result.idempotencyKey,
      p_block_id: blockId,
      p_payload: result,
    });

    if (error) return errorResponse(error.message, 400);
    return successResponse({ receipt: data });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.issues[0]?.message ?? 'Invalid request'}`, 400);
    }
    return errorResponse(error instanceof Error ? error.message : 'Unexpected error', 500);
  }
});
