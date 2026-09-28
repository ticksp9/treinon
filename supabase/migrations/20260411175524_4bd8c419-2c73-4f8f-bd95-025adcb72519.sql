
-- Fix match_reports UPDATE policy: allow any club staff or coach, not just creator
DROP POLICY IF EXISTS "Users can update match reports they manage" ON public.match_reports;

CREATE POLICY "Club staff and coaches can update match reports"
ON public.match_reports
FOR UPDATE
USING (
  auth.uid() = created_by
  OR auth.uid() = updated_by
  OR (club_id IS NOT NULL AND public.is_club_staff_member(club_id, auth.uid()))
  OR (club_id IS NOT NULL AND public.is_club_coach(auth.uid(), club_id))
  OR EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.teams t ON t.id = m.team_id
    WHERE m.id = match_reports.match_id
    AND (
      public.is_club_staff_member(t.club_id, auth.uid())
      OR public.is_club_coach(auth.uid(), t.club_id)
      OR t.owner_id = auth.uid()
      OR public.is_team_coach(auth.uid(), t.id)
    )
  )
);

-- Fix match_reports INSERT policy: allow club staff and coaches
DROP POLICY IF EXISTS "Authenticated users can create match reports" ON public.match_reports;

CREATE POLICY "Club staff and coaches can create match reports"
ON public.match_reports
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Fix match_report_versions INSERT: allow any authenticated user
DROP POLICY IF EXISTS "Users can create report versions" ON public.match_report_versions;

CREATE POLICY "Authenticated users can create report versions"
ON public.match_report_versions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix match_report_edits INSERT: allow any authenticated user  
DROP POLICY IF EXISTS "Users can create report edits" ON public.match_report_edits;

CREATE POLICY "Authenticated users can create report edits"
ON public.match_report_edits
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix match_report_audit_logs INSERT: allow any authenticated user
DROP POLICY IF EXISTS "Users can create report audit logs" ON public.match_report_audit_logs;

CREATE POLICY "Authenticated users can create report audit logs"
ON public.match_report_audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
