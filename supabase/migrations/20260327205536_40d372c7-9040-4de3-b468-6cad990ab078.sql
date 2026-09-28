
-- =============================================
-- FACILITIES MODULE - Complete Schema
-- =============================================

-- 1. facilities
CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_code text NOT NULL,
  name text NOT NULL,
  facility_type text NOT NULL DEFAULT 'other',
  ownership_type text NOT NULL DEFAULT 'owned',
  address text,
  city text,
  country text DEFAULT 'PT',
  latitude numeric,
  longitude numeric,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, facility_code)
);

-- 2. facility_documents
CREATE TABLE public.facility_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other',
  file_url text,
  issue_date date,
  valid_from date,
  valid_to date,
  status text NOT NULL DEFAULT 'active',
  mandatory boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. facility_spaces
CREATE TABLE public.facility_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  space_code text NOT NULL,
  name text NOT NULL,
  space_type text NOT NULL DEFAULT 'other',
  surface_type text,
  dimensions text,
  capacity int,
  indoor_outdoor text DEFAULT 'outdoor',
  floodlights boolean DEFAULT false,
  medical_support_required boolean DEFAULT false,
  reservable boolean NOT NULL DEFAULT true,
  maintenance_critical boolean DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. field_profiles
CREATE TABLE public.field_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_space_id uuid NOT NULL REFERENCES public.facility_spaces(id) ON DELETE CASCADE,
  sport_type text DEFAULT 'football',
  field_format text,
  size_category text,
  turf_type text,
  lighting_available boolean DEFAULT false,
  irrigation_available boolean DEFAULT false,
  drainage_available boolean DEFAULT false,
  match_eligible boolean DEFAULT false,
  training_eligible boolean DEFAULT true,
  safety_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. facility_resources
CREATE TABLE public.facility_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_space_id uuid NOT NULL REFERENCES public.facility_spaces(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  asset_item_id uuid REFERENCES public.asset_items(id) ON DELETE SET NULL,
  quantity int DEFAULT 1,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. facility_reservations
CREATE TABLE public.facility_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  facility_space_id uuid NOT NULL REFERENCES public.facility_spaces(id) ON DELETE CASCADE,
  reservation_type text NOT NULL DEFAULT 'training',
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  season_id text,
  requester_user_id uuid NOT NULL,
  responsible_user_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  recurrence_rule text,
  reservation_status text NOT NULL DEFAULT 'pending',
  priority_level int DEFAULT 5,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_time_check CHECK (ends_at > starts_at)
);

-- 7. reservation_conflicts
CREATE TABLE public.reservation_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.facility_reservations(id) ON DELETE CASCADE,
  conflicting_reservation_id uuid NOT NULL REFERENCES public.facility_reservations(id) ON DELETE CASCADE,
  conflict_type text DEFAULT 'overlap',
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. facility_availability_rules
CREATE TABLE public.facility_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_space_id uuid NOT NULL REFERENCES public.facility_spaces(id) ON DELETE CASCADE,
  rule_type text NOT NULL DEFAULT 'weekly_schedule',
  starts_at timestamptz,
  ends_at timestamptz,
  days_of_week int[],
  priority int DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. facility_maintenance_plans
CREATE TABLE public.facility_maintenance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  facility_space_id uuid REFERENCES public.facility_spaces(id) ON DELETE SET NULL,
  plan_type text NOT NULL DEFAULT 'preventive',
  frequency_type text DEFAULT 'monthly',
  frequency_value int DEFAULT 1,
  checklist_json jsonb,
  responsible_role text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. facility_work_orders
