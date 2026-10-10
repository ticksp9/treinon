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
import { getFormation } from '@/lib/tactical-formations';

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
      const t = data as { tactics?: unknown; formation?: string | null; sport_type?: string | null } | null;
      return { tactics: t?.tactics ?? {}, formation: t?.formation ?? null, sport: t?.sport_type ?? null };
    },
  });
  void version;
  // The formation picked when the team was created ("Formação" on the team form) is how the
  // team plays: until the coach lists his tactics, it is the team's tactic and its default.
  let map: TeamTacticsMap = parseTeamTactics(raw?.tactics);
  if (raw?.sport && raw.formation && !map[raw.sport] && getFormation(raw.sport, raw.formation)) {
    map = { ...map, [raw.sport]: { list: [{ code: raw.formation }], default: raw.formation } };
  }
  const teamSport = raw?.sport ?? null;

  const save = useCallback(async (next: TeamTacticsMap): Promise<boolean> => {
    if (!teamId) return false;
    // the team card ("Equipas") shows the default formation: keep it the same thing
    const formation = (teamSport && next[teamSport]?.default) || null;
    qc.setQueryData(['team-tactics', teamId], (old: unknown) => ({ ...(old as object ?? {}), tactics: next, ...(formation ? { formation } : {}) })); // the screen answers at once
    const { error } = await supabase.from('teams').update({ tactics: next, ...(formation ? { formation } : {}) } as never).eq('id', teamId);
    if (error) {
      toast.error('Não foi possível guardar as táticas: ' + error.message);
      qc.invalidateQueries({ queryKey: ['team-tactics', teamId] });
      return false;
    }
    return true;
  }, [teamId, qc, teamSport]);

  return { map, save };
}
