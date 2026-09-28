
-- =====================================================
-- WORKFORCE MODULE: Staff, Contracts, Payroll, Obligations
-- =====================================================

-- 1. People Registry
CREATE TABLE public.people_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_type text NOT NULL DEFAULT 'employee' CHECK (person_type IN ('employee','contractor','coach','medical','operational','director','volunteer','other')),
  full_name text NOT NULL,
  tax_id text,
  national_id text,
  birth_date date,
  nationality text,
  email text,
  phone text,
  address text,
  emergency_contact jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_people_registry_club ON public.people_registry(club_id);

-- 2. Staff Profiles
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people_registry(id) ON DELETE CASCADE,
  internal_code text,
  staff_role text NOT NULL,
  department_id uuid REFERENCES public.budget_cost_centers(id),
  team_id uuid REFERENCES public.teams(id),
  cost_center_id uuid REFERENCES public.budget_cost_centers(id),
  employment_type text DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contractor','volunteer','intern')),
  start_date date NOT NULL,
  end_date date,
  manager_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_profiles_club ON public.staff_profiles(club_id);
CREATE INDEX idx_staff_profiles_person ON public.staff_profiles(person_id);

-- 3. Staff Qualifications
CREATE TABLE public.staff_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people_registry(id) ON DELETE CASCADE,
  qualification_type text NOT NULL,
  title text NOT NULL,
  issuing_entity text,
  issue_date date,
  expiry_date date,
  verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','expired','rejected')),
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Staff Documents
CREATE TABLE public.staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people_registry(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_url text,
  valid_from date,
  valid_to date,
  status text DEFAULT 'valid' CHECK (status IN ('valid','expired','pending','rejected')),
  mandatory boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Employment Contracts
CREATE TABLE public.employment_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people_registry(id) ON DELETE CASCADE,
  staff_profile_id uuid REFERENCES public.staff_profiles(id),
  contract_type text NOT NULL DEFAULT 'open_ended' CHECK (contract_type IN ('open_ended','fixed_term','service','consultancy','internship','volunteer','sports_specific','other')),
  contract_number text,
  start_date date NOT NULL,
  end_date date,
  probation_period integer,
  working_time_type text DEFAULT 'full_time',
  weekly_hours numeric,
  currency text DEFAULT 'EUR',
  base_salary numeric DEFAULT 0,
  payment_frequency text DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly','bi_weekly','weekly','per_session','per_event','milestone')),
  payment_day integer DEFAULT 1,
  auto_renew boolean DEFAULT false,
  notice_period_days integer,
  contract_status text NOT NULL DEFAULT 'draft' CHECK (contract_status IN ('draft','active','suspended','terminated','expired','renewed')),
  file_url text,
  signed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_employment_contracts_club ON public.employment_contracts(club_id);

-- 6. Contract Addenda
CREATE TABLE public.contract_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
  addendum_type text NOT NULL,
  effective_date date NOT NULL,
  description text,
  previous_value text,
  new_value text,
  impact_type text,
  file_url text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Compensation Components
CREATE TABLE public.compensation_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  component_code text NOT NULL,
  component_name text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('earning','deduction','employer_charge','reimbursement','bonus','allowance','benefit','tax','contribution')),
  taxable boolean DEFAULT true,
  contributory boolean DEFAULT true,
  recurring boolean DEFAULT true,
  affects_budget boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Compensation Packages
