-- The teams a coach works with (owner, head coach or assistant), with the club name,
-- so the app can ask "which team are you working with?" and keep clubs apart.
CREATE OR REPLACE FUNCTION public.get_my_teams()
RETURNS TABLE (id uuid, name text, category text, sport_type text, club_id uuid, club_name text, my_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name::text, t.category::text, t.sport_type::text, t.club_id, c.name::text,
         CASE WHEN tc.role = 'assistant_coach' AND t.owner_id <> auth.uid() THEN 'assistant_coach'
              WHEN tc.coach_id IS NOT NULL THEN coalesce(tc.role, 'head_coach')
              ELSE 'owner' END
  FROM public.teams t
  LEFT JOIN public.clubs c ON c.id = t.club_id
  LEFT JOIN public.team_coaches tc ON tc.team_id = t.id AND tc.coach_id = auth.uid()
  WHERE t.owner_id = auth.uid() OR tc.coach_id IS NOT NULL
  ORDER BY c.name NULLS LAST, t.name
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_teams() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_teams() TO authenticated;
