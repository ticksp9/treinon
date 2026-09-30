/**
 * Post-match player ratings (1–10, like Football Manager). Saved on match_lineups.rating
 * and used for each player's form and evolution charts.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Star, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeRating, playerOfTheMatch, ratingBg } from '@/lib/player-card';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  player_id: string;
  minutes_played: number | null;
  rating: number | null;
  player: { name: string; number: number | null } | null;
}

export function MatchRatingsPanel({ matchId }: { matchId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('match_lineups')
        .select('id, player_id, minutes_played, rating, player:players(name, number)')
        .eq('match_id', matchId);
      if (!alive) return;
      const list = ((data ?? []) as unknown as Row[])
        .map((r) => ({ ...r, player: Array.isArray(r.player) ? r.player[0] : r.player }))
        .filter((r) => (r.minutes_played ?? 0) > 0) // only who played
        .sort((a, b) => (a.player?.number ?? 99) - (b.player?.number ?? 99));
      setRows(list);
      setDraft(Object.fromEntries(list.map((r) => [r.id, r.rating != null ? Number(r.rating) : null])));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [matchId]);

  const step = (id: string, delta: number) =>
    setDraft((d) => ({ ...d, [id]: normalizeRating((d[id] ?? 6) + (d[id] == null ? 0 : delta)) }));

  const motm = playerOfTheMatch(rows.map((r) => ({ player_id: r.id, rating: draft[r.id] ?? null, minutes: r.minutes_played })));
  const changed = rows.some((r) => (r.rating != null ? Number(r.rating) : null) !== (draft[r.id] ?? null));

  const save = async () => {
    setSaving(true);
    try {
      for (const r of rows) {
        const v = draft[r.id] ?? null;
        if ((r.rating != null ? Number(r.rating) : null) === v) continue;
        const { error } = await supabase.from('match_lineups').update({ rating: v }).eq('id', r.id);
        if (error) throw error;
      }
      setRows((prev) => prev.map((r) => ({ ...r, rating: draft[r.id] ?? null })));
      toast.success('Notas guardadas — já contam para a forma de cada jogador.');
    } catch (e) {
      toast.error('Não foi possível guardar: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-accent" /> Notas do jogo
        </CardTitle>
        <CardDescription>1 a 10, como no Football Manager. Toque em + para começar em 6.0.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.map((r) => {
          const v = draft[r.id] ?? null;
          return (
            <div key={r.id} className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5', motm === r.id && 'border-accent bg-accent/5')}>
              <span className="w-6 text-center font-mono text-xs text-muted-foreground">{r.player?.number ?? '–'}</span>
              <span className="flex-1 truncate text-sm font-medium">
                {r.player?.name ?? '—'}
                {motm === r.id && <span className="ml-2 text-xs font-semibold text-accent">★ Melhor em campo</span>}
              </span>
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{r.minutes_played}'</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => step(r.id, -0.5)} disabled={v == null} aria-label="Baixar nota">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className={cn('w-11 rounded py-1 text-center font-mono text-sm font-bold', ratingBg(v))}>{v == null ? '—' : v.toFixed(1)}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => step(r.id, +0.5)} aria-label="Subir nota">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={!changed || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar notas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
