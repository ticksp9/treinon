
-- =============================================
-- SCOUTING & TALENT PIPELINE MODULE
-- =============================================

-- Prospect profiles (external players being scouted)
CREATE TABLE public.prospect_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date,
  nationality text,
  locality text,
  primary_position text,
  secondary_position text,
  dominant_foot text,
  height_cm numeric,
  weight_kg numeric,
  current_club_name text,
  current_team_level text,
  birth_quarter smallint,
  maturity_context text,
  is_late_developer boolean DEFAULT false,
  source text DEFAULT 'manual',
  source_detail text,
  guardian_name text,
  guardian_contact text,
  safeguarding_notes text,
  school_info text,
  video_links text[],
  tags text[],
  pipeline_status text NOT NULL DEFAULT 'identified',
  priority text DEFAULT 'medium',
  confidence_score numeric,
  season text,
  linked_player_id uuid REFERENCES public.players(id),
  status text NOT NULL DEFAULT 'active',
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_prospect_profiles_club ON public.prospect_profiles(club_id);
CREATE INDEX idx_prospect_profiles_status ON public.prospect_profiles(club_id, status, pipeline_status);
CREATE INDEX idx_prospect_profiles_position ON public.prospect_profiles(club_id, primary_position);

-- Scouting observations
CREATE TABLE public.scouting_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospect_profiles(id) ON DELETE CASCADE,
  scout_user_id uuid,
  observation_type text NOT NULL DEFAULT 'match',
  observation_date date NOT NULL DEFAULT CURRENT_DATE,
  competition_name text,
  match_context text,
  venue text,
  minutes_observed integer,
  position_observed text,
  competition_level text,
  technical_notes text,
  tactical_notes text,
  physical_notes text,
  mental_notes text,
  behavioral_notes text,
  strengths text,
  weaknesses text,
  risks text,
  fit_with_club text,
  recommendation text DEFAULT 'monitor',
  confidence_level text DEFAULT 'medium',
  next_action text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scouting_obs_prospect ON public.scouting_observations(prospect_id);
CREATE INDEX idx_scouting_obs_club ON public.scouting_observations(club_id);

-- Scouting report scores (structured assessment per observation)
CREATE TABLE public.scouting_report_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES public.scouting_observations(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  score numeric,
  max_score numeric DEFAULT 10,
  weight numeric DEFAULT 1,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_scores_obs ON public.scouting_report_scores(observation_id);

-- Watchlists
CREATE TABLE public.scouting_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  watchlist_type text DEFAULT 'general',
  season text,
  position_filter text,
  age_group_filter text,
  region_filter text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_watchlists_club ON public.scouting_watchlists(club_id);

-- Watchlist entries
CREATE TABLE public.scouting_watchlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.scouting_watchlists(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospect_profiles(id) ON DELETE CASCADE,
  priority text DEFAULT 'medium',
  reason text,
  added_by uuid,
  last_observation_date date,
  next_action text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(watchlist_id, prospect_id)
);

-- Shortlists
CREATE TABLE public.scouting_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_position text,
  target_team_id uuid REFERENCES public.teams(id),
  target_age_group text,
  recruitment_need text,
  urgency text DEFAULT 'medium',
  season text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shortlists_club ON public.scouting_shortlists(club_id);

-- Shortlist entries
CREATE TABLE public.scouting_shortlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES public.scouting_shortlists(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospect_profiles(id) ON DELETE CASCADE,
  ranking integer,
  priority text DEFAULT 'medium',
  reason text,
  risk_assessment text,
  added_by uuid,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shortlist_id, prospect_id)
);

-- Recruitment needs
CREATE TABLE public.recruitment_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id),
  position text NOT NULL,
  profile_description text,
  urgency text DEFAULT 'medium',
  priority text DEFAULT 'medium',
  reason text,
  budget_estimate numeric,
  target_window text,
  season text,
  age_range_min integer,
  age_range_max integer,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recruitment_needs_club ON public.recruitment_needs(club_id);

