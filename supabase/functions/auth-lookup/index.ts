import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, username, email } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "lookup_username") {
      // Find email by username for login - only returns email, nothing else
      if (!username || typeof username !== "string") {
        return new Response(
          JSON.stringify({ error: "Username is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      if (error || !data) {
        // Don't reveal whether the username exists - generic error
        return new Response(
          JSON.stringify({ email: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ email: data.email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_username") {
      // Check if username is taken (for signup)
      if (!username || typeof username !== "string") {
        return new Response(
          JSON.stringify({ error: "Username is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      return new Response(
        JSON.stringify({ exists: !!data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_email") {
      // Check if email is taken (for signup)
      if (!email || typeof email !== "string") {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      return new Response(
        JSON.stringify({ exists: !!data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
