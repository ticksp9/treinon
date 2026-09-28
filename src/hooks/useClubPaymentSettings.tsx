import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PaymentMode = 'offline_manual' | 'stripe_connect' | 'stripe_direct' | 'future_provider';

export interface ClubPaymentSettings {
  id?: string;
  club_id: string;
  payment_mode: PaymentMode;
  provider: string;
  enabled: boolean;
  allow_online_payments: boolean;
  allow_manual_payments: boolean;
  default_currency: string;
  test_mode_enabled: boolean;
  live_mode_enabled: boolean;
  configuration_status: string;
}

export interface ClubPaymentAccount {
  id: string;
  club_id: string;
  provider: string;
  mode: string;
  external_account_id: string | null;
  account_type: string;
  onboarding_status: string;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  capabilities_status: any;
  country: string;
  default_currency: string;
  connected_at: string | null;
  disconnected_at: string | null;
  last_sync_at: string | null;
}

// ── Resolve club payment mode ──
export function useClubPaymentSettings(clubId: string | undefined) {
  return useQuery({
    queryKey: ['club-payment-settings', clubId],
    queryFn: async () => {
      const res = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'get_status', club_id: clubId },
      });
      if (res.error) throw res.error;
      return res.data as { settings: ClubPaymentSettings; account: ClubPaymentAccount | null };
    },
    enabled: !!clubId,
  });
}

// ── Update payment mode ──
export function useUpdatePaymentSettings(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      payment_mode?: PaymentMode;
      allow_online_payments?: boolean;
      allow_manual_payments?: boolean;
    }) => {
      const res = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'update_payment_settings', club_id: clubId, ...params },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-payment-settings'] });
      toast.success('Configuração de pagamentos atualizada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ── Stripe Connect: Create account ──
export function useCreateConnectAccount(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'create_account', club_id: clubId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-payment-settings'] });
      toast.success('Conta Stripe Connect criada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ── Stripe Connect: Onboarding link ──
export function useCreateOnboardingLink(clubId: string | undefined) {
  return useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create_onboarding_link',
          club_id: clubId,
          return_url: `${window.location.origin}/erp/payments?tab=config&onboarding=complete`,
          refresh_url: `${window.location.origin}/erp/payments?tab=config&refresh=true`,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
        toast.success('Link de onboarding aberto');
      }
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ── Stripe Connect: Sync account ──
export function useSyncConnectAccount(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'sync_account', club_id: clubId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-payment-settings'] });
      toast.success('Estado da conta sincronizado');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ── Stripe Connect: Disconnect ──
export function useDisconnectAccount(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'disconnect_account', club_id: clubId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-payment-settings'] });
      toast.success('Conta desconectada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ── Register manual payment ──
export function useRegisterManualPayment(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      charge_id: string;
      amount?: number;
      manual_method?: string;
      manual_reference?: string;
      proof_url?: string;
      notes?: string;
    }) => {
      const res = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'register_manual_payment', club_id: clubId, ...params },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payment-transactions'] });
      qc.invalidateQueries({ queryKey: ['payment-intents'] });
      qc.invalidateQueries({ queryKey: ['charges'] });
      toast.success(`Pagamento registado. Saldo restante: €${data.new_balance?.toFixed(2)}`);
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ── Config audit log ──
export function usePaymentConfigAudit(clubId: string | undefined) {
  return useQuery({
    queryKey: ['payment-config-audit', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_config_audit')
        .select('*')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}
