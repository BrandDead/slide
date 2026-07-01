import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify cron secret for security
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (expectedSecret && cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Step 1: Calculate passive income per user and apply heat decay
    // This single query does both in one pass for efficiency
    const { data: incomeData, error: incomeError } = await supabase.rpc(
      "process_world_tick"
    );

    if (incomeError) {
      // Fallback: manual approach if RPC doesn't exist yet
      console.log("RPC not found, using manual approach:", incomeError.message);

      // Get all users with blocks
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, cash, heat");

      if (usersError) throw usersError;

      let processed = 0;
      let totalPaid = 0;
      const logEntries = [];

      for (const user of users ?? []) {
        // Sum income from owned blocks
        const { data: blocks } = await supabase
          .from("blocks")
          .select("income_per_hour")
          .eq("owner_id", user.id);

        const blockIncome = (blocks ?? []).reduce(
          (sum: number, b: { income_per_hour: number }) => sum + (b.income_per_hour || 0),
          0
        );

        // Tick income is 1/12 of hourly (5-min ticks)
        const tickIncome = Math.floor(blockIncome / 12);

        if (tickIncome > 0 || user.heat > 0) {
          const newCash = user.cash + tickIncome;
          const newHeat = Math.max(0, (user.heat || 0) - 2);

          await supabase
            .from("users")
            .update({ cash: newCash, heat: newHeat })
            .eq("id", user.id);

          if (tickIncome > 0) {
            logEntries.push({
              user_id: user.id,
              amount: tickIncome,
              reason: "passive_income",
            });
            totalPaid += tickIncome;
          }
          processed++;
        }
      }

      // Bulk insert economy logs
      if (logEntries.length > 0) {
        await supabase.from("economy_logs").insert(logEntries);
      }

      return new Response(
        JSON.stringify({ success: true, processed, totalPaid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result: incomeData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
