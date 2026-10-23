/**
 * The season's planning, as the FPF asks for it in the training dossier (criterion 4.2):
 * season → periods (annual plan) → mesocycles (blocks) → microcycles (the week) → sessions.
 * Pure functions here; the screens are in components/planning.
 */
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import { tx } from '@/lib/i18n/ui';

export interface PlanPeriod { label: string; from: string; to: string; priority: string; control: string }
export type MesoKind = 'preparation' | 'competition' | 'transition';
export interface Mesocycle { id: string; name: string; kind: MesoKind; start_date: string; end_date: string; focus: string | null }
export type Intensity = 'low' | 'medium' | 'high';
export interface Microcycle {
  id: string; week_start: string; objectives: string | null; contents: string | null;
  intensity: Intensity | null; review: string | null;
}
export interface PlanSession {
  id: string; date: string; duration_minutes: number | null; objectives: string | null; exercises: string | null;
  notes: string | null; actual_minutes: number | null; session_rating: number | null; closed_at: string | null;
  status?: string | null; session_type?: string | null;
}

export const MESO_KINDS: { value: MesoKind; label: string }[] = [
  { value: 'preparation', get label() { return tx('Preparação'); } },
  { value: 'competition', get label() { return tx('Competição'); } },
  { value: 'transition', get label() { return tx('Transição'); } },
];
export const mesoKindLabel = (k: string) => MESO_KINDS.find((m) => m.value === k)?.label ?? k;

export const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'low', get label() { return tx('Baixa'); } },
  { value: 'medium', get label() { return tx('Média'); } },
  { value: 'high', get label() { return tx('Alta'); } },
];
export const intensityLabel = (v: string | null | undefined) => INTENSITIES.find((i) => i.value === v)?.label ?? '';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const day = (s: string) => parseISO(s.slice(0, 10));

/** The Monday of the week a date falls in (yyyy-MM-dd). */
export const weekStartOf = (date: string | Date) => iso(startOfWeek(typeof date === 'string' ? day(date) : date, { weekStartsOn: 1 }));

/** Every week (its Monday) touched by the season, in order. */
export function seasonWeeks(start: string, end: string): string[] {
  const out: string[] = [];
  const last = day(end);
  for (let d = day(weekStartOf(start)); d <= last && out.length < 80; d = addDays(d, 7)) out.push(iso(d));
  return out;
}

/** Sunday of a week. */
export const weekEnd = (weekStart: string) => iso(addDays(day(weekStart), 6));

/** The mesocycle a day belongs to (the first one that covers it). */
export function mesoFor<T extends Pick<Mesocycle, 'start_date' | 'end_date'>>(mesos: T[], date: string): T | null {
  const d = date.slice(0, 10);
  return mesos.find((m) => m.start_date <= d && d <= m.end_date) ?? null;
}

/** Week numbers inside the season (Microciclo 1, 2…). */
export const weekNumber = (seasonStart: string, weekStart: string) =>
  Math.floor(differenceInCalendarDays(day(weekStart), day(weekStartOf(seasonStart))) / 7) + 1;

/** The FPF's illustrative annual plan, on the season's own dates: a start for the coach to adapt. */
export function defaultPeriods(seasonStart: string, seasonEnd: string): PlanPeriod[] {
  const y0 = Number(seasonStart.slice(0, 4));
  const y1 = Number(seasonEnd.slice(0, 4)) || y0 + 1;
  const clamp = (d: string) => (d < seasonStart ? seasonStart : d > seasonEnd ? seasonEnd : d);
  return [
    { label: tx('Início da época'), from: clamp(`${y0}-07-01`), to: clamp(`${y0}-08-31`), priority: tx('Diagnóstico e bases do modelo'), control: tx('Avaliação inicial') },
    { label: tx('1.º período'), from: clamp(`${y0}-09-01`), to: clamp(`${y0}-12-31`), priority: tx('Desenvolver princípios e relações'), control: tx('Balanços mensais') },
    { label: tx('2.º período'), from: clamp(`${y1}-01-01`), to: clamp(`${y1}-04-30`), priority: tx('Consolidar e aumentar a exigência'), control: tx('Avaliação intermédia') },
    { label: tx('Fim da época'), from: clamp(`${y1}-05-01`), to: clamp(`${y1}-06-30`), priority: tx('Transferência e transição'), control: tx('Avaliação final') },
  ].filter((p) => p.from <= p.to);
}

/** Periods with something written, trimmed. */
export function cleanPeriods(periods: PlanPeriod[]): PlanPeriod[] {
  return periods
    .map((p) => ({ label: p.label.trim().slice(0, 120), from: p.from, to: p.to, priority: p.priority.trim().slice(0, 1000), control: p.control.trim().slice(0, 500) }))
    .filter((p) => p.label || p.priority)
    .slice(0, 24);
}

/** Suggested dates for the next mesocycle: the day after the last one, four weeks long. */
export function nextMesoDates(mesos: Pick<Mesocycle, 'end_date'>[], seasonStart: string, seasonEnd: string): { start: string; end: string } {
  const last = [...mesos].sort((a, b) => a.end_date.localeCompare(b.end_date)).pop();
  const start = last ? iso(addDays(day(last.end_date), 1)) : seasonStart.slice(0, 10);
  const end = iso(addDays(day(start), 27));
  return { start, end: end > seasonEnd ? seasonEnd.slice(0, 10) : end };
}

/** A session counts as recorded when it was closed or has what was done written down. */
export const sessionRecorded = (s: Pick<PlanSession, 'closed_at' | 'exercises'>) => !!s.closed_at || !!s.exercises?.trim();

export interface WeekSummary {
  weekStart: string;
  planned: boolean;   // objectives written
  reviewed: boolean;  // weekly review written
  sessions: number;
  recorded: number;
  past: boolean;      // the week is over
}

export function weekSummary(weekStart: string, micro: Pick<Microcycle, 'objectives' | 'review'> | undefined, sessions: Pick<PlanSession, 'date' | 'closed_at' | 'exercises' | 'status'>[], today = new Date()): WeekSummary {
  const end = weekEnd(weekStart);
  const inWeek = sessions.filter((s) => s.status !== 'cancelled' && s.date.slice(0, 10) >= weekStart && s.date.slice(0, 10) <= end);
  return {
    weekStart,
    planned: !!micro?.objectives?.trim(),
    reviewed: !!micro?.review?.trim(),
    sessions: inWeek.length,
    recorded: inWeek.filter(sessionRecorded).length,
    past: end < iso(today),
  };
}

/** "05/10–11/10": the days of a week, short and the same in every language. */
export const weekRangeLabel = (weekStart: string) => `${format(day(weekStart), 'dd/MM')}–${format(day(weekEnd(weekStart)), 'dd/MM')}`;

/** Weeks (their Monday) with a training session or a match: the ones that need a microcycle. */
export function activeWeeks(sessions: Pick<PlanSession, 'date' | 'status'>[], matches: { match_date: string }[]): Set<string> {
  const out = new Set<string>();
  for (const s of sessions) if (s.status !== 'cancelled') out.add(weekStartOf(s.date));
  for (const m of matches) out.add(weekStartOf(m.match_date));
  return out;
}
