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

interface EvalRow { evaluation_date: string; attributes: AttributeScores | null; overall_rating: number | null }
interface RatingRow { rating: number; date: string; opponent: string | null }

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
      const [evals, lineups] = await Promise.all([
        supabase.from('player_evaluations')
          .select('evaluation_date, attributes, overall_rating')
          .eq('player_id', playerId)
          .order('evaluation_date', { ascending: true }),
        supabase.from('match_lineups')
          .select('rating, match:matches(match_date, opponent_name)')
          .eq('player_id', playerId)
          .not('rating', 'is', null),
      ]);
      const ratings: RatingRow[] = ((lineups.data ?? []) as any[])
        .map((l) => {
          const m = Array.isArray(l.match) ? l.match[0] : l.match;
          return m?.match_date ? { rating: Number(l.rating), date: m.match_date as string, opponent: m.opponent_name ?? null } : null;
        })
        .filter((r): r is RatingRow => !!r)
        .sort((a, b) => a.date.localeCompare(b.date));
      return { evals: (evals.data ?? []) as unknown as EvalRow[], ratings };
    },
  });

  if (isLoading || !data) return null;
  const { evals, ratings } = data;
  if (evals.length === 0 && ratings.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Ficha estilo Football Manager: faça uma avaliação e dê notas no fim dos jogos para ver aqui a nota, a forma e a evolução.
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
