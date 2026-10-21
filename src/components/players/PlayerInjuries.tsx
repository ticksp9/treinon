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
import { InjuryRehabPanel } from './InjuryRehabPanel';
import { MECHANISMS, daysOut, isEarlyRecurrence, mechanismLabel, severityByDays } from '@/lib/injury-care';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { tx } from '@/lib/i18n/ui';

interface Props { playerId: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const CLINICAL_FIELDS = ['diagnosis', 'responsible_professional', 'treatment', 'treatment_plan', 'clinical_notes'] as const;

const BODY_SIDES = [
  { value: 'left', get label() { return tx('Esquerdo'); } },
  { value: 'right', get label() { return tx('Direito'); } },
  { value: 'both', get label() { return tx('Bilateral'); } },
  { value: 'n_a', get label() { return tx('N/A'); } },
];
const CONTEXTS = [
  { value: 'training', get label() { return tx('Treino'); } },
  { value: 'match', get label() { return tx('Jogo'); } },
  { value: 'extra', get label() { return tx('Extra-desportivo'); } },
  { value: 'other', get label() { return tx('Outro'); } },
];

const emptyForm = () => ({
  injury_date: format(new Date(), 'yyyy-MM-dd'),
  return_date: '',
  expected_return_date: '',
  injury_type: '',
  body_part: '',
  body_side: 'n_a',
  context: 'training',
  mechanism: '',
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

  // the diagnosis is health data: only the club's doctor / physio (or a coach without a club) reads it
  const { data: access } = useQuery({
    queryKey: ['injury-access', playerId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: clin }, { data: club }] = await Promise.all([
        db.rpc('can_see_injury_clinical', { _user: user!.id, _player: playerId }),
        db.rpc('player_club', { _player: playerId }),
      ]);
      const { data: med } = club ? await db.rpc('is_medical_staff', { _user: user!.id, _club: club }) : { data: false };
      return { clinical: !!clin, medical: !!med, club: (club as string | null) ?? null };
    },
  });
  const { data: clinical = {} } = useQuery({
    queryKey: ['injury-clinical', playerId],
    enabled: !!access?.clinical,
    queryFn: async () => Object.fromEntries((((await db.from('player_injury_clinical').select('*').eq('player_id', playerId)).data ?? []) as { injury_id: string }[]).map((c) => [c.injury_id, c])) as Record<string, Record<string, string | null>>,
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(tx('Not authenticated'));
      const clin = Object.fromEntries(CLINICAL_FIELDS.map((k) => [k, (form[k] as string)?.trim() || null]));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { diagnosis: _d, responsible_professional: _r, treatment: _t, treatment_plan: _tp, clinical_notes: _c, ...rest } = form;
      const payload: any = {
        ...rest,
        mechanism: form.mechanism || null,
        // the same place and type again within 2 months of coming back
        is_recurrence: form.is_recurrence || (!editingId && isEarlyRecurrence({ injury_date: form.injury_date, body_part: form.body_part || null, injury_type: form.injury_type || null }, (injuries || []) as any[])),
        ...(access?.medical ? { assessed_at: new Date().toISOString(), assessed_by: user.id } : {}),
        // without access to the clinical record, what is written goes there (and is not read back)
        ...(!access?.clinical && Object.values(clin).some(Boolean) ? clin : {}),
        player_id: playerId,
        owner_id: user.id,
        return_date: form.return_date || null,
        expected_return_date: form.expected_return_date || null,
        description: form.description || null,
        restrictions: form.restrictions || null,
        body_part: form.body_part || null,
      };
      let injuryId = editingId;
      if (editingId) {
        const { error } = await supabase.from('player_injuries').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('player_injuries').insert(payload).select('id').single();
        if (error) throw error;
        injuryId = (data as { id: string }).id;
      }
      if (access?.clinical && injuryId) {
        const { error } = await db.from('player_injury_clinical').upsert({ injury_id: injuryId, player_id: playerId, ...clin, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'injury_id' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['player-injuries', playerId] });
      qc.invalidateQueries({ queryKey: ['player-active-injuries', playerId] });
      qc.invalidateQueries({ queryKey: ['active-injuries'] });
      qc.invalidateQueries({ queryKey: ['callup-availability'] });
      qc.invalidateQueries({ queryKey: ['injury-clinical', playerId] });
      qc.invalidateQueries({ queryKey: ['medical-dept'] });
      toast.success(editingId ? tx('Lesão atualizada') : tx('Lesão registada'));
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error(tx('Erro: ') + e.message),
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
      toast.success(tx('Lesão removida'));
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
      toast.success(tx('Alta clínica registada'));
    },
  });

