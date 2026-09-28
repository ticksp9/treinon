
-- =============================================
-- FINANCIAL MODULE: fee_plans, fee_assignments, charges, payments, payment_allocations, billing_alerts, financial_events
-- =============================================

-- 1. Fee Plans
CREATE TABLE public.fee_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  plan_type text NOT NULL DEFAULT 'monthly_fee',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  billing_frequency text NOT NULL DEFAULT 'monthly',
  due_day integer NOT NULL DEFAULT 8,
  season text,
  applies_to_scope text NOT NULL DEFAULT 'club',
  target_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  target_age_group text,
  is_active boolean NOT NULL DEFAULT true,
  is_mandatory boolean NOT NULL DEFAULT true,
  allows_override boolean NOT NULL DEFAULT true,
  auto_generate boolean NOT NULL DEFAULT true,
  send_alerts boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Fee Assignments
CREATE TABLE public.fee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_plan_id uuid NOT NULL REFERENCES public.fee_plans(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  guardian_id uuid REFERENCES public.guardian_profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  age_group text,
  season text,
  custom_amount numeric(10,2),
  discount_type text,
  discount_value numeric(10,2) DEFAULT 0,
  discount_reason text,
  is_scholarship boolean NOT NULL DEFAULT false,
  is_exempt boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Charges (invoices/billing items)
CREATE TABLE public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  fee_assignment_id uuid REFERENCES public.fee_assignments(id) ON DELETE SET NULL,
  fee_plan_id uuid REFERENCES public.fee_plans(id) ON DELETE SET NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  guardian_id uuid REFERENCES public.guardian_profiles(id) ON DELETE SET NULL,
  charge_type text NOT NULL DEFAULT 'monthly_fee',
  description text NOT NULL,
  reference_month integer,
  reference_year integer,
  season text,
  original_amount numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  final_amount numeric(10,2) NOT NULL,
  balance_due numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  late_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_charges_club_status ON public.charges(club_id, status);
CREATE INDEX idx_charges_player ON public.charges(player_id);
CREATE INDEX idx_charges_guardian ON public.charges(guardian_id);
CREATE INDEX idx_charges_due_date ON public.charges(due_date);
CREATE UNIQUE INDEX idx_charges_no_dup ON public.charges(fee_assignment_id, reference_month, reference_year) WHERE status != 'cancelled';

-- 4. Payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  guardian_id uuid REFERENCES public.guardian_profiles(id) ON DELETE SET NULL,
  amount_paid numeric(10,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash',
  transaction_reference text,
  notes text,
  received_by_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Payment Allocations (links payments to charges)
CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  charge_id uuid NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  allocated_amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Billing Alerts
CREATE TABLE public.billing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  guardian_id uuid REFERENCES public.guardian_profiles(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  recipient_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Financial Events (audit trail)
CREATE TABLE public.financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_user_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_events_club ON public.financial_events(club_id, created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_fee_plans_updated_at BEFORE UPDATE ON public.fee_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fee_assignments_updated_at BEFORE UPDATE ON public.fee_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_charges_updated_at BEFORE UPDATE ON public.charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

-- Helper: is_club_financial_admin (club owner or admin/coordenador staff)
CREATE OR REPLACE FUNCTION public.is_club_financial_admin(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = _club_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id AND user_id = _user_id
      AND role IN ('admin', 'coordenador') AND is_active = true
  )
$$;

-- Helper: is guardian of charge
CREATE OR REPLACE FUNCTION public.is_guardian_of_charge(_user_id uuid, _charge_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.charges c
    JOIN public.guardian_profiles gp ON gp.id = c.guardian_id
    WHERE c.id = _charge_id AND gp.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.charges c
    JOIN public.player_guardians pg ON pg.player_id = c.player_id
    JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
    WHERE c.id = _charge_id AND gp.user_id = _user_id
  )
$$;

-- fee_plans: admin read/write
CREATE POLICY "fee_plans_select" ON public.fee_plans FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "fee_plans_insert" ON public.fee_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "fee_plans_update" ON public.fee_plans FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "fee_plans_delete" ON public.fee_plans FOR DELETE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- fee_assignments: admin read/write
CREATE POLICY "fee_assignments_select" ON public.fee_assignments FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "fee_assignments_insert" ON public.fee_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "fee_assignments_update" ON public.fee_assignments FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- charges: admin full + guardian read own
CREATE POLICY "charges_admin_select" ON public.charges FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "charges_guardian_select" ON public.charges FOR SELECT TO authenticated
  USING (public.is_guardian_of_charge(auth.uid(), id));
CREATE POLICY "charges_insert" ON public.charges FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "charges_update" ON public.charges FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- payments: admin full
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "payments_guardian_select" ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guardian_profiles gp WHERE gp.id = payments.guardian_id AND gp.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.payment_allocations pa
      JOIN public.charges c ON c.id = pa.charge_id
      JOIN public.player_guardians pg ON pg.player_id = c.player_id
      JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
      WHERE pa.payment_id = payments.id AND gp.user_id = auth.uid()
    )
  );
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- payment_allocations: admin via charge/payment
CREATE POLICY "payment_alloc_select" ON public.payment_allocations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id AND public.is_club_financial_admin(auth.uid(), p.club_id))
    OR EXISTS (SELECT 1 FROM public.charges c WHERE c.id = charge_id AND public.is_guardian_of_charge(auth.uid(), c.id))
  );
CREATE POLICY "payment_alloc_insert" ON public.payment_allocations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id AND public.is_club_financial_admin(auth.uid(), p.club_id))
  );

-- billing_alerts: admin read/write, guardian own read
CREATE POLICY "billing_alerts_admin" ON public.billing_alerts FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "billing_alerts_guardian" ON public.billing_alerts FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());
CREATE POLICY "billing_alerts_insert" ON public.billing_alerts FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- financial_events: admin only
CREATE POLICY "financial_events_select" ON public.financial_events FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "financial_events_insert" ON public.financial_events FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));
