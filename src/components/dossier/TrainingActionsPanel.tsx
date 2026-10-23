/**
 * The club's internal training actions for its coaches (FPF certification, criterion 4.1: "ação de
 * formação com todas as equipas técnicas"): courses, technical meetings, observation of sessions and
 * external courses, with date, length, who gave it, the topics and who attended.
 * Admins and coordinators write; the club's coaches read. A coach without a club keeps their own.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { tx } from '@/lib/i18n/ui';
import { ACTION_KINDS, actionKindLabel, actionStats, durationLabel, type ActionKind, type TrainingAction } from '@/lib/transitions';

const db = supabase as any; // newer than the generated types
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** The training actions of a club (or the coach's own, without a club), newest first. */
export function useTrainingActions(clubId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['training-actions', clubId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TrainingAction[]> => {
      const q = db.from('club_training_actions').select('*');
      const { data, error } = await (clubId ? q.eq('club_id', clubId) : q.eq('owner_id', user!.id)).order('action_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingAction[];
    },
  });
}

export function TrainingActionsPanel({ clubId, canEdit }: { clubId: string | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useTrainingActions(clubId);
  const [editing, setEditing] = useState<TrainingAction | 'new' | null>(null);
  const stats = actionStats(list);

  const remove = async (a: TrainingAction) => {
    if (!window.confirm(tx('Apagar "{{v0}}"?', { v0: a.title }))) return;
    const { error } = await db.from('club_training_actions').delete().eq('id', a.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['training-actions'] });
    qc.invalidateQueries({ queryKey: ['dossier'] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" />{tx('Formação dos treinadores')}</CardTitle>
        <CardDescription>
          {tx('Ações de formação internas, reuniões técnicas e observação de treinos. A FPF pede pelo menos uma ação com todas as equipas técnicas.')}
          {list.length > 0 && <span className="ml-1">{tx('{{n}} registos · {{a}} com todas as equipas técnicas · {{h}} no total', { n: stats.total, a: stats.withAllStaff, h: durationLabel(stats.minutes) || '—' })}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!isLoading && list.length === 0 && <p className="text-sm text-muted-foreground">{tx('Sem registos.')}</p>}
        {list.map((a) => (
          <div key={a.id} className="flex items-start gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{fmt(a.action_date)}</span>
                {a.duration_minutes ? <span>{durationLabel(a.duration_minutes)}</span> : null}
                {a.trainer && <span>{tx('Formador')}: {a.trainer}</span>}
              </p>
              {a.topics && <p className="text-xs">{a.topics}</p>}
              {a.attendees && <p className="flex items-start gap-1 text-xs text-muted-foreground"><Users className="mt-0.5 h-3 w-3 shrink-0" />{a.attendees}</p>}
              <div className="flex flex-wrap gap-1 pt-0.5">
                <Badge variant="outline" className="text-[10px]">{actionKindLabel(a.kind)}</Badge>
                {a.all_staff && <Badge variant="outline" className="border-emerald-500 text-[10px] text-emerald-700">{tx('Todas as equipas técnicas')}</Badge>}
              </div>
            </div>
            {canEdit && <>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(a)} aria-label={tx('Editar')}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => remove(a)} aria-label={tx('Apagar')}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>}
          </div>
        ))}
        {canEdit && <Button size="sm" variant="outline" onClick={() => setEditing('new')}><Plus className="mr-1 h-4 w-4" />{tx('Registar ação')}</Button>}
      </CardContent>
      {editing && <ActionDialog clubId={clubId} editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function ActionDialog({ clubId, editing, onClose }: { clubId: string | null; editing: TrainingAction | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState({
    title: editing?.title ?? '', kind: (editing?.kind ?? 'course') as ActionKind, action_date: editing?.action_date ?? new Date().toISOString().slice(0, 10),
    duration: editing?.duration_minutes ? String(editing.duration_minutes) : '', trainer: editing?.trainer ?? '', topics: editing?.topics ?? '',
    attendees: editing?.attendees ?? '', all_staff: editing?.all_staff ?? false, notes: editing?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async () => {
    if (!f.title.trim()) { toast.error(tx('Escreva o título.')); return; }
    if (!f.action_date) { toast.error(tx('Escolha a data.')); return; }
    const minutes = Math.round(Number(f.duration));
    setSaving(true);
    try {
      const row = {
        title: f.title.trim().slice(0, 200), kind: f.kind, action_date: f.action_date,
        duration_minutes: minutes > 0 && minutes <= 6000 ? minutes : null,
        trainer: f.trainer.trim().slice(0, 200) || null, topics: f.topics.trim().slice(0, 4000) || null,
        attendees: f.attendees.trim().slice(0, 4000) || null, all_staff: f.all_staff, notes: f.notes.trim().slice(0, 4000) || null,
      };
      const { error } = editing
        ? await db.from('club_training_actions').update(row).eq('id', editing.id)
        : await db.from('club_training_actions').insert({ ...row, ...(clubId ? { club_id: clubId } : { owner_id: user!.id }) });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['training-actions'] });
      qc.invalidateQueries({ queryKey: ['dossier'] });
      toast.success(tx('Ação guardada.'));
      onClose();
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? tx('Editar ação') : tx('Registar ação')}</DialogTitle>
          <DialogDescription>{tx('Fica no documento orientador e no dossier de cada equipa.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ac-title">{tx('Título')}</Label>
            <Input id="ac-title" maxLength={200} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={tx('Ex.: O modelo de jogo do clube no futebol de 9')} />
          </div>
          <div className="space-y-1.5">
            <Label>{tx('Tipo')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {ACTION_KINDS.map((k) => (
                <Button key={k.value} type="button" size="sm" variant={f.kind === k.value ? 'default' : 'outline'} className="h-8" onClick={() => set({ kind: k.value })}>{k.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-date">{tx('Data')}</Label>
              <Input id="ac-date" type="date" value={f.action_date} onChange={(e) => set({ action_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-min">{tx('Duração (minutos)')}</Label>
              <Input id="ac-min" type="number" inputMode="numeric" min={1} max={6000} value={f.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="90" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-trainer">{tx('Formador')}</Label>
            <Input id="ac-trainer" maxLength={200} value={f.trainer} onChange={(e) => set({ trainer: e.target.value })} placeholder={tx('Ex.: Coordenador técnico')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-topics">{tx('Temas')}</Label>
            <Textarea id="ac-topics" rows={2} maxLength={4000} value={f.topics} onChange={(e) => set({ topics: e.target.value })} placeholder={tx('Ex.: princípios ofensivos; como planear o microciclo; o dossier de treino')} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.all_staff} onCheckedChange={(v) => set({ all_staff: v === true })} />
            {tx('Com todas as equipas técnicas')}
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="ac-att">{tx('Presentes')}</Label>
            <Textarea id="ac-att" rows={2} maxLength={4000} value={f.attendees} onChange={(e) => set({ attendees: e.target.value })} placeholder={tx('Ex.: treinadores dos Sub-7 aos Sub-19 (14 pessoas)')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-notes">{tx('Notas')}</Label>
            <Textarea id="ac-notes" rows={2} maxLength={4000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={tx('Opcional')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tx('Cancelar')}</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
