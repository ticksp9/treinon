// Backups of a club's (or a coach's) data, as JSON files that load into another TreinON
// database (see docs/BACKUP-E-MIGRACAO.md).
//   POST {}                              -> a fresh copy, returned to download
//   POST { scope: "coach" }              -> only the caller's own data (teams outside any club)
//   POST { action: "list" }              -> the automatic nightly copies kept for the caller
//   POST { action: "download", name }    -> one of them
//   POST { action: "cron" } + x-cron-secret -> the nightly job: one copy per club / coach, last 14 kept
// Only the owner / an administrator of a club reaches the club's copies.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "backups";
const KEEP = 14;
const NAME_RE = /^\d{4}-\d{2}-\d{2}\.json$/;
// deno-lint-ignore no-explicit-any
type Db = any;

const rowCountOf = (data: { tables?: Record<string, unknown[]> }) =>
  Object.values(data?.tables ?? {}).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);

/** One copy per scope and day (a second run on the same day replaces it); old ones are removed. */
async function storeCopy(db: Db, supabaseUrl: string, kind: "club" | "coach", id: string): Promise<{ ok: boolean; rows?: number; error?: string }> {
  const { data, error } = await db.rpc("export_scope_data", { _club: kind === "club" ? id : null, _owner: kind === "coach" ? id : null });
  if (error) return { ok: false, error: error.message };
  const rows = rowCountOf(data);
  if (rows === 0) return { ok: true, rows: 0 }; // nothing to keep yet
  const folder = `${kind}/${id}`;
  const name = `${new Date().toISOString().slice(0, 10)}.json`;
  const file = new Blob([JSON.stringify({ ...data, source: supabaseUrl, automatic: true })], { type: "application/json" });
  const up = await db.storage.from(BUCKET).upload(`${folder}/${name}`, file, { upsert: true, contentType: "application/json" });
  if (up.error) return { ok: false, error: up.error.message };
  const { data: files } = await db.storage.from(BUCKET).list(folder, { limit: 200, sortBy: { column: "name", order: "desc" } });
  const old = (files ?? []).filter((f: { name: string }) => NAME_RE.test(f.name)).slice(KEEP).map((f: { name: string }) => `${folder}/${f.name}`);
  if (old.length) await db.storage.from(BUCKET).remove(old);
  return { ok: true, rows };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    // ── the nightly job (no user: it proves itself with the shared secret) ──
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
      const { data: scopes, error } = await db.rpc("backup_scopes");
      if (error) return json({ error: error.message }, 500);
      let done = 0, empty = 0; const failed: string[] = [];
      for (const s of (scopes ?? []).slice(0, 300) as { kind: "club" | "coach"; id: string }[]) {
        const r = await storeCopy(db, supabaseUrl, s.kind, s.id);
        if (!r.ok) failed.push(`${s.kind}/${s.id}: ${r.error}`);
        else if (r.rows === 0) empty++;
        else done++;
      }
      if (failed.length) console.error("[club-backup] nightly copies failed:", failed.slice(0, 5));
      return json({ ok: failed.length === 0, copies: done, empty, failed: failed.length });
    }

    // ── a person ──
    const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    if (!token || token === anonKey) return json({ error: "Não autenticado" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    // parents and players have nothing to export
    const [{ data: guardian }, { data: playerAcc }] = await Promise.all([
      db.from("guardian_profiles").select("id").eq("user_id", user.id).limit(1),
      db.from("player_accounts").select("id").eq("user_id", user.id).limit(1),
    ]);
    const { data: ownsTeam } = await db.from("teams").select("id").eq("owner_id", user.id).limit(1);
    const { data: ownedClubs } = await db.from("clubs").select("id, name").eq("owner_id", user.id).limit(5);
    const { data: adminOf } = await db.from("club_staff").select("club_id").eq("user_id", user.id).eq("role", "admin").eq("is_active", true).limit(5);
    const clubIds = [...new Set([...(ownedClubs ?? []).map((c: { id: string }) => c.id), ...(adminOf ?? []).map((c: { club_id: string }) => c.club_id)])];

    let clubId: string | null = null;
    if (body.scope !== "coach") {
      if (typeof body.club_id === "string") {
        if (!clubIds.includes(body.club_id)) return json({ error: "Só o administrador do clube pode fazer a cópia do clube" }, 403);
        clubId = body.club_id;
      } else if (clubIds.length) clubId = clubIds[0];
    }
    if (!clubId && !ownsTeam?.length && ((guardian?.length ?? 0) > 0 || (playerAcc?.length ?? 0) > 0)) {
      return json({ error: "A cópia de segurança é feita pelo treinador ou pelo clube" }, 403);
    }
    // the folder of the caller's own copies: decided here, never taken from the request
    const folder = clubId ? `club/${clubId}` : `coach/${user.id}`;

    if (body.action === "list") {
      const { data: files, error } = await db.storage.from(BUCKET).list(folder, { limit: 100, sortBy: { column: "name", order: "desc" } });
      if (error) return json({ error: error.message }, 500);
      return json({
        keep: KEEP,
        copies: (files ?? []).filter((f: { name: string }) => NAME_RE.test(f.name)).map((f: { name: string; metadata?: { size?: number }; updated_at?: string }) => ({
          name: f.name, date: f.name.slice(0, 10), size: f.metadata?.size ?? null, saved_at: f.updated_at ?? null,
        })),
      });
    }

    if (body.action === "download") {
      if (typeof body.name !== "string" || !NAME_RE.test(body.name)) return json({ error: "Cópia inválida" }, 400);
      const { data: file, error } = await db.storage.from(BUCKET).download(`${folder}/${body.name}`);
      if (error || !file) return json({ error: "Cópia não encontrada" }, 404);
      return new Response(await file.text(), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error } = await db.rpc("export_scope_data", { _club: clubId, _owner: clubId ? null : user.id });
    if (error) return json({ error: error.message }, 500);

    const tables = (data?.tables ?? {}) as Record<string, unknown[]>;
    const rowCount = rowCountOf(data);
    await db.from("backup_log").insert({ user_id: user.id, club_id: clubId, scope: clubId ? "club" : "coach", tables: Object.keys(tables).length, row_count: rowCount });

    return json({ ...data, source: supabaseUrl, exported_by: user.email, summary: { tables: Object.keys(tables).length, rows: rowCount, users: (data?.users ?? []).length } });
  } catch (e) {
    console.error("[club-backup]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
