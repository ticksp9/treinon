
-- Add report_entry_mode and report_status to matches table
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS report_entry_mode text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS report_status text NOT NULL DEFAULT 'draft';

-- Create match_reports table
CREATE TABLE public.match_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  report_entry_mode text NOT NULL DEFAULT 'live',
  report_status text NOT NULL DEFAULT 'draft',
  started_at timestamptz,
  ended_at timestamptz,
  finalized_at timestamptz,
  reopened_at timestamptz,
  finalized_by uuid,
  reopened_by uuid,
  current_version_no integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_reports_entry_mode_check CHECK (report_entry_mode IN ('live', 'post_game', 'hybrid')),
  CONSTRAINT match_reports_status_check CHECK (report_status IN ('draft', 'in_progress', 'pending_completion', 'pending_review', 'finalized', 'reopened', 'corrected', 'locked'))
);

ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view match reports"
  ON public.match_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create match reports"
  ON public.match_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update their match reports"
  ON public.match_reports FOR UPDATE TO authenticated USING (true);

-- Create match_report_versions table
CREATE TABLE public.match_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_report_id uuid NOT NULL REFERENCES public.match_reports(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view report versions"
  ON public.match_report_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create report versions"
  ON public.match_report_versions FOR INSERT TO authenticated WITH CHECK (true);

-- Create match_report_edits table
CREATE TABLE public.match_report_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_report_id uuid NOT NULL REFERENCES public.match_reports(id) ON DELETE CASCADE,
  version_from integer,
  version_to integer,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_reason text,
  diff_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.match_report_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view report edits"
  ON public.match_report_edits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create report edits"
  ON public.match_report_edits FOR INSERT TO authenticated WITH CHECK (true);

-- Create match_report_audit_logs table
CREATE TABLE public.match_report_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  club_id uuid,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  match_report_id uuid REFERENCES public.match_reports(id) ON DELETE CASCADE,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_report_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view report audit logs"
  ON public.match_report_audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create report audit logs"
  ON public.match_report_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Add updated_at trigger to match_reports
CREATE TRIGGER update_match_reports_updated_at
  BEFORE UPDATE ON public.match_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create unique index on match_reports.match_id
CREATE UNIQUE INDEX idx_match_reports_match_id ON public.match_reports(match_id);

-- Create index for audit logs
CREATE INDEX idx_match_report_audit_logs_match ON public.match_report_audit_logs(match_id);
CREATE INDEX idx_match_report_audit_logs_report ON public.match_report_audit_logs(match_report_id);
