import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

// ========== Payment Intents ==========
export function usePaymentIntents(clubId: string | undefined) {
  return useQuery({
    queryKey: ['payment-intents', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_intents')
        .select('*, charges(description, balance_due, players(name))')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useCreateCheckoutSession(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      chargeId?: string;
      chargeIds?: string[];
      amount?: number;
      paymentMethod?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('create-payment', {
        body: {
          action: 'create_checkout',
          club_id: clubId,
          charge_id: params.chargeId,
          charge_ids: params.chargeIds,
          amount: params.amount,
          payment_method: params.paymentMethod || 'card',
          success_url: `${window.location.origin}/erp/billing?payment=success`,
          cancel_url: `${window.location.origin}/erp/billing?payment=cancelled`,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payment-intents'] });
      if (data.checkout_url) {
        window.open(data.checkout_url, '_blank');
        toast.success('Link de pagamento criado');
      }
    },
    onError: (e: any) => toast.error('Erro ao criar pagamento: ' + e.message),
  });
}

export function useCreateMbWayPayment(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { chargeId: string; phone?: string }) => {
      const res = await supabase.functions.invoke('create-payment', {
        body: {
          action: 'create_mbway',
          club_id: clubId,
          charge_id: params.chargeId,
          phone: params.phone,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-intents'] });
      toast.success('Pagamento MB WAY iniciado');
    },
    onError: (e: any) => toast.error('Erro MB WAY: ' + e.message),
  });
}

// ========== Payment Transactions ==========
export function usePaymentTransactions(clubId: string | undefined) {
  return useQuery({
    queryKey: ['payment-transactions', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*, charges(description, players(name)), payment_intents(charge_id)')
        .eq('club_id', clubId!)
        .order('transaction_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useTransactionsSummary(clubId: string | undefined) {
  return useQuery({
    queryKey: ['transactions-summary', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('transaction_status, gross_amount, fee_amount, net_amount, payment_method_code')
        .eq('club_id', clubId!);
      if (error) throw error;
      const s = {
        total_gross: 0, total_fees: 0, total_net: 0,
        succeeded: 0, failed: 0, pending: 0,
        by_method: {} as Record<string, number>,
      };
      (data || []).forEach((t: any) => {
        if (t.transaction_status === 'succeeded') {
          s.total_gross += Number(t.gross_amount);
          s.total_fees += Number(t.fee_amount);
          s.total_net += Number(t.net_amount);
          s.succeeded++;
          const m = t.payment_method_code || 'other';
          s.by_method[m] = (s.by_method[m] || 0) + Number(t.gross_amount);
        } else if (t.transaction_status === 'failed') {
          s.failed++;
        } else {
          s.pending++;
        }
      });
      return s;
    },
    enabled: !!clubId,
  });
}

// ========== Bank Reconciliation ==========
export function useBankAccounts(clubId: string | undefined) {
  return useQuery({
    queryKey: ['bank-accounts', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('club_id', clubId!)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useCreateBankAccount(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (account: { bank_name: string; iban_masked?: string; account_label: string }) => {
      const { error } = await supabase.from('bank_accounts').insert({
        ...account,
        club_id: clubId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Conta bancária adicionada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useBankImports(clubId: string | undefined) {
  return useQuery({
    queryKey: ['bank-imports', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_statement_imports')
        .select('*, bank_accounts(account_label)')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useBankStatementLines(importId: string | undefined) {
  return useQuery({
    queryKey: ['bank-lines', importId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .select('*, bank_reconciliations(id, match_type, confidence_score, charge_id, payment_transaction_id)')
        .eq('import_id', importId!)
        .order('booking_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!importId,
  });
}

export function useImportStatement(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { bankAccountId: string; rows: any[] }) => {
      const res = await supabase.functions.invoke('reconciliation-engine', {
        body: {
          action: 'import_csv',
          club_id: clubId,
          bank_account_id: params.bankAccountId,
          rows: params.rows,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bank-imports'] });
      toast.success(`${data.rows_imported} linhas importadas`);
    },
    onError: (e: any) => toast.error('Erro na importação: ' + e.message),
  });
}

export function useAutoMatch(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (importId?: string) => {
      const res = await supabase.functions.invoke('reconciliation-engine', {
        body: { action: 'auto_match', club_id: clubId, import_id: importId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bank-lines'] });
      qc.invalidateQueries({ queryKey: ['bank-imports'] });
      toast.success(`${data.matched} reconciliadas, ${data.needs_review} para revisão`);
    },
    onError: (e: any) => toast.error('Erro no matching: ' + e.message),
  });
}

export function useManualMatch(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { lineId: string; chargeId?: string; transactionId?: string; notes?: string }) => {
      const res = await supabase.functions.invoke('reconciliation-engine', {
        body: {
          action: 'manual_match',
          club_id: clubId,
          line_id: params.lineId,
          charge_id: params.chargeId,
          transaction_id: params.transactionId,
          notes: params.notes,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-lines'] });
      toast.success('Reconciliação manual aplicada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useReverseMatch(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reconciliationId: string) => {
      const res = await supabase.functions.invoke('reconciliation-engine', {
        body: { action: 'reverse_match', club_id: clubId, reconciliation_id: reconciliationId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-lines'] });
      toast.success('Reconciliação revertida');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ========== Payment Events ==========
export function usePaymentEvents(clubId: string | undefined) {
  return useQuery({
    queryKey: ['payment-events', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_events')
        .select('*')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}
