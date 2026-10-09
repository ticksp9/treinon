/**
 * Eventos: the calendar everyone shares.
 *  - parents and players: their team's matches and trainings plus club/team events — this
 *    and Comunicação are all they get in the app
 *  - coaches and club: the same list, and they publish the events (dinners, activities, meetings)
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarDays, Check, ChevronDown, Dumbbell, Loader2, Mail, MapPin, MessageCircle, Minus, PartyPopper, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
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
  EVENT_KIND_LABELS, buildAgenda, dayLabel, eventShareText, groupByDay, rsvpSummary, rsvpSummaryText, splitAgenda, timeLabel,
  type AgendaItem, type AgendaKind, type ClubEventRow, type EventKind, type MatchRow, type RsvpRow, type SessionRow, type TrainingRow,
} from '@/lib/agenda';
import { openWhatsApp, sendNotice, toastNotice } from '@/lib/notice';
import { cn } from '@/lib/utils';

interface FamilyRow { team_id: string; team_name: string; club_id: string | null; player_id: string; player_name: string }
interface RsvpDetail { user_id: string; name: string; players: string | null; status: 'yes' | 'no'; people: number; note: string | null }
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

interface EventForm { id?: string; title: string; kind: EventKind; date: string; time: string; endTime: string; location: string; description: string; audience: string; email: boolean; deadline: string }
interface CallupAnswer { match_id: string; player_id: string; status: string }
interface TrainingAnswer { session_id: string; player_id: string; status: 'yes' | 'no'; reason: string | null }

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
  const [answersFor, setAnswersFor] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);

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
      const [m, t, e, ss] = await Promise.all([
        teamIds.length
          ? supabase.from('matches').select('id, match_date, opponent_name, is_home, location, competition, status, team_id').in('team_id', teamIds).eq('is_deleted', false).gte('match_date', since).order('match_date').limit(300)
          : none,
        teamIds.length
          ? supabase.from('coach_trainings').select('id, name, training_date, team_id, status').in('team_id', teamIds).gte('training_date', since).order('training_date').limit(300)
          : none,
        db.from('club_events').select('*').gte('starts_at', since).order('starts_at').limit(300),
        teamIds.length
          ? supabase.from('training_sessions').select('id, title, date, team_id, location, status').in('team_id', teamIds).gte('date', since).order('date').limit(300)
          : none,
      ]);
      const sessions = (ss.data ?? []) as SessionRow[];
      const matches = (m.data ?? []) as MatchRow[];
      // which matches my child / I was called up for (the database only returns our own rows)
      let called = new Set<string>();
      let lineups: { match_id: string; player_id: string }[] = [];
      let callupAnswers: CallupAnswer[] = [];
      if (isFamily && matches.length) {
        const ids = matches.map((x) => x.id);
        const [lu, cc] = await Promise.all([
          supabase.from('match_lineups').select('match_id, player_id').in('match_id', ids),
          supabase.from('callup_confirmations').select('match_id, player_id, status').in('match_id', ids),
        ]);
        lineups = (lu.data ?? []) as { match_id: string; player_id: string }[];
        callupAnswers = (cc.data ?? []) as CallupAnswer[];
        called = new Set(lineups.map((l) => l.match_id));
      }
      // who said he comes / does not come to a training (family: own children; coaches: the team)
      const { data: tr } = sessions.length ? await db.from('training_rsvps').select('session_id, player_id, status, reason').in('session_id', sessions.map((x) => x.id)) : { data: [] };
      const events = (e.data ?? []) as ClubEventRow[];
      // my own answer; organisers also get everybody's (the database decides)
      const { data: rs } = events.length ? await db.from('club_event_rsvps').select('event_id, user_id, status, people').in('event_id', events.map((x) => x.id)) : { data: [] };
      return { matches, trainings: (t.data ?? []) as TrainingRow[], sessions, events, called, lineups, callupAnswers, trainingAnswers: (tr ?? []) as TrainingAnswer[], rsvps: (rs ?? []) as RsvpRow[] };
    },
  });

  const all = useMemo(() => buildAgenda({ matches: data?.matches, trainings: data?.trainings, sessions: data?.sessions, events: data?.events, teamNames, calledUpMatchIds: data?.called }), [data, teamNames]);
  const { upcoming, past } = useMemo(() => splitAgenda(all.filter((i) => filters[i.kind])), [all, filters]);
  const days = useMemo(() => groupByDay(showPast ? past : upcoming), [showPast, past, upcoming]);
  const loading = roleLoading || agendaLoading || (isFamily ? familyLoading : teamsLoading);

  // ── publishing (staff) ──
  const canClubWide = !!clubId && (isClubAdmin || isCoordinator);
  const ownTeamsNoClub = teams.some((t) => !t.club_id);
  const defaultAudience = teams[0]?.id ?? (canClubWide ? WHOLE_CLUB : ALL_TEAMS);
  const openNew = () => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    setForm({ title: '', kind: 'social', date: toDateInput(d), time: '19:30', endTime: '', location: '', description: '', audience: defaultAudience, email: true, deadline: '' });
  };
  const openEdit = (i: AgendaItem) => {
    const row = data?.events.find((e) => e.id === i.id);
    if (!row) return;
    setForm({
      id: row.id, title: row.title, kind: i.eventKind ?? 'other', date: toDateInput(i.start), time: toTimeInput(i.start),
      endTime: i.end ? toTimeInput(i.end) : '', location: row.location ?? '', description: row.description ?? '',
      audience: row.team_id ?? (row.club_id ? WHOLE_CLUB : ALL_TEAMS), email: false,
      deadline: row.rsvp_deadline ? toDateInput(new Date(row.rsvp_deadline)) : '',
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
    // answers are accepted until the end of the chosen day
    const deadline = form.deadline ? new Date(`${form.deadline}T23:59:00`) : null;
    if (deadline && deadline > (end ?? start)) return toast.error('O prazo para responder tem de ser antes do evento');
    const payload = {
      rsvp_deadline: deadline ? deadline.toISOString() : null,
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

  // ── "Vou / Não vou" ──
  const answer = async (eventId: string, status: 'yes' | 'no', people = 1) => {
    if (!user) return;
    setAnswering(eventId);
    const { error } = await db.from('club_event_rsvps').upsert(
      { event_id: eventId, user_id: user.id, status, people: Math.min(20, Math.max(1, people)), updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' });
    setAnswering(null);
    if (error) return toast.error('Não foi possível guardar a resposta: ' + error.message);
    qc.invalidateQueries({ queryKey: ['agenda'] });
    qc.invalidateQueries({ queryKey: ['event-rsvps', eventId] });
  };
  const { data: answers = [], isLoading: answersLoading } = useQuery({
    queryKey: ['event-rsvps', answersFor],
    enabled: !!answersFor,
    queryFn: async () => ((await db.rpc('get_event_rsvps', { _event: answersFor })).data ?? []) as RsvpDetail[],
  });

  // ── matches and trainings: the family answers for each child ──
  const answerMatch = async (matchId: string, playerId: string, playerName: string, status: 'confirmed' | 'declined') => {
    if (!user) return;
    const comment = status === 'declined' ? window.prompt(`Porque é que ${playerName} não pode ir? (opcional)`, '') : null;
    if (status === 'declined' && comment === null) return;
    setAnswering(matchId + playerId);
    const { error } = await supabase.from('callup_confirmations').upsert(
      { match_id: matchId, player_id: playerId, confirmed_by: user.id, status, comment: comment?.trim() || null, responded_at: new Date().toISOString() },
      { onConflict: 'match_id,player_id' });
    setAnswering(null);
    if (error) return toast.error('Não foi possível guardar a resposta: ' + error.message);
    toast.success(status === 'confirmed' ? `${playerName}: presença confirmada` : `${playerName}: o treinador fica a saber que não vai`);
    qc.invalidateQueries({ queryKey: ['agenda'] });
  };
  const answerTraining = async (sessionId: string, playerId: string, playerName: string, status: 'yes' | 'no') => {
    if (!user) return;
    const reason = status === 'no' ? window.prompt(`Porque é que ${playerName} falta ao treino? (ex.: doença, escola)`, '') : null;
    if (status === 'no' && reason === null) return;
    setAnswering(sessionId + playerId);
    const { error } = await db.from('training_rsvps').upsert(
      { session_id: sessionId, player_id: playerId, status, reason: reason?.trim().slice(0, 120) || null, answered_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'session_id,player_id' });
    setAnswering(null);
    if (error) return toast.error('Não foi possível guardar a resposta: ' + error.message);
    qc.invalidateQueries({ queryKey: ['agenda'] });
  };
  const remind = async (id: string) => {
    setEmailing(id);
    toastNotice(await sendNotice({ kind: 'event_reminder', event_id: id }));
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
                        {/* match: the family confirms each called-up child */}
                        {i.kind === 'match' && isFamily && i.start.getTime() > Date.now() && family
                          .filter((f) => (data?.lineups ?? []).some((l) => l.match_id === i.id && l.player_id === f.player_id))
                          .map((f) => {
                            const a = data?.callupAnswers.find((c) => c.match_id === i.id && c.player_id === f.player_id);
                            const busy = answering === i.id + f.player_id;
                            return (
                              <div key={f.player_id} className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium">{f.player_name}:</span>
                                <Button size="sm" variant={a?.status === 'confirmed' ? 'default' : 'outline'} className="h-8" disabled={busy} onClick={() => answerMatch(i.id, f.player_id, f.player_name, 'confirmed')} aria-pressed={a?.status === 'confirmed'}><Check className="mr-1 h-4 w-4" />Vai</Button>
                                <Button size="sm" variant={a?.status === 'declined' ? 'destructive' : 'outline'} className="h-8" disabled={busy} onClick={() => answerMatch(i.id, f.player_id, f.player_name, 'declined')} aria-pressed={a?.status === 'declined'}><X className="mr-1 h-4 w-4" />Não pode ir</Button>
                              </div>
                            );
                          })}
                        {/* training: say in advance who misses it (it reaches the coach's attendance sheet) */}
                        {i.kind === 'training' && i.answerable && isFamily && i.start.getTime() > Date.now() && family
                          .filter((f) => f.team_id === i.teamId)
                          .map((f) => {
                            const a = data?.trainingAnswers.find((c) => c.session_id === i.id && c.player_id === f.player_id);
                            const busy = answering === i.id + f.player_id;
                            return (
                              <div key={f.player_id} className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium">{f.player_name}:</span>
                                <Button size="sm" variant={a?.status === 'yes' ? 'default' : 'outline'} className="h-8" disabled={busy} onClick={() => answerTraining(i.id, f.player_id, f.player_name, 'yes')} aria-pressed={a?.status === 'yes'}><Check className="mr-1 h-4 w-4" />Vai</Button>
                                <Button size="sm" variant={a?.status === 'no' ? 'destructive' : 'outline'} className="h-8" disabled={busy} onClick={() => answerTraining(i.id, f.player_id, f.player_name, 'no')} aria-pressed={a?.status === 'no'}><X className="mr-1 h-4 w-4" />Falta</Button>
                                {a?.status === 'no' && a.reason && <span className="text-xs text-muted-foreground">{a.reason}</span>}
                              </div>
                            );
                          })}
                        {i.kind === 'training' && i.answerable && !isFamily && (() => {
                          const out = (data?.trainingAnswers ?? []).filter((c) => c.session_id === i.id && c.status === 'no').length;
                          return out > 0 ? <p className="mt-1 text-xs font-medium text-accent">{out} {out === 1 ? 'jogador avisou que falta' : 'jogadores avisaram que faltam'} (ver nas presenças)</p> : null;
                        })()}
                        {i.kind === 'event' && (() => {
                          const rows = data?.rsvps ?? [];
                          const my = rows.find((r) => r.event_id === i.id && r.user_id === user?.id);
                          const closed = !!i.rsvpDeadline && i.rsvpDeadline.getTime() < Date.now();
                          const over = (i.end ?? i.start).getTime() < Date.now() || closed;
                          const busy = answering === i.id;
                          const summary = rsvpSummary(rows, i.id);
                          return (
                            <div className="mt-2 space-y-2">
                              {i.rsvpDeadline && (
                                <p className={cn('text-xs', closed ? 'text-destructive' : 'text-muted-foreground')}>
                                  {closed ? 'O prazo para responder terminou a ' : 'Responder até '}{i.rsvpDeadline.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                              )}
                              {over ? (
                                my && <p className="text-xs text-muted-foreground">A sua resposta: {my.status === 'yes' ? `fui (${my.people} ${my.people === 1 ? 'pessoa' : 'pessoas'})` : 'não fui'}</p>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Button size="sm" variant={my?.status === 'yes' ? 'default' : 'outline'} className="h-8" disabled={busy} onClick={() => answer(i.id, 'yes', my?.people ?? 1)} aria-pressed={my?.status === 'yes'}>
                                    <Check className="mr-1 h-4 w-4" />Vou
                                  </Button>
                                  <Button size="sm" variant={my?.status === 'no' ? 'destructive' : 'outline'} className="h-8" disabled={busy} onClick={() => answer(i.id, 'no')} aria-pressed={my?.status === 'no'}>
                                    <X className="mr-1 h-4 w-4" />Não vou
                                  </Button>
                                  {my?.status === 'yes' && (
                                    <span className="ml-1 flex items-center gap-1 text-sm">
                                      <Button size="icon" variant="outline" className="h-8 w-8" disabled={busy || my.people <= 1} onClick={() => answer(i.id, 'yes', my.people - 1)} aria-label="Menos uma pessoa"><Minus className="h-4 w-4" /></Button>
                                      <span className="min-w-[4.5rem] text-center tabular-nums">{my.people} {my.people === 1 ? 'pessoa' : 'pessoas'}</span>
                                      <Button size="icon" variant="outline" className="h-8 w-8" disabled={busy || my.people >= 20} onClick={() => answer(i.id, 'yes', my.people + 1)} aria-label="Mais uma pessoa"><Plus className="h-4 w-4" /></Button>
                                    </span>
                                  )}
                                  {!my && <span className="text-xs text-muted-foreground">Diga se vai</span>}
                                </div>
                              )}
                              {/* everybody's answers: only for who organises (the database returns nothing to the others) */}
                              {!isFamily && (i.ownerId === user?.id || isClubAdmin || isCoordinator || (!!i.teamId && teamIds.includes(i.teamId))) && (
                                <div>
                                  <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setAnswersFor((v) => (v === i.id ? null : i.id))} aria-expanded={answersFor === i.id}>
                                    {rsvpSummaryText(summary)}
                                    {summary.yes + summary.no > 0 && <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', answersFor === i.id && 'rotate-180')} />}
                                  </button>
                                  {answersFor === i.id && summary.yes + summary.no > 0 && (
                                    answersLoading ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" /> : (
                                      <ul className="mt-1 divide-y rounded-md border text-sm">
                                        {answers.map((a) => (
                                          <li key={a.user_id} className="flex items-center gap-2 px-2 py-1.5">
                                            {a.status === 'yes' ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <X className="h-4 w-4 shrink-0 text-destructive" />}
                                            <span className="min-w-0 truncate">{a.name}{a.players ? <span className="text-muted-foreground"> · {a.players}</span> : null}</span>
                                            {a.status === 'yes' && <span className="ml-auto shrink-0 font-mono text-xs">{a.people} {a.people === 1 ? 'pessoa' : 'pessoas'}</span>}
                                          </li>
                                        ))}
                                        {answers.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">Só quem organiza o evento vê os nomes.</li>}
                                      </ul>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {mine && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openWhatsApp(eventShareText(i))}><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={emailing === i.id} onClick={() => emailEvent(i.id)}>
                              {emailing === i.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1 h-3.5 w-3.5" />}Email aos pais
                            </Button>
                            {(i.end ?? i.start).getTime() > Date.now() && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={emailing === i.id} onClick={() => remind(i.id)} title="Email só a quem tem conta e ainda não respondeu">
                                <BellRing className="mr-1 h-3.5 w-3.5" />Lembrar quem falta
                              </Button>
                            )}
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
                <Label>Responder até (opcional)</Label>
                <Input type="date" value={form.deadline} max={form.date} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Depois desse dia já não dá para responder. Quem ainda não respondeu recebe um lembrete por email na véspera do prazo (sem prazo: dois dias antes do evento).</p>
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
