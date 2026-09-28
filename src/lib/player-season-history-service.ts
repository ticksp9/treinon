// Season-by-season history for a player.
// Prefers immutable snapshots (written when a season is closed) and falls back to
// on-the-fly aggregation of the operational tables filtered by season_id.
import { supabase } from '@/integrations/supabase/client';

export interface SeasonHistoryRow {
  seasonId: string | null;
  seasonLabel: string;
  source: 'snapshot' | 'live';
  seasonStatus: string | null;
  teamName: string | null;
  ageGroup: string | null;
  games: number;
  minutes: number;
  starts: number;
  trainingsTotal: number;
  trainingsPresent: number;
  attendanceRate: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  avgOverall: number | null;
  evaluationsCount: number;
  predominantRole: string | null;
  minutesByRole: Record<string, number>;
  strengths: string | null;
  improvements: string | null;
}

export interface LiveAggregateInput {
  lineups: Array<{ season_id: string | null; minutes_played: number | null; is_starter: boolean | null }>;
  attendance: Array<{ season_id: string | null; present: boolean | null }>;
  events: Array<{ season_id: string | null; event_type: string | null; is_assist?: boolean }>;
  evaluations: Array<{
    season_id: string | null;
    overall_rating: number | null;
    strengths: string | null;
    weaknesses: string | null;
    evaluation_date: string | null;
  }>;
}

function emptyRow(seasonId: string | null, label: string): SeasonHistoryRow {
  return {
    seasonId,
    seasonLabel: label,
    source: 'live',
    seasonStatus: null,
    teamName: null,
    ageGroup: null,
    games: 0,
    minutes: 0,
    starts: 0,
    trainingsTotal: 0,
    trainingsPresent: 0,
    attendanceRate: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    avgOverall: null,
    evaluationsCount: 0,
    predominantRole: null,
    minutesByRole: {},
    strengths: null,
    improvements: null,
  };
}

/** Aggregate operational rows into one entry per season. Pure — easy to test. */
export function aggregateLiveBySeason(
  input: LiveAggregateInput,
  seasonNames: Record<string, string>,
): Map<string, SeasonHistoryRow> {
  const map = new Map<string, SeasonHistoryRow>();
  const get = (seasonId: string | null): SeasonHistoryRow | null => {
    if (!seasonId) return null; // rows without a season never leak into a season
    if (!map.has(seasonId)) map.set(seasonId, emptyRow(seasonId, seasonNames[seasonId] || 'Sem época'));
    return map.get(seasonId)!;
  };

  for (const l of input.lineups) {
    const row = get(l.season_id);
    if (!row) continue;
    row.games += 1;
    row.minutes += l.minutes_played || 0;
    if (l.is_starter) row.starts += 1;
  }
  for (const a of input.attendance) {
    const row = get(a.season_id);
    if (!row) continue;
    row.trainingsTotal += 1;
    if (a.present) row.trainingsPresent += 1;
  }
  for (const e of input.events) {
    const row = get(e.season_id);
    if (!row) continue;
    if (e.is_assist) row.assists += 1;
    else if (e.event_type === 'goal') row.goals += 1;
    else if (e.event_type === 'yellow_card') row.yellowCards += 1;
    else if (e.event_type === 'red_card') row.redCards += 1;
  }
  const evalSums = new Map<string, { sum: number; n: number }>();
  const lastEval = new Map<string, { date: string; strengths: string | null; weaknesses: string | null }>();
  for (const ev of input.evaluations) {
    const row = get(ev.season_id);
    if (!row) continue;
    row.evaluationsCount += 1;
    if (ev.overall_rating != null) {
      const acc = evalSums.get(ev.season_id!) || { sum: 0, n: 0 };
      acc.sum += ev.overall_rating;
      acc.n += 1;
      evalSums.set(ev.season_id!, acc);
    }
    const prev = lastEval.get(ev.season_id!);
    const date = ev.evaluation_date || '';
    if (!prev || date >= prev.date) {
      lastEval.set(ev.season_id!, { date, strengths: ev.strengths, weaknesses: ev.weaknesses });
    }
  }
  for (const [seasonId, row] of map) {
    const acc = evalSums.get(seasonId);
    row.avgOverall = acc && acc.n > 0 ? Math.round((acc.sum / acc.n) * 10) / 10 : null;
    row.attendanceRate =
      row.trainingsTotal > 0 ? Math.round((row.trainingsPresent / row.trainingsTotal) * 1000) / 10 : 0;
    const le = lastEval.get(seasonId);
    row.strengths = le?.strengths ?? null;
    row.improvements = le?.weaknesses ?? null;
  }
  return map;
}

function fromSnapshot(s: any, label: string, status: string | null, teamName: string | null): SeasonHistoryRow {
  const total = s.trainings_total ?? 0;
  const present = s.trainings_present ?? s.trainings_count ?? 0;
  return {
    seasonId: s.season_id ?? null,
    seasonLabel: s.season_label || label,
    source: 'snapshot',
    seasonStatus: status,
    teamName,
    ageGroup: s.age_group ?? null,
    games: s.games_count ?? 0,
    minutes: s.minutes_total ?? 0,
    starts: s.starts_count ?? 0,
    trainingsTotal: total,
    trainingsPresent: present,
    attendanceRate: Number(s.attendance_rate ?? 0),
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    yellowCards: s.yellow_cards ?? 0,
    redCards: s.red_cards ?? 0,
    avgOverall: s.avg_overall != null ? Number(s.avg_overall) : null,
    evaluationsCount: s.evaluations_count ?? 0,
    predominantRole: s.predominant_role ?? null,
    minutesByRole: (s.minutes_by_role as Record<string, number>) || {},
    strengths: s.strengths_summary ?? null,
    improvements: s.improvements_summary ?? null,
  };
}

