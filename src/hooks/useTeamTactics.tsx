/**
 * The tactics of one team (teams.tactics): read, and saved by whoever coaches the team.
 * Every screen that lists formations uses it, so they all agree on "my tactics".
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseTeamTactics, type TeamTacticsMap } from '@/lib/team-tactics';
import { useFormationsVersion } from '@/lib/custom-formations';

export function useTeamTactics(teamId: string | null | undefined) {
  const qc = useQueryClient();
  // a tactic can use a formation the coach created: parse again once those are loaded
  const version = useFormationsVersion();
  const { data: raw } = useQuery({
    queryKey: ['team-tactics', teamId],
    enabled: !!teamId,
    queryFn: async () => {
      // '*' so an older database without the column still answers
      const { data } = await supabase.from('teams').select('*').eq('id', teamId!).maybeSingle();
      return ((data as { tactics?: unknown } | null)?.tactics ?? {}) as unknown;
    },
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const map: TeamTacticsMap = parseTeamTactics(raw);
  void version;

  const save = useCallback(async (next: TeamTacticsMap): Promise<boolean> => {
    if (!teamId) return false;
    qc.setQueryData(['team-tactics', teamId], next); // the screen answers at once
    const { error } = await supabase.from('teams').update({ tactics: next } as never).eq('id', teamId);
    if (error) {
      toast.error('Não foi possível guardar as táticas: ' + error.message);
      qc.invalidateQueries({ queryKey: ['team-tactics', teamId] });
      return false;
    }
    return true;
  }, [teamId, qc]);

  return { map, save };
}
