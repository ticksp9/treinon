// Emails an announcement or a match call-up to the people it is meant for.
// The app alone reaches nobody who does not open it; parents read email.
//   { kind: "announcement", announcement_id }
//   { kind: "callup", match_id, player_ids: string[], message?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Brevo's free plan sends 300 emails a day: never let one notice use it all. */
const MAX_RECIPIENTS = 150;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function parseFrom(): { name: string; email: string } {
  const raw = Deno.env.get("EMAIL_FROM") ?? "TreinON <treinon.apoio@gmail.com>";
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || "TreinON", email: m[2] } : { name: "TreinON", email: raw.trim() };
}

async function sendEmail(to: string, mail: { subject: string; text: string; html: string }, fromName: string): Promise<{ ok: boolean; error?: string }> {
  const from = parseFrom();
  const sender = { name: fromName ? `${fromName} (TreinON)` : from.name, email: from.email };
  try {
    const brevo = Deno.env.get("BREVO_API_KEY");
    if (brevo) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevo, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sender, to: [{ email: to }], subject: mail.subject, htmlContent: mail.html, textContent: mail.text }),
      });
      return r.ok ? { ok: true } : { ok: false, error: `Brevo ${r.status}: ${(await r.text()).slice(0, 160)}` };
    }
    const resend = Deno.env.get("RESEND_API_KEY");
    if (resend) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${sender.name} <${sender.email}>`, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
      });
      return r.ok ? { ok: true } : { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 160)}` };
    }
    return { ok: false, error: "Email não configurado" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function layout(heading: string, bodyHtml: string, appUrl: string, footer: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#1b2230">
    <h2 style="color:#24558f;margin-bottom:4px">${esc(heading)}</h2>
    ${bodyHtml}
    <p style="margin:26px 0"><a href="${esc(appUrl)}" style="background:#24558f;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Abrir o TreinON</a></p>
    <p style="font-size:12px;color:#667">${esc(footer)}</p>
  </div>`;
}
const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");

// deno-lint-ignore no-explicit-any
type Db = any;

/** Emails of the parents of these players: registered guardians and the emails on the player record. */
async function parentEmails(db: Db, playerIds: string[]): Promise<string[]> {
  if (playerIds.length === 0) return [];
  const [{ data: players }, { data: links }] = await Promise.all([
    db.from("players").select("parent_email, parent_email_2").in("id", playerIds),
    db.from("player_guardians").select("guardian:guardian_profiles(email, user_id)").in("player_id", playerIds),
  ]);
  const out: string[] = [];
  for (const p of players ?? []) out.push(p.parent_email, p.parent_email_2);
  const userIds: string[] = [];
  for (const l of links ?? []) {
    const g = Array.isArray(l.guardian) ? l.guardian[0] : l.guardian;
    if (g?.email) out.push(g.email);
    if (g?.user_id) userIds.push(g.user_id);
  }
  out.push(...(await profileEmails(db, userIds)));
  return out.filter(Boolean);
}

async function profileEmails(db: Db, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await db.from("profiles").select("email").in("id", userIds);
  return (data ?? []).map((p: { email: string | null }) => p.email).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Não autenticado" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const appUrl = (Deno.env.get("APP_URL") || req.headers.get("origin") || "https://treinon.vercel.app").replace(/\/$/, "");
    const { data: me } = await db.from("profiles").select("display_name, full_name, email").eq("id", user.id).maybeSingle();
    const senderName: string = me?.display_name || me?.full_name || "";

    let emails: string[] = [];
    let memberIds: string[] = [];
    let mail: { subject: string; text: string; html: string };
    let notif: { title: string; body: string; type: string; channel_id: string | null; team_id: string | null; club_id: string | null; entity_id: string; entity_type: string } | null = null;

    if (body.kind === "announcement") {
      const { data: a } = await db.from("communication_announcements").select("*").eq("id", body.announcement_id).maybeSingle();
      if (!a) return json({ error: "Anúncio não encontrado" }, 404);
      if (a.created_by !== user.id) return json({ error: "Só quem criou o anúncio o pode enviar" }, 403);
      if (!a.channel_id) return json({ configured: true, total: 0, sent: 0, failed: 0, note: "Só os anúncios para um grupo são enviados por email." });
      const { data: ch } = await db.from("communication_channels").select("id, name, team_id, club_id, allow_guardians").eq("id", a.channel_id).maybeSingle();
      if (!ch) return json({ error: "Grupo não encontrado" }, 404);

      const { data: members } = await db.from("communication_channel_members").select("user_id").eq("channel_id", ch.id);
      memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id).filter((id: string) => id !== user.id);
      emails = await profileEmails(db, memberIds);
      // parents who have no account yet still get the email
      if (ch.team_id && ch.allow_guardians) {
        const { data: players } = await db.from("players").select("id").eq("team_id", ch.team_id);
        emails.push(...(await parentEmails(db, (players ?? []).map((p: { id: string }) => p.id))));
      }
      const important = a.priority === "important";
      mail = {
        subject: `${important ? "[Importante] " : ""}${a.title} · ${ch.name}`,
        text: [a.title, "", a.content, "", `${senderName ? senderName + " · " : ""}${ch.name}`, appUrl].join("\n"),
        html: layout(a.title, paragraphs(a.content), `${appUrl}/communication`, `Enviado ${senderName ? "por " + senderName + " " : ""}para o grupo "${ch.name}" no TreinON.`),
      };
      notif = { title: a.title, body: String(a.content).slice(0, 240), type: "announcement", channel_id: ch.id, team_id: ch.team_id, club_id: ch.club_id, entity_id: a.id, entity_type: "announcement" };
    } else if (body.kind === "callup") {
      const { data: m } = await db.from("matches").select("id, team_id, opponent_name, match_date, location, is_home").eq("id", body.match_id).maybeSingle();
      if (!m) return json({ error: "Jogo não encontrado" }, 404);
      const { data: allowed } = await userClient.rpc("can_coach_team", { _user: user.id, _team: m.team_id });
      if (!allowed) return json({ error: "Sem permissão nesta equipa" }, 403);
      const { data: team } = await db.from("teams").select("name, club_id").eq("id", m.team_id).maybeSingle();
      const asked: string[] = Array.isArray(body.player_ids) ? body.player_ids.filter((x: unknown) => typeof x === "string").slice(0, 60) : [];
      const { data: players } = asked.length
        ? await db.from("players").select("id, name, number").eq("team_id", m.team_id).in("id", asked).order("name")
        : { data: [] };
      const list = players ?? [];
      if (list.length === 0) return json({ configured: true, total: 0, sent: 0, failed: 0, note: "Sem jogadores convocados." });
      emails = await parentEmails(db, list.map((p: { id: string }) => p.id));

      const when = new Date(m.match_date).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
      const where = m.location || (m.is_home ? "Casa" : "Fora");
      const names = list.map((p: { name: string; number: number | null }) => (p.number != null ? `${p.number} · ${p.name}` : p.name));
      const extra = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
      const title = `Convocatória: ${team?.name ?? "Equipa"} vs ${m.opponent_name}`;
      mail = {
        subject: `${title} · ${when}`,
        text: [title, "", `Quando: ${when}`, `Onde: ${where}`, "", extra, extra ? "" : null, "Convocados:", ...names.map((n: string) => `- ${n}`), "", appUrl].filter((x) => x !== null).join("\n"),
        html: layout(title,
          `<p><b>Quando:</b> ${esc(when)}<br/><b>Onde:</b> ${esc(where)}</p>${extra ? paragraphs(extra) : ""}<p><b>Convocados (${names.length})</b></p><ul>${names.map((n: string) => `<li>${esc(n)}</li>`).join("")}</ul>`,
          appUrl, `Enviado ${senderName ? "por " + senderName + " " : ""}aos encarregados de educação dos convocados.`),
      };
    } else {
      return json({ error: "Pedido inválido" }, 400);
    }

    // in-app bell for people with an account (best effort: the email is what matters)
    if (notif && memberIds.length) {
      const { error } = await db.from("communication_notifications").insert(memberIds.slice(0, 500).map((uid) => ({
        user_id: uid, title: notif!.title, body: notif!.body, notification_type: notif!.type, channel_id: notif!.channel_id,
        team_id: notif!.team_id, club_id: notif!.club_id, entity_id: notif!.entity_id, entity_type: notif!.entity_type, action_url: "/communication",
      })));
      if (error) console.warn("[send-notice] in-app notification skipped:", error.message);
    }

    const mine = (me?.email || user.email || "").toLowerCase();
    const unique = [...new Set(emails.map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e) && e !== mine))];
    if (!(Deno.env.get("BREVO_API_KEY") || Deno.env.get("RESEND_API_KEY"))) {
      return json({ configured: false, total: unique.length, sent: 0, failed: 0 });
    }
    const targets = unique.slice(0, MAX_RECIPIENTS);
    let sent = 0, failed = 0, firstError: string | undefined;
    // one email per person (nobody sees the other addresses), a few at a time
    for (let i = 0; i < targets.length; i += 5) {
      const results = await Promise.all(targets.slice(i, i + 5).map((to) => sendEmail(to, mail, senderName)));
      for (const r of results) { if (r.ok) sent++; else { failed++; firstError ??= r.error; } }
    }
    if (firstError) console.error("[send-notice] email failed:", firstError);
    return json({ configured: true, total: unique.length, sent, failed, skipped: unique.length - targets.length, error: firstError });
  } catch (e) {
    console.error("[send-notice]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
