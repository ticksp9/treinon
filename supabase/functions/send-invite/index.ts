import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Template Engine (server-side mirror) ─────────────────────────────────────
const ALLOWED_VARS = new Set([
  "recipient_name", "app_name", "club_name", "team_name", "age_group",
  "player_name", "inviter_name", "inviter_role", "invite_link", "invite_code",
  "support_email", "expires_at", "channel_name", "profile_label", "context_label",
]);

const UNSAFE_PATTERNS = [
  /^(window|document|process|global|globalThis|self|parent|top|frames)$/i,
  /^(eval|Function|constructor|__proto__|prototype)$/i,
  /\./, /\[/, /\(/,
];

function isSafeKey(key: string): boolean {
  if (!key || key.length > 50) return false;
  if (!/^[a-z][a-z0-9_]*$/i.test(key)) return false;
  return !UNSAFE_PATTERNS.some(p => p.test(key));
}

const FALLBACKS: Record<string, string> = {
  app_name: "TaticalSoccer",
  inviter_name: "Equipa Técnica",
  club_name: "", age_group: "", player_name: "", inviter_role: "",
  support_email: "", channel_name: "", profile_label: "", context_label: "",
};

interface RenderResult {
  renderedText: string;
  missingRequired: string[];
  warnings: string[];
}

function renderTemplate(template: string, ctx: Record<string, string>): RenderResult {
  const missingRequired: string[] = [];
  const warnings: string[] = [];
  const REQUIRED = new Set(["recipient_name", "invite_link"]);

  const renderedText = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!isSafeKey(key) || !ALLOWED_VARS.has(key)) return match;
    const value = ctx[key];
    if (value !== undefined && value !== null && value !== "") return value;
    if (FALLBACKS[key] !== undefined) return FALLBACKS[key];
    if (REQUIRED.has(key)) {
      missingRequired.push(key);
      warnings.push(`Missing required variable: {{${key}}}`);
      return match;
    }
    return "";
  });

  return { renderedText, missingRequired, warnings };
}

// ── Status Machine ───────────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  queued: new Set(["sending", "cancelled", "failed"]),
  sending: new Set(["sent", "failed"]),
  sent: new Set(["delivered", "opened", "clicked", "accepted", "bounced", "failed"]),
  delivered: new Set(["opened", "clicked", "accepted"]),
  opened: new Set(["clicked", "accepted"]),
  clicked: new Set(["accepted"]),
  failed: new Set(["retry_scheduled", "cancelled"]),
  retry_scheduled: new Set(["sending", "cancelled"]),
  bounced: new Set([]),
  accepted: new Set([]),
  cancelled: new Set([]),
  exhausted: new Set([]),
};

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

// Permanent failures that should NOT be retried
const PERMANENT_FAILURES = new Set([
  "invalid_email", "invalid_phone", "invalid_recipient",
  "invalid_template", "missing_required_variables",
  "bounced", "unsubscribed", "spam_complaint",
]);

function isRetryableFailure(reason: string | null): boolean {
  if (!reason) return true;
  const lower = reason.toLowerCase();
  return !PERMANENT_FAILURES.has(lower) &&
    !lower.includes("invalid") &&
    !lower.includes("bounce") &&
    !lower.includes("unsubscribe");
}

// Exponential backoff: 1min, 5min, 15min
function getRetryDelay(retryCount: number): number {
  const delays = [60_000, 300_000, 900_000];
  return delays[Math.min(retryCount, delays.length - 1)];
}

// ── Provider Adapters ────────────────────────────────────────────────────────
interface SendResult {
  success: boolean;
  providerId?: string;
  providerName: string;
  error?: string;
  permanent?: boolean; // If true, don't retry
}

async function sendEmail(
  recipientEmail: string,
  subject: string,
  body: string,
  resendApiKey: string
): Promise<SendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "TaticalSoccer <noreply@taticalsoccer.lovable.app>",
        to: [recipientEmail],
        subject: subject || "Convite - TaticalSoccer",
        text: body,
      }),
    });

    const result = await response.json();

    if (response.ok && result.id) {
      return { success: true, providerId: result.id, providerName: "resend" };
    }

    // Check for permanent failures
    const errMsg = result.message || JSON.stringify(result);
    const isPermanent = response.status === 422 || 
      errMsg.toLowerCase().includes("invalid") ||
      errMsg.toLowerCase().includes("not allowed");

    return { 
      success: false, 
      providerName: "resend", 
      error: errMsg,
      permanent: isPermanent,
    };
  } catch (err: any) {
    return { 
      success: false, 
      providerName: "resend", 
      error: err.message,
      permanent: false, // Network errors are retryable
    };
  }
}

