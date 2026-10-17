/**
 * Departamento médico: everybody's view of the injured players.
 *  - the physio / doctor: what is new and still to assess, who is out, who is back soon;
 *  - coaches: the same list for their teams (status, restrictions, expected return — no diagnosis);
 *  - the club's leadership: the season in numbers.
 * The detail of each injury is on the player's page (Saúde / Lesões).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Plus, Stethoscope, Trash2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { BODY_PARTS, INJURY_TYPES } from '@/lib/player-constants';
import { getClinicalStatusOption, CLINICAL_STATUS_OPTIONS } from '@/lib/player-availability';
import { phaseOf } from '@/lib/rehab';
import { MECHANISMS, careGroups, daysOut, mechanismLabel, seasonSummary, type CareGroup, type CareInjury } from '@/lib/injury-care';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const ALL = '__all__';
const day = (d: string) => format(new Date(d), 'dd/MM', { locale: pt });
const partLabel = (v?: string | null) => BODY_PARTS.find((b) => b.value === v)?.label ?? v ?? '—';
const typeLabel = (v?: string | null) => INJURY_TYPES.find((t) => t.value === v)?.label ?? v ?? '';

interface Row extends CareInjury {
  player_id: string; mechanism: string | null; is_recurrence: boolean | null; description: string | null; context: string | null;
  rehab_protocol: string | null; rehab_phase: number | null;
  player: { id: string; name: string; number: number | null; team: { id: string; name: string } | null } | null;
}
interface PlayerOpt { id: string; name: string; number: number | null; team: { id: string; name: string } | null }

const GROUPS: { key: CareGroup; title: string; hint: string; icon: typeof Activity; tone: string }[] = [
  { key: 'to_assess', title: 'Por avaliar', hint: 'Ocorrências registadas pelos treinadores que o departamento médico ainda não viu.', icon: ClipboardCheck, tone: 'text-accent' },
  { key: 'out', title: 'Fora (inaptos ou em recuperação)', hint: 'Não treinam nem jogam.', icon: AlertTriangle, tone: 'text-destructive' },
  { key: 'limited', title: 'Condicionados', hint: 'Podem participar, com as restrições indicadas.', icon: Activity, tone: 'text-amber-600' },
  { key: 'back_soon', title: 'Regressam nos próximos 7 dias', hint: 'Pela data prevista. A alta continua a ser dada pelo departamento médico.', icon: CalendarClock, tone: 'text-primary' },
  { key: 'recently_cleared', title: 'Altas nas últimas 2 semanas', hint: 'Atenção às recaídas nas primeiras semanas.', icon: CheckCircle2, tone: 'text-emerald-600' },
];

export default function MedicalDepartment() {
  const { user } = useAuth();
  const { clubId, isClubAdmin, staffRole } = useUserRole();
  const qc = useQueryClient();
  const [team, setTeam] = useState(ALL);
  const [report, setReport] = useState(false);
  const isMedical = staffRole === 'physio' || staffRole === 'medico';

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['medical-dept', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from('player_injuries')
        .select('id, player_id, injury_date, return_date, expected_return_date, body_part, injury_type, clinical_status, can_play, restrictions, assessed_at, mechanism, is_recurrence, description, context, rehab_protocol, rehab_phase, player:players(id, name, number, team:teams(id, name))')
        .order('injury_date', { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const teams = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.player?.team && m.set(r.player.team.id, r.player.team.name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt'));
  }, [rows]);
  const shown = useMemo(() => (team === ALL ? rows : rows.filter((r) => r.player?.team?.id === team)), [rows, team]);
  const grouped = useMemo(() => {
    const g = Object.fromEntries(GROUPS.map((x) => [x.key, [] as Row[]])) as Record<CareGroup, Row[]>;
    // without a club there is no medical staff to assess anything: no "to assess" list
    shown.forEach((r) => careGroups(r).forEach((k) => { if (k !== 'to_assess' || clubId) g[k].push(r); }));
    return g;
  }, [shown, clubId]);

  // this season (from July)
  const now = new Date();
  const seasonStart = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1).toISOString().slice(0, 10);
  const summary = useMemo(() => seasonSummary(shown.filter((r) => r.injury_date >= seasonStart)), [shown, seasonStart]);

  const markAssessed = async (r: Row) => {
    const { error } = await db.from('player_injuries').update({ assessed_at: new Date().toISOString(), assessed_by: user!.id }).eq('id', r.id);
    if (error) return toast.error('Não foi possível guardar: ' + error.message);
    qc.invalidateQueries({ queryKey: ['medical-dept'] });
  };

  return (
    <AppLayout title="Departamento médico">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold"><Stethoscope className="h-5 w-5 text-primary" />Departamento médico</h1>
            <p className="text-sm text-muted-foreground">
              {isMedical ? 'As ocorrências dos treinadores chegam aqui. O detalhe de cada lesão (diagnóstico, tratamento, alta) está na ficha do jogador.'
                : 'Quem está lesionado, até quando e com que restrições. O diagnóstico fica com o médico e o fisioterapeuta.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {teams.length > 1 && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as equipas</SelectItem>
                  {teams.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setReport(true)}><Plus className="mr-1.5 h-4 w-4" />Registar lesão</Button>
          </div>
        </div>

        {clubId && <MedicalStaffCard clubId={clubId} canManage={isClubAdmin} />}

        {/* the season, at a glance */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([['Lesões esta época', summary.injuries], ['Ainda em aberto', summary.open], ['Dias de paragem', summary.daysLost], ['Recaídas', summary.recurrences]] as const).map(([k, v]) => (
            <Card key={k}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-mono text-2xl font-bold tabular-nums">{v}</p></CardContent></Card>
          ))}
        </div>
        {summary.injuries > 0 && (
          <p className="text-xs text-muted-foreground">
            Zonas mais afetadas: {summary.byPart.slice(0, 3).map((p) => `${partLabel(p.part)} (${p.n})`).join(', ') || '—'}
            {summary.byMechanism.length > 0 && <> · Como acontecem: {summary.byMechanism.slice(0, 3).map((m) => `${(mechanismLabel(m.mechanism) ?? m.mechanism).toLowerCase()} (${m.n})`).join(', ')}</>}
          </p>
        )}

        {isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">A carregar…</p> : GROUPS.map((g) => {
          const list = grouped[g.key];
          if (!list.length && g.key !== 'out') return null;
          return (
            <section key={g.key} className="space-y-2">
              <div className="border-b pb-1">
                <h2 className={cn('flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide', g.tone)}><g.icon className="h-4 w-4" />{g.title} <span className="font-mono text-muted-foreground">({list.length})</span></h2>
                <p className="text-xs text-muted-foreground">{g.hint}</p>
              </div>
              {list.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém. </p> : (
                <div className="divide-y rounded-md border bg-card">
                  {list.map((r) => {
                    const st = getClinicalStatusOption(r.clinical_status);
                    const out = daysOut(r.injury_date, r.return_date);
                    return (
                      <div key={`${g.key}-${r.id}`} className="flex flex-wrap items-center gap-2 p-3">
                        <Link to={`/players/${r.player_id}?tab=health`} className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{r.player?.number != null && <span className="mr-1 font-mono text-muted-foreground">{r.player.number}</span>}{r.player?.name ?? 'Jogador'}</span>
                            {r.player?.team && <span className="text-xs text-muted-foreground">{r.player.team.name}</span>}
                            {st && <Badge variant="outline" className={st.tone}>{st.label}</Badge>}
                            {r.is_recurrence && <Badge variant="outline" className="border-orange-500/40 text-orange-600">Recaída</Badge>}
                            {r.rehab_phase && !r.return_date && <Badge variant="secondary">{r.rehab_protocol === 'concussion' ? 'Concussão · ' : ''}Fase {r.rehab_phase}/6 · {phaseOf(r.rehab_protocol, r.rehab_phase)?.name}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {partLabel(r.body_part)}{r.injury_type ? ` · ${typeLabel(r.injury_type).toLowerCase()}` : ''} · desde {day(r.injury_date)} ({out} {out === 1 ? 'dia' : 'dias'})
                            {r.expected_return_date && !r.return_date && <> · regresso previsto {day(r.expected_return_date)}</>}
                            {r.return_date && <> · alta {day(r.return_date)}</>}
                          </p>
                          {r.restrictions && <p className="text-xs"><span className="text-muted-foreground">Restrições:</span> {r.restrictions}</p>}
                        </Link>
                        {g.key === 'to_assess' && isMedical && <Button size="sm" variant="outline" onClick={() => markAssessed(r)}><ClipboardCheck className="mr-1.5 h-4 w-4" />Vista</Button>}
                        <Button size="sm" variant="ghost" asChild><Link to={`/players/${r.player_id}?tab=health`}>Abrir</Link></Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {report && <ReportInjuryDialog onClose={() => setReport(false)} onSaved={() => { setReport(false); qc.invalidateQueries({ queryKey: ['medical-dept'] }); }} isMedical={isMedical} />}
    </AppLayout>
  );
}

/** A quick record at the side of the pitch: who, where, how. The medical staff completes it. */
function ReportInjuryDialog({ onClose, onSaved, isMedical }: { onClose: () => void; onSaved: () => void; isMedical: boolean }) {
  const { user } = useAuth();
  const [f, setF] = useState({ player: '', date: new Date().toISOString().slice(0, 10), context: 'training', body_part: '', body_side: 'n_a', injury_type: '', mechanism: '', status: 'inapto', description: '' });
  const [busy, setBusy] = useState(false);
  const { data: players = [] } = useQuery({
    queryKey: ['medical-players', user?.id],
    enabled: !!user,
    queryFn: async () => ((await supabase.from('players').select('id, name, number, team:teams(id, name)').eq('is_active', true).order('name')).data ?? []) as unknown as PlayerOpt[],
  });
  const save = async () => {
    if (!f.player || !f.body_part) return;
    setBusy(true);
    const status = CLINICAL_STATUS_OPTIONS.find((o) => o.value === f.status)?.value ?? 'inapto';
    const { error } = await db.from('player_injuries').insert({
      player_id: f.player, owner_id: user!.id, injury_date: f.date, context: f.context, body_part: f.body_part, body_side: f.body_side,
      injury_type: f.injury_type || 'other', mechanism: f.mechanism || null, clinical_status: status, can_play: status === 'condicionado' || status === 'retorno_progressivo',
      description: f.description.trim() || null, severity: 'moderate', reported_by: user!.id,
      ...(isMedical ? { assessed_at: new Date().toISOString(), assessed_by: user!.id } : {}),
    });
    setBusy(false);
    if (error) return toast.error('Não foi possível registar: ' + error.message);
    toast.success(isMedical ? 'Lesão registada.' : 'Lesão registada. O departamento médico vê-a em "Por avaliar".');
    onSaved();
  };
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registar lesão</DialogTitle>
          <DialogDescription>O essencial, no momento. O departamento médico completa a avaliação.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Jogador *</Label>
            <Select value={f.player || undefined} onValueChange={(v) => set({ player: v })}>
              <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
              <SelectContent>{players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.team ? ` · ${p.team.name}` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="ri-date">Data</Label><Input id="ri-date" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></div>
          <div>
            <Label>Onde</Label>
            <Select value={f.context} onValueChange={(v) => set({ context: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="training">Treino</SelectItem><SelectItem value="match">Jogo</SelectItem><SelectItem value="extra">Fora do futebol</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zona do corpo *</Label>
            <Select value={f.body_part || undefined} onValueChange={(v) => set({ body_part: v })}>
              <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
              <SelectContent>{BODY_PARTS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lado</Label>
            <Select value={f.body_side} onValueChange={(v) => set({ body_side: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="left">Esquerdo</SelectItem><SelectItem value="right">Direito</SelectItem><SelectItem value="both">Os dois</SelectItem><SelectItem value="n_a">Não se aplica</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={f.injury_type || undefined} onValueChange={(v) => set({ injury_type: v })}>
              <SelectTrigger><SelectValue placeholder="Se souber" /></SelectTrigger>
              <SelectContent>{INJURY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Como aconteceu</Label>
            <Select value={f.mechanism || undefined} onValueChange={(v) => set({ mechanism: v })}>
              <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
              <SelectContent>{MECHANISMS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Pode continuar a treinar/jogar?</Label>
            <Select value={f.status} onValueChange={(v) => set({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inapto">Não — fica de fora até ser visto</SelectItem>
                <SelectItem value="condicionado">Sim, com cuidado (condicionado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label htmlFor="ri-desc">O que aconteceu</Label><Textarea id="ri-desc" rows={3} maxLength={2000} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ex.: choque no joelho num lance dividido; saiu a coxear, pôs gelo" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={busy || !f.player || !f.body_part}>Registar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The club's doctor and physio: named by the club's administrator. */
function MedicalStaffCard({ clubId, canManage }: { clubId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'physio' | 'medico'>('physio');
  const { data: staff = [] } = useQuery({
    queryKey: ['club-medical-staff', clubId],
    queryFn: async () => ((await db.rpc('club_medical_staff', { _club: clubId })).data ?? []) as { user_id: string; name: string; email: string | null; role: string }[],
  });
  const call = async (mail: string, r: string, ok: string) => {
    const { data, error } = await db.rpc('set_medical_staff', { _club: clubId, _email: mail, _role: r });
    if (error) return toast.error(error.message);
    toast.success(ok.replace('%', String(data)));
    setEmail('');
    qc.invalidateQueries({ queryKey: ['club-medical-staff', clubId] });
  };
  if (!canManage && staff.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-semibold">Equipa médica do clube</p>
        {staff.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há médico nem fisioterapeuta. Sem eles, o diagnóstico não fica visível a ninguém do clube.</p> : (
          <div className="flex flex-wrap gap-2">
            {staff.map((s) => (
              <span key={s.user_id} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
                <Badge variant="secondary">{s.role === 'medico' ? 'Médico' : 'Fisioterapeuta'}</Badge>{s.name}
                {canManage && s.email && <button type="button" onClick={() => window.confirm(`Retirar ${s.name} da equipa médica? Deixa de ver os dados clínicos.`) && call(s.email!, 'none', '% deixou a equipa médica.')} aria-label={`Retirar ${s.name}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>}
              </span>
            ))}
          </div>
        )}
        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1"><Label htmlFor="ms-email">Email da conta TreinON da pessoa</Label><Input id="ms-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fisio@exemplo.pt" /></div>
            <Select value={role} onValueChange={(v) => setRole(v as 'physio' | 'medico')}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="physio">Fisioterapeuta</SelectItem><SelectItem value="medico">Médico</SelectItem></SelectContent>
            </Select>
            <Button onClick={() => call(email, role, `% faz agora parte da equipa médica.`)} disabled={!email.includes('@')}><UserPlus className="mr-1.5 h-4 w-4" />Dar acesso</Button>
          </div>
        )}
        {canManage && <p className="text-xs text-muted-foreground">A pessoa tem de ter conta na TreinON (criada em treinon.vercel.app). O médico e o fisioterapeuta veem os jogadores do clube e os dados clínicos das lesões; os treinadores e a direção veem só o estado.</p>}
      </CardContent>
    </Card>
  );
}
