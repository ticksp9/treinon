/**
 * Player card, "Football Manager" style: current ability (stars), form from the
 * last match ratings, every attribute coloured 1–10 with the change since the
 * previous evaluation, and the evolution over time.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, StarHalf, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ATTRIBUTE_CATALOG, categoryAverage, type AttributeScores } from '@/lib/player-attributes';
import { abilityStars, computeForm, currentAbility, ratingBg, ratingTone } from '@/lib/player-card';
import { cn } from '@/lib/utils';
import { getSeasonName } from '@/lib/constants';
import { POSITIONS, FOOT_OPTIONS } from '@/lib/player-constants';

interface EvalRow { evaluation_date: string; attributes: AttributeScores | null; overall_rating: number | null }
interface RatingRow { rating: number; date: string; opponent: string | null }
interface Bio { position: string | null; secondary_positions: string[] | null; foot: string | null; birth_date: string | null; height_cm: number | null; weight_kg: number | null; number: number | null }
export interface SeasonLine { season: string; team: string; games: number; starts: number; minutes: number; goals: number; assists: number; yellow: number; red: number; ratingSum: number; rated: number }

const seasonOf = (date: string) => {
  const d = new Date(date);
  const start = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; // season starts in July
  return getSeasonName(start);
};

/** Career history per season and team, from the matches the player took part in. */
export function buildHistory(
  lineups: { match_id: string; minutes: number; starter: boolean; rating: number | null; date: string; team: string }[],
  events: { match_id: string; type: string; scorer: boolean; assist: boolean }[],
): SeasonLine[] {
  const byMatch = new Map(lineups.map((l) => [l.match_id, l]));
  const lines = new Map<string, SeasonLine>();
  const lineFor = (l: { date: string; team: string }) => {
    const key = `${seasonOf(l.date)}|${l.team}`;
    if (!lines.has(key)) lines.set(key, { season: seasonOf(l.date), team: l.team, games: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, ratingSum: 0, rated: 0 });
    return lines.get(key)!;
  };
  for (const l of lineups) {
    if (l.minutes <= 0) continue;
    const x = lineFor(l);
    x.games += 1; x.minutes += l.minutes; if (l.starter) x.starts += 1;
    if (l.rating != null) { x.ratingSum += l.rating; x.rated += 1; }
  }
  for (const e of events) {
    const l = byMatch.get(e.match_id);
    if (!l) continue;
    const x = lineFor(l);
    if (e.type === 'goal' && e.scorer) x.goals += 1;
    if (e.type === 'goal' && e.assist) x.assists += 1;
    if (e.type === 'yellow_card' && e.scorer) x.yellow += 1;
    if (e.type === 'red_card' && e.scorer) x.red += 1;
  }
  return [...lines.values()].sort((a, b) => b.season.localeCompare(a.season) || a.team.localeCompare(b.team));
}

export interface AbsenceLine { date: string; opponent: string | null; reason: string }
/** Matches the player was called up for but missed, newest first, with a count per reason. */
export function summarizeAbsences(rows: { match_date: string; opponent_name: string | null; absences: unknown }[], playerId: string) {
  const list: AbsenceLine[] = [];
  for (const r of rows) {
    const map = (r.absences && typeof r.absences === 'object' ? r.absences : {}) as Record<string, unknown>;
    if (!(playerId in map)) continue;
    const reason = typeof map[playerId] === 'string' && (map[playerId] as string).trim() ? (map[playerId] as string).trim() : 'Sem motivo indicado';
    list.push({ date: r.match_date, opponent: r.opponent_name, reason });
  }
  list.sort((a, b) => b.date.localeCompare(a.date));
  const counts = new Map<string, number>();
  list.forEach((l) => counts.set(l.reason, (counts.get(l.reason) ?? 0) + 1));
  return { total: list.length, byReason: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), list };
}

const fmtDate = (d: string) => new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });

function Stars({ value }: { value: number }) {
  return (
    <span className="flex text-accent" aria-label={`${value} estrelas`}>
      {Array.from({ length: 5 }, (_, i) =>
        value >= i + 1 ? <Star key={i} className="h-4 w-4 fill-current" />
          : value >= i + 0.5 ? <StarHalf key={i} className="h-4 w-4 fill-current" />
            : <Star key={i} className="h-4 w-4 opacity-25" />)}
    </span>
  );
}

