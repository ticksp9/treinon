import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (const b of arr) code += chars[b % chars.length];
  return code;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

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

/**
 * Derive context server-side from team_id and authenticated user.
 * Returns { scope_type, club_id, owner_coach_id } or null if unauthorized.
 */
async function deriveInviteContext(
  supabase: any,
  userId: string,
  teamId: string
): Promise<{ canManage: boolean; scope_type: string; club_id: string | null; owner_coach_id: string | null; level: InviterLevel }> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, owner_id, club_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) return { canManage: false, scope_type: "coach", club_id: null, owner_coach_id: null, level: "none" };

  // Determine scope from team
  const club_id = team.club_id || null;
  const scope_type = club_id ? "club" : "coach";
  let owner_coach_id: string | null = null;
  let canManage = false;
  let level: InviterLevel = "none";

  if (club_id) {
    // Club mode — check club ownership, staff, coordinator, or team coach
    const { data: club } = await supabase
      .from("clubs").select("owner_id").eq("id", club_id).maybeSingle();
    if (club?.owner_id === userId) { canManage = true; level = "admin"; }

    if (!canManage) {
      const { data: staff } = await supabase
        .from("club_staff").select("id, role, coord_team_ids")
        .eq("club_id", club_id).eq("user_id", userId).eq("is_active", true)
        .maybeSingle();
      if (staff) {
        canManage = true;
        // a coordinator with an area only coordinates the teams of that area
        const scope: string[] | null = staff.coord_team_ids;
        const inArea = !scope || scope.length === 0 || scope.includes(teamId);
        level = staff.role === "admin" ? "admin" : staff.role === "coordenador" && inArea ? "coordinator" : "staff";
      }
    }

    if (!canManage) {
      // a coach only counts while still an active coach of the club
      const { data: member } = await supabase
        .from("club_coaches").select("id")
        .eq("club_id", club_id).eq("coach_id", userId).eq("is_active", true).maybeSingle();
      const { data: coach } = member
        ? await supabase.from("team_coaches").select("id, role, permissions").eq("team_id", teamId).eq("coach_id", userId).maybeSingle()
        : { data: null };
      // permission "invites" (head coach: yes by default; assistant: no by default)
      const canInvite = coach ? (coach.permissions?.invites ?? coach.role !== "assistant_coach") : false;
      if (coach && canInvite) {
        canManage = true;
        level = coach.role === "assistant_coach" ? "assistant" : "head_coach";
      }
    }
  } else {
    // Individual coach mode — only team owner can manage
    if (team.owner_id === userId) {
      canManage = true;
      owner_coach_id = userId;
      level = "head_coach";
    }
  }

  return { canManage, scope_type, club_id, owner_coach_id, level };
}

// ─── Email (Brevo free tier: 300/day, sender = a verified Gmail address; or Resend with own domain) ───
function emailConfigured(): boolean {
  return !!(Deno.env.get("BREVO_API_KEY") || Deno.env.get("RESEND_API_KEY"));
}

function parseFrom(): { name: string; email: string } {
  const raw = Deno.env.get("EMAIL_FROM") ?? "TreinON <treinon.apoio@gmail.com>";
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || "TreinON", email: m[2] } : { name: "TreinON", email: raw.trim() };
}

const INVITE_LABELS: Record<string, string> = {
  coach: "treinador principal", assistant_coach: "treinador adjunto", staff: "staff do clube", coordinator: "coordenador",
  guardian: "encarregado de educação", player: "atleta",
};

