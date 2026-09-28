import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccessInvite {
  id: string;
  scope_type: string;
  club_id: string | null;
  owner_coach_id: string | null;
  team_id: string;
  player_id: string | null;
  invite_type: 'guardian' | 'player';
  recipient_name: string;
  email: string | null;
  phone: string | null;
  invite_code: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
}

export function useTeamInvites(teamId: string | null) {
  return useQuery({
    queryKey: ['access-invites', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('access_invites')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AccessInvite[];
    },
    enabled: !!teamId,
  });
}

export function usePlayerInvites(playerId: string | null) {
  return useQuery({
    queryKey: ['access-invites-player', playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from('access_invites')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AccessInvite[];
    },
    enabled: !!playerId,
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      team_id: string;
      player_id?: string;
      invite_type: 'guardian' | 'player';
      recipient_name: string;
      email?: string;
      phone?: string;
      // SECURITY: scope_type, club_id, owner_coach_id, created_by
      // are NO LONGER sent — the server derives them.
    }) => {
      const { data, error } = await supabase.functions.invoke('manage-invites', {
        body: {
          action: 'create_invite',
          team_id: params.team_id,
          player_id: params.player_id,
          invite_type: params.invite_type,
          recipient_name: params.recipient_name,
          email: params.email,
          phone: params.phone,
          // No created_by, no user_id, no scope_type, no club_id, no owner_coach_id
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { invite_id: string; token: string; code: string; expires_at: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-invites'] });
      queryClient.invalidateQueries({ queryKey: ['access-invites-player'] });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      // SECURITY: Use edge function for server-side authorization
      const { data, error } = await supabase.functions.invoke('manage-invites', {
        body: { action: 'revoke_invite', invite_id: inviteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-invites'] });
      queryClient.invalidateQueries({ queryKey: ['access-invites-player'] });
    },
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-invites', {
        body: { action: 'resend_invite', invite_id: inviteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { token: string; code: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-invites'] });
      queryClient.invalidateQueries({ queryKey: ['access-invites-player'] });
    },
  });
}

export function useValidateInvite(token: string | null, code: string | null) {
  return useQuery({
    queryKey: ['validate-invite', token, code],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-invites', {
        body: {
          action: 'validate_invite',
          ...(token ? { token } : { code }),
        },
      });
      if (error) throw error;
      return data as {
        valid: boolean;
        error?: string;
        invite_id?: string;
        invite_type?: string;
        recipient_name?: string;
        team_name?: string;
        player_name?: string;
        context_name?: string;
        scope_type?: string;
        email?: string;
      };
    },
    enabled: !!(token || code),
    retry: false,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (params: { invite_id: string }) => {
      // SECURITY: user_id is NEVER sent — server uses auth token
      const { data, error } = await supabase.functions.invoke('manage-invites', {
        body: { action: 'accept_invite', invite_id: params.invite_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; account_type: string; redirect: string };
    },
  });
}
