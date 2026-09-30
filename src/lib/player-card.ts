/**
 * "Football Manager"-style player card helpers (pure, testable).
 * Scale: attributes and match ratings are 1–10 (as the coaches already evaluate).
 */
import { overallAverage, type AttributeScores } from './player-attributes';

/** FM-like colour tiers for a 1–10 value. */
export function ratingTone(v: number | null | undefined): string {
  if (v == null) return 'text-muted-foreground';
  if (v >= 8.5) return 'text-emerald-500';
  if (v >= 7) return 'text-green-600 dark:text-green-400';
  if (v >= 5.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}
export function ratingBg(v: number | null | undefined): string {
  if (v == null) return 'bg-muted text-muted-foreground';
  if (v >= 8.5) return 'bg-emerald-600 text-white';
  if (v >= 7) return 'bg-green-600 text-white';
  if (v >= 5.5) return 'bg-amber-500 text-amber-950';
  return 'bg-red-600 text-white';
}

/** Current ability 1–10 from the latest evaluation, or null. */
export function currentAbility(attributes: AttributeScores | null | undefined, fallback?: number | null): number | null {
  const v = attributes ? overallAverage(attributes) : null;
  const out = v ?? fallback ?? null;
  return out == null ? null : Math.round(out * 10) / 10;
}

/** 0–5 stars in halves (FM shows ability as stars). */
export function abilityStars(ability: number | null | undefined): number {
  if (ability == null) return 0;
  return Math.max(0, Math.min(5, Math.round((ability / 2) * 2) / 2));
}

export interface Form {
  /** most recent last */
  last: number[];
  average: number | null;
  trend: 'up' | 'down' | 'flat';
}

/** Form from match ratings, oldest → newest. Uses the last `n` games. */
export function computeForm(ratingsOldestFirst: number[], n = 5): Form {
  const last = ratingsOldestFirst.filter((r) => typeof r === 'number' && r > 0).slice(-n);
  if (last.length === 0) return { last, average: null, trend: 'flat' };
  const average = Math.round((last.reduce((a, b) => a + b, 0) / last.length) * 10) / 10;
  let trend: Form['trend'] = 'flat';
  if (last.length >= 3) {
    const half = Math.floor(last.length / 2);
    const early = last.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const late = last.slice(-half).reduce((a, b) => a + b, 0) / half;
    if (late - early >= 0.4) trend = 'up';
    else if (early - late >= 0.4) trend = 'down';
  }
  return { last, average, trend };
}

/** Player of the match: highest rating among those who played (ties → more minutes). */
export function playerOfTheMatch(
  rows: { player_id: string; rating: number | null; minutes?: number | null }[],
): string | null {
  const rated = rows.filter((r) => typeof r.rating === 'number' && (r.minutes ?? 1) > 0);
  if (rated.length === 0) return null;
  rated.sort((a, b) => (b.rating! - a.rating!) || ((b.minutes ?? 0) - (a.minutes ?? 0)));
  return rated[0].player_id;
}

/** Clamp and round a rating to one decimal between 1 and 10. */
export const normalizeRating = (v: number) => Math.round(Math.min(10, Math.max(1, v)) * 10) / 10;
