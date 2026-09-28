
-- =============================================
-- PAYMENTS & BANK RECONCILIATION MODULE
-- =============================================

-- 1. Payment Intents (Stripe checkout sessions / payment requests)
CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  guardian_id uuid REFERENCES public.guardian_profiles(id) ON DELETE SET NULL,
  provider_type text NOT NULL DEFAULT 'stripe',
  payment_method_code text NOT NULL DEFAULT 'card',
  provider_intent_id text,
  provider_session_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'created',
  client_reference text,
  success_url text,
  cancel_url text,
  checkout_url text,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_intents_club ON public.payment_intents(club_id);
CREATE INDEX idx_payment_intents_charge ON public.payment_intents(charge_id);
CREATE INDEX idx_payment_intents_provider ON public.payment_intents(provider_intent_id);
CREATE INDEX idx_payment_intents_session ON public.payment_intents(provider_session_id);
CREATE INDEX idx_payment_intents_status ON public.payment_intents(status);

-- 2. Payment Transactions (confirmed financial records from providers)
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  provider_type text NOT NULL DEFAULT 'stripe',
  payment_method_code text NOT NULL DEFAULT 'card',
  provider_payment_id text,
  provider_charge_id text,
  provider_customer_id text,
  provider_invoice_id text,
  gross_amount numeric NOT NULL,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  transaction_status text NOT NULL DEFAULT 'pending',
  transaction_date timestamptz NOT NULL DEFAULT now(),
  available_on timestamptz,
  settlement_reference text,
  refund_status text,
  dispute_status text,
  payer_name text,
  payer_email text,
  payer_phone text,
  transaction_reference text,
  raw_provider_payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_txn_club ON public.payment_transactions(club_id);
CREATE INDEX idx_payment_txn_charge ON public.payment_transactions(charge_id);
CREATE INDEX idx_payment_txn_provider ON public.payment_transactions(provider_payment_id);
CREATE INDEX idx_payment_txn_status ON public.payment_transactions(transaction_status);
CREATE INDEX idx_payment_txn_intent ON public.payment_transactions(payment_intent_id);

-- 3. Bank Accounts
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  iban_masked text,
  bic text,
  account_label text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_accounts_club ON public.bank_accounts(club_id);

-- 4. Bank Statement Imports
CREATE TABLE public.bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'upload',
  file_name text,
  file_format text NOT NULL DEFAULT 'csv',
  period_start date,
  period_end date,
  import_status text NOT NULL DEFAULT 'pending',
  imported_by uuid,
  imported_at timestamptz DEFAULT now(),
  row_count integer DEFAULT 0,
  matched_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_imports_club ON public.bank_statement_imports(club_id);

-- 5. Bank Statement Lines
CREATE TABLE public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  booking_date date NOT NULL,
  value_date date,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  debit_credit text NOT NULL DEFAULT 'credit',
  bank_reference text,
  end_to_end_reference text,
  transaction_code text,
  remittance_info text,
  counterparty_name text,
  counterparty_iban text,
  balance_after numeric,
  raw_line_payload jsonb DEFAULT '{}',
  reconciliation_status text NOT NULL DEFAULT 'unmatched',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_lines_import ON public.bank_statement_lines(import_id);
CREATE INDEX idx_bank_lines_status ON public.bank_statement_lines(reconciliation_status);
CREATE INDEX idx_bank_lines_date ON public.bank_statement_lines(booking_date);
CREATE INDEX idx_bank_lines_amount ON public.bank_statement_lines(amount);

-- 6. Bank Reconciliations
CREATE TABLE public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  bank_statement_line_id uuid NOT NULL REFERENCES public.bank_statement_lines(id) ON DELETE CASCADE,
  payment_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL,
  match_type text NOT NULL DEFAULT 'manual',
  confidence_score numeric DEFAULT 0,
  reconciled_amount numeric NOT NULL,
  reconciled_by uuid,
  reconciled_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_recon_club ON public.bank_reconciliations(club_id);
CREATE INDEX idx_bank_recon_line ON public.bank_reconciliations(bank_statement_line_id);
CREATE INDEX idx_bank_recon_txn ON public.bank_reconciliations(payment_transaction_id);

-- 7. Payment Events (audit trail)
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  payment_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'system',
  actor_user_id uuid,
  provider_event_id text,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_club ON public.payment_events(club_id);
CREATE INDEX idx_payment_events_type ON public.payment_events(event_type);
CREATE INDEX idx_payment_events_provider ON public.payment_events(provider_event_id);

-- 8. Updated triggers
CREATE TRIGGER update_payment_intents_updated_at BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_imports_updated_at BEFORE UPDATE ON public.bank_statement_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_recon_updated_at BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Payment Intents: financial admins full access, guardians see own
CREATE POLICY "financial_admin_manage_intents" ON public.payment_intents
  FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id))
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "guardian_view_own_intents" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guardian_profiles gp
      WHERE gp.user_id = auth.uid() AND gp.id = payment_intents.guardian_id
    )
  );

-- Payment Transactions: financial admins full, guardians see linked
CREATE POLICY "financial_admin_manage_txn" ON public.payment_transactions
  FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id))
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

CREATE POLICY "guardian_view_own_txn" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (
    charge_id IS NOT NULL AND public.is_guardian_of_charge(auth.uid(), charge_id)
  );

-- Bank Accounts: financial admins only
CREATE POLICY "financial_admin_manage_bank_accounts" ON public.bank_accounts
  FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id))
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- Bank Imports: financial admins only
CREATE POLICY "financial_admin_manage_imports" ON public.bank_statement_imports
  FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id))
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- Bank Lines: via import club
CREATE POLICY "financial_admin_view_lines" ON public.bank_statement_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bank_statement_imports bsi
      WHERE bsi.id = bank_statement_lines.import_id
      AND public.is_club_financial_admin(auth.uid(), bsi.club_id)
    )
  );

-- Bank Reconciliations: financial admins only
CREATE POLICY "financial_admin_manage_recon" ON public.bank_reconciliations
  FOR ALL TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id))
  WITH CHECK (public.is_club_financial_admin(auth.uid(), club_id));

-- Payment Events: financial admins only
CREATE POLICY "financial_admin_view_events" ON public.payment_events
  FOR SELECT TO authenticated
  USING (public.is_club_financial_admin(auth.uid(), club_id));

-- Service role insert for webhooks
CREATE POLICY "service_insert_events" ON public.payment_events
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "service_insert_txn" ON public.payment_transactions
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update_txn" ON public.payment_transactions
  FOR UPDATE TO service_role
  USING (true);

CREATE POLICY "service_manage_intents" ON public.payment_intents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
