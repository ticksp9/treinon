
-- 1. Fix self-referencing club_id bug in 4 policies
DROP POLICY IF EXISTS ar_select ON public.attendance_requests;
CREATE POLICY ar_select ON public.attendance_requests FOR SELECT TO authenticated USING (
  (created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = attendance_requests.club_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = attendance_requests.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
  OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = attendance_requests.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
  OR EXISTS (SELECT 1 FROM public.attendance_responses ar WHERE ar.request_id = attendance_requests.id AND ar.user_id = auth.uid())
);

DROP POLICY IF EXISTS attach_select ON public.communication_attachments;
CREATE POLICY attach_select ON public.communication_attachments FOR SELECT TO authenticated USING (
  (uploaded_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = communication_attachments.club_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = communication_attachments.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
  OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = communication_attachments.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
  OR (message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.communication_messages m
    JOIN public.communication_channel_members cm ON cm.channel_id = m.channel_id
    WHERE m.id = communication_attachments.message_id AND cm.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS automation_select ON public.communication_automation_rules;
CREATE POLICY automation_select ON public.communication_automation_rules FOR SELECT TO authenticated USING (
  (created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = communication_automation_rules.club_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = communication_automation_rules.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
);

DROP POLICY IF EXISTS templates_select ON public.communication_templates;
CREATE POLICY templates_select ON public.communication_templates FOR SELECT TO authenticated USING (
  (created_by = auth.uid())
  OR (scope = 'club' AND (
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = communication_templates.club_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = communication_templates.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
    OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = communication_templates.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
  ))
);

-- 2. Restrict match_report_versions / edits / audit_logs SELECT to club staff/coaches/owners
DROP POLICY IF EXISTS "Authenticated users can view report versions" ON public.match_report_versions;
CREATE POLICY "Club members can view report versions" ON public.match_report_versions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.match_reports mr
    WHERE mr.id = match_report_versions.match_report_id
      AND (
        mr.created_by = auth.uid()
        OR public.is_club_staff_member(mr.club_id, auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = mr.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
      )
  )
);

DROP POLICY IF EXISTS "Authenticated users can view report edits" ON public.match_report_edits;
CREATE POLICY "Club members can view report edits" ON public.match_report_edits FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.match_reports mr
    WHERE mr.id = match_report_edits.match_report_id
      AND (
        mr.created_by = auth.uid()
        OR public.is_club_staff_member(mr.club_id, auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = mr.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
      )
  )
);

DROP POLICY IF EXISTS "Authenticated users can view report audit logs" ON public.match_report_audit_logs;
CREATE POLICY "Club members can view report audit logs" ON public.match_report_audit_logs FOR SELECT TO authenticated USING (
  public.is_club_staff_member(match_report_audit_logs.club_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = match_report_audit_logs.club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
);

-- 3. Storage: remove overly broad payment-proofs read policy
DROP POLICY IF EXISTS "Club admins can view payment proofs" ON storage.objects;

-- 4. Storage: tighten communication-attachments SELECT to channel members / uploaders
DROP POLICY IF EXISTS comm_attach_select ON storage.objects;
CREATE POLICY comm_attach_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'communication-attachments'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.communication_attachments ca
      LEFT JOIN public.communication_messages m ON m.id = ca.message_id
      LEFT JOIN public.communication_channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = auth.uid()
      WHERE position(storage.objects.name in coalesce(ca.file_url, '')) > 0
        AND (ca.uploaded_by = auth.uid() OR cm.user_id IS NOT NULL OR public.is_club_staff_member(ca.club_id, auth.uid()))
    )
  )
);

-- 5. Update is_club_admin to include staff admins (mirror is_club_staff_admin)
CREATE OR REPLACE FUNCTION public.is_club_admin(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = _club_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id AND user_id = _user_id AND role = 'admin' AND is_active = true
  )
$$;
