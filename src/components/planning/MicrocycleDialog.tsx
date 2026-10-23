/**
 * One week of the season (microcycle): what to work on, the contents, the intensity, the week's
 * sessions (each links to its record in Presenças) and matches, and the weekly review.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { longDate, tx } from '@/lib/i18n/ui';
import {
  INTENSITIES, mesoKindLabel, sessionRecorded, weekEnd, weekNumber, weekRangeLabel,
  type Intensity, type Mesocycle, type Microcycle, type PlanSession,
} from '@/lib/training-plan';
import type { PlanMatch } from './SeasonPlanning';

const db = supabase as any; // newer than the generated types
const NONE = '__none';

export function MicrocycleDialog({ teamId, seasonId, seasonStart, weekStart, micro, previous, meso, sessions, matches, onClose }: {
  teamId: string; seasonId: string; seasonStart: string; weekStart: string;
  micro: Microcycle | null; previous: Microcycle | null; meso: Mesocycle | null;
  sessions: PlanSession[]; matches: PlanMatch[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [objectives, setObjectives] = useState(micro?.objectives ?? '');
  const [contents, setContents] = useState(micro?.contents ?? '');
  const [intensity, setIntensity] = useState<Intensity | null>(micro?.intensity ?? null);
  const [review, setReview] = useState(micro?.review ?? '');
  const [saving, setSaving] = useState(false);

  const end = weekEnd(weekStart);
  const weekSessions = sessions.filter((s) => s.status !== 'cancelled' && s.date.slice(0, 10) >= weekStart && s.date.slice(0, 10) <= end);
  const weekMatches = matches.filter((m) => m.match_date.slice(0, 10) >= weekStart && m.match_date.slice(0, 10) <= end);
  const over = end < new Date().toISOString().slice(0, 10);

  const copyPrevious = () => {
    if (!previous) return;
    setObjectives(previous.objectives ?? '');
    setContents(previous.contents ?? '');
    setIntensity(previous.intensity ?? null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const row = {
        team_id: teamId, season_id: seasonId, week_start: weekStart,
        objectives: objectives.trim() || null, contents: contents.trim() || null, intensity, review: review.trim() || null,
      };
      const { error } = await db.from('training_microcycles').upsert(row, { onConflict: 'team_id,week_start' });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['season-plan'] });
      toast.success(tx('Semana guardada.'));
      onClose();
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{tx('Semana {{n}}', { n: weekNumber(seasonStart, weekStart) })} · {weekRangeLabel(weekStart)}</DialogTitle>
          <DialogDescription>
            {meso ? `${meso.name} (${mesoKindLabel(meso.kind)})${meso.focus ? ` · ${meso.focus}` : ''}` : tx('Esta semana não está em nenhum mesociclo.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!micro && previous && (
            <Button type="button" size="sm" variant="outline" onClick={copyPrevious}><Copy className="mr-1.5 h-3.5 w-3.5" />{tx('Copiar da semana anterior')}</Button>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="micro-objectives">{tx('O que trabalhar nesta semana (objetivos)')}</Label>
            <Textarea id="micro-objectives" rows={2} maxLength={4000} value={objectives} onChange={(e) => setObjectives(e.target.value)}
              placeholder={tx('Ex.: transições ofensivas; reagir à perda da bola em 5 segundos')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="micro-contents">{tx('Conteúdos e foco de cada treino')}</Label>
            <Textarea id="micro-contents" rows={3} maxLength={8000} value={contents} onChange={(e) => setContents(e.target.value)}
              placeholder={tx('Ex.: terça: 1x1 e 2x1 com finalização · quinta: jogo reduzido com transições · sexta: bolas paradas')} />
          </div>
          <div className="space-y-1.5">
            <Label>{tx('Intensidade prevista')}</Label>
            <Select value={intensity ?? NONE} onValueChange={(v) => setIntensity(v === NONE ? null : (v as Intensity))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{tx('Não definida')}</SelectItem>
                {INTENSITIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{tx('Treinos da semana')}</Label>
            {weekSessions.length === 0 && <p className="text-sm text-muted-foreground">{tx('Sem treinos marcados nesta semana. Crie-os em Presenças → Configurar Treinos.')}</p>}
            {weekSessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{longDate(new Date(s.date), 'weekdayTime')}{s.objectives ? ` · ${s.objectives}` : ''}</span>
                {sessionRecorded(s)
                  ? <Badge className="gap-1 bg-emerald-600 text-[10px]"><CheckCircle2 className="h-3 w-3" />{tx('Registado')}</Badge>
                  : <Badge variant="outline" className="text-[10px]">{tx('Por registar')}</Badge>}
                <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onClose}>
                  <Link to={`/training?tab=attendance&session=${s.id}`}>{tx('Registar')}</Link>
                </Button>
              </div>
            ))}
            {weekMatches.map((m) => (
              <p key={m.id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Trophy className="h-3.5 w-3.5" />{longDate(new Date(m.match_date), 'weekdayTime')} · {m.is_home ? tx('{{name}} (casa)', { name: m.opponent_name }) : tx('{{name}} (fora)', { name: m.opponent_name })}
              </p>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="micro-review">{tx('Balanço da semana')}</Label>
            <Textarea id="micro-review" rows={3} maxLength={4000} value={review} onChange={(e) => setReview(e.target.value)}
              placeholder={over ? tx('Cumpriu-se o objetivo? O que passa para a semana seguinte?') : tx('Escreve-se no fim da semana: cumpriu-se o objetivo? O que passa para a semana seguinte?')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tx('Cancelar')}</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar semana')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
