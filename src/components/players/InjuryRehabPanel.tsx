/**
 * The way back of one injury: the phase the player is in (everyone on the staff sees it),
 * the criteria of the phase and the physio sessions (medical staff), and the exercises for
 * home with how often they were done (the family ticks them in their app).
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, ExternalLink, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { PHASES, PROTOCOL_LABEL, adherence, hoursInPhase, isChecked, moveTo, phaseComplete, toggleCheck, type Checks, type HistoryEntry, type RehabProtocol } from '@/lib/rehab';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

export interface RehabInjury {
  id: string; player_id: string; return_date: string | null;
  rehab_protocol: RehabProtocol | null; rehab_phase: number | null; rehab_phase_since: string | null;
  rehab_checks: Checks | null; rehab_history: HistoryEntry[] | null; assessed_at?: string | null;
}
interface Exercise { id: string; title: string; instructions: string | null; dose: string | null; frequency: string | null; video_url: string | null; active: boolean }
interface Session { id: string; session_date: string; pain: number | null; notes: string | null }

export function InjuryRehabPanel({ injury, canClinical, onChanged }: { injury: RehabInjury; canClinical: boolean; onChanged: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [newEx, setNewEx] = useState<{ title: string; dose: string; frequency: string; video_url: string; instructions: string } | null>(null);
  const [newSession, setNewSession] = useState<{ date: string; pain: number; notes: string } | null>(null);
  const protocol = injury.rehab_protocol;
  const phase = injury.rehab_phase;
  const phases = protocol ? PHASES[protocol] : null;
  const current = phases && phase ? phases[phase - 1] : null;

  const { data: exercises = [] } = useQuery({
    queryKey: ['rehab-exercises', injury.id],
    queryFn: async () => ((await db.from('injury_home_exercises').select('*').eq('injury_id', injury.id).order('created_at')).data ?? []) as Exercise[],
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['rehab-logs', injury.id],
    enabled: exercises.length > 0,
    queryFn: async () => ((await db.from('injury_exercise_logs').select('exercise_id, done_on, pain').in('exercise_id', exercises.map((e) => e.id))).data ?? []) as { exercise_id: string; done_on: string; pain: number | null }[],
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ['rehab-sessions', injury.id],
    enabled: canClinical,
    queryFn: async () => ((await db.from('injury_sessions').select('id, session_date, pain, notes').eq('injury_id', injury.id).order('session_date')).data ?? []) as Session[],
  });
  const done = adherence(logs);

  const save = async (patch: Record<string, unknown>, ok?: string) => {
    setBusy(true);
    // working on the rehab is seeing the injury: it leaves the "to assess" list
    const seen = canClinical && !injury.assessed_at ? { assessed_at: new Date().toISOString(), assessed_by: user?.id ?? null } : {};
    const { error } = await db.from('player_injuries').update({ ...patch, ...seen }).eq('id', injury.id);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    if (ok) toast.success(ok);
    onChanged();
    return true;
  };
  const start = (p: RehabProtocol) => save({ rehab_protocol: p, ...moveTo({ rehab_phase: null, rehab_history: [] }, 1, user?.id ?? null), rehab_checks: {} }, `${PROTOCOL_LABEL[p]}: fase 1.`);
  const go = (target: number) => save(moveTo({ rehab_phase: phase, rehab_history: injury.rehab_history }, target, user?.id ?? null), `Fase ${target}: ${phases![target - 1].name}.`);
  const clear = () => save({ clinical_status: 'apto', can_play: true, return_date: new Date().toISOString().slice(0, 10) }, 'Alta dada. O jogador volta a estar disponível.');

  const addExercise = async () => {
    if (!newEx?.title.trim()) return;
    const { error } = await db.from('injury_home_exercises').insert({
      injury_id: injury.id, player_id: injury.player_id, title: newEx.title.trim(), dose: newEx.dose.trim() || null, frequency: newEx.frequency.trim() || null,
      video_url: /^https?:\/\//i.test(newEx.video_url.trim()) ? newEx.video_url.trim() : null, instructions: newEx.instructions.trim() || null,
    });
    if (error) return toast.error(error.message);
    setNewEx(null); qc.invalidateQueries({ queryKey: ['rehab-exercises', injury.id] });
    toast.success('Exercício enviado. O jogador e os pais veem-no na app.');
  };
  const stopExercise = async (e: Exercise) => {
    const { error } = await db.from('injury_home_exercises').update({ active: !e.active }).eq('id', e.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['rehab-exercises', injury.id] });
  };
  const addSession = async () => {
    if (!newSession) return;
    const { error } = await db.from('injury_sessions').insert({ injury_id: injury.id, player_id: injury.player_id, session_date: newSession.date, pain: newSession.pain, notes: newSession.notes.trim() || null });
    if (error) return toast.error(error.message);
    setNewSession(null); qc.invalidateQueries({ queryKey: ['rehab-sessions', injury.id] });
  };

  // not started yet
  if (!protocol || !phase || !phases) {
    if (!canClinical || injury.return_date) return null;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2 text-sm">
        <span className="text-muted-foreground">Reabilitação:</span>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => start('standard')}>Começar regresso por fases</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => start('concussion')}>Protocolo de concussão</Button>
      </div>
    );
  }

  const hours = hoursInPhase(injury.rehab_phase_since);
  const complete = phaseComplete(protocol, phase, injury.rehab_checks);
  const tooSoon = protocol === 'concussion' && hours != null && hours < 24;

  return (
    <div className="mt-3 space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{PROTOCOL_LABEL[protocol]}</p>
        <Badge variant="outline">Fase {phase}/6 · {current?.name}</Badge>
        {injury.rehab_phase_since && <span className="text-xs text-muted-foreground">desde {format(new Date(injury.rehab_phase_since), 'dd/MM')}</span>}
      </div>
      {/* the six phases */}
      <ol className="grid grid-cols-6 gap-1" aria-label="Fases da reabilitação">
        {phases.map((p) => (
          <li key={p.n} title={p.name} className={cn('h-2 rounded-full', p.n < phase ? 'bg-emerald-600' : p.n === phase ? 'bg-primary' : 'bg-muted')} aria-label={`Fase ${p.n}: ${p.name}${p.n < phase ? ' (passada)' : p.n === phase ? ' (atual)' : ''}`} />
        ))}
      </ol>
      {current && <p className="text-sm text-muted-foreground">{current.goal}</p>}

      {canClinical && current && !injury.return_date && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Para passar de fase</p>
          {current.criteria.map((c, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={isChecked(injury.rehab_checks, phase, i)} disabled={busy}
                onChange={() => save({ rehab_checks: toggleCheck(injury.rehab_checks, phase, i) })} />
              {c}
            </label>
          ))}
          {tooSoon && <p className="text-xs text-accent">Concussão: ainda não passaram 24 horas nesta fase.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {phase > 1 && <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm(protocol === 'concussion' ? 'Os sintomas voltaram? O jogador volta à fase anterior.' : 'Voltar à fase anterior?') && go(phase - 1)}><ArrowLeft className="mr-1 h-4 w-4" />Fase anterior</Button>}
            {phase < 6 && <Button size="sm" disabled={busy || (!complete && protocol === 'concussion') || tooSoon} onClick={() => (complete || window.confirm('Nem todos os critérios estão cumpridos. Passar mesmo assim?')) && go(phase + 1)}>Passar à fase {phase + 1}<ArrowRight className="ml-1 h-4 w-4" /></Button>}
            {phase === 6 && <Button size="sm" disabled={busy || !complete} onClick={clear}><ShieldCheck className="mr-1 h-4 w-4" />Dar alta</Button>}
          </div>
        </div>
      )}

      {/* physio sessions and pain (clinical) */}
      {canClinical && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessões ({sessions.length})</p>
            {!newSession && <Button size="sm" variant="ghost" className="h-7" onClick={() => setNewSession({ date: new Date().toISOString().slice(0, 10), pain: 3, notes: '' })}><Plus className="mr-1 h-3.5 w-3.5" />Sessão</Button>}
          </div>
          {sessions.filter((s) => s.pain != null).length >= 2 && <PainLine points={sessions.filter((s) => s.pain != null).map((s) => ({ date: s.session_date, pain: s.pain! }))} />}
          {sessions.slice(-3).reverse().map((s) => (
            <p key={s.id} className="text-xs"><span className="font-mono">{format(new Date(s.session_date), 'dd/MM')}</span>{s.pain != null && <> · dor {s.pain}/10</>}{s.notes && <> · {s.notes}</>}</p>
          ))}
          {newSession && (
            <div className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[8rem_1fr]">
              <Input type="date" value={newSession.date} onChange={(e) => setNewSession({ ...newSession, date: e.target.value })} aria-label="Data da sessão" />
              <div>
                <Label className="text-xs">Dor: {newSession.pain}/10</Label>
                <input type="range" min={0} max={10} value={newSession.pain} onChange={(e) => setNewSession({ ...newSession, pain: Number(e.target.value) })} className="w-full" aria-label="Dor de 0 a 10" />
              </div>
              <Textarea rows={2} className="sm:col-span-2" value={newSession.notes} onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })} placeholder="O que se fez e como respondeu" />
              <div className="flex gap-2 sm:col-span-2"><Button size="sm" onClick={addSession}>Guardar sessão</Button><Button size="sm" variant="ghost" onClick={() => setNewSession(null)}>Cancelar</Button></div>
            </div>
          )}
        </div>
      )}

      {/* exercises for home */}
      {(exercises.length > 0 || canClinical) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exercícios para casa</p>
            {canClinical && !newEx && !injury.return_date && <Button size="sm" variant="ghost" className="h-7" onClick={() => setNewEx({ title: '', dose: '', frequency: 'Todos os dias', video_url: '', instructions: '' })}><Plus className="mr-1 h-3.5 w-3.5" />Exercício</Button>}
          </div>
          {exercises.length === 0 && !newEx && <p className="text-xs text-muted-foreground">Ainda sem exercícios. Os que enviar aparecem na app do jogador e dos pais, que marcam quando os fizeram.</p>}
          {exercises.map((e) => (
            <div key={e.id} className={cn('flex flex-wrap items-center gap-2 text-sm', !e.active && 'opacity-50')}>
              <span className="font-medium">{e.title}</span>
              {e.dose && <span className="text-xs text-muted-foreground">{e.dose}</span>}
              {e.frequency && <span className="text-xs text-muted-foreground">· {e.frequency}</span>}
              {e.video_url && <a href={e.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-primary"><ExternalLink className="h-3 w-3" />vídeo</a>}
              <Badge variant="outline" className="ml-auto font-mono text-[11px]"><Check className="mr-0.5 h-3 w-3" />{done.get(e.id) ?? 0}/7 dias</Badge>
              {canClinical && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => stopExercise(e)} aria-label={e.active ? 'Parar exercício' : 'Retomar exercício'} title={e.active ? 'Parar' : 'Retomar'}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          ))}
          {newEx && (
            <div className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-2">
              <Input value={newEx.title} onChange={(e) => setNewEx({ ...newEx, title: e.target.value })} placeholder="Exercício (ex.: Ponte de glúteos)" aria-label="Exercício" />
              <Input value={newEx.dose} onChange={(e) => setNewEx({ ...newEx, dose: e.target.value })} placeholder="Séries e repetições (ex.: 3 × 10)" aria-label="Séries e repetições" />
              <Input value={newEx.frequency} onChange={(e) => setNewEx({ ...newEx, frequency: e.target.value })} placeholder="Quando (ex.: todos os dias)" aria-label="Quando" />
              <Input value={newEx.video_url} onChange={(e) => setNewEx({ ...newEx, video_url: e.target.value })} placeholder="Ligação para vídeo (opcional)" aria-label="Vídeo" />
              <Textarea rows={2} className="sm:col-span-2" value={newEx.instructions} onChange={(e) => setNewEx({ ...newEx, instructions: e.target.value })} placeholder="Como fazer, cuidados" aria-label="Como fazer" />
              <div className="flex gap-2 sm:col-span-2"><Button size="sm" onClick={addExercise} disabled={!newEx.title.trim()}>Enviar ao jogador</Button><Button size="sm" variant="ghost" onClick={() => setNewEx(null)}>Cancelar</Button></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pain 0–10 over the sessions. */
function PainLine({ points }: { points: { date: string; pain: number }[] }) {
  const w = 240, h = 60, pad = 10;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (p: number) => pad / 2 + (1 - p / 10) * (h - pad * 1.5);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-xs" role="img" aria-label={`Dor nas sessões: ${points.map((p) => `${p.date.slice(8, 10)}/${p.date.slice(5, 7)} ${p.pain}`).join(', ')}`}>
      <line x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.15} />
      <polyline points={points.map((p, i) => `${x(i)},${y(p.pain)}`).join(' ')} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.pain)} r={2.5} fill="hsl(var(--primary))" /><text x={x(i)} y={y(p.pain) - 4} textAnchor="middle" fontSize={8} fill="currentColor">{p.pain}</text></g>)}
    </svg>
  );
}
