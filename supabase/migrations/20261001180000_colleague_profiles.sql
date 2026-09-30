-- Colleagues can see each other's name/email: people of the same club (coaches,
-- staff, owner) and coaches of the same team. Before this the club admin saw
-- "Sem nome" for every coach on the Treinadores page.
CREATE OR REPLACE FUNCTION public.can_see_colleague(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM (
        SELECT club_id FROM public.club_coaches WHERE coach_id = _target AND is_active
        UNION SELECT club_id FROM public.club_staff WHERE user_id = _target AND is_active
        UNION SELECT id FROM public.clubs WHERE owner_id = _target
      ) c
      WHERE public.is_club_staff_member(c.club_id, _viewer) OR public.is_club_coach(_viewer, c.club_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_coaches a JOIN public.team_coaches b ON a.team_id = b.team_id
      WHERE a.coach_id = _viewer AND b.coach_id = _target
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_colleague(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_colleague(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Colleagues can view profiles" ON public.profiles;
CREATE POLICY "Colleagues can view profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.can_see_colleague(auth.uid(), id));
