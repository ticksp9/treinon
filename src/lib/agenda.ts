/**
 * One agenda for parents, players and coaches: matches, trainings and club events
 * (dinners, activities, meetings) in date order, grouped by day.
 */
import { format, isSameDay, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';

export type AgendaKind = 'match' | 'training' | 'event';
export type EventKind = 'social' | 'activity' | 'meeting' | 'tournament' | 'other';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  social: 'Convívio / jantar',
  activity: 'Atividade',
  meeting: 'Reunião',
  tournament: 'Torneio',
  other: 'Outro',
};

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  start: Date;
  end?: Date | null;
  location?: string | null;
  teamId?: string | null;
  /** team name, or "Todo o clube" / "Todas as equipas" for wide events */
  scope: string;
  detail?: string | null;
  /** matches: a decorrer / terminado */
  status?: string | null;
  eventKind?: EventKind;
  /** matches: one of my children / me is in the squad list */
  calledUp?: boolean;
  ownerId?: string | null;
}

export interface MatchRow { id: string; match_date: string; opponent_name: string; is_home: boolean; location: string | null; competition?: string | null; status?: string | null; team_id: string | null }
export interface TrainingRow { id: string; name: string | null; training_date: string | null; team_id: string | null; status?: string | null }
export interface ClubEventRow { id: string; owner_id: string; club_id: string | null; team_id: string | null; title: string; description: string | null; kind: string; starts_at: string; ends_at: string | null; location: string | null }

export function buildAgenda(input: {
  matches?: MatchRow[]; trainings?: TrainingRow[]; events?: ClubEventRow[];
  teamNames: Record<string, string>; calledUpMatchIds?: Set<string>;
}): AgendaItem[] {
  const { teamNames, calledUpMatchIds } = input;
  const name = (id: string | null | undefined) => (id && teamNames[id]) || '';
  const items: AgendaItem[] = [];
  for (const m of input.matches ?? []) {
    const team = name(m.team_id);
    items.push({
      id: m.id, kind: 'match', start: new Date(m.match_date), teamId: m.team_id, scope: team,
      title: m.is_home ? `${team || 'Nós'} vs ${m.opponent_name}` : `${m.opponent_name} vs ${team || 'Nós'}`,
      location: m.location || (m.is_home ? 'Casa' : 'Fora'), detail: m.competition || null, status: m.status ?? null,
      calledUp: calledUpMatchIds?.has(m.id) ?? false,
    });
  }
  for (const t of input.trainings ?? []) {
    if (!t.training_date) continue;
    items.push({ id: t.id, kind: 'training', start: new Date(t.training_date), teamId: t.team_id, scope: name(t.team_id), title: t.name?.trim() || 'Treino', status: t.status ?? null });
  }
  for (const e of input.events ?? []) {
    items.push({
      id: e.id, kind: 'event', start: new Date(e.starts_at), end: e.ends_at ? new Date(e.ends_at) : null, teamId: e.team_id,
      scope: e.team_id ? name(e.team_id) : e.club_id ? 'Todo o clube' : 'Todas as equipas',
      title: e.title, location: e.location, detail: e.description,
      eventKind: (e.kind in EVENT_KIND_LABELS ? e.kind : 'other') as EventKind, ownerId: e.owner_id,
    });
  }
  return items.filter((i) => !Number.isNaN(i.start.getTime())).sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Upcoming = from the start of today (a match this morning is still "today"). An event with an end counts until it ends. */
export function splitAgenda(items: AgendaItem[], now = new Date()): { upcoming: AgendaItem[]; past: AgendaItem[] } {
  const from = startOfDay(now).getTime();
  const upcoming: AgendaItem[] = [], past: AgendaItem[] = [];
  for (const i of items) ((i.end ?? i.start).getTime() >= from ? upcoming : past).push(i);
  return { upcoming, past: past.reverse() };
}

export function groupByDay(items: AgendaItem[]): { day: Date; items: AgendaItem[] }[] {
  const out: { day: Date; items: AgendaItem[] }[] = [];
  for (const i of items) {
    const last = out[out.length - 1];
    if (last && isSameDay(last.day, i.start)) last.items.push(i);
    else out.push({ day: startOfDay(i.start), items: [i] });
  }
  return out;
}

export function dayLabel(day: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const base = format(day, "EEEE, d 'de' MMMM", { locale: pt });
  if (diff === 0) return `Hoje · ${base}`;
  if (diff === 1) return `Amanhã · ${base}`;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function timeLabel(i: Pick<AgendaItem, 'start' | 'end'>): string {
  const s = format(i.start, 'HH:mm');
  if (!i.end) return s;
  return isSameDay(i.start, i.end) ? `${s}–${format(i.end, 'HH:mm')}` : `${s} até ${format(i.end, "d MMM HH:mm", { locale: pt })}`;
}

export interface RsvpRow { event_id: string; user_id: string; status: 'yes' | 'no'; people: number }
/** For the organiser: how many answered and how many people are actually coming. */
export function rsvpSummary(rows: RsvpRow[], eventId: string): { yes: number; no: number; people: number } {
  let yes = 0, no = 0, people = 0;
  for (const r of rows) {
    if (r.event_id !== eventId) continue;
    if (r.status === 'yes') { yes += 1; people += Math.max(1, r.people || 1); } else no += 1;
  }
  return { yes, no, people };
}
export function rsvpSummaryText(s: { yes: number; no: number; people: number }): string {
  if (s.yes + s.no === 0) return 'Ainda sem respostas';
  const going = s.yes === 0 ? 'Ninguém vai' : `${s.yes} ${s.yes === 1 ? 'resposta' : 'respostas'} "vou" · ${s.people} ${s.people === 1 ? 'pessoa' : 'pessoas'}`;
  return s.no ? `${going} · ${s.no} não ${s.no === 1 ? 'vai' : 'vão'}` : going;
}

/** Text to paste in the parents' WhatsApp group. */
export function eventShareText(e: { title: string; start: Date; end?: Date | null; location?: string | null; detail?: string | null; scope?: string }): string {
  return [
    `*${e.title.trim()}*${e.scope ? ` · ${e.scope}` : ''}`,
    `📅 ${format(e.start, "EEEE, d 'de' MMMM", { locale: pt })} · ${timeLabel(e)}`,
    e.location ? `📍 ${e.location}` : null,
    e.detail?.trim() ? `\n${e.detail.trim()}` : null,
  ].filter((x) => x !== null).join('\n');
}
