/**
 * Which sports a coach works with. Football and futsal are separate worlds:
 * a football coach only sees football (5/7/9/11), a futsal coach only futsal,
 * and only a coach who chose both sees both.
 */
export type SportScope = 'football' | 'futsal' | 'both';

export const SPORT_SCOPE_LABELS: Record<SportScope, string> = {
  football: 'Futebol',
  futsal: 'Futsal',
  both: 'Futebol e futsal',
};

/** 'futsal' → futsal; every other match/team format (football_5/7/9/11) → football. */
export const sportFamily = (sportType: string | null | undefined): 'football' | 'futsal' =>
  sportType === 'futsal' ? 'futsal' : 'football';

export function isSportAllowed(scope: SportScope, sportType: string | null | undefined): boolean {
  return scope === 'both' || sportFamily(sportType) === scope;
}

export function filterSportTypes<T extends string>(scope: SportScope, types: readonly T[]): T[] {
  return types.filter((t) => isSportAllowed(scope, t));
}

export function normalizeScope(v: unknown): SportScope {
  return v === 'futsal' || v === 'both' ? v : 'football';
}

/** A club's modalities (['football','futsal']) as a scope. */
export function scopeFromModalities(modalities: string[] | null | undefined): SportScope {
  const f = !!modalities?.includes('football');
  const s = !!modalities?.includes('futsal');
  return f && s ? 'both' : s ? 'futsal' : 'football';
}

/** Default team/match format for a scope. */
export const defaultSportType = (scope: SportScope) => (scope === 'futsal' ? 'futsal' : 'football_11');
