// Age-group resolution for season transitions.
// A player's eligibility for an age group is decided by their birth year
// vs the age group's [min_birth_year, max_birth_year] window, defined per
// season by the club. The season reference_date is used for age display.

export interface AgeGroupRule {
  id: string;
  code: string;
  name: string;
  min_birth_year: number | null;
  max_birth_year: number | null;
  display_order?: number | null;
  is_active?: boolean | null;
}

export type TransitionClassification = 'stays' | 'promotes' | 'leaves' | 'unknown';

export interface ResolveResult {
  ageGroupId: string | null;
  ageGroupCode: string | null;
  ageGroupName: string | null;
  ageAtReference: number | null;
  reason: 'matched' | 'over_age' | 'under_age' | 'no_birth_date' | 'no_groups';
}

export interface AgeGroupResolution {
  ageGroup: AgeGroupRule | null;
  birthYear: number | null;
  ageAtReference: number | null;
  /** 'matched' when a group covers the birth year. */
  reason: ResolveResult['reason'];
  /** Set when more than one active group covers the same birth year. */
  warning: string | null;
}

export function ageAt(birthDate: string | Date | null, referenceDate: string | Date): number | null {
  if (!birthDate) return null;
  const b = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const r = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  if (isNaN(b.getTime()) || isNaN(r.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const mDiff = r.getMonth() - b.getMonth();
  if (mDiff < 0 || (mDiff === 0 && r.getDate() < b.getDate())) age--;
  return age;
}

/** Birth year of a player, or null when the birth date is missing/invalid. */
export function getBirthYear(birthDate: string | Date | null): number | null {
  if (!birthDate) return null;
  const b = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  if (isNaN(b.getTime())) return null;
  return b.getFullYear();
}

function activeSorted(ageGroups: AgeGroupRule[]): AgeGroupRule[] {
  return (ageGroups || [])
    .filter((g) => g.is_active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

/**
 * Age group whose [min_birth_year, max_birth_year] window contains birthYear.
 * When several groups overlap, the lowest display_order wins and a warning is returned.
 */
export function resolveAgeGroupByBirthYear(
  birthYear: number | null,
  ageGroups: AgeGroupRule[],
): { ageGroup: AgeGroupRule | null; warning: string | null } {
  if (birthYear == null) return { ageGroup: null, warning: null };
  const matches = activeSorted(ageGroups).filter((g) => {
    const min = g.min_birth_year ?? -Infinity;
    const max = g.max_birth_year ?? Infinity;
    return birthYear >= min && birthYear <= max;
  });
  if (matches.length === 0) return { ageGroup: null, warning: null };
  const warning =
    matches.length > 1
      ? `Ano ${birthYear} coberto por ${matches.length} escalões (${matches.map((m) => m.code).join(', ')}); usado ${matches[0].code}.`
      : null;
  return { ageGroup: matches[0], warning };
}

/** Central resolution used by the season transition engine. */
export function resolveAgeGroupForPlayer(
  birthDate: string | Date | null,
  referenceDate: string | Date,
  ageGroups: AgeGroupRule[],
): AgeGroupResolution {
  const birthYear = getBirthYear(birthDate);
  const groups = activeSorted(ageGroups);
  if (birthYear == null) {
    return { ageGroup: null, birthYear: null, ageAtReference: null, reason: 'no_birth_date', warning: null };
  }
  if (groups.length === 0) {
    return {
      ageGroup: null,
      birthYear,
      ageAtReference: ageAt(birthDate, referenceDate),
      reason: 'no_groups',
      warning: null,
    };
  }
  const { ageGroup, warning } = resolveAgeGroupByBirthYear(birthYear, groups);
  if (ageGroup) {
    return {
      ageGroup,
      birthYear,
      ageAtReference: ageAt(birthDate, referenceDate),
      reason: 'matched',
      warning,
    };
  }
  const minYear = Math.min(...groups.map((g) => g.min_birth_year ?? Infinity));
  return {
    ageGroup: null,
    birthYear,
    ageAtReference: ageAt(birthDate, referenceDate),
    reason: birthYear < minYear ? 'over_age' : 'under_age',
    warning: null,
  };
}

/** Backwards-compatible wrapper kept for existing callers. */
export function resolveTargetAgeGroup(
  birthDate: string | Date | null,
  referenceDate: string | Date,
  ageGroups: AgeGroupRule[]
): ResolveResult {
  const res = resolveAgeGroupForPlayer(birthDate, referenceDate, ageGroups);
  return {
    ageGroupId: res.ageGroup?.id ?? null,
    ageGroupCode: res.ageGroup?.code ?? null,
    ageGroupName: res.ageGroup?.name ?? null,
    ageAtReference: res.ageAtReference,
    reason: res.reason,
  };
}

/**
 * Eligibility of a player for an age group.
 * Returns `null` when it cannot be decided (missing/invalid birth date) so
 * callers never treat missing data as "not eligible".
 */
export function isPlayerEligibleForAgeGroup(
  birthDate: string | Date | null,
  group: AgeGroupRule | null | undefined
): boolean | null {
  const year = getBirthYear(birthDate);
  if (year == null) return null;
  if (!group) return false;
  const min = group.min_birth_year ?? -Infinity;
  const max = group.max_birth_year ?? Infinity;
  return year >= min && year <= max;
}

/** Alias kept for existing callers. */
export const isEligibleForGroup = isPlayerEligibleForAgeGroup;

export function listEligiblePlayersForAgeGroup<T extends { birth_date: string | null }>(
  players: T[],
  group: AgeGroupRule | null | undefined,
  _referenceDate?: string | Date,
): T[] {
  if (!group) return [];
  return (players || []).filter((p) => isPlayerEligibleForAgeGroup(p.birth_date, group) === true);
}

/**
 * Classification of a player's move between two age groups.
 * 'leaves' when no eligible group exists in the new season,
 * 'unknown' when data is insufficient to decide.
 */
export function describeTransition(
  currentAgeGroupId: string | null,
  targetAgeGroupId: string | null,
  ageGroups: AgeGroupRule[],
): TransitionClassification {
  if (!targetAgeGroupId) return currentAgeGroupId ? 'leaves' : 'unknown';
  if (!currentAgeGroupId) return 'unknown';
  if (currentAgeGroupId === targetAgeGroupId) return 'stays';
  const from = ageGroups.find((g) => g.id === currentAgeGroupId);
  const to = ageGroups.find((g) => g.id === targetAgeGroupId);
  if (!from || !to) return 'unknown';
  const fromOrder = from.display_order ?? 0;
  const toOrder = to.display_order ?? 0;
  return toOrder > fromOrder ? 'promotes' : 'stays';
}

export type EnrollmentEligibility = 'eligible' | 'out_of_group' | 'unknown';

/**
 * Classification used by the roster listing: flags legacy enrollments whose
 * player is not eligible for the age group they are enrolled in.
 * Missing data is never treated as a violation.
 */
export function classifyEnrollmentEligibility(
  birthDate: string | null | undefined,
  group: AgeGroupRule | null | undefined,
): EnrollmentEligibility {
  if (!group) return 'unknown';
  const eligible = isPlayerEligibleForAgeGroup(birthDate ?? null, group);
  if (eligible === null) return 'unknown';
  return eligible ? 'eligible' : 'out_of_group';
}