async function sendSms(
  recipientPhone: string,
  body: string
): Promise<SendResult> {
  // SMS provider adapter — ready for Twilio integration
  // When TWILIO_API_KEY and LOVABLE_API_KEY are configured, this will send real SMS.
  // Until then, records the attempt with a clear status.
  
  const twilioApiKey = Deno.env.get("TWILIO_API_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
  
  if (twilioApiKey && lovableApiKey && twilioFromNumber) {
    try {
      const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
      const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "X-Connection-Api-Key": twilioApiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: recipientPhone,
          From: twilioFromNumber,
          Body: body,
        }),
      });

      const result = await response.json();

      if (response.ok && result.sid) {
        return { success: true, providerId: result.sid, providerName: "twilio" };
      }

      const errMsg = result.message || JSON.stringify(result);
      const isPermanent = response.status === 400 || response.status === 422 ||
        errMsg.toLowerCase().includes("invalid") ||
        errMsg.toLowerCase().includes("unverified");

      return {
        success: false,
        providerName: "twilio",
        error: errMsg,
        permanent: isPermanent,
      };
    } catch (err: any) {
      return {
        success: false,
        providerName: "twilio",
        error: err.message,
        permanent: false,
      };
    }
  }

  // Provider not configured — return clear status
  return {
    success: false,
    providerName: "none",
    error: "SMS provider not configured. Configure Twilio connector to enable SMS sending.",
    permanent: true,
  };
}

