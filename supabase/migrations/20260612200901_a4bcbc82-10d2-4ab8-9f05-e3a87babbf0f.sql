
DROP POLICY IF EXISTS "System inserts notifications" ON public.communication_notifications;
CREATE POLICY "Service role inserts notifications"
ON public.communication_notifications
FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read active templates" ON public.invite_templates;

DROP POLICY IF EXISTS "Authenticated users can view match reports" ON public.match_reports;
CREATE POLICY "Club members can view match reports"
ON public.match_reports
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_club_staff_member(club_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_coaches cc
    WHERE cc.club_id = match_reports.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
);

DROP POLICY IF EXISTS "Authenticated users can create report versions" ON public.match_report_versions;
CREATE POLICY "Club members can create report versions"
ON public.match_report_versions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.match_reports mr
    WHERE mr.id = match_report_versions.match_report_id
      AND (mr.created_by = auth.uid()
        OR public.is_club_staff_member(mr.club_id, auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_coaches cc
          WHERE cc.club_id = mr.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)))
);

DROP POLICY IF EXISTS "Authenticated users can create report edits" ON public.match_report_edits;
CREATE POLICY "Club members can create report edits"
ON public.match_report_edits
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.match_reports mr
    WHERE mr.id = match_report_edits.match_report_id
      AND (mr.created_by = auth.uid()
        OR public.is_club_staff_member(mr.club_id, auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_coaches cc
          WHERE cc.club_id = mr.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)))
);

DROP POLICY IF EXISTS "Authenticated users can create report audit logs" ON public.match_report_audit_logs;
CREATE POLICY "Club members can create report audit logs"
ON public.match_report_audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  (actor_id IS NULL OR actor_id = auth.uid())
  AND (
    public.is_club_staff_member(club_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_coaches cc
      WHERE cc.club_id = match_report_audit_logs.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
  )
);

DROP POLICY IF EXISTS "Club admins read payment proofs" ON storage.objects;
