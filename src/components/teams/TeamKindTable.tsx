/**
 * The team's numbers by kind of match: minutes, goals and cards of every player in the
 * championship, friendlies and tournaments of the selected season. "Todos" compares the
 * three side by side; each kind has its own detailed view.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { cn } from '@/lib/utils';
import { MATCH_KINDS, sumKinds, teamByKind, type EventRow, type KindTotals, type LineupRow, type MatchKind } from '@/lib/match-kind';
import { tx } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type View = 'all' | MatchKind;

export function TeamKindTable({ teamId }: { teamId: string }) {
  const seasonId = useSelectedSeasonId();
  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<'name' | 'minutes' | 'goals'>('minutes');

  const { data, isLoading } = useQuery({
    queryKey: ['team-kind-table', teamId, seasonId],
    queryFn: async () => {
      const matchFields = 'team_id, season_id, is_deleted, is_test, match_type, competition';
      let lq = db.from('match_lineups').select(`player_id, minutes_played, is_starter, match:matches!inner(${matchFields})`)
        .eq('match.team_id', teamId).eq('match.is_deleted', false).eq('match.is_test', false);
      let eq = db.from('match_events').select(`player_id, event_type, is_opponent, match:matches!inner(${matchFields})`)
        .eq('match.team_id', teamId).eq('match.is_deleted', false).eq('match.is_test', false).in('event_type', ['goal', 'yellow_card', 'red_card']);
      if (seasonId) { lq = lq.eq('match.season_id', seasonId); eq = eq.eq('match.season_id', seasonId); }
      const [l, e, p] = await Promise.all([lq, eq, supabase.from('players').select('id, name, number').eq('team_id', teamId)]);
      if (l.error) throw l.error;
      return { lineups: (l.data ?? []) as LineupRow[], events: (e.data ?? []) as EventRow[], players: (p.data ?? []) as { id: string; name: string; number: number | null }[] };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const table = teamByKind(data.lineups, data.events);
    const names = new Map(data.players.map((p) => [p.id, p]));
    return [...table.entries()].map(([id, kinds]) => {
      const pick = view === 'all' ? sumKinds(kinds) : kinds.find((k) => k.kind === view)!;
      return { id, player: names.get(id) ?? { id, name: tx('Jogador (já não está na equipa)'), number: null }, kinds, pick };
    }).filter((r) => r.pick.matches > 0 || r.pick.goals > 0 || r.pick.yellow > 0 || r.pick.red > 0)
      .sort((a, b) => sort === 'name' ? a.player.name.localeCompare(b.player.name, 'pt') : sort === 'goals' ? b.pick.goals - a.pick.goals || b.pick.minutes - a.pick.minutes : b.pick.minutes - a.pick.minutes);
  }, [data, view, sort]);

  const byKind = (kinds: KindTotals[], k: MatchKind) => kinds.find((x) => x.kind === k)!;
  const totals = rows.reduce((s, r) => ({ minutes: s.minutes + r.pick.minutes, goals: s.goals + r.pick.goals, yellow: s.yellow + r.pick.yellow, red: s.red + r.pick.red }), { minutes: 0, goals: 0, yellow: 0, red: 0 });
  const th = 'p-2 text-right font-semibold';
  const td = 'p-2 text-right font-mono tabular-nums';
  const dash = (n: number) => (n ? n : '–');

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-primary" />{tx('Minutos, golos e cartões por tipo de jogo')}</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label={tx('Tipo de jogo')}>
            {([{ key: 'all', label: tx('Todos') }, ...MATCH_KINDS] as { key: View; label: string }[]).map((k) => (
              <button key={k.key} type="button" aria-pressed={view === k.key} onClick={() => setView(k.key)}
                className={cn('rounded-md border px-2.5 py-1 text-sm', view === k.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{k.label}</button>
            ))}
          </div>
        </div>
        {isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">{tx('A carregar…')}</p> : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{view === 'all' ? tx('Ainda não há jogos registados nesta época.') : tx('Ainda não há jogos de {{v0}} nesta época.', { v0: MATCH_KINDS.find((k) => k.key === view)!.label.toLowerCase() })}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 text-left font-semibold"><button type="button" onClick={() => setSort('name')} className={cn(sort === 'name' && 'text-foreground')}>{tx('Jogador')}</button></th>
                  {view === 'all' ? (
                    <>
                      {MATCH_KINDS.map((k) => <th key={k.key} className={th} title={tx('Minutos em {{v0}}', { v0: k.label.toLowerCase() })}>{k.short} min</th>)}
                      <th className={th}><button type="button" onClick={() => setSort('minutes')} className={cn(sort === 'minutes' && 'text-foreground')}>{tx('Total')}</button></th>
                    </>
                  ) : (
                    <>
                      <th className={th} title={tx('Convocatórias')}>{tx('Conv.')}</th>
                      <th className={th} title={tx('Jogos em que jogou')}>{tx('Jogos')}</th>
                      <th className={th} title={tx('Titular')}>{tx('Tit.')}</th>
                      <th className={th}><button type="button" onClick={() => setSort('minutes')} className={cn(sort === 'minutes' && 'text-foreground')}>{tx('Min')}</button></th>
                    </>
                  )}
                  <th className={th}><button type="button" onClick={() => setSort('goals')} className={cn(sort === 'goals' && 'text-foreground')} title={tx('Golos')}>G</button></th>
                  <th className={th} title={tx('Cartões amarelos')}><span className="inline-block h-3 w-2 rounded-sm bg-yellow-400 align-middle" aria-label={tx('Amarelos')} /></th>
                  <th className={th} title={tx('Cartões vermelhos')}><span className="inline-block h-3 w-2 rounded-sm bg-red-600 align-middle" aria-label={tx('Vermelhos')} /></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2"><Link to={`/players/${r.id}?tab=minutes`} className="hover:underline">{r.player.number != null && <span className="mr-1.5 font-mono text-muted-foreground">{r.player.number}</span>}{r.player.name}</Link></td>
                    {view === 'all' ? (
                      <>
                        {MATCH_KINDS.map((k) => <td key={k.key} className={td}>{byKind(r.kinds, k.key).minutes ? `${byKind(r.kinds, k.key).minutes}'` : '–'}</td>)}
                        <td className={cn(td, 'font-bold')}>{r.pick.minutes}'</td>
                      </>
                    ) : (
                      <>
                        <td className={td}>{r.pick.matches}</td>
                        <td className={td}>{r.pick.played}</td>
                        <td className={td}>{r.pick.starts}</td>
                        <td className={cn(td, 'font-bold')}>{r.pick.minutes}'</td>
                      </>
                    )}
                    <td className={td} title={view === 'all' ? MATCH_KINDS.map((k) => `${k.label}: ${byKind(r.kinds, k.key).goals}`).join(' · ') : undefined}>{dash(r.pick.goals)}</td>
                    <td className={td}>{dash(r.pick.yellow)}</td>
                    <td className={td}>{dash(r.pick.red)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 text-xs font-semibold">
                  <td className="p-2">{tx('Equipa')}</td>
                  {view === 'all' ? <><td colSpan={3} /><td className={td}>{totals.minutes}'</td></> : <><td colSpan={3} /><td className={td}>{totals.minutes}'</td></>}
                  <td className={td}>{totals.goals}</td><td className={td}>{totals.yellow}</td><td className={td}>{totals.red}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{tx('Época selecionada no topo. Os jogos de teste e os apagados não contam. Toque no nome para ver a ficha do jogador.')}</p>
      </CardContent>
    </Card>
  );
}