// ── Auth helper ──────────────────────────────────────────────────────────────
async function getAuthUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token || token === anonKey) return null;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ── Delivery processing ─────────────────────────────────────────────────────
async function processDelivery(
  supabase: any,
  deliveryId: string,
  channel: string,
  recipientEmail: string | null,
  recipientPhone: string | null,
  renderedSubject: string | null,
  renderedMessage: string,
  inviteId: string,
  resendApiKey: string | undefined,
) {
  // Transition to sending
  await supabase.from("invite_deliveries")
    .update({ send_status: "sending", last_attempt_at: new Date().toISOString() })
    .eq("id", deliveryId);

  let result: SendResult;

  if (channel === "email") {
    if (!recipientEmail) {
      result = { success: false, providerName: "none", error: "No recipient email", permanent: true };
    } else if (!resendApiKey) {
      result = { success: false, providerName: "none", error: "Email provider (Resend) not configured", permanent: true };
    } else {
      result = await sendEmail(recipientEmail, renderedSubject || "Convite - TaticalSoccer", renderedMessage, resendApiKey);
    }
  } else if (channel === "sms") {
    if (!recipientPhone) {
      result = { success: false, providerName: "none", error: "No recipient phone", permanent: true };
    } else {
      result = await sendSms(recipientPhone, renderedMessage);
    }
  } else if (channel === "whatsapp") {
    // WhatsApp adapter — architecture ready, provider pending
    result = { success: false, providerName: "none", error: "WhatsApp provider not yet configured", permanent: true };
  } else {
    result = { success: false, providerName: "none", error: `Unknown channel: ${channel}`, permanent: true };
  }

  if (result.success) {
    await supabase.from("invite_deliveries")
      .update({
        send_status: "sent",
        sent_at: new Date().toISOString(),
        provider_name: result.providerName,
        provider_message_id: result.providerId || null,
        failure_reason: null,
      })
      .eq("id", deliveryId);

    await supabase.from("invite_events").insert({
      invite_id: inviteId,
      delivery_id: deliveryId,
      event_type: "sent",
      event_source: "backend",
      payload: { provider: result.providerName, provider_id: result.providerId, channel },
    });

    return "sent";
  } else {
    // Get current delivery for retry logic
    const { data: delivery } = await supabase
      .from("invite_deliveries")
      .select("retry_count, max_retries")
      .eq("id", deliveryId)
      .single();

    const retryCount = (delivery?.retry_count || 0) + 1;
    const maxRetries = delivery?.max_retries || 3;
    const canRetry = !result.permanent && isRetryableFailure(result.error || null) && retryCount <= maxRetries;

    if (canRetry) {
      const delay = getRetryDelay(retryCount - 1);
      const nextRetryAt = new Date(Date.now() + delay).toISOString();

      await supabase.from("invite_deliveries")
        .update({
          send_status: "retry_scheduled",
          failure_reason: result.error,
          retry_count: retryCount,
          next_retry_at: nextRetryAt,
          provider_name: result.providerName,
        })
        .eq("id", deliveryId);

      await supabase.from("invite_events").insert({
        invite_id: inviteId,
        delivery_id: deliveryId,
        event_type: "retry_scheduled",
        event_source: "backend",
        payload: { 
          reason: result.error, 
          retry_count: retryCount, 
          max_retries: maxRetries,
          next_retry_at: nextRetryAt,
          channel,
        },
      });

      return "retry_scheduled";
    } else {
      const finalStatus = retryCount > maxRetries ? "exhausted" : "failed";
      
      await supabase.from("invite_deliveries")
        .update({
          send_status: finalStatus,
          failure_reason: result.error,
          retry_count: retryCount > 0 ? retryCount : 0,
          provider_name: result.providerName,
        })
        .eq("id", deliveryId);

      await supabase.from("invite_events").insert({
        invite_id: inviteId,
        delivery_id: deliveryId,
        event_type: finalStatus === "exhausted" ? "retry_exhausted" : "failed",
        event_source: "backend",
        payload: { 
          error: result.error, 
          permanent: result.permanent, 
          retry_count: retryCount,
          channel,
        },
      });

      return finalStatus;
    }
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ── RETRY action: process scheduled retries ──
    if (action === "process_retries") {
      // This can be called by cron or manually by authorized users
      const authUser = await getAuthUser(req, supabaseUrl, anonKey);
      if (!authUser) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: retriable } = await supabase
        .from("invite_deliveries")
        .select("id, invite_id, delivery_channel, recipient_email, recipient_phone, rendered_subject, rendered_message")
        .eq("send_status", "retry_scheduled")
        .lte("next_retry_at", new Date().toISOString())
        .limit(10);

      if (!retriable || retriable.length === 0) {
        return new Response(
          JSON.stringify({ processed: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: { id: string; status: string }[] = [];
      for (const d of retriable) {
        // Check invite is still pending
        const { data: invite } = await supabase
          .from("access_invites").select("status").eq("id", d.invite_id).single();
        if (invite?.status !== "pending") {
          await supabase.from("invite_deliveries")
            .update({ send_status: "cancelled", failure_reason: "Invite no longer pending" })
            .eq("id", d.id);
          results.push({ id: d.id, status: "cancelled" });
          continue;
        }

        await supabase.from("invite_events").insert({
          invite_id: d.invite_id, delivery_id: d.id,
          event_type: "retry_started", event_source: "backend",
          payload: { channel: d.delivery_channel },
        });

        const status = await processDelivery(
          supabase, d.id, d.delivery_channel,
          d.recipient_email, d.recipient_phone,
          d.rendered_subject, d.rendered_message,
          d.invite_id, resendApiKey
        );
        results.push({ id: d.id, status });
      }

      console.log(`[send-invite] Processed ${results.length} retries`);
      return new Response(
        JSON.stringify({ processed: results.length, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MANUAL RETRY action ──
    if (action === "manual_retry") {
      const authUser = await getAuthUser(req, supabaseUrl, anonKey);
      if (!authUser) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { delivery_id } = body;
      if (!delivery_id) {
        return new Response(
          JSON.stringify({ error: "Missing delivery_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: delivery } = await supabase
        .from("invite_deliveries")
        .select("*, access_invites!inner(status, team_id, created_by)")
        .eq("id", delivery_id)
        .single();

      if (!delivery) {
        return new Response(
          JSON.stringify({ error: "Delivery not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Only allow retry on failed/exhausted/retry_scheduled
      if (!["failed", "exhausted", "retry_scheduled"].includes(delivery.send_status)) {
        return new Response(
          JSON.stringify({ error: "Delivery is not in a retryable state" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check invite is still pending
      if (delivery.access_invites.status !== "pending") {
        return new Response(
          JSON.stringify({ error: "Invite is no longer pending" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Permission: must be invite creator or have manage permission on team
      const teamId = delivery.access_invites.team_id;
      if (delivery.access_invites.created_by !== authUser.id) {
        const { data: team } = await supabase
          .from("teams").select("owner_id, club_id").eq("id", teamId).maybeSingle();
        let hasPermission = team?.owner_id === authUser.id;
        if (!hasPermission && team?.club_id) {
          const { data: club } = await supabase
            .from("clubs").select("owner_id").eq("id", team.club_id).maybeSingle();
          hasPermission = club?.owner_id === authUser.id;
          if (!hasPermission) {
            const { data: staff } = await supabase
              .from("club_staff").select("id")
              .eq("club_id", team.club_id).eq("user_id", authUser.id).eq("is_active", true).maybeSingle();
            hasPermission = !!staff;
          }
        }
        if (!hasPermission) {
          return new Response(
            JSON.stringify({ error: "Permission denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Reset retry count for manual retry and process
      await supabase.from("invite_deliveries")
        .update({ retry_count: 0, max_retries: 3, send_status: "queued" })
        .eq("id", delivery_id);

      await supabase.from("invite_events").insert({
        invite_id: delivery.invite_id, delivery_id,
        event_type: "retry_started", event_source: "user_action",
        actor_user_id: authUser.id,
        payload: { manual: true, channel: delivery.delivery_channel },
      });

      const status = await processDelivery(
        supabase, delivery_id, delivery.delivery_channel,
        delivery.recipient_email, delivery.recipient_phone,
        delivery.rendered_subject, delivery.rendered_message,
        delivery.invite_id, resendApiKey
      );

      return new Response(
        JSON.stringify({ success: true, status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Standard send flow ──
    const { invite_id, channels, context, email, phone } = body;

    if (!invite_id || !channels || !Array.isArray(channels) || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing invite_id or channels" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUser = await getAuthUser(req, supabaseUrl, anonKey);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invite
    const { data: invite } = await supabase
      .from("access_invites")
      .select("*, teams(name, category), players(name), clubs(name)")
      .eq("id", invite_id)
      .maybeSingle();

    if (!invite) {
      return new Response(
        JSON.stringify({ error: "Invite not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block send if invite not pending
    if (invite.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Cannot send: invite status is '${invite.status}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify permission
    if (invite.created_by !== authUser.id) {
      const { data: team } = await supabase
        .from("teams").select("owner_id, club_id").eq("id", invite.team_id).maybeSingle();
      const isOwner = team?.owner_id === authUser.id;
      let isClubAuth = false;
      if (team?.club_id) {
        const { data: club } = await supabase
          .from("clubs").select("owner_id").eq("id", team.club_id).maybeSingle();
        isClubAuth = club?.owner_id === authUser.id;
        if (!isClubAuth) {
          const { data: staff } = await supabase
            .from("club_staff").select("id")
            .eq("club_id", team.club_id).eq("user_id", authUser.id).eq("is_active", true).maybeSingle();
          isClubAuth = !!staff;
        }
      }
      if (!isOwner && !isClubAuth) {
        const { data: coach } = await supabase
          .from("team_coaches").select("id")
          .eq("team_id", invite.team_id).eq("coach_id", authUser.id).maybeSingle();
        if (!coach) {
          return new Response(
            JSON.stringify({ error: "Permission denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from("profiles").select("full_name, display_name").eq("id", authUser.id).maybeSingle();

    // Build full template context
    const inviteToken = context?.invite_token || "";
    const baseUrl = context?.base_url || "https://taticalsoccer.lovable.app";
    const inviteLink = inviteToken
      ? `${baseUrl}/accept-invite?token=${inviteToken}`
      : (context?.invite_link || "");

    const templateCtx: Record<string, string> = {
      recipient_name: invite.recipient_name || "",
      app_name: "TaticalSoccer",
      club_name: invite.clubs?.name || context?.club_name || "",
      team_name: invite.teams?.name || "",
      age_group: invite.teams?.category || context?.age_group || "",
      player_name: invite.players?.name || context?.player_name || "",
      inviter_name: inviterProfile?.display_name || inviterProfile?.full_name || "Equipa Técnica",
      inviter_role: context?.inviter_role || "",
      invite_link: inviteLink,
      invite_code: invite.invite_code || "",
      support_email: context?.support_email || "",
      expires_at: invite.expires_at
        ? new Date(invite.expires_at).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })
        : "",
      channel_name: context?.channel_name || "",
      profile_label: {
        guardian: "Encarregado de Educação",
        player: "Atleta",
        coach: "Treinador",
        assistant_coach: "Treinador Adjunto",
        staff: "Staff",
      }[invite.invite_type] || invite.invite_type,
      context_label: invite.scope_type === "club" ? "Clube" : "Equipa",
      ...(context || {}),
    };

    if (context?.invite_link) templateCtx.invite_link = context.invite_link;

    const deliveryResults: { id: string; channel: string; status: string }[] = [];

    for (const channel of channels) {
      // Fetch template
      const { data: templates } = await supabase
        .from("invite_templates")
        .select("*")
        .eq("profile_type", invite.invite_type)
        .eq("delivery_channel", channel)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1);

      const template = templates?.[0];
      if (!template) {
        console.warn(`[send-invite] No template for ${invite.invite_type}/${channel}`);
        // Create a failed delivery record
        const { data: delivery } = await supabase
          .from("invite_deliveries")
          .insert({
            invite_id,
            delivery_channel: channel,
            rendered_message: "",
            send_status: "failed",
            failure_reason: `No active template for ${invite.invite_type}/${channel}`,
            sent_by_user_id: authUser.id,
          })
          .select("id").single();
        if (delivery) {
          await supabase.from("invite_events").insert({
            invite_id, delivery_id: delivery.id,
            event_type: "failed", event_source: "backend",
            payload: { reason: "invalid_template", channel },
          });
          deliveryResults.push({ id: delivery.id, channel, status: "failed" });
        }
        continue;
      }

      // Render
      const subjectResult = template.subject_template
        ? renderTemplate(template.subject_template, templateCtx)
        : null;
      const bodyResult = renderTemplate(template.body_template, templateCtx);

      // Block send if required variables missing
      if (bodyResult.missingRequired.length > 0) {
        console.error(`[send-invite] Missing required vars for ${channel}:`, bodyResult.missingRequired);
        const { data: delivery } = await supabase
          .from("invite_deliveries")
          .insert({
            invite_id,
            delivery_channel: channel,
            template_key: template.template_key,
            template_id: template.id,
            rendered_subject: subjectResult?.renderedText || null,
            rendered_message: bodyResult.renderedText,
            recipient_email: channel === "email" ? (email || invite.email) : null,
            recipient_phone: channel !== "email" ? (phone || invite.phone) : null,
            send_status: "failed",
            failure_reason: `Missing required variables: ${bodyResult.missingRequired.join(", ")}`,
            sent_by_user_id: authUser.id,
            metadata: { template_id: template.id, missing_vars: bodyResult.missingRequired },
          })
          .select("id").single();

        if (delivery) {
          await supabase.from("invite_events").insert({
            invite_id, delivery_id: delivery.id,
            event_type: "failed", event_source: "backend",
            payload: { reason: "missing_required_variables", vars: bodyResult.missingRequired },
          });
          deliveryResults.push({ id: delivery.id, channel, status: "failed" });
        }
        continue;
      }

      const renderedSubject = subjectResult?.renderedText || null;
      const renderedMessage = bodyResult.renderedText;
      const recipientEmail = email || invite.email;
      const recipientPhone = phone || invite.phone;

      // Insert delivery record as queued
      const { data: delivery, error: delError } = await supabase
        .from("invite_deliveries")
        .insert({
          invite_id,
          delivery_channel: channel,
          template_key: template.template_key,
          template_id: template.id,
          rendered_subject: renderedSubject,
          rendered_message: renderedMessage,
          recipient_email: channel === "email" ? recipientEmail : null,
          recipient_phone: channel !== "email" ? recipientPhone : null,
          send_status: "queued",
          sent_by_user_id: authUser.id,
          metadata: { template_id: template.id },
        })
        .select("id").single();

      if (delError) {
        console.error(`[send-invite] Delivery insert error:`, delError.message);
        continue;
      }

      // Record event
      await supabase.from("invite_events").insert({
        invite_id, delivery_id: delivery.id,
        event_type: "send_requested", event_source: "user_action",
        actor_user_id: authUser.id,
        payload: { channel, template_key: template.template_key },
      });

      // Process delivery (send)
      const status = await processDelivery(
        supabase, delivery.id, channel,
        channel === "email" ? recipientEmail : null,
        channel !== "email" ? recipientPhone : null,
        renderedSubject, renderedMessage,
        invite_id, resendApiKey
      );

      // Update access_invites sent_at if first successful send
      if (status === "sent" && !invite.sent_at) {
        await supabase.from("access_invites")
          .update({ sent_at: new Date().toISOString(), delivery_channels: channels })
          .eq("id", invite_id);
      }

      deliveryResults.push({ id: delivery.id, channel, status });
    }

    // Summary event
    await supabase.from("invite_events").insert({
      invite_id, event_type: "send_completed", event_source: "system",
      actor_user_id: authUser.id,
      payload: { 
        channels, 
        delivery_count: deliveryResults.length,
        results: deliveryResults.map(r => ({ channel: r.channel, status: r.status })),
      },
    });

    console.log(`[send-invite] Processed ${deliveryResults.length} deliveries for invite ${invite_id}`);

    return new Response(
      JSON.stringify({ success: true, deliveries: deliveryResults }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-invite] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
