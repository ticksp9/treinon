import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConnectRequest {
  action:
    | "create_account"
    | "create_onboarding_link"
    | "sync_account"
    | "disconnect_account"
    | "get_status"
    | "update_payment_settings"
    | "register_manual_payment";
  club_id: string;
  // For update_payment_settings
  payment_mode?: string;
  allow_online_payments?: boolean;
  allow_manual_payments?: boolean;
  // For onboarding
  refresh_url?: string;
  return_url?: string;
  // For manual payment
  charge_id?: string;
  amount?: number;
  manual_method?: string;
  manual_reference?: string;
  proof_url?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body: ConnectRequest = await req.json();
    const { action, club_id } = body;

    // Verify financial admin access
    const { data: isAdmin } = await supabase.rpc("is_club_financial_admin", {
      _user_id: userId,
      _club_id: club_id,
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "update_payment_settings":
        result = await updatePaymentSettings(supabase, body, userId, club_id);
        break;
      case "create_account":
        result = await createConnectAccount(supabase, club_id, userId);
        break;
      case "create_onboarding_link":
        result = await createOnboardingLink(supabase, body, club_id, userId);
        break;
      case "sync_account":
        result = await syncAccount(supabase, club_id, userId);
        break;
      case "disconnect_account":
        result = await disconnectAccount(supabase, club_id, userId);
        break;
      case "get_status":
        result = await getStatus(supabase, club_id);
        break;
      case "register_manual_payment":
        result = await registerManualPayment(supabase, body, userId, club_id);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe connect error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Update payment settings ──
async function updatePaymentSettings(
  supabase: any, body: ConnectRequest, userId: string, clubId: string
) {
  const { payment_mode, allow_online_payments, allow_manual_payments } = body;

  // Get current settings for audit
  const { data: current } = await supabase
    .from("club_payment_settings")
    .select("*")
    .eq("club_id", clubId)
    .maybeSingle();

  const newValues: any = {};
  if (payment_mode !== undefined) {
    newValues.payment_mode = payment_mode;
    newValues.provider = payment_mode === "offline_manual" ? "none" : "stripe";
    newValues.allow_online_payments = payment_mode !== "offline_manual";
  }
  if (allow_online_payments !== undefined) newValues.allow_online_payments = allow_online_payments;
  if (allow_manual_payments !== undefined) newValues.allow_manual_payments = allow_manual_payments;
  newValues.updated_by = userId;

  if (current) {
    // Upsert
    await supabase
      .from("club_payment_settings")
      .update(newValues)
      .eq("club_id", clubId);
  } else {
    await supabase
      .from("club_payment_settings")
      .insert({
        club_id: clubId,
        ...newValues,
        created_by: userId,
      });
  }

  // Audit
  await supabase.from("payment_config_audit").insert({
    club_id: clubId,
    action: "payment_settings_updated",
    changed_by: userId,
    old_values: current || null,
    new_values: newValues,
  });

  return { updated: true };
}

// ── Create Stripe Connect account ──
async function createConnectAccount(supabase: any, clubId: string, userId: string) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("Stripe not configured");

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  // Get club details for pre-fill
  const { data: club } = await supabase
    .from("clubs")
    .select("name, email, country")
    .eq("id", clubId)
    .single();

  // Check for existing account
  const { data: existing } = await supabase
    .from("club_payment_accounts")
    .select("*")
    .eq("club_id", clubId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (existing?.external_account_id && existing.onboarding_status !== "rejected") {
    return { account_id: existing.external_account_id, already_exists: true };
  }

  // Create Standard connected account
  const account = await stripe.accounts.create({
    type: "standard",
    country: "PT",
    email: club?.email || undefined,
    business_type: "non_profit",
    metadata: {
      club_id: clubId,
      platform: "tatical_soccer_erp",
    },
  });

  // Save to DB
  await supabase.from("club_payment_accounts").upsert({
    club_id: clubId,
    provider: "stripe",
    mode: "live",
    external_account_id: account.id,
    account_type: "standard",
    onboarding_status: "pending",
    country: "PT",
    default_currency: "EUR",
    connected_at: new Date().toISOString(),
    metadata: { stripe_account_type: account.type },
  }, { onConflict: "club_id,provider,mode" });

  // Update payment settings
  await supabase.from("club_payment_settings").upsert({
    club_id: clubId,
    payment_mode: "stripe_connect",
    provider: "stripe",
    configuration_status: "pending",
    created_by: userId,
    updated_by: userId,
  }, { onConflict: "club_id" });

  // Audit
  await supabase.from("payment_config_audit").insert({
    club_id: clubId,
    action: "stripe_connect_account_created",
    changed_by: userId,
    new_values: { account_id: account.id, type: account.type },
  });

  return { account_id: account.id };
}

// ── Create onboarding link ──
async function createOnboardingLink(
  supabase: any, body: ConnectRequest, clubId: string, userId: string
) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("Stripe not configured");

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  const { data: account } = await supabase
    .from("club_payment_accounts")
    .select("external_account_id")
    .eq("club_id", clubId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (!account?.external_account_id) {
    throw new Error("No Stripe account found. Create one first.");
  }

  const accountLink = await stripe.accountLinks.create({
    account: account.external_account_id,
    refresh_url: body.refresh_url || `${body.return_url || (Deno.env.get("APP_URL") ?? "https://treinon.vercel.app")}/erp/payments?tab=config&refresh=true`,
    return_url: body.return_url || `${body.return_url || (Deno.env.get("APP_URL") ?? "https://treinon.vercel.app")}/erp/payments?tab=config&onboarding=complete`,
    type: "account_onboarding",
  });

  await supabase.from("payment_config_audit").insert({
    club_id: clubId,
    action: "stripe_onboarding_link_created",
    changed_by: userId,
    new_values: { url: accountLink.url },
  });

  return { url: accountLink.url, expires_at: accountLink.expires_at };
}

// ── Sync account state from Stripe ──
async function syncAccount(supabase: any, clubId: string, userId: string) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("Stripe not configured");

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  const { data: account } = await supabase
    .from("club_payment_accounts")
    .select("external_account_id")
    .eq("club_id", clubId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (!account?.external_account_id) {
    throw new Error("No Stripe account found");
  }

  const stripeAccount = await stripe.accounts.retrieve(account.external_account_id);

  const onboardingStatus = stripeAccount.details_submitted
    ? stripeAccount.charges_enabled
      ? "complete"
      : "restricted"
    : "pending";

  await supabase
    .from("club_payment_accounts")
    .update({
      onboarding_status: onboardingStatus,
      details_submitted: stripeAccount.details_submitted || false,
      charges_enabled: stripeAccount.charges_enabled || false,
      payouts_enabled: stripeAccount.payouts_enabled || false,
      capabilities_status: stripeAccount.capabilities || {},
      last_sync_at: new Date().toISOString(),
    })
    .eq("club_id", clubId)
    .eq("provider", "stripe");

  // Update payment settings based on account status
  const configStatus = stripeAccount.charges_enabled ? "active" : "pending";
  await supabase
    .from("club_payment_settings")
    .update({
      configuration_status: configStatus,
      allow_online_payments: stripeAccount.charges_enabled,
      updated_by: userId,
    })
    .eq("club_id", clubId);

  await supabase.from("payment_config_audit").insert({
    club_id: clubId,
    action: "stripe_account_synced",
    changed_by: userId,
    new_values: {
      onboarding_status: onboardingStatus,
      charges_enabled: stripeAccount.charges_enabled,
      payouts_enabled: stripeAccount.payouts_enabled,
    },
  });

  return {
    onboarding_status: onboardingStatus,
    charges_enabled: stripeAccount.charges_enabled,
    payouts_enabled: stripeAccount.payouts_enabled,
    details_submitted: stripeAccount.details_submitted,
  };
}

// ── Disconnect account ──
async function disconnectAccount(supabase: any, clubId: string, userId: string) {
  await supabase
    .from("club_payment_accounts")
    .update({
      onboarding_status: "not_started",
      charges_enabled: false,
      payouts_enabled: false,
      disconnected_at: new Date().toISOString(),
    })
    .eq("club_id", clubId)
    .eq("provider", "stripe");

  await supabase
    .from("club_payment_settings")
    .update({
      payment_mode: "offline_manual",
      provider: "none",
      allow_online_payments: false,
      configuration_status: "not_configured",
      updated_by: userId,
    })
    .eq("club_id", clubId);

  await supabase.from("payment_config_audit").insert({
    club_id: clubId,
    action: "stripe_account_disconnected",
    changed_by: userId,
  });

  return { disconnected: true };
}

// ── Get status ──
async function getStatus(supabase: any, clubId: string) {
  const { data: settings } = await supabase
    .from("club_payment_settings")
    .select("*")
    .eq("club_id", clubId)
    .maybeSingle();

  const { data: account } = await supabase
    .from("club_payment_accounts")
    .select("*")
    .eq("club_id", clubId)
    .eq("provider", "stripe")
    .maybeSingle();

  return {
    settings: settings || {
      payment_mode: "offline_manual",
      provider: "none",
      allow_online_payments: false,
      allow_manual_payments: true,
      configuration_status: "not_configured",
    },
    account: account || null,
  };
}

// ── Register manual payment ──
async function registerManualPayment(
  supabase: any, body: ConnectRequest, userId: string, clubId: string
) {
  const { charge_id, amount, manual_method, manual_reference, proof_url, notes } = body;
  if (!charge_id) throw new Error("charge_id is required");

  // Get charge
  const { data: charge } = await supabase
    .from("charges")
    .select("id, balance_due, description")
    .eq("id", charge_id)
    .single();

  if (!charge) throw new Error("Charge not found");

  const paymentAmount = amount || Number(charge.balance_due);
  if (paymentAmount <= 0) throw new Error("Invalid amount");

  // Create transaction
  const { data: txn } = await supabase
    .from("payment_transactions")
    .insert({
      club_id: clubId,
      charge_id,
      provider_type: "manual",
      payment_method_code: manual_method || "cash",
      gross_amount: paymentAmount,
      fee_amount: 0,
      net_amount: paymentAmount,
      currency: "EUR",
      transaction_status: "succeeded",
      transaction_date: new Date().toISOString(),
      transaction_reference: manual_reference || `MANUAL-${Date.now()}`,
      is_manual: true,
      manual_method: manual_method || "cash",
      manual_reference,
      proof_url,
      registered_by: userId,
    })
    .select("id")
    .single();

  if (!txn) throw new Error("Failed to create transaction");

  // Allocate to charge
  const allocateAmount = Math.min(paymentAmount, Number(charge.balance_due));
  await supabase.from("payment_allocations").insert({
    payment_id: txn.id,
    charge_id,
    allocated_amount: allocateAmount,
    allocation_source: "manual",
    created_by: userId,
  });

  // Update charge balance
  const newBalance = Math.max(0, Number(charge.balance_due) - allocateAmount);
  await supabase
    .from("charges")
    .update({
      balance_due: newBalance,
      status: newBalance <= 0 ? "paid" : "partially_paid",
    })
    .eq("id", charge_id);

  // Audit
  await supabase.from("payment_events").insert({
    club_id: clubId,
    payment_transaction_id: txn.id,
    event_type: "manual_payment_registered",
    event_source: "stripe-connect",
    actor_user_id: userId,
    payload: { amount: paymentAmount, method: manual_method, reference: manual_reference, notes },
  });

  return { transaction_id: txn.id, allocated: allocateAmount, new_balance: newBalance };
}
