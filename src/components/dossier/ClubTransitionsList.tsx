/**
 * Every transition record the user can see (their teams, or the whole club for coordinators):
 * who trained or played with which team, when, and whether it was evaluated. Read-only here; each
 * record is written on the player's «Plano Individual».
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { tx } from '@/lib/i18n/ui';
import { transitionKindLabel, transitionStats, transitionTarget, type PlayerTransition } from '@/lib/transitions';
import { useClubTeams } from './PlayerTransitions';

const db = supabase as any; // newer than the generated types
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function ClubTransitionsList({ clubId }: { clubId: string | null }) {
  const { user } = useAuth();
  const { data: teams = [] } = useClubTeams(clubId);
  const teamIds = teams.map((t) => t.id);
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['club-transitions', teamIds.join(',')],
    enabled: !!user && teamIds.length > 0,
    queryFn: async () => ((await db.from('player_transitions').select('*, player:players(name)').in('team_id', teamIds)
      .order('event_date', { ascending: false }).limit(200)).data ?? []) as (PlayerTransition & { player: { name: string } | null })[],
  });
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name;
  const stats = transitionStats(list);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ArrowUpRight className="h-4 w-4" />{tx('Jogadores noutro escalão')}</CardTitle>
        <CardDescription>
          {tx('O histórico do plano de transição. Regista-se na ficha do jogador, em Plano Individual.')}
          {list.length > 0 && <span className="ml-1">{tx('{{a}} jogadores · {{b}} registos · {{c}} por avaliar', { a: stats.players, b: stats.records, c: stats.withoutEvaluation })}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {!isLoading && list.length === 0 && <p className="text-sm text-muted-foreground">{tx('Sem registos.')}</p>}
        {list.map((t) => (
          <Link key={t.id} to={`/players/${t.player_id}?tab=plan`} className="block rounded-md border px-3 py-2 text-sm transition hover:border-primary hover:bg-primary/5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <b>{t.player?.name ?? '—'}</b>
              <span className="text-xs text-muted-foreground">{teamName(t.team_id) ?? ''} → {transitionTarget(t, teamName)}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">{fmt(t.event_date)}</span>
            </span>
            <span className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px]">{transitionKindLabel(t.kind)}</Badge>
              {!t.evaluation?.trim() && <Badge variant="outline" className="border-amber-500 text-[10px] text-amber-700">{tx('Falta dizer como correu')}</Badge>}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
