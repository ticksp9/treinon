/**
 * Treinos → Planeamento: the season's plan for the active team, in the order the FPF dossier asks for it.
 *   1. Objectives of the age group + annual plan (periods with priority and control)
 *   2. Mesocycles (blocks of weeks)
 *   3. Weeks (microcycles): objective, contents, intensity, the week's sessions and matches, review
 * Sessions are recorded in Presenças (SessionRecordCard); each week links there.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, CalendarRange, ChevronDown, ChevronUp, Layers, Loader2, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { useSeasonContext } from '@/hooks/useSeasonContext';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/i18n/ui';
import {
  activeWeeks, cleanPeriods, defaultPeriods, mesoFor, mesoKindLabel, seasonWeeks, weekEnd, weekNumber, weekRangeLabel, weekStartOf, weekSummary,
  type Mesocycle, type Microcycle, type PlanPeriod, type PlanSession,
} from '@/lib/training-plan';
import { MesocycleDialog } from './MesocycleDialog';
import { MicrocycleDialog } from './MicrocycleDialog';

const db = supabase as any; // newer than the generated types

export interface PlanMatch { id: string; match_date: string; opponent_name: string; is_home: boolean | null; status: string | null }

/** Everything the planning screens need for one team and season. */
export function useSeasonPlan(teamId: string | null, season: { id: string; start_date: string; end_date: string } | null) {
  return useQuery({
    queryKey: ['season-plan', teamId, season?.id],
    enabled: !!teamId && !!season,
    queryFn: async () => {
      const from = season!.start_date.slice(0, 10), to = season!.end_date.slice(0, 10);
      const [plan, mesos, micros, sessions, matches] = await Promise.all([
        db.from('team_season_plans').select('*').eq('team_id', teamId).eq('season_id', season!.id).maybeSingle(),
        db.from('training_mesocycles').select('*').eq('team_id', teamId).eq('season_id', season!.id).order('start_date'),
        db.from('training_microcycles').select('*').eq('team_id', teamId).gte('week_start', weekStartOf(from)).lte('week_start', to).order('week_start'),
        db.from('training_sessions').select('id, date, duration_minutes, objectives, exercises, notes, actual_minutes, session_rating, closed_at, status, session_type')
          .eq('team_id', teamId).gte('date', from).lte('date', `${to}T23:59:59`).order('date'),
        supabase.from('matches').select('id, match_date, opponent_name, is_home, status').eq('team_id', teamId!).eq('is_deleted', false)
          .gte('match_date', from).lte('match_date', `${to}T23:59:59`).order('match_date'),
      ]);
      return {
        plan: (plan.data ?? null) as { id: string; objectives: string | null; periods: PlanPeriod[] } | null,
        mesos: (mesos.data ?? []) as Mesocycle[],
        micros: (micros.data ?? []) as Microcycle[],
        sessions: (sessions.data ?? []) as PlanSession[],
        matches: (matches.data ?? []) as PlanMatch[],
      };
    },
  });
}

export function SeasonPlanning() {
  const { activeTeam } = useActiveTeam();
  const { selectedSeason } = useSeasonContext();
  const teamId = activeTeam?.id ?? null;
  const season = selectedSeason ? { id: selectedSeason.id, start_date: selectedSeason.start_date, end_date: selectedSeason.end_date } : null;
  const { data, isLoading } = useSeasonPlan(teamId, season);

  if (!teamId) return <p className="py-10 text-center text-sm text-muted-foreground">{tx('Escolha a equipa no topo do ecrã.')}</p>;
  if (!season) return <p className="py-10 text-center text-sm text-muted-foreground">{tx('Escolha primeiro a época (no topo do ecrã).')}</p>;
  if (isLoading || !data) return <p className="py-10 text-center text-sm text-muted-foreground">{tx('A carregar…')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {tx('O planeamento da época de {{team}}, como pede o dossier de treino da FPF: objetivos, plano anual, mesociclos e semanas. Os treinos registam-se em Presenças.', { team: activeTeam!.name })}
        </p>
        <Button asChild variant="outline">
          <Link to="/dossier"><BookOpenCheck className="mr-2 h-4 w-4" />{tx('Dossier da equipa')}</Link>
        </Button>
      </div>
      <ObjectivesAndPeriods teamId={teamId} season={season} plan={data.plan} />
      <MesocyclesCard teamId={teamId} season={season} mesos={data.mesos} />
      <WeeksCard teamId={teamId} season={season} data={data} />
    </div>
  );
}