/** Snapshot wins when it exists; otherwise the live aggregate is used. */
export function mergeSeasonHistory(
  seasons: Array<{ id: string; name: string; status?: string | null }>,
  snapshots: any[],
  live: Map<string, SeasonHistoryRow>,
  teamNames: Record<string, string> = {},
): SeasonHistoryRow[] {
  const names: Record<string, string> = {};
  const statuses: Record<string, string | null> = {};
  for (const s of seasons) {
    names[s.id] = s.name;
    statuses[s.id] = s.status ?? null;
  }

  const out = new Map<string, SeasonHistoryRow>();
  for (const [seasonId, row] of live) {
    row.seasonStatus = statuses[seasonId] ?? null;
    out.set(seasonId, row);
  }
  for (const snap of snapshots) {
    const key = snap.season_id || `label:${snap.season_label}`;
    out.set(key, fromSnapshot(
      snap,
      names[snap.season_id] || snap.season_label,
      statuses[snap.season_id] ?? null,
      snap.team_id ? teamNames[snap.team_id] ?? null : null,
    ));
  }
  return Array.from(out.values()).sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel));
}

export async function fetchPlayerSeasonHistory(playerId: string): Promise<SeasonHistoryRow[]> {
  const [seasonsRes, snapshotsRes, enrollmentsRes, lineupsRes, attendanceRes, eventsRes, assistsRes, evalsRes] =
    await Promise.all([
      supabase.from('seasons' as any).select('id, name, status'),
      supabase.from('player_season_snapshots' as any).select('*').eq('player_id', playerId),
      supabase
        .from('season_player_enrollments' as any)
        .select('season_id, team:teams(name), age_group:academy_age_groups(name)')
        .eq('player_id', playerId),
      supabase
        .from('match_lineups')
        .select('minutes_played, is_starter, match:matches!inner(season_id, is_deleted)')
        .eq('player_id', playerId),
      supabase
        .from('training_attendance')
        .select('present, session:training_sessions!inner(season_id)')
        .eq('player_id', playerId),
      supabase
        .from('match_events')
        .select('event_type, match:matches!inner(season_id, is_deleted)')
        .eq('player_id', playerId),
      supabase
        .from('match_events')
        .select('event_type, match:matches!inner(season_id, is_deleted)')
        .eq('assist_player_id', playerId),
      supabase
        .from('player_evaluations')
        .select('season_id, overall_rating, strengths, weaknesses, evaluation_date')
        .eq('player_id', playerId),
    ]);

  const seasons = ((seasonsRes.data as any[]) || []).map((s) => ({ id: s.id, name: s.name, status: s.status }));
  const names: Record<string, string> = {};
  for (const s of seasons) names[s.id] = s.name;

  const live = aggregateLiveBySeason(
    {
      lineups: ((lineupsRes.data as any[]) || []).filter((l) => !l.match?.is_deleted).map((l) => ({
        season_id: l.match?.season_id ?? null,
        minutes_played: l.minutes_played,
        is_starter: l.is_starter,
      })),
      attendance: ((attendanceRes.data as any[]) || []).map((a) => ({
        season_id: a.session?.season_id ?? null,
        present: a.present,
      })),
      events: [
        ...((eventsRes.data as any[]) || []).filter((e) => !e.match?.is_deleted).map((e) => ({
          season_id: e.match?.season_id ?? null,
          event_type: e.event_type,
        })),
        ...((assistsRes.data as any[]) || []).filter((e) => !e.match?.is_deleted).map((e) => ({
          season_id: e.match?.season_id ?? null,
          event_type: e.event_type,
          is_assist: true,
        })),
      ],
      evaluations: ((evalsRes.data as any[]) || []).map((e) => ({
        season_id: e.season_id ?? null,
        overall_rating: e.overall_rating,
        strengths: e.strengths,
        weaknesses: e.weaknesses,
        evaluation_date: e.evaluation_date,
      })),
    },
    names,
  );

  for (const enrollment of ((enrollmentsRes.data as any[]) || [])) {
    const row = live.get(enrollment.season_id);
    if (!row) continue;
    row.teamName = row.teamName ?? enrollment.team?.name ?? null;
    row.ageGroup = row.ageGroup ?? enrollment.age_group?.name ?? null;
  }

  const snapshots = (snapshotsRes.data as any[]) || [];
  const teamIds = Array.from(new Set(snapshots.map((snapshot) => snapshot.team_id).filter(Boolean)));
  const teamNames: Record<string, string> = {};
  if (teamIds.length > 0) {
    const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
    for (const team of teams || []) teamNames[team.id] = team.name;
  }

  return mergeSeasonHistory(seasons, snapshots, live, teamNames);
}
