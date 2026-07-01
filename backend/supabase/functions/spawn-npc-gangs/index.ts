import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const NPC_GANGS = [
  { name: "The Scorpions", faction: "eastside", difficulty: 2, aggression: 65, wealth: 50 },
  { name: "Dead End Boys", faction: "westside", difficulty: 1, aggression: 45, wealth: 30 },
  { name: "South Side Reapers", faction: "southside", difficulty: 3, aggression: 75, wealth: 70 },
  { name: "The 400 Boyz", faction: "northside", difficulty: 2, aggression: 60, wealth: 55 },
  { name: "Grim Street Posse", faction: "downtown", difficulty: 4, aggression: 85, wealth: 80 },
  { name: "Ghost Block", faction: "eastside", difficulty: 3, aggression: 70, wealth: 65 },
  { name: "Iron Gate Clique", faction: "westside", difficulty: 2, aggression: 55, wealth: 45 },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify cron secret
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
    // Upsert NPC gangs
    const { data, error } = await supabase
      .from("npc_gangs")
      .upsert(NPC_GANGS, { onConflict: "name" })
      .select();

    if (error) throw error;

    // Find unclaimed blocks and assign NPC gangs to them
    const { data: unclaimedBlocks } = await supabase
      .from("blocks")
      .select("id, address")
      .is("owner_id", null)
      .limit(NPC_GANGS.length);

    let assigned = 0;
    if (unclaimedBlocks && unclaimedBlocks.length > 0) {
      for (let i = 0; i < Math.min(unclaimedBlocks.length, NPC_GANGS.length); i++) {
        const block = unclaimedBlocks[i];
        const gang = NPC_GANGS[i];

        // Mark block as NPC-controlled via metadata
        await supabase
          .from("blocks")
          .update({
            metadata: {
              npc_gang: gang.name,
              npc_aggression: gang.aggression,
              npc_difficulty: gang.difficulty,
              is_npc: true
            }
          })
          .eq("id", block.id);

        assigned++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, gangs_seeded: data?.length ?? 0, blocks_assigned: assigned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
