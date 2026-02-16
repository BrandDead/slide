import { corsHeaders } from '../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../_shared/utils.ts';
import { createSupabaseClient } from '../../_shared/supabaseClient.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action_type, unit_id, target_x, target_y, target_unit_id } = await parseBody<any>(req);

    const url = new URL(req.url);
    const combatId = url.pathname.split('/')[3];

    if (!combatId) {
      return errorResponse('Combat ID is required', 400);
    }

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get combat session
    const { data: combat, error: combatError } = await supabase
      .from('combat_logs')
      .select('*')
      .eq('id', combatId)
      .single();

    if (combatError || !combat) {
      return errorResponse('Combat not found', 404);
    }

    if (combat.outcome !== 'ongoing') {
      return errorResponse('Combat has already ended', 400);
    }

    // Process action (simplified - full logic in CombatService)
    let turnResult: any = { action: action_type, success: true };
    let combatEnded = false;
    let outcome = null;

    if (action_type === 'attack') {
      const damage = Math.floor(Math.random() * 30) + 10;
      turnResult.damage_dealt = damage;
      
      if (Math.random() < 0.1) {
        combatEnded = true;
        outcome = Math.random() < 0.5 ? 'attacker_win' : 'defender_win';
      }
    } else if (action_type === 'retreat') {
      combatEnded = true;
      outcome = 'defender_win';
    }

    if (combatEnded) {
      await supabase
        .from('combat_logs')
        .update({ 
          outcome,
          ended_at: new Date().toISOString()
        })
        .eq('id', combatId);
      
      // If attacker wins, transfer block ownership
      if (outcome === 'attacker_win') {
        await supabase
          .from('blocks')
          .update({ owner_id: user.id })
          .eq('id', combat.block_id);
      }
    }

    return successResponse({
      turn_result: turnResult,
      combat_state: {
        status: combatEnded ? 'ended' : 'active',
        outcome
      }
    });

  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});
