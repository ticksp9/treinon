import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface InviteDelivery {
  id: string;
  invite_id: string;
  delivery_channel: 'email' | 'sms' | 'whatsapp';
  template_key: string | null;
  template_id: string | null;
  version_id: string | null;
  rendered_subject: string | null;
  rendered_message: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  provider_name: string | null;
  provider_message_id: string | null;
  send_status: string;
  failure_reason: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_attempt_at: string | null;
  sent_by_user_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InviteEvent {
  id: string;
  invite_id: string;
  delivery_id: string | null;
  event_type: string;
  event_source: string;
  actor_user_id: string | null;
  payload: any;
  created_at: string;
}

export function useInviteDeliveries(inviteId: string | null) {
  return useQuery({
    queryKey: ['invite-deliveries', inviteId],
    queryFn: async () => {
      if (!inviteId) return [];
      const { data, error } = await supabase
        .from('invite_deliveries')
        .select('*')
        .eq('invite_id', inviteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InviteDelivery[];
    },
    enabled: !!inviteId,
  });
}

export function useInviteEvents(inviteId: string | null) {
  return useQuery({
    queryKey: ['invite-events', inviteId],
    queryFn: async () => {
      if (!inviteId) return [];
      const { data, error } = await supabase
        .from('invite_events')
        .select('*')
        .eq('invite_id', inviteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InviteEvent[];
    },
    enabled: !!inviteId,
  });
}

export function useInviteTemplates(profileType: string | null, channel: string | null) {
  return useQuery({
    queryKey: ['invite-templates', profileType, channel],
    queryFn: async () => {
      let query = supabase
        .from('invite_templates')
        .select('*')
        .eq('is_active', true);
      if (profileType) query = query.eq('profile_type', profileType);
      if (channel) query = query.eq('delivery_channel', channel);
      const { data, error } = await query.order('is_default', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!(profileType || channel),
  });
}

export function useSendInvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      invite_id: string;
      channels: ('email' | 'sms' | 'whatsapp')[];
      context: Record<string, string>;
      email?: string;
      phone?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { deliveries: { id: string; channel: string; status: string }[] };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['invite-deliveries', vars.invite_id] });
      queryClient.invalidateQueries({ queryKey: ['invite-events', vars.invite_id] });
      queryClient.invalidateQueries({ queryKey: ['access-invites'] });
      queryClient.invalidateQueries({ queryKey: ['access-invites-player'] });
      queryClient.invalidateQueries({ queryKey: ['communication-invites'] });
    },
  });
}

export function useManualRetry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: { action: 'manual_retry', delivery_id: deliveryId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['invite-events'] });
      queryClient.invalidateQueries({ queryKey: ['communication-invites'] });
    },
  });
}
