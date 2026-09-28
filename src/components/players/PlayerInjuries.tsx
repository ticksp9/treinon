import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, AlertCircle, CheckCircle2, Trash2, Edit2, Stethoscope, ShieldCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { INJURY_TYPES, BODY_PARTS, SEVERITY_LEVELS } from '@/lib/player-constants';
import {
  CLINICAL_STATUS_OPTIONS,
  computeAvailability,
  getClinicalStatusOption,
  type InjuryRecord,
} from '@/lib/player-availability';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Props { playerId: string }

const BODY_SIDES = [
  { value: 'left', label: 'Esquerdo' },
  { value: 'right', label: 'Direito' },
  { value: 'both', label: 'Bilateral' },
  { value: 'n_a', label: 'N/A' },
];
const CONTEXTS = [
  { value: 'training', label: 'Treino' },
  { value: 'match', label: 'Jogo' },
  { value: 'extra', label: 'Extra-desportivo' },
  { value: 'other', label: 'Outro' },
];

const emptyForm = () => ({
  injury_date: format(new Date(), 'yyyy-MM-dd'),
  return_date: '',
  expected_return_date: '',
  injury_type: '',
  body_part: '',
  body_side: 'n_a',
  context: 'training',
  severity: 'moderate',
  diagnosis: '',
  responsible_professional: '',
  description: '',
  treatment: '',
  treatment_plan: '',
  clinical_notes: '',
  clinical_status: 'inapto',
  can_play: false,
  restrictions: '',
  is_recurrence: false,
  trainings_missed: 0,
  matches_missed: 0,
});

