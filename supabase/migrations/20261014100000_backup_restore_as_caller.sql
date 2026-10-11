-- Loading a backup on hosted Supabase: the database role that runs it may switch triggers off
-- for its own transaction, but not from inside a function with elevated rights. So the loader
-- now runs with the rights of whoever calls it (the database administrator, through
-- distribuicao/restaurar-backup.ps1 or psql) and that caller switches the triggers off first.
-- It stays closed to the app's users.

CREATE OR REPLACE FUNCTION public.import_backup_data(_backup jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
  -- Triggers and checks must be off while loading. On hosted Supabase this setting can only be
  -- changed by the statement that calls us, so try, and otherwise require it to be done already.
  BEGIN
    PERFORM set_config('session_replication_role', 'replica', true);
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF current_setting('session_replication_role') <> 'replica' THEN
    RAISE EXCEPTION 'Before loading a backup run, in the same transaction: SET LOCAL session_replication_role = replica';
  END IF;

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

  RETURN jsonb_build_object('users_created', users_created, 'loaded', loaded, 'skipped', skipped);
END $$;
REVOKE ALL ON FUNCTION public.import_backup_data(jsonb) FROM PUBLIC, anon, authenticated;
