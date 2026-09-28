import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!stripeKey || !webhookSecret) {
    console.error("Missing Stripe configuration");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: check if event already processed
    const { data: existingEvent } = await supabase
      .from("payment_events")
      .select("id")
      .eq("provider_event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For Connect events, the account field identifies which connected account
    const connectedAccountId = (event as any).account;

    // Process event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event.data.object as any, event.id, connectedAccountId);
        break;
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(supabase, event.data.object as any, event.id, connectedAccountId);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(supabase, event.data.object as any, event.id);
        break;
      case "charge.refunded":
        await handleChargeRefunded(supabase, event.data.object as any, event.id);
        break;
      case "charge.dispute.created":
        await handleDisputeCreated(supabase, event.data.object as any, event.id);
        break;
      case "account.updated":
        await handleAccountUpdated(supabase, event.data.object as any, event.id);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: "Processing error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Resolve club_id from connected account ──
async function resolveClubId(supabase: any, metadata: any, connectedAccountId?: string): Promise<string | null> {
  // First try metadata
  if (metadata?.club_id) return metadata.club_id;
  
  // Then try connected account mapping
  if (connectedAccountId) {
    const { data: account } = await supabase
      .from("club_payment_accounts")
      .select("club_id")
      .eq("external_account_id", connectedAccountId)
      .maybeSingle();
    if (account) return account.club_id;
  }
  
  return null;
}

async function handleCheckoutCompleted(supabase: any, session: any, eventId: string, connectedAccountId?: string) {
  const clubId = await resolveClubId(supabase, session.metadata, connectedAccountId);
  const chargeId = session.metadata?.charge_id;
  const intentId = session.metadata?.payment_intent_id;

  if (!clubId) {
    console.error("checkout.session.completed: cannot resolve club_id");
    return;
  }

  // Update payment intent status
  if (intentId) {
    await supabase
      .from("payment_intents")
      .update({ status: "succeeded", provider_intent_id: session.payment_intent })
      .eq("id", intentId);
  } else if (session.payment_intent) {
    await supabase
      .from("payment_intents")
      .update({ status: "succeeded" })
      .eq("provider_session_id", session.id);
  }

  const grossAmount = (session.amount_total || 0) / 100;

  // Create payment transaction
  const { data: txn } = await supabase
    .from("payment_transactions")
    .insert({
      club_id: clubId,
      charge_id: chargeId || null,
      payment_intent_id: intentId || null,
      provider_type: "stripe",
      payment_method_code: session.payment_method_types?.[0] || "card",
      provider_payment_id: session.payment_intent,
      provider_charge_id: session.payment_intent,
      provider_customer_id: session.customer,
      gross_amount: grossAmount,
      fee_amount: 0,
      net_amount: grossAmount,
      currency: (session.currency || "eur").toUpperCase(),
      transaction_status: "succeeded",
      transaction_date: new Date().toISOString(),
      payer_email: session.customer_details?.email,
      payer_name: session.customer_details?.name,
      raw_provider_payload: session,
    })
    .select("id")
    .single();

  // Auto-allocate to charge
  if (chargeId && txn) {
    const { data: charge } = await supabase
      .from("charges")
      .select("id, balance_due")
      .eq("id", chargeId)
      .single();

    if (charge) {
      const allocateAmount = Math.min(grossAmount, Number(charge.balance_due));
      await supabase.from("payment_allocations").insert({
        payment_id: txn.id,
        charge_id: chargeId,
        allocated_amount: allocateAmount,
        allocation_source: "webhook",
      });

      const newBalance = Math.max(0, Number(charge.balance_due) - allocateAmount);
      await supabase
        .from("charges")
        .update({
          balance_due: newBalance,
          status: newBalance <= 0 ? "paid" : "partially_paid",
        })
        .eq("id", chargeId);
    }
  }

  // Handle multi-charge allocation
  if (session.metadata?.charge_ids) {
    try {
      const chargeIds = JSON.parse(session.metadata.charge_ids).filter((id: string) => id && id !== chargeId);
      if (chargeIds.length > 0 && txn) {
        let remaining = grossAmount;
        // Deduct first charge allocation
        if (chargeId) {
          const { data: firstCharge } = await supabase.from("charges").select("balance_due").eq("id", chargeId).single();
          if (firstCharge) remaining -= Math.min(remaining, Number(firstCharge.balance_due));
        }
        
        for (const cId of chargeIds) {
          if (remaining <= 0) break;
          const { data: c } = await supabase.from("charges").select("id, balance_due").eq("id", cId).single();
          if (!c) continue;
          const alloc = Math.min(remaining, Number(c.balance_due));
          await supabase.from("payment_allocations").insert({
            payment_id: txn.id,
            charge_id: cId,
            allocated_amount: alloc,
            allocation_source: "webhook",
          });
          const nb = Math.max(0, Number(c.balance_due) - alloc);
          await supabase.from("charges").update({ balance_due: nb, status: nb <= 0 ? "paid" : "partially_paid" }).eq("id", cId);
          remaining -= alloc;
        }
      }
    } catch { /* ignore parse errors */ }
  }

  await supabase.from("payment_events").insert({
    club_id: clubId,
    payment_transaction_id: txn?.id,
    payment_intent_id: intentId,
    event_type: "payment_succeeded",
    event_source: "stripe_webhook",
    provider_event_id: eventId,
    payload: { session_id: session.id, amount: grossAmount, connected_account: connectedAccountId },
  });
}

async function handlePaymentSucceeded(supabase: any, pi: any, eventId: string, connectedAccountId?: string) {
  const clubId = await resolveClubId(supabase, pi.metadata, connectedAccountId);
  if (!clubId) return;

  await supabase
    .from("payment_intents")
    .update({ status: "succeeded" })
    .eq("provider_intent_id", pi.id);

  await supabase.from("payment_events").insert({
    club_id: clubId,
    event_type: "payment_intent_succeeded",
    event_source: "stripe_webhook",
    provider_event_id: eventId,
    payload: { payment_intent_id: pi.id, amount: (pi.amount || 0) / 100, connected_account: connectedAccountId },
  });
}

async function handlePaymentFailed(supabase: any, pi: any, eventId: string) {
  const clubId = pi.metadata?.club_id;
  if (!clubId) return;

  await supabase
    .from("payment_intents")
    .update({ status: "failed" })
    .eq("provider_intent_id", pi.id);

  await supabase.from("payment_events").insert({
    club_id: clubId,
    event_type: "payment_failed",
    event_source: "stripe_webhook",
    provider_event_id: eventId,
    payload: { payment_intent_id: pi.id, error: pi.last_payment_error?.message },
  });
}

async function handleChargeRefunded(supabase: any, charge: any, eventId: string) {
  const clubId = charge.metadata?.club_id;
  if (!clubId) return;

  await supabase
    .from("payment_transactions")
    .update({ refund_status: "refunded" })
    .eq("provider_charge_id", charge.id);

  await supabase.from("payment_events").insert({
    club_id: clubId,
    event_type: "payment_refunded",
    event_source: "stripe_webhook",
    provider_event_id: eventId,
    payload: { charge_id: charge.id, amount_refunded: (charge.amount_refunded || 0) / 100 },
  });
}

async function handleDisputeCreated(supabase: any, dispute: any, eventId: string) {
  const chargeId = dispute.charge;
  if (!chargeId) return;

  const { data: txn } = await supabase
    .from("payment_transactions")
    .select("id, club_id")
    .eq("provider_charge_id", chargeId)
    .maybeSingle();

  if (txn) {
    await supabase
      .from("payment_transactions")
      .update({ dispute_status: "open" })
      .eq("id", txn.id);

    await supabase.from("payment_events").insert({
      club_id: txn.club_id,
      payment_transaction_id: txn.id,
      event_type: "dispute_created",
      event_source: "stripe_webhook",
      provider_event_id: eventId,
      payload: { dispute_id: dispute.id, amount: (dispute.amount || 0) / 100, reason: dispute.reason },
    });
  }
}

// ── Handle Stripe Connect account.updated events ──
async function handleAccountUpdated(supabase: any, account: any, eventId: string) {
  // Find club by connected account
  const { data: clubAccount } = await supabase
    .from("club_payment_accounts")
    .select("club_id")
    .eq("external_account_id", account.id)
    .maybeSingle();

  if (!clubAccount) {
    console.log(`account.updated for unknown account ${account.id}`);
    return;
  }

  const clubId = clubAccount.club_id;
  const onboardingStatus = account.details_submitted
    ? account.charges_enabled ? "complete" : "restricted"
    : "pending";

  await supabase
    .from("club_payment_accounts")
    .update({
      onboarding_status: onboardingStatus,
      details_submitted: account.details_submitted || false,
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      capabilities_status: account.capabilities || {},
      last_sync_at: new Date().toISOString(),
    })
    .eq("external_account_id", account.id);

  // Auto-update payment settings config status
  const configStatus = account.charges_enabled ? "active" : "pending";
  await supabase
    .from("club_payment_settings")
    .update({
      configuration_status: configStatus,
      allow_online_payments: account.charges_enabled,
    })
    .eq("club_id", clubId);

  await supabase.from("payment_events").insert({
    club_id: clubId,
    event_type: "stripe_account_updated",
    event_source: "stripe_webhook",
    provider_event_id: eventId,
    payload: {
      account_id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      onboarding_status: onboardingStatus,
    },
  });
}
