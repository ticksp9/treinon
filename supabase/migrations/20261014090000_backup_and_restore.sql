-- Backup and portability.
-- A club (or a coach without a club) can take everything that is theirs out of this database
-- as one file, and that file can be loaded into another TreinON database (their own Supabase
-- project, or a server of the club) that only has the migrations applied.
--
--   export_scope_data(_club, _owner)  -> jsonb { tables: { <table>: [rows…] }, users: [...] }
--   import_backup_data(_backup)       -> loads such a file; rows that already exist are kept
--
-- Neither is callable by the app's users directly: the export goes through the edge function
-- `club-backup` (which checks who is asking), the import is run by whoever sets up the new
-- database (distribuicao/restaurar-backup.ps1).

CREATE OR REPLACE FUNCTION public.export_scope_data(_club uuid, _owner uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  pass integer := 0;
  added bigint;
  total_added bigint;
  preds text;
  rows jsonb;
  out_tables jsonb := '{}'::jsonb;
  user_ids uuid[];
  users_json jsonb := '[]'::jsonb;
  mig_count bigint;
  mig_last text;
  -- parents whose children are NOT pulled in automatically: a person belongs to several clubs,
  -- so "everything that points to this user" would drag other clubs' data along
  -- (the same for a parent: his children can be in two clubs)
  no_follow CONSTANT text[] := ARRAY['profiles', 'guardian_profiles'];
BEGIN
  IF _club IS NULL AND _owner IS NULL THEN RAISE EXCEPTION 'export needs a club or an owner'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _exp (tbl text NOT NULL, id uuid NOT NULL, PRIMARY KEY (tbl, id)) ON COMMIT DROP;
  TRUNCATE _exp;

  -- ── 1. seeds: the club (or the coach's own teams) and what is directly theirs ──
  IF _club IS NOT NULL THEN
    INSERT INTO _exp SELECT 'clubs', id FROM public.clubs WHERE id = _club ON CONFLICT DO NOTHING;
    INSERT INTO _exp SELECT 'teams', id FROM public.teams WHERE club_id = _club ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO _exp SELECT 'teams', id FROM public.teams WHERE owner_id = _owner AND club_id IS NULL ON CONFLICT DO NOTHING;
    -- everything the coach created outside any club (players without a team, drills, boards, seasons…)
    FOR r IN
      SELECT c.table_name AS t,
             EXISTS (SELECT 1 FROM information_schema.columns c2 WHERE c2.table_schema = 'public' AND c2.table_name = c.table_name AND c2.column_name = 'club_id') AS has_club
        FROM information_schema.columns c
        JOIN information_schema.tables tb ON tb.table_schema = 'public' AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
       WHERE c.table_schema = 'public' AND c.column_name = 'owner_id' AND c.udt_name = 'uuid'
         AND EXISTS (SELECT 1 FROM information_schema.columns c3 WHERE c3.table_schema = 'public' AND c3.table_name = c.table_name AND c3.column_name = 'id' AND c3.udt_name = 'uuid')
    LOOP
      EXECUTE format('INSERT INTO _exp SELECT %L, id FROM public.%I WHERE owner_id = $1 %s ON CONFLICT DO NOTHING',
                     r.t, r.t, CASE WHEN r.has_club THEN 'AND club_id IS NULL' ELSE '' END) USING _owner;
    END LOOP;
  END IF;

  -- ── 2. follow the links: whatever points to something already taken comes along ──
  LOOP
    pass := pass + 1;
    total_added := 0;
    -- the parents of the players taken so far (a link that goes "upwards": named explicitly)
    INSERT INTO _exp SELECT 'guardian_profiles', pg.guardian_id FROM public.player_guardians pg
     WHERE pg.player_id IN (SELECT e.id FROM _exp e WHERE e.tbl = 'players') AND pg.guardian_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS added = ROW_COUNT;
    total_added := total_added + added;
    FOR r IN
      -- real foreign keys (one column, to an "id") …
      SELECT DISTINCT cl.relname::text AS child, att.attname::text AS col, pcl.relname::text AS parent
        FROM pg_constraint con
        JOIN pg_class cl ON cl.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
        JOIN pg_class pcl ON pcl.oid = con.confrelid
        JOIN pg_namespace pns ON pns.oid = pcl.relnamespace AND pns.nspname = 'public'
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
        JOIN pg_attribute patt ON patt.attrelid = con.confrelid AND patt.attnum = con.confkey[1]
       WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1 AND patt.attname = 'id'
         AND cl.relkind = 'r'
      UNION
      -- … and the usual column names, for tables that were created without the constraint
      SELECT c.table_name::text, c.column_name::text, m.parent
        FROM information_schema.columns c
        JOIN information_schema.tables tb ON tb.table_schema = 'public' AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
        JOIN (VALUES ('club_id', 'clubs'), ('team_id', 'teams'), ('player_id', 'players'), ('match_id', 'matches')) AS m(col, parent) ON m.col = c.column_name
       WHERE c.table_schema = 'public' AND c.udt_name = 'uuid'
    LOOP
      CONTINUE WHEN r.parent = ANY (no_follow) OR r.child = r.parent AND r.col = 'id';
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM _exp e WHERE e.tbl = r.parent);
      -- only tables with their own uuid "id" can be followed further (the others are picked in step 3)
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = r.child AND c.column_name = 'id' AND c.udt_name = 'uuid');
      EXECUTE format('INSERT INTO _exp SELECT %L, ch.id FROM public.%I ch WHERE ch.%I IN (SELECT e.id FROM _exp e WHERE e.tbl = %L) ON CONFLICT DO NOTHING',
                     r.child, r.child, r.col, r.parent);
      GET DIAGNOSTICS added = ROW_COUNT;
      total_added := total_added + added;
    END LOOP;
    EXIT WHEN total_added = 0 OR pass >= 8;
  END LOOP;

  -- ── 3. the people involved (accounts are per person, not per club) ──
  SELECT array_agg(DISTINCT u) INTO user_ids FROM (
    SELECT _owner AS u WHERE _owner IS NOT NULL
    UNION SELECT c.owner_id FROM public.clubs c WHERE c.id = _club
    UNION SELECT cs.user_id FROM public.club_staff cs WHERE cs.club_id = _club
    UNION SELECT cc.coach_id FROM public.club_coaches cc WHERE cc.club_id = _club
    UNION SELECT tc.coach_id FROM public.team_coaches tc WHERE tc.team_id IN (SELECT id FROM _exp WHERE tbl = 'teams')
    UNION SELECT t.owner_id FROM public.teams t WHERE t.id IN (SELECT id FROM _exp WHERE tbl = 'teams')
    UNION SELECT gp.user_id FROM public.guardian_profiles gp WHERE gp.id IN (SELECT id FROM _exp WHERE tbl = 'guardian_profiles')
    UNION SELECT pa.user_id FROM public.player_accounts pa WHERE pa.player_id IN (SELECT id FROM _exp WHERE tbl = 'players')
  ) x WHERE u IS NOT NULL;
  user_ids := coalesce(user_ids, '{}');
  INSERT INTO _exp SELECT 'profiles', p.id FROM public.profiles p WHERE p.id = ANY (user_ids) ON CONFLICT DO NOTHING;

  -- ── 4. write it out, table by table ──
  FOR r IN
    SELECT tb.table_name::text AS t,
           EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = tb.table_name AND c.column_name = 'id' AND c.udt_name = 'uuid') AS has_id
      FROM information_schema.tables tb
     WHERE tb.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
     ORDER BY tb.table_name
  LOOP
    IF r.has_id THEN
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM _exp e WHERE e.tbl = r.t);
      EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM public.%I x WHERE x.id IN (SELECT e.id FROM _exp e WHERE e.tbl = %L)', r.t, r.t) INTO rows;
    ELSE
      -- no "id" of its own (e.g. answers keyed by event + person): the rows that hang from something taken
      SELECT string_agg(format('x.%I IN (SELECT e.id FROM _exp e WHERE e.tbl = %L)', k.col, k.parent), ' OR ') INTO preds
        FROM (
          SELECT DISTINCT att.attname::text AS col, pcl.relname::text AS parent
            FROM pg_constraint con
            JOIN pg_class cl ON cl.oid = con.conrelid AND cl.relname = r.t
            JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
            JOIN pg_class pcl ON pcl.oid = con.confrelid
            JOIN pg_namespace pns ON pns.oid = pcl.relnamespace AND pns.nspname = 'public'
            JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
           WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1 AND pcl.relname <> ALL (no_follow)
        ) k
       WHERE EXISTS (SELECT 1 FROM _exp e WHERE e.tbl = k.parent);
      -- personal settings with nothing else to hold on to (only an owner): the people of this export
      IF preds IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = r.t AND c.column_name = 'owner_id' AND c.udt_name = 'uuid') THEN
        EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM public.%I x WHERE x.owner_id = ANY ($1)', r.t) INTO rows USING user_ids;
      ELSIF preds IS NULL THEN
        CONTINUE;
      ELSE
        EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM public.%I x WHERE %s', r.t, preds) INTO rows;
      END IF;
    END IF;
    IF jsonb_array_length(rows) > 0 THEN out_tables := out_tables || jsonb_build_object(r.t, rows); END IF;
  END LOOP;

  -- which version of the database this file comes from (when the migrations table is there)
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT count(*), max(version) FROM supabase_migrations.schema_migrations' INTO mig_count, mig_last;
  END IF;

  -- accounts: who they are, never their passwords (in the new place each one sets a new password)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'user_metadata', to_jsonb(u) -> 'raw_user_meta_data')), '[]'::jsonb)
    INTO users_json FROM auth.users u WHERE u.id = ANY (user_ids);

  RETURN jsonb_build_object(
    'format', 'treinon-backup', 'version', 1,
    'created_at', now(),
    'scope', CASE WHEN _club IS NOT NULL THEN jsonb_build_object('kind', 'club', 'club_id', _club, 'name', (SELECT name FROM public.clubs WHERE id = _club))
                  ELSE jsonb_build_object('kind', 'coach', 'owner_id', _owner) END,
    'migrations', mig_count,
    'last_migration', mig_last,
    'users', users_json,
    'tables', out_tables);
