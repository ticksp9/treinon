
-- ============================================
-- Procurement + Expenses + Vendors Module
-- ============================================

-- 1. Vendors
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  vendor_code TEXT,
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  tax_id TEXT,
  category TEXT DEFAULT 'other',
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  country TEXT DEFAULT 'PT',
  payment_terms TEXT DEFAULT 'net_30',
  bank_details_masked TEXT,
  preferred_payment_method TEXT DEFAULT 'bank_transfer',
  vendor_status TEXT NOT NULL DEFAULT 'active',
  risk_level TEXT DEFAULT 'low',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_by UUID
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_club_access" ON public.vendors
  FOR ALL USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE INDEX idx_vendors_club ON public.vendors(club_id);
CREATE UNIQUE INDEX idx_vendors_code ON public.vendors(club_id, vendor_code) WHERE vendor_code IS NOT NULL;

-- 2. Vendor Documents
CREATE TABLE public.vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'other',
  file_url TEXT,
  valid_from DATE,
  valid_to DATE,
  status TEXT DEFAULT 'valid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_docs_access" ON public.vendor_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND public.is_club_financial_admin(auth.uid(), v.club_id))
  );

-- 3. Vendor Contracts
CREATE TABLE public.vendor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  contract_name TEXT NOT NULL,
  contract_type TEXT DEFAULT 'service',
  start_date DATE,
  end_date DATE,
  renewal_type TEXT DEFAULT 'manual',
  notice_period_days INT,
  annual_estimated_value NUMERIC(12,2) DEFAULT 0,
  linked_cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  linked_team_id UUID REFERENCES public.teams(id),
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_contracts_access" ON public.vendor_contracts
  FOR ALL USING (public.is_club_financial_admin(auth.uid(), club_id));

-- 4. Purchase Requests
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL,
  request_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  request_type TEXT DEFAULT 'goods',
  need_by_date DATE,
  urgency TEXT DEFAULT 'normal',
  vendor_suggested_id UUID REFERENCES public.vendors(id),
  team_id UUID REFERENCES public.teams(id),
  cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  budget_category_id UUID REFERENCES public.budget_categories(id),
  season TEXT,
  estimated_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'draft',
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_club_access" ON public.purchase_requests
  FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));

CREATE INDEX idx_pr_club ON public.purchase_requests(club_id, status);

-- 5. Purchase Request Lines
CREATE TABLE public.purchase_request_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'un',
  unit_estimated_cost NUMERIC(12,2) DEFAULT 0,
  estimated_line_total NUMERIC(12,2) DEFAULT 0,
  category_id UUID REFERENCES public.budget_categories(id),
  notes TEXT
);

ALTER TABLE public.purchase_request_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prl_access" ON public.purchase_request_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = purchase_request_id AND public.is_club_staff_member(pr.club_id, auth.uid()))
  );

-- 6. Approval Workflows
CREATE TABLE public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  workflow_scope TEXT DEFAULT 'purchase_request',
  is_active BOOLEAN DEFAULT true,
  rules_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aw_access" ON public.approval_workflows
  FOR ALL USING (public.is_club_financial_admin(auth.uid(), club_id));

-- 7. Approval Steps
CREATE TABLE public.approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  step_order INT NOT NULL DEFAULT 1,
  approver_role TEXT,
  approver_user_id UUID,
  amount_min NUMERIC(12,2) DEFAULT 0,
  amount_max NUMERIC(12,2),
  requires_all BOOLEAN DEFAULT false,
  escalation_days INT DEFAULT 3,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_access" ON public.approval_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.approval_workflows aw WHERE aw.id = workflow_id AND public.is_club_financial_admin(auth.uid(), aw.club_id))
  );

-- 8. Approval Instances
CREATE TABLE public.approval_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.approval_workflows(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  current_step INT DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  final_decision_by UUID,
  final_decision_at TIMESTAMPTZ
);

ALTER TABLE public.approval_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_access" ON public.approval_instances
  FOR ALL USING (public.is_club_staff_member(club_id, auth.uid()));

-- 9. Approval Actions
CREATE TABLE public.approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_instance_id UUID NOT NULL REFERENCES public.approval_instances(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.approval_steps(id),
  actor_user_id UUID NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'approved',
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aa_access" ON public.approval_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.approval_instances ai WHERE ai.id = approval_instance_id AND public.is_club_staff_member(ai.club_id, auth.uid()))
  );

-- 10. Purchase Orders
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  po_number TEXT,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  source_purchase_request_id UUID REFERENCES public.purchase_requests(id),
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  team_id UUID REFERENCES public.teams(id),
  cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  season TEXT,
  approved_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_access" ON public.purchase_orders
  FOR ALL USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE INDEX idx_po_club ON public.purchase_orders(club_id, status);
CREATE UNIQUE INDEX idx_po_number ON public.purchase_orders(club_id, po_number) WHERE po_number IS NOT NULL;

