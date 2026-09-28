import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { toast } from 'sonner';
import type { MatchRuleProfile } from '@/lib/match-rules-service';

export function useMatchRuleProfiles(modalityFilter?: string) {
  const { clubId } = useUserRole();

  const query = useQuery({
    queryKey: ['match-rule-profiles', clubId, modalityFilter],
    queryFn: async () => {
      let q = supabase
        .from('match_rule_profiles')
        .select('*')
        .eq('is_active', true)
        .order('modality_code')
        .order('age_group_code');

      if (modalityFilter) {
        q = q.eq('modality_code', modalityFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as MatchRuleProfile[];
    },
    staleTime: 1000 * 60 * 5,
  });

  return query;
}

export function useMatchRuleProfileMutations() {
  const queryClient = useQueryClient();
  const { clubId } = useUserRole();

  const createProfile = useMutation({
    mutationFn: async (profile: Partial<MatchRuleProfile> & { modality_code: string; name: string; max_players_on_field: number }) => {
      if (!clubId) throw new Error('Club ID required');
      const { data, error } = await supabase
        .from('match_rule_profiles')
        .insert({ ...profile, club_id: clubId, is_system_default: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-rule-profiles'] });
      toast.success('Perfil de regras criado com sucesso');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MatchRuleProfile> & { id: string }) => {
      const { data, error } = await supabase
        .from('match_rule_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-rule-profiles'] });
      toast.success('Perfil de regras atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('match_rule_profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-rule-profiles'] });
      toast.success('Perfil de regras eliminado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { createProfile, updateProfile, deleteProfile };
}

export function useMatchRuleAuditLogs() {
  const { clubId } = useUserRole();

  return useQuery({
    queryKey: ['match-rule-audit-logs', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('match_rule_audit_logs')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });
}
