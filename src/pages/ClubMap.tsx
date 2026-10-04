/**
 * Club map: every team's weekly training timetable and the fixtures of each week,
 * with logistics (meeting time, transport, kit). The coordinator / club admin edits;
 * the club's coaches read it, so everyone knows when and where. A coach without a
 * club gets the same map for their own teams.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, Dumbbell, MapPin, Pencil, Plus, Share2, Trash2, Trophy, Bus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { shareText } from '@/lib/share';
import { addDays, findClashes, fixturesText, hhmm, timetableText, weekStart, WEEKDAYS, type MapMatch, type MatchLogistics, type TrainingSlot } from '@/lib/club-map';
import { cn } from '@/lib/utils';
import { useClubCoordinators } from '@/components/club/CoordinatorsPanel';

interface Team { id: string; name: string; category: string | null }

const TEAM_TONES = ['bg-blue-500/15 border-blue-500/40', 'bg-emerald-500/15 border-emerald-500/40', 'bg-amber-500/15 border-amber-500/40', 'bg-purple-500/15 border-purple-500/40',
  'bg-rose-500/15 border-rose-500/40', 'bg-cyan-500/15 border-cyan-500/40', 'bg-orange-500/15 border-orange-500/40', 'bg-lime-500/15 border-lime-500/40'];
const MATCH_TYPES: Record<string, string> = { championship: 'Campeonato', friendly: 'Amigável', tournament: 'Torneio' };
const two = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

export default function ClubMap() {
  const { user } = useAuth();
  const { clubId, isClubAdmin, staffRole, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();
  const canEdit = !clubId || isClubAdmin || staffRole === 'coordenador';
  const { data: coordinators = [] } = useClubCoordinators(clubId);
  const myArea = coordinators.find((c) => c.user_id === user?.id)?.team_ids ?? [];
  // a coordinator with an area edits only the teams of that area (the database enforces it too)
  const canEditTeam = (teamId: string) => !clubId || isClubAdmin || (staffRole === 'coordenador' && (myArea.length === 0 || myArea.includes(teamId)));
  const [week, setWeek] = useState(() => weekStart(new Date()));
  const [slotForm, setSlotForm] = useState<Partial<TrainingSlot> & { days?: number[] } | null>(null);
  const [matchForm, setMatchForm] = useState<MatchDraft | null>(null);

  const { data: club } = useQuery({
    queryKey: ['map-club', clubId],
    enabled: !!clubId,
    queryFn: async () => (await supabase.from('clubs').select('name').eq('id', clubId!).maybeSingle()).data,
  });
  const clubName = club?.name ?? 'As minhas equipas';

  const { data: teams = [] } = useQuery({
    queryKey: ['map-teams', clubId, user?.id],
    enabled: !!user && !roleLoading,
    queryFn: async () => {
      if (clubId) {
        const { data, error } = await supabase.rpc('get_club_teams' as never, { _club: clubId } as never);
        if (error) throw error;
        return (data ?? []) as unknown as Team[];
      }
      const { data } = await supabase.from('teams').select('id, name, category').order('name');
      return (data ?? []) as Team[];
    },
  });
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '—';
  const editableTeams = teams.filter((t) => canEditTeam(t.id));
  const tone = (id: string) => TEAM_TONES[Math.max(0, teamIds.indexOf(id)) % TEAM_TONES.length];

  const { data: slots = [] } = useQuery({
    queryKey: ['map-slots', teamIds.join(',')],
    enabled: teamIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('team_training_slots' as never).select('*').in('team_id', teamIds).order('start_time');
      if (error) throw error;
      return (data ?? []) as unknown as TrainingSlot[];
    },
  });
  const clashes = useMemo(() => findClashes(slots), [slots]);

  const { data: matches = [] } = useQuery({
    queryKey: ['map-matches', clubId, teamIds.join(','), week.toISOString()],
    enabled: teamIds.length > 0,
    queryFn: async () => {
      const from = week.toISOString(), to = addDays(week, 7).toISOString();
      if (clubId) {
        const { data, error } = await supabase.rpc('get_club_match_map' as never, { _club: clubId, _from: from, _to: to } as never);
        if (error) throw error;
        return (data ?? []) as unknown as MapMatch[];
      }
      const { data } = await supabase.from('matches').select('*').in('team_id', teamIds).gte('match_date', from).lt('match_date', to).eq('is_deleted', false).order('match_date');
      return ((data ?? []) as any[]).map((m) => ({ ...m, team_name: teamName(m.team_id) })) as MapMatch[];
    },
  });

  // ── training slots ──
  const saveSlot = async () => {
    const f = slotForm!;
    if (!f.team_id || !f.start_time || !f.end_time) return toast.error('Escolha a equipa e as horas.');
    if (f.end_time <= f.start_time) return toast.error('A hora de fim tem de ser depois do início.');
    const base = { team_id: f.team_id, start_time: f.start_time, end_time: f.end_time, location: f.location?.trim() || null, notes: f.notes?.trim() || null };
    const days = f.id ? [f.weekday!] : (f.days?.length ? f.days : []);
    if (days.length === 0) return toast.error('Escolha pelo menos um dia.');
    const q = supabase.from('team_training_slots' as never);
    const { error } = f.id
      ? await q.update({ ...base, weekday: f.weekday } as never).eq('id', f.id)
      : await q.insert(days.map((weekday) => ({ ...base, weekday })) as never);
    if (error) return toast.error('Não foi possível guardar: ' + error.message);
    setSlotForm(null);
    qc.invalidateQueries({ queryKey: ['map-slots'] });
  };
  const deleteSlot = async (id: string) => {
    const { error } = await supabase.from('team_training_slots' as never).delete().eq('id', id);
    if (error) return toast.error(error.message);
    setSlotForm(null);
    qc.invalidateQueries({ queryKey: ['map-slots'] });
  };

  // ── matches ──
  const saveMatch = async () => {
    const f = matchForm!;
    if (!f.team_id || !f.date || !f.time || !f.opponent.trim()) return toast.error('Preencha equipa, data, hora e adversário.');
    const logistics: MatchLogistics = {};
    (['meet_time', 'meet_place', 'transport', 'kit', 'info'] as const).forEach((k) => { if (f[k]?.trim()) logistics[k] = f[k]!.trim(); });
    const payload = {
      team_id: f.team_id, match_date: new Date(`${f.date}T${f.time}:00`).toISOString(), opponent_name: f.opponent.trim(), is_home: f.is_home,
      location: f.location.trim() || null, match_type: f.match_type,
      competition: f.competition.trim() || MATCH_TYPES[f.match_type], logistics: Object.keys(logistics).length ? logistics : null,
    };
    const { error } = f.id
      ? await supabase.from('matches').update(payload as never).eq('id', f.id)
      : await supabase.from('matches').insert({ ...payload, owner_id: user!.id, status: 'scheduled', report_status: 'draft' } as never);
    if (error) return toast.error('Não foi possível guardar: ' + error.message);
    toast.success(f.id ? 'Jogo atualizado.' : 'Jogo marcado. Os treinadores da equipa já o veem.');
    setMatchForm(null);
    qc.invalidateQueries({ queryKey: ['map-matches'] });
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const isThisWeek = dayKey(week) === dayKey(weekStart(new Date()));

  return (
    <AppLayout title="Mapa do clube">
      <div className="space-y-6">
        <PageHeader
          title="Mapa do clube"
          description={canEdit ? 'Treinos e jogos de todas as equipas. O que marcar aqui, os treinadores veem.' : `Treinos e jogos de todas as equipas de ${clubName}.`}
          icon={<CalendarDays className="w-6 h-6 text-primary" />}
        />

        {coordinators.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {coordinators.map((c) => (
              <span key={c.user_id} className="rounded-md border bg-card px-2 py-1">
                <b>{c.area || 'Coordenação'}</b> · {c.name}
                <span className="text-muted-foreground"> — {c.team_ids.length ? c.team_ids.map(teamName).join(', ') : 'todas as equipas'}</span>
              </span>
            ))}
          </div>
        )}

        {teams.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Ainda não há equipas. Crie as equipas primeiro.</CardContent></Card>
        ) : (
          <Tabs defaultValue="matches">
            <TabsList>
              <TabsTrigger value="matches" className="gap-1.5"><Trophy className="h-4 w-4" />Jogos da semana</TabsTrigger>
              <TabsTrigger value="trainings" className="gap-1.5"><Dumbbell className="h-4 w-4" />Mapa de treinos</TabsTrigger>
            </TabsList>

            {/* ─── Fixtures ─── */}
            <TabsContent value="matches" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => setWeek(addDays(week, -7))} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[11rem] text-center text-sm font-semibold">
                  {week.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} – {addDays(week, 6).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <Button size="icon" variant="outline" onClick={() => setWeek(addDays(week, 7))} aria-label="Semana seguinte"><ChevronRight className="h-4 w-4" /></Button>
                {!isThisWeek && <Button size="sm" variant="ghost" onClick={() => setWeek(weekStart(new Date()))}>Esta semana</Button>}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => shareText(fixturesText(clubName, week, matches), 'Jogos da semana')}><Share2 className="mr-1.5 h-4 w-4" />Partilhar</Button>
                  {canEdit && <Button size="sm" onClick={() => setMatchForm(newMatchDraft((editableTeams[0] ?? teams[0]).id, addDays(week, 5)))}><Plus className="mr-1.5 h-4 w-4" />Marcar jogo</Button>}
                </div>
              </div>

              {matches.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">Sem jogos marcados nesta semana.</CardContent></Card>}
              {days.map((d) => {
                const list = matches.filter((m) => dayKey(new Date(m.match_date)) === dayKey(d));
                if (list.length === 0) return null;
                return (
                  <div key={dayKey(d)}>
                    <p className="mb-1.5 text-sm font-semibold capitalize">{d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <div className="space-y-2">
                      {list.map((m) => {
                        const md = new Date(m.match_date);
                        const l = m.logistics ?? {};
                        const done = m.status === 'completed' || m.status === 'finished';
                        return (
                          <div key={m.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border p-3', tone(m.team_id))}>
                            <span className="font-mono text-lg font-bold">{two(md.getHours())}:{two(md.getMinutes())}</span>
                            <div className="min-w-[12rem] flex-1">
                              <p className="font-semibold">{m.team_name} <span className="font-normal text-muted-foreground">{m.is_home ? 'vs' : '@'}</span> {m.opponent_name}</p>
                              <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-[10px]">{MATCH_TYPES[m.match_type ?? ''] ?? m.competition ?? 'Jogo'}</Badge>
                                <span>{m.is_home ? 'Casa' : 'Fora'}</span>
                                {m.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                                {l.meet_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Concentração {l.meet_time}{l.meet_place ? ` · ${l.meet_place}` : ''}</span>}
                                {l.transport && <span className="flex items-center gap-1"><Bus className="h-3 w-3" />{l.transport}</span>}
                                {l.kit && <span>👕 {l.kit}</span>}
                              </p>
                              {l.info && <p className="mt-0.5 text-xs">{l.info}</p>}
                            </div>
                            {done && <span className="font-mono text-lg font-bold">{m.goals_for ?? 0}–{m.goals_against ?? 0}</span>}
                            {canEditTeam(m.team_id) && !done && (
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMatchForm(draftFromMatch(m))} aria-label="Editar jogo"><Pencil className="h-4 w-4" /></Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            {/* ─── Weekly training timetable ─── */}
            <TabsContent value="trainings" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {clashes.size > 0 && (
                  <span className="flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-500/10 px-2 py-1 text-sm text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" />{clashes.size} treinos no mesmo campo à mesma hora
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => shareText(timetableText(clubName, slots, teamName), 'Mapa de treinos')}><Share2 className="mr-1.5 h-4 w-4" />Partilhar</Button>
                  {canEdit && <Button size="sm" onClick={() => setSlotForm({ team_id: (editableTeams[0] ?? teams[0]).id, days: [], start_time: '18:30', end_time: '20:00', location: '' })}><Plus className="mr-1.5 h-4 w-4" />Horário de treino</Button>}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
                {WEEKDAYS.map((label, i) => {
                  const list = slots.filter((s) => s.weekday === i + 1).sort((a, b) => a.start_time.localeCompare(b.start_time));
                  return (
                    <div key={label} className="rounded-lg border bg-card">
                      <p className="border-b px-3 py-2 text-sm font-semibold">{label}</p>
                      <div className="space-y-1.5 p-2">
                        {list.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">—</p>}
                        {list.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            disabled={!canEditTeam(s.team_id)}
                            onClick={() => setSlotForm({ ...s, start_time: hhmm(s.start_time), end_time: hhmm(s.end_time) })}
                            className={cn('w-full rounded-md border p-2 text-left text-xs', tone(s.team_id), clashes.has(s.id) && 'ring-2 ring-red-500', canEditTeam(s.team_id) && 'hover:brightness-95')}
                          >
                            <p className="font-mono font-semibold">{hhmm(s.start_time)}–{hhmm(s.end_time)}</p>
                            <p className="text-sm font-semibold">{teamName(s.team_id)}</p>
                            {s.location && <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{s.location}</p>}
                            {s.notes && <p className="text-muted-foreground">{s.notes}</p>}
                            {clashes.has(s.id) && <p className="font-semibold text-red-600">Campo ocupado</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Training slot dialog */}
      <Dialog open={!!slotForm} onOpenChange={(v) => !v && setSlotForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{slotForm?.id ? 'Editar horário' : 'Novo horário de treino'}</DialogTitle>
            <DialogDescription>Repete-se todas as semanas.</DialogDescription>
          </DialogHeader>
          {slotForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Equipa</Label>
                <Select value={slotForm.team_id} onValueChange={(v) => setSlotForm({ ...slotForm, team_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{editableTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{slotForm.id ? 'Dia' : 'Dias'}</Label>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((label, i) => {
                    const day = i + 1;
                    const on = slotForm.id ? slotForm.weekday === day : !!slotForm.days?.includes(day);
                    return (
                      <Button key={label} type="button" size="sm" variant={on ? 'default' : 'outline'} className="h-8 px-2"
                        onClick={() => setSlotForm(slotForm.id ? { ...slotForm, weekday: day } : { ...slotForm, days: on ? slotForm.days!.filter((x) => x !== day) : [...(slotForm.days ?? []), day] })}>
                        {label.slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Início</Label><Input type="time" value={slotForm.start_time ?? ''} onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Fim</Label><Input type="time" value={slotForm.end_time ?? ''} onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Campo / local</Label><Input value={slotForm.location ?? ''} onChange={(e) => setSlotForm({ ...slotForm, location: e.target.value })} placeholder="Ex.: Campo 1 (metade)" /></div>
              <div className="space-y-1.5"><Label>Notas</Label><Input value={slotForm.notes ?? ''} onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })} placeholder="Opcional" /></div>
              <div className="flex justify-between gap-2 pt-1">
                {slotForm.id ? <Button variant="ghost" className="text-destructive" onClick={() => deleteSlot(slotForm.id!)}><Trash2 className="mr-1.5 h-4 w-4" />Apagar</Button> : <span />}
                <Button onClick={saveSlot}>Guardar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Match dialog */}
      <Dialog open={!!matchForm} onOpenChange={(v) => !v && setMatchForm(null)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{matchForm?.id ? 'Editar jogo' : 'Marcar jogo'}</DialogTitle>
            <DialogDescription>Os treinadores da equipa veem o jogo e a logística nos seus jogos.</DialogDescription>
          </DialogHeader>
          {matchForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Equipa</Label>
                  <Select value={matchForm.team_id} onValueChange={(v) => setMatchForm({ ...matchForm, team_id: v })} disabled={!!matchForm.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{editableTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={matchForm.match_type} onValueChange={(v) => setMatchForm({ ...matchForm, match_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(MATCH_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={matchForm.date} onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Hora do jogo</Label><Input type="time" value={matchForm.time} onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Adversário</Label><Input value={matchForm.opponent} onChange={(e) => setMatchForm({ ...matchForm, opponent: e.target.value })} /></div>
              <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant={matchForm.is_home ? 'default' : 'outline'} onClick={() => setMatchForm({ ...matchForm, is_home: true })}>Casa</Button>
                  <Button type="button" size="sm" variant={!matchForm.is_home ? 'default' : 'outline'} onClick={() => setMatchForm({ ...matchForm, is_home: false })}>Fora</Button>
                </div>
                <div className="space-y-1.5"><Label>Campo / local</Label><Input value={matchForm.location} onChange={(e) => setMatchForm({ ...matchForm, location: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Competição (opcional)</Label><Input value={matchForm.competition} onChange={(e) => setMatchForm({ ...matchForm, competition: e.target.value })} placeholder="Ex.: Campeonato Distrital Sub-13" /></div>
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logística</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Hora de concentração</Label><Input type="time" value={matchForm.meet_time ?? ''} onChange={(e) => setMatchForm({ ...matchForm, meet_time: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Local de concentração</Label><Input value={matchForm.meet_place ?? ''} onChange={(e) => setMatchForm({ ...matchForm, meet_place: e.target.value })} placeholder="Ex.: Sede" /></div>
                <div className="space-y-1.5"><Label>Transporte</Label><Input value={matchForm.transport ?? ''} onChange={(e) => setMatchForm({ ...matchForm, transport: e.target.value })} placeholder="Ex.: Carrinha do clube" /></div>
                <div className="space-y-1.5"><Label>Equipamento</Label><Input value={matchForm.kit ?? ''} onChange={(e) => setMatchForm({ ...matchForm, kit: e.target.value })} placeholder="Ex.: Principal" /></div>
              </div>
              <div className="space-y-1.5"><Label>Outras informações</Label><Textarea rows={2} value={matchForm.info ?? ''} onChange={(e) => setMatchForm({ ...matchForm, info: e.target.value })} /></div>
              <div className="flex justify-end pt-1"><Button onClick={saveMatch}>{matchForm.id ? 'Guardar' : 'Marcar jogo'}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

interface MatchDraft extends MatchLogistics {
  id?: string; team_id: string; date: string; time: string; opponent: string; is_home: boolean; location: string; match_type: string; competition: string;
}
const newMatchDraft = (teamId: string, day: Date): MatchDraft =>
  ({ team_id: teamId, date: dayKey(day), time: '10:00', opponent: '', is_home: true, location: '', match_type: 'championship', competition: '' });
const draftFromMatch = (m: MapMatch): MatchDraft => {
  const d = new Date(m.match_date);
  return {
    id: m.id, team_id: m.team_id, date: dayKey(d), time: `${two(d.getHours())}:${two(d.getMinutes())}`, opponent: m.opponent_name, is_home: m.is_home,
    location: m.location ?? '', match_type: m.match_type ?? 'championship', competition: m.competition ?? '', ...(m.logistics ?? {}),
  };
};
