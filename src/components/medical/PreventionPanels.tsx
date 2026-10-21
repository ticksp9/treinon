/**
 * Medical department, prevention and the season:
 *  Crescimento — height every 3 months, growth speed, warning on fast growth;
 *  Exames e seguro — sports medical exam validity, insurance reports with their deadline;
 *  Prevenção — the FIFA 11+ Kids warm-up, ticked per training, counted per week;
 *  Época — the season in numbers for the club's leadership, with a PDF.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCopy, FileDown, Plus, Ruler, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { BODY_PARTS } from '@/lib/player-constants';
import { daysOut, mechanismLabel, seasonSummary } from '@/lib/injury-care';
import { deliverPdf } from '@/lib/native-files';
import {
  EXAM_LABEL, FAST_GROWTH_CM_YEAR, addWorkingDays, daysLeft, examState, growthVelocity, measureDue, oneYearFrom, warmupByWeek,
  type ExamState, type Measure,
} from '@/lib/prevention';
import { tx } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const day = (d: string) => format(new Date(d), 'dd/MM/yyyy', { locale: pt });
const todayIso = () => new Date().toISOString().slice(0, 10);
const ageOn = (birth: string | null) => (birth ? Math.floor((Date.now() - Date.parse(birth)) / (365.25 * 86_400_000)) : null);

export interface CarePlayer { id: string; name: string; number: number | null; birth_date: string | null; team: { id: string; name: string } | null }

/** The players the user looks after (the page's team filter applied). */
export function useCarePlayers(team: string | null) {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ['care-players', user?.id],
    enabled: !!user,
    queryFn: async () => ((await supabase.from('players').select('id, name, number, birth_date, team:teams(id, name)').eq('is_active', true).order('name')).data ?? []) as unknown as CarePlayer[],
  });
  return useMemo(() => (team ? data.filter((p) => p.team?.id === team) : data), [data, team]);
}