END $$;
REVOKE ALL ON FUNCTION public.export_scope_data(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Loads a backup into this database. Meant for a database that has the migrations and little
-- else: rows whose key already exists are left alone, nothing is deleted. Checks and automatic
-- actions (triggers) are switched off while loading, so the data arrives exactly as it was.
CREATE OR REPLACE FUNCTION public.import_backup_data(_backup jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t text;
  rows jsonb;
  n bigint;
  loaded jsonb := '{}'::jsonb;
  skipped jsonb := '{}'::jsonb;
  cols text;
  u jsonb;
  users_created integer := 0;
BEGIN
  IF coalesce(_backup ->> 'format', '') <> 'treinon-backup' THEN RAISE EXCEPTION 'This is not a TreinON backup file'; END IF;
  PERFORM set_config('session_replication_role', 'replica', true);

  -- the accounts first (without a password: each person sets one with "esqueci-me da palavra-passe")
  FOR u IN SELECT * FROM jsonb_array_elements(coalesce(_backup -> 'users', '[]'::jsonb)) LOOP
    CONTINUE WHEN u ->> 'email' IS NULL OR EXISTS (SELECT 1 FROM auth.users x WHERE x.id = (u ->> 'id')::uuid);
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'instance_id') THEN
        EXECUTE $q$INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
                   VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '{"provider":"email","providers":["email"]}'::jsonb, $3, now(), now(), now())$q$
          USING (u ->> 'id')::uuid, u ->> 'email', coalesce(u -> 'user_metadata', '{}'::jsonb);
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
          EXECUTE $q$INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
                     VALUES (gen_random_uuid(), $1, $1::text, 'email', jsonb_build_object('sub', $1::text, 'email', $2, 'email_verified', true), now(), now())$q$
            USING (u ->> 'id')::uuid, u ->> 'email';
        END IF;
      ELSE
        INSERT INTO auth.users (id, email) VALUES ((u ->> 'id')::uuid, u ->> 'email');
      END IF;
      users_created := users_created + 1;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped || jsonb_build_object('user ' || (u ->> 'email'), SQLERRM);
    END;
  END LOOP;

  FOR t, rows IN SELECT key, value FROM jsonb_each(coalesce(_backup -> 'tables', '{}'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE') THEN
      skipped := skipped || jsonb_build_object(t, 'table does not exist here (older or newer version of the app)');
      CONTINUE;
    END IF;
    BEGIN
      -- only ordinary columns: generated / identity ones are filled by the database
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO cols
        FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = t AND c.is_generated = 'NEVER' AND coalesce(c.identity_generation, '') <> 'ALWAYS';
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING', t, cols, cols, t) USING rows;
      GET DIAGNOSTICS n = ROW_COUNT;
      loaded := loaded || jsonb_build_object(t, n);
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped || jsonb_build_object(t, SQLERRM);
    END;
  END LOOP;

  PERFORM set_config('session_replication_role', 'origin', true);
  RETURN jsonb_build_object('users_created', users_created, 'loaded', loaded, 'skipped', skipped);
END $$;
REVOKE ALL ON FUNCTION public.import_backup_data(jsonb) FROM PUBLIC, anon, authenticated;

-- Who took a copy and when (shown in the app as "última cópia").
CREATE TABLE IF NOT EXISTS public.backup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('club', 'coach')),
  tables integer NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backup_log_read" ON public.backup_log;
CREATE POLICY "backup_log_read" ON public.backup_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (club_id IS NOT NULL AND public.is_club_admin(auth.uid(), club_id)));
GRANT SELECT ON public.backup_log TO authenticated;
