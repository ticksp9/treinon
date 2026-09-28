
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Fixes: guardian/player data access, buggy RLS, missing policies
-- ============================================================

-- 1. Fix buggy communication_channels SELECT policy (m.channel_id = m.id should be m.channel_id = communication_channels.id)
DROP POLICY IF EXISTS "Members can view their channels" ON public.communication_channels;
CREATE POLICY "Members can view their channels"
  ON public.communication_channels FOR SELECT TO authenticated
  USING (
    is_club_admin(auth.uid(), club_id)
    OR is_youth_coordinator(club_id, auth.uid())
    OR is_channel_member(id, auth.uid())
  );

-- 2. Fix buggy announcements SELECT policy (r.announcement_id = r.id should reference announcements.id)
DROP POLICY IF EXISTS "Club members can view announcements" ON public.communication_announcements;
CREATE POLICY "Club members can view announcements"
  ON public.communication_announcements FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR is_club_admin(auth.uid(), club_id)
    OR is_youth_coordinator(club_id, auth.uid())
    OR is_club_coach(auth.uid(), club_id)
    OR is_club_staff_member(club_id, auth.uid())
    OR (channel_id IS NOT NULL AND is_channel_member(channel_id, auth.uid()))
    OR EXISTS (
      SELECT 1 FROM communication_announcement_reads r
      WHERE r.announcement_id = communication_announcements.id AND r.user_id = auth.uid()
    )
  );

-- 3. Allow individual coaches to create channels (fix INSERT policy for club_id IS NULL)
DROP POLICY IF EXISTS "Admins and coordinators can create channels" ON public.communication_channels;
CREATE POLICY "Staff can create channels"
  ON public.communication_channels FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      -- Club mode
      (club_id IS NOT NULL AND (
        is_club_admin(auth.uid(), club_id)
        OR is_youth_coordinator(club_id, auth.uid())
        OR is_club_coach(auth.uid(), club_id)
        OR is_team_coach(auth.uid(), COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid))
      ))
      -- Individual coach mode (no club)
      OR (club_id IS NULL AND owner_id = auth.uid())
    )
  );

-- Remove the duplicate overly-permissive INSERT policy
DROP POLICY IF EXISTS "Authorized users can create channels" ON public.communication_channels;

-- 4. Allow individual coaches to create announcements (club_id IS NULL)
DROP POLICY IF EXISTS "Admins coordinators coaches can create announcements" ON public.communication_announcements;
CREATE POLICY "Staff can create announcements"
  ON public.communication_announcements FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (club_id IS NOT NULL AND (
        is_club_admin(auth.uid(), club_id)
        OR is_youth_coordinator(club_id, auth.uid())
        OR is_club_coach(auth.uid(), club_id)
      ))
      OR (club_id IS NULL)
    )
  );

-- 5. Add guardian SELECT on players (guardians need to see their linked players)
CREATE POLICY "Guardians can view linked players"
  ON public.players FOR SELECT TO authenticated
  USING (
    is_guardian_of_player(auth.uid(), id)
  );

-- 6. Add player SELECT on players (players can see themselves)
CREATE POLICY "Players can view own record"
  ON public.players FOR SELECT TO authenticated
  USING (
    id = public.get_player_account_id(auth.uid())
  );

-- 7. Add guardian SELECT on matches (via team of linked players)
CREATE POLICY "Guardians can view team matches"
  ON public.matches FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT public.get_guardian_team_ids(auth.uid()))
  );

-- 8. Add player SELECT on matches
CREATE POLICY "Players can view own team matches"
  ON public.matches FOR SELECT TO authenticated
  USING (
    team_id = (SELECT p.team_id FROM public.players p WHERE p.id = public.get_player_account_id(auth.uid()))
  );

-- 9. Add guardian SELECT on coach_trainings
CREATE POLICY "Guardians can view team trainings"
  ON public.coach_trainings FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT public.get_guardian_team_ids(auth.uid()))
  );

-- 10. Add player SELECT on coach_trainings
CREATE POLICY "Players can view own team trainings"
  ON public.coach_trainings FOR SELECT TO authenticated
  USING (
    team_id = (SELECT p.team_id FROM public.players p WHERE p.id = public.get_player_account_id(auth.uid()))
  );

-- 11. Add guardian SELECT on match_lineups (for their players only)
CREATE POLICY "Guardians can view linked player lineups"
  ON public.match_lineups FOR SELECT TO authenticated
  USING (
    is_guardian_of_player(auth.uid(), player_id)
  );

-- 12. Add player SELECT on match_lineups (own lineups)
CREATE POLICY "Players can view own lineups"
  ON public.match_lineups FOR SELECT TO authenticated
  USING (
    player_id = public.get_player_account_id(auth.uid())
  );

-- 13. Add guardian SELECT on callup_confirmations (for their players)
-- Already exists via "Guardians manage callup confirmations" policy

-- 14. Club staff can view matches of club teams
CREATE POLICY "Club staff can view club matches"
  ON public.matches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = matches.team_id
      AND t.club_id IS NOT NULL
      AND is_club_staff_member(t.club_id, auth.uid())
    )
  );

-- 15. Club staff can view club trainings
CREATE POLICY "Club staff can view club trainings"
  ON public.coach_trainings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = coach_trainings.team_id
      AND t.club_id IS NOT NULL
      AND is_club_staff_member(t.club_id, auth.uid())
    )
  );