CREATE TABLE public.facility_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  facility_space_id uuid REFERENCES public.facility_spaces(id) ON DELETE SET NULL,
  maintenance_plan_id uuid REFERENCES public.facility_maintenance_plans(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  work_order_type text DEFAULT 'corrective',
  priority text DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  requested_by uuid,
  assigned_to_user_id uuid,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  scheduled_date date,
  completed_date date,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. facility_maintenance_logs
CREATE TABLE public.facility_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.facility_work_orders(id) ON DELETE CASCADE,
  log_date timestamptz NOT NULL DEFAULT now(),
  action_type text NOT NULL,
  notes text,
  attachment_url text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. facility_operational_costs
CREATE TABLE public.facility_operational_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  facility_space_id uuid REFERENCES public.facility_spaces(id) ON DELETE SET NULL,
  cost_type text NOT NULL DEFAULT 'other',
  period_reference text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.budget_cost_centers(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  source_entity_type text,
  source_entity_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 13. facility_usage_logs
CREATE TABLE public.facility_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  facility_space_id uuid NOT NULL REFERENCES public.facility_spaces(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.facility_reservations(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  usage_type text DEFAULT 'training',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  actual_duration_minutes int,
  responsible_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14. facility_incidents
CREATE TABLE public.facility_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  facility_space_id uuid REFERENCES public.facility_spaces(id) ON DELETE SET NULL,
  incident_type text NOT NULL DEFAULT 'other',
  severity text DEFAULT 'medium',
  reported_by uuid,
  reported_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open',
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 15. facility_compliance_alerts
CREATE TABLE public.facility_compliance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  facility_space_id uuid REFERENCES public.facility_spaces(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text DEFAULT 'medium',
  due_date date,
  status text NOT NULL DEFAULT 'active',
  assigned_to uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 16. facility_audit_logs
CREATE TABLE public.facility_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_facilities_club ON public.facilities(club_id);
CREATE INDEX idx_facility_spaces_facility ON public.facility_spaces(facility_id);
CREATE INDEX idx_facility_reservations_club ON public.facility_reservations(club_id);
CREATE INDEX idx_facility_reservations_space_time ON public.facility_reservations(facility_space_id, starts_at, ends_at);
CREATE INDEX idx_facility_reservations_team ON public.facility_reservations(team_id);
CREATE INDEX idx_facility_work_orders_club ON public.facility_work_orders(club_id);
CREATE INDEX idx_facility_work_orders_status ON public.facility_work_orders(status);
CREATE INDEX idx_facility_operational_costs_club ON public.facility_operational_costs(club_id);
CREATE INDEX idx_facility_usage_logs_club ON public.facility_usage_logs(club_id);
CREATE INDEX idx_facility_audit_logs_club ON public.facility_audit_logs(club_id);
CREATE INDEX idx_facility_documents_facility ON public.facility_documents(facility_id);
CREATE INDEX idx_facility_compliance_alerts_club ON public.facility_compliance_alerts(club_id);

-- RLS
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_operational_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_compliance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - facilities
CREATE POLICY "facilities_select" ON public.facilities FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));
CREATE POLICY "facilities_insert" ON public.facilities FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "facilities_update" ON public.facilities FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "facilities_delete" ON public.facilities FOR DELETE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- facility_documents
CREATE POLICY "facility_docs_select" ON public.facility_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facilities f WHERE f.id = facility_id AND (public.is_club_financial_admin(auth.uid(), f.club_id) OR public.is_club_coach(auth.uid(), f.club_id))));
CREATE POLICY "facility_docs_insert" ON public.facility_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.facilities f WHERE f.id = facility_id AND public.is_club_financial_admin(auth.uid(), f.club_id)));
CREATE POLICY "facility_docs_update" ON public.facility_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facilities f WHERE f.id = facility_id AND public.is_club_financial_admin(auth.uid(), f.club_id)));

-- facility_spaces
CREATE POLICY "spaces_select" ON public.facility_spaces FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facilities f WHERE f.id = facility_id AND (public.is_club_financial_admin(auth.uid(), f.club_id) OR public.is_club_coach(auth.uid(), f.club_id))));
CREATE POLICY "spaces_insert" ON public.facility_spaces FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.facilities f WHERE f.id = facility_id AND public.is_club_financial_admin(auth.uid(), f.club_id)));
CREATE POLICY "spaces_update" ON public.facility_spaces FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facilities f WHERE f.id = facility_id AND public.is_club_financial_admin(auth.uid(), f.club_id)));

-- field_profiles
CREATE POLICY "field_profiles_select" ON public.field_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facility_spaces s JOIN public.facilities f ON f.id = s.facility_id WHERE s.id = facility_space_id AND (public.is_club_financial_admin(auth.uid(), f.club_id) OR public.is_club_coach(auth.uid(), f.club_id))));
CREATE POLICY "field_profiles_insert" ON public.field_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.facility_spaces s JOIN public.facilities f ON f.id = s.facility_id WHERE s.id = facility_space_id AND public.is_club_financial_admin(auth.uid(), f.club_id)));

