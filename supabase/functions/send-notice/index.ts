// Emails what must leave the app: the app alone reaches nobody who does not open it.
//   { kind: "announcement", announcement_id }
//   { kind: "callup", match_id, player_ids: string[], message?: string, to?: { parents?: boolean, players?: boolean, coordinator?: boolean } }
//       in a club team the coordinator ALWAYS gets the call-up when it is saved, whatever `to` says
//       (resend: true = the coach is sending it again by hand to parents/players only)
//   { kind: "event", event_id }
//   { kind: "absence_alert", team_id }   two trainings missed without a reason -> coordinator
//   { kind: "event_reminder", event_id }  whoever has not answered "Vou / Não vou" yet
//   { kind: "cron" } + header x-cron-secret: the daily job (event reminders before the deadline,
//       overdue fees -> coordinator)
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

interface Mail { subject: string; text: string; html: string }
/** one message and who gets it; `group` is what the coach is told ("pais", "coordenador"…) */
interface Batch { group: string; to: string[]; mail: Mail }

function parseFrom(): { name: string; email: string } {
  const raw = Deno.env.get("EMAIL_FROM") ?? "TreinON <treinon.apoio@gmail.com>";
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || "TreinON", email: m[2] } : { name: "TreinON", email: raw.trim() };
}

async function sendEmail(to: string, mail: Mail, fromName: string): Promise<{ ok: boolean; error?: string }> {
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

async function profileEmails(db: Db, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await db.from("profiles").select("email").in("id", userIds);
  return (data ?? []).map((p: { email: string | null }) => p.email).filter(Boolean);
}

/** player id → emails of the parents (registered guardians and the emails on the player record). */
async function parentEmailsByPlayer(db: Db, playerIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(playerIds.map((id) => [id, []]));
  if (playerIds.length === 0) return out;
  const [{ data: players }, { data: links }] = await Promise.all([
    db.from("player_private").select("id:player_id, parent_email, parent_email_2").in("player_id", playerIds),
    db.from("player_guardians").select("player_id, guardian:guardian_profiles(email, user_id)").in("player_id", playerIds),
  ]);
  for (const p of players ?? []) out.get(p.id)?.push(p.parent_email, p.parent_email_2);
  const byUser = new Map<string, string[]>();
  for (const l of links ?? []) {
    const g = Array.isArray(l.guardian) ? l.guardian[0] : l.guardian;
    if (g?.email) out.get(l.player_id)?.push(g.email);
    if (g?.user_id) byUser.set(g.user_id, [...(byUser.get(g.user_id) ?? []), l.player_id]);
  }
  if (byUser.size) {
    const { data: profs } = await db.from("profiles").select("id, email").in("id", [...byUser.keys()]);
    for (const pr of profs ?? []) if (pr.email) for (const pid of byUser.get(pr.id) ?? []) out.get(pid)?.push(pr.email);
  }
  for (const [k, v] of out) out.set(k, v.filter(Boolean));
  return out;
}
const parentEmails = async (db: Db, playerIds: string[]) => [...(await parentEmailsByPlayer(db, playerIds)).values()].flat();

/** player id → the player's own emails (record and account). */
async function playerEmailsByPlayer(db: Db, playerIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(playerIds.map((id) => [id, []]));
  if (playerIds.length === 0) return out;
  const [{ data: players }, { data: accounts }] = await Promise.all([
    db.from("player_private").select("id:player_id, email").in("player_id", playerIds),
    db.from("player_accounts").select("player_id, user_id").in("player_id", playerIds),
  ]);
  for (const p of players ?? []) if (p.email) out.get(p.id)?.push(p.email);
  const ids = (accounts ?? []).map((a: { user_id: string }) => a.user_id);
  if (ids.length) {
    const { data: profs } = await db.from("profiles").select("id, email").in("id", ids);
    const mail = new Map((profs ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email]));
    for (const a of accounts ?? []) { const e = mail.get(a.user_id); if (e) out.get(a.player_id)?.push(e as string); }
  }
  return out;
}

async function coordinatorEmails(db: Db, teamId: string): Promise<string[]> {
  const { data, error } = await db.rpc("team_coordinator_emails", { _team: teamId });
  if (error) console.warn("[send-notice] coordinators:", error.message);
  return (data ?? []).map((r: { email: string }) => r.email).filter(Boolean);
}

