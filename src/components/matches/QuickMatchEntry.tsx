/**
 * Quick post-match entry, for when the match could not be run live: result, and for
 * each player the minutes of each part, goals, assists and cards. Works for rolling
 * substitutions (no need to rebuild every change) and any match format (e.g. 15+15+30).
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Minus, Plus, Save, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface PlayerRow {
  player_id: string;
  name: string;
  number: number | null;
  lineupId: string | null;
  played: boolean;
  parts: number[];
  goals: number;
  assists: number;
  yellow: number;
  red: boolean;
}

interface Props {
  matchId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const clampInt = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v || 0)));

/** Spread a total over the parts (fills part 1 first), for matches entered before per-part data existed. */
export function spreadMinutes(total: number, partMinutes: number[]): number[] {
  let left = Math.max(0, total);
  return partMinutes.map((p) => { const m = Math.min(p, left); left -= m; return m; });
}

/** Give each assist to a goal of another player that has no assist yet. */
export function assignAssists(goalsByPlayer: [string, number][], assistsByPlayer: [string, number][]) {
  const goals: { scorer: string; assist: string | null }[] = [];
  goalsByPlayer.forEach(([pid, n]) => { for (let i = 0; i < n; i++) goals.push({ scorer: pid, assist: null }); });
  let unassigned = 0;
  for (const [pid, n] of assistsByPlayer) {
    for (let i = 0; i < n; i++) {
      const g = goals.find((x) => !x.assist && x.scorer !== pid);
      if (g) g.assist = pid; else unassigned++;
    }
  }
  return { goals, unassigned };
}

