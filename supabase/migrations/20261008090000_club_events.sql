-- Club / team events that are not matches or trainings (dinners, activities, meetings),
-- so parents and players see everything that is coming up in one place.
--   team_id set              -> that team
--   team_id null, club_id set -> the whole club
--   both null                -> every team of the coach who created it (coach without a club)

CREATE TABLE IF NOT EXISTS public.club_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  kind text NOT NULL DEFAULT 'social' CHECK (kind IN ('social', 'activity', 'meeting', 'tournament', 'other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text CHECK (location IS NULL OR char_length(location) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_events_team_idx ON public.club_events (team_id, starts_at);
CREATE INDEX IF NOT EXISTS club_events_club_idx ON public.club_events (club_id, starts_at);
CREATE INDEX IF NOT EXISTS club_events_owner_idx ON public.club_events (owner_id, starts_at);

-- the teams a parent or a player belongs to
CREATE OR REPLACE FUNCTION public.family_team_ids(_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.team_id FROM public.players p
    JOIN public.player_guardians pg ON pg.player_id = p.id
    JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
   WHERE gp.user_id = _user AND p.team_id IS NOT NULL
  UNION
  SELECT p.team_id FROM public.players p
    JOIN public.player_accounts pa ON pa.player_id = p.id
   WHERE pa.user_id = _user AND p.team_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.family_team_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_team_ids(uuid) TO authenticated;

-- for the family screen: my children / me, with team and club
CREATE OR REPLACE FUNCTION public.my_family_teams()
RETURNS TABLE (team_id uuid, team_name text, club_id uuid, player_id uuid, player_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name::text, t.club_id, p.id, p.name::text
    FROM public.players p JOIN public.teams t ON t.id = p.team_id
   WHERE p.id IN (
           SELECT pg.player_id FROM public.player_guardians pg
             JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
            WHERE gp.user_id = auth.uid())
      OR p.id IN (SELECT pa.player_id FROM public.player_accounts pa WHERE pa.user_id = auth.uid())
   ORDER BY p.name
$$;
REVOKE ALL ON FUNCTION public.my_family_teams() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_family_teams() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_see_club_event(_user uuid, _owner uuid, _club uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (
    _owner = _user
    OR (_team IS NOT NULL AND (
          public.can_coach_team(_user, _team)
          OR _team IN (SELECT public.family_team_ids(_user))))
    OR (_team IS NULL AND _club IS NOT NULL AND (
          public.is_club_admin(_user, _club)
          OR public.is_club_coach(_user, _club)
          OR public.is_club_staff_member(_club, _user)
          OR EXISTS (SELECT 1 FROM public.teams t
                      WHERE t.club_id = _club
                        AND (t.id IN (SELECT public.family_team_ids(_user))
                             OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = _user)))))
    OR (_team IS NULL AND _club IS NULL AND EXISTS (
          SELECT 1 FROM public.teams t
           WHERE t.owner_id = _owner AND t.club_id IS NULL
             AND (t.id IN (SELECT public.family_team_ids(_user)) OR public.can_coach_team(_user, t.id))))
  )
$$;
REVOKE ALL ON FUNCTION public.can_see_club_event(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_club_event(uuid, uuid, uuid, uuid) TO authenticated;

-- who may publish: a team's coaches for their team, admin/coordinator for the whole club,
-- any coach for his own teams
CREATE OR REPLACE FUNCTION public.can_publish_club_event(_user uuid, _club uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND CASE
    WHEN _team IS NOT NULL THEN
      public.can_coach_team(_user, _team)
      AND (SELECT t.club_id FROM public.teams t WHERE t.id = _team) IS NOT DISTINCT FROM _club
    WHEN _club IS NOT NULL THEN
      public.is_club_admin(_user, _club) OR public.is_youth_coordinator(_club, _user)
    ELSE true
  END
$$;
REVOKE ALL ON FUNCTION public.can_publish_club_event(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_publish_club_event(uuid, uuid, uuid) TO authenticated;

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_events_select" ON public.club_events;
CREATE POLICY "club_events_select" ON public.club_events FOR SELECT TO authenticated
  USING (public.can_see_club_event(auth.uid(), owner_id, club_id, team_id));

DROP POLICY IF EXISTS "club_events_insert" ON public.club_events;
CREATE POLICY "club_events_insert" ON public.club_events FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.can_publish_club_event(auth.uid(), club_id, team_id));

DROP POLICY IF EXISTS "club_events_update" ON public.club_events;
CREATE POLICY "club_events_update" ON public.club_events FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR (club_id IS NOT NULL AND public.is_club_admin(auth.uid(), club_id)))
  WITH CHECK (public.can_publish_club_event(auth.uid(), club_id, team_id));

DROP POLICY IF EXISTS "club_events_delete" ON public.club_events;
CREATE POLICY "club_events_delete" ON public.club_events FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR (club_id IS NOT NULL AND public.is_club_admin(auth.uid(), club_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_events TO authenticated;

DROP TRIGGER IF EXISTS update_club_events_updated_at ON public.club_events;
CREATE TRIGGER update_club_events_updated_at BEFORE UPDATE ON public.club_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
