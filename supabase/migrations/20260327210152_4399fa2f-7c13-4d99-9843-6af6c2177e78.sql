
-- =====================================================
-- MEDICAL / HEALTH MODULE — Comprehensive Schema
-- =====================================================

-- 1. Medical Profiles
CREATE TABLE public.medical_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  person_type text NOT NULL DEFAULT 'player',
  blood_type text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  chronic_conditions text,
  surgical_history text,
  family_medical_history text,
  general_notes text,
  profile_status text NOT NULL DEFAULT 'incomplete',
  metadata jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, person_id)
);

-- 2. Medical Conditions
CREATE TABLE public.medical_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_profile_id uuid NOT NULL REFERENCES public.medical_profiles(id) ON DELETE CASCADE,
  condition_type text NOT NULL,
  condition_name text NOT NULL,
  diagnosed_date date,
  status text NOT NULL DEFAULT 'active',
  severity text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Medical Allergies
CREATE TABLE public.medical_allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_profile_id uuid NOT NULL REFERENCES public.medical_profiles(id) ON DELETE CASCADE,
  allergen text NOT NULL,
  reaction_type text,
  severity text NOT NULL DEFAULT 'mild',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Medical Medications
CREATE TABLE public.medical_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_profile_id uuid NOT NULL REFERENCES public.medical_profiles(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  prescribed_by text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Medical Documents
CREATE TABLE public.medical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  document_type text NOT NULL,
  file_url text,
  file_name text,
  issue_date date,
  valid_from date,
  valid_to date,
  mandatory boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  uploaded_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Medical Exam Types (catalog)
CREATE TABLE public.medical_exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  required_for_competition boolean NOT NULL DEFAULT false,
  validity_months integer,
  min_age integer,
  max_age integer,
  protocol_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Medical Exams
CREATE TABLE public.medical_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  season_id text,
  exam_type_id uuid REFERENCES public.medical_exam_types(id),
  exam_type_code text NOT NULL,
  scheduled_date date,
  performed_date date,
  expiry_date date,
  provider_name text,
  provider_location text,
  status text NOT NULL DEFAULT 'scheduled',
  result_summary text,
  result_status text,
  file_url text,
  cost numeric(10,2),
  cost_center_id uuid,
  requested_by uuid,
  performed_by_staff_id uuid,
  validated_by uuid,
  validated_at timestamptz,
  notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Medical Clearances (aptidão)
CREATE TABLE public.medical_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  season_id text,
  clearance_type text NOT NULL DEFAULT 'global',
  clearance_status text NOT NULL DEFAULT 'pending',
  valid_from date,
  valid_to date,
  related_exam_id uuid REFERENCES public.medical_exams(id),
  related_injury_id uuid,
  granted_by uuid,
  granted_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  revocation_reason text,
  restrictions text,
  clinical_notes text,
  supporting_documents jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Medical Restrictions
CREATE TABLE public.medical_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  restriction_type text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'moderate',
  activities_blocked text[],
  activities_allowed text[],
  start_date date NOT NULL,
  end_date date,
  requires_reassessment boolean NOT NULL DEFAULT true,
  reassessment_date date,
  origin_type text,
  origin_id uuid,
  issued_by uuid,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Injury Cases (extends existing physio_injuries concept)
CREATE TABLE public.injury_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  season_id text,
  case_number text,
  body_area text NOT NULL,
  body_side text,
  injury_type text NOT NULL,
  mechanism text,
  severity text NOT NULL DEFAULT 'moderate',
  context text NOT NULL DEFAULT 'training',
  event_date date NOT NULL,
  diagnosis_date date,
  unavailable_from date,
  expected_return_date date,
  actual_return_date date,
  expected_days_out integer,
  actual_days_out integer,
  is_recurrence boolean NOT NULL DEFAULT false,
  previous_case_id uuid REFERENCES public.injury_cases(id),
  related_training_id uuid,
  related_match_id uuid,
  case_status text NOT NULL DEFAULT 'open',
  is_fit_training boolean NOT NULL DEFAULT false,
  is_fit_match boolean NOT NULL DEFAULT false,
  restrictions text,
  diagnosis_notes text,
  file_urls jsonb,
  created_by uuid,
  updated_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. Injury Assessments
CREATE TABLE public.injury_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_case_id uuid NOT NULL REFERENCES public.injury_cases(id) ON DELETE CASCADE,
  assessment_date date NOT NULL,
  assessed_by uuid,
  pain_level integer,
  mobility_score integer,
  strength_score integer,
  functional_limitation text,
  clinical_observation text,
  progress_vs_baseline text,
  risk_indicators text,
  recommended_action text,
  next_review_date date,
  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. Treatment Plans
CREATE TABLE public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  injury_case_id uuid REFERENCES public.injury_cases(id),
  title text NOT NULL,
  diagnosis text,
  objective text,
  responsible_staff_id uuid,
  start_date date NOT NULL,
  estimated_end_date date,
  actual_end_date date,
  total_sessions_planned integer,
  sessions_completed integer NOT NULL DEFAULT 0,
  techniques text[],
  medications text,
  milestone_criteria text,
  progression_criteria text,
  discharge_criteria text,
  plan_status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 13. Physio Sessions
CREATE TABLE public.physio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  treatment_plan_id uuid REFERENCES public.treatment_plans(id),
  injury_case_id uuid REFERENCES public.injury_cases(id),
  session_date date NOT NULL,
  session_time time,
  duration_minutes integer,
  therapist_id uuid,
  modality text NOT NULL,
  location text,
  pain_before integer,
  pain_after integer,
  athlete_response text,
  evolution_notes text,
  attendance_status text NOT NULL DEFAULT 'completed',
  attachments jsonb,
  cost numeric(10,2),
  cost_center_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14. Rehab Programs (extends existing rehab_plans)
CREATE TABLE public.rehab_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  injury_case_id uuid REFERENCES public.injury_cases(id),
  treatment_plan_id uuid REFERENCES public.treatment_plans(id),
  title text NOT NULL,
  goal text,
  current_phase text NOT NULL DEFAULT 'initial',
  phase_start_date date,
  baseline_notes text,
  start_date date NOT NULL,
  estimated_end_date date,
  actual_end_date date,
  program_status text NOT NULL DEFAULT 'active',
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 15. Rehab Progress Logs
CREATE TABLE public.rehab_progress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rehab_program_id uuid NOT NULL REFERENCES public.rehab_programs(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  phase text,
  pain_level integer,
  load_tolerance text,
  milestones_achieved text,
  limitations_observed text,
  decision text,
  logged_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 16. Return to Play Decisions
CREATE TABLE public.return_to_play_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  injury_case_id uuid REFERENCES public.injury_cases(id),
  decision_type text NOT NULL,
  stage text NOT NULL,
  decision_date date NOT NULL,
  decided_by uuid,
  justification text,
  perceived_risk text,
  remaining_restrictions text,
  next_review_date date,
  clearance_id uuid REFERENCES public.medical_clearances(id),
  status text NOT NULL DEFAULT 'approved',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 17. Wellness Check-ins
CREATE TABLE public.wellness_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  checkin_date date NOT NULL,
  fatigue_level integer,
  muscle_soreness integer,
  sleep_quality integer,
  stress_level integer,
  perceived_readiness integer,
  pain_areas text[],
  overall_mood text,
  notes text,
  risk_flags text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 18. Fitness Readiness Snapshots
CREATE TABLE public.fitness_readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  snapshot_date date NOT NULL,
  readiness_score integer,
  availability_status text NOT NULL DEFAULT 'available',
  active_injuries integer NOT NULL DEFAULT 0,
  active_restrictions integer NOT NULL DEFAULT 0,
  clearance_status text,
  risk_level text NOT NULL DEFAULT 'low',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 19. Medical Staff Registry
CREATE TABLE public.medical_staff_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  user_id uuid,
  staff_role text NOT NULL,
  specialty text,
  license_number text,
  license_expiry date,
  qualification_details text,
  team_id uuid REFERENCES public.teams(id),
  contract_type text,
  is_active boolean NOT NULL DEFAULT true,
  documents jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 20. Medical Equipment Checks
CREATE TABLE public.medical_equipment_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid,
  equipment_name text NOT NULL,
  equipment_type text NOT NULL,
  asset_item_id uuid,
  check_type text NOT NULL DEFAULT 'routine',
  check_date date NOT NULL,
  next_check_date date,
  checked_by uuid,
  check_result text NOT NULL DEFAULT 'pass',
  findings text,
  corrective_action text,
  photo_urls jsonb,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 21. Medical Alerts
CREATE TABLE public.medical_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  related_entity_type text,
  related_entity_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'active',
  assigned_to uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 22. Medical Compliance Items
CREATE TABLE public.medical_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  compliance_type text NOT NULL,
  title text NOT NULL,
  description text,
  person_id uuid,
  team_id uuid REFERENCES public.teams(id),
  required_by_date date,
  completed_date date,
  status text NOT NULL DEFAULT 'pending',
  evidence_url text,
  responsible_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 23. Medical Audit Logs
CREATE TABLE public.medical_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  payload jsonb,
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_medical_profiles_club ON public.medical_profiles(club_id);
CREATE INDEX idx_medical_profiles_person ON public.medical_profiles(person_id);
CREATE INDEX idx_medical_exams_club ON public.medical_exams(club_id);
CREATE INDEX idx_medical_exams_person ON public.medical_exams(person_id);
CREATE INDEX idx_medical_exams_status ON public.medical_exams(status);
CREATE INDEX idx_medical_clearances_club ON public.medical_clearances(club_id);
CREATE INDEX idx_medical_clearances_person ON public.medical_clearances(person_id);
CREATE INDEX idx_medical_clearances_status ON public.medical_clearances(clearance_status);
CREATE INDEX idx_medical_restrictions_club ON public.medical_restrictions(club_id);
CREATE INDEX idx_medical_restrictions_person ON public.medical_restrictions(person_id);
CREATE INDEX idx_injury_cases_club ON public.injury_cases(club_id);
CREATE INDEX idx_injury_cases_person ON public.injury_cases(person_id);
CREATE INDEX idx_injury_cases_status ON public.injury_cases(case_status);
CREATE INDEX idx_injury_assessments_case ON public.injury_assessments(injury_case_id);
CREATE INDEX idx_treatment_plans_club ON public.treatment_plans(club_id);
CREATE INDEX idx_physio_sessions_club ON public.physio_sessions(club_id);
CREATE INDEX idx_physio_sessions_person ON public.physio_sessions(person_id);
CREATE INDEX idx_rehab_programs_club ON public.rehab_programs(club_id);
CREATE INDEX idx_return_to_play_club ON public.return_to_play_decisions(club_id);
CREATE INDEX idx_wellness_checkins_club ON public.wellness_checkins(club_id);
CREATE INDEX idx_wellness_checkins_person ON public.wellness_checkins(person_id);
CREATE INDEX idx_medical_alerts_club ON public.medical_alerts(club_id);
CREATE INDEX idx_medical_alerts_status ON public.medical_alerts(status);
CREATE INDEX idx_medical_audit_logs_club ON public.medical_audit_logs(club_id);
CREATE INDEX idx_medical_audit_logs_entity ON public.medical_audit_logs(entity_type, entity_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.medical_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_clearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_to_play_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_readiness_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_staff_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_equipment_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_audit_logs ENABLE ROW LEVEL SECURITY;

-- Medical data: only physio/admin access via has_physio_access function
CREATE POLICY "medical_profiles_select" ON public.medical_profiles FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_profiles_insert" ON public.medical_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_profiles_update" ON public.medical_profiles FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_conditions_select" ON public.medical_conditions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medical_profiles mp WHERE mp.id = medical_profile_id AND public.has_physio_access(mp.club_id, auth.uid())));
CREATE POLICY "medical_conditions_insert" ON public.medical_conditions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.medical_profiles mp WHERE mp.id = medical_profile_id AND public.has_physio_access(mp.club_id, auth.uid())));
CREATE POLICY "medical_conditions_update" ON public.medical_conditions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medical_profiles mp WHERE mp.id = medical_profile_id AND public.has_physio_access(mp.club_id, auth.uid())));

