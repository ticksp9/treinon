/** Club map helpers: weekly training timetable and weekend fixtures (pure, testable). */

export interface TrainingSlot {
  id: string;
  team_id: string;
  weekday: number; // 1 = Monday … 7 = Sunday
  start_time: string; // "18:30" or "18:30:00"
  end_time: string;
  location: string | null;
  notes: string | null;
}

export const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
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
  const lines = [`📅 *Jogos da semana — ${clubName}*`, `${from.toLocaleDateString('pt-PT')} a ${addDays(from, 6).toLocaleDateString('pt-PT')}`];
  let day = '';
  for (const m of matches) {
    const d = new Date(m.match_date);
    const label = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    if (label !== day) { day = label; lines.push('', `*${label[0].toUpperCase()}${label.slice(1)}*`); }
    lines.push(`${time(m.match_date)} · ${m.team_name} ${m.is_home ? 'vs' : '@'} ${m.opponent_name}${m.location ? ` · ${m.location}` : ''}`);
    const l = m.logistics ?? {};
    const extra = [l.meet_time ? `concentração ${l.meet_time}${l.meet_place ? ` (${l.meet_place})` : ''}` : '', l.transport ?? '', l.kit ?? ''].filter(Boolean);
    if (extra.length) lines.push(`   ↳ ${extra.join(' · ')}`);
  }
  if (matches.length === 0) lines.push('', 'Sem jogos marcados.');
  return lines.join('\n');
}

export function timetableText(clubName: string, slots: TrainingSlot[], teamName: (id: string) => string): string {
  const lines = [`🗓️ *Mapa de treinos — ${clubName}*`];
  WEEKDAYS.forEach((label, i) => {
    const day = slots.filter((s) => s.weekday === i + 1).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (day.length === 0) return;
    lines.push('', `*${label}*`);
    day.forEach((s) => lines.push(`${hhmm(s.start_time)}–${hhmm(s.end_time)} · ${teamName(s.team_id)}${s.location ? ` · ${s.location}` : ''}`));
  });
  return lines.join('\n');
}
