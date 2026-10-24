import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MATCH_KINDS, kindOf, minutesByKind, type KindTotals, type MatchKind } from '@/lib/match-kind';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  ATTRIBUTE_CATALOG,
  categoryAverage,
  type AttributeScores,
} from '@/lib/player-attributes';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  CalendarClock,
  Dumbbell,
  Trophy,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { tx } from '@/lib/i18n/ui';
import { positionShort } from '@/lib/player-constants';

// ─────────────────────────────────────────── Resumo

interface SummaryProps {
  player: any;
  seasonStats: any;
  latestEval?: any;
}

export function PlayerSummaryTab({ player, seasonStats, latestEval }: SummaryProps) {
  const scores: AttributeScores =
    latestEval?.attributes && Object.keys(latestEval.attributes).length > 0
      ? latestEval.attributes
      : {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Trophy className="w-5 h-5 text-emerald-500" />}
          label={tx('Jogos')}
          value={seasonStats?.matchesPlayed ?? 0}
        />
        <StatCard
          icon={<CalendarClock className="w-5 h-5 text-sky-500" />}
          label={tx('Minutos')}
          value={`${seasonStats?.minutesPlayed ?? 0}'`}
        />
        <StatCard
          icon={<Dumbbell className="w-5 h-5 text-orange-500" />}
          label={tx('Treinos')}
          value={`${seasonStats?.trainingAttendance ?? 0}/${seasonStats?.trainingSessions ?? 0}`}
        />
        <StatCard
          icon={<Star className="w-5 h-5 text-amber-500" />}
          label={tx('Avaliação')}
          value={latestEval?.overall_rating ? `${latestEval.overall_rating}/10` : '—'}
        />
      </div>
      {seasonStats?.byKind && <KindSplit totals={seasonStats.byKind} />}

      {Object.keys(scores).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {tx('Última avaliação por dimensão')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ATTRIBUTE_CATALOG.map((cat) => {
              const v = categoryAverage(scores, cat.key);
              return (
                <div key={cat.key} className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                  <p className={`text-2xl font-bold ${cat.color}`}>
                    {v != null ? v.toFixed(1) : '—'}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {(latestEval?.strengths || latestEval?.weaknesses) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {latestEval?.strengths && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">{tx('Pontos Fortes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{latestEval.strengths}</p>
              </CardContent>
            </Card>
          )}
          {latestEval?.weaknesses && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">{tx('Pontos a Melhorar')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{latestEval.weaknesses}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/** Minutes and matches in the championship, friendlies and tournaments. */
export function KindSplit({ totals }: { totals: KindTotals[] }) {
  const all = totals.reduce((n, t) => n + t.minutes, 0);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {totals.map((t) => {
        const label = MATCH_KINDS.find((k) => k.key === t.kind)!.label;
        return (
          <Card key={t.kind}>
            <CardContent className="space-y-1 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="font-mono text-xl font-bold tabular-nums">{t.minutes}'</p>
              </div>
              <p className="text-xs text-muted-foreground">{tx('{{n}} jogos com minutos de {{m}} convocatórias · {{s}} como titular', { n: t.played, m: t.matches, s: t.starts })}</p>
              <p className="text-xs"><span className="font-semibold">{t.goals}</span> {t.goals === 1 ? 'golo' : 'golos'} · <span className="font-semibold">{t.yellow}</span> {t.yellow === 1 ? 'amarelo' : 'amarelos'} · <span className="font-semibold">{t.red}</span> {t.red === 1 ? 'vermelho' : 'vermelhos'}</p>
              {all > 0 && <Progress value={(t.minutes / all) * 100} className="h-1.5" aria-label={tx('{{v0}}: {{v1}}% dos minutos', { v0: label, v1: Math.round((t.minutes / all) * 100) })} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────── Evolução

export function PlayerEvolutionTab({ playerId }: { playerId: string }) {
  const seasonId = useSelectedSeasonId();
  const { data: evals } = useQuery({
    queryKey: ['player-evaluations-evolution', playerId, seasonId],
    queryFn: async () => {
      // When a season is selected the chart shows only that season; otherwise it
      // shows the full progression, with every point labelled by season.
      let q = supabase
        .from('player_evaluations')
        .select('*, season:seasons(id, name)')
        .eq('player_id', playerId);
      if (seasonId) q = q.eq('season_id', seasonId);
      const { data, error } = await q.order('evaluation_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const data = (evals || []).map((e: any) => {
    const scores: AttributeScores =
      e.attributes && Object.keys(e.attributes).length > 0 ? e.attributes : {};
    const seasonName = e.season?.name || e.season_label || null;
    return {
      date: `${format(new Date(e.evaluation_date), 'dd/MM/yy')}${seasonName ? ` · ${seasonName}` : ''}`,
      Técnica: categoryAverage(scores, 'technical') ?? e.technical_rating ?? null,
      Tática: categoryAverage(scores, 'tactical') ?? e.tactical_rating ?? null,
      Física: categoryAverage(scores, 'physical') ?? e.physical_rating ?? null,
      Mental: categoryAverage(scores, 'mental') ?? e.mental_rating ?? null,
      Global: e.overall_rating ?? null,
    };
  });


  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-2" />
          <p>{tx('Sem dados de evolução. Cria avaliações para começar.')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tx('Evolução por dimensão')}</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis domain={[0, 10]} className="text-xs" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Técnica" name={tx('Técnica')} stroke="hsl(var(--primary))" />
            <Line type="monotone" dataKey="Tática" name={tx('Tática')} stroke="#a855f7" />
            <Line type="monotone" dataKey="Física" name={tx('Física')} stroke="#f97316" />
            <Line type="monotone" dataKey="Mental" name={tx('Mental')} stroke="#10b981" />
            <Line
              type="monotone"
              dataKey="Global"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────── Treinos

export function PlayerTrainingsTab({ playerId }: { playerId: string }) {
  const seasonId = useSelectedSeasonId();
  const { data, isLoading } = useQuery({
    queryKey: ['player-trainings', playerId, seasonId],
    queryFn: async () => {
      let q = supabase
        .from('training_attendance')
        .select('id, present, status, notes, recorded_at, session:training_sessions!inner(id, date, title, session_type, season_id)')
        .eq('player_id', playerId);
      if (seasonId) q = q.eq('session.season_id', seasonId);
      const { data, error } = await q.order('recorded_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <Card><CardContent className="h-32 animate-pulse" /></Card>;

  const total = data?.length ?? 0;
  const present = data?.filter((d: any) => d.present).length ?? 0;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">{tx('Presença (')}{present}/{total})</span>
            <span className="text-sm font-semibold">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </CardContent>
      </Card>
      {data && data.length > 0 ? (
        <Card>
          <CardContent className="p-0 divide-y">
            {data.map((row: any) => (
              <div key={row.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {row.session?.date
                      ? format(new Date(row.session.date), "d MMM yyyy", { locale: pt })
                      : tx('Sessão')}
                  </p>
                  {(row.session?.title || row.session?.session_type) && (
                    <p className="text-xs text-muted-foreground">{row.session.title || row.session.session_type}</p>
                  )}
                </div>
                <Badge variant={row.present ? 'default' : 'secondary'}>
                  {row.status || (row.present ? tx('Presente') : tx('Faltou'))}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {tx('Sem registos de treino.')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── Jogos

export function PlayerMatchesTab({ playerId }: { playerId: string }) {
  const seasonId = useSelectedSeasonId();
  const [kind, setKind] = useState<MatchKind | 'all'>('all');
  const { data, isLoading } = useQuery({
    queryKey: ['player-matches', playerId, seasonId],
    queryFn: async () => {
      let q = supabase
        .from('match_lineups')
        .select(
          'id, is_starter, minutes_played, position_played, rating, match:matches!inner(id, match_date, opponent_name, is_home, goals_for, goals_against, season_id, is_deleted, is_test, match_type, competition)'
        )
        .eq('player_id', playerId).eq('match.is_deleted', false).eq('match.is_test', false);
      if (seasonId) q = q.eq('match.season_id', seasonId);
      const { data, error } = await q.order('id', { ascending: false }).limit(50);
      if (error) throw error;
      // sort by match_date desc client-side
      return (data || []).sort((a: any, b: any) =>
        (b.match?.match_date || '').localeCompare(a.match?.match_date || '')
      );
    },
  });

  if (isLoading) return <Card><CardContent className="h-32 animate-pulse" /></Card>;

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {tx('Ainda sem jogos registados.')}
        </CardContent>
      </Card>
    );
  }

  const shown = kind === 'all' ? data : data.filter((r: any) => kindOf(r.match) === kind);
  return (
    <div className="space-y-2">
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={tx('Tipo de jogo')}>
      {([{ key: 'all', label: tx('Todos') }, ...MATCH_KINDS] as { key: MatchKind | 'all'; label: string }[]).map((k) => {
        const n = k.key === 'all' ? data.length : data.filter((r: any) => kindOf(r.match) === k.key).length;
        return (
          <button key={k.key} type="button" onClick={() => setKind(k.key)} aria-pressed={kind === k.key}
            className={`rounded-md border px-2.5 py-1 text-sm ${kind === k.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            {k.label} <span className="font-mono text-xs opacity-70">{n}</span>
          </button>
        );
      })}
    </div>
    <Card>
      <CardContent className="p-0 divide-y">
        {shown.map((row: any) => (
          <div key={row.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {row.match?.opponent_name || tx('Adversário')}{' '}
                {row.match?.goals_for != null && row.match?.goals_against != null && (
                  <span className="text-muted-foreground">
                    ({row.match.goals_for}-{row.match.goals_against})
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.match?.match_date
                  ? format(new Date(row.match.match_date), 'dd MMM yyyy', { locale: pt })
                  : ''}
                {row.position_played && ` · ${positionShort(row.position_played)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[11px]">{MATCH_KINDS.find((k) => k.key === kindOf(row.match))!.short}</Badge>
              {row.is_starter && <Badge variant="outline">{tx('Titular')}</Badge>}
              <Badge>{row.minutes_played ?? 0}'</Badge>
              {row.rating != null && (
                <Badge className="gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  {row.rating}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    </div>
  );
}

// ─────────────────────────────────────────── Minutos & Utilização

export function PlayerMinutesTab({ playerId, totalSeasonMinutes }: { playerId: string; totalSeasonMinutes?: number }) {
  const seasonId = useSelectedSeasonId();
  const { data } = useQuery({
    queryKey: ['player-minutes-breakdown', playerId, seasonId],
    queryFn: async () => {
      let q = supabase
        .from('match_lineups')
        .select('minutes_played, is_starter, match:matches!inner(match_date, season_id, is_deleted, is_test, match_type, competition)')
        .eq('player_id', playerId).eq('match.is_deleted', false).eq('match.is_test', false);
      if (seasonId) q = q.eq('match.season_id', seasonId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: kindEvents = [] } = useQuery({
    queryKey: ['player-kind-events', playerId, seasonId],
    queryFn: async () => {
      let q = supabase.from('match_events').select('event_type, is_opponent, match:matches!inner(season_id, is_deleted, is_test, match_type, competition)')
        .eq('player_id', playerId).eq('match.is_deleted', false).eq('match.is_test', false).in('event_type', ['goal', 'yellow_card', 'red_card']);
      if (seasonId) q = q.eq('match.season_id', seasonId);
      return ((await q).data ?? []) as unknown[];
    },
  });
  const totalMinutes = (data || []).reduce((s: number, r: any) => s + (r.minutes_played || 0), 0);
  const starts = (data || []).filter((r: any) => r.is_starter).length;
  const subs = (data || []).filter((r: any) => !r.is_starter && (r.minutes_played || 0) > 0).length;
  const dnp = (data || []).filter((r: any) => (r.minutes_played || 0) === 0).length;
  const utilizationPct = totalSeasonMinutes && totalSeasonMinutes > 0
    ? Math.round((totalMinutes / totalSeasonMinutes) * 100)
    : null;

  const series = (data || [])
    .filter((r: any) => r.match?.match_date)
    .sort((a: any, b: any) => a.match.match_date.localeCompare(b.match.match_date))
    .map((r: any, i: number) => ({
      idx: `J${i + 1}`,
      minutos: r.minutes_played || 0,
    }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<CalendarClock className="w-5 h-5 text-sky-500" />} label={tx('Total Min.')} value={`${totalMinutes}'`} />
        <StatCard icon={<Trophy className="w-5 h-5 text-emerald-500" />} label={tx('Titular')} value={starts} />
        <StatCard icon={<Target className="w-5 h-5 text-amber-500" />} label={tx('Suplente')} value={subs} />
        <StatCard icon={<Star className="w-5 h-5 text-zinc-500" />} label={tx('Não jogou')} value={dnp} />
      </div>
      <KindSplit totals={minutesByKind((data || []) as never, kindEvents as never)} />
      {utilizationPct != null && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between mb-2 text-sm">
              <span>{tx('Utilização vs. minutos da equipa')}</span>
              <span className="font-semibold">{utilizationPct}%</span>
            </div>
            <Progress value={utilizationPct} className="h-2" />
          </CardContent>
        </Card>
      )}
      {series.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{tx('Minutos por jogo')}</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="idx" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="minutos" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── Disponibilidade (placeholder)

export function PlayerAvailabilityTab({ playerId }: { playerId: string }) {
  const seasonId = useSelectedSeasonId();
  const { data: upcoming } = useQuery({
    queryKey: ['player-upcoming', playerId, seasonId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      // Team of the player in the selected season (enrollment), legacy team_id as fallback.
      let teamIds: string[] = [];
      if (seasonId) {
        const { data: enr } = await supabase
          .from('season_player_enrollments')
          .select('team_id')
          .eq('player_id', playerId)
          .eq('season_id', seasonId)
          .eq('status', 'active');
        teamIds = (enr || []).map((e: any) => e.team_id).filter(Boolean);
      }
      if (teamIds.length === 0) {
        const { data: player } = await supabase
          .from('players')
          .select('team_id')
          .eq('id', playerId)
          .maybeSingle();
        if (seasonId) return [];
        if (!player?.team_id) return [];
        teamIds = [player.team_id];
      }
      let q = supabase
        .from('matches')
        .select('id, match_date, opponent_name, is_home, season_id')
        .in('team_id', teamIds)
        .gte('match_date', today);
      if (seasonId) q = q.eq('season_id', seasonId);
      const { data } = await q.order('match_date').limit(10);
      return data || [];
    },
  });


  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tx('Próximos jogos')}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming && upcoming.length > 0 ? (
            <div className="divide-y">
              {upcoming.map((m: any) => (
                <div key={m.id} className="py-2 flex items-center justify-between">
                  <span className="text-sm">{m.opponent_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.match_date), 'dd MMM yyyy', { locale: pt })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tx('Sem jogos agendados.')}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {tx('Confirmação de presença e RSVP detalhado disponível em breve.')}
        </CardContent>
      </Card>
    </div>
  );
}
