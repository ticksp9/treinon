import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AttributeScores } from '@/lib/player-attributes';
import { computeForm, currentAbility, type Form } from '@/lib/player-card';

export interface SquadProfile {
  ability: number | null;
  attributes: AttributeScores | null;
  evaluatedAt: string | null;
  /** match ratings oldest → newest */
  ratings: { rating: number; date: string }[];
  form: Form;
}

/**
 * Latest evaluation (ability/attributes) and match ratings (form) for a list of
 * players — the data behind the FM-style cards, pre-match and on the player page.
 */
export function useSquadProfiles(playerIds: string[]) {
  const ids = [...new Set(playerIds)].sort();
  return useQuery({
    queryKey: ['squad-profiles', ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [evals, lineups] = await Promise.all([
        supabase
          .from('player_evaluations')
          .select('player_id, evaluation_date, attributes, overall_rating')
          .in('player_id', ids)
          .order('evaluation_date', { ascending: false }),
        supabase
          .from('match_lineups')
          .select('player_id, rating, match:matches(match_date)')
          .in('player_id', ids)
          .not('rating', 'is', null),
      ]);

      const out = new Map<string, SquadProfile>();
      for (const id of ids) {
        out.set(id, { ability: null, attributes: null, evaluatedAt: null, ratings: [], form: computeForm([]) });
      }
      for (const e of (evals.data ?? []) as Array<{ player_id: string; evaluation_date: string; attributes: unknown; overall_rating: number | null }>) {
        const p = out.get(e.player_id);
        if (!p || p.evaluatedAt) continue; // first row = latest
        p.attributes = (e.attributes as AttributeScores) ?? null;
        p.ability = currentAbility(p.attributes, e.overall_rating);
        p.evaluatedAt = e.evaluation_date;
      }
      for (const l of (lineups.data ?? []) as Array<{ player_id: string; rating: number | null; match: { match_date: string } | { match_date: string }[] | null }>) {
        const p = out.get(l.player_id);
        const m = Array.isArray(l.match) ? l.match[0] : l.match;
        if (p && typeof l.rating === 'number' && m?.match_date) p.ratings.push({ rating: Number(l.rating), date: m.match_date });
      }
      out.forEach((p) => {
        p.ratings.sort((a, b) => a.date.localeCompare(b.date));
        p.form = computeForm(p.ratings.map((r) => r.rating));
      });
      return out;
    },
  });
}
