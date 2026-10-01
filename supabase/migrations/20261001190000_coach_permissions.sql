-- What each coach / assistant may do in a team (and, for club coaches, whether they
-- can look at the club's other teams). Enforced by the database, not just hidden.
--
-- Team permission keys (team_coaches.permissions):
--   matches       jogos, convocados, jogo ao vivo
--   trainings     treinos e exercícios
--   attendance    presenças nos treinos
--   players_edit  criar/editar fichas de jogadores
--   evaluations   avaliações e notas
--   medical       saúde e lesões
--   invites       convidar encarregados/atletas (e o adjunto, se for principal)
-- Defaults: head coach → all; assistant → matches, trainings, attendance.
-- Club permission (club_coaches.permissions): view_all_teams (read-only).

ALTER TABLE public.team_coaches ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.club_coaches ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Is the user above the coaches of this team? (team owner, club admin, coordinator)
CREATE OR REPLACE FUNCTION public.is_team_manager(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team AND (
      t.owner_id = _user
      OR (t.club_id IS NOT NULL AND (
        public.is_club_admin(_user, t.club_id)
        OR EXISTS (SELECT 1 FROM public.club_staff cs
                   WHERE cs.club_id = t.club_id AND cs.user_id = _user AND cs.is_active AND cs.role = 'coordenador'))))
  )
$$;

CREATE OR REPLACE FUNCTION public.team_coach_default_perm(_role text, _perm text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(_role, 'head_coach') = 'head_coach' THEN true
              ELSE _perm IN ('matches', 'trainings', 'attendance') END
$$;

-- true only when the user is a coach of the team WITHOUT this permission
-- (managers and people who are not coaches of the team are never "lacking")
CREATE OR REPLACE FUNCTION public.coach_lacks_perm(_user uuid, _team uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _team IS NOT NULL
    AND NOT public.is_team_manager(_user, _team)
    AND EXISTS (
      SELECT 1 FROM public.team_coaches tc
      WHERE tc.team_id = _team AND tc.coach_id = _user
        AND NOT coalesce((tc.permissions ->> _perm)::boolean, public.team_coach_default_perm(tc.role, _perm))
    )
$$;

CREATE OR REPLACE FUNCTION public.team_perms_for(_user uuid, _team uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_object_agg(p, NOT public.coach_lacks_perm(_user, _team, p))
  FROM unnest(ARRAY['matches', 'trainings', 'attendance', 'players_edit', 'evaluations', 'medical', 'invites']) AS p
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_manager(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.coach_lacks_perm(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_perms_for(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_lacks_perm(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_perms_for(uuid, uuid) TO authenticated;

-- Matches (and so lineups, events and the live-match functions) need "matches"
CREATE OR REPLACE FUNCTION public.can_coach_match(_user uuid, _match uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.matches m
                 WHERE m.id = _match
                   AND (m.owner_id = _user OR public.can_coach_team(_user, m.team_id))
                   AND NOT public.coach_lacks_perm(_user, m.team_id, 'matches'))
$$;

-- ─── Who changes permissions ───────────────────────────────────────────────
-- managers change anyone's; a head coach changes their assistants'
CREATE OR REPLACE FUNCTION public.set_team_coach_permissions(_team uuid, _coach uuid, _perms jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_role text;
  allowed jsonb;
BEGIN
  SELECT role INTO target_role FROM public.team_coaches WHERE team_id = _team AND coach_id = _coach;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Treinador não está nesta equipa'; END IF;
  IF NOT public.is_team_manager(auth.uid(), _team) THEN
    IF target_role <> 'assistant_coach' OR NOT EXISTS (
      SELECT 1 FROM public.team_coaches WHERE team_id = _team AND coach_id = auth.uid() AND role = 'head_coach'
    ) THEN
      RAISE EXCEPTION 'Sem permissão para alterar este treinador' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- keep only known keys with boolean values
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO allowed
  FROM jsonb_each(coalesce(_perms, '{}'::jsonb)) AS e(k, v)
  WHERE k IN ('matches', 'trainings', 'attendance', 'players_edit', 'evaluations', 'medical', 'invites')
    AND jsonb_typeof(v) = 'boolean';
  UPDATE public.team_coaches SET permissions = allowed WHERE team_id = _team AND coach_id = _coach;
END $$;

CREATE OR REPLACE FUNCTION public.set_club_coach_permissions(_club uuid, _coach uuid, _perms jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_club_admin(auth.uid(), _club) AND NOT EXISTS (
    SELECT 1 FROM public.club_staff cs WHERE cs.club_id = _club AND cs.user_id = auth.uid() AND cs.is_active AND cs.role = 'coordenador'
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  UPDATE public.club_coaches
  SET permissions = jsonb_build_object('view_all_teams', coalesce((_perms ->> 'view_all_teams')::boolean, false))
  WHERE club_id = _club AND coach_id = _coach;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_team_coach_permissions(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_club_coach_permissions(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_team_coach_permissions(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_club_coach_permissions(uuid, uuid, jsonb) TO authenticated;

-- coaches of a team can see each other's role/permissions
DROP POLICY IF EXISTS "Team coaches see their colleagues" ON public.team_coaches;
CREATE POLICY "Team coaches see their colleagues" ON public.team_coaches FOR SELECT TO authenticated
  USING (public.can_coach_team(auth.uid(), team_id));

-- ─── Restrictions (RESTRICTIVE: combined with AND on top of the normal rules) ───
DO $$
DECLARE
  r record;
BEGIN
  -- writes on team rows
  FOR r IN SELECT * FROM (VALUES
      ('matches', 'team_id', 'matches'),
      ('training_sessions', 'team_id', 'trainings'),
      ('coach_trainings', 'team_id', 'trainings'),
      ('players', 'team_id', 'players_edit')) AS v(tbl, col, perm) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "perm_ins_%s" ON public.%I', r.perm, r.tbl);
    EXECUTE format('CREATE POLICY "perm_ins_%s" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.coach_lacks_perm(auth.uid(), %I, %L))', r.perm, r.tbl, r.col, r.perm);
    EXECUTE format('DROP POLICY IF EXISTS "perm_upd_%s" ON public.%I', r.perm, r.tbl);
    EXECUTE format('CREATE POLICY "perm_upd_%s" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.coach_lacks_perm(auth.uid(), %I, %L))', r.perm, r.tbl, r.col, r.perm);
    EXECUTE format('DROP POLICY IF EXISTS "perm_del_%s" ON public.%I', r.perm, r.tbl);
    EXECUTE format('CREATE POLICY "perm_del_%s" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.coach_lacks_perm(auth.uid(), %I, %L))', r.perm, r.tbl, r.col, r.perm);
  END LOOP;
END $$;

-- attendance: through the training session
DROP POLICY IF EXISTS "perm_all_attendance" ON public.training_attendance;
CREATE POLICY "perm_all_attendance" ON public.training_attendance AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.coach_lacks_perm(auth.uid(), (SELECT s.team_id FROM public.training_sessions s WHERE s.id = training_attendance.session_id), 'attendance'))
  WITH CHECK (NOT public.coach_lacks_perm(auth.uid(), (SELECT s.team_id FROM public.training_sessions s WHERE s.id = training_attendance.session_id), 'attendance'));

-- evaluations and medical data: not even readable without the permission
DROP POLICY IF EXISTS "perm_all_evaluations" ON public.player_evaluations;
CREATE POLICY "perm_all_evaluations" ON public.player_evaluations AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.coach_lacks_perm(auth.uid(), (SELECT p.team_id FROM public.players p WHERE p.id = player_evaluations.player_id), 'evaluations'))
  WITH CHECK (NOT public.coach_lacks_perm(auth.uid(), (SELECT p.team_id FROM public.players p WHERE p.id = player_evaluations.player_id), 'evaluations'));

DROP POLICY IF EXISTS "perm_all_medical" ON public.player_injuries;
CREATE POLICY "perm_all_medical" ON public.player_injuries AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.coach_lacks_perm(auth.uid(), (SELECT p.team_id FROM public.players p WHERE p.id = player_injuries.player_id), 'medical'))
  WITH CHECK (NOT public.coach_lacks_perm(auth.uid(), (SELECT p.team_id FROM public.players p WHERE p.id = player_injuries.player_id), 'medical'));

-- ─── Club coaches allowed to look at every team of the club (read only) ───
CREATE OR REPLACE FUNCTION public.club_coach_sees_all(_user uuid, _club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _club IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.club_coaches cc
    WHERE cc.club_id = _club AND cc.coach_id = _user AND cc.is_active
      AND coalesce((cc.permissions ->> 'view_all_teams')::boolean, false))
$$;
REVOKE EXECUTE ON FUNCTION public.club_coach_sees_all(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_coach_sees_all(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Club coaches with view_all see club teams" ON public.teams;
CREATE POLICY "Club coaches with view_all see club teams" ON public.teams FOR SELECT TO authenticated
  USING (public.club_coach_sees_all(auth.uid(), club_id));
DROP POLICY IF EXISTS "Club coaches with view_all see club players" ON public.players;
CREATE POLICY "Club coaches with view_all see club players" ON public.players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = players.team_id AND public.club_coach_sees_all(auth.uid(), t.club_id)));
DROP POLICY IF EXISTS "Club coaches with view_all see club matches" ON public.matches;
CREATE POLICY "Club coaches with view_all see club matches" ON public.matches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = matches.team_id AND public.club_coach_sees_all(auth.uid(), t.club_id)));
