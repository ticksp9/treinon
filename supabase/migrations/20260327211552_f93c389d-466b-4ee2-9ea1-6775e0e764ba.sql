
-- =============================================
-- ACADEMY / YOUTH DEVELOPMENT MODULE
-- =============================================

-- 1. academy_programs
CREATE TABLE public.academy_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  season text,
  version_no integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived','under_review')),
  philosophy text,
  methodology text,
  objectives text,
  curriculum_summary text,
  safeguarding_policy text,
  review_process text,
  responsible_user_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  effective_from date,
  effective_to date,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. academy_age_groups
CREATE TABLE public.academy_age_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  min_birth_year integer,
  max_birth_year integer,
  phase text CHECK (phase IN ('foundation','development','performance','transition')),
  display_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, code)
);

-- 3. academy_player_profiles
CREATE TABLE public.academy_player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  age_group_id uuid REFERENCES public.academy_age_groups(id),
  academy_program_id uuid REFERENCES public.academy_programs(id),
  season text,
  entry_date date,
  origin text,
  previous_clubs text,
  dominant_foot text CHECK (dominant_foot IN ('left','right','both')),
  primary_position text,
  secondary_position text,
  pathway_status text NOT NULL DEFAULT 'active' CHECK (pathway_status IN ('active','under_observation','high_potential','accelerated','eligible_promotion','promoted','retained','in_transition','unavailable','released','archived')),
  safeguarding_flags text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(club_id, player_id, season)
);

-- 4. academy_player_school_records
CREATE TABLE public.academy_player_school_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season text,
  school_name text,
  school_year text,
  school_schedule text,
  academic_status text CHECK (academic_status IN ('good','acceptable','at_risk','critical','unknown')),
  observations text,
  conflict_flags text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. academy_player_wellbeing_records
CREATE TABLE public.academy_player_wellbeing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  wellbeing_status text CHECK (wellbeing_status IN ('good','monitor','concern','critical')),
  category text,
  description text,
  safeguarding_flag boolean DEFAULT false,
  reported_by uuid,
  follow_up_required boolean DEFAULT false,
  follow_up_notes text,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. academy_development_dimensions
CREATE TABLE public.academy_development_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  category text NOT NULL CHECK (category IN ('technical','tactical','physical','psychological','behavioral','social','academic')),
  description text,
  weight numeric(5,2) DEFAULT 1.0,
  display_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, code)
);

-- 7. academy_assessment_cycles
CREATE TABLE public.academy_assessment_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  academy_program_id uuid REFERENCES public.academy_programs(id),
  age_group_id uuid REFERENCES public.academy_age_groups(id),
  team_id uuid REFERENCES public.teams(id),
  name text NOT NULL,
  cycle_type text NOT NULL CHECK (cycle_type IN ('monthly','bimonthly','quarterly','semester','annual','extraordinary')),
  season text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  deadline date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','in_progress','review','published','archived')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. academy_assessments
CREATE TABLE public.academy_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.academy_assessment_cycles(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  assessor_user_id uuid,
  assessor_role text,
  overall_score numeric(5,2),
  strengths text,
  areas_to_develop text,
  perceived_potential text CHECK (perceived_potential IN ('low','moderate','high','exceptional')),
  promotion_readiness text CHECK (promotion_readiness IN ('not_ready','developing','ready','accelerate')),
  consistency text,
  attitude text,
  discipline text,
  competitive_capacity text,
  general_comments text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','validated','published')),
  submitted_at timestamptz,
  validated_by uuid,
  validated_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. academy_assessment_scores
CREATE TABLE public.academy_assessment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.academy_assessments(id) ON DELETE CASCADE,
  dimension_id uuid NOT NULL REFERENCES public.academy_development_dimensions(id),
  score numeric(5,2),
  max_score numeric(5,2) DEFAULT 10,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. academy_observations
CREATE TABLE public.academy_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  observer_user_id uuid,
  observation_date date NOT NULL DEFAULT CURRENT_DATE,
  context text CHECK (context IN ('training','match','tournament','camp','other')),
  dimension_observed text,
  content text NOT NULL,
  tags text[],
  recommendation text,
  follow_up boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. academy_development_plans
CREATE TABLE public.academy_development_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season text,
  version_no integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','under_review','completed','archived')),
  responsible_user_id uuid,
  effective_from date,
  effective_to date,
  overall_objective text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. academy_development_goals
CREATE TABLE public.academy_development_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.academy_development_plans(id) ON DELETE CASCADE,
  dimension_id uuid REFERENCES public.academy_development_dimensions(id),
  title text NOT NULL,
  description text,
  priority text CHECK (priority IN ('low','medium','high','critical')),
  target_date date,
  success_criteria text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','achieved','partially_achieved','deferred','cancelled')),
  progress_pct integer DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 13. academy_goal_reviews
CREATE TABLE public.academy_goal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.academy_development_goals(id) ON DELETE CASCADE,
  reviewer_user_id uuid,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  progress_pct integer CHECK (progress_pct >= 0 AND progress_pct <= 100),
  obstacles text,
  new_strategy text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14. academy_promotion_reviews
CREATE TABLE public.academy_promotion_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season text,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  decision text NOT NULL CHECK (decision IN ('promote','retain','release','loan_internal','under_review','defer')),
  justification text,
  evidence text,
  assessment_cycle_id uuid REFERENCES public.academy_assessment_cycles(id),
  current_age_group_id uuid REFERENCES public.academy_age_groups(id),
  target_age_group_id uuid REFERENCES public.academy_age_groups(id),
  current_team_id uuid REFERENCES public.teams(id),
  target_team_id uuid REFERENCES public.teams(id),
  risks text,
  transition_plan text,
  decided_by uuid,
  staff_involved text[],
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 15. academy_pathway_status_history
CREATE TABLE public.academy_pathway_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  reason text,
  notes text
);

