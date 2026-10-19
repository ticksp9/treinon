-- Deleting one's own account (required by the App Store, and a GDPR right).
--   * Whatever belongs to a club stays with the club: before the account goes, every row the
--     person owns that is linked to a club (directly, or through its team, player, match or
--     training) is handed to the club's owner.
--   * What the person had outside any club (a coach's own teams, players, matches…) is deleted
--     with the account.
--   * The owner of a club cannot delete the account while he owns it (the club would be left
--     without anybody in charge): he hands it over first.

-- the club a row belongs to, as SQL for a table (null when it has no link to a club)
CREATE OR REPLACE FUNCTION private.club_expr(_table text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE has text[];
BEGIN
  SELECT array_agg(column_name::text) INTO has FROM information_schema.columns WHERE table_schema = 'public' AND table_name = _table;
  IF 'club_id' = ANY (has) THEN RETURN 'x.club_id'; END IF;
  IF _table = 'teams' THEN RETURN 'x.club_id'; END IF;
  IF 'team_id' = ANY (has) THEN RETURN '(SELECT t.club_id FROM public.teams t WHERE t.id = x.team_id)'; END IF;
  IF 'player_id' = ANY (has) THEN RETURN '(SELECT t.club_id FROM public.players p JOIN public.teams t ON t.id = p.team_id WHERE p.id = x.player_id)'; END IF;
  IF 'match_id' = ANY (has) THEN RETURN '(SELECT t.club_id FROM public.matches m JOIN public.teams t ON t.id = m.team_id WHERE m.id = x.match_id)'; END IF;
  IF 'session_id' = ANY (has) THEN RETURN '(SELECT t.club_id FROM public.training_sessions s JOIN public.teams t ON t.id = s.team_id WHERE s.id = x.session_id)'; END IF;
  RETURN NULL;
END $$;

-- what deleting the account would do, to show the person before he confirms
CREATE OR REPLACE FUNCTION public.account_deletion_preview()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'owned_clubs', coalesce((SELECT jsonb_agg(c.name) FROM public.clubs c WHERE c.owner_id = auth.uid()), '[]'::jsonb),
    'club_teams', (SELECT count(*) FROM public.teams t WHERE t.owner_id = auth.uid() AND t.club_id IS NOT NULL),
    'own_teams', (SELECT count(*) FROM public.teams t WHERE t.owner_id = auth.uid() AND t.club_id IS NULL),
    'own_players', (SELECT count(*) FROM public.players p LEFT JOIN public.teams t ON t.id = p.team_id
                     WHERE p.owner_id = auth.uid() AND t.club_id IS NULL),
    'own_matches', (SELECT count(*) FROM public.matches m JOIN public.teams t ON t.id = m.team_id
                     WHERE m.owner_id = auth.uid() AND t.club_id IS NULL))
$$;
REVOKE ALL ON FUNCTION public.account_deletion_preview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_deletion_preview() TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_account(_confirm text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  r record;
  expr text;
  moved bigint := 0;
  n bigint;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sem sessão' USING ERRCODE = '42501'; END IF;
  IF _confirm IS DISTINCT FROM 'APAGAR' THEN RAISE EXCEPTION 'Confirmação em falta' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.clubs WHERE owner_id = me) THEN
    RAISE EXCEPTION 'É dono de um clube. Passe o clube a outra pessoa antes de apagar a conta.' USING ERRCODE = 'P0001';
  END IF;

  -- 1. what belongs to a club goes to the club's owner (owner_id and every other column that
  --    would block or cascade the deletion)
  FOR r IN
    SELECT DISTINCT cl.relname::text AS t, att.attname::text AS col, con.confdeltype AS rule, NOT att.attnotnull AS nullable
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND con.confrelid = 'auth.users'::regclass AND array_length(con.conkey, 1) = 1
    UNION
    -- owner columns without a foreign key: same treatment, so club data never stays with a ghost
    SELECT c.table_name::text, 'owner_id', 'x'::"char", c.is_nullable = 'YES'
      FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_schema = 'public' AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public' AND c.column_name = 'owner_id' AND c.udt_name = 'uuid'
  LOOP
    CONTINUE WHEN r.t IN ('profiles', 'clubs');
    expr := private.club_expr(r.t);
    IF expr IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I x SET %I = (SELECT c.owner_id FROM public.clubs c WHERE c.id = %s) WHERE x.%I = $1 AND %s IS NOT NULL',
                     r.t, r.col, expr, r.col, expr) USING me;
      GET DIAGNOSTICS n = ROW_COUNT; moved := moved + n;
    END IF;
    -- columns that would stop the deletion ("no action") and are only a trace (created_by…): emptied
    IF r.rule IN ('a', 'r') THEN
      IF r.nullable THEN
        EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I = $1', r.t, r.col, r.col) USING me;
      ELSE
        EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.t, r.col) USING me;
      END IF;
    END IF;
  END LOOP;

  -- 2. memberships end
  DELETE FROM public.club_staff WHERE user_id = me;
  DELETE FROM public.club_coaches WHERE coach_id = me;
  DELETE FROM public.team_coaches WHERE coach_id = me;

  -- 3. the account, and with it everything that was only the person's
  DELETE FROM auth.users WHERE id = me;
  RETURN jsonb_build_object('handed_to_club', moved);
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text) TO authenticated;