// deno-lint-ignore no-explicit-any
function reminderMail(ev: any, appUrl: string): Mail {
  const tz = { timeZone: "Europe/Lisbon" } as const;
  const when = new Date(ev.starts_at).toLocaleString("pt-PT", { ...tz, weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  const until = ev.rsvp_deadline ? new Date(ev.rsvp_deadline).toLocaleDateString("pt-PT", { ...tz, weekday: "long", day: "2-digit", month: "long" }) : "";
  const ask = until ? `Responda até ${until}.` : "Diga se vai, para a organização saber com quantas pessoas contar.";
  return {
    subject: `Ainda não respondeu: ${ev.title} · ${when}`,
    text: [`${ev.title}`, `Quando: ${when}`, ev.location ? `Onde: ${ev.location}` : null, "", `Ainda não disse se vai. ${ask}`, "", `${appUrl}/eventos`].filter((x) => x !== null).join("\n"),
    html: layout(ev.title, `<p><b>Quando:</b> ${esc(when)}${ev.location ? `<br/><b>Onde:</b> ${esc(ev.location)}` : ""}</p><p>Ainda não disse se vai. ${esc(ask)}</p>`,
      `${appUrl}/eventos`, "Lembrete do TreinON: basta abrir a app e tocar em Vou ou Não vou."),
  };
}

/** The daily job: events whose deadline (or date) is close and that still wait for answers. */
async function runDaily(db: Db, appUrl: string) {
  const now = new Date();
  const h = (n: number) => new Date(now.getTime() + n * 3_600_000).toISOString();
  const { data: events } = await db.from("club_events").select("*").is("reminder_sent_at", null).gt("starts_at", now.toISOString()).lte("starts_at", h(24 * 21)).limit(200);
  let reminded = 0, sent = 0;
  for (const ev of events ?? []) {
    const due = ev.rsvp_deadline
      ? ev.rsvp_deadline > now.toISOString() && ev.rsvp_deadline <= h(36)
      : ev.starts_at <= h(48);
    if (!due) continue;
    const { data: pending } = await db.rpc("event_pending_emails", { _event: ev.id });
    const emails = [...new Set((pending ?? []).map((p: { email: string }) => String(p.email).trim().toLowerCase()).filter((e: string) => EMAIL_RE.test(e)))] as string[];
    const mail = reminderMail(ev, appUrl);
    for (const to of emails) { if (sent >= MAX_RECIPIENTS) break; if ((await sendEmail(to, mail, "")).ok) sent++; }
    await db.from("club_events").update({ reminder_sent_at: now.toISOString() }).eq("id", ev.id);
    reminded++;
  }
  const fees = await overdueFeeNotices(db, appUrl, MAX_RECIPIENTS - sent);
  return { ok: true, events: reminded, sent, fee_players: fees.players, fee_emails: fees.sent };
}

/**
 * Overdue fees: each coordinator gets one email per team with the players that became
 * overdue since the last time he was told. A player is reported once per debt (again only
 * if he pays and falls behind again); the full list is always on the Alertas page.
 */
async function overdueFeeNotices(db: Db, appUrl: string, budget: number) {
  const { data: rows, error } = await db.rpc("overdue_fee_alerts");
  if (error) { console.error("[send-notice] overdue fees:", error.message); return { players: 0, sent: 0 }; }
  type Row = { club_id: string; team_id: string; team_name: string; player_id: string; player_name: string; ref_key: string; items: number; amount: number; since: string };
  const all: Row[] = rows ?? [];
  if (all.length === 0) return { players: 0, sent: 0 };
  const known = new Set<string>();
  for (let i = 0; i < all.length; i += 200) {
    const { data } = await db.from("coordinator_alert_state").select("player_id, ref_key, emailed_at").eq("kind", "payment").in("player_id", all.slice(i, i + 200).map((r) => r.player_id));
    for (const k of data ?? []) if (k.emailed_at) known.add(`${k.player_id}|${k.ref_key}`);
  }
  const fresh = all.filter((r) => !known.has(`${r.player_id}|${r.ref_key}`));
  const byTeam = new Map<string, Row[]>();
  for (const r of fresh) byTeam.set(r.team_id, [...(byTeam.get(r.team_id) ?? []), r]);
  const euro = (n: number) => Number(n).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  const d = (x: string) => new Date(x + "T12:00:00").toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
  let sent = 0, players = 0;
  for (const [teamId, list] of byTeam) {
    if (sent >= budget) break;
    const to = [...new Set((await coordinatorEmails(db, teamId)).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
    if (to.length === 0) continue; // nobody to tell yet: try again tomorrow
    list.sort((a, b) => a.player_name.localeCompare(b.player_name, "pt"));
    const lines = list.map((r) => `${r.player_name}: ${r.items} ${r.items === 1 ? "mensalidade" : "mensalidades"} · ${euro(r.amount)} · desde ${d(r.since)}`);
    const title = `Mensalidades em atraso · ${list[0].team_name}`;
    const mail: Mail = {
      subject: `${title}: ${list.length} ${list.length === 1 ? "jogador" : "jogadores"}`,
      text: [title, "", ...lines.map((l) => `- ${l}`), "", `${appUrl}/coordenacao/alertas`].join("\n"),
      html: layout(title, `<p>Passaram a ter mensalidades por pagar depois do vencimento:</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
        `${appUrl}/coordenacao/alertas`, "Aviso automático do TreinON. A lista completa e o botão Tratado estão em Alertas."),
    };
    let ok = 0;
    for (const addr of to) { if (sent >= budget) break; if ((await sendEmail(addr, mail, "")).ok) { ok++; sent++; } }
    if (ok === 0) continue;
    // emailed_at only: a coordinator's "Tratado" and note are left as they are
    await db.from("coordinator_alert_state").upsert(
      list.map((r) => ({ kind: "payment", player_id: r.player_id, ref_key: r.ref_key, club_id: r.club_id, emailed_at: new Date().toISOString() })),
      { onConflict: "kind,player_id,ref_key" });
    players += list.length;
  }
  return { players, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // the scheduled job has no user: it proves itself with the shared secret
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
      const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      return json(await runDaily(svc, (Deno.env.get("APP_URL") || "https://treinon.vercel.app").replace(/\/$/, "")));
    }
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
    const by = senderName ? `por ${senderName} ` : "";

    const batches: Batch[] = [];
    let memberIds: string[] = [];
    let notif: { title: string; body: string; type: string; channel_id: string | null; team_id: string | null; club_id: string | null; entity_id: string; entity_type: string } | null = null;
    /** runs after the emails went out (e.g. remember which alerts were sent) */
    let afterSend: (() => Promise<void>) | null = null;
    /** the sender is normally left out; a coordinator who is also the coach still gets his copy */
    let keepSender = false;

    if (body.kind === "announcement") {
      const { data: a } = await db.from("communication_announcements").select("*").eq("id", body.announcement_id).maybeSingle();
      if (!a) return json({ error: "Anúncio não encontrado" }, 404);
      if (a.created_by !== user.id) return json({ error: "Só quem criou o anúncio o pode enviar" }, 403);
      if (!a.channel_id) return json({ configured: true, total: 0, sent: 0, failed: 0, note: "Só os anúncios para um grupo são enviados por email." });
      const { data: ch } = await db.from("communication_channels").select("id, name, team_id, club_id, allow_guardians").eq("id", a.channel_id).maybeSingle();
      if (!ch) return json({ error: "Grupo não encontrado" }, 404);

      const { data: members } = await db.from("communication_channel_members").select("user_id").eq("channel_id", ch.id);
      memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id).filter((id: string) => id !== user.id);
      const emails = await profileEmails(db, memberIds);
      // parents who have no account yet still get the email
      if (ch.team_id && ch.allow_guardians) {
        const { data: players } = await db.from("players").select("id").eq("team_id", ch.team_id);
        emails.push(...(await parentEmails(db, (players ?? []).map((p: { id: string }) => p.id))));
      }
      const important = a.priority === "important";
      batches.push({ group: "grupo", to: emails, mail: {
        subject: `${important ? "[Importante] " : ""}${a.title} · ${ch.name}`,
        text: [a.title, "", a.content, "", `${senderName ? senderName + " · " : ""}${ch.name}`, appUrl].join("\n"),
        html: layout(a.title, paragraphs(a.content), `${appUrl}/communication`, `Enviado ${by}para o grupo "${ch.name}" no TreinON.`),
      } });
      notif = { title: a.title, body: String(a.content).slice(0, 240), type: "announcement", channel_id: ch.id, team_id: ch.team_id, club_id: ch.club_id, entity_id: a.id, entity_type: "announcement" };
    } else if (body.kind === "callup") {
      const { data: m } = await db.from("matches").select("id, team_id, opponent_name, match_date, location, is_home, competition, logistics").eq("id", body.match_id).maybeSingle();
      if (!m) return json({ error: "Jogo não encontrado" }, 404);
      const { data: allowed } = await userClient.rpc("can_coach_team", { _user: user.id, _team: m.team_id });
      if (!allowed) return json({ error: "Sem permissão nesta equipa" }, 403);
      const { data: team } = await db.from("teams").select("name, club_id").eq("id", m.team_id).maybeSingle();
      const asked: string[] = Array.isArray(body.player_ids) ? body.player_ids.filter((x: unknown) => typeof x === "string").slice(0, 60) : [];
      const { data: players } = asked.length
        ? await db.from("players").select("id, name, number").eq("team_id", m.team_id).in("id", asked).order("name")
        : { data: [] };
      const list: { id: string; name: string; number: number | null }[] = players ?? [];
      if (list.length === 0) return json({ configured: true, total: 0, sent: 0, failed: 0, note: "Sem jogadores convocados." });

      // old callers sent no `to`: that meant "the parents"
      const to = body.to && typeof body.to === "object" ? body.to : { parents: true };
      const inClub = !!team?.club_id;

      const tz = { timeZone: "Europe/Lisbon" } as const;
      const date = new Date(m.match_date);
      const day = date.toLocaleDateString("pt-PT", { ...tz, weekday: "long", day: "2-digit", month: "long" });
      const hour = date.toLocaleTimeString("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" });
      const where = m.location || (m.is_home ? "Casa" : "Fora");
      const lg = (m.logistics ?? {}) as { meet_time?: string; meet_place?: string; transport?: string; kit?: string; info?: string };
      const facts: [string, string][] = [
        ["Adversário", m.opponent_name], ["Data", day], ["Hora do jogo", hour], ["Local", where],
        ...(m.competition ? [["Competição", m.competition] as [string, string]] : []),
        ...(lg.meet_time ? [["Concentração", `${lg.meet_time}${lg.meet_place ? " · " + lg.meet_place : ""}`] as [string, string]] : []),
        ...(lg.transport ? [["Transporte", lg.transport] as [string, string]] : []),
        ...(lg.kit ? [["Equipamento", lg.kit] as [string, string]] : []),
      ];
      const factsText = facts.map(([k, v]) => `${k}: ${v}`);
      const factsHtml = `<p>${facts.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join("<br/>")}</p>`;
      const extra = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
      const teamName = team?.name ?? "Equipa";
      const names = list.map((p) => (p.number != null ? `${p.number} · ${p.name}` : p.name));

      // the coordinator: always in a club team, with the whole list
      if (inClub && body.resend !== true) {
        keepSender = true;
        const title = `Convocatória ${teamName} vs ${m.opponent_name}`;
        batches.push({ group: "coordenador", to: await coordinatorEmails(db, m.team_id), mail: {
          subject: `${title} · ${day}, ${hour}`,
          text: [title, "", ...factsText, "", extra, extra ? "" : null, `Convocados (${names.length}):`, ...names.map((n) => `- ${n}`), "", appUrl].filter((x) => x !== null).join("\n"),
          html: layout(title, `${factsHtml}${extra ? paragraphs(extra) : ""}<p><b>Convocados (${names.length})</b></p><ul>${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`,
            appUrl, `Convocatória feita ${by}— enviada à coordenação do clube.`),
        } });
      }
      // parents and players: one message per player, saying that he/she is called up
      if (to.parents || to.players) {
        const ids = list.map((p) => p.id);
        const [parents, own] = await Promise.all([
          to.parents ? parentEmailsByPlayer(db, ids) : Promise.resolve(new Map<string, string[]>()),
          to.players ? playerEmailsByPlayer(db, ids) : Promise.resolve(new Map<string, string[]>()),
        ]);
        for (const p of list) {
          const mailFor = (who: "parent" | "player"): Mail => {
            const line = who === "parent" ? `${p.name} está convocado(a) para o jogo ${teamName} vs ${m.opponent_name}.` : `Estás convocado(a) para o jogo ${teamName} vs ${m.opponent_name}.`;
            return {
              subject: `Convocatória: ${p.name} · ${teamName} vs ${m.opponent_name} · ${day}, ${hour}`,
              text: [line, "", ...factsText, "", extra, "", appUrl].join("\n"),
              html: layout(`Convocatória · ${teamName} vs ${m.opponent_name}`, `<p>${esc(line)}</p>${factsHtml}${extra ? paragraphs(extra) : ""}`, appUrl,
                `Enviado ${by}${who === "parent" ? `aos encarregados de educação de ${p.name}` : `a ${p.name}`}.`),
            };
          };
          if (to.parents) batches.push({ group: "pais", to: parents.get(p.id) ?? [], mail: mailFor("parent") });
          if (to.players) batches.push({ group: "jogadores", to: own.get(p.id) ?? [], mail: mailFor("player") });
        }
      }
      if (batches.length === 0) return json({ configured: true, total: 0, sent: 0, failed: 0, groups: {}, note: "Convocatória guardada, sem envio." });
    } else if (body.kind === "event") {
      const { data: ev } = await db.from("club_events").select("*").eq("id", body.event_id).maybeSingle();
      if (!ev) return json({ error: "Evento não encontrado" }, 404);
      if (ev.owner_id !== user.id) {
        const { data: admin } = ev.club_id ? await userClient.rpc("is_club_admin", { _user_id: user.id, _club_id: ev.club_id }) : { data: false };
        if (!admin) return json({ error: "Só quem criou o evento o pode enviar" }, 403);
      }
      // the teams the event is for: one team, the whole club, or every team of the coach
      let teamQuery = db.from("teams").select("id, name");
      teamQuery = ev.team_id ? teamQuery.eq("id", ev.team_id) : ev.club_id ? teamQuery.eq("club_id", ev.club_id) : teamQuery.eq("owner_id", ev.owner_id).is("club_id", null);
      const { data: teams } = await teamQuery;
      const ids = (teams ?? []).map((t: { id: string }) => t.id);
      const { data: players } = ids.length ? await db.from("players").select("id").in("team_id", ids).limit(2000) : { data: [] };
      const emails = await parentEmails(db, (players ?? []).map((p: { id: string }) => p.id));

      const tz = { timeZone: "Europe/Lisbon" } as const;
      const start = new Date(ev.starts_at);
      const when = start.toLocaleString("pt-PT", { ...tz, weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })
        + (ev.ends_at ? " – " + new Date(ev.ends_at).toLocaleTimeString("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" }) : "");
      const scope = ev.team_id ? (teams?.[0]?.name ?? "") : ev.club_id ? "Todo o clube" : "";
      const details = typeof ev.description === "string" ? ev.description.trim() : "";
      batches.push({ group: "pais", to: emails, mail: {
        subject: `${ev.title} · ${when}`,
        text: [ev.title, scope, "", `Quando: ${when}`, ev.location ? `Onde: ${ev.location}` : null, "", details, "", appUrl].filter((x) => x !== null).join("\n"),
        html: layout(ev.title,
          `<p><b>Quando:</b> ${esc(when)}${ev.location ? `<br/><b>Onde:</b> ${esc(ev.location)}` : ""}${scope ? `<br/><b>Para:</b> ${esc(scope)}` : ""}</p>${details ? paragraphs(details) : ""}`,
          appUrl, `Enviado ${by}aos encarregados de educação. Veja todos os eventos e jogos no TreinON.`),
      } });
    } else if (body.kind === "event_reminder") {
      const { data: ev } = await db.from("club_events").select("*").eq("id", body.event_id).maybeSingle();
      if (!ev) return json({ error: "Evento não encontrado" }, 404);
      const { data: can } = await userClient.rpc("can_manage_event_rsvps", { _user: user.id, _event: ev.id });
      if (!can) return json({ error: "Só quem organiza o evento pode enviar lembretes" }, 403);
      const { data: pending } = await db.rpc("event_pending_emails", { _event: ev.id });
      const emails = (pending ?? []).map((p: { email: string }) => p.email);
      if (emails.length === 0) return json({ configured: true, total: 0, sent: 0, failed: 0, note: "Ninguém por lembrar: quem tem conta na app já respondeu." });
      batches.push({ group: "lembrete", to: emails, mail: reminderMail(ev, appUrl) });
      afterSend = async () => { await db.from("club_events").update({ reminder_sent_at: new Date().toISOString() }).eq("id", ev.id); };
    } else if (body.kind === "absence_alert") {
      // called right after the coach saves the attendance of a training
      const teamId = String(body.team_id ?? "");
      const { data: allowed } = await userClient.rpc("can_coach_team", { _user: user.id, _team: teamId });
      if (!allowed) return json({ error: "Sem permissão nesta equipa" }, 403);
      const { data: team } = await db.from("teams").select("name, club_id").eq("id", teamId).maybeSingle();
      if (!team?.club_id) return json({ configured: true, total: 0, sent: 0, failed: 0, alerts: 0 });
      const { data: alerts, error: aErr } = await db.rpc("team_absence_alerts", { _team: teamId });
      if (aErr) return json({ error: aErr.message }, 500);
      const rows: { player_id: string; player_name: string; last_absence: string; previous_absence: string }[] = alerts ?? [];
      if (rows.length === 0) return json({ configured: true, total: 0, sent: 0, failed: 0, alerts: 0 });
      // only what the coordinator was not told yet
      const { data: known } = await db.from("coordinator_alert_state").select("player_id, ref_key, emailed_at").eq("kind", "absence").in("player_id", rows.map((r) => r.player_id));
      const told = new Set((known ?? []).filter((k: { emailed_at: string | null }) => k.emailed_at).map((k: { player_id: string; ref_key: string }) => `${k.player_id}|${k.ref_key}`));
      const fresh = rows.filter((r) => !told.has(`${r.player_id}|${r.last_absence}`));
      if (fresh.length === 0) return json({ configured: true, total: 0, sent: 0, failed: 0, alerts: 0 });
      const d = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
      const lines = fresh.map((r) => `${r.player_name}: faltou a ${d(r.previous_absence)} e ${d(r.last_absence)}`);
      keepSender = true;
      batches.push({ group: "coordenador", to: await coordinatorEmails(db, teamId), mail: {
        subject: `Alerta de faltas · ${team.name}: ${fresh.map((r) => r.player_name).join(", ")}`,
        text: [`${team.name}: dois treinos seguidos sem motivo comunicado`, "", ...lines.map((l) => `- ${l}`), "", `${appUrl}/coordenacao/alertas`].join("\n"),
        html: layout(`Alerta de faltas · ${team.name}`,
          `<p>Dois treinos seguidos sem presença e sem motivo comunicado:</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
          `${appUrl}/coordenacao/alertas`, `Aviso automático depois de o treinador ${senderName || ""} registar as presenças.`),
      } });
      afterSend = async () => {
        await db.from("coordinator_alert_state").upsert(
          fresh.map((r) => ({ kind: "absence", player_id: r.player_id, ref_key: r.last_absence, club_id: team.club_id, emailed_at: new Date().toISOString() })),
          { onConflict: "kind,player_id,ref_key" });
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
    // one email per person and message (nobody sees the other addresses)
    const jobs: { group: string; to: string; mail: Mail }[] = [];
    for (const b of batches) {
      const unique = [...new Set(b.to.map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e) && (keepSender && b.group === "coordenador" ? true : e !== mine)))];
      for (const to of unique) jobs.push({ group: b.group, to, mail: b.mail });
    }
    const groups: Record<string, number> = {};
    for (const b of batches) groups[b.group] ??= 0;
    if (!(Deno.env.get("BREVO_API_KEY") || Deno.env.get("RESEND_API_KEY"))) {
      return json({ configured: false, total: jobs.length, sent: 0, failed: 0, groups });
    }
    const targets = jobs.slice(0, MAX_RECIPIENTS);
    let sent = 0, failed = 0, firstError: string | undefined;
    for (let i = 0; i < targets.length; i += 5) {
      const chunk = targets.slice(i, i + 5);
      const results = await Promise.all(chunk.map((j) => sendEmail(j.to, j.mail, senderName)));
      results.forEach((r, k) => { if (r.ok) { sent++; groups[chunk[k].group] = (groups[chunk[k].group] ?? 0) + 1; } else { failed++; firstError ??= r.error; } });
    }
    if (firstError) console.error("[send-notice] email failed:", firstError);
    if (afterSend && sent > 0) await afterSend();
    return json({ configured: true, total: jobs.length, sent, failed, skipped: jobs.length - targets.length, groups, error: firstError });
  } catch (e) {
    console.error("[send-notice]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
