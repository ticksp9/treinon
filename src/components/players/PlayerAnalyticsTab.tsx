import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Activity, BarChart3, Trophy,
  CalendarClock, Dumbbell, Users, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  computeMatchUsage,
  buildMinutesPerMatchSeries,
  computeAvgMinutesPerPeriod,
  computeTrainingPresence,
  buildEvolutionSeries,
  categoryEvolutionSummary,
  buildRadarFromLatest,
  computePeerCategoryAverages,
  buildAvailabilityTimeline,
  type EvaluationRow, type LineupRow, type MatchRow, type AttendanceRow, type InjuryRow,
} from '@/lib/player-analytics';

function EmptyChart({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-8 text-center text-muted-foreground">
        <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}

interface PlayerAnalyticsTabProps {
  playerId: string;
  teamId?: string | null;
  position?: string | null;
}

export function PlayerAnalyticsTab({ playerId, teamId, position }: PlayerAnalyticsTabProps) {
  const seasonId = useSelectedSeasonId();
  const { data: matches, isLoading: lMatches } = useQuery({
    queryKey: ['analytics-matches', teamId, seasonId],
    enabled: !!teamId,
    queryFn: async () => {
      let mq = supabase
        .from('matches')
        .select('id, match_date, opponent_name, is_home, goals_for, goals_against, parts_count, part_duration_minutes, starter_ids, bench_ids')
        .eq('team_id', teamId!)
        .eq('is_deleted', false);
      if (seasonId) mq = mq.eq('season_id', seasonId);
      const { data, error } = await mq.order('match_date', { ascending: true });
      if (error) throw error;
      return (data || []) as MatchRow[];
    },
  });

  const { data: lineups, isLoading: lLineups } = useQuery({
    queryKey: ['analytics-lineups', playerId, seasonId],
    queryFn: async () => {
      let q = supabase
        .from('match_lineups')
        .select('match_id, player_id, is_starter, minutes_played, position_played, rating, match:matches!inner(id, season_id, is_deleted, is_test)')
        .eq('player_id', playerId).eq('match.is_deleted', false).eq('match.is_test', false);
      if (seasonId) q = q.eq('match.season_id', seasonId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LineupRow[];
    },
  });

  const { data: attendance, isLoading: lAtt } = useQuery({
    queryKey: ['analytics-attendance', playerId, seasonId],
    queryFn: async () => {
      let q = supabase
        .from('training_attendance')
        .select('session_id, player_id, present, status, session:training_sessions!inner(date, season_id)')
        .eq('player_id', playerId);
      if (seasonId) q = q.eq('session.season_id', seasonId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        session_id: r.session_id,
        player_id: r.player_id,
        present: r.present,
        status: r.status,
        session_date: r.session?.date ?? null,
      })) as AttendanceRow[];
    },
  });

  const { data: evals, isLoading: lEvals } = useQuery({
    queryKey: ['analytics-evals', playerId, seasonId],
    queryFn: async () => {
      let q = supabase
        .from('player_evaluations')
        .select('evaluation_date, technical_rating, tactical_rating, physical_rating, mental_rating, overall_rating, attributes')
        .eq('player_id', playerId);
      if (seasonId) q = q.eq('season_id', seasonId);
      const { data, error } = await q.order('evaluation_date', { ascending: true });
      if (error) throw error;
      return (data || []) as EvaluationRow[];
    },
  });

  const { data: injuries } = useQuery({
    queryKey: ['analytics-injuries', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_injuries')
        .select('injury_date, return_date, severity')
        .eq('player_id', playerId)
        .order('injury_date', { ascending: true });
      if (error) throw error;
      return (data || []) as InjuryRow[];
    },
  });

  const { data: peerAverages } = useQuery({
    queryKey: ['analytics-peer-averages', teamId, position, seasonId],
    enabled: !!teamId && !!position,
    queryFn: async () => {
      const { data: peers } = await supabase
        .from('players')
        .select('id')
        .eq('team_id', teamId!)
        .eq('position', position!)
        .eq('is_active', true)
        .neq('id', playerId);
      const ids = (peers || []).map((p) => p.id);
      if (ids.length === 0) return null;
      let peerEvaluationsQuery = supabase
        .from('player_evaluations')
        .select('player_id, evaluation_date, technical_rating, tactical_rating, physical_rating, mental_rating, attributes')
        .in('player_id', ids);
      if (seasonId) peerEvaluationsQuery = peerEvaluationsQuery.eq('season_id', seasonId);
      const { data: pe } = await peerEvaluationsQuery.order('evaluation_date', { ascending: false });
      const seen = new Set<string>();
      const latest: EvaluationRow[] = [];
      for (const e of pe || []) {
        if (seen.has((e as any).player_id)) continue;
        seen.add((e as any).player_id);
        latest.push(e as EvaluationRow);
      }
      return computePeerCategoryAverages(latest);
    },
  });

  if (lMatches || lLineups || lAtt || lEvals) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const usage = computeMatchUsage(playerId, matches || [], lineups || []);
  const minutesSeries = buildMinutesPerMatchSeries(playerId, matches || [], lineups || []);
  const periodAverages = computeAvgMinutesPerPeriod(minutesSeries);
  const presence = computeTrainingPresence(attendance || []);
  const evolution = buildEvolutionSeries(evals || []);
  const categoryEvol = categoryEvolutionSummary(evals || []);
  const latestEval = (evals || [])[evals!.length - 1] ?? null;
  const radar = buildRadarFromLatest(latestEval, peerAverages || undefined);

  const earliestDate =
    (matches || [])[0]?.match_date?.slice(0, 10) ??
    (evals || [])[0]?.evaluation_date ??
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const availability = buildAvailabilityTimeline(injuries || [], earliestDate);

  const noData =
    (matches || []).length === 0 &&
    (evals || []).length === 0 &&
    (attendance || []).length === 0;

  if (noData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Ainda não há dados suficientes</p>
          <p className="text-sm mt-1">
            Regista treinos, jogos e avaliações para ver a progressão deste jogador.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Trophy className="w-4 h-4" />} label="Jogos realizados" value={usage.matchesPlayed} />
        <Kpi icon={<Users className="w-4 h-4" />} label="Convocado" value={usage.matchesCalled} />
        <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Não convocado" value={usage.matchesNotCalled} />
        <Kpi icon={<CalendarClock className="w-4 h-4" />} label="Min. totais" value={`${usage.totalMinutes}'`} />
        <Kpi icon={<Activity className="w-4 h-4" />} label="Média min/jogo" value={`${usage.avgMinutesPerMatch.toFixed(0)}'`} />
        <Kpi icon={<Dumbbell className="w-4 h-4" />} label="Treinos" value={`${presence.attended}/${presence.total}`} />
        <Kpi icon={<TrendingDown className="w-4 h-4" />} label="Faltas treino" value={presence.missed} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Presença" value={`${presence.presencePct}%`} />
      </div>

      {categoryEvol.some((c) => c.current != null) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução média por categoria</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categoryEvol.map((c) => (
              <div key={c.category} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                  <TrendIcon trend={c.trend} />
                </div>
                <p className="text-2xl font-bold mt-1">
                  {c.current != null ? c.current.toFixed(1) : '—'}
                </p>
                {c.delta != null && (
                  <p className={`text-xs ${c.delta > 0 ? 'text-emerald-600' : c.delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {c.delta > 0 ? '+' : ''}{c.delta} vs. anterior
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {minutesSeries.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Minutos por jogo</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={minutesSeries.map((p) => ({
                ...p,
                shortLabel: format(new Date(p.date), 'dd/MM'),
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="shortLabel" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(v: any) => [`${v}'`, 'Minutos']}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.label ?? ''
                  }
                />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <EmptyChart title="Minutos por jogo" message="Sem jogos registados ainda." />
      )}

      {periodAverages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Média de minutos por período</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={periodAverages}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: any) => [`${Number(v).toFixed(0)}'`, 'Média']} />
                <Line
                  type="monotone"
                  dataKey="avgMinutes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Convocado vs. utilizado</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { label: 'Convocado',     value: usage.matchesCalled },
                { label: 'Utilizado',     value: usage.matchesPlayed },
                { label: 'Titular',       value: usage.matchesStarted },
                { label: 'Suplente',      value: usage.matchesAsSub },
                { label: 'Não usado',     value: usage.matchesUnused },
                { label: 'Não convocado', value: usage.matchesNotCalled },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {evolution.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução das avaliações</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution.map((e) => ({
                ...e,
                date: format(new Date(e.date), 'dd/MM/yy'),
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 10]} className="text-xs" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Técnica" stroke="#3b82f6" />
                <Line type="monotone" dataKey="Tática"  stroke="#a855f7" />
                <Line type="monotone" dataKey="Física"  stroke="#f97316" />
                <Line type="monotone" dataKey="Mental"  stroke="#10b981" />
                <Line type="monotone" dataKey="Global"  stroke="hsl(var(--foreground))" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <EmptyChart title="Evolução das avaliações" message="Cria avaliações para ver a evolução." />
      )}

      {radar.some((r) => r.value > 0) ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Perfil atual {peerAverages ? '(vs. média da posição)' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="75%">
                <PolarGrid />
                <PolarAngleAxis dataKey="category" className="text-xs" />
                <PolarRadiusAxis angle={30} domain={[0, 10]} />
                <Radar name="Jogador" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                {peerAverages && (
                  <Radar name="Média posição" dataKey="positionAvg" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} />
                )}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <EmptyChart title="Perfil atual" message="Sem avaliação ainda. Adiciona uma avaliação para ver o radar." />
      )}

      {presence.total > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Participação em treinos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Presenças</span>
              <span className="font-semibold">{presence.attended} / {presence.total}</span>
            </div>
            <Progress value={presence.presencePct} className="h-2 mb-3" />
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Presente</p><p className="font-bold">{presence.attended}</p></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Faltou</p><p className="font-bold text-red-600">{presence.missed}</p></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold">{presence.total}</p></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyChart title="Participação em treinos" message="Ainda não há registo de presenças." />
      )}

      {availability.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Timeline de disponibilidade</CardTitle>
          </CardHeader>
          <CardContent>
            <AvailabilityBar segments={availability} />
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-500" /> Disponível
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-500" /> Lesionado
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon}<span>{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' | 'insufficient' }) {
  if (trend === 'up') return <Badge className="bg-emerald-500/10 text-emerald-600 gap-1"><TrendingUp className="w-3 h-3" /></Badge>;
  if (trend === 'down') return <Badge className="bg-red-500/10 text-red-600 gap-1"><TrendingDown className="w-3 h-3" /></Badge>;
  if (trend === 'flat') return <Badge variant="secondary" className="gap-1"><Minus className="w-3 h-3" /></Badge>;
  return <Badge variant="outline" className="text-xs">—</Badge>;
}

function AvailabilityBar({ segments }: { segments: { start: string; end: string; state: string; severity?: string | null }[] }) {
  const start = new Date(segments[0].start).getTime();
  const end = new Date(segments[segments.length - 1].end).getTime();
  const span = Math.max(1, end - start);
  return (
    <div>
      <div className="flex h-6 w-full rounded overflow-hidden border">
        {segments.map((s, i) => {
          const w = ((new Date(s.end).getTime() - new Date(s.start).getTime()) / span) * 100;
          const color = s.state === 'injured'
            ? (s.severity === 'severe' ? 'bg-red-700'
              : s.severity === 'moderate' ? 'bg-red-500'
              : 'bg-red-400')
            : 'bg-emerald-500';
          return (
            <div
              key={i}
              className={color}
              style={{ width: `${w}%` }}
              title={`${s.state} · ${format(new Date(s.start), 'dd/MM/yy', { locale: pt })} → ${format(new Date(s.end), 'dd/MM/yy', { locale: pt })}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{format(new Date(segments[0].start), 'MMM yyyy', { locale: pt })}</span>
        <span>{format(new Date(segments[segments.length - 1].end), 'MMM yyyy', { locale: pt })}</span>
      </div>
    </div>
  );
}
