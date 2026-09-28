import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  runMatchPositionEngine,
  type MatchFormationLite,
  type PlayerPositionInterval,
} from '@/lib/match-position-engine';

interface UseMatchPositionsOptions {
  matchId: string | null | undefined;
  matchEndMinuteAbs?: number;
  enabled?: boolean;
}

export function useMatchPositions({
  matchId,
  matchEndMinuteAbs = 90,
  enabled = true,
}: UseMatchPositionsOptions) {
  return useQuery({
    queryKey: ['match-positions', matchId, matchEndMinuteAbs],
    enabled: !!matchId && enabled,
    queryFn: async () => {
      const [formationsRes, positionsRes, changesRes] = await Promise.all([
        supabase
          .from('match_formations' as any)
          .select('*')
          .eq('match_id', matchId)
          .order('starts_at_minute_abs', { ascending: true }),
        supabase
          .from('match_player_positions' as any)
          .select('*')
          .eq('match_id', matchId)
          .order('starts_at_minute_abs', { ascending: true }),
        supabase
          .from('match_tactical_changes' as any)
          .select('*')
          .eq('match_id', matchId)
          .order('minute_abs', { ascending: true }),
      ]);

      if (formationsRes.error) throw formationsRes.error;
      if (positionsRes.error) throw positionsRes.error;

      const formations: MatchFormationLite[] = (formationsRes.data || []).map((f: any) => ({
        id: f.id,
        match_id: f.match_id,
        formation_code: f.formation_code,
        formation_name: f.formation_name,
        sport_type: f.sport_type,
        starts_at_minute_abs: f.starts_at_minute_abs ?? 0,
        ends_at_minute_abs: f.ends_at_minute_abs,
        part_index: f.part_index ?? 1,
      }));

      const positionEvents: PlayerPositionInterval[] = (positionsRes.data || []).map((p: any) => ({
        playerId: p.player_id,
        formationId: p.formation_id,
        slotId: p.slot_id,
        role: p.role,
        partIndex: p.part_index ?? 1,
        startMinuteAbs: p.starts_at_minute_abs,
        endMinuteAbs: p.ends_at_minute_abs,
        source: p.source,
      }));

      const engine = runMatchPositionEngine({
        formations,
        positionEvents,
        matchEndMinuteAbs,
      });

      // Current formation: the one with NULL ends_at_minute_abs and latest start
      const currentFormation = formations
        .filter(f => f.ends_at_minute_abs == null)
        .sort((a, b) => b.starts_at_minute_abs - a.starts_at_minute_abs)[0] ?? null;

      // Current slot per player: latest open interval
      const currentSlotByPlayer = new Map<string, { slotId: string; role: string | null; formationId: string | null }>();
      for (const ev of positionEvents) {
        if (ev.endMinuteAbs == null) {
          currentSlotByPlayer.set(ev.playerId, { slotId: ev.slotId, role: ev.role, formationId: ev.formationId });
        }
      }

      return {
        formations,
        positionEvents,
        changes: changesRes.data ?? [],
        currentFormation,
        currentSlotByPlayer,
        ...engine,
      };
    },
  });
}
