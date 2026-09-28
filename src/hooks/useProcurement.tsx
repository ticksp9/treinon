import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

// ---- Vendor types ----
export interface Vendor {
  id: string;
  club_id: string;
  vendor_code: string | null;
  legal_name: string;
  trading_name: string | null;
  tax_id: string | null;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string;
  payment_terms: string;
  preferred_payment_method: string;
  vendor_status: string;
  risk_level: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequest {
  id: string;
  club_id: string;
  requester_user_id: string;
  request_number: string | null;
  title: string;
  description: string | null;
  request_type: string;
  need_by_date: string | null;
  urgency: string;
  vendor_suggested_id: string | null;
  team_id: string | null;
  cost_center_id: string | null;
  budget_category_id: string | null;
  season: string | null;
  estimated_amount: number;
  currency: string;
  status: string;
  justification: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoicePayable {
  id: string;
  club_id: string;
  vendor_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_type: string;
  subtotal: number;
  tax_total: number;
  gross_total: number;
  outstanding_amount: number;
  payment_status: string;
  validation_status: string;
  cost_center_id: string | null;
  team_id: string | null;
  category_id: string | null;
  notes: string | null;
  created_at: string;
  vendors?: { legal_name: string };
}

export interface ExpenseClaim {
  id: string;
  club_id: string;
  claimant_user_id: string;
  report_number: string | null;
  expense_type: string;
  title: string;
  description: string | null;
  team_id: string | null;
  cost_center_id: string | null;
  season: string | null;
  total_amount: number;
  currency: string;
  status: string;
  incurred_from: string | null;
  incurred_to: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  club_id: string;
  po_number: string | null;
  vendor_id: string;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  approved_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  vendors?: { legal_name: string };
}

export interface SupplierPayment {
  id: string;
  club_id: string;
  vendor_id: string;
  invoice_id: string | null;
  payment_date: string;
  payment_method: string;
  gross_amount: number;
  net_amount: number;
  status: string;
  reconciled: boolean;
  created_at: string;
  vendors?: { legal_name: string };
}

// ---- Aging helpers ----
export function computeAgingBuckets(invoices: InvoicePayable[]) {
  const now = new Date();
  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, over_90: 0 };
  for (const inv of invoices) {
    if (inv.payment_status === 'paid' || inv.payment_status === 'cancelled') continue;
    const due = new Date(inv.due_date);
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) buckets.current += inv.outstanding_amount;
    else if (diff <= 30) buckets.days_1_30 += inv.outstanding_amount;
    else if (diff <= 60) buckets.days_31_60 += inv.outstanding_amount;
    else if (diff <= 90) buckets.days_61_90 += inv.outstanding_amount;
    else buckets.over_90 += inv.outstanding_amount;
  }
  return buckets;
}

export function resolveApprovalLevel(amount: number): string {
  if (amount <= 500) return 'finance_staff';
  if (amount <= 2000) return 'finance_admin';
  return 'club_admin';
}

export function detectDuplicateInvoice(invoices: InvoicePayable[], vendorId: string, invoiceNumber: string, grossTotal: number): boolean {
  return invoices.some(
    inv => inv.vendor_id === vendorId && inv.invoice_number === invoiceNumber && inv.gross_total === grossTotal
  );
}