export function PlayerFMCard({ playerId }: { playerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['player-fm-card', playerId],
    queryFn: async () => {
      const [evals, lineups, bioRes, eventsRes, absRes] = await Promise.all([
        supabase.from('player_evaluations')
          .select('evaluation_date, attributes, overall_rating')
          .eq('player_id', playerId)
          .order('evaluation_date', { ascending: true }),
        supabase.from('match_lineups')
          .select('match_id, rating, minutes_played, is_starter, match:matches!inner(match_date, opponent_name, is_deleted, is_test, team:teams(name))')
          .eq('player_id', playerId).eq('match.is_deleted', false).eq('match.is_test', false),
        supabase.from('players')
          .select('position, secondary_positions, foot, birth_date, height_cm, weight_kg, number')
          .eq('id', playerId).maybeSingle(),
        supabase.from('match_events')
          .select('match_id, event_type, player_id, assist_player_id, is_opponent, match:matches!inner(is_deleted, is_test)')
          .eq('match.is_deleted', false).eq('match.is_test', false)
          .or(`player_id.eq.${playerId},assist_player_id.eq.${playerId}`),
        // called up but did not come (ill, injured, no-show)
        (supabase.from('matches') as any)
          .select('match_date, opponent_name, absences')
          .not(`absences->>${playerId}`, 'is', null)
          .eq('is_deleted', false).eq('is_test', false)
          .order('match_date', { ascending: false }).limit(100),
      ]);
      const absences = summarizeAbsences((absRes?.data ?? []) as { match_date: string; opponent_name: string | null; absences: unknown }[], playerId);
      const history = buildHistory(
        ((lineups.data ?? []) as any[]).map((l) => {
          const m = Array.isArray(l.match) ? l.match[0] : l.match;
          const t = m ? (Array.isArray(m.team) ? m.team[0] : m.team) : null;
          return m?.match_date ? { match_id: l.match_id as string, minutes: l.minutes_played ?? 0, starter: !!l.is_starter, rating: l.rating != null ? Number(l.rating) : null, date: m.match_date as string, team: t?.name ?? '—' } : null;
        }).filter((x): x is NonNullable<typeof x> => !!x),
        ((eventsRes.data ?? []) as any[]).filter((e) => !e.is_opponent).map((e) => ({ match_id: e.match_id as string, type: e.event_type as string, scorer: e.player_id === playerId, assist: e.assist_player_id === playerId })),
      );
      const ratings: RatingRow[] = ((lineups.data ?? []) as any[])
        .filter((l) => l.rating != null)
        .map((l) => {
          const m = Array.isArray(l.match) ? l.match[0] : l.match;
          return m?.match_date ? { rating: Number(l.rating), date: m.match_date as string, opponent: m.opponent_name ?? null } : null;
        })
        .filter((r): r is RatingRow => !!r)
        .sort((a, b) => a.date.localeCompare(b.date));
      return { evals: (evals.data ?? []) as unknown as EvalRow[], ratings, bio: (bioRes.data ?? null) as Bio | null, history, absences };
    },
  });

  if (isLoading || !data) return null;
  const { evals, ratings, bio, history, absences } = data;
  const age = bio?.birth_date ? Math.floor((Date.now() - new Date(bio.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const posLabel = (v: string | null | undefined) => (v ? [...POSITIONS.football, ...POSITIONS.futsal].find((p) => p.value === v)?.label ?? v : null);
  const bioItems: [string, string | null][] = [
    ['Posição', posLabel(bio?.position)],
    ['Outras posições', bio?.secondary_positions?.length ? bio.secondary_positions.map((p) => posLabel(p)).join(', ') : null],
    ['Pé preferido', bio?.foot ? FOOT_OPTIONS.find((o) => o.value === bio.foot)?.label ?? bio.foot : null],
    ['Idade', age != null ? `${age} anos` : null],
    ['Altura', bio?.height_cm ? `${bio.height_cm} cm` : null],
    ['Peso', bio?.weight_kg ? `${bio.weight_kg} kg` : null],
  ];
  const Bio = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 sm:grid-cols-3 lg:grid-cols-6">
      {bioItems.map(([label, value]) => (
        <div key={label}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('text-sm font-semibold', !value && 'font-normal text-muted-foreground')}>{value ?? '—'}</p>
        </div>
      ))}
    </div>
  );
  const Absences = absences.total > 0 && (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Faltas a jogos ({absences.total}) · {absences.byReason.map(([r, n]) => `${r} ${n}`).join(' · ')}
      </p>
      <ul className="divide-y rounded-md border text-sm">
        {absences.list.slice(0, 8).map((a) => (
          <li key={a.date + a.opponent} className="flex items-center gap-2 px-2 py-1.5">
            <span className="font-mono text-xs text-muted-foreground">{fmtDate(a.date.slice(0, 10))}</span>
            <span className="truncate">vs {a.opponent ?? '—'}</span>
            <span className="ml-auto rounded bg-destructive/10 px-1.5 text-xs font-medium text-destructive">{a.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  const HistoryTable = history.length > 0 && (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">Época</th>
              <th className="px-2 py-1.5 text-left font-medium">Equipa</th>
              <th className="px-2 py-1.5 font-medium" title="Jogos (titular)">J (T)</th>
              <th className="px-2 py-1.5 font-medium">Min</th>
              <th className="px-2 py-1.5 font-medium">Golos</th>
              <th className="px-2 py-1.5 font-medium" title="Assistências">Ass</th>
              <th className="px-2 py-1.5 font-medium" title="Amarelos / vermelhos">Cartões</th>
              <th className="px-2 py-1.5 font-medium" title="Nota média">Nota</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => {
              const avg = h.rated ? h.ratingSum / h.rated : null;
              return (
                <tr key={h.season + h.team} className="border-b last:border-0 text-center">
                  <td className="px-2 py-1.5 text-left font-mono text-xs">{h.season}</td>
                  <td className="px-2 py-1.5 text-left">{h.team}</td>
                  <td className="px-2 py-1.5 font-mono">{h.games} ({h.starts})</td>
                  <td className="px-2 py-1.5 font-mono">{h.minutes}'</td>
                  <td className="px-2 py-1.5 font-mono">{h.goals}</td>
                  <td className="px-2 py-1.5 font-mono">{h.assists}</td>
                  <td className="px-2 py-1.5 font-mono">{h.yellow}/{h.red}</td>
                  <td className={cn('px-2 py-1.5 font-mono font-semibold', ratingTone(avg))}>{avg != null ? avg.toFixed(1) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const History = (HistoryTable || Absences) && <div className="space-y-3">{HistoryTable}{Absences}</div>;

  if (evals.length === 0 && ratings.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Ficha do jogador</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {Bio}
          {History}
          <p className="text-sm text-muted-foreground">Faça uma avaliação e dê notas no fim dos jogos para ver aqui a nota, a forma e a evolução.</p>
        </CardContent>
      </Card>
    );
  }

  const latest = evals[evals.length - 1] ?? null;
  const previous = evals.length > 1 ? evals[evals.length - 2] : null;
  const ability = latest ? currentAbility(latest.attributes, latest.overall_rating) : null;
  const form = computeForm(ratings.map((r) => r.rating));

  // one timeline: ability at each evaluation + rating at each match
  const byDate = new Map<string, { date: string; ability?: number; rating?: number }>();
  for (const e of evals) {
    const a = currentAbility(e.attributes, e.overall_rating);
    if (a != null) byDate.set(e.evaluation_date, { ...(byDate.get(e.evaluation_date) ?? { date: e.evaluation_date }), ability: a });
  }
  for (const r of ratings) byDate.set(r.date, { ...(byDate.get(r.date) ?? { date: r.date }), rating: r.rating });
  const timeline = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ ...p, label: fmtDate(p.date) }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Ficha do jogador</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {Bio}
        {/* Header: ability + form */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-md border p-3">
            <span className={cn('flex h-14 w-14 items-center justify-center rounded-md font-mono text-2xl font-bold', ratingBg(ability))}>
              {ability?.toFixed(1) ?? '—'}
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Nota atual</p>
              <Stars value={abilityStars(ability)} />
              {latest && <p className="text-xs text-muted-foreground">Avaliado a {fmtDate(latest.evaluation_date)}</p>}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              Forma (últimos {form.last.length || 5} jogos)
              {form.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-green-600" />}
              {form.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
              {form.trend === 'flat' && form.last.length > 0 && <Minus className="h-3.5 w-3.5" />}
            </p>
            <div className="mt-1.5 flex items-center gap-1">
              {form.last.length === 0 && <span className="text-sm text-muted-foreground">Sem notas de jogo.</span>}
              {form.last.map((r, i) => (
                <span key={i} className={cn('w-9 rounded py-0.5 text-center font-mono text-xs font-bold', ratingBg(r))}>{r.toFixed(1)}</span>
              ))}
              {form.average != null && <span className={cn('ml-2 font-mono text-sm font-semibold', ratingTone(form.average))}>média {form.average.toFixed(1)}</span>}
            </div>
          </div>
        </div>

        {/* Attributes, FM style */}
        {latest?.attributes && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ATTRIBUTE_CATALOG.map((cat) => {
              const avg = categoryAverage(latest.attributes!, cat.key);
              return (
                <div key={cat.key}>
                  <p className="mb-1 flex items-center justify-between border-b pb-1 text-xs font-semibold uppercase tracking-wide">
                    {cat.label}
                    <span className={cn('font-mono', ratingTone(avg))}>{avg?.toFixed(1) ?? '—'}</span>
                  </p>
                  <ul className="space-y-0.5">
                    {cat.attributes.map((a) => {
                      const v = latest.attributes?.[cat.key]?.[a.key];
                      const before = previous?.attributes?.[cat.key]?.[a.key];
                      const delta = typeof v === 'number' && typeof before === 'number' ? v - before : 0;
                      return (
                        <li key={a.key} className="flex items-center justify-between text-sm">
                          <span className="truncate">{a.label}</span>
                          <span className="flex items-center gap-1">
                            {delta > 0 && <span className="text-[10px] text-green-600">▲</span>}
                            {delta < 0 && <span className="text-[10px] text-red-600">▼</span>}
                            <span className={cn('w-6 text-right font-mono font-bold', ratingTone(v))}>{v ?? '–'}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {previous && <p className="text-[11px] text-muted-foreground">▲▼ = mudança desde a avaliação de {fmtDate(previous.evaluation_date)}.</p>}

        {History}

        {/* Evolution */}
        {timeline.length >= 2 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evolução</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[1, 10]} ticks={[2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ability" name="Nota (avaliação)" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls dot />
                  <Line type="monotone" dataKey="rating" name="Nota de jogo" stroke="hsl(var(--accent))" strokeWidth={1.5} connectNulls dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