// ── 1. objectives + annual plan ───────────────────────────────────────────
function ObjectivesAndPeriods({ teamId, season, plan }: {
  teamId: string; season: { id: string; start_date: string; end_date: string };
  plan: { id: string; objectives: string | null; periods: PlanPeriod[] } | null;
}) {
  const qc = useQueryClient();
  const [objectives, setObjectives] = useState(plan?.objectives ?? '');
  const [periods, setPeriods] = useState<PlanPeriod[]>(plan?.periods ?? []);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setObjectives(plan?.objectives ?? ''); setPeriods(plan?.periods ?? []); }, [plan]);

  const setPeriod = (i: number, patch: Partial<PlanPeriod>) => setPeriods((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const save = async () => {
    setSaving(true);
    try {
      const row = { team_id: teamId, season_id: season.id, objectives: objectives.trim() || null, periods: cleanPeriods(periods) };
      const { error } = await db.from('team_season_plans').upsert(row, { onConflict: 'team_id,season_id' });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['season-plan'] });
      toast.success(tx('Objetivos e plano anual guardados.'));
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4" />{tx('1. Objetivos e plano anual')}</CardTitle>
        <CardDescription>{tx('O que a equipa deve desenvolver na época e os grandes temas de cada período. Os conteúdos mantêm-se; muda a ênfase.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="plan-objectives">{tx('Objetivos do escalão para esta época')}</Label>
          <Textarea id="plan-objectives" rows={4} maxLength={8000} value={objectives} onChange={(e) => setObjectives(e.target.value)}
            placeholder={tx('Ex.: 1. Melhorar o passe e a receção orientada com os dois pés. 2. Oferecer duas linhas de passe ao portador. 3. Reagir logo à perda da bola.')} />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{tx('Plano anual (períodos)')}</Label>
            {periods.length === 0 && (
              <Button type="button" size="sm" variant="outline" onClick={() => setPeriods(defaultPeriods(season.start_date.slice(0, 10), season.end_date.slice(0, 10)))}>
                {tx('Começar com o exemplo da FPF')}
              </Button>
            )}
          </div>
          {periods.map((p, i) => (
            <div key={i} className="space-y-2 rounded-md border p-2.5">
              <div className="flex items-center gap-2">
                <Input value={p.label} maxLength={120} placeholder={tx('Período')} aria-label={tx('Período')} className="font-medium" onChange={(e) => setPeriod(i, { label: e.target.value })} />
                <Button type="button" size="icon" variant="ghost" className="shrink-0 text-muted-foreground" aria-label={tx('Retirar')}
                  onClick={() => setPeriods((ps) => ps.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={p.from} aria-label={tx('De')} onChange={(e) => setPeriod(i, { from: e.target.value })} />
                <Input type="date" value={p.to} aria-label={tx('Até')} onChange={(e) => setPeriod(i, { to: e.target.value })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={p.priority} maxLength={1000} placeholder={tx('Prioridade (ex.: desenvolver princípios e relações)')} aria-label={tx('Prioridade')} onChange={(e) => setPeriod(i, { priority: e.target.value })} />
                <Input value={p.control} maxLength={500} placeholder={tx('Controlo (ex.: avaliação intermédia)')} aria-label={tx('Controlo')} onChange={(e) => setPeriod(i, { control: e.target.value })} />
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => setPeriods((ps) => [...ps, { label: '', from: '', to: '', priority: '', control: '' }])}>
            <Plus className="mr-1 h-4 w-4" />{tx('Juntar período')}
          </Button>
        </div>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar')}</Button>
      </CardContent>
    </Card>
  );
}

// ── 2. mesocycles ─────────────────────────────────────────────────────────
function MesocyclesCard({ teamId, season, mesos }: { teamId: string; season: { id: string; start_date: string; end_date: string }; mesos: Mesocycle[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Mesocycle | 'new' | null>(null);
  const remove = async (m: Mesocycle) => {
    if (!window.confirm(tx('Apagar "{{v0}}"?', { v0: m.name }))) return;
    const { error } = await db.from('training_mesocycles').delete().eq('id', m.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['season-plan'] });
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" />{tx('2. Mesociclos (blocos de semanas)')}</CardTitle>
        <CardDescription>{tx('Cada bloco tem uma prioridade, por exemplo 4 semanas a trabalhar as transições.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {mesos.length === 0 && <p className="text-sm text-muted-foreground">{tx('Ainda sem mesociclos.')}</p>}
        {mesos.map((m) => (
          <div key={m.id} className="flex items-start gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {m.name}<Badge variant="outline" className="text-[10px]">{mesoKindLabel(m.kind)}</Badge>
                <span className="font-mono text-xs font-normal text-muted-foreground">{m.start_date.slice(8, 10)}/{m.start_date.slice(5, 7)}–{m.end_date.slice(8, 10)}/{m.end_date.slice(5, 7)}</span>
              </p>
              {m.focus && <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{m.focus}</p>}
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(m)} aria-label={tx('Editar')}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(m)} aria-label={tx('Apagar')}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}><Plus className="mr-1 h-4 w-4" />{tx('Novo mesociclo')}</Button>
      </CardContent>
      {editing && (
        <MesocycleDialog teamId={teamId} season={season} mesos={mesos} editing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

// ── 3. weeks (microcycles) ────────────────────────────────────────────────
function WeeksCard({ teamId, season, data }: {
  teamId: string; season: { id: string; start_date: string; end_date: string };
  data: { mesos: Mesocycle[]; micros: Microcycle[]; sessions: PlanSession[]; matches: PlanMatch[] };
}) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const weeks = useMemo(() => seasonWeeks(season.start_date.slice(0, 10), season.end_date.slice(0, 10)), [season.start_date, season.end_date]);
  const microBy = useMemo(() => new Map(data.micros.map((m) => [m.week_start, m])), [data.micros]);
  const thisWeek = weekStartOf(new Date());
  // around today: 2 weeks back, 4 ahead (or the start of the season)
  const idx = Math.max(0, weeks.indexOf(thisWeek) === -1 ? (thisWeek < weeks[0] ? 0 : weeks.length - 6) : weeks.indexOf(thisWeek) - 2);
  const shown = showAll ? weeks : weeks.slice(idx, idx + 7);
  const active = useMemo(() => activeWeeks(data.sessions, data.matches), [data.sessions, data.matches]);
  const missingPlans = weeks.filter((w) => w <= thisWeek && active.has(w) && !microBy.get(w)?.objectives?.trim()).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarRange className="h-4 w-4" />{tx('3. Semanas (microciclos)')}</CardTitle>
        <CardDescription>
          {tx('Toque numa semana para escrever o objetivo, os conteúdos e a intensidade; no fim da semana, o balanço.')}
          {missingPlans > 0 && <span className="ml-1 font-medium text-amber-600">{tx('{{n}} semana(s) com treinos ou jogos sem objetivo.', { n: missingPlans })}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {shown.map((w) => {
          const micro = microBy.get(w);
          const sum = weekSummary(w, micro, data.sessions);
          const meso = mesoFor(data.mesos, w) ?? mesoFor(data.mesos, weekEnd(w));
          const games = data.matches.filter((m) => weekStartOf(m.match_date) === w);
          return (
            <button key={w} type="button" onClick={() => setOpen(w)}
              className={cn('block w-full rounded-md border px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5', w === thisWeek && 'border-primary/60 bg-primary/5')}>
              <span className="flex items-baseline gap-2">
                <span className="shrink-0 text-sm font-semibold">{tx('Semana {{n}}', { n: weekNumber(season.start_date, w) })}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{weekRangeLabel(w)}</span>
                {meso && <span className="min-w-0 truncate text-xs text-muted-foreground">· {meso.name}</span>}
              </span>
              <span className="mt-0.5 block text-sm">
                {micro?.objectives?.trim() || <span className="text-muted-foreground">{tx('Sem objetivo')}</span>}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1 empty:hidden">
                {sum.sessions > 0 && (
                  <Badge variant="outline" className={cn('text-[10px]', sum.past && sum.recorded < sum.sessions && 'border-amber-500 text-amber-700')}>
                    {tx('Treinos {{a}}/{{b}} registados', { a: sum.recorded, b: sum.sessions })}
                  </Badge>
                )}
                {games.length > 0 && <Badge variant="secondary" className="text-[10px]">{games.length === 1 ? tx('1 jogo') : tx('{{n}} jogos', { n: games.length })}</Badge>}
                {sum.past && active.has(w) && (sum.reviewed
                  ? <Badge className="bg-emerald-600 text-[10px]">{tx('Balanço feito')}</Badge>
                  : <Badge variant="outline" className="text-[10px]">{tx('Falta o balanço')}</Badge>)}
              </span>
            </button>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? <><ChevronUp className="mr-1 h-4 w-4" />{tx('Mostrar só as semanas à volta de hoje')}</> : <><ChevronDown className="mr-1 h-4 w-4" />{tx('Ver todas as semanas da época ({{n}})', { n: weeks.length })}</>}
        </Button>
      </CardContent>
      {open && (
        <MicrocycleDialog teamId={teamId} seasonId={season.id} seasonStart={season.start_date} weekStart={open}
          micro={microBy.get(open) ?? null} previous={microBy.get(weeks[weeks.indexOf(open) - 1] ?? '') ?? null}
          meso={mesoFor(data.mesos, open) ?? mesoFor(data.mesos, weekEnd(open))} sessions={data.sessions} matches={data.matches} onClose={() => setOpen(null)} />
      )}
    </Card>
  );
}