CREATE POLICY "medical_allergies_select" ON public.medical_allergies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medical_profiles mp WHERE mp.id = medical_profile_id AND public.has_physio_access(mp.club_id, auth.uid())));
CREATE POLICY "medical_allergies_insert" ON public.medical_allergies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.medical_profiles mp WHERE mp.id = medical_profile_id AND public.has_physio_access(mp.club_id, auth.uid())));

CREATE POLICY "medical_medications_select" ON public.medical_medications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medical_profiles mp WHERE mp.id = medical_profile_id AND public.has_physio_access(mp.club_id, auth.uid())));
CREATE POLICY "medical_medications_insert" ON public.medical_medications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.medical_profiles mp WHERE mp.id = medical_profile_id AND public.has_physio_access(mp.club_id, auth.uid())));

CREATE POLICY "medical_documents_select" ON public.medical_documents FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_documents_insert" ON public.medical_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_documents_update" ON public.medical_documents FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_exam_types_select" ON public.medical_exam_types FOR SELECT TO authenticated
  USING (club_id IS NULL OR public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_exam_types_insert" ON public.medical_exam_types FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_exams_select" ON public.medical_exams FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_exams_insert" ON public.medical_exams FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_exams_update" ON public.medical_exams FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_clearances_select" ON public.medical_clearances FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_clearances_insert" ON public.medical_clearances FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_clearances_update" ON public.medical_clearances FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_restrictions_select" ON public.medical_restrictions FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_restrictions_insert" ON public.medical_restrictions FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_restrictions_update" ON public.medical_restrictions FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "injury_cases_select" ON public.injury_cases FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "injury_cases_insert" ON public.injury_cases FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "injury_cases_update" ON public.injury_cases FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "injury_assessments_select" ON public.injury_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.injury_cases ic WHERE ic.id = injury_case_id AND public.has_physio_access(ic.club_id, auth.uid())));
