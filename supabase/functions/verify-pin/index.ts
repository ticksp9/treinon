import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-side hash to match the client-side hash function
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "tacticaflow-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, pin, new_pin } = await req.json();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "verify") {
      if (!pin || typeof pin !== "string") {
        return new Response(
          JSON.stringify({ success: false, error: "PIN is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await adminClient
        .from("security_pins")
        .select("pin_hash")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, error: "PIN not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const inputHash = await hashPin(pin);
      const success = inputHash === data.pin_hash;

      return new Response(
        JSON.stringify({ success, error: success ? undefined : "Incorrect PIN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        return new Response(
          JSON.stringify({ success: false, error: "PIN must be 4-6 digits" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pinHash = await hashPin(pin);
      const { error } = await adminClient
        .from("security_pins")
        .upsert({ owner_id: user.id, pin_hash: pinHash }, { onConflict: "owner_id" });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to save PIN" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "change") {
      if (!pin || !new_pin) {
        return new Response(
          JSON.stringify({ success: false, error: "Current and new PIN required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify current PIN first
      const { data, error } = await adminClient
        .from("security_pins")
        .select("pin_hash")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, error: "PIN not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentHash = await hashPin(pin);
      if (currentHash !== data.pin_hash) {
        return new Response(
          JSON.stringify({ success: false, error: "Current PIN is incorrect" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save new PIN
      const newHash = await hashPin(new_pin);
      const { error: updateError } = await adminClient
        .from("security_pins")
        .update({ pin_hash: newHash })
        .eq("owner_id", user.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update PIN" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!pin) {
        return new Response(
          JSON.stringify({ success: false, error: "PIN required for deletion" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify current PIN first
      const { data, error } = await adminClient
        .from("security_pins")
        .select("pin_hash")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, error: "PIN not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentHash = await hashPin(pin);
      if (currentHash !== data.pin_hash) {
        return new Response(
          JSON.stringify({ success: false, error: "Incorrect PIN" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await adminClient
        .from("security_pins")
        .delete()
        .eq("owner_id", user.id);

      if (deleteError) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to delete PIN" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