-- facility_resources
CREATE POLICY "resources_select" ON public.facility_resources FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facility_spaces s JOIN public.facilities f ON f.id = s.facility_id WHERE s.id = facility_space_id AND (public.is_club_financial_admin(auth.uid(), f.club_id) OR public.is_club_coach(auth.uid(), f.club_id))));
CREATE POLICY "resources_insert" ON public.facility_resources FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.facility_spaces s JOIN public.facilities f ON f.id = s.facility_id WHERE s.id = facility_space_id AND public.is_club_financial_admin(auth.uid(), f.club_id)));

-- facility_reservations
CREATE POLICY "reservations_select" ON public.facility_reservations FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));
CREATE POLICY "reservations_insert" ON public.facility_reservations FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));
CREATE POLICY "reservations_update" ON public.facility_reservations FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- reservation_conflicts
CREATE POLICY "conflicts_select" ON public.reservation_conflicts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facility_reservations r WHERE r.id = reservation_id AND (public.is_club_financial_admin(auth.uid(), r.club_id) OR public.is_club_coach(auth.uid(), r.club_id))));
CREATE POLICY "conflicts_insert" ON public.reservation_conflicts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.facility_reservations r WHERE r.id = reservation_id AND public.is_club_financial_admin(auth.uid(), r.club_id)));

-- facility_availability_rules
CREATE POLICY "avail_rules_select" ON public.facility_availability_rules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facility_spaces s JOIN public.facilities f ON f.id = s.facility_id WHERE s.id = facility_space_id AND (public.is_club_financial_admin(auth.uid(), f.club_id) OR public.is_club_coach(auth.uid(), f.club_id))));
CREATE POLICY "avail_rules_insert" ON public.facility_availability_rules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.facility_spaces s JOIN public.facilities f ON f.id = s.facility_id WHERE s.id = facility_space_id AND public.is_club_financial_admin(auth.uid(), f.club_id)));

-- facility_maintenance_plans
CREATE POLICY "maint_plans_select" ON public.facility_maintenance_plans FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "maint_plans_insert" ON public.facility_maintenance_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- facility_work_orders
CREATE POLICY "work_orders_select" ON public.facility_work_orders FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));
CREATE POLICY "work_orders_insert" ON public.facility_work_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "work_orders_update" ON public.facility_work_orders FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- facility_maintenance_logs
CREATE POLICY "maint_logs_select" ON public.facility_maintenance_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.facility_work_orders wo WHERE wo.id = work_order_id AND (public.is_club_financial_admin(auth.uid(), wo.club_id) OR public.is_club_coach(auth.uid(), wo.club_id))));
CREATE POLICY "maint_logs_insert" ON public.facility_maintenance_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.facility_work_orders wo WHERE wo.id = work_order_id AND public.is_club_financial_admin(auth.uid(), wo.club_id)));

-- facility_operational_costs
CREATE POLICY "op_costs_select" ON public.facility_operational_costs FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "op_costs_insert" ON public.facility_operational_costs FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- facility_usage_logs
CREATE POLICY "usage_logs_select" ON public.facility_usage_logs FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));
CREATE POLICY "usage_logs_insert" ON public.facility_usage_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));

-- facility_incidents
CREATE POLICY "incidents_select" ON public.facility_incidents FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));
CREATE POLICY "incidents_insert" ON public.facility_incidents FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id));
CREATE POLICY "incidents_update" ON public.facility_incidents FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- facility_compliance_alerts
CREATE POLICY "compliance_alerts_select" ON public.facility_compliance_alerts FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "compliance_alerts_insert" ON public.facility_compliance_alerts FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "compliance_alerts_update" ON public.facility_compliance_alerts FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- facility_audit_logs
CREATE POLICY "facility_audit_select" ON public.facility_audit_logs FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "facility_audit_insert" ON public.facility_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- Updated_at triggers
CREATE TRIGGER set_facilities_updated_at BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_facility_spaces_updated_at BEFORE UPDATE ON public.facility_spaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_facility_reservations_updated_at BEFORE UPDATE ON public.facility_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_facility_work_orders_updated_at BEFORE UPDATE ON public.facility_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_facility_incidents_updated_at BEFORE UPDATE ON public.facility_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
