import { corsHeaders } from '../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../_shared/utils.ts';
import { createSupabaseClient } from '../../_shared/supabaseClient.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target_block_id, attacker_units, vehicle_type } = await parseBody<any>(req);

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if target block exists
    const { data: targetBlock, error: blockError } = await supabase
      .from('blocks')
      .select('id, owner_id')
      .eq('id', target_block_id)
      .single();

    if (blockError || !targetBlock) {
      return errorResponse('Target block not found', 404);
    }

    // Check if user owns attacking units
    const { data: attackerMembers, error: unitsError } = await supabase
      .from('gang_members')
      .select('id, name, role, accuracy, toughness')
      .in('id', attacker_units)
      .eq('owner_id', user.id)
      .eq('status', 'active');

    if (unitsError || attackerMembers.length !== attacker_units.length) {
      return errorResponse('One or more units not found or not available', 403);
    }

    // Create combat session in database
    const { data: combat, error: combatError } = await supabase
      .from('combat_logs')
      .insert({
        attacker_id: user.id,
        defender_id: targetBlock.owner_id,
        block_id: target_block_id,
        combat_type: 'slide',
        outcome: 'ongoing',
        attacker_units: attackerMembers,
        attacker_vehicle_id: null
      })
      .select('id')
      .single();

    if (combatError) {
      return errorResponse(combatError.message, 400);
    }

    // Get defender units
    const { data: defenderUnits } = await supabase
      .from('gang_members')
      .select('id, name, role, accuracy, toughness')
      .eq('assigned_block_id', target_block_id)
      .eq('status', 'active');

    return successResponse({
      combat_id: combat.id,
      attacker_units: attackerMembers,
      defender_units: defenderUnits || [],
      grid_size: { width: 8, height: 8 }
    }, 201);

  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});
