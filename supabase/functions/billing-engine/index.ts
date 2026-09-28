import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateChargesRequest {
  action: "generate_monthly" | "mark_overdue" | "generate_alerts";
  club_id: string;
  reference_month?: number;
  reference_year?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: GenerateChargesRequest = await req.json();
    const { action, club_id, reference_month, reference_year } = body;

    // Verify user is club financial admin
    const { data: isAdmin } = await supabase.rpc("is_club_financial_admin", {
      _user_id: user.id,
      _club_id: club_id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "generate_monthly":
        result = await generateMonthlyCharges(supabase, club_id, reference_month!, reference_year!, user.id);
        break;
      case "mark_overdue":
        result = await markOverdueCharges(supabase, club_id, user.id);
        break;
      case "generate_alerts":
        result = await generateAlerts(supabase, club_id, user.id);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Billing engine error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateMonthlyCharges(
  supabase: any, clubId: string, month: number, year: number, actorId: string
) {
  // Get active assignments for this club
  const { data: assignments, error: assErr } = await supabase
    .from("fee_assignments")
    .select("*, fee_plans(*)")
    .eq("club_id", clubId)
    .eq("status", "active")
    .eq("is_exempt", false);

  if (assErr) throw assErr;

  let created = 0;
  let skipped = 0;

  for (const assignment of (assignments || [])) {
    const plan = assignment.fee_plans;
    if (!plan || !plan.is_active || !plan.auto_generate) { skipped++; continue; }

    // Only generate for monthly plans in generate_monthly
    if (plan.billing_frequency !== "monthly") { skipped++; continue; }

    // Check for existing charge (unique index prevents duplicates too)
    const { data: existing } = await supabase
      .from("charges")
      .select("id")
      .eq("fee_assignment_id", assignment.id)
      .eq("reference_month", month)
      .eq("reference_year", year)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existing) { skipped++; continue; }

    // Calculate amounts
    const baseAmount = assignment.custom_amount ?? plan.amount;
    let discountAmount = 0;
    if (assignment.discount_type === "percentage" && assignment.discount_value) {
      discountAmount = Math.round(baseAmount * (assignment.discount_value / 100) * 100) / 100;
    } else if (assignment.discount_type === "fixed" && assignment.discount_value) {
      discountAmount = assignment.discount_value;
    }
    if (assignment.is_scholarship) {
      discountAmount = baseAmount * 0.5; // 50% scholarship default
    }
    const finalAmount = Math.max(0, baseAmount - discountAmount);
    const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(plan.due_day).padStart(2, "0")}`;

    const { error: insertErr } = await supabase.from("charges").insert({
      club_id: clubId,
      fee_assignment_id: assignment.id,
      fee_plan_id: plan.id,
      player_id: assignment.player_id,
      guardian_id: assignment.guardian_id,
      charge_type: plan.plan_type,
      description: `${plan.name} - ${String(month).padStart(2, "0")}/${year}`,
      reference_month: month,
      reference_year: year,
      season: assignment.season || plan.season,
      original_amount: baseAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      balance_due: finalAmount,
      due_date: dueDate,
      status: "pending",
    });

    if (insertErr) {
      console.error("Insert charge error:", insertErr);
      skipped++;
    } else {
      created++;
      // Audit event
      await supabase.from("financial_events").insert({
        club_id: clubId,
        event_type: "charge_generated",
        entity_type: "charge",
        entity_id: assignment.id,
        actor_user_id: actorId,
        payload: { month, year, amount: finalAmount, plan_name: plan.name },
      });
    }
  }

  return { created, skipped };
}

async function markOverdueCharges(supabase: any, clubId: string, actorId: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: pending, error } = await supabase
    .from("charges")
    .select("id, due_date")
    .eq("club_id", clubId)
    .eq("status", "pending")
    .lt("due_date", today);

  if (error) throw error;

  let updated = 0;
  for (const charge of (pending || [])) {
    await supabase
      .from("charges")
      .update({ status: "overdue" })
      .eq("id", charge.id);

    await supabase.from("financial_events").insert({
      club_id: clubId,
      event_type: "charge_marked_overdue",
      entity_type: "charge",
      entity_id: charge.id,
      actor_user_id: actorId,
      payload: { due_date: charge.due_date },
    });
    updated++;
  }

  return { updated };
}

async function generateAlerts(supabase: any, clubId: string, actorId: string) {
  // Get overdue charges without recent alert
  const { data: overdue, error } = await supabase
    .from("charges")
    .select("id, player_id, guardian_id, balance_due, due_date, description")
    .eq("club_id", clubId)
    .eq("status", "overdue");

  if (error) throw error;

  let alertsCreated = 0;
  for (const charge of (overdue || [])) {
    // Check for recent alert (within 7 days)
    const { data: recentAlert } = await supabase
      .from("billing_alerts")
      .select("id")
      .eq("charge_id", charge.id)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (recentAlert) continue;

    // Find guardian user_id for notification
    let recipientUserId = null;
    if (charge.guardian_id) {
      const { data: gp } = await supabase
        .from("guardian_profiles")
        .select("user_id")
        .eq("id", charge.guardian_id)
        .maybeSingle();
      recipientUserId = gp?.user_id;
    }
    if (!recipientUserId && charge.player_id) {
      const { data: pg } = await supabase
        .from("player_guardians")
        .select("guardian_id, guardian_profiles(user_id)")
        .eq("player_id", charge.player_id)
        .eq("is_primary", true)
        .maybeSingle();
      recipientUserId = (pg?.guardian_profiles as any)?.user_id;
    }

    await supabase.from("billing_alerts").insert({
      club_id: clubId,
      charge_id: charge.id,
      player_id: charge.player_id,
      guardian_id: charge.guardian_id,
      alert_type: "overdue_reminder",
      recipient_user_id: recipientUserId,
      status: "sent",
      sent_at: new Date().toISOString(),
      metadata: { balance_due: charge.balance_due, description: charge.description },
    });
    alertsCreated++;
  }

  return { alertsCreated };
}