// ---- Hook ----
export function useProcurement(clubId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Vendors
  const vendorsQuery = useQuery({
    queryKey: ['vendors', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('club_id', clubId)
        .order('legal_name');
      if (error) throw error;
      return data as Vendor[];
    },
    enabled: !!clubId,
  });

  const createVendor = useMutation({
    mutationFn: async (v: Partial<Vendor>) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert({ ...v, club_id: clubId!, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      // audit
      await supabase.from('procurement_audit_logs').insert({
        club_id: clubId!, entity_type: 'vendor', entity_id: data.id,
        event_type: 'vendor_created', actor_user_id: user!.id, payload: { legal_name: v.legal_name },
      } as any);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors', clubId] }); toast.success('Fornecedor criado'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Purchase Requests
  const purchaseRequestsQuery = useQuery({
    queryKey: ['purchase-requests', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PurchaseRequest[];
    },
    enabled: !!clubId,
  });

  const createPurchaseRequest = useMutation({
    mutationFn: async (pr: Partial<PurchaseRequest>) => {
      const reqNum = `PR-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from('purchase_requests')
        .insert({ ...pr, club_id: clubId!, requester_user_id: user!.id, request_number: reqNum } as any)
        .select()
        .single();
      if (error) throw error;
      await supabase.from('procurement_audit_logs').insert({
        club_id: clubId!, entity_type: 'purchase_request', entity_id: data.id,
        event_type: 'purchase_request_created', actor_user_id: user!.id,
      } as any);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-requests', clubId] }); toast.success('Requisição criada'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePurchaseRequestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('purchase_requests')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
      await supabase.from('procurement_audit_logs').insert({
        club_id: clubId!, entity_type: 'purchase_request', entity_id: id,
        event_type: `purchase_request_${status}`, actor_user_id: user!.id,
      } as any);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-requests', clubId] }); },
  });

  // Invoices
  const invoicesQuery = useQuery({
    queryKey: ['invoices-payable', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('invoices_payable')
        .select('*, vendors(legal_name)')
        .eq('club_id', clubId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as InvoicePayable[];
    },
    enabled: !!clubId,
  });

  const createInvoice = useMutation({
    mutationFn: async (inv: Partial<InvoicePayable>) => {
      const { data, error } = await supabase
        .from('invoices_payable')
        .insert({ ...inv, club_id: clubId!, created_by: user!.id, outstanding_amount: inv.gross_total } as any)
        .select()
        .single();
      if (error) throw error;
      await supabase.from('procurement_audit_logs').insert({
        club_id: clubId!, entity_type: 'invoice', entity_id: data.id,
        event_type: 'invoice_registered', actor_user_id: user!.id,
      } as any);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices-payable', clubId] }); toast.success('Fatura registada'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Expense Claims
  const expenseClaimsQuery = useQuery({
    queryKey: ['expense-claims', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('expense_claims')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ExpenseClaim[];
    },
    enabled: !!clubId,
  });

  const createExpenseClaim = useMutation({
    mutationFn: async (ec: Partial<ExpenseClaim>) => {
      const repNum = `EXP-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from('expense_claims')
        .insert({ ...ec, club_id: clubId!, claimant_user_id: user!.id, report_number: repNum } as any)
        .select()
        .single();
      if (error) throw error;
      await supabase.from('procurement_audit_logs').insert({
        club_id: clubId!, entity_type: 'expense_claim', entity_id: data.id,
        event_type: 'expense_claim_submitted', actor_user_id: user!.id,
      } as any);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-claims', clubId] }); toast.success('Despesa submetida'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Purchase Orders
  const purchaseOrdersQuery = useQuery({
    queryKey: ['purchase-orders', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, vendors(legal_name)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!clubId,
  });

  // Supplier Payments
  const supplierPaymentsQuery = useQuery({
    queryKey: ['supplier-payments', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*, vendors(legal_name)')
        .eq('club_id', clubId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data as SupplierPayment[];
    },
    enabled: !!clubId,
  });

  const createSupplierPayment = useMutation({
    mutationFn: async (sp: Partial<SupplierPayment> & { invoice_id?: string }) => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .insert({ ...sp, club_id: clubId!, created_by: user!.id, net_amount: sp.gross_amount } as any)
        .select()
        .single();
      if (error) throw error;
      // Update invoice outstanding if linked
      if (sp.invoice_id) {
        const { data: inv } = await supabase.from('invoices_payable').select('outstanding_amount').eq('id', sp.invoice_id).single();
        if (inv) {
          const newOutstanding = Math.max(0, inv.outstanding_amount - (sp.gross_amount || 0));
          await supabase.from('invoices_payable').update({
            outstanding_amount: newOutstanding,
            payment_status: newOutstanding === 0 ? 'paid' : 'partially_paid',
          } as any).eq('id', sp.invoice_id);
        }
      }
      await supabase.from('procurement_audit_logs').insert({
        club_id: clubId!, entity_type: 'supplier_payment', entity_id: data.id,
        event_type: 'supplier_payment_created', actor_user_id: user!.id,
      } as any);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-payments', clubId] });
      qc.invalidateQueries({ queryKey: ['invoices-payable', clubId] });
      toast.success('Pagamento registado');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cash Advances
  const cashAdvancesQuery = useQuery({
    queryKey: ['cash-advances', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('cash_advances')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clubId,
  });

  // Audit Logs
  const auditLogsQuery = useQuery({
    queryKey: ['procurement-audit', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('procurement_audit_logs')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clubId,
  });

  return {
    vendors: vendorsQuery.data || [],
    vendorsLoading: vendorsQuery.isLoading,
    createVendor,
    purchaseRequests: purchaseRequestsQuery.data || [],
    purchaseRequestsLoading: purchaseRequestsQuery.isLoading,
    createPurchaseRequest,
    updatePurchaseRequestStatus,
    invoices: invoicesQuery.data || [],
    invoicesLoading: invoicesQuery.isLoading,
    createInvoice,
    expenseClaims: expenseClaimsQuery.data || [],
    expenseClaimsLoading: expenseClaimsQuery.isLoading,
    createExpenseClaim,
    purchaseOrders: purchaseOrdersQuery.data || [],
    purchaseOrdersLoading: purchaseOrdersQuery.isLoading,
    supplierPayments: supplierPaymentsQuery.data || [],
    supplierPaymentsLoading: supplierPaymentsQuery.isLoading,
    createSupplierPayment,
    cashAdvances: cashAdvancesQuery.data || [],
    auditLogs: auditLogsQuery.data || [],
    agingBuckets: computeAgingBuckets(invoicesQuery.data || []),
  };
}