CREATE POLICY "injury_assessments_insert" ON public.injury_assessments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.injury_cases ic WHERE ic.id = injury_case_id AND public.has_physio_access(ic.club_id, auth.uid())));

CREATE POLICY "treatment_plans_select" ON public.treatment_plans FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "treatment_plans_insert" ON public.treatment_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "treatment_plans_update" ON public.treatment_plans FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "physio_sessions_select" ON public.physio_sessions FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "physio_sessions_insert" ON public.physio_sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "physio_sessions_update" ON public.physio_sessions FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "rehab_programs_select" ON public.rehab_programs FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "rehab_programs_insert" ON public.rehab_programs FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "rehab_programs_update" ON public.rehab_programs FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "rehab_progress_logs_select" ON public.rehab_progress_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rehab_programs rp WHERE rp.id = rehab_program_id AND public.has_physio_access(rp.club_id, auth.uid())));
CREATE POLICY "rehab_progress_logs_insert" ON public.rehab_progress_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rehab_programs rp WHERE rp.id = rehab_program_id AND public.has_physio_access(rp.club_id, auth.uid())));

CREATE POLICY "return_to_play_select" ON public.return_to_play_decisions FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "return_to_play_insert" ON public.return_to_play_decisions FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "wellness_checkins_select" ON public.wellness_checkins FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "wellness_checkins_insert" ON public.wellness_checkins FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "fitness_snapshots_select" ON public.fitness_readiness_snapshots FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "fitness_snapshots_insert" ON public.fitness_readiness_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_staff_select" ON public.medical_staff_registry FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_staff_insert" ON public.medical_staff_registry FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_staff_update" ON public.medical_staff_registry FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_equipment_select" ON public.medical_equipment_checks FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_equipment_insert" ON public.medical_equipment_checks FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_alerts_select" ON public.medical_alerts FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_alerts_insert" ON public.medical_alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_alerts_update" ON public.medical_alerts FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_compliance_select" ON public.medical_compliance_items FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_compliance_insert" ON public.medical_compliance_items FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_compliance_update" ON public.medical_compliance_items FOR UPDATE TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));

CREATE POLICY "medical_audit_select" ON public.medical_audit_logs FOR SELECT TO authenticated
  USING (public.has_physio_access(club_id, auth.uid()));
CREATE POLICY "medical_audit_insert" ON public.medical_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_physio_access(club_id, auth.uid()));

-- Updated_at triggers
CREATE TRIGGER set_updated_at_medical_profiles BEFORE UPDATE ON public.medical_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_conditions BEFORE UPDATE ON public.medical_conditions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_medications BEFORE UPDATE ON public.medical_medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_documents BEFORE UPDATE ON public.medical_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_exams BEFORE UPDATE ON public.medical_exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_clearances BEFORE UPDATE ON public.medical_clearances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_restrictions BEFORE UPDATE ON public.medical_restrictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_injury_cases BEFORE UPDATE ON public.injury_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_treatment_plans BEFORE UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_physio_sessions BEFORE UPDATE ON public.physio_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_rehab_programs BEFORE UPDATE ON public.rehab_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_staff BEFORE UPDATE ON public.medical_staff_registry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_alerts BEFORE UPDATE ON public.medical_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_medical_compliance BEFORE UPDATE ON public.medical_compliance_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