export function PlayerInjuries({ playerId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: injuries, isLoading } = useQuery({
    queryKey: ['player-injuries', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_injuries')
        .select('*')
        .eq('player_id', playerId)
        .order('injury_date', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const payload: any = {
        ...form,
        player_id: playerId,
        owner_id: user.id,
        return_date: form.return_date || null,
        expected_return_date: form.expected_return_date || null,
        diagnosis: form.diagnosis || null,
        responsible_professional: form.responsible_professional || null,
        description: form.description || null,
        treatment: form.treatment || null,
        treatment_plan: form.treatment_plan || null,
        clinical_notes: form.clinical_notes || null,
        restrictions: form.restrictions || null,
        body_part: form.body_part || null,
      };
      if (editingId) {
        const { error } = await supabase.from('player_injuries').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('player_injuries').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['player-injuries', playerId] });
      qc.invalidateQueries({ queryKey: ['player-active-injuries', playerId] });
      qc.invalidateQueries({ queryKey: ['active-injuries'] });
      qc.invalidateQueries({ queryKey: ['callup-availability'] });
      toast.success(editingId ? 'Lesão atualizada' : 'Lesão registada');
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('player_injuries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['player-injuries', playerId] });
      qc.invalidateQueries({ queryKey: ['active-injuries'] });
      qc.invalidateQueries({ queryKey: ['callup-availability'] });
      toast.success('Lesão removida');
    },
  });

  const grantClearance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('player_injuries')
        .update({
          clinical_status: 'apto',
          can_play: true,
          return_date: format(new Date(), 'yyyy-MM-dd'),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['player-injuries', playerId] });
      qc.invalidateQueries({ queryKey: ['active-injuries'] });
      qc.invalidateQueries({ queryKey: ['callup-availability'] });
      toast.success('Alta clínica registada');
    },
  });

  const startEdit = (inj: any) => {
    setEditingId(inj.id);
    setForm({
      injury_date: inj.injury_date,
      return_date: inj.return_date || '',
      expected_return_date: inj.expected_return_date || '',
      injury_type: inj.injury_type || '',
      body_part: inj.body_part || '',
      body_side: inj.body_side || 'n_a',
      context: inj.context || 'training',
      severity: inj.severity || 'moderate',
      diagnosis: inj.diagnosis || '',
      responsible_professional: inj.responsible_professional || '',
      description: inj.description || '',
      treatment: inj.treatment || '',
      treatment_plan: inj.treatment_plan || '',
      clinical_notes: inj.clinical_notes || '',
      clinical_status: inj.clinical_status || 'inapto',
      can_play: !!inj.can_play,
      restrictions: inj.restrictions || '',
      is_recurrence: !!inj.is_recurrence,
      trainings_missed: inj.trainings_missed || 0,
      matches_missed: inj.matches_missed || 0,
    });
    setOpen(true);
  };

  const availability = computeAvailability((injuries || []) as InjuryRecord[]);
  const statusOpt = getClinicalStatusOption(availability.status);

  return (
    <div className="space-y-4">
      {/* Disponibilidade médica atual */}
      <Card className={availability.callable ? 'border-emerald-500/30' : 'border-red-500/40'}>
        <CardContent className="p-4 flex items-center gap-3">
          {availability.callable ? (
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-500" />
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">
                {availability.callable ? 'Disponível para convocatória' : 'Indisponível para convocatória'}
              </p>
              {statusOpt && (
                <Badge variant="outline" className={statusOpt.tone}>{statusOpt.label}</Badge>
              )}
              {availability.needsClearance && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Aguarda alta clínica
                </Badge>
              )}
            </div>
            {availability.reason && (
              <p className="text-xs text-muted-foreground mt-0.5">{availability.reason}</p>
            )}
            {availability.restrictions && (
              <p className="text-xs mt-0.5">
                <span className="text-muted-foreground">Restrições:</span>{' '}
                <span className="font-medium">{availability.restrictions}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Stethoscope className="w-5 h-5" /> Histórico de Lesões
        </h3>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm()); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />Registar Lesão</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Lesão' : 'Nova Lesão'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Data da Lesão *">
                  <Input type="date" value={form.injury_date} onChange={(e) => setForm({ ...form, injury_date: e.target.value })} />
                </Field>
                <Field label="Contexto">
                  <Select value={form.context} onValueChange={(v) => setForm({ ...form, context: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTEXTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Tipo *">
                  <Select value={form.injury_type} onValueChange={(v) => setForm({ ...form, injury_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{INJURY_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Zona">
                  <Select value={form.body_part} onValueChange={(v) => setForm({ ...form, body_part: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{BODY_PARTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Lado">
                  <Select value={form.body_side} onValueChange={(v) => setForm({ ...form, body_side: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BODY_SIDES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Gravidade">
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITY_LEVELS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Estado Clínico *">
                  <Select value={form.clinical_status} onValueChange={(v) => setForm({ ...form, clinical_status: v, can_play: v === 'apto' || v === 'condicionado' || v === 'retorno_progressivo' ? form.can_play : false })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLINICAL_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Diagnóstico">
                <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Ex: Rotura grau 1 isquiotibiais" />
              </Field>

              <Field label="Profissional Responsável">
                <Input value={form.responsible_professional} onChange={(e) => setForm({ ...form, responsible_professional: e.target.value })} placeholder="Médico / Fisioterapeuta" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Data Prevista de Regresso">
                  <Input type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
                </Field>
                <Field label="Data de Alta (regresso efetivo)">
                  <Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} />
                </Field>
              </div>

              <Field label="Plano de Tratamento">
                <Textarea rows={2} value={form.treatment_plan} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} />
              </Field>
              <Field label="Observações Clínicas">
                <Textarea rows={2} value={form.clinical_notes} onChange={(e) => setForm({ ...form, clinical_notes: e.target.value })} />
              </Field>

              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Pode jogar?</p>
                    <p className="text-xs text-muted-foreground">Controla bloqueio na convocatória</p>
                  </div>
                  <Switch checked={form.can_play} onCheckedChange={(c) => setForm({ ...form, can_play: c })} />
                </div>
                <Field label="Restrições aplicáveis">
                  <Input value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} placeholder="Ex: máx 20 min, sem contacto" />
                </Field>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Recaída de lesão anterior</p>
                  <Switch checked={form.is_recurrence} onCheckedChange={(c) => setForm({ ...form, is_recurrence: c })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Treinos Perdidos">
                  <Input type="number" min={0} value={form.trainings_missed} onChange={(e) => setForm({ ...form, trainings_missed: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="Jogos Perdidos">
                  <Input type="number" min={0} value={form.matches_missed} onChange={(e) => setForm({ ...form, matches_missed: Number(e.target.value) || 0 })} />
                </Field>
              </div>

              <Button className="w-full" onClick={() => upsert.mutate()} disabled={!form.injury_type || upsert.isPending}>
                {editingId ? 'Atualizar' : 'Registar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="h-20 animate-pulse" /></Card>
      ) : injuries && injuries.length > 0 ? (
        <div className="space-y-3">
          {injuries.map((inj) => {
            const active = !inj.return_date && inj.clinical_status !== 'apto';
            const typeLbl = INJURY_TYPES.find((t) => t.value === inj.injury_type)?.label || inj.injury_type;
            const partLbl = BODY_PARTS.find((b) => b.value === inj.body_part)?.label || inj.body_part;
            const sideLbl = BODY_SIDES.find((s) => s.value === inj.body_side)?.label;
            const sevLbl = SEVERITY_LEVELS.find((s) => s.value === inj.severity);
            const statusLbl = getClinicalStatusOption(inj.clinical_status);
            return (
              <Card key={inj.id} className={active ? 'border-red-500/40' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${active ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                        {active ? <AlertCircle className="w-5 h-5 text-red-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{typeLbl}</p>
                          {sevLbl && <Badge className={`${sevLbl.color} text-white`}>{sevLbl.label}</Badge>}
                          {statusLbl && <Badge variant="outline" className={statusLbl.tone}>{statusLbl.label}</Badge>}
                          {inj.is_recurrence && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">Recaída</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {partLbl}{sideLbl && partLbl ? ` (${sideLbl})` : ''}
                          {inj.diagnosis && ` — ${inj.diagnosis}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(inj.injury_date), "d MMM yyyy", { locale: pt })}
                          {inj.expected_return_date && <> · prev. {format(new Date(inj.expected_return_date), "d MMM yyyy", { locale: pt })}</>}
                          {inj.return_date && <> → alta {format(new Date(inj.return_date), "d MMM yyyy", { locale: pt })}</>}
                        </p>
                        {inj.restrictions && (
                          <p className="text-xs mt-1"><span className="text-muted-foreground">Restrições:</span> {inj.restrictions}</p>
                        )}
                        {(inj.trainings_missed > 0 || inj.matches_missed > 0) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Perdidos: {inj.trainings_missed} treinos · {inj.matches_missed} jogos
                          </p>
                        )}
                        {inj.responsible_professional && (
                          <p className="text-xs text-muted-foreground mt-1">Responsável: {inj.responsible_professional}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {active && (
                        <Button size="sm" variant="outline" onClick={() => grantClearance.mutate(inj.id)} title="Dar alta clínica">
                          <ShieldCheck className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => startEdit(inj)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(inj.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            <p>Sem histórico de lesões registado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
