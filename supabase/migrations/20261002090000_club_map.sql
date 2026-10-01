-- Club map for the sports coordinator: the weekly training timetable of every team
-- (seniors to youth) and the match map of each weekend, with logistics. Coaches of
-- the club read it; the coordinator / club admin (or the owner of a team) edits it.

-- ─── Coordinator invites ────────────────────────────────────────────────────
ALTER TABLE public.access_invites DROP CONSTRAINT IF EXISTS access_invites_invite_type_check;
ALTER TABLE public.access_invites
  ADD CONSTRAINT access_invites_invite_type_check
  CHECK (invite_type IN ('guardian', 'player', 'coach', 'assistant_coach', 'staff', 'coordinator'));

-- ─── Weekly training slots ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_training_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- 1 = Monday … 7 = Sunday
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS team_training_slots_team_idx ON public.team_training_slots(team_id);
ALTER TABLE public.team_training_slots ENABLE ROW LEVEL SECURITY;

-- anyone of the club (staff or coach) and the team's own staff can read the map
CREATE OR REPLACE FUNCTION public.can_see_team_schedule(_user uuid, _team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_coach_team(_user, _team) OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team AND t.club_id IS NOT NULL
      AND (public.is_club_staff_member(t.club_id, _user) OR public.is_club_coach(_user, t.club_id)))
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_team_schedule(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_team_schedule(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Club members read training slots" ON public.team_training_slots;
CREATE POLICY "Club members read training slots" ON public.team_training_slots FOR SELECT TO authenticated
  USING (public.can_see_team_schedule(auth.uid(), team_id));
DROP POLICY IF EXISTS "Managers write training slots" ON public.team_training_slots;
CREATE POLICY "Managers write training slots" ON public.team_training_slots FOR ALL TO authenticated
  USING (public.is_team_manager(auth.uid(), team_id))
  WITH CHECK (public.is_team_manager(auth.uid(), team_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_training_slots TO authenticated;

-- ─── Match logistics ────────────────────────────────────────────────────────
-- { meet_time: "09:15", meet_place: "Sede", transport: "Carrinha", kit: "Equipamento azul", info: "…" }
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS logistics jsonb;

-- every coach and staff member of the club sees the whole club's fixtures (no player data)
CREATE OR REPLACE FUNCTION public.get_club_match_map(_club uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (
  id uuid, team_id uuid, team_name text, team_category text, match_date timestamptz, opponent_name text,
  is_home boolean, location text, competition text, match_type text, status text,
  goals_for int, goals_against int, logistics jsonb, notes text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.team_id, t.name::text, t.category::text, m.match_date::timestamptz, m.opponent_name::text, m.is_home, m.location::text,
         m.competition::text, m.match_type::text, m.status::text, m.goals_for::int, m.goals_against::int, m.logistics, m.notes
  FROM public.matches m JOIN public.teams t ON t.id = m.team_id
  WHERE t.club_id = _club
    AND (public.is_club_staff_member(_club, auth.uid()) OR public.is_club_coach(auth.uid(), _club))
    AND NOT coalesce(m.is_deleted, false) AND NOT coalesce(m.is_test, false)
    AND m.match_date >= _from AND m.match_date < _to
  ORDER BY m.match_date
$$;
REVOKE EXECUTE ON FUNCTION public.get_club_match_map(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_match_map(uuid, timestamptz, timestamptz) TO authenticated;

-- club coaches can list the club's teams by name (for the map), not their players
CREATE OR REPLACE FUNCTION public.get_club_teams(_club uuid)
RETURNS TABLE (id uuid, name text, category text, sport_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name::text, t.category::text, t.sport_type::text
  FROM public.teams t
  WHERE t.club_id = _club
    AND (public.is_club_staff_member(_club, auth.uid()) OR public.is_club_coach(auth.uid(), _club))
  ORDER BY t.name
$$;
REVOKE EXECUTE ON FUNCTION public.get_club_teams(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_teams(uuid) TO authenticated;
