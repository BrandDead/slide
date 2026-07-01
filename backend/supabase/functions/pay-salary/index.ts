import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get user's current cash and auth_id
    const { data: userData } = await supabase
      .from("users")
      .select("id, cash")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get active members and their salaries
    const { data: members } = await supabase
      .from("gang_members")
      .select("id, name, weekly_salary, loyalty")
      .eq("owner_id", userData.id)
      .eq("status", "idle");

    const activeMembers = members ?? [];
    const totalSalary = activeMembers.reduce(
      (sum: number, m: { weekly_salary: number }) => sum + (m.weekly_salary || 500),
      0
    );

    const canAfford = userData.cash >= totalSalary;

    if (canAfford) {
      // Deduct salary
      await supabase
        .from("users")
        .update({ cash: userData.cash - totalSalary })
        .eq("id", userData.id);

      // Log the salary payment
      await supabase.from("economy_logs").insert({
        user_id: userData.id,
        amount: -totalSalary,
        reason: "salary_payment"
      });

      // Record in salary_records
      await supabase.from("salary_records").insert({
        user_id: userData.id,
        total_paid: totalSalary,
        member_count: activeMembers.length,
        was_successful: true
      });

      return new Response(
        JSON.stringify({ success: true, paid: totalSalary, members: activeMembers.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Can't afford — apply morale penalty to all members
      const memberIds = activeMembers.map((m: { id: string }) => m.id);
      
      for (const memberId of memberIds) {
        const member = activeMembers.find((m: { id: string }) => m.id === memberId);
        if (member) {
          const newLoyalty = Math.max(0, (member.loyalty || 50) - 15);
          await supabase
            .from("gang_members")
            .update({ loyalty: newLoyalty })
            .eq("id", memberId);
        }
      }

      // Record failed payment
      await supabase.from("salary_records").insert({
        user_id: userData.id,
        total_paid: 0,
        member_count: activeMembers.length,
        was_successful: false
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Insufficient funds",
          needed: totalSalary,
          have: userData.cash,
          morale_penalty: -15
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
