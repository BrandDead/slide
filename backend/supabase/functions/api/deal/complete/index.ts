import { z } from 'zod';
import { corsHeaders } from '../../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../../_shared/utils.ts';
import { createSupabaseClient } from '../../../_shared/supabaseClient.ts';

const DealCompleteSchema = z.object({
  drug_id: z.string().uuid(),
  quantity: z.number().positive(),
  client_type: z.string(),
  price: z.number().positive(),
  was_accepted: z.boolean(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseBody<any>(req);
    const validatedData = DealCompleteSchema.parse(body);

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('cash, heat_level, xp, level, total_deals, successful_deals')
      .eq('id', user.id)
      .single();

    let cashChange = 0;
    let heatChange = 0;
    let xpGained = 0;

    if (validatedData.was_accepted) {
      cashChange = validatedData.price * validatedData.quantity;
      heatChange = Math.floor(Math.random() * 3) + 1;
      xpGained = Math.floor(validatedData.price / 100) + 1;
    } else {
      heatChange = Math.floor(Math.random() * 5) + 3;
    }

    const newBalance = profile.cash + cashChange;
    const newHeat = Math.min(100, Math.max(0, profile.heat_level + heatChange));

    await supabase
      .from('profiles')
      .update({
        cash: newBalance,
        heat_level: newHeat,
        xp: profile.xp + xpGained,
        total_deals: profile.total_deals + 1,
        successful_deals: validatedData.was_accepted ? profile.successful_deals + 1 : profile.successful_deals
      })
      .eq('id', user.id);

    await supabase.from('transactions').insert({
      player_id: user.id,
      type: cashChange > 0 ? 'deal_profit' : 'deal_loss',
      amount: cashChange,
      balance_after: newBalance,
      drug_id: validatedData.drug_id,
      client_type: validatedData.client_type,
      quantity: validatedData.quantity,
      price_per_unit: validatedData.price
    });

    return successResponse({
      cash_change: cashChange,
      new_balance: newBalance,
      heat_change: heatChange,
      new_heat: newHeat,
      xp_gained: xpGained
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0].message}`, 400);
    }
    return errorResponse(error.message, 500);
  }
});
