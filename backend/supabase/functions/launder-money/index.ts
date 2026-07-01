import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAUNDER_FEE = 0.20; // 20% fee

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be greater than 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    if (userData.cash < amount) {
      return new Response(
        JSON.stringify({ error: "Insufficient cash to launder" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fee = Math.floor(amount * LAUNDER_FEE);
    const cleanAmount = amount - fee;

    // Deduct dirty cash, add to bank (clean)
    // In the existing schema, "cash" is street cash, we'll use it as dirty cash
    // and log the laundered amount as a separate economy entry
    await supabase
      .from("users")
      .update({ cash: userData.cash - amount })
      .eq("id", userData.id);

    // Log the laundering transaction
    await supabase.from("economy_logs").insert([
      {
        user_id: userData.id,
        amount: -amount,
        reason: "launder_dirty_cash"
      },
      {
        user_id: userData.id,
        amount: cleanAmount,
        reason: "launder_clean_cash"
      }
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        dirty_deducted: amount,
        fee_paid: fee,
        clean_received: cleanAmount
      }),
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
