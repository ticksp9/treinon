import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreatePaymentRequest {
  action: "create_checkout" | "create_mbway" | "check_status";
  club_id: string;
  charge_id?: string;
  charge_ids?: string[];
  amount?: number;
  payment_method?: string;
  phone?: string;
  success_url?: string;
  cancel_url?: string;
  payment_intent_id?: string;
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

    const body: CreatePaymentRequest = await req.json();
    const { action, club_id } = body;

    // Verify authorization (financial admin or guardian)
    const { data: isAdmin } = await supabase.rpc("is_club_financial_admin", {
      _user_id: userId,
      _club_id: club_id,
    });

    const { data: guardianProfile } = await supabase
      .from("guardian_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!isAdmin && !guardianProfile) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Multi-tenant: resolve club payment mode ──
    const { data: paymentSettings } = await supabase
      .from("club_payment_settings")
      .select("payment_mode, provider, allow_online_payments, configuration_status")
      .eq("club_id", club_id)
      .maybeSingle();

    const paymentMode = paymentSettings?.payment_mode || "offline_manual";

    // For checkout and mbway, require online payments to be enabled
    if (action !== "check_status") {
      if (paymentMode === "offline_manual") {
        return new Response(JSON.stringify({
          error: "Pagamentos online não estão ativados para este clube. Use o modo de pagamento manual.",
          code: "ONLINE_PAYMENTS_DISABLED",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!paymentSettings?.allow_online_payments || paymentSettings?.configuration_status !== "active") {
        return new Response(JSON.stringify({
          error: "Integração de pagamentos não está ativa. Complete a configuração primeiro.",
          code: "INTEGRATION_NOT_ACTIVE",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Resolve Stripe key: platform key or Connect account ──
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey && action !== "check_status") {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get connected account ID for Stripe Connect mode
    let connectedAccountId: string | undefined;
    if (paymentMode === "stripe_connect") {
      const { data: account } = await supabase
        .from("club_payment_accounts")
        .select("external_account_id, charges_enabled")
        .eq("club_id", club_id)
        .eq("provider", "stripe")
        .maybeSingle();

      if (!account?.external_account_id || !account?.charges_enabled) {
        return new Response(JSON.stringify({
          error: "Conta Stripe Connect não está pronta para aceitar pagamentos.",
          code: "CONNECT_NOT_READY",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      connectedAccountId = account.external_account_id;
    }

    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" }) : null;
    let result: any;

    switch (action) {
      case "create_checkout":
        result = await createCheckoutSession(supabase, stripe!, body, userId, club_id, connectedAccountId, paymentMode);
        break;
      case "create_mbway":
        result = await createMbWayPayment(supabase, stripe!, body, userId, club_id, connectedAccountId, paymentMode);
        break;
      case "check_status":
        result = await checkPaymentStatus(supabase, body);
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
    console.error("Create payment error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function createCheckoutSession(
  supabase: any, stripe: Stripe, body: CreatePaymentRequest,
  userId: string, clubId: string, connectedAccountId?: string, paymentMode?: string
) {
  const { charge_id, charge_ids, amount, success_url, cancel_url, payment_method } = body;

  let totalAmount = amount || 0;
  let description = "Pagamento";
  let chargeRef = charge_id;

  if (charge_id) {
    const { data: charge } = await supabase
      .from("charges").select("*").eq("id", charge_id).single();
    if (charge) {
      totalAmount = Number(charge.balance_due);
      description = charge.description;
    }
  } else if (charge_ids?.length) {
    const { data: charges } = await supabase
      .from("charges").select("*").in("id", charge_ids);
    totalAmount = charges?.reduce((s: number, c: any) => s + Number(c.balance_due), 0) || 0;
    description = `Pagamento de ${charges?.length} cobranças`;
    chargeRef = charge_ids[0];
  }

  if (totalAmount <= 0) throw new Error("Invalid amount");

  // Create internal payment intent record
  const { data: intent, error: intentErr } = await supabase
    .from("payment_intents")
    .insert({
      club_id: clubId,
      charge_id: chargeRef,
      amount: totalAmount,
      currency: "EUR",
      provider_type: "stripe",
      payment_method_code: payment_method || "card",
      status: "created",
      payment_mode: paymentMode || "online",
      success_url, cancel_url,
      created_by: userId,
      metadata: { charge_ids: charge_ids || [charge_id], user_id: userId, connected_account: connectedAccountId },
    })
    .select("id")
    .single();

  if (intentErr) throw intentErr;

  // Build Stripe session params
  const paymentMethodTypes: any[] = ["card"];
  if (payment_method === "mb_way") paymentMethodTypes.push("mb_way" as any);
  if (payment_method === "sepa_debit") paymentMethodTypes.push("sepa_debit");

  const sessionParams: any = {
    payment_method_types: paymentMethodTypes,
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: description },
        unit_amount: Math.round(totalAmount * 100),
      },
      quantity: 1,
    }],
    mode: "payment",
    success_url: success_url || `${body.success_url || "https://taticalsoccer.lovable.app"}/erp/billing?payment=success`,
    cancel_url: cancel_url || `${body.cancel_url || "https://taticalsoccer.lovable.app"}/erp/billing?payment=cancelled`,
    metadata: {
      club_id: clubId,
      charge_id: chargeRef || "",
      payment_intent_id: intent.id,
      charge_ids: JSON.stringify(charge_ids || [charge_id]),
    },
  };

  // For Stripe Connect, create session on the connected account
  let session;
  if (connectedAccountId) {
    session = await stripe.checkout.sessions.create(sessionParams, {
      stripeAccount: connectedAccountId,
    });
  } else {
    session = await stripe.checkout.sessions.create(sessionParams);
  }

  await supabase
    .from("payment_intents")
    .update({
      provider_session_id: session.id,
      checkout_url: session.url,
      status: "pending",
    })
    .eq("id", intent.id);

  await supabase.from("payment_events").insert({
    club_id: clubId,
    payment_intent_id: intent.id,
    event_type: "payment_request_created",
    event_source: "create-payment",
    actor_user_id: userId,
    payload: { amount: totalAmount, method: payment_method, session_id: session.id, connected_account: connectedAccountId },
  });

  return { checkout_url: session.url, intent_id: intent.id, session_id: session.id };
}

async function createMbWayPayment(
  supabase: any, stripe: Stripe, body: CreatePaymentRequest,
  userId: string, clubId: string, connectedAccountId?: string, paymentMode?: string
) {
  const { charge_id, amount, phone } = body;

  let totalAmount = amount || 0;
  let description = "Pagamento MB WAY";

  if (charge_id) {
    const { data: charge } = await supabase
      .from("charges").select("*").eq("id", charge_id).single();
    if (charge) {
      totalAmount = Number(charge.balance_due);
      description = charge.description;
    }
  }

  if (totalAmount <= 0) throw new Error("Invalid amount");

  const { data: intent } = await supabase
    .from("payment_intents")
    .insert({
      club_id: clubId,
      charge_id,
      amount: totalAmount,
      currency: "EUR",
      provider_type: "stripe",
      payment_method_code: "mb_way",
      status: "created",
      payment_mode: paymentMode || "online",
      created_by: userId,
      metadata: { phone, charge_id, user_id: userId, connected_account: connectedAccountId },
    })
    .select("id")
    .single();

  const piParams: any = {
    amount: Math.round(totalAmount * 100),
    currency: "eur",
    payment_method_types: ["mb_way" as any],
    description,
    metadata: {
      club_id: clubId,
      charge_id: charge_id || "",
      payment_intent_id: intent.id,
    },
  };

  let pi;
  if (connectedAccountId) {
    pi = await stripe.paymentIntents.create(piParams, {
      stripeAccount: connectedAccountId,
    });
  } else {
    pi = await stripe.paymentIntents.create(piParams);
  }

  await supabase
    .from("payment_intents")
    .update({ provider_intent_id: pi.id, status: "pending" })
    .eq("id", intent.id);

  await supabase.from("payment_events").insert({
    club_id: clubId,
    payment_intent_id: intent.id,
    event_type: "mbway_payment_created",
    event_source: "create-payment",
    actor_user_id: userId,
    payload: { amount: totalAmount, phone, pi_id: pi.id, connected_account: connectedAccountId },
  });

  return {
    intent_id: intent.id,
    client_secret: pi.client_secret,
    provider_intent_id: pi.id,
    status: pi.status,
  };
}

async function checkPaymentStatus(supabase: any, body: CreatePaymentRequest) {
  const { payment_intent_id } = body;
  if (!payment_intent_id) throw new Error("Missing payment_intent_id");

  const { data: intent } = await supabase
    .from("payment_intents")
    .select("*, payment_transactions(*)")
    .eq("id", payment_intent_id)
    .single();

  return { intent };
}
