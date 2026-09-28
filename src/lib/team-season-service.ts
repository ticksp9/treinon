import { supabase } from '@/integrations/supabase/client';

/** Minimal team shape needed for season scoping. */
export interface TeamSeasonLike {
  id: string;
  season: string;
  season_id?: string | null;
}

/** Team ids that have a membership in the given season. */
export async function fetchSeasonTeamIds(seasonId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('season_team_memberships' as any)
    .select('team_id')
    .eq('season_id', seasonId);
  if (error) throw error;
  return ((data as unknown as { team_id: string }[]) ?? []).map((r) => r.team_id);
}

/** Idempotent membership (unique season_id + team_id). */
export async function ensureTeamMembership(
  seasonId: string,
  teamId: string,
  ageGroupId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('season_team_memberships' as any)
    .upsert(
      { season_id: seasonId, team_id: teamId, age_group_id: ageGroupId ?? null },
      { onConflict: 'season_id,team_id' },
    );
  if (error) throw error;
}

/**
 * Teams visible in the selected season: membership in that season, or the
 * legacy `teams.season` string matching the season name (retro-compat).
 */
export function filterTeamsForSeason<T extends TeamSeasonLike>(
  teams: T[],
  seasonName: string | null,
  membershipTeamIds: string[],
): T[] {
  if (!seasonName) return teams;
  const ids = new Set(membershipTeamIds);
  return teams.filter((t) => ids.has(t.id) || (!t.season_id && t.season === seasonName));
}

/** Season label shown on the team card, in the context of the selected season. */
export function teamSeasonLabel<T extends TeamSeasonLike>(
  team: T,
  seasonName: string | null,
  membershipTeamIds: string[],
): string {
  if (seasonName && membershipTeamIds.includes(team.id)) return seasonName;
  return team.season;
}

export interface ImportTeamsResult {
  imported: number;
  skipped: number;
}

/**
 * Associates the previous season's teams with the target season by creating
 * memberships only — never duplicating rows in `teams`.
 */
export async function importTeamsFromPreviousSeason(
  previousSeasonId: string,
  targetSeasonId: string,
): Promise<ImportTeamsResult> {
  if (previousSeasonId === targetSeasonId) throw new Error('Época de origem inválida.');

  const [sourceIds, targetIds] = await Promise.all([
    fetchSeasonTeamIds(previousSeasonId),
    fetchSeasonTeamIds(targetSeasonId),
  ]);

  const existing = new Set(targetIds);
  const toInsert = sourceIds.filter((id) => !existing.has(id));
  if (toInsert.length === 0) return { imported: 0, skipped: sourceIds.length };

  const { error } = await supabase
    .from('season_team_memberships' as any)
    .upsert(
      toInsert.map((team_id) => ({ season_id: targetSeasonId, team_id })),
      { onConflict: 'season_id,team_id' },
    );
  if (error) {
    console.error('[importTeamsFromPreviousSeason] insert failed', error);
    throw new Error(error.message);
  }

  const { count, error: countError } = await supabase
    .from('season_team_memberships' as any)
    .select('team_id', { count: 'exact', head: true })
    .eq('season_id', targetSeasonId);
  if (countError) throw new Error(countError.message);

  return {
    imported: Math.max(0, (count ?? 0) - targetIds.length),
    skipped: sourceIds.length - toInsert.length,
  };
}
