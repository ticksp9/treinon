
-- Budget Categories (financial classification)
CREATE TABLE public.budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('revenue','expense','investment')),
  parent_category_id UUID REFERENCES public.budget_categories(id),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  default_cost_center_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget Cost Centers
CREATE TABLE public.budget_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  type TEXT DEFAULT 'operational',
  is_active BOOLEAN DEFAULT true,
  linked_team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, code)
);

-- Budget Cycles (annual/seasonal budget)
CREATE TABLE public.budget_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '2025/2026',
  fiscal_year INT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','revised','archived','superseded')),
  budget_scope TEXT DEFAULT 'club' CHECK (budget_scope IN ('club','department','team','youth_program','consolidated')),
  version_number INT DEFAULT 1,
  parent_budget_cycle_id UUID REFERENCES public.budget_cycles(id),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget Versions (revisions within a cycle)
CREATE TABLE public.budget_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_cycle_id UUID NOT NULL REFERENCES public.budget_cycles(id) ON DELETE CASCADE,
  version_code TEXT NOT NULL,
  version_label TEXT NOT NULL,
  version_type TEXT DEFAULT 'initial' CHECK (version_type IN ('initial','revised','reforecast','final')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','superseded')),
  effective_from DATE,
  notes TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget Lines (individual budget entries)
CREATE TABLE public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id UUID NOT NULL REFERENCES public.budget_versions(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  season TEXT,
  team_id UUID REFERENCES public.teams(id),
  cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  category_id UUID REFERENCES public.budget_categories(id),
  line_type TEXT NOT NULL DEFAULT 'expense' CHECK (line_type IN ('revenue','expense','capex','transfer','adjustment')),
  line_nature TEXT DEFAULT 'fixed' CHECK (line_nature IN ('fixed','variable','recurring','extraordinary')),
  month INT CHECK (month BETWEEN 1 AND 12),
  period_start DATE,
  period_end DATE,
  budget_amount NUMERIC(12,2) DEFAULT 0,
  forecast_amount NUMERIC(12,2) DEFAULT 0,
  actual_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  owner_user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget Alerts
CREATE TABLE public.budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  budget_cycle_id UUID REFERENCES public.budget_cycles(id),
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  threshold_value NUMERIC(12,2),
  current_value NUMERIC(12,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','acknowledged','resolved','dismissed')),
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget Audit Logs
CREATE TABLE public.budget_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Budget Snapshots (frozen period summaries)
CREATE TABLE public.budget_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_cycle_id UUID NOT NULL REFERENCES public.budget_cycles(id) ON DELETE CASCADE,
  budget_version_id UUID REFERENCES public.budget_versions(id),
  snapshot_date DATE NOT NULL,
  summary_payload JSONB NOT NULL DEFAULT '{}',
  generated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_budget_lines_version ON public.budget_lines(budget_version_id);
CREATE INDEX idx_budget_lines_club ON public.budget_lines(club_id);
CREATE INDEX idx_budget_lines_team ON public.budget_lines(team_id);
CREATE INDEX idx_budget_lines_category ON public.budget_lines(category_id);
CREATE INDEX idx_budget_lines_month ON public.budget_lines(month);
CREATE INDEX idx_budget_cycles_club ON public.budget_cycles(club_id);
CREATE INDEX idx_budget_alerts_club ON public.budget_alerts(club_id);
CREATE INDEX idx_budget_audit_club ON public.budget_audit_logs(club_id);

-- RLS
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies: club financial admin can manage all budget data
CREATE POLICY "budget_categories_select" ON public.budget_categories FOR SELECT TO authenticated
  USING (club_id IS NULL OR public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "budget_categories_insert" ON public.budget_categories FOR INSERT TO authenticated
  WITH CHECK (club_id IS NULL OR public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "budget_categories_update" ON public.budget_categories FOR UPDATE TO authenticated
  USING (club_id IS NULL OR public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "budget_cost_centers_select" ON public.budget_cost_centers FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "budget_cost_centers_manage" ON public.budget_cost_centers FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "budget_cycles_select" ON public.budget_cycles FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "budget_cycles_manage" ON public.budget_cycles FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "budget_versions_select" ON public.budget_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budget_cycles bc WHERE bc.id = budget_cycle_id AND public.is_club_financial_admin(auth.uid(), bc.club_id)));
CREATE POLICY "budget_versions_manage" ON public.budget_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budget_cycles bc WHERE bc.id = budget_cycle_id AND public.is_club_financial_admin(auth.uid(), bc.club_id)));

CREATE POLICY "budget_lines_select" ON public.budget_lines FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "budget_lines_manage" ON public.budget_lines FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "budget_alerts_select" ON public.budget_alerts FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "budget_alerts_manage" ON public.budget_alerts FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "budget_audit_logs_select" ON public.budget_audit_logs FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "budget_audit_logs_insert" ON public.budget_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "budget_snapshots_select" ON public.budget_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budget_cycles bc WHERE bc.id = budget_cycle_id AND public.is_club_financial_admin(auth.uid(), bc.club_id)));
CREATE POLICY "budget_snapshots_manage" ON public.budget_snapshots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budget_cycles bc WHERE bc.id = budget_cycle_id AND public.is_club_financial_admin(auth.uid(), bc.club_id)));

-- Updated_at triggers
CREATE TRIGGER set_budget_categories_updated_at BEFORE UPDATE ON public.budget_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_budget_cost_centers_updated_at BEFORE UPDATE ON public.budget_cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_budget_cycles_updated_at BEFORE UPDATE ON public.budget_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_budget_versions_updated_at BEFORE UPDATE ON public.budget_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_budget_lines_updated_at BEFORE UPDATE ON public.budget_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_budget_alerts_updated_at BEFORE UPDATE ON public.budget_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
