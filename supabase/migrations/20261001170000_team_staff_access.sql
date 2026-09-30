-- Team staff share a team: head coach, assistant coaches and the club's admins /
-- coordinators can all work on the same players, matches, lineups and trainings.
-- Before this most rows were visible only to whoever created them, so an invited
-- assistant could not see or help with the head coach's match.

-- ─── Helpers ────────────────────────────────────────────────────────────────
-- coach of the team (head or assistant), team owner, or club admin/coordinator
CREATE OR REPLACE FUNCTION public.can_coach_team(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND _team IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = _team AND tc.coach_id = _user)
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = _team AND (
        t.owner_id = _user
        OR (t.club_id IS NOT NULL AND (
          public.is_club_admin(_user, t.club_id)
          OR EXISTS (SELECT 1 FROM public.club_staff cs
                     WHERE cs.club_id = t.club_id AND cs.user_id = _user AND cs.is_active AND cs.role = 'coordenador')))))
  )
$$;

-- like can_coach_team but not assistants: for deleting players, matches, trainings
CREATE OR REPLACE FUNCTION public.can_manage_team(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_coach_team(_user, _team)
    AND NOT EXISTS (SELECT 1 FROM public.team_coaches tc
                    WHERE tc.team_id = _team AND tc.coach_id = _user AND tc.role = 'assistant_coach'
                      AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team AND t.owner_id = _user))
$$;

CREATE OR REPLACE FUNCTION public.can_coach_match(_user uuid, _match uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.matches m
                 WHERE m.id = _match AND (m.owner_id = _user OR public.can_coach_team(_user, m.team_id)))
$$;

REVOKE EXECUTE ON FUNCTION public.can_coach_team(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_coach_match(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_coach_team(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_coach_match(uuid, uuid) TO authenticated;

-- ─── Teams ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Club staff can view club teams" ON public.teams;
CREATE POLICY "Club staff can view club teams" ON public.teams FOR SELECT TO authenticated
  USING (club_id IS NOT NULL AND public.is_club_staff_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Team staff can update teams" ON public.teams;
CREATE POLICY "Team staff can update teams" ON public.teams FOR UPDATE TO authenticated
  USING (public.can_manage_team(auth.uid(), id))
  WITH CHECK (club_id IS NULL OR public.is_club_staff_member(club_id, auth.uid()) OR public.is_club_coach(auth.uid(), club_id));

DROP POLICY IF EXISTS "Club admins can delete club teams" ON public.teams;
CREATE POLICY "Club admins can delete club teams" ON public.teams FOR DELETE TO authenticated
  USING (club_id IS NOT NULL AND public.is_club_admin(auth.uid(), club_id));

-- a team can only be put in a club you belong to
DROP POLICY IF EXISTS "Users can insert teams" ON public.teams;
CREATE POLICY "Users can insert teams" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND (club_id IS NULL
    OR public.is_club_staff_member(club_id, auth.uid()) OR public.is_club_coach(auth.uid(), club_id)));

-- ─── Per-table team policies ────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  -- tables with team_id: read/write for team staff, delete for head coach/admin
  FOR r IN SELECT unnest(ARRAY['players', 'matches', 'training_sessions', 'coach_trainings', 'tactical_boards', 'championships']) AS tbl LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Team staff read" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Team staff read" ON public.%I FOR SELECT TO authenticated USING (public.can_coach_team(auth.uid(), team_id))', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Team staff insert" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Team staff insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_coach_team(auth.uid(), team_id))', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Team staff update" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Team staff update" ON public.%I FOR UPDATE TO authenticated USING (public.can_coach_team(auth.uid(), team_id)) WITH CHECK (public.can_coach_team(auth.uid(), team_id))', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Team managers delete" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Team managers delete" ON public.%I FOR DELETE TO authenticated USING (public.can_manage_team(auth.uid(), team_id))', r.tbl);
  END LOOP;

  -- match rows: everything the live match writes
  FOR r IN SELECT unnest(ARRAY['match_lineups', 'match_events']) AS tbl LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Match staff all" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Match staff all" ON public.%I FOR ALL TO authenticated USING (public.can_coach_match(auth.uid(), match_id)) WITH CHECK (public.can_coach_match(auth.uid(), match_id))', r.tbl);
  END LOOP;
END $$;

-- attendance hangs off the training session
DROP POLICY IF EXISTS "Session staff all" ON public.training_attendance;
CREATE POLICY "Session staff all" ON public.training_attendance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = training_attendance.session_id AND public.can_coach_team(auth.uid(), s.team_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = training_attendance.session_id AND public.can_coach_team(auth.uid(), s.team_id)));

-- ─── Live-match functions must check who is calling ─────────────────────────
-- They run with elevated rights (SECURITY DEFINER) and did not check the caller:
-- any signed-in account could write substitutions/tactics into any match.
DO $$
DECLARE
  fn text;
  def text;
  guard text := E'\nBEGIN\n  IF NOT public.can_coach_match(auth.uid(), p_match_id) THEN\n    RAISE EXCEPTION ''Sem permissão para este jogo'' USING ERRCODE = ''42501'';\n  END IF;\n';
BEGIN
  FOREACH fn IN ARRAY ARRAY['commit_substitution_batch', 'apply_tactical_change', 'save_initial_formation'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = fn LIMIT 1;
    IF def IS NULL OR position('can_coach_match' IN def) > 0 THEN CONTINUE; END IF;
    def := regexp_replace(def, E'\\nBEGIN\\n', guard, '');
    IF fn = 'commit_substitution_batch' THEN
      -- events always belong to the match owner, whatever the client sends
      def := regexp_replace(def, E'(Sem permissão para este jogo[^\\n]*\\n  END IF;\\n)',
        E'\\1  p_owner_id := (SELECT m.owner_id FROM public.matches m WHERE m.id = p_match_id);\n', '');
    END IF;
    EXECUTE def;
  END LOOP;
END $$;
