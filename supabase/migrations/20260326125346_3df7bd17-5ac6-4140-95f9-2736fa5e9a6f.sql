
-- ============================================================
-- Multi-tenant Payment Settings & Provider Architecture
-- ============================================================

-- 1. Club Payment Settings (one per club)
CREATE TABLE public.club_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  payment_mode text NOT NULL DEFAULT 'offline_manual'
    CHECK (payment_mode IN ('offline_manual', 'stripe_connect', 'stripe_direct', 'future_provider')),
  provider text DEFAULT 'none'
    CHECK (provider IN ('none', 'stripe', 'sibs', 'eupago', 'other')),
  enabled boolean NOT NULL DEFAULT true,
  allow_online_payments boolean NOT NULL DEFAULT false,
  allow_manual_payments boolean NOT NULL DEFAULT true,
  default_currency text NOT NULL DEFAULT 'EUR',
  test_mode_enabled boolean NOT NULL DEFAULT false,
  live_mode_enabled boolean NOT NULL DEFAULT false,
  configuration_status text NOT NULL DEFAULT 'not_configured'
    CHECK (configuration_status IN ('not_configured', 'pending', 'active', 'suspended', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE(club_id)
);

ALTER TABLE public.club_payment_settings ENABLE ROW LEVEL SECURITY;

-- Only club financial admins can manage payment settings
CREATE POLICY "Financial admins manage payment settings"
  ON public.club_payment_settings FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id))
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- Club staff can view (read-only)
CREATE POLICY "Club staff can view payment settings"
  ON public.club_payment_settings FOR SELECT TO authenticated
  USING (public.is_club_staff_member(club_id, auth.uid()));

-- 2. Club Payment Accounts (Stripe Connect accounts, etc.)
CREATE TABLE public.club_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe'
    CHECK (provider IN ('stripe', 'sibs', 'eupago', 'other')),
  mode text NOT NULL DEFAULT 'test'
    CHECK (mode IN ('test', 'live')),
  external_account_id text,
  account_type text DEFAULT 'standard'
    CHECK (account_type IN ('standard', 'express', 'custom', 'direct')),
  onboarding_status text NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'pending', 'complete', 'restricted', 'rejected')),
  details_submitted boolean NOT NULL DEFAULT false,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  capabilities_status jsonb DEFAULT '{}',
  country text DEFAULT 'PT',
  default_currency text DEFAULT 'EUR',
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, provider, mode)
);

ALTER TABLE public.club_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial admins manage payment accounts"
  ON public.club_payment_accounts FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id))
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- 3. Payment Config Audit Log
CREATE TABLE public.payment_config_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  action text NOT NULL,
  changed_by uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial admins view config audit"
  ON public.payment_config_audit FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "System inserts config audit"
  ON public.payment_config_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- 4. Payment Allocations table (was referenced but may not exist yet)
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  charge_id uuid NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  allocated_amount numeric NOT NULL DEFAULT 0,
  allocation_status text NOT NULL DEFAULT 'active'
    CHECK (allocation_status IN ('active', 'reversed', 'adjusted')),
  allocation_source text NOT NULL DEFAULT 'auto_match'
    CHECK (allocation_source IN ('auto_match', 'manual_match', 'webhook', 'bank_reconciliation', 'manual')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial admins manage allocations"
  ON public.payment_allocations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payment_transactions pt
      WHERE pt.id = payment_allocations.payment_id
        AND public.is_club_financial_admin(auth.uid(), pt.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payment_transactions pt
      WHERE pt.id = payment_allocations.payment_id
        AND public.is_club_financial_admin(auth.uid(), pt.club_id)
    )
  );

-- 5. Helper function to resolve club payment mode
CREATE OR REPLACE FUNCTION public.get_club_payment_mode(_club_id uuid)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT payment_mode FROM public.club_payment_settings WHERE club_id = _club_id),
    'offline_manual'
  )
$$;

-- 6. Helper function to check if club can accept online payments
CREATE OR REPLACE FUNCTION public.club_can_accept_online_payments(_club_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT allow_online_payments AND enabled AND configuration_status = 'active'
     FROM public.club_payment_settings WHERE club_id = _club_id),
    false
  )
$$;

-- 7. Updated_at triggers
CREATE TRIGGER set_updated_at_club_payment_settings
  BEFORE UPDATE ON public.club_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_club_payment_accounts
  BEFORE UPDATE ON public.club_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_payment_allocations
  BEFORE UPDATE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Add payment_mode column to payment_intents for tracking which mode was used
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'online';

-- 9. Add manual payment fields to payment_transactions
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS is_manual boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_method text,
  ADD COLUMN IF NOT EXISTS manual_reference text,
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS registered_by uuid;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_club_payment_settings_club ON public.club_payment_settings(club_id);
CREATE INDEX IF NOT EXISTS idx_club_payment_accounts_club ON public.club_payment_accounts(club_id);
CREATE INDEX IF NOT EXISTS idx_payment_config_audit_club ON public.payment_config_audit(club_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_charge ON public.payment_allocations(charge_id);
