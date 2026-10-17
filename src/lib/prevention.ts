/**
 * Prevention and the season, for the medical department:
 *  - growth: how fast a player is growing (cm per year). Around the growth spurt the knee and
 *    heel apophyses suffer (Osgood-Schlatter, Sever); 7.2 cm/year or more is the warning line
 *    used in academy studies;
 *  - the sports medical exam is valid for a year;
 *  - an injury is reported to the sports insurance within a few working days (5 in the
 *    Lisbon FA; each association has its own);
 *  - the FIFA 11+ Kids warm-up works better the more often it is done each week.
 */

const DAY = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const todayIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const FAST_GROWTH_CM_YEAR = 7.2;

export interface Measure { measured_on: string; height_cm: number }

/**
 * Growth in cm/year from the latest measure and the one closest to 3–12 months before it.
 * Null when there is not enough time between measures to say.
 */
export function growthVelocity(list: Measure[]): { cmYear: number; from: string; to: string } | null {
  const s = [...list].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  const last = s[s.length - 1];
  if (!last) return null;
  const candidates = s.slice(0, -1).filter((m) => { const d = (utc(last.measured_on) - utc(m.measured_on)) / DAY; return d >= 60 && d <= 400; });
  if (!candidates.length) return null;
  // the one nearest to six months before: short gaps exaggerate measuring errors
  const ref = candidates.reduce((best, m) => (Math.abs((utc(last.measured_on) - utc(m.measured_on)) / DAY - 182) < Math.abs((utc(last.measured_on) - utc(best.measured_on)) / DAY - 182) ? m : best));
  const years = (utc(last.measured_on) - utc(ref.measured_on)) / DAY / 365.25;
  return { cmYear: Math.round(((last.height_cm - ref.height_cm) / years) * 10) / 10, from: ref.measured_on, to: last.measured_on };
}

/** Time to measure again: nothing in the last 3 months. */
export const measureDue = (list: Measure[], today = new Date()) => {
  const last = [...list].sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0];
  return !last || (utc(todayIso(today)) - utc(last.measured_on)) / DAY > 92;
};

export type ExamState = 'missing' | 'expired' | 'soon' | 'ok';
/** The latest exam: expired, ends within 30 days, fine — or none on record. */
export function examState(validUntil: string | null | undefined, today = new Date()): ExamState {
  if (!validUntil) return 'missing';
  const left = (utc(validUntil) - utc(todayIso(today))) / DAY;
  return left < 0 ? 'expired' : left <= 30 ? 'soon' : 'ok';
}
export const EXAM_LABEL: Record<ExamState, string> = { missing: 'Sem exame registado', expired: 'Exame caducado', soon: 'Exame a caducar', ok: 'Exame válido' };

/** The same day one year later, less a day (an exam of 17/10/2026 is valid until 16/10/2027). */
export function oneYearFrom(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoOf(Date.UTC(y + 1, m - 1, d) - DAY);
}

/** Deadline in working days (weekends skipped; public holidays are not known here). */
export function addWorkingDays(iso: string, days: number): string {
  let t = utc(iso), left = days;
  while (left > 0) { t += DAY; const wd = new Date(t).getUTCDay(); if (wd !== 0 && wd !== 6) left--; }
  return isoOf(t);
}
export function daysLeft(deadline: string, today = new Date()): number {
  return Math.round((utc(deadline) - utc(todayIso(today))) / DAY);
}

/** Of the trainings of each of the last weeks, how many began with the prevention warm-up. */
export function warmupByWeek(sessions: { date: string; prevention_warmup: boolean }[], weeks = 4, today = new Date()): { week: string; done: number; total: number }[] {
  const t0 = utc(todayIso(today));
  const monday = t0 - (((new Date(t0).getUTCDay() + 6) % 7) * DAY);
  const out = Array.from({ length: weeks }, (_, i) => ({ start: monday - (weeks - 1 - i) * 7 * DAY, done: 0, total: 0 }));
  for (const s of sessions) {
    const t = utc(s.date.slice(0, 10));
    if (t > t0) continue;
    const w = out.find((x) => t >= x.start && t < x.start + 7 * DAY);
    if (w) { w.total++; if (s.prevention_warmup) w.done++; }
  }
  return out.map((w) => ({ week: isoOf(w.start), done: w.done, total: w.total }));
}