CREATE TABLE public.compensation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people_registry(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.employment_contracts(id),
  package_name text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  status text DEFAULT 'active' CHECK (status IN ('draft','active','superseded','terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Compensation Package Lines
CREATE TABLE public.compensation_package_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.compensation_packages(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.compensation_components(id),
  calculation_method text DEFAULT 'fixed' CHECK (calculation_method IN ('fixed','percentage','formula','manual')),
  amount numeric DEFAULT 0,
  percentage numeric,
  frequency text DEFAULT 'monthly',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Payroll Cycles
CREATE TABLE public.payroll_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  fiscal_year integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  payroll_type text DEFAULT 'regular' CHECK (payroll_type IN ('regular','bonus','correction','termination','contractor_batch')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','under_review','approved','posted','paid','closed')),
  approved_by uuid,
  approved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_cycles_club ON public.payroll_cycles(club_id);

-- 11. Payroll Entries
CREATE TABLE public.payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid NOT NULL REFERENCES public.payroll_cycles(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people_registry(id),
  staff_profile_id uuid REFERENCES public.staff_profiles(id),
  contract_id uuid REFERENCES public.employment_contracts(id),
  gross_amount numeric NOT NULL DEFAULT 0,
  deductions_amount numeric NOT NULL DEFAULT 0,
  employer_charges_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  payable_amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','calculated','approved','paid','cancelled')),
  payment_due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. Payroll Entry Lines
CREATE TABLE public.payroll_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id uuid NOT NULL REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  component_id uuid REFERENCES public.compensation_components(id),
  line_type text NOT NULL CHECK (line_type IN ('earning','deduction','employer_charge')),
  quantity numeric DEFAULT 1,
  rate numeric DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  taxable boolean DEFAULT true,
  contributory boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 13. Contractor Fee Batches
CREATE TABLE public.contractor_fee_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  batch_name text NOT NULL,
  period_reference text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','paid','closed')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14. Contractor Fee Entries
CREATE TABLE public.contractor_fee_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_batch_id uuid NOT NULL REFERENCES public.contractor_fee_batches(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people_registry(id),
  service_reference text,
  service_date date,
  quantity numeric DEFAULT 1,
  unit_rate numeric DEFAULT 0,
  gross_fee numeric NOT NULL DEFAULT 0,
  withholding_amount numeric DEFAULT 0,
  net_fee numeric NOT NULL DEFAULT 0,
  payable_amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 15. Statutory Obligations
CREATE TABLE public.statutory_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  obligation_type text NOT NULL CHECK (obligation_type IN ('salary','social_security','tax_withholding','contractor_withholding','insurance','pension','other')),
  reference_period text NOT NULL,
  due_date date NOT NULL,
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','pending','partially_paid','paid','overdue','disputed')),
  source_cycle_id uuid REFERENCES public.payroll_cycles(id),
  source_batch_id uuid REFERENCES public.contractor_fee_batches(id),
  authority_name text,
  reference_code text,
  proof_file_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_statutory_obligations_club ON public.statutory_obligations(club_id);

-- 16. Payroll Payments
CREATE TABLE public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  payroll_entry_id uuid REFERENCES public.payroll_entries(id),
  contractor_fee_entry_id uuid REFERENCES public.contractor_fee_entries(id),
  obligation_id uuid REFERENCES public.statutory_obligations(id),
  payment_date date NOT NULL,
  payment_method text DEFAULT 'bank_transfer',
  bank_reference text,
  gross_amount numeric NOT NULL DEFAULT 0,
  deductions_amount numeric DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  reconciled boolean DEFAULT false,
  reconciled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 17. Contract Alerts
CREATE TABLE public.contract_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people_registry(id),
  contract_id uuid REFERENCES public.employment_contracts(id),
  alert_type text NOT NULL CHECK (alert_type IN ('expiry','document_missing','qualification_expiry','onboarding_pending','overdue_salary','overdue_tax','overdue_social_security','vacancy_risk')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  due_date date,
  status text DEFAULT 'active' CHECK (status IN ('active','acknowledged','resolved','dismissed')),
  assigned_to uuid,
  resolved_at timestamptz,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 18. Workforce Audit Logs
CREATE TABLE public.workforce_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workforce_audit_club ON public.workforce_audit_logs(club_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.people_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_addenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_package_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_fee_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_fee_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_audit_logs ENABLE ROW LEVEL SECURITY;

-- Financial admin policies (club owner + admin/coordenador staff)
CREATE POLICY "fin_admin_people" ON public.people_registry FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_staff_profiles" ON public.staff_profiles FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_qualifications" ON public.staff_qualifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people_registry pr WHERE pr.id = person_id AND public.is_club_financial_admin(auth.uid(), pr.club_id)));

CREATE POLICY "fin_admin_documents" ON public.staff_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people_registry pr WHERE pr.id = person_id AND public.is_club_financial_admin(auth.uid(), pr.club_id)));

CREATE POLICY "fin_admin_contracts" ON public.employment_contracts FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_addenda" ON public.contract_addenda FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employment_contracts ec WHERE ec.id = contract_id AND public.is_club_financial_admin(auth.uid(), ec.club_id)));

CREATE POLICY "fin_admin_comp_components" ON public.compensation_components FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_comp_packages" ON public.compensation_packages FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_comp_lines" ON public.compensation_package_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compensation_packages cp WHERE cp.id = package_id AND public.is_club_financial_admin(auth.uid(), cp.club_id)));

CREATE POLICY "fin_admin_payroll_cycles" ON public.payroll_cycles FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_payroll_entries" ON public.payroll_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payroll_cycles pc WHERE pc.id = payroll_cycle_id AND public.is_club_financial_admin(auth.uid(), pc.club_id)));

CREATE POLICY "fin_admin_payroll_lines" ON public.payroll_entry_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payroll_entries pe JOIN public.payroll_cycles pc ON pc.id = pe.payroll_cycle_id WHERE pe.id = payroll_entry_id AND public.is_club_financial_admin(auth.uid(), pc.club_id)));

CREATE POLICY "fin_admin_fee_batches" ON public.contractor_fee_batches FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_fee_entries" ON public.contractor_fee_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contractor_fee_batches fb WHERE fb.id = fee_batch_id AND public.is_club_financial_admin(auth.uid(), fb.club_id)));

CREATE POLICY "fin_admin_obligations" ON public.statutory_obligations FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_payroll_payments" ON public.payroll_payments FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_contract_alerts" ON public.contract_alerts FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "fin_admin_workforce_audit" ON public.workforce_audit_logs FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- Triggers for updated_at
CREATE TRIGGER trg_people_registry_updated BEFORE UPDATE ON public.people_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_staff_profiles_updated BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_employment_contracts_updated BEFORE UPDATE ON public.employment_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_compensation_packages_updated BEFORE UPDATE ON public.compensation_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payroll_cycles_updated BEFORE UPDATE ON public.payroll_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_statutory_obligations_updated BEFORE UPDATE ON public.statutory_obligations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_contractor_fee_batches_updated BEFORE UPDATE ON public.contractor_fee_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