-- 16. academy_staff_assignments
CREATE TABLE public.academy_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  age_group_id uuid REFERENCES public.academy_age_groups(id),
  team_id uuid REFERENCES public.teams(id),
  season text,
  qualification text,
  license_number text,
  license_valid_until date,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 17. academy_compliance_items
CREATE TABLE public.academy_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('compliant','pending','non_compliant','waived','expired')),
  due_date date,
  evidence_url text,
  responsible_user_id uuid,
  severity text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  season text,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 18. academy_audit_logs
CREATE TABLE public.academy_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_academy_programs_club ON public.academy_programs(club_id);
CREATE INDEX idx_academy_age_groups_club ON public.academy_age_groups(club_id);
CREATE INDEX idx_academy_player_profiles_club ON public.academy_player_profiles(club_id);
CREATE INDEX idx_academy_player_profiles_player ON public.academy_player_profiles(player_id);
CREATE INDEX idx_academy_player_profiles_status ON public.academy_player_profiles(pathway_status);
CREATE INDEX idx_academy_assessment_cycles_club ON public.academy_assessment_cycles(club_id);
CREATE INDEX idx_academy_assessments_cycle ON public.academy_assessments(cycle_id);
CREATE INDEX idx_academy_assessments_player ON public.academy_assessments(player_id);
CREATE INDEX idx_academy_observations_player ON public.academy_observations(player_id);
CREATE INDEX idx_academy_dev_plans_player ON public.academy_development_plans(player_id);
CREATE INDEX idx_academy_promotion_reviews_player ON public.academy_promotion_reviews(player_id);
CREATE INDEX idx_academy_pathway_history_player ON public.academy_pathway_status_history(player_id);
CREATE INDEX idx_academy_staff_assignments_club ON public.academy_staff_assignments(club_id);
CREATE INDEX idx_academy_compliance_club ON public.academy_compliance_items(club_id);
CREATE INDEX idx_academy_audit_club ON public.academy_audit_logs(club_id);
CREATE INDEX idx_academy_school_records_player ON public.academy_player_school_records(player_id);
CREATE INDEX idx_academy_wellbeing_player ON public.academy_player_wellbeing_records(player_id);

-- RLS
ALTER TABLE public.academy_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_age_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_player_school_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_player_wellbeing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_development_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_assessment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_development_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_goal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_promotion_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_pathway_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - club staff can manage
CREATE POLICY "Club staff manage academy_programs" ON public.academy_programs FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_age_groups" ON public.academy_age_groups FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_player_profiles" ON public.academy_player_profiles FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_school_records" ON public.academy_player_school_records FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_wellbeing" ON public.academy_player_wellbeing_records FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_dimensions" ON public.academy_development_dimensions FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_cycles" ON public.academy_assessment_cycles FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_assessments" ON public.academy_assessments FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_scores" ON public.academy_assessment_scores FOR ALL USING (
  EXISTS (SELECT 1 FROM public.academy_assessments a WHERE a.id = assessment_id AND public.is_club_staff_member(a.club_id, auth.uid()))
);
CREATE POLICY "Club staff manage academy_observations" ON public.academy_observations FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_dev_plans" ON public.academy_development_plans FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_goals" ON public.academy_development_goals FOR ALL USING (
  EXISTS (SELECT 1 FROM public.academy_development_plans p WHERE p.id = plan_id AND public.is_club_staff_member(p.club_id, auth.uid()))
);
CREATE POLICY "Club staff manage academy_goal_reviews" ON public.academy_goal_reviews FOR ALL USING (
  EXISTS (SELECT 1 FROM public.academy_development_goals g JOIN public.academy_development_plans p ON p.id = g.plan_id WHERE g.id = goal_id AND public.is_club_staff_member(p.club_id, auth.uid()))
);
CREATE POLICY "Club staff manage academy_promotions" ON public.academy_promotion_reviews FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_pathway_history" ON public.academy_pathway_status_history FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_staff" ON public.academy_staff_assignments FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff manage academy_compliance" ON public.academy_compliance_items FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff read academy_audit" ON public.academy_audit_logs FOR SELECT USING (public.is_club_staff_member(club_id, auth.uid()));
CREATE POLICY "Club staff insert academy_audit" ON public.academy_audit_logs FOR INSERT WITH CHECK (public.is_club_staff_member(club_id, auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_academy_programs BEFORE UPDATE ON public.academy_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_age_groups BEFORE UPDATE ON public.academy_age_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_player_profiles BEFORE UPDATE ON public.academy_player_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_school_records BEFORE UPDATE ON public.academy_player_school_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_wellbeing BEFORE UPDATE ON public.academy_player_wellbeing_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_cycles BEFORE UPDATE ON public.academy_assessment_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_assessments BEFORE UPDATE ON public.academy_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_observations BEFORE UPDATE ON public.academy_observations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_dev_plans BEFORE UPDATE ON public.academy_development_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_goals BEFORE UPDATE ON public.academy_development_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_promotions BEFORE UPDATE ON public.academy_promotion_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_staff BEFORE UPDATE ON public.academy_staff_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_academy_compliance BEFORE UPDATE ON public.academy_compliance_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
