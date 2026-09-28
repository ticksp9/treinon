// Aggregations for player progression: per-season usage, training attendance,
// trends. Pure functions — pass in raw rows from queries.

export interface MatchUsageRow {
  match_id: string;
  match_date: string;
  season?: string | null;
  team_season?: string | null;
  is_starter: boolean | null;
  minutes_played: number | null;
}

export interface CalledUpMatchRow {
  match_id: string;
  match_date: string;
  season?: string | null;
}

export interface TrainingAttendanceRow {
  session_id: string;
  session_date: string;
  season?: string | null;
  present: boolean | null;
}

export interface SeasonAggregate {
  season: string;
  gamesPlayed: number;
  gamesStarted: number;
  gamesAsSub: number;
  gamesCalledNotPlayed: number;
  minutesTotal: number;
  avgMinutes: number;
  trainingsTotal: number;
  trainingsAttended: number;
  attendanceRate: number; // 0-100
}

function seasonKey(row: { season?: string | null; team_season?: string | null; match_date?: string; session_date?: string }): string {
  if (row.season) return row.season;
  if (row.team_season) return row.team_season;
  // fallback: derive 2025/26 style label from date
  const d = new Date((row.match_date || row.session_date)!);
  const year = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}/${String(year + 1).slice(-2)}`;
}

export function aggregateBySeason(args: {
  played: MatchUsageRow[];
  called: CalledUpMatchRow[];
  trainings: TrainingAttendanceRow[];
}): SeasonAggregate[] {
  const map = new Map<string, SeasonAggregate>();
  const ensure = (s: string): SeasonAggregate => {
    if (!map.has(s)) {
      map.set(s, {
        season: s,
        gamesPlayed: 0,
        gamesStarted: 0,
        gamesAsSub: 0,
        gamesCalledNotPlayed: 0,
        minutesTotal: 0,
        avgMinutes: 0,
        trainingsTotal: 0,
        trainingsAttended: 0,
        attendanceRate: 0,
      });
    }
    return map.get(s)!;
  };

  const playedIds = new Set<string>();
  for (const r of args.played) {
    const s = ensure(seasonKey(r));
    playedIds.add(r.match_id);
    if ((r.minutes_played ?? 0) > 0) {
      s.gamesPlayed += 1;
      s.minutesTotal += r.minutes_played ?? 0;
      if (r.is_starter) s.gamesStarted += 1;
      else s.gamesAsSub += 1;
    }
  }

  for (const r of args.called) {
    const s = ensure(seasonKey(r));
    if (!playedIds.has(r.match_id)) {
      // Called but did not play (no lineup row counted as played)
    }
    // If called but absent in `played` → not used
    const wasUsed = args.played.some(
      (p) => p.match_id === r.match_id && (p.minutes_played ?? 0) > 0,
    );
    if (!wasUsed) s.gamesCalledNotPlayed += 1;
  }

  for (const r of args.trainings) {
    const s = ensure(seasonKey(r));
    s.trainingsTotal += 1;
    if (r.present) s.trainingsAttended += 1;
  }

  for (const s of map.values()) {
    s.avgMinutes = s.gamesPlayed > 0 ? Math.round(s.minutesTotal / s.gamesPlayed) : 0;
    s.attendanceRate =
      s.trainingsTotal > 0 ? Math.round((s.trainingsAttended / s.trainingsTotal) * 100) : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.season.localeCompare(a.season));
}

/** Build percentage of utilization for a single season (0-100). */
export function utilizationPercent(agg: SeasonAggregate): number {
  const total = agg.gamesPlayed + agg.gamesCalledNotPlayed;
  if (total === 0) return 0;
  return Math.round((agg.gamesPlayed / total) * 100);
}

/** Last N matches sequence ordered by date desc. */
export function recentMatchSequence(played: MatchUsageRow[], n = 5): MatchUsageRow[] {
  return [...played]
    .sort((a, b) => b.match_date.localeCompare(a.match_date))
    .slice(0, n);
}
