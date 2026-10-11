// Hands a club (or a coach without a club) a complete copy of what is theirs, as one JSON file
// that can be loaded into another TreinON database (see docs/BACKUP-E-MIGRACAO.md).
//   POST {}                       -> the club the caller administers, or his own data
//   POST { scope: "coach" }       -> only his own data (teams outside any club)
// Only the owner / an administrator of a club gets the club's copy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    const { data, error } = await db.rpc("export_scope_data", { _club: clubId, _owner: clubId ? null : user.id });
    if (error) return json({ error: error.message }, 500);

    const tables = (data?.tables ?? {}) as Record<string, unknown[]>;
    const rowCount = Object.values(tables).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);
    await db.from("backup_log").insert({ user_id: user.id, club_id: clubId, scope: clubId ? "club" : "coach", tables: Object.keys(tables).length, row_count: rowCount });

    return json({ ...data, source: supabaseUrl, exported_by: user.email, summary: { tables: Object.keys(tables).length, rows: rowCount, users: (data?.users ?? []).length } });
  } catch (e) {
    console.error("[club-backup]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