// ── Crescimento ────────────────────────────────────────────────────────────
export function GrowthPanel({ players }: { players: CarePlayer[] }) {
  const qc = useQueryClient();
  const [measuring, setMeasuring] = useState(false);
  const ids = players.map((p) => p.id);
  const { data: growth = [] } = useQuery({
    queryKey: ['growth', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => ((await db.from('player_growth').select('player_id, measured_on, height_cm, weight_kg').in('player_id', ids)).data ?? []) as (Measure & { player_id: string; weight_kg: number | null })[],
  });
  const rows = players.map((p) => {
    const list = growth.filter((g) => g.player_id === p.id);
    const last = [...list].sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0] ?? null;
    const v = growthVelocity(list);
    const age = ageOn(p.birth_date);
    return { p, last, v, age, due: measureDue(list), fast: !!v && v.cmYear >= FAST_GROWTH_CM_YEAR && age != null && age >= 9 && age <= 16 };
  }).sort((a, b) => Number(b.fast) - Number(a.fast) || a.p.name.localeCompare(b.p.name, 'pt'));
  const fast = rows.filter((r) => r.fast);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">{tx('Medir a altura de 3 em 3 meses. Quem cresce')}{' '}{FAST_GROWTH_CM_YEAR} {tx('cm por ano ou mais está no pico de crescimento: é quando aparecem as dores no joelho (Osgood-Schlatter) e no calcanhar (Sever). Nessas semanas convém aliviar saltos e corrida intensa e estar atento às queixas.')}</p>
        <Button onClick={() => setMeasuring(true)} disabled={!players.length}><Ruler className="mr-1.5 h-4 w-4" />{tx('Medir a equipa')}</Button>
      </div>
      {fast.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-accent/60 bg-accent/10 p-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{fast.length === 1 ? tx('1 jogador a crescer depressa') : tx('{{v0}} jogadores a crescer depressa', { v0: fast.length })}: {fast.map((r) => r.p.name).join(', ')}.</p>
      )}
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full whitespace-nowrap text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="p-2">{tx('Jogador')}</th><th className="p-2">{tx('Idade')}</th><th className="p-2">{tx('Altura')}</th><th className="p-2">{tx('Crescimento')}</th><th className="p-2" /></tr></thead>
          <tbody>
            {rows.map(({ p, last, v, age, due, fast: isFast }) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-2"><span className="font-medium">{p.name}</span>{p.team && <span className="block text-xs text-muted-foreground">{p.team.name}</span>}</td>
                <td className="p-2 tabular-nums">{age ?? '—'}</td>
                <td className="p-2 tabular-nums">{last ? <>{String(last.height_cm).replace('.', ',')} cm <span className="text-xs text-muted-foreground">({format(new Date(last.measured_on), 'dd/MM')})</span></> : '—'}</td>
                <td className="p-2 tabular-nums">{v ? <span className={cn(isFast && 'font-semibold text-accent')}>{String(v.cmYear).replace('.', ',')} {tx('cm/ano')}</span> : <span className="text-xs text-muted-foreground">{tx('falta outra medição')}</span>}</td>
                <td className="p-2">{isFast ? <Badge variant="outline" className="border-accent text-accent">{tx('Pico de crescimento')}</Badge> : due ? <Badge variant="secondary">{tx('Medir')}</Badge> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {measuring && <MeasureDialog players={players} onClose={() => setMeasuring(false)} onSaved={() => { setMeasuring(false); qc.invalidateQueries({ queryKey: ['growth'] }); }} />}
    </div>
  );
}

function MeasureDialog({ players, onClose, onSaved }: { players: CarePlayer[]; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState<Record<string, { h: string; w: string }>>({});
  const [busy, setBusy] = useState(false);
  const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const save = async () => {
    const rows = players.map((p) => ({ p, h: num(values[p.id]?.h ?? ''), w: num(values[p.id]?.w ?? '') }))
      .filter((r) => r.h != null && r.h >= 80 && r.h <= 230)
      .map((r) => ({ player_id: r.p.id, measured_on: date, height_cm: r.h, weight_kg: r.w != null && r.w >= 15 && r.w <= 160 ? r.w : null, recorded_by: user!.id }));
    if (!rows.length) return toast.error(tx('Escreva pelo menos uma altura (em cm).'));
    setBusy(true);
    const { error } = await db.from('player_growth').upsert(rows, { onConflict: 'player_id,measured_on' });
    setBusy(false);
    if (error) return toast.error(tx('Não foi possível guardar: ') + error.message);
    toast.success(`${rows.length} ${rows.length === 1 ? 'medição guardada' : 'medições guardadas'}.`);
    onSaved();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{tx('Medir a equipa')}</DialogTitle><DialogDescription>{tx('Altura em cm, descalço; o peso é opcional. Quem não for medido hoje fica em branco.')}</DialogDescription></DialogHeader>
        <div className="max-w-[12rem]"><Label htmlFor="m-date">{tx('Data')}</Label><Input id="m-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="divide-y">
          {players.map((p) => (
            <div key={p.id} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 py-1.5">
              <span className="truncate text-sm">{p.number != null && <span className="mr-1 font-mono text-muted-foreground">{p.number}</span>}{p.name}</span>
              <Input inputMode="decimal" placeholder="cm" value={values[p.id]?.h ?? ''} onChange={(e) => setValues((v) => ({ ...v, [p.id]: { h: e.target.value, w: v[p.id]?.w ?? '' } }))} aria-label={tx('Altura de {{v0}}', { v0: p.name })} />
              <Input inputMode="decimal" placeholder="kg" value={values[p.id]?.w ?? ''} onChange={(e) => setValues((v) => ({ ...v, [p.id]: { h: v[p.id]?.h ?? '', w: e.target.value } }))} aria-label={tx('Peso de {{v0}}', { v0: p.name })} />
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{tx('Cancelar')}</Button><Button onClick={save} disabled={busy}>{tx('Guardar medições')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Exames e seguro ─────────────────────────────────────────────────────────
interface Exam { id: string; player_id: string; exam_date: string; valid_until: string; result: string }
interface Claim { injury_id: string; player_id: string; deadline: string; submitted_on: string | null; claim_number: string | null }
interface InjuryLite { id: string; player_id: string; injury_date: string; return_date: string | null; body_part: string | null; context: string | null; mechanism: string | null; description: string | null }

const STATE_TONE: Record<ExamState, string> = { missing: 'border-muted-foreground/40 text-muted-foreground', expired: 'border-destructive text-destructive', soon: 'border-accent text-accent', ok: 'border-emerald-600 text-emerald-600' };

export function ExamsInsurancePanel({ players }: { players: CarePlayer[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [examFor, setExamFor] = useState<{ player: string; date: string; until: string; result: string } | null>(null);
  const [days, setDays] = useState(5);
  const [submitFor, setSubmitFor] = useState<{ claim: Claim; date: string; number: string } | null>(null);
  const ids = players.map((p) => p.id);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Jogador';
  const { data } = useQuery({
    queryKey: ['exams-claims', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
      const [ex, cl, inj] = await Promise.all([
        db.from('player_medical_exams').select('id, player_id, exam_date, valid_until, result').in('player_id', ids).order('valid_until', { ascending: false }),
        db.from('injury_insurance_claims').select('injury_id, player_id, deadline, submitted_on, claim_number').in('player_id', ids),
        db.from('player_injuries').select('id, player_id, injury_date, return_date, body_part, context, mechanism, description').in('player_id', ids).gte('injury_date', since).order('injury_date', { ascending: false }),
      ]);
      return { exams: (ex.data ?? []) as Exam[], claims: (cl.data ?? []) as Claim[], injuries: (inj.data ?? []) as InjuryLite[] };
    },
  });
  const latest = new Map<string, Exam>();
  (data?.exams ?? []).forEach((e) => { if (!latest.has(e.player_id)) latest.set(e.player_id, e); });
  const rows = players.map((p) => ({ p, exam: latest.get(p.id) ?? null, state: examState(latest.get(p.id)?.valid_until) }))
    .sort((a, b) => ['expired', 'soon', 'missing', 'ok'].indexOf(a.state) - ['expired', 'soon', 'missing', 'ok'].indexOf(b.state) || a.p.name.localeCompare(b.p.name, 'pt'));
  const counts = rows.reduce((m, r) => ({ ...m, [r.state]: (m[r.state] ?? 0) + 1 }), {} as Record<ExamState, number>);
  const refresh = () => qc.invalidateQueries({ queryKey: ['exams-claims'] });

  const saveExam = async () => {
    if (!examFor?.player) return;
    const { error } = await db.from('player_medical_exams').insert({ player_id: examFor.player, exam_date: examFor.date, valid_until: examFor.until, result: examFor.result, recorded_by: user!.id });
    if (error) return toast.error(tx('Não foi possível guardar: ') + error.message);
    setExamFor(null); refresh(); toast.success(tx('Exame registado.'));
  };
  const openClaim = async (inj: InjuryLite) => {
    const { error } = await db.from('injury_insurance_claims').insert({ injury_id: inj.id, player_id: inj.player_id, deadline: addWorkingDays(inj.injury_date, days), created_by: user!.id });
    if (error) return toast.error(tx('Não foi possível criar: ') + error.message);
    refresh();
  };
  const markSubmitted = async () => {
    if (!submitFor) return;
    const { error } = await db.from('injury_insurance_claims').update({ submitted_on: submitFor.date, claim_number: submitFor.number.trim() || null }).eq('injury_id', submitFor.claim.injury_id);
    if (error) return toast.error(error.message);
    setSubmitFor(null); refresh(); toast.success(tx('Participação marcada como enviada.'));
  };
  const copyData = (inj: InjuryLite) => {
    const p = players.find((x) => x.id === inj.player_id);
    const text = [
      `Jogador: ${p?.name ?? ''}${p?.birth_date ? ` (nascido a ${day(p.birth_date)})` : ''}`, p?.team ? `Equipa: ${p.team.name}` : '',
      `Data da lesão: ${day(inj.injury_date)}`, `Onde: ${inj.context === 'match' ? 'jogo' : inj.context === 'training' ? 'treino' : 'outro'}`,
      `Zona: ${BODY_PARTS.find((b) => b.value === inj.body_part)?.label ?? inj.body_part ?? '—'}`, mechanismLabel(inj.mechanism) ? `Como: ${mechanismLabel(inj.mechanism)}` : '',
      inj.description ? `O que aconteceu: ${inj.description}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast.success(tx('Dados copiados. Cole-os no formulário da associação/seguradora.')), () => toast.info(text));
  };

  const claimOf = (id: string) => data?.claims.find((c) => c.injury_id === id) ?? null;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide">{tx('Exame médico-desportivo')}</h3>
            <p className="text-xs text-muted-foreground">{tx('Válido por um ano.')}{' '}{counts.expired ? tx('{{v0}} caducado(s) · ', { v0: counts.expired }) : ''}{counts.soon ? tx('{{v0}} a caducar em 30 dias · ', { v0: counts.soon }) : ''}{counts.missing ? tx('{{v0}} sem registo', { v0: counts.missing }) : ''}</p>
          </div>
          <Button size="sm" onClick={() => setExamFor({ player: '', date: todayIso(), until: oneYearFrom(todayIso()), result: 'apto' })}><Plus className="mr-1 h-4 w-4" />{tx('Registar exame')}</Button>
        </div>
        <div className="divide-y rounded-md border bg-card">
          {rows.map(({ p, exam, state }) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{p.name}</span>{p.team && <span className="ml-1 text-xs text-muted-foreground">{p.team.name}</span>}</span>
              {exam && <span className="text-xs text-muted-foreground">{tx('válido até')}{' '}{day(exam.valid_until)}{exam.result !== 'apto' ? ` · ${exam.result === 'inapto' ? 'inapto' : 'apto condicionado'}` : ''}</span>}
              <Badge variant="outline" className={STATE_TONE[state]}>{EXAM_LABEL[state]}</Badge>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setExamFor({ player: p.id, date: todayIso(), until: oneYearFrom(todayIso()), result: 'apto' })}>{tx('Novo')}</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide">{tx('Participação ao seguro desportivo')}</h3>
            <p className="text-xs text-muted-foreground">{tx('Lesões dos últimos 60 dias. O prazo conta em dias úteis a partir do dia da lesão (na AF Lisboa são 5; confirme o da sua associação).')}</p>
          </div>
          <label className="flex items-center gap-1.5 text-sm">{tx('Prazo')}{' '}<Input type="number" min={1} max={30} className="h-8 w-16" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 5))} aria-label={tx('Prazo em dias úteis')} /> {tx('dias úteis')}</label>
        </div>
        {(data?.injuries.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">{tx('Sem lesões nos últimos 60 dias.')}</p> : (
          <div className="divide-y rounded-md border bg-card">
            {data!.injuries.map((inj) => {
              const c = claimOf(inj.id);
              const left = c && !c.submitted_on ? daysLeft(c.deadline) : null;
              return (
                <div key={inj.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <span className="min-w-0 flex-1"><span className="font-medium">{nameOf(inj.player_id)}</span> <span className="text-muted-foreground">· {BODY_PARTS.find((b) => b.value === inj.body_part)?.label ?? inj.body_part} · {day(inj.injury_date)} ({daysOut(inj.injury_date, inj.return_date)} {tx('dias)')}</span></span>
                  {!c && <Button size="sm" variant="outline" className="h-7" onClick={() => openClaim(inj)}>{tx('Vai ao seguro')}</Button>}
                  {c && !c.submitted_on && <Badge variant="outline" className={cn(left! < 0 ? 'border-destructive text-destructive' : left! <= 1 ? 'border-accent text-accent' : '')}>{left! < 0 ? tx('Prazo passou ({{v0}})', { v0: day(c.deadline) }) : left === 0 ? tx('Prazo acaba hoje') : tx('Faltam {{v0}} dias (até {{v1}})', { v0: left, v1: day(c.deadline) })}</Badge>}
                  {c && !c.submitted_on && <Button size="sm" className="h-7" onClick={() => setSubmitFor({ claim: c, date: todayIso(), number: '' })}>{tx('Enviada')}</Button>}
                  {c?.submitted_on && <Badge variant="outline" className="border-emerald-600 text-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" />{tx('Enviada')}{' '}{day(c.submitted_on)}{c.claim_number ? ` · n.º ${c.claim_number}` : ''}</Badge>}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyData(inj)} aria-label={tx('Copiar os dados para o formulário')} title={tx('Copiar os dados para o formulário')}><ClipboardCopy className="h-3.5 w-3.5" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={!!examFor} onOpenChange={(o) => !o && setExamFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{tx('Exame médico-desportivo')}</DialogTitle></DialogHeader>
          {examFor && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>{tx('Jogador')}</Label>
                <Select value={examFor.player || undefined} onValueChange={(v) => setExamFor({ ...examFor, player: v })}>
                  <SelectTrigger><SelectValue placeholder={tx('Escolher')} /></SelectTrigger>
                  <SelectContent>{players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="ex-date">{tx('Data do exame')}</Label><Input id="ex-date" type="date" value={examFor.date} onChange={(e) => setExamFor({ ...examFor, date: e.target.value, until: oneYearFrom(e.target.value) })} /></div>
              <div><Label htmlFor="ex-until">{tx('Válido até')}</Label><Input id="ex-until" type="date" value={examFor.until} onChange={(e) => setExamFor({ ...examFor, until: e.target.value })} /></div>
              <div className="sm:col-span-2">
                <Label>{tx('Resultado')}</Label>
                <Select value={examFor.result} onValueChange={(v) => setExamFor({ ...examFor, result: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="apto">{tx('Apto')}</SelectItem><SelectItem value="apto_condicionado">{tx('Apto condicionado')}</SelectItem><SelectItem value="inapto">{tx('Inapto')}</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setExamFor(null)}>{tx('Cancelar')}</Button><Button onClick={saveExam} disabled={!examFor?.player}>{tx('Guardar')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!submitFor} onOpenChange={(o) => !o && setSubmitFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{tx('Participação enviada')}</DialogTitle></DialogHeader>
          {submitFor && (
            <div className="grid gap-3">
              <div><Label htmlFor="cl-date">{tx('Enviada a')}</Label><Input id="cl-date" type="date" value={submitFor.date} onChange={(e) => setSubmitFor({ ...submitFor, date: e.target.value })} /></div>
              <div><Label htmlFor="cl-num">{tx('N.º do processo (se houver)')}</Label><Input id="cl-num" maxLength={60} value={submitFor.number} onChange={(e) => setSubmitFor({ ...submitFor, number: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setSubmitFor(null)}>{tx('Cancelar')}</Button><Button onClick={markSubmitted}>{tx('Guardar')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Prevenção ──────────────────────────────────────────────────────────────
interface SessionLite { id: string; date: string; prevention_warmup: boolean; team_id: string }

export function PreventionPanel({ teams }: { teams: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const teamIds = teams.map((t) => t.id);
  const { data: sessions = [] } = useQuery({
    queryKey: ['prevention-sessions', teamIds.join(',')],
    enabled: teamIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 42 * 86_400_000).toISOString();
      return ((await db.from('training_sessions').select('id, date, prevention_warmup, team_id').in('team_id', teamIds).gte('date', since).order('date', { ascending: false })).data ?? []) as SessionLite[];
    },
  });
  const toggle = async (s: SessionLite) => {
    const { error } = await db.from('training_sessions').update({ prevention_warmup: !s.prevention_warmup }).eq('id', s.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['prevention-sessions'] });
  };
  const past = sessions.filter((s) => Date.parse(s.date) <= Date.now());
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p className="font-semibold">{tx('Aquecimento FIFA 11+ Kids')}</p>
          <p className="text-muted-foreground">{tx('Programa de aquecimento da FIFA para crianças até aos 13 anos (cerca de 15 minutos, no início do treino; para os mais velhos existe o FIFA 11+). Nos estudos, as equipas que o fizeram tiveram cerca de metade das lesões, e o efeito é maior quanto mais vezes por semana se faz. Procure "FIFA 11+ Kids" no site da FIFA para os exercícios e os níveis.')}</p>
          <p className="text-muted-foreground">{tx('Marque abaixo os treinos em que foi feito; também se marca em Treinos → Presenças.')}</p>
        </CardContent>
      </Card>
      {teams.map((t) => {
        const weeks = warmupByWeek(past.filter((s) => s.team_id === t.id), 6);
        return (
          <section key={t.id} className="space-y-2">
            <h3 className="text-sm font-semibold">{t.name}</h3>
            <div className="flex items-end gap-2" role="img" aria-label={tx('Aquecimento por semana: {{v0}}', { v0: weeks.map((w) => `${w.done} de ${w.total}`).join(', ') })}>
              {weeks.map((w) => (
                <div key={w.week} className="flex w-12 flex-col items-center gap-1">
                  <div className="flex h-16 w-6 flex-col-reverse overflow-hidden rounded bg-muted">
                    <div className="bg-primary" style={{ height: `${w.total ? (w.done / w.total) * 100 : 0}%` }} />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums">{w.done}/{w.total}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(w.week), 'dd/MM')}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {past.filter((s) => s.team_id === t.id).slice(0, 8).map((s) => (
                <Button key={s.id} size="sm" variant={s.prevention_warmup ? 'default' : 'outline'} className="h-8" aria-pressed={s.prevention_warmup} onClick={() => toggle(s)}>
                  {format(new Date(s.date), "EEE dd/MM", { locale: pt })}{s.prevention_warmup ? ' ✓' : ''}
                </Button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Época ──────────────────────────────────────────────────────────────────
interface SeasonInjury { player_id: string; injury_date: string; return_date: string | null; body_part: string | null; injury_type: string | null; mechanism: string | null; is_recurrence: boolean | null; context: string | null; player: { team: { id: string; name: string } | null } | null }

export function SeasonPanel({ injuries, players }: { injuries: SeasonInjury[]; players: CarePlayer[] }) {
  const now = new Date();
  const start = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1).toISOString().slice(0, 10);
  const season = injuries.filter((i) => i.injury_date >= start);
  const teams = new Map<string, string>();
  players.forEach((p) => p.team && teams.set(p.team.id, p.team.name));
  const byTeam = [...teams.entries()].map(([id, name]) => {
    const list = season.filter((i) => i.player?.team?.id === id);
    const s = seasonSummary(list);
    const squad = players.filter((p) => p.team?.id === id).length;
    return { id, name, squad, ...s, matchShare: list.length ? Math.round((list.filter((i) => i.context === 'match').length / list.length) * 100) : 0 };
  });
  const total = seasonSummary(season);
  const partLabel = (v: string) => BODY_PARTS.find((b) => b.value === v)?.label ?? v;

  const pdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Departamento medico - resumo da epoca', 14, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
    doc.text(`Desde ${format(new Date(start), 'dd/MM/yyyy')} ate ${format(now, 'dd/MM/yyyy')}`, 14, 25);
    doc.setTextColor(15, 23, 42); doc.setFontSize(11);
    doc.text(`Lesoes: ${total.injuries}   Em aberto: ${total.open}   Dias de paragem: ${total.daysLost}   Recaidas: ${total.recurrences}`, 14, 34);
    let y = 44;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    ['Equipa', 'Jogadores', 'Lesoes', 'Abertas', 'Dias perdidos', 'Recaidas', 'Em jogo'].forEach((h, i) => doc.text(h, [14, 70, 92, 110, 128, 154, 174][i], y));
    doc.line(14, y + 2, 196, y + 2); y += 7; doc.setFont('helvetica', 'normal');
    byTeam.forEach((t) => {
      [t.name, String(t.squad), String(t.injuries), String(t.open), String(t.daysLost), String(t.recurrences), `${t.matchShare}%`].forEach((v, i) => doc.text(v, [14, 70, 92, 110, 128, 154, 174][i], y));
      y += 6;
    });
    y += 4; doc.setFont('helvetica', 'bold'); doc.text('Zonas mais afetadas', 14, y); y += 5; doc.setFont('helvetica', 'normal');
    doc.text(total.byPart.slice(0, 6).map((p) => `${partLabel(p.part)} (${p.n})`).join(', ') || '-', 14, y); y += 8;
    doc.setFont('helvetica', 'bold'); doc.text('Como acontecem', 14, y); y += 5; doc.setFont('helvetica', 'normal');
    doc.text(total.byMechanism.map((m) => `${mechanismLabel(m.mechanism) ?? m.mechanism} (${m.n})`).join(', ') || '-', 14, y);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text(`Gerado no TreinON em ${format(now, 'dd/MM/yyyy HH:mm')}. Sem diagnosticos (dados de saude ficam no departamento medico).`, 14, 285);
    void deliverPdf(doc, `departamento-medico-epoca-${format(now, 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tx('Desde')}{' '}{format(new Date(start), 'dd/MM/yyyy')}{tx('. Para a direção: números por equipa, sem diagnósticos.')}</p>
        <Button size="sm" variant="outline" onClick={pdf}><FileDown className="mr-1.5 h-4 w-4" />{tx('PDF da época')}</Button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full whitespace-nowrap text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="p-2">{tx('Equipa')}</th><th className="p-2">{tx('Jogadores')}</th><th className="p-2">{tx('Lesões')}</th><th className="p-2">{tx('Abertas')}</th><th className="p-2">{tx('Dias perdidos')}</th><th className="p-2">{tx('Recaídas')}</th><th className="p-2">{tx('Em jogo')}</th></tr></thead>
          <tbody>
            {byTeam.map((t) => (
              <tr key={t.id} className="border-b font-mono tabular-nums last:border-0"><td className="p-2 font-sans font-medium">{t.name}</td><td className="p-2">{t.squad}</td><td className="p-2">{t.injuries}</td><td className="p-2">{t.open}</td><td className="p-2">{t.daysLost}</td><td className="p-2">{t.recurrences}</td><td className="p-2">{t.matchShare}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm"><span className="text-muted-foreground">{tx('Zonas:')}</span> {total.byPart.slice(0, 6).map((p) => `${partLabel(p.part)} (${p.n})`).join(', ') || '—'}</p>
      <p className="text-sm"><span className="text-muted-foreground">{tx('Como acontecem:')}</span> {total.byMechanism.map((m) => `${(mechanismLabel(m.mechanism) ?? m.mechanism).toLowerCase()} (${m.n})`).join(', ') || '—'}</p>
    </div>
  );
}
