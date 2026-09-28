/**
 * Substitution-mode resolution.
 *
 * A match can either be:
 *  - 'NO_REENTRY'    — once a player leaves, they cannot return.
 *  - 'FREE_REENTRY'  — players may come back on multiple times (rolling subs).
 *
 * Resolution priority (highest → lowest):
 *   1. Per-match override (`matches.substitution_mode`)
 *   2. Locked rules snapshot (`match_rule_snapshots.substitution_mode`)
 *   3. Sport-format default (football_11 → NO_REENTRY, others → FREE_REENTRY)
 */

export type SubstitutionMode = 'NO_REENTRY' | 'FREE_REENTRY';

export function defaultSubstitutionModeForSport(
  sportType: string | null | undefined,
): SubstitutionMode {
  if (sportType === 'football_11') return 'NO_REENTRY';
  // football_5/7/9, futsal, and unknown formats default to free reentry.
  return 'FREE_REENTRY';
}

export interface ResolveSubstitutionModeInput {
  matchOverride?: SubstitutionMode | string | null;
  snapshotMode?: SubstitutionMode | string | null;
  sportType?: string | null;
}

export function resolveSubstitutionMode({
  matchOverride,
  snapshotMode,
  sportType,
}: ResolveSubstitutionModeInput): SubstitutionMode {
  const normalize = (v: unknown): SubstitutionMode | null => {
    if (v === 'NO_REENTRY' || v === 'FREE_REENTRY') return v;
    return null;
  };
  return (
    normalize(matchOverride) ??
    normalize(snapshotMode) ??
    defaultSubstitutionModeForSport(sportType)
  );
}
