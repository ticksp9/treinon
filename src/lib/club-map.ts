import { intlLocale, tx, weekdayNames } from '@/lib/i18n/ui';
/** Club map helpers: weekly training timetable and weekend fixtures (pure, testable). */

export interface TrainingSlot {
  id: string;
  team_id: string;
  weekday: number; // 1 = Monday … 7 = Sunday
  start_time: string; // "18:30" or "18:30:00"
  end_time: string;
  location: string | null;
  notes: string | null;
  /** the part of the pitch used (FPF "mapa de ocupação do espaço") */
  space?: SlotSpace | null;
}

export type SlotSpace = 'full' | 'half' | 'quarter' | 'other';
export const SLOT_SPACES: { value: SlotSpace; readonly label: string; readonly short: string }[] = [
  { value: 'full', get label() { return tx('Campo inteiro'); }, get short() { return tx('Inteiro'); } },
  { value: 'half', get label() { return tx('Meio campo'); }, get short() { return '½'; } },
  { value: 'quarter', get label() { return tx('Um quarto de campo'); }, get short() { return '¼'; } },
  { value: 'other', get label() { return tx('Outro espaço (pavilhão, ginásio…)'); }, get short() { return tx('Outro'); } },
];
export const spaceLabel = (v: string | null | undefined) => SLOT_SPACES.find((s) => s.value === v)?.label ?? '';

/** Monday…Sunday in the chosen language (read when shown). */
export const WEEKDAYS = { map: <T,>(fn: (label: string, i: number) => T) => weekdayNames().map(fn), forEach: (fn: (label: string, i: number) => void) => weekdayNames().forEach(fn) };
export const hhmm = (t: string) => t.slice(0, 5);
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const place = (s: string | null) => (s ?? '').trim().toLowerCase();

/** Ids of slots that overlap another team's slot on the same day and field. */
export function findClashes(slots: TrainingSlot[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      if (a.weekday !== b.weekday || !place(a.location) || place(a.location) !== place(b.location)) continue;
      if (a.team_id === b.team_id) continue;
      if (mins(a.start_time) < mins(b.end_time) && mins(b.start_time) < mins(a.end_time)) { out.add(a.id); out.add(b.id); }
    }
  }
  return out;
}

/** Monday 00:00 of the week containing `d` (local time). */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export interface MatchLogistics { meet_time?: string; meet_place?: string; transport?: string; kit?: string; info?: string }

export interface MapMatch {
  id: string; team_id: string; team_name: string; match_date: string; opponent_name: string; is_home: boolean;
  location: string | null; competition: string | null; match_type: string | null; status: string | null;
  goals_for: number | null; goals_against: number | null; logistics: MatchLogistics | null; notes: string | null;
}

const two = (n: number) => String(n).padStart(2, '0');
const time = (iso: string) => { const d = new Date(iso); return `${two(d.getHours())}:${two(d.getMinutes())}`; };

/** WhatsApp text of the week's fixtures, grouped by day. */
export function fixturesText(clubName: string, from: Date, matches: MapMatch[]): string {
  const lines = [tx('📅 *Jogos da semana — {{v0}}*', { v0: clubName }), tx('{{v0}} a {{v1}}', { v0: from.toLocaleDateString(intlLocale()), v1: addDays(from, 6).toLocaleDateString(intlLocale()) })];
  let day = '';
  for (const m of matches) {
    const d = new Date(m.match_date);
    const label = d.toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    if (label !== day) { day = label; lines.push('', `*${label[0].toUpperCase()}${label.slice(1)}*`); }
    lines.push(`${time(m.match_date)} · ${m.team_name} ${m.is_home ? 'vs' : '@'} ${m.opponent_name}${m.location ? ` · ${m.location}` : ''}`);
    const l = m.logistics ?? {};
    const extra = [l.meet_time ? `concentração ${l.meet_time}${l.meet_place ? ` (${l.meet_place})` : ''}` : '', l.transport ?? '', l.kit ?? ''].filter(Boolean);
    if (extra.length) lines.push(`   ↳ ${extra.join(' · ')}`);
  }
  if (matches.length === 0) lines.push('', tx('Sem jogos marcados.'));
  return lines.join('\n');
}

export function timetableText(clubName: string, slots: TrainingSlot[], teamName: (id: string) => string): string {
  const lines = [`🗓️ *${tx('Mapa de treinos')} — ${clubName}*`];
  WEEKDAYS.forEach((label, i) => {
    const day = slots.filter((s) => s.weekday === i + 1).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (day.length === 0) return;
    lines.push('', `*${label}*`);
    day.forEach((s) => lines.push(`${hhmm(s.start_time)}–${hhmm(s.end_time)} · ${teamName(s.team_id)}${s.location ? ` · ${s.location}` : ''}${s.space ? ` (${spaceLabel(s.space).toLowerCase()})` : ''}`));
  });
  return lines.join('\n');
}

export interface TypicalRow {
  team_id: string;
  name: string;
  category: string | null;
  age: number | null;
  sessions: number;
  minutes: number;
  avg: number;
  /** "Ter 18:30–20:00 (½) · Qui …" */
  days: string;
  spaces: Partial<Record<SlotSpace, number>>;
  /** Sub-15 to Sub-19 must train at least once a week on the full pitch (FPF) */
  needsFullPitch: boolean;
}

/**
 * The FPF "mapa-tipo": for each team, how many sessions a week, how long, when and in which space.
 * Teams in age order (youngest first); teams without slots are kept, with 0 sessions.
 */
export function typicalMap(slots: TrainingSlot[], teams: { id: string; name: string; category: string | null }[], ageOf: (c: string | null) => number | null): TypicalRow[] {
  const shortDays = WEEKDAYS.map((l) => l.slice(0, 3));
  return teams.map((t) => {
    const own = slots.filter((s) => s.team_id === t.id).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
    const minutes = own.reduce((a, s) => a + Math.max(0, mins(s.end_time) - mins(s.start_time)), 0);
    const spaces: Partial<Record<SlotSpace, number>> = {};
    own.forEach((s) => { if (s.space) spaces[s.space] = (spaces[s.space] ?? 0) + 1; });
    const age = ageOf(t.category);
    const sp = (s: TrainingSlot) => SLOT_SPACES.find((x) => x.value === s.space)?.short;
    return {
      team_id: t.id, name: t.name, category: t.category, age,
      sessions: own.length, minutes, avg: own.length ? Math.round(minutes / own.length) : 0,
      days: own.map((s) => `${shortDays[s.weekday - 1] ?? ''} ${hhmm(s.start_time)}–${hhmm(s.end_time)}${sp(s) ? ` (${sp(s)})` : ''}`).join(' · '),
      spaces,
      needsFullPitch: age != null && age >= 15 && age <= 19 && own.length > 0 && !spaces.full,
    };
  }).sort((a, b) => (a.age ?? 100) - (b.age ?? 100) || a.name.localeCompare(b.name));
}
