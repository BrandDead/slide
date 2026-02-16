import { z } from 'zod';
import { corsHeaders } from '../../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../../_shared/utils.ts';
import { createSupabaseClient } from '../../../_shared/supabaseClient.ts';

const BlockClaimSchema = z.object({
  address: z.string(),
  city: z.string(),
  region: z.string(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseBody<any>(req);
    const validatedData = BlockClaimSchema.parse(body);

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if block already exists
    const { data: existingBlock } = await supabase
      .from('blocks')
      .select('*')
      .eq('address', validatedData.address)
      .eq('region', validatedData.region)
      .maybeSingle();

    if (existingBlock) {
      if (existingBlock.owner_id && existingBlock.owner_id !== user.id) {
        return errorResponse('Block is already claimed by another player', 400);
      }
      
      const { data: updatedBlock } = await supabase
        .from('blocks')
        .update({ owner_id: user.id, claimed_at: new Date().toISOString(), status: 'claimed' })
        .eq('id', existingBlock.id)
        .select()
        .single();

      return successResponse({ block: updatedBlock });
    } else {
      const { data: newBlock, error: insertError } = await supabase
        .from('blocks')
        .insert({
          address: validatedData.address,
          city: validatedData.city,
          region: validatedData.region,
          owner_id: user.id,
          traffic_value: Math.floor(Math.random() * 50) + 25,
          status: 'claimed',
          claimed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        return errorResponse(insertError.message, 400);
      }

      return successResponse({ block: newBlock });
    }

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0].message}`, 400);
    }
    return errorResponse(error.message, 500);
  }
});
