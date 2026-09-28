
-- Fix overly permissive RLS policies

-- match_report_versions: tighten INSERT
DROP POLICY IF EXISTS "Authenticated users can create report versions" ON public.match_report_versions;
CREATE POLICY "Users can create report versions"
  ON public.match_report_versions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- match_report_edits: tighten INSERT
DROP POLICY IF EXISTS "Authenticated users can create report edits" ON public.match_report_edits;
CREATE POLICY "Users can create report edits"
  ON public.match_report_edits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- match_report_audit_logs: tighten INSERT
DROP POLICY IF EXISTS "Authenticated users can create report audit logs" ON public.match_report_audit_logs;
CREATE POLICY "Users can create report audit logs"
  ON public.match_report_audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- match_reports: tighten UPDATE
DROP POLICY IF EXISTS "Authenticated users can update their match reports" ON public.match_reports;
CREATE POLICY "Users can update match reports they manage"
  ON public.match_reports FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = updated_by);