function inviteEmail(p: { name: string; type: string; team: string; club: string; link: string; code: string; from: string }) {
  const role = INVITE_LABELS[p.type] ?? "membro";
  const subject = `Convite TreinON: ${role}${p.team ? ` · ${p.team}` : ""}`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const text = [
    `Olá ${p.name}!`,
    "",
    `${p.from || "O seu clube"} convidou-o para ${role}${p.team ? ` da equipa ${p.team}` : ""}${p.club ? ` (${p.club})` : ""} no TreinON.`,
    "",
    `Abra este link para criar a conta (ou entrar, se já tem) e ficar ligado à equipa:`,
    p.link,
    "",
    `Se o link não abrir, use o código ${p.code} em ${new URL(p.link).origin}/accept-invite`,
    "O convite é válido durante 7 dias.",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#1b2230">
    <h2 style="color:#24558f">Convite TreinON</h2>
    <p>Olá ${esc(p.name)}!</p>
    <p>${esc(p.from || "O seu clube")} convidou-o para <b>${esc(role)}</b>${p.team ? ` da equipa <b>${esc(p.team)}</b>` : ""}${p.club ? ` (${esc(p.club)})` : ""}.</p>
    <p style="margin:28px 0"><a href="${esc(p.link)}" style="background:#24558f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Aceitar convite</a></p>
    <p style="font-size:13px;color:#555">Se o botão não abrir, use o código <b style="font-size:16px;letter-spacing:2px">${esc(p.code)}</b> em ${esc(new URL(p.link).origin)}/accept-invite<br/>O convite é válido durante 7 dias.</p>
  </div>`;
  return { subject, text, html };
}

async function sendInviteEmail(to: string, toName: string, mail: { subject: string; text: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  const from = parseFrom();
  try {
    const brevo = Deno.env.get("BREVO_API_KEY");
    if (brevo) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevo, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sender: from, to: [{ email: to, name: toName }], subject: mail.subject, htmlContent: mail.html, textContent: mail.text }),
      });
      if (r.ok) return { ok: true };
      return { ok: false, error: `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}` };
    }
    const resend = Deno.env.get("RESEND_API_KEY");
    if (resend) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${from.name} <${from.email}>`, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
      });
      if (r.ok) return { ok: true };
      return { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
    }
    return { ok: false, error: "Email não configurado" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Send the invite email right after creating/renewing it (the token only exists now). */
async function emailInvite(supabase: any, req: Request, invite: { id: string; email: string | null; recipient_name: string; invite_type: string; team_id: string; club_id: string | null }, token: string, code: string, inviterId: string) {
  if (!invite.email) return { email_sent: false, email_error: "Sem email" };
  if (!emailConfigured()) return { email_sent: false, email_error: "Email não configurado" };
  const appUrl = (Deno.env.get("APP_URL") || req.headers.get("origin") || "https://treinon.vercel.app").replace(/\/$/, "");
  const [{ data: team }, { data: club }, { data: inviter }] = await Promise.all([
    supabase.from("teams").select("name").eq("id", invite.team_id).maybeSingle(),
    invite.club_id ? supabase.from("clubs").select("name").eq("id", invite.club_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("display_name, full_name").eq("id", inviterId).maybeSingle(),
  ]);
  const mail = inviteEmail({
    name: invite.recipient_name, type: invite.invite_type, team: team?.name ?? "", club: club?.name ?? "",
    link: `${appUrl}/accept-invite?token=${token}`, code, from: inviter?.display_name || inviter?.full_name || "",
  });
  const r = await sendInviteEmail(invite.email, invite.recipient_name, mail);
  if (!r.ok) console.error("[manage-invites] email failed:", r.error);
  return { email_sent: r.ok, email_error: r.ok ? undefined : r.error };
}

type InviterLevel = "admin" | "coordinator" | "staff" | "head_coach" | "assistant" | "none";

/** Who may invite whom: nobody can hand out more access than they have. */
const ALLOWED_TYPES: Record<InviterLevel, string[]> = {
  admin: ["coach", "assistant_coach", "staff", "coordinator", "guardian", "player"],
  coordinator: ["coach", "assistant_coach", "guardian", "player"],
  head_coach: ["assistant_coach", "guardian", "player"],
  staff: ["guardian", "player"],
  assistant: ["guardian", "player"],
  none: [],
};

function resolveInviteProfile(inviteType: string): { accountType: string; redirect: string } {
  switch (inviteType) {
    case "guardian": return { accountType: "guardian", redirect: "/guardian" };
    case "player": return { accountType: "player", redirect: "/player" };
    case "coach":
    case "assistant_coach":
    case "coordinator":
    case "staff":
      return { accountType: "individual_coach", redirect: "/dashboard" };
    default:
      return { accountType: "individual_coach", redirect: "/dashboard" };
  }
}

/**
 * Minimal, explicit auto-membership after invite acceptance.
 * Only joins channels that:
 * 1. Are active
 * 2. Belong to the same team
 * 3. Have the correct allow_* flag for the invite type
 * 4. Are NOT private/restricted_internal
 * 5. Are official, team, or role_based (matching target_role)
 */
async function autoJoinChannels(
  supabase: any,
  userId: string,
  teamId: string,
  inviteType: string,
  inviteId: string
) {
  const { data: channels } = await supabase
    .from("communication_channels")
    .select("id, channel_type, target_role, visibility_scope, allow_guardians, allow_players, allow_coaches, allow_staff, allow_coordinators")
    .eq("team_id", teamId)
    .eq("is_active", true);

  if (!channels) return;

  const BLOCKED_SCOPES = new Set(["private", "restricted", "restricted_internal"]);

  for (const ch of channels) {
    // Never auto-join private/restricted channels
    if (BLOCKED_SCOPES.has(ch.visibility_scope)) continue;

    let eligible = false;

    // Check allow_* flag for the invite type
    if (inviteType === "guardian" && ch.allow_guardians) eligible = true;
    if (inviteType === "player" && ch.allow_players) eligible = true;
    if ((inviteType === "coach" || inviteType === "assistant_coach") && ch.allow_coaches) eligible = true;
    if (inviteType === "staff" && ch.allow_staff) eligible = true;

    // For role_based channels, also require target_role match
    if (ch.channel_type === "role_based") {
      eligible = false; // reset — must match target_role exactly
      if (ch.target_role === inviteType) eligible = true;
      if (ch.target_role === "coach" && inviteType === "assistant_coach") eligible = true;
      // Plus the allow_* flag must also be true
      if (inviteType === "guardian" && !ch.allow_guardians) eligible = false;
      if (inviteType === "player" && !ch.allow_players) eligible = false;
      if ((inviteType === "coach" || inviteType === "assistant_coach") && !ch.allow_coaches) eligible = false;
      if (inviteType === "staff" && !ch.allow_staff) eligible = false;
    }

    // Only auto-join official, team, age_group, or role_based channels
    const ALLOWED_TYPES = new Set(["official", "team", "age_group", "role_based"]);
    if (!ALLOWED_TYPES.has(ch.channel_type)) eligible = false;

    if (eligible) {
      await supabase
        .from("communication_channel_members")
        .upsert(
          {
            channel_id: ch.id,
            user_id: userId,
            role: "member",
          },
          { onConflict: "channel_id,user_id" }
        )
        .select();
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // Is email delivery set up? (the UI then offers "send by email" instead of only WhatsApp)
    if (action === "email_status") {
      return new Response(JSON.stringify({ configured: emailConfigured() }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ════════════════════════════════════════════════════════════════
    // CREATE INVITE — server derives all context
    // ════════════════════════════════════════════════════════════════
    if (action === "create_invite") {
      const authUser = await getAuthUser(req, supabaseUrl, anonKey);
      if (!authUser) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Only accept minimal fields from client
      const { team_id, player_id, invite_type, recipient_name, email, phone } = body;
      // SECURITY: Ignore created_by, user_id, scope_type, club_id, owner_coach_id from client

      if (!team_id || !invite_type || !recipient_name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: team_id, invite_type, recipient_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validTypes = ["guardian", "player", "coach", "assistant_coach", "staff", "coordinator"];
      if (!validTypes.includes(invite_type)) {
        return new Response(
          JSON.stringify({ error: "Invalid invite_type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Derive context server-side — never trust client
      const ctx = await deriveInviteContext(supabase, authUser.id, team_id);
      if (ctx.canManage && !ALLOWED_TYPES[ctx.level].includes(invite_type)) {
        return new Response(
          JSON.stringify({ error: "Não tem permissão para este tipo de convite" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!ctx.canManage) {
        console.error(`[manage-invites] DENIED create_invite by ${authUser.id} for team ${team_id}`);
        return new Response(
          JSON.stringify({ error: "You don't have permission to create invites for this team" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate coherence: guardian requires player_id
      if (invite_type === "guardian" && !player_id) {
        return new Response(
          JSON.stringify({ error: "Guardian invites require a player_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate coherence: player requires player_id
      if (invite_type === "player" && !player_id) {
        return new Response(
          JSON.stringify({ error: "Player invites require a player_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate player belongs to the team
      if (player_id) {
        const { data: player } = await supabase
          .from("players")
          .select("id, team_id")
          .eq("id", player_id)
          .eq("team_id", team_id)
          .maybeSingle();
        if (!player) {
          return new Response(
            JSON.stringify({ error: "Player does not belong to this team" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const token = generateToken();
      const code = generateCode();
      const tokenHash = await hashToken(token);

      const { data: invite, error } = await supabase
        .from("access_invites")
        .insert({
          scope_type: ctx.scope_type,        // DERIVED server-side
          club_id: ctx.club_id,              // DERIVED server-side
          owner_coach_id: ctx.owner_coach_id, // DERIVED server-side
          team_id,
          player_id: player_id || null,
          invite_type,
          recipient_name,
          email: email?.toLowerCase() || null,
          phone: phone || null,
          invite_token_hash: tokenHash,
          invite_code: code,
          created_by: authUser.id,            // DERIVED from auth
          sent_at: email ? new Date().toISOString() : null,
        })
        .select("id, invite_code, status, expires_at, email, recipient_name, invite_type, team_id, club_id")
        .single();

      if (error) {
        console.error("[manage-invites] create_invite error:", error.message);
        return new Response(
          JSON.stringify({ error: "Failed to create invite" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-invites] Invite ${invite.id} created: type=${invite_type} by=${authUser.id} team=${team_id} scope=${ctx.scope_type}`);

      return new Response(
        JSON.stringify({
          invite_id: invite.id, token, code,
          status: invite.status, expires_at: invite.expires_at,
          ...(body.send_email === false ? {} : await emailInvite(supabase, req, invite, token, code, authUser.id)),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // VALIDATE INVITE — minimal info exposure
    // ════════════════════════════════════════════════════════════════
    if (action === "validate_invite") {
      const { token, code } = body;
      let invite;
      if (token) {
        const tokenHash = await hashToken(token);
        const { data } = await supabase
          .from("access_invites")
          .select("*, teams(id, name), players(id, name)")
          .eq("invite_token_hash", tokenHash)
          .maybeSingle();
        invite = data;
      } else if (code) {
        const { data } = await supabase
          .from("access_invites")
          .select("*, teams(id, name), players(id, name)")
          .eq("invite_code", code.toUpperCase())
          .maybeSingle();
        invite = data;
      }

      if (!invite) {
        return new Response(
          JSON.stringify({ valid: false, error: "Convite não encontrado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Transition to expired if past expiry
      if (invite.status === "pending" && new Date(invite.expires_at) < new Date()) {
        await supabase.from("access_invites").update({ status: "expired" }).eq("id", invite.id);
        invite.status = "expired";
      }

      if (invite.status !== "pending") {
        const msg = invite.status === "accepted"
          ? "Este convite já foi utilizado"
          : invite.status === "revoked"
          ? "Este convite foi revogado"
          : "Este convite expirou";
        return new Response(
          JSON.stringify({ valid: false, error: msg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Minimal context for preview — no internal IDs leaked
      let contextName = "";
      if (invite.club_id) {
        const { data: club } = await supabase.from("clubs").select("name").eq("id", invite.club_id).maybeSingle();
        contextName = club?.name || "";
      } else if (invite.owner_coach_id) {
        const { data: profile } = await supabase.from("profiles").select("display_name, full_name").eq("id", invite.owner_coach_id).maybeSingle();
        contextName = profile?.display_name || profile?.full_name || "Treinador";
      }

      return new Response(
        JSON.stringify({
          valid: true,
          invite_id: invite.id,
          invite_type: invite.invite_type,
          recipient_name: invite.recipient_name,
          team_name: invite.teams?.name || "",
          player_name: invite.players?.name || "",
          context_name: contextName,
          scope_type: invite.scope_type,
          email: invite.email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // ACCEPT INVITE — fully server-authoritative, idempotent
    // ════════════════════════════════════════════════════════════════
    if (action === "accept_invite") {
      const authUser = await getAuthUser(req, supabaseUrl, anonKey);
      if (!authUser) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { invite_id } = body;
      // SECURITY: user_id comes from auth, never from client
      const userId = authUser.id;
      const userEmail = authUser.email?.toLowerCase();

      if (!invite_id) {
        return new Response(
          JSON.stringify({ error: "Missing invite_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch invite (any status — we handle idempotency)
      const { data: invite } = await supabase
        .from("access_invites")
        .select("*")
        .eq("id", invite_id)
        .maybeSingle();

      if (!invite) {
        return new Response(
          JSON.stringify({ error: "Convite não encontrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // IDEMPOTENCY: already accepted by same user — return success
      if (invite.status === "accepted" && invite.accepted_by_user_id === userId) {
        const { redirect } = resolveInviteProfile(invite.invite_type);
        return new Response(
          JSON.stringify({ success: true, account_type: resolveInviteProfile(invite.invite_type).accountType, redirect }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Already accepted by DIFFERENT user — hard error
      if (invite.status === "accepted" && invite.accepted_by_user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Este convite já foi aceite por outro utilizador" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Not pending — reject
      if (invite.status !== "pending") {
        const msg = invite.status === "revoked" ? "Este convite foi revogado" : "Este convite expirou";
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Expiry check
      if (new Date(invite.expires_at) < new Date()) {
        await supabase.from("access_invites").update({ status: "expired" }).eq("id", invite.id);
        return new Response(
          JSON.stringify({ error: "Convite expirado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Email binding — if invite has email, authenticated user must match
      if (invite.email && userEmail && invite.email.toLowerCase() !== userEmail) {
        console.error(`[manage-invites] Email mismatch: invite=${invite.email} user=${userEmail}`);
        return new Response(
          JSON.stringify({ error: "O email da sua conta não corresponde ao do convite. Use o email correto." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const inviteType = invite.invite_type;
      const { accountType, redirect } = resolveInviteProfile(inviteType);

      // Update profile account_type — never turn a club account (or a coach) into something smaller
      const { data: currentProfile } = await supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle();
      const current = currentProfile?.account_type ?? null;
      const isStaffInvite = ["coach", "assistant_coach", "staff", "coordinator"].includes(inviteType);
      // every new account starts as "individual_coach": a parent/player invite only keeps
      // coach access when the person really coaches (owns or coaches a team, or is in a club)
      let coachesAlready = false;
      if (!isStaffInvite && current === "individual_coach") {
        const [owned, coached, member] = await Promise.all([
          supabase.from("teams").select("id", { count: "exact", head: true }).eq("owner_id", userId),
          supabase.from("team_coaches").select("id", { count: "exact", head: true }).eq("coach_id", userId),
          supabase.from("club_coaches").select("id", { count: "exact", head: true }).eq("coach_id", userId).eq("is_active", true),
        ]);
        coachesAlready = (owned.count ?? 0) + (coached.count ?? 0) + (member.count ?? 0) > 0;
      }
      const shouldSet = current !== "club" && !(isStaffInvite && current === "individual_coach") && !coachesAlready;
      if (shouldSet) {
        await supabase.from("profiles").update({ account_type: accountType }).eq("id", userId);
      }

      // ── GUARDIAN ──
      if (inviteType === "guardian") {
        let guardianId: string;
        const { data: existingGP } = await supabase
          .from("guardian_profiles").select("id").eq("user_id", userId).maybeSingle();

        if (existingGP) {
          guardianId = existingGP.id;
        } else {
          const { data: profile } = await supabase
            .from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
          const { data: newGP, error: gpError } = await supabase
            .from("guardian_profiles")
            .insert({
              user_id: userId,
              full_name: invite.recipient_name || profile?.full_name || "Encarregado",
              email: invite.email || profile?.email || null,
              phone: invite.phone || null,
            })
            .select("id").single();
          if (gpError) {
            console.error("[manage-invites] guardian_profile error:", gpError.message);
            return new Response(
              JSON.stringify({ error: "Erro ao criar perfil de encarregado" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          guardianId = newGP.id;
        }

        if (invite.player_id) {
          const { data: existingLink } = await supabase
            .from("player_guardians").select("id")
            .eq("guardian_id", guardianId).eq("player_id", invite.player_id).maybeSingle();
          if (!existingLink) {
            await supabase.from("player_guardians").insert({
              guardian_id: guardianId,
              player_id: invite.player_id,
              relationship: "parent",
              is_primary: true,
            });
          }
        }
      }

      // ── PLAYER ──
      if (inviteType === "player" && invite.player_id) {
        const { data: existingPA } = await supabase
          .from("player_accounts").select("id").eq("user_id", userId).maybeSingle();
        if (!existingPA) {
          await supabase.from("player_accounts").insert({
            user_id: userId, player_id: invite.player_id,
          });
        }
      }

      // ── COACH / ASSISTANT_COACH ──
      if (inviteType === "coach" || inviteType === "assistant_coach") {
        if (invite.club_id) {
          const { data: existingCC } = await supabase
            .from("club_coaches").select("id")
            .eq("coach_id", userId).eq("club_id", invite.club_id).maybeSingle();
          if (!existingCC) {
            const { error: ccError } = await supabase.from("club_coaches").insert({
              club_id: invite.club_id, coach_id: userId, is_active: true,
            });
            if (ccError) {
              console.error("[manage-invites] club_coaches error:", ccError.message);
              return new Response(
                JSON.stringify({ error: "Não foi possível juntar ao clube" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            // re-invited after leaving: reactivate
            await supabase.from("club_coaches").update({ is_active: true }).eq("id", existingCC.id);
          }
        }
        const { data: existingTC } = await supabase
          .from("team_coaches").select("id")
          .eq("coach_id", userId).eq("team_id", invite.team_id).maybeSingle();
        if (!existingTC) {
          const { error: tcError } = await supabase.from("team_coaches").insert({
            coach_id: userId, team_id: invite.team_id,
            role: inviteType === "assistant_coach" ? "assistant_coach" : "head_coach",
          });
          if (tcError) {
            console.error("[manage-invites] team_coaches error:", tcError.message);
            return new Response(
              JSON.stringify({ error: "Não foi possível associar à equipa" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      // ── STAFF ──
      if ((inviteType === "staff" || inviteType === "coordinator") && invite.club_id) {
        const { data: existingStaff } = await supabase
          .from("club_staff").select("id")
          .eq("user_id", userId).eq("club_id", invite.club_id).maybeSingle();
        if (!existingStaff) {
          const { data: profile } = await supabase
            .from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
          await supabase.from("club_staff").insert({
            club_id: invite.club_id,
            user_id: userId,
            name: invite.recipient_name || profile?.full_name || "Staff",
            role: inviteType === "coordinator" ? "coordenador" : "staff",
            email: invite.email || profile?.email || null,
          });
        } else if (inviteType === "coordinator") {
          // already staff of the club: becomes coordinator (never demotes an admin)
          await supabase.from("club_staff").update({ role: "coordenador", is_active: true })
            .eq("id", existingStaff.id).neq("role", "admin");
        }
      }

      // ── MINIMAL AUTO-JOIN CHANNELS ──
      await autoJoinChannels(supabase, userId, invite.team_id, inviteType, invite.id);

      const acceptedAt = new Date().toISOString();

      // Mark invite as accepted
      await supabase
        .from("access_invites")
        .update({
          status: "accepted",
          accepted_at: acceptedAt,
          accepted_by_user_id: userId,
        })
        .eq("id", invite.id)
        .eq("status", "pending"); // optimistic concurrency — only update if still pending

      // ── SYNC DELIVERY TRACKING ──
      // Update all deliveries for this invite with accepted_at
      await supabase
        .from("invite_deliveries")
        .update({ accepted_at: acceptedAt, send_status: "accepted" })
        .eq("invite_id", invite.id)
        .in("send_status", ["sent", "delivered", "opened", "clicked"]);

      // Record acceptance event
      await supabase.from("invite_events").insert({
        invite_id: invite.id,
        event_type: "accepted",
        event_source: "user_action",
        actor_user_id: userId,
        payload: { invite_type: inviteType, account_type: accountType },
      });

      console.log(`[manage-invites] Invite ${invite.id} accepted by ${userId} (type: ${inviteType})`);

      return new Response(
        JSON.stringify({ success: true, account_type: accountType, redirect }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // RESEND INVITE — re-validate authorization
    // ════════════════════════════════════════════════════════════════
    if (action === "resend_invite") {
      const authUser = await getAuthUser(req, supabaseUrl, anonKey);
      if (!authUser) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { invite_id } = body;
      const { data: existingInvite } = await supabase
        .from("access_invites")
        .select("id, team_id, created_by, status, email, recipient_name, invite_type, club_id")
        .eq("id", invite_id)
        .maybeSingle();

      if (!existingInvite) {
        return new Response(
          JSON.stringify({ error: "Invite not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Re-derive authorization
      const ctx = await deriveInviteContext(supabase, authUser.id, existingInvite.team_id);
      if (!ctx.canManage && existingInvite.created_by !== authUser.id) {
        return new Response(
          JSON.stringify({ error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingInvite && !['pending', 'expired'].includes(existingInvite.status)) {
        return new Response(
          JSON.stringify({ error: existingInvite.status === 'accepted' ? 'Este convite já foi aceite' : 'Este convite foi cancelado; crie um novo' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const code = generateCode();
      const token = generateToken();
      const tokenHash = await hashToken(token);

      const { error } = await supabase
        .from("access_invites")
        .update({
          invite_code: code,
          invite_token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
          sent_at: new Date().toISOString(),
        })
        .eq("id", invite_id);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to resend invite" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-invites] Invite ${invite_id} resent by ${authUser.id}`);

      return new Response(
        JSON.stringify({ success: true, token, code, ...(await emailInvite(supabase, req, existingInvite, token, code, authUser.id)) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // REVOKE INVITE
    // ════════════════════════════════════════════════════════════════
    if (action === "revoke_invite") {
      const authUser = await getAuthUser(req, supabaseUrl, anonKey);
      if (!authUser) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { invite_id } = body;
      const { data: existingInvite } = await supabase
        .from("access_invites")
        .select("id, team_id, created_by, status")
        .eq("id", invite_id)
        .maybeSingle();

      if (!existingInvite || existingInvite.status !== "pending") {
        return new Response(
          JSON.stringify({ error: "Invite not found or already processed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Re-derive authorization
      const ctx = await deriveInviteContext(supabase, authUser.id, existingInvite.team_id);
      if (!ctx.canManage && existingInvite.created_by !== authUser.id) {
        return new Response(
          JSON.stringify({ error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("access_invites")
        .update({ status: "revoked" })
        .eq("id", invite_id);

      console.log(`[manage-invites] Invite ${invite_id} revoked by ${authUser.id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("manage-invites error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
