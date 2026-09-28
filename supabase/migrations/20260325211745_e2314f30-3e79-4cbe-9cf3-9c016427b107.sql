
-- Fix overly permissive policies
DROP POLICY IF EXISTS "Manage invite_template_versions" ON public.invite_template_versions;
DROP POLICY IF EXISTS "Manage invite_templates" ON public.invite_templates;

-- invite_templates: restrict write to admins/coordinators/owners
CREATE POLICY "Manage invite_templates"
  ON public.invite_templates FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR (club_id IS NOT NULL AND (is_club_admin(auth.uid(), club_id) OR is_youth_coordinator(club_id, auth.uid())))
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (club_id IS NOT NULL AND (is_club_admin(auth.uid(), club_id) OR is_youth_coordinator(club_id, auth.uid())))
  );

-- invite_template_versions: restrict write to version creator
CREATE POLICY "Manage invite_template_versions"
  ON public.invite_template_versions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update invite_template_versions"
  ON public.invite_template_versions FOR UPDATE TO authenticated
  USING (created_by = auth.uid());
