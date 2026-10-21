import { tx } from '@/lib/i18n/ui';
/**
 * Injuries as the medical department reads them (FIFA consensus, Fuller et al. 2006):
 *  - severity = days from the injury to full return to training and matches
 *    (slight 0–1, minimal 2–3, mild 4–7, moderate 8–28, severe > 28);
 *  - recurrence = same type, same place, after the previous one healed (early: within 2 months).
 */

export const MECHANISMS = [
  { value: 'contact', get label() { return tx('Com contacto'); } },
  { value: 'non_contact', get label() { return tx('Sem contacto'); } },
  { value: 'overuse', get label() { return tx('Sobrecarga (foi aparecendo)'); } },
  { value: 'unknown', get label() { return tx('Não sei'); } },
] as const;
export const mechanismLabel = (v?: string | null) => MECHANISMS.find((m) => m.value === v)?.label ?? null;

const DAY = 86_400_000;
const dateOnly = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };

/** Days out: until the return, or until today while still out. */
export function daysOut(injuryDate: string, returnDate: string | null | undefined, today = new Date()): number {
  const end = returnDate ? dateOnly(returnDate) : Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((end - dateOnly(injuryDate)) / DAY));
}

export function severityByDays(days: number): { key: 'slight' | 'minimal' | 'mild' | 'moderate' | 'severe'; label: string } {
  if (days <= 1) return { key: 'slight', label: tx('Muito ligeira') };
  if (days <= 3) return { key: 'minimal', label: tx('Ligeira') };
  if (days <= 7) return { key: 'mild', label: tx('Leve') };
  if (days <= 28) return { key: 'moderate', label: tx('Moderada') };
  return { key: 'severe', label: tx('Grave') };
}

export interface InjuryLike { id?: string; injury_date: string; return_date: string | null; body_part: string | null; injury_type: string | null }

/** A new injury repeats an old one: same place and type, starting within 2 months of the old one's return. */
export function isEarlyRecurrence(next: Pick<InjuryLike, 'injury_date' | 'body_part' | 'injury_type'>, history: InjuryLike[]): boolean {
  if (!next.body_part || !next.injury_type) return false;
  return history.some((h) => h.return_date && h.body_part === next.body_part && h.injury_type === next.injury_type
    && dateOnly(next.injury_date) >= dateOnly(h.return_date) && dateOnly(next.injury_date) - dateOnly(h.return_date) <= 61 * DAY);
}

export type CareGroup = 'to_assess' | 'out' | 'limited' | 'back_soon' | 'recently_cleared';

export interface CareInjury extends InjuryLike {
  id: string; clinical_status: string; can_play: boolean; expected_return_date: string | null; assessed_at: string | null; restrictions: string | null;
}

/** Where an injury goes on the medical department screen (an injury can be in more than one place). */
export function careGroups(inj: CareInjury, today = new Date()): CareGroup[] {
  const out: CareGroup[] = [];
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (inj.return_date) {
    if (todayUtc - dateOnly(inj.return_date) <= 14 * DAY) out.push('recently_cleared');
    return out;
  }
  if (!inj.assessed_at) out.push('to_assess');
  if (inj.clinical_status === 'condicionado' || inj.clinical_status === 'retorno_progressivo' || (inj.can_play && inj.clinical_status !== 'apto')) out.push('limited');
  else out.push('out');
  if (inj.expected_return_date) {
    const d = dateOnly(inj.expected_return_date) - todayUtc;
    if (d >= 0 && d <= 7 * DAY) out.push('back_soon');
  }
  return out;
}

export interface SeasonSummary { injuries: number; open: number; daysLost: number; recurrences: number; byPart: { part: string; n: number }[]; byMechanism: { mechanism: string; n: number }[] }

/** For the club's leadership: how the season is going. */
export function seasonSummary(list: (InjuryLike & { is_recurrence?: boolean | null; mechanism?: string | null })[], today = new Date()): SeasonSummary {
  const count = (key: (i: (typeof list)[number]) => string | null | undefined) => {
    const m = new Map<string, number>();
    list.forEach((i) => { const k = key(i); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    injuries: list.length,
    open: list.filter((i) => !i.return_date).length,
    daysLost: list.reduce((n, i) => n + daysOut(i.injury_date, i.return_date, today), 0),
    recurrences: list.filter((i) => i.is_recurrence).length,
    byPart: count((i) => i.body_part).map(([part, n]) => ({ part, n })),
    byMechanism: count((i) => i.mechanism).map(([mechanism, n]) => ({ mechanism, n })),
  };
}
