/**
 * The record of one training session for the dossier: the objective, what was done, how long it
 * really took, how it went / what to adjust, a 1–5 rating, and closing it. The week's objective
 * (microcycle) is shown on top so the session stays tied to the plan.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, Loader2, LockOpen, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { longDate, tx } from '@/lib/i18n/ui';
import { weekStartOf, weekRangeLabel, intensityLabel, type PlanSession } from '@/lib/training-plan';

const db = supabase as any; // newer than the generated types

interface CoachTraining { id: string; name: string; objectives: string | null; exercises: { name: string; duration?: number }[] | null }

/** The text a saved training plan gives to "what was done". */
export function trainingToContents(t: Pick<CoachTraining, 'exercises'>): string {
  return (t.exercises ?? []).filter((e) => e?.name).map((e) => `• ${e.name}${e.duration ? ` (${e.duration}')` : ''}`).join('\n');
}

export function SessionRecordCard({ sessionId, teamId, onChanged }: { sessionId: string; teamId: string; onChanged?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['session-record', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data: s } = await db.from('training_sessions')
        .select('id, date, duration_minutes, objectives, exercises, notes, actual_minutes, session_rating, closed_at, status, session_type')
        .eq('id', sessionId).maybeSingle();
      const session = s as PlanSession | null;
      const week = session ? weekStartOf(session.date) : null;
      const { data: micro } = week
        ? await db.from('training_microcycles').select('objectives, intensity').eq('team_id', teamId).eq('week_start', week).maybeSingle()
        : { data: null };
      return { session, week, micro: micro as { objectives: string | null; intensity: string | null } | null };
    },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['coach-trainings-for-record', user?.id],
    enabled: !!user,
    queryFn: async () => ((await supabase.from('coach_trainings').select('id, name, objectives, exercises').eq('owner_id', user!.id).order('created_at', { ascending: false }).limit(100)).data ?? []) as unknown as CoachTraining[],
  });

  const [objectives, setObjectives] = useState('');
  const [contents, setContents] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = data?.session;
    if (!s) return;
    setObjectives(s.objectives ?? '');
    setContents(s.exercises ?? '');
    setMinutes(s.actual_minutes != null ? String(s.actual_minutes) : '');
    setNotes(s.notes ?? '');
    setRating(s.session_rating ?? null);
  }, [data?.session]);

  if (isLoading || !data?.session) return null;
  const s = data.session;
  const closed = !!s.closed_at;
  const happened = Date.parse(s.date) <= Date.now();

  const save = async (close: boolean | null) => {
    const m = minutes.trim() ? Math.round(Number(minutes)) : null;
    if (m != null && (!Number.isFinite(m) || m < 1 || m > 600)) { toast.error(tx('Duração real inválida.')); return; }
    setSaving(true);
    try {
      const row: Record<string, unknown> = {
        objectives: objectives.trim() || null,
        exercises: contents.trim() || null,
        notes: notes.trim() || null,
        actual_minutes: m,
        session_rating: rating,
      };
      if (close === true) row.closed_at = new Date().toISOString();
      if (close === false) row.closed_at = null;
      const { error } = await db.from('training_sessions').update(row).eq('id', sessionId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['session-record', sessionId] });
      qc.invalidateQueries({ queryKey: ['season-plan'] });
      onChanged?.();
      toast.success(close === true ? tx('Treino fechado e registado no dossier.') : close === false ? tx('Treino reaberto.') : tx('Registo guardado.'));
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  const usePlan = (id: string) => {
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    const text = trainingToContents(p);
    setContents((c) => (c.trim() ? `${c.trim()}\n${text}` : text));
    if (!objectives.trim() && p.objectives) setObjectives(p.objectives);
  };

  return (
    <Card className={cn(closed && 'border-emerald-500/40')}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" />
          {tx('Registo do treino')}
          {closed && <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" />{tx('Fechado')}</Badge>}
        </CardTitle>
        <CardDescription>
          {tx('O que se fez e como correu. Fica no dossier de treino da equipa.')}
        </CardDescription>
        {data.week && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs">
            <span className="font-semibold">{tx('Objetivo da semana')} ({weekRangeLabel(data.week)}):</span>{' '}
            {data.micro?.objectives?.trim() || <span className="text-muted-foreground">{tx('ainda não definido no Planeamento.')}</span>}
            {data.micro?.intensity && <span className="text-muted-foreground"> · {tx('Intensidade')}: {intensityLabel(data.micro.intensity)}</span>}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="rec-objective">{tx('Objetivo do treino')}</Label>
          <Input id="rec-objective" maxLength={500} value={objectives} disabled={closed}
            placeholder={tx('Ex.: oferecer duas linhas de passe ao portador')} onChange={(e) => setObjectives(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="rec-contents">{tx('O que se fez (exercícios e conteúdos)')}</Label>
            {!closed && plans.length > 0 && (
              <Select value="" onValueChange={usePlan}>
                <SelectTrigger className="h-8 w-auto max-w-[14rem] text-xs"><SelectValue placeholder={tx('Usar um dos meus treinos')} /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea id="rec-contents" rows={4} maxLength={6000} value={contents} disabled={closed}
            placeholder={tx('Ex.: aquecimento com bola 15\'; rondo 5x2 10\'; jogo 7x7 com 2 toques 25\'')}
            onChange={(e) => setContents(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="rec-minutes">{tx('Duração real (min)')}</Label>
            <Input id="rec-minutes" inputMode="numeric" value={minutes} disabled={closed}
              placeholder={s.duration_minutes ? String(s.duration_minutes) : '90'} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </div>
          <div className="space-y-1.5">
            <Label>{tx('Como correu o treino?')}</Label>
            <div className="flex items-center gap-1" role="radiogroup" aria-label={tx('Avaliação do treino')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} disabled={closed}
                  aria-label={tx('{{n}} de 5', { n })}
                  onClick={() => setRating(rating === n ? null : n)}
                  className="rounded p-1 disabled:opacity-60">
                  <Star className={cn('h-6 w-6', rating != null && n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-notes">{tx('Observações: o que correu bem e o que ajustar')}</Label>
          <Textarea id="rec-notes" rows={3} maxLength={4000} value={notes} disabled={closed}
            placeholder={tx('Ex.: muito tempo de espera no exercício 2; para a próxima, duas bolas em jogo')}
            onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {closed ? (
            <>
              <span className="text-xs text-muted-foreground">{tx('Fechado a {{d}}.', { d: longDate(new Date(s.closed_at!), 'dateTime') })}</span>
              <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving}>
                <LockOpen className="mr-1.5 h-4 w-4" />{tx('Reabrir para corrigir')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => save(null)} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar')}
              </Button>
              <Button onClick={() => save(true)} disabled={saving || !happened} title={!happened ? tx('Só se fecha depois de o treino acontecer.') : undefined}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />{tx('Fechar treino')}
              </Button>
              {!happened && <span className="text-xs text-muted-foreground">{tx('Pode preparar já o objetivo; fecha-se depois do treino.')}</span>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
