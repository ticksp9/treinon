import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { normalizeScope, type SportScope } from '@/lib/sport-scope';

/** The signed-in coach's sports (profiles.preferred_sport: football | futsal | both). */
export function useSportScope() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['sport-scope', user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('preferred_sport').eq('id', user!.id).maybeSingle();
      return normalizeScope(data?.preferred_sport);
    },
  });

  const setScope = async (scope: SportScope) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ preferred_sport: scope }).eq('id', user.id);
    if (error) throw error;
    qc.setQueryData(['sport-scope', user.id], scope);
  };

  return { scope: (query.data ?? 'football') as SportScope, loading: query.isLoading, setScope };
}
