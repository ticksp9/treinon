/**
 * Eventos: the calendar everyone shares.
 *  - parents and players: their team's matches and trainings plus club/team events — this
 *    and Comunicação are all they get in the app
 *  - coaches and club: the same list, and they publish the events (dinners, activities, meetings)
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Dumbbell, Loader2, Mail, MapPin, MessageCircle, PartyPopper, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import {
  EVENT_KIND_LABELS, buildAgenda, dayLabel, eventShareText, groupByDay, splitAgenda, timeLabel,
  type AgendaItem, type AgendaKind, type ClubEventRow, type EventKind, type MatchRow, type TrainingRow,
} from '@/lib/agenda';
import { openWhatsApp, sendNotice, toastNotice } from '@/lib/notice';
import { cn } from '@/lib/utils';

interface FamilyRow { team_id: string; team_name: string; club_id: string | null; player_id: string; player_name: string }
interface TeamRow { id: string; name: string; club_id: string | null; owner_id?: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // club_events / my_family_teams are newer than the generated types

const KIND_META: Record<AgendaKind, { label: string; icon: typeof Trophy; className: string }> = {
  match: { label: 'Jogos', icon: Trophy, className: 'bg-primary/10 text-primary' },
  event: { label: 'Eventos', icon: PartyPopper, className: 'bg-accent/15 text-accent' },
  training: { label: 'Treinos', icon: Dumbbell, className: 'bg-muted text-muted-foreground' },
};
const ALL_TEAMS = '__all__', WHOLE_CLUB = '__club__';
const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

interface EventForm { id?: string; title: string; kind: EventKind; date: string; time: string; endTime: string; location: string; description: string; audience: string; email: boolean }

export default function Agenda() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { isGuardian, isPlayer, isClubAdmin, isCoordinator, clubId, loading: roleLoading } = useUserRole();
  const { scopeTeams } = useActiveTeam();
  const isFamily = isGuardian || isPlayer;
  const [filters, setFilters] = useState<Record<AgendaKind, boolean>>({ match: true, event: true, training: true });
  const [showPast, setShowPast] = useState(false);
  const [form, setForm] = useState<EventForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState<string | null>(null);

  // ── whose calendar: my children's teams, or the teams I coach ──
  const { data: family = [], isLoading: familyLoading } = useQuery({
    queryKey: ['agenda-family', user?.id],
    enabled: !!user && isFamily,
    queryFn: async () => ((await db.rpc('my_family_teams')).data ?? []) as FamilyRow[],
  });
  const { data: staffTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['agenda-teams', user?.id],
    enabled: !!user && !roleLoading && !isFamily,
    queryFn: async () => ((await supabase.from('teams').select('id, name, club_id, owner_id').order('name')).data ?? []) as TeamRow[],
  });
  const teams: TeamRow[] = useMemo(() => {
    if (isFamily) {
      const seen = new Map<string, TeamRow>();
      family.forEach((f) => seen.set(f.team_id, { id: f.team_id, name: f.team_name, club_id: f.club_id }));
      return [...seen.values()];
    }
    return scopeTeams(staffTeams);
  }, [isFamily, family, staffTeams, scopeTeams]);
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const teamNames = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t.name])), [teams]);

  // ── the calendar itself (two months back, everything ahead) ──
  const { data, isLoading: agendaLoading } = useQuery({
    queryKey: ['agenda', user?.id, teamIds],
    enabled: !!user && !roleLoading,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const none = Promise.resolve({ data: [] });
      const [m, t, e] = await Promise.all([
        teamIds.length
          ? supabase.from('matches').select('id, match_date, opponent_name, is_home, location, competition, status, team_id').in('team_id', teamIds).eq('is_deleted', false).gte('match_date', since).order('match_date').limit(300)
          : none,
        teamIds.length
          ? supabase.from('coach_trainings').select('id, name, training_date, team_id, status').in('team_id', teamIds).gte('training_date', since).order('training_date').limit(300)
          : none,
        db.from('club_events').select('*').gte('starts_at', since).order('starts_at').limit(300),
      ]);
      const matches = (m.data ?? []) as MatchRow[];
      // which matches my child / I was called up for (the database only returns our own rows)
      let called = new Set<string>();
      if (isFamily && matches.length) {
        const { data: lu } = await supabase.from('match_lineups').select('match_id').in('match_id', matches.map((x) => x.id));
        called = new Set((lu ?? []).map((l) => l.match_id as string));
      }
      return { matches, trainings: (t.data ?? []) as TrainingRow[], events: (e.data ?? []) as ClubEventRow[], called };
    },
  });

  const all = useMemo(() => buildAgenda({ matches: data?.matches, trainings: data?.trainings, events: data?.events, teamNames, calledUpMatchIds: data?.called }), [data, teamNames]);
  const { upcoming, past } = useMemo(() => splitAgenda(all.filter((i) => filters[i.kind])), [all, filters]);
  const days = useMemo(() => groupByDay(showPast ? past : upcoming), [showPast, past, upcoming]);
  const loading = roleLoading || agendaLoading || (isFamily ? familyLoading : teamsLoading);

  // ── publishing (staff) ──
  const canClubWide = !!clubId && (isClubAdmin || isCoordinator);
  const ownTeamsNoClub = teams.some((t) => !t.club_id);
  const defaultAudience = teams[0]?.id ?? (canClubWide ? WHOLE_CLUB : ALL_TEAMS);
  const openNew = () => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    setForm({ title: '', kind: 'social', date: toDateInput(d), time: '19:30', endTime: '', location: '', description: '', audience: defaultAudience, email: true });
  };
  const openEdit = (i: AgendaItem) => {
    const row = data?.events.find((e) => e.id === i.id);
    if (!row) return;
    setForm({
      id: row.id, title: row.title, kind: i.eventKind ?? 'other', date: toDateInput(i.start), time: toTimeInput(i.start),
      endTime: i.end ? toTimeInput(i.end) : '', location: row.location ?? '', description: row.description ?? '',
      audience: row.team_id ?? (row.club_id ? WHOLE_CLUB : ALL_TEAMS), email: false,
    });
  };
  const save = async () => {
    if (!form || !user) return;
    if (!form.title.trim()) return toast.error('Dê um nome ao evento');
    const start = new Date(`${form.date}T${form.time || '00:00'}`);
    if (Number.isNaN(start.getTime())) return toast.error('Indique a data e a hora');
    let end: Date | null = form.endTime ? new Date(`${form.date}T${form.endTime}`) : null;
    if (end && end <= start) end = new Date(end.getTime() + 86_400_000); // ends after midnight
    const team = teams.find((t) => t.id === form.audience);
    const payload = {
      title: form.title.trim(), kind: form.kind, starts_at: start.toISOString(), ends_at: end ? end.toISOString() : null,
      location: form.location.trim() || null, description: form.description.trim() || null,
      team_id: team ? team.id : null,
      club_id: team ? team.club_id : form.audience === WHOLE_CLUB ? clubId : null,
    };
    setSaving(true);
    const res = form.id
      ? await db.from('club_events').update(payload).eq('id', form.id).select('id').single()
      : await db.from('club_events').insert({ ...payload, owner_id: user.id }).select('id').single();
    setSaving(false);
    if (res.error) return toast.error('Não foi possível guardar: ' + res.error.message);
    toast.success(form.id ? 'Evento atualizado' : 'Evento publicado');
    if (form.email && res.data?.id) sendNotice({ kind: 'event', event_id: res.data.id }).then(toastNotice);
    setForm(null);
    qc.invalidateQueries({ queryKey: ['agenda'] });
  };
  const remove = async (i: AgendaItem) => {
    if (!window.confirm(`Apagar o evento "${i.title}"?`)) return;
    const { error } = await db.from('club_events').delete().eq('id', i.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['agenda'] });
  };
  const emailEvent = async (id: string) => {
    setEmailing(id);
    toastNotice(await sendNotice({ kind: 'event', event_id: id }));
    setEmailing(null);
  };

  const children = useMemo(() => [...new Set(family.map((f) => f.player_name))], [family]);

  return (
    <AppLayout title="Eventos">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-primary" />Calendário</h2>
            <p className="text-sm text-muted-foreground">
              {isFamily
                ? children.length ? `${children.join(', ')} · ${teams.map((t) => t.name).join(', ')}` : 'Jogos, treinos e eventos da equipa'
                : 'Jogos, treinos e eventos que os pais e jogadores também veem'}
            </p>
          </div>
          {!isFamily && !roleLoading && (
            <Button className="ml-auto" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Novo evento</Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(KIND_META) as AgendaKind[]).map((k) => {
            const M = KIND_META[k];
            return (
              <Button key={k} size="sm" variant={filters[k] ? 'default' : 'outline'} className="h-8" onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))} aria-pressed={filters[k]}>
                <M.icon className="mr-1.5 h-3.5 w-3.5" />{M.label}
              </Button>
            );
          })}
          <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={() => setShowPast((p) => !p)}>
            {showPast ? 'Ver os próximos' : `Já passaram (${past.length})`}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : isFamily && family.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            A sua conta ainda não está ligada a nenhum jogador. Peça ao treinador para o associar (ou para lhe enviar um convite) e o calendário aparece aqui.
          </CardContent></Card>
        ) : days.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            {showPast ? 'Nada nos últimos dois meses.' : 'Sem nada marcado para os próximos dias.'}
          </CardContent></Card>
        ) : (
          days.map((d) => (
            <section key={d.day.toISOString()} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel(d.day)}</h3>
              {d.items.map((i) => {
                const M = KIND_META[i.kind];
                const mine = i.kind === 'event' && !isFamily && (i.ownerId === user?.id || isClubAdmin);
                return (
                  <Card key={`${i.kind}-${i.id}`}>
                    <CardContent className="flex gap-3 p-3 sm:p-4">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', M.className)}><M.icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-sm font-semibold tabular-nums">{timeLabel(i)}</span>
                          <span className="font-medium">{i.title}</span>
                          {i.status === 'in_progress' && <Badge className="h-5">A decorrer</Badge>}
                          {i.calledUp && <Badge variant="secondary" className="h-5">Convocado</Badge>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {i.kind === 'event' && i.eventKind && <span>{EVENT_KIND_LABELS[i.eventKind]}</span>}
                          {i.scope && <span>{i.scope}</span>}
                          {i.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{i.location}</span>}
                          {i.kind === 'match' && i.detail && <span>{i.detail}</span>}
                        </div>
                        {i.kind === 'event' && i.detail && <p className="mt-1.5 whitespace-pre-line text-sm">{i.detail}</p>}
                        {mine && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openWhatsApp(eventShareText(i))}><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={emailing === i.id} onClick={() => emailEvent(i.id)}>
                              {emailing === i.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1 h-3.5 w-3.5" />}Email aos pais
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(i)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => remove(i)}><Trash2 className="mr-1 h-3.5 w-3.5" />Apagar</Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          ))
        )}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar evento' : 'Novo evento'}</DialogTitle>
            <DialogDescription>Aparece no calendário dos pais e jogadores a quem se destina.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Jantar de Natal da equipa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as EventKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(EVENT_KIND_LABELS) as EventKind[]).map((k) => <SelectItem key={k} value={k}>{EVENT_KIND_LABELS[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Para quem</Label>
                  <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      {canClubWide && <SelectItem value={WHOLE_CLUB}>Todo o clube</SelectItem>}
                      {(ownTeamsNoClub || teams.length === 0) && !canClubWide && <SelectItem value={ALL_TEAMS}>Todas as minhas equipas</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Data *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Início</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
              </div>
              <div>
                <Label>Local</Label>
                <Input value={form.location} maxLength={200} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex.: Sede do clube" />
              </div>
              <div>
                <Label>Detalhes</Label>
                <Textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Preço, o que levar, até quando confirmar…" />
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Switch checked={form.email} onCheckedChange={(v) => setForm({ ...form, email: v })} className="mt-0.5" />
                <div>
                  <Label className="cursor-pointer">Avisar os pais por email</Label>
                  <p className="text-xs text-muted-foreground">Para os emails dos pais das equipas escolhidas (com ou sem conta na app).</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{form?.id ? 'Guardar' : 'Publicar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