  const startEdit = (raw: any) => {
    const inj = { ...raw, ...(clinical[raw.id] ?? {}) };
    setEditingId(inj.id);
    setForm({
      injury_date: inj.injury_date,
      return_date: inj.return_date || '',
      expected_return_date: inj.expected_return_date || '',
      injury_type: inj.injury_type || '',
      body_part: inj.body_part || '',
      body_side: inj.body_side || 'n_a',
      context: inj.context || 'training',
      mechanism: inj.mechanism || '',
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
                {availability.callable ? tx('Disponível para convocatória') : tx('Indisponível para convocatória')}
              </p>
              {statusOpt && (
                <Badge variant="outline" className={statusOpt.tone}>{statusOpt.label}</Badge>
              )}
              {availability.needsClearance && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  {tx('Aguarda alta clínica')}
                </Badge>
              )}
            </div>
            {availability.reason && (
              <p className="text-xs text-muted-foreground mt-0.5">{availability.reason}</p>
            )}
            {availability.restrictions && (
              <p className="text-xs mt-0.5">
                <span className="text-muted-foreground">{tx('Restrições:')}</span>{' '}
                <span className="font-medium">{availability.restrictions}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Stethoscope className="w-5 h-5" /> {tx('Histórico de Lesões')}
        </h3>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm()); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />{tx('Registar Lesão')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? tx('Editar Lesão') : tx('Nova Lesão')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={tx('Data da Lesão *')}>
                  <Input type="date" value={form.injury_date} onChange={(e) => setForm({ ...form, injury_date: e.target.value })} />
                </Field>
                <Field label={tx('Contexto')}>
                  <Select value={form.context} onValueChange={(v) => setForm({ ...form, context: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTEXTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label={tx('Como aconteceu')}>
                <Select value={form.mechanism || undefined} onValueChange={(v) => setForm({ ...form, mechanism: v })}>
                  <SelectTrigger><SelectValue placeholder={tx('Selecionar')} /></SelectTrigger>
                  <SelectContent>{MECHANISMS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={tx('O que aconteceu')}>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={tx('Ex.: caiu sobre o pé esquerdo depois de um salto; saiu a coxear')} />
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field label={tx('Tipo *')}>
                  <Select value={form.injury_type} onValueChange={(v) => setForm({ ...form, injury_type: v })}>
                    <SelectTrigger><SelectValue placeholder={tx('Selecionar')} /></SelectTrigger>
                    <SelectContent>{INJURY_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label={tx('Zona')}>
                  <Select value={form.body_part} onValueChange={(v) => setForm({ ...form, body_part: v })}>
                    <SelectTrigger><SelectValue placeholder={tx('Selecionar')} /></SelectTrigger>
                    <SelectContent>{BODY_PARTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label={tx('Lado')}>
                  <Select value={form.body_side} onValueChange={(v) => setForm({ ...form, body_side: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BODY_SIDES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label={tx('Gravidade')}>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITY_LEVELS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label={tx('Estado Clínico *')}>
                  <Select value={form.clinical_status} onValueChange={(v) => setForm({ ...form, clinical_status: v, can_play: v === 'apto' || v === 'condicionado' || v === 'retorno_progressivo' ? form.can_play : false })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLINICAL_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              {access?.clinical ? (
                <>
                  <Field label={tx('Diagnóstico')}>
                    <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder={tx('Ex: Rotura grau 1 isquiotibiais')} />
                  </Field>
                  <Field label={tx('Profissional Responsável')}>
                    <Input value={form.responsible_professional} onChange={(e) => setForm({ ...form, responsible_professional: e.target.value })} placeholder={tx('Médico / Fisioterapeuta')} />
                  </Field>
                </>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-2">
                  <p>{tx('O diagnóstico e as notas clínicas são dados de saúde: só o médico e o fisioterapeuta do clube os veem.')}</p>
                  <Field label={tx('O que o médico disse (opcional, fica só para o departamento médico)')}>
                    <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label={tx('Data Prevista de Regresso')}>
                  <Input type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
                </Field>
                <Field label={tx('Data de Alta (regresso efetivo)')}>
                  <Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} />
                </Field>
              </div>

              {access?.clinical && (
                <>
                  <Field label={tx('Plano de Tratamento')}>
                    <Textarea rows={2} value={form.treatment_plan} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} />
                  </Field>
                  <Field label={tx('Observações Clínicas')}>
                    <Textarea rows={2} value={form.clinical_notes} onChange={(e) => setForm({ ...form, clinical_notes: e.target.value })} />
                  </Field>
                </>
              )}

              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{tx('Pode jogar?')}</p>
                    <p className="text-xs text-muted-foreground">{tx('Controla bloqueio na convocatória')}</p>
                  </div>
                  <Switch checked={form.can_play} onCheckedChange={(c) => setForm({ ...form, can_play: c })} />
                </div>
                <Field label={tx('Restrições aplicáveis')}>
                  <Input value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} placeholder={tx('Ex: máx 20 min, sem contacto')} />
                </Field>
                <div className="flex items-center justify-between">
                  <p className="text-sm">{tx('Recaída de lesão anterior')}</p>
                  <Switch checked={form.is_recurrence} onCheckedChange={(c) => setForm({ ...form, is_recurrence: c })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label={tx('Treinos Perdidos')}>
                  <Input type="number" min={0} value={form.trainings_missed} onChange={(e) => setForm({ ...form, trainings_missed: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={tx('Jogos Perdidos')}>
                  <Input type="number" min={0} value={form.matches_missed} onChange={(e) => setForm({ ...form, matches_missed: Number(e.target.value) || 0 })} />
                </Field>
              </div>

              <Button className="w-full" onClick={() => upsert.mutate()} disabled={!form.injury_type || upsert.isPending}>
                {editingId ? tx('Atualizar') : tx('Registar')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="h-20 animate-pulse" /></Card>
      ) : injuries && injuries.length > 0 ? (
        <div className="space-y-3">
          {injuries.map((raw) => {
            const inj = { ...raw, ...(clinical[raw.id] ?? {}) };
            const out = daysOut(inj.injury_date, inj.return_date);
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
                          {inj.is_recurrence && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">{tx('Recaída')}</Badge>}
                          {active && !inj.assessed_at && access?.club && <Badge variant="outline" className="border-accent text-accent">{tx('Por avaliar')}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {partLbl}{sideLbl && partLbl ? ` (${sideLbl})` : ''}
                          {inj.diagnosis && ` — ${inj.diagnosis}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(inj.injury_date), "d MMM yyyy", { locale: pt })}
                          {inj.expected_return_date && <> {tx('· prev.')}{' '}{format(new Date(inj.expected_return_date), "d MMM yyyy", { locale: pt })}</>}
                          {inj.return_date && <> {tx('→ alta')}{' '}{format(new Date(inj.return_date), "d MMM yyyy", { locale: pt })}</>}
                          {' · '}{out} {out === 1 ? 'dia' : 'dias'} {tx('de paragem')}{inj.return_date ? ` (${severityByDays(out).label.toLowerCase()})` : ''}
                          {mechanismLabel(inj.mechanism) && <> · {mechanismLabel(inj.mechanism)!.toLowerCase()}</>}
                        </p>
                        {inj.restrictions && (
                          <p className="text-xs mt-1"><span className="text-muted-foreground">{tx('Restrições:')}</span> {inj.restrictions}</p>
                        )}
                        {(inj.trainings_missed > 0 || inj.matches_missed > 0) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {tx('Perdidos: {{a}} treinos · {{b}} jogos', { a: inj.trainings_missed, b: inj.matches_missed })}
                          </p>
                        )}
                        {inj.responsible_professional && (
                          <p className="text-xs text-muted-foreground mt-1">{tx('Responsável:')}{' '}{inj.responsible_professional}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {active && (
                        <Button size="sm" variant="outline" onClick={() => grantClearance.mutate(inj.id)} title={tx('Dar alta clínica')}>
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
                  {(active || inj.rehab_phase) && (
                    <InjuryRehabPanel injury={inj as any} canClinical={!!access?.clinical} onChanged={() => { qc.invalidateQueries({ queryKey: ['player-injuries', playerId] }); qc.invalidateQueries({ queryKey: ['medical-dept'] }); qc.invalidateQueries({ queryKey: ['callup-availability'] }); }} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            <p>{tx('Sem histórico de lesões registado')}</p>
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
