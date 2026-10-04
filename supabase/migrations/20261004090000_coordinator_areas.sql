-- More than one coordinator per club, each with an area and the teams they look after
-- (e.g. "Formação" = Sub-7…Sub-13, "Seniores", "Futsal"). A coordinator manages only
-- their teams; with no teams set, all the club's teams (as before).
ALTER TABLE public.club_staff ADD COLUMN IF NOT EXISTS coord_area text;
ALTER TABLE public.club_staff ADD COLUMN IF NOT EXISTS coord_team_ids uuid[];

-- coordinator of this team? (scope empty = all teams of the club)
CREATE OR REPLACE FUNCTION public.is_team_coordinator(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.club_staff cs ON cs.club_id = t.club_id
    WHERE t.id = _team AND cs.user_id = _user AND cs.is_active AND cs.role = 'coordenador'
      AND (cs.coord_team_ids IS NULL OR cardinality(cs.coord_team_ids) = 0 OR _team = ANY (cs.coord_team_ids))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_coordinator(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_coordinator(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_coach_team(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND _team IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = _team AND tc.coach_id = _user)
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = _team AND (
        t.owner_id = _user
        OR (t.club_id IS NOT NULL AND public.is_club_admin(_user, t.club_id))))
    OR public.is_team_coordinator(_user, _team)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team AND (t.owner_id = _user OR (t.club_id IS NOT NULL AND public.is_club_admin(_user, t.club_id)))
  ) OR public.is_team_coordinator(_user, _team)
$$;

-- club admin sets a coordinator's area and teams
CREATE OR REPLACE FUNCTION public.set_coordinator_scope(_club uuid, _user uuid, _area text, _team_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_club_admin(auth.uid(), _club) THEN
    RAISE EXCEPTION 'Só o administrador do clube define as áreas dos coordenadores' USING ERRCODE = '42501';
  END IF;
  UPDATE public.club_staff
  SET coord_area = nullif(trim(coalesce(_area, '')), ''),
      coord_team_ids = (SELECT array_agg(t.id) FROM public.teams t WHERE t.club_id = _club AND t.id = ANY (coalesce(_team_ids, '{}')))
  WHERE club_id = _club AND user_id = _user AND role = 'coordenador';
END $$;
REVOKE EXECUTE ON FUNCTION public.set_coordinator_scope(uuid, uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_coordinator_scope(uuid, uuid, text, uuid[]) TO authenticated;

-- who coordinates what (for the club's staff and coaches: names, areas, teams)
CREATE OR REPLACE FUNCTION public.get_club_coordinators(_club uuid)
RETURNS TABLE (user_id uuid, name text, area text, team_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cs.user_id, coalesce(p.display_name, p.full_name, cs.name)::text, cs.coord_area, coalesce(cs.coord_team_ids, '{}')
  FROM public.club_staff cs
  LEFT JOIN public.profiles p ON p.id = cs.user_id
  WHERE cs.club_id = _club AND cs.role = 'coordenador' AND cs.is_active
    AND (public.is_club_staff_member(_club, auth.uid()) OR public.is_club_coach(auth.uid(), _club))
  ORDER BY 2
$$;
REVOKE EXECUTE ON FUNCTION public.get_club_coordinators(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_coordinators(uuid) TO authenticated;

-- club admin can promote existing staff/coaches to coordinator (and back) without a new invite
CREATE OR REPLACE FUNCTION public.set_staff_role(_club uuid, _user uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_club_admin(auth.uid(), _club) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  IF _role NOT IN ('coordenador', 'staff') THEN RAISE EXCEPTION 'Função inválida'; END IF;
  IF _user = (SELECT owner_id FROM public.clubs WHERE id = _club) THEN RAISE EXCEPTION 'O dono do clube já é administrador'; END IF;
  INSERT INTO public.club_staff (club_id, user_id, name, role, is_active)
  SELECT _club, _user, coalesce(p.display_name, p.full_name, 'Coordenador'), _role::public.club_staff_role, true
  FROM public.profiles p WHERE p.id = _user
  ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true
  WHERE public.club_staff.role <> 'admin';
END $$;
REVOKE EXECUTE ON FUNCTION public.set_staff_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_role(uuid, uuid, text) TO authenticated;