export function QuickMatchEntry({ matchId, open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [partMinutes, setPartMinutes] = useState<number[]>([25, 25]);
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [others, setOthers] = useState<{ id: string; name: string; number: number | null }[]>([]);
  const [goalsFor, setGoalsFor] = useState(0);
  const [goalsAgainst, setGoalsAgainst] = useState(0);
  const [scoreTouched, setScoreTouched] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).single();
      if (!m || !alive) return;
      const match = m as Record<string, any>;
      setTeamId(match.team_id);
      setTitle(`${match.is_home ? 'vs' : '@'} ${match.opponent_name}`);
      const { data: team } = await supabase.from('teams').select('*').eq('id', match.team_id).maybeSingle();
      const fmt = (team as any)?.match_format?.parts as number[] | undefined;
      const parts: number[] = Array.isArray(match.part_regulation_minutes) && match.part_regulation_minutes.length
        ? match.part_regulation_minutes
        : fmt?.length ? fmt : Array(match.parts_count || 2).fill(match.part_duration_minutes || 25);
      setPartMinutes(parts);

      const [{ data: lineups }, { data: events }, { data: roster }] = await Promise.all([
        supabase.from('match_lineups').select('id, player_id, is_starter, minutes_played, player:players(name, number)').eq('match_id', matchId),
        supabase.from('match_events').select('event_type, player_id, assist_player_id, is_opponent').eq('match_id', matchId),
        supabase.from('players').select('id, name, number').eq('team_id', match.team_id).order('number'),
      ]);
      const manual = (match.manual_minutes ?? {}) as Record<string, number[]>;
      const ev = (events ?? []) as { event_type: string; player_id: string | null; assist_player_id: string | null; is_opponent: boolean }[];
      const list: PlayerRow[] = ((lineups ?? []) as any[]).map((l) => {
        const p = Array.isArray(l.player) ? l.player[0] : l.player;
        const mine = ev.filter((e) => !e.is_opponent);
        const partsOf = manual[l.player_id] ?? spreadMinutes(l.minutes_played ?? 0, parts);
        return {
          player_id: l.player_id,
          name: p?.name ?? '—',
          number: p?.number ?? null,
          lineupId: l.id,
          played: partsOf.some((x) => x > 0),
          parts: parts.map((_, i) => partsOf[i] ?? 0),
          goals: mine.filter((e) => e.event_type === 'goal' && e.player_id === l.player_id).length,
          assists: mine.filter((e) => e.event_type === 'goal' && e.assist_player_id === l.player_id).length,
          yellow: mine.filter((e) => e.event_type === 'yellow_card' && e.player_id === l.player_id).length,
          red: mine.some((e) => e.event_type === 'red_card' && e.player_id === l.player_id),
        };
      }).sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
      const inList = new Set(list.map((r) => r.player_id));
      if (!alive) return;
      setRows(list);
      setOthers(((roster ?? []) as any[]).filter((p) => !inList.has(p.id)));
      setGoalsFor(match.goals_for ?? 0);
      setGoalsAgainst(match.goals_against ?? 0);
      setScoreTouched(match.goals_for != null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, matchId]);

  const update = (pid: string, patch: Partial<PlayerRow>) => setRows((rs) => rs.map((r) => (r.player_id === pid ? { ...r, ...patch } : r)));
  const setPart = (r: PlayerRow, i: number, v: number) => {
    const parts = r.parts.map((x, k) => (k === i ? clampInt(v, 0, partMinutes[i]) : x));
    update(r.player_id, { parts, played: parts.some((x) => x > 0) || r.played });
  };
  const totalOf = (r: PlayerRow) => r.parts.reduce((a, b) => a + b, 0);
  const ourGoals = rows.reduce((s, r) => s + (r.played ? r.goals : 0), 0);
  const shownFor = scoreTouched ? goalsFor : ourGoals;
  const matchTotal = partMinutes.reduce((a, b) => a + b, 0);
  const playedCount = rows.filter((r) => r.played).length;
  const assistsPlan = useMemo(() => assignAssists(
    rows.filter((r) => r.played).map((r) => [r.player_id, r.goals]),
    rows.filter((r) => r.played).map((r) => [r.player_id, r.assists]),
  ), [rows]);

  const addPlayer = (id: string) => {
    const p = others.find((o) => o.id === id);
    if (!p) return;
    setRows((rs) => [...rs, { player_id: p.id, name: p.name, number: p.number, lineupId: null, played: true, parts: [...partMinutes], goals: 0, assists: 0, yellow: 0, red: false }]);
    setOthers((o) => o.filter((x) => x.id !== id));
  };

  const save = async () => {
    if (!user || !teamId) return;
    setSaving(true);
    try {
      // 1. lineups: minutes, starter = played in part 1
      for (const r of rows) {
        const minutes = r.played ? totalOf(r) : 0;
        const isStarter = r.played && r.parts[0] > 0;
        if (r.lineupId) {
          const { error } = await supabase.from('match_lineups').update({ minutes_played: minutes, is_starter: isStarter }).eq('id', r.lineupId);
          if (error) throw error;
        } else if (r.played) {
          const { error } = await supabase.from('match_lineups').insert({ match_id: matchId, player_id: r.player_id, owner_id: user.id, is_starter: isStarter, minutes_played: minutes });
          if (error) throw error;
        }
      }
      // 2. goals/cards replace what was registered (substitutions stay)
      const { error: delErr } = await supabase.from('match_events').delete().eq('match_id', matchId).in('event_type', ['goal', 'yellow_card', 'red_card', 'own_goal']);
      if (delErr) throw delErr;
      const evs: Record<string, unknown>[] = [];
      for (const g of assistsPlan.goals) evs.push({ match_id: matchId, owner_id: user.id, event_type: 'goal', minute: 0, player_id: g.scorer, assist_player_id: g.assist, is_opponent: false, notes: 'registo-rapido' });
      const unattributed = Math.max(0, shownFor - ourGoals);
      for (let i = 0; i < unattributed; i++) evs.push({ match_id: matchId, owner_id: user.id, event_type: 'goal', minute: 0, player_id: null, is_opponent: false, notes: 'registo-rapido' });
      for (const r of rows.filter((x) => x.played)) {
        for (let i = 0; i < r.yellow; i++) evs.push({ match_id: matchId, owner_id: user.id, event_type: 'yellow_card', minute: 0, player_id: r.player_id, is_opponent: false, notes: 'registo-rapido' });
        if (r.red) evs.push({ match_id: matchId, owner_id: user.id, event_type: 'red_card', minute: 0, player_id: r.player_id, is_opponent: false, notes: 'registo-rapido' });
      }
      for (let i = 0; i < goalsAgainst; i++) evs.push({ match_id: matchId, owner_id: user.id, event_type: 'goal', minute: 0, player_id: null, is_opponent: true, notes: 'registo-rapido' });
      if (evs.length) {
        const { error } = await supabase.from('match_events').insert(evs as never);
        if (error) throw error;
      }
      // 3. the match itself
      const manual: Record<string, number[]> = {};
      rows.forEach((r) => { manual[r.player_id] = r.played ? r.parts : partMinutes.map(() => 0); });
      const { error: mErr } = await supabase.from('matches').update({
        goals_for: shownFor, goals_against: goalsAgainst, status: 'completed',
        report_entry_mode: 'post_game', manual_minutes: manual,
        part_regulation_minutes: partMinutes, parts_count: partMinutes.length,
      } as never).eq('id', matchId);
      if (mErr) throw mErr;
      toast.success('Jogo registado. Os minutos já contam nas estatísticas.');
      if (assistsPlan.unassigned > 0) toast.warning(`${assistsPlan.unassigned} assistência(s) sem golo correspondente não foram guardadas.`);
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error('Não foi possível guardar: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const Stepper = ({ value, onChange, max = 20 }: { value: number; onChange: (v: number) => void; max?: number }) => (
    <div className="flex items-center">
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Menos"><Minus className="h-3.5 w-3.5" /></Button>
      <span className="w-5 text-center font-mono text-sm">{value}</span>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Mais"><Plus className="h-3.5 w-3.5" /></Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Registo depois do jogo {title}</DialogTitle>
          <DialogDescription>
            Para quando não deu para usar o jogo ao vivo. Partes: {partMinutes.map((m) => `${m}'`).join(' + ')} = {matchTotal} min.
            Toque numa parte para marcar "jogou a parte toda"; escreva os minutos se jogou só um bocado.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4 rounded-lg border bg-muted/40 p-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Nós</p>
                <Input type="number" min={0} value={shownFor} onChange={(e) => { setScoreTouched(true); setGoalsFor(clampInt(Number(e.target.value), 0, 99)); }} className="h-12 w-20 text-center text-2xl font-bold" />
              </div>
              <span className="text-2xl font-bold">–</span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Adversário</p>
                <Input type="number" min={0} value={goalsAgainst} onChange={(e) => setGoalsAgainst(clampInt(Number(e.target.value), 0, 99))} className="h-12 w-20 text-center text-2xl font-bold" />
              </div>
            </div>
            {shownFor < ourGoals && <p className="text-center text-xs text-amber-600">Há {ourGoals} golos marcados nos jogadores mas o resultado diz {shownFor}.</p>}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{playedCount} jogaram</span>
              <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, played: true, parts: [...partMinutes] })))}>Todos jogaram tudo</Button>
              <Button size="sm" variant="ghost" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, played: false, parts: partMinutes.map(() => 0) })))}>Limpar</Button>
              {others.length > 0 && (
                <select className="ml-auto h-9 rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => e.target.value && addPlayer(e.target.value)} aria-label="Juntar jogador">
                  <option value="">+ Juntar jogador do plantel…</option>
                  {others.map((o) => <option key={o.id} value={o.id}>{o.number ? `${o.number}. ` : ''}{o.name}</option>)}
                </select>
              )}
            </div>

            {rows.length === 0 && (
              <p className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <UserPlus className="h-4 w-4" />Sem convocados: junte os jogadores que foram ao jogo.
              </p>
            )}

            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.player_id} className={cn('rounded-md border p-2', !r.played && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Checkbox checked={r.played} onCheckedChange={(v) => update(r.player_id, { played: !!v, parts: v ? (totalOf(r) > 0 ? r.parts : [...partMinutes]) : partMinutes.map(() => 0) })} aria-label="Jogou" />
                    <span className="w-6 text-center font-mono text-xs text-muted-foreground">{r.number ?? '–'}</span>
                    <span className="min-w-[8rem] flex-1 truncate font-medium">{r.name}</span>
                    <span className="font-mono text-sm font-semibold">{r.played ? totalOf(r) : 0}'</span>
                  </div>
                  {r.played && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-8">
                      <div className="flex flex-wrap gap-1.5">
                        {partMinutes.map((pm, i) => {
                          const full = r.parts[i] >= pm;
                          return (
                            <div key={i} className={cn('flex items-center overflow-hidden rounded-md border', full ? 'border-primary bg-primary/10' : r.parts[i] > 0 ? 'border-amber-500/60' : '')}>
                              <button type="button" className="px-2 py-1 text-xs font-medium" onClick={() => setPart(r, i, full ? 0 : pm)} title={full ? 'Não jogou esta parte' : 'Jogou a parte toda'}>
                                {i + 1}.ª
                              </button>
                              <input
                                type="number" inputMode="numeric" min={0} max={pm}
                                value={r.parts[i]}
                                onChange={(e) => setPart(r, i, Number(e.target.value))}
                                className="h-7 w-11 border-l bg-transparent text-center text-sm outline-none"
                                aria-label={`Minutos na parte ${i + 1}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 text-xs"><span>⚽</span><Stepper value={r.goals} onChange={(v) => update(r.player_id, { goals: v })} /></div>
                      <div className="flex items-center gap-1 text-xs"><span title="Assistências">🅰️</span><Stepper value={r.assists} onChange={(v) => update(r.player_id, { assists: v })} /></div>
                      <button type="button" className={cn('h-6 w-4 rounded-sm border', r.yellow > 0 ? 'bg-yellow-400 border-yellow-500' : 'border-muted-foreground/40')} onClick={() => update(r.player_id, { yellow: (r.yellow + 1) % 3 })} title="Amarelos (toque para mudar)">
                        {r.yellow > 1 && <span className="text-[9px] font-bold">2</span>}
                      </button>
                      <button type="button" className={cn('h-6 w-4 rounded-sm border', r.red ? 'bg-red-600 border-red-700' : 'border-muted-foreground/40')} onClick={() => update(r.player_id, { red: !r.red })} title="Vermelho" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">Ao guardar, os golos e cartões deste jogo passam a ser os daqui (as substituições registadas ao vivo mantêm-se).</p>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar jogo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