-- Recruitment pipeline entries (tracks prospect through stages)
CREATE TABLE public.recruitment_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospect_profiles(id) ON DELETE CASCADE,
  recruitment_need_id uuid REFERENCES public.recruitment_needs(id),
  current_stage text NOT NULL DEFAULT 'identified',
  previous_stage text,
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  assigned_scout_id uuid,
  decision text,
  decision_by uuid,
  decision_date timestamptz,
  decision_justification text,
  blockers text,
  next_step text,
  deadline date,
  risk_level text DEFAULT 'low',
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_club ON public.recruitment_pipeline(club_id);
CREATE INDEX idx_pipeline_prospect ON public.recruitment_pipeline(prospect_id);
CREATE INDEX idx_pipeline_stage ON public.recruitment_pipeline(club_id, current_stage);

-- Prospect trials
CREATE TABLE public.prospect_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospect_profiles(id) ON DELETE CASCADE,
  trial_date date NOT NULL,
  trial_type text DEFAULT 'training',
  venue text,
  team_id uuid REFERENCES public.teams(id),
  observers text[],
  consent_obtained boolean DEFAULT false,
  status text NOT NULL DEFAULT 'scheduled',
  feedback text,
  outcome text,
  decided_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trials_club ON public.prospect_trials(club_id);

-- Prospect status history
CREATE TABLE public.prospect_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospect_profiles(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  previous_pipeline_stage text,
  new_pipeline_stage text,
  changed_by uuid,
  reason text,
  notes text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_history ON public.prospect_status_history(prospect_id);

-- Scouting audit logs
CREATE TABLE public.scouting_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_role text,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scouting_audit_club ON public.scouting_audit_logs(club_id);
CREATE INDEX idx_scouting_audit_entity ON public.scouting_audit_logs(entity_type, entity_id);

-- updated_at triggers
CREATE TRIGGER set_prospect_profiles_updated_at BEFORE UPDATE ON public.prospect_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_scouting_observations_updated_at BEFORE UPDATE ON public.scouting_observations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_scouting_watchlists_updated_at BEFORE UPDATE ON public.scouting_watchlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_scouting_watchlist_entries_updated_at BEFORE UPDATE ON public.scouting_watchlist_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_scouting_shortlists_updated_at BEFORE UPDATE ON public.scouting_shortlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_scouting_shortlist_entries_updated_at BEFORE UPDATE ON public.scouting_shortlist_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_recruitment_needs_updated_at BEFORE UPDATE ON public.recruitment_needs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_recruitment_pipeline_updated_at BEFORE UPDATE ON public.recruitment_pipeline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_prospect_trials_updated_at BEFORE UPDATE ON public.prospect_trials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.prospect_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting_report_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting_watchlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting_shortlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies using is_club_staff_member for all scouting tables
CREATE POLICY "Club staff can manage prospect_profiles" ON public.prospect_profiles FOR ALL TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can manage scouting_observations" ON public.scouting_observations FOR ALL TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can manage scouting_report_scores" ON public.scouting_report_scores FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.scouting_observations o WHERE o.id = observation_id AND public.is_club_staff_member(o.club_id, auth.uid())));
CREATE POLICY "Club staff can manage scouting_watchlists" ON public.scouting_watchlists FOR ALL TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can manage scouting_watchlist_entries" ON public.scouting_watchlist_entries FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.scouting_watchlists w WHERE w.id = watchlist_id AND public.is_club_staff_member(w.club_id, auth.uid())));
CREATE POLICY "Club staff can manage scouting_shortlists" ON public.scouting_shortlists FOR ALL TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can manage scouting_shortlist_entries" ON public.scouting_shortlist_entries FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.scouting_shortlists s WHERE s.id = shortlist_id AND public.is_club_staff_member(s.club_id, auth.uid())));
CREATE POLICY "Club staff can manage recruitment_needs" ON public.recruitment_needs FOR ALL TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can manage recruitment_pipeline" ON public.recruitment_pipeline FOR ALL TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can manage prospect_trials" ON public.prospect_trials FOR ALL TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can view prospect_status_history" ON public.prospect_status_history FOR SELECT TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can insert prospect_status_history" ON public.prospect_status_history FOR INSERT TO authenticated WITH CHECK (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can view scouting_audit_logs" ON public.scouting_audit_logs FOR SELECT TO authenticated USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff can insert scouting_audit_logs" ON public.scouting_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_club_staff_member(club_id, auth.uid()));
