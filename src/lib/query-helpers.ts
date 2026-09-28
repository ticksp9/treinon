/**
 * Shared Supabase query helpers.
 * Reduce duplication across pages by centralizing common data fetching patterns.
 */
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats, TeamWithCount } from '@/lib/types';

/**
 * Fetch dashboard stats in a single parallel call
 */
export async function fetchDashboardStats(seasonId?: string | null): Promise<DashboardStats> {
  // Everything is scoped to the selected season. A brand-new season starts at zero.
  let matchesQuery = supabase
    .from('matches')
    .select('id, match_date, status', { count: 'exact' })
    .eq('is_deleted', false);
  if (seasonId) matchesQuery = matchesQuery.eq('season_id', seasonId);

  const [teamsRes, matchesRes] = await Promise.all([
    seasonId
      ? supabase
          .from('season_team_memberships' as any)
          .select('team_id', { count: 'exact', head: true })
          .eq('season_id', seasonId)
      : supabase.from('teams').select('id', { count: 'exact', head: true }),
    matchesQuery,
  ]);

  let playersCount = 0;
  if (seasonId) {
    const { data } = await supabase
      .from('season_player_enrollments' as any)
      .select('player_id')
      .eq('season_id', seasonId)
      .eq('status', 'active');
    playersCount = new Set(((data as any[]) || []).map((e) => e.player_id)).size;
  } else {
    const { count } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    playersCount = count || 0;
  }

  const upcomingMatches = matchesRes.data?.filter(
    (m) => m.status === 'scheduled' && new Date(m.match_date) >= new Date()
  ).length || 0;

  return {
    teamsCount: teamsRes.count || 0,
    playersCount,
    matchesCount: matchesRes.count || 0,
    upcomingMatches,
  };
}


/**
 * Fetch teams with player counts (avoids N+1)
 */
export async function fetchTeamsWithCounts(): Promise<TeamWithCount[]> {
  // Fetch all teams
  const { data: teamsData, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!teamsData) return [];

  // Fetch all player counts in one query grouped by team
  const teamIds = teamsData.map(t => t.id);
  if (teamIds.length === 0) return teamsData as TeamWithCount[];

  // Use a single query with team_id filter to get counts
  const { data: playerCounts } = await supabase
    .from('players')
    .select('team_id')
    .eq('is_active', true)
    .in('team_id', teamIds);

  const countMap = new Map<string, number>();
  playerCounts?.forEach(p => {
    countMap.set(p.team_id, (countMap.get(p.team_id) || 0) + 1);
  });

  return teamsData.map(team => ({
    ...team,
    players_count: countMap.get(team.id) || 0,
  }));
}

/**
 * Sanitize player form payload for DB insert/update
 */
export function sanitizePlayerPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...payload };

  const dateFields = ['birth_date', 'id_document_expiry', 'medical_certificate_expiry'];
  for (const key of dateFields) {
    if (cleaned[key] === '') cleaned[key] = null;
  }

  const numberFields = ['number', 'height_cm', 'weight_kg'];
  for (const key of numberFields) {
    if (typeof cleaned[key] === 'number' && Number.isNaN(cleaned[key] as number)) cleaned[key] = null;
  }

  return cleaned;
}

/** Standard query keys for consistency */
export const queryKeys = {
  teams: ['teams'] as const,
  teamsWithCounts: ['teams', 'with-counts'] as const,
  players: (teamId?: string) => teamId ? ['players', teamId] : ['players'] as const,
  matches: (teamId?: string) => teamId ? ['matches', teamId] : ['matches'] as const,
  dashboardStats: (seasonId?: string | null) => ['dashboard-stats', seasonId ?? null] as const,
  club: (clubId: string) => ['club', clubId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  activeInjuries: ['active-injuries'] as const,
} as const;