-- 11. Purchase Order Lines
CREATE TABLE public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0,
  received_quantity NUMERIC(10,2) DEFAULT 0,
  invoiced_quantity NUMERIC(10,2) DEFAULT 0,
  category_id UUID REFERENCES public.budget_categories(id)
);

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pol_access" ON public.purchase_order_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.is_club_financial_admin(auth.uid(), po.club_id))
  );

-- 12. Goods/Service Receipts
CREATE TABLE public.goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  receipt_number TEXT,
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  vendor_id UUID REFERENCES public.vendors(id),
  receipt_type TEXT DEFAULT 'goods',
  received_by UUID NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gr_access" ON public.goods_receipts
  FOR ALL USING (public.is_club_financial_admin(auth.uid(), club_id));

-- 13. Receipt Lines
CREATE TABLE public.receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES public.purchase_order_lines(id),
  quantity_received NUMERIC(10,2) DEFAULT 0,
  condition_status TEXT DEFAULT 'good',
  notes TEXT
);

ALTER TABLE public.receipt_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rl_access" ON public.receipt_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.goods_receipts gr WHERE gr.id = receipt_id AND public.is_club_financial_admin(auth.uid(), gr.club_id))
  );

-- 14. Expense Claims
CREATE TABLE public.expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  claimant_user_id UUID NOT NULL,
  report_number TEXT,
  expense_type TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT,
  team_id UUID REFERENCES public.teams(id),
  cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  season TEXT,
  total_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'draft',
  incurred_from DATE,
  incurred_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec_access" ON public.expense_claims
  FOR ALL USING (
    public.is_club_staff_member(club_id, auth.uid())
    AND (claimant_user_id = auth.uid() OR public.is_club_financial_admin(auth.uid(), club_id))
  );

CREATE INDEX idx_ec_club ON public.expense_claims(club_id, status);

-- 15. Expense Claim Lines
CREATE TABLE public.expense_claim_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_claim_id UUID NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  merchant_name TEXT,
  category_id UUID REFERENCES public.budget_categories(id),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  receipt_url TEXT,
  payment_method_used TEXT,
  reimbursable BOOLEAN DEFAULT true,
  notes TEXT
);

ALTER TABLE public.expense_claim_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecl_access" ON public.expense_claim_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.expense_claims ec WHERE ec.id = expense_claim_id AND public.is_club_staff_member(ec.club_id, auth.uid()))
  );

-- 16. Invoices Payable
CREATE TABLE public.invoices_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  received_date DATE,
  source_po_id UUID REFERENCES public.purchase_orders(id),
  invoice_type TEXT DEFAULT 'standard',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  gross_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  outstanding_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  validation_status TEXT DEFAULT 'pending',
  duplicate_check_hash TEXT,
  document_url TEXT,
  cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  team_id UUID REFERENCES public.teams(id),
  category_id UUID REFERENCES public.budget_categories(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.invoices_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip_access" ON public.invoices_payable
  FOR ALL USING (public.is_club_financial_admin(auth.uid(), club_id));

CREATE INDEX idx_ip_club_status ON public.invoices_payable(club_id, payment_status);
CREATE INDEX idx_ip_due ON public.invoices_payable(club_id, due_date) WHERE payment_status IN ('unpaid', 'partially_paid');

-- 17. Invoice Lines
CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices_payable(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0,
  category_id UUID REFERENCES public.budget_categories(id),
  cost_center_id UUID REFERENCES public.budget_cost_centers(id),
  team_id UUID REFERENCES public.teams(id)
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "il_access" ON public.invoice_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.invoices_payable ip WHERE ip.id = invoice_id AND public.is_club_financial_admin(auth.uid(), ip.club_id))
  );

-- 18. Supplier Payments
CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  invoice_id UUID REFERENCES public.invoices_payable(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'bank_transfer',
  gross_amount NUMERIC(12,2) NOT NULL,
  fees_amount NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_access" ON public.supplier_payments
  FOR ALL USING (public.is_club_financial_admin(auth.uid(), club_id));

-- 19. Cash Advances
CREATE TABLE public.cash_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  outstanding_amount NUMERIC(12,2) NOT NULL,
  due_settlement_date DATE,
  status TEXT NOT NULL DEFAULT 'issued',
  settled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.cash_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_access" ON public.cash_advances
  FOR ALL USING (
    public.is_club_staff_member(club_id, auth.uid())
    AND (user_id = auth.uid() OR public.is_club_financial_admin(auth.uid(), club_id))
  );

-- 20. Procurement Audit Logs
CREATE TABLE public.procurement_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.procurement_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pal_access" ON public.procurement_audit_logs
  FOR SELECT USING (public.is_club_financial_admin(auth.uid(), club_id));
CREATE POLICY "pal_insert" ON public.procurement_audit_logs
  FOR INSERT WITH CHECK (public.is_club_staff_member(club_id, auth.uid()));

CREATE INDEX idx_pal_club ON public.procurement_audit_logs(club_id, entity_type, created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendor_contracts_updated_at BEFORE UPDATE ON public.vendor_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expense_claims_updated_at BEFORE UPDATE ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_payable_updated_at BEFORE UPDATE ON public.invoices_payable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON public.approval_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
