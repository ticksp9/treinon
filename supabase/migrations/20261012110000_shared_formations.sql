-- The technical staff of a team work with the same formations: an assistant sees the
-- formations (and their drawings) of the coaches he shares a team with. Read only —
-- each one still changes and deletes only his own.

CREATE OR REPLACE FUNCTION public.shares_team_staff(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.teams t
     WHERE (t.owner_id = _a OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = _a))
       AND (t.owner_id = _b OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = _b)))
$$;
REVOKE ALL ON FUNCTION public.shares_team_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_team_staff(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "custom_formations_team_staff_read" ON public.custom_formations;
CREATE POLICY "custom_formations_team_staff_read" ON public.custom_formations FOR SELECT TO authenticated
  USING (public.shares_team_staff(auth.uid(), owner_id));
