import { z } from 'zod';
import { corsHeaders } from '../../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../../_shared/utils.ts';
import { createSupabaseClient } from '../../../_shared/supabaseClient.ts';

const MemberRecruitSchema = z.object({
  name: z.string().min(1).max(50),
  role: z.enum(['soldier', 'dealer', 'enforcer', 'chemist', 'driver', 'lookout']).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseBody<any>(req);
    const validatedData = MemberRecruitSchema.parse(body);

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { data: member, error: insertError } = await supabase
      .from('gang_members')
      .insert({
        owner_id: user.id,
        name: validatedData.name,
        role: validatedData.role || 'soldier',
        accuracy: Math.floor(Math.random() * 30) + 40,
        toughness: Math.floor(Math.random() * 30) + 40,
        speed: Math.floor(Math.random() * 30) + 40,
        stealth: Math.floor(Math.random() * 30) + 40,
        hustle: Math.floor(Math.random() * 30) + 40,
        weekly_salary: 500 + Math.floor(Math.random() * 500)
      })
      .select()
      .single();

    if (insertError) {
      return errorResponse(insertError.message, 400);
    }

    return successResponse({ member }, 201);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0].message}`, 400);
    }
    return errorResponse(error.message, 500);
  }
});
