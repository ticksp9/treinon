// Pure analytics helpers for the player development profile.
// All functions are deterministic and pure — easy to unit-test.
//
// Inputs are intentionally narrow / structural so the same helpers can be reused
// from React Query selectors, the PDF report, and tests with handcrafted fixtures.

import {
  ATTRIBUTE_CATALOG,
  categoryAverage,
  type AttributeCategory,
  type AttributeScores,
} from './player-attributes';

// ─────────────────────────────────────────────────────────── Types

export interface MatchRow {
  id: string;
  match_date: string; // ISO
  opponent_name?: string | null;
  is_home?: boolean | null;
  goals_for?: number | null;
  goals_against?: number | null;
  parts_count?: number | null;
  part_duration_minutes?: number | null;
  starter_ids?: string[] | null;
  bench_ids?: string[] | null;
}

export interface LineupRow {
  match_id: string;
  player_id: string;
  is_starter: boolean;
  minutes_played: number | null;
  position_played?: string | null;
  rating?: number | null;
}

export interface AttendanceRow {
  session_id: string;
  player_id: string;
  present: boolean;
  status?: string | null;
  session_date?: string | null; // ISO
}

export interface InjuryRow {
  injury_date: string; // ISO date
  return_date: string | null; // ISO date or null = ongoing
  severity?: 'minor' | 'moderate' | 'severe' | string | null;
}

export interface EvaluationRow {
  evaluation_date: string;
  technical_rating?: number | null;
  tactical_rating?: number | null;
  physical_rating?: number | null;
  mental_rating?: number | null;
  overall_rating?: number | null;
  attributes?: AttributeScores | null;
}

// ─────────────────────────────────────────────────────────── Match utilization

export interface MatchUsageStats {
  matchesCalled: number;          // convocado (starter or bench)
  matchesNotCalled: number;       // não convocado
  matchesPlayed: number;          // utilizado (minutos > 0)
  matchesStarted: number;
  matchesAsSub: number;
  matchesUnused: number;          // convocado mas 0 minutos
  totalMinutes: number;
  avgMinutesPerMatch: number;     // por jogo realizado (minutos > 0)
  avgMinutesPerCalled: number;    // por convocatória
  utilizationPct: number | null;  // % de minutos vs disponível na equipa
}

/**
 * Compute call-up & utilization stats for a player from team matches and lineups.
 * `teamMatches` should be ALL finished/scheduled matches the team had — they tell
 * us how many times the player COULD have been called.
 */
export function computeMatchUsage(
  playerId: string,
  teamMatches: MatchRow[],
  playerLineups: LineupRow[],
): MatchUsageStats {
  const lineupByMatch = new Map(playerLineups.map((l) => [l.match_id, l]));

  let called = 0;
  let played = 0;
  let started = 0;
  let asSub = 0;
  let unused = 0;
  let totalMinutes = 0;
  let teamAvailableMinutes = 0;

  for (const m of teamMatches) {
    const inSquad =
      (m.starter_ids ?? []).includes(playerId) ||
      (m.bench_ids ?? []).includes(playerId) ||
      lineupByMatch.has(m.id);

    const matchMinutes =
      (m.parts_count ?? 0) > 0 && (m.part_duration_minutes ?? 0) > 0
        ? (m.parts_count as number) * (m.part_duration_minutes as number)
        : 0;
    teamAvailableMinutes += matchMinutes;

    if (!inSquad) continue;
    called++;

    const lineup = lineupByMatch.get(m.id);
    const minutes = lineup?.minutes_played ?? 0;
    totalMinutes += minutes;

    if (minutes > 0) {
      played++;
      if (lineup?.is_starter) started++;
      else asSub++;
    } else {
      unused++;
    }
  }

  const matchesNotCalled = Math.max(0, teamMatches.length - called);
  const avgMinutesPerMatch = played > 0 ? totalMinutes / played : 0;
  const avgMinutesPerCalled = called > 0 ? totalMinutes / called : 0;
  const utilizationPct =
    teamAvailableMinutes > 0
      ? Math.round((totalMinutes / teamAvailableMinutes) * 100)
      : null;

  return {
    matchesCalled: called,
    matchesNotCalled,
    matchesPlayed: played,
    matchesStarted: started,
    matchesAsSub: asSub,
    matchesUnused: unused,
    totalMinutes,
    avgMinutesPerMatch,
    avgMinutesPerCalled,
    utilizationPct,
  };
}

// ─────────────────────────────────────────────────────────── Minutes per match (chart)

export interface MinutesPerMatchPoint {
  matchId: string;
  date: string;       // ISO
  label: string;      // "vs SCU"
  minutes: number;
  isStarter: boolean;
  called: boolean;
}

export function buildMinutesPerMatchSeries(
  playerId: string,
  teamMatches: MatchRow[],
  lineups: LineupRow[],
): MinutesPerMatchPoint[] {
  const lineupByMatch = new Map(lineups.map((l) => [l.match_id, l]));
  return [...teamMatches]
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
    .map((m) => {
      const l = lineupByMatch.get(m.id);
      const called =
        (m.starter_ids ?? []).includes(playerId) ||
        (m.bench_ids ?? []).includes(playerId) ||
        !!l;
      return {
        matchId: m.id,
        date: m.match_date,
        label: m.opponent_name ? `vs ${m.opponent_name}` : '—',
        minutes: l?.minutes_played ?? 0,
        isStarter: !!l?.is_starter,
        called,
      };
    });
}

// ─────────────────────────────────────────────────────────── Period averages

export interface PeriodAverage {
  period: string; // ex: "2025-09"
  avgMinutes: number;
  matchesPlayed: number;
}

/** Group minutes per ISO month (YYYY-MM) and average over matches PLAYED. */
export function computeAvgMinutesPerPeriod(
  series: MinutesPerMatchPoint[],
): PeriodAverage[] {
  const buckets = new Map<string, { total: number; played: number }>();
  for (const p of series) {
    if (p.minutes <= 0) continue;
    const key = p.date.slice(0, 7);
    const b = buckets.get(key) ?? { total: 0, played: 0 };
    b.total += p.minutes;
    b.played += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, b]) => ({
      period,
      matchesPlayed: b.played,
      avgMinutes: b.played > 0 ? b.total / b.played : 0,
    }));
}

// ─────────────────────────────────────────────────────────── Training presence

export interface TrainingPresenceStats {
  total: number;
  attended: number;
  missed: number;
  presencePct: number;
}

export function computeTrainingPresence(
  attendance: AttendanceRow[],
): TrainingPresenceStats {
  const total = attendance.length;
  const attended = attendance.filter((a) => a.present).length;
  const missed = total - attended;
  const presencePct = total > 0 ? Math.round((attended / total) * 100) : 0;
  return { total, attended, missed, presencePct };
}

// ─────────────────────────────────────────────────────────── Evaluation evolution

export interface EvolutionPoint {
  date: string;
  Técnica: number | null;
  Tática: number | null;
  Física: number | null;
  Mental: number | null;
  Global: number | null;
}

export function buildEvolutionSeries(evals: EvaluationRow[]): EvolutionPoint[] {
  return [...evals]
    .sort((a, b) => a.evaluation_date.localeCompare(b.evaluation_date))
    .map((e) => {
      const scores: AttributeScores =
        e.attributes && Object.keys(e.attributes).length > 0 ? e.attributes : {};
      return {
        date: e.evaluation_date,
        Técnica: categoryAverage(scores, 'technical') ?? e.technical_rating ?? null,
        Tática: categoryAverage(scores, 'tactical') ?? e.tactical_rating ?? null,
        Física: categoryAverage(scores, 'physical') ?? e.physical_rating ?? null,
        Mental: categoryAverage(scores, 'mental') ?? e.mental_rating ?? null,
        Global: e.overall_rating ?? null,
      };
    });
}

/** Tendency between first and last value of a numeric series. */
export type Trend = 'up' | 'down' | 'flat' | 'insufficient';
export function trendOf(values: Array<number | null | undefined>): Trend {
  const clean = values.filter((v): v is number => typeof v === 'number');
  if (clean.length < 2) return 'insufficient';
  const delta = clean[clean.length - 1] - clean[0];
  if (Math.abs(delta) < 0.25) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

export interface CategoryEvolution {
  category: AttributeCategory;
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  trend: Trend;
}

export function categoryEvolutionSummary(evals: EvaluationRow[]): CategoryEvolution[] {
  const series = buildEvolutionSeries(evals);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  return ATTRIBUTE_CATALOG.map((cat) => {
    const labelKey =
      cat.key === 'technical' ? 'Técnica'
      : cat.key === 'tactical' ? 'Tática'
      : cat.key === 'physical' ? 'Física'
      : 'Mental';
    const current = (last?.[labelKey as keyof EvolutionPoint] as number | null) ?? null;
    const previous = (prev?.[labelKey as keyof EvolutionPoint] as number | null) ?? null;
    const delta =
      typeof current === 'number' && typeof previous === 'number'
        ? Number((current - previous).toFixed(2))
        : null;
    return {
      category: cat.key,
      label: cat.label,
      current,
      previous,
      delta,
      trend: trendOf(series.map((s) => s[labelKey as keyof EvolutionPoint] as number | null)),
    };
  });
}

// ─────────────────────────────────────────────────────────── Radar (current profile)

export interface RadarPoint {
  category: string;
  value: number; // 0-10
  positionAvg?: number | null;
}

export function buildRadarFromLatest(
  latest: EvaluationRow | null | undefined,
  positionAverages?: Partial<Record<AttributeCategory, number | null>>,
): RadarPoint[] {
  const scores: AttributeScores =
    latest?.attributes && Object.keys(latest.attributes).length > 0
      ? latest.attributes
      : {};
  return ATTRIBUTE_CATALOG.map((cat) => {
    const v = categoryAverage(scores, cat.key) ??
      (cat.key === 'technical' ? latest?.technical_rating
        : cat.key === 'tactical' ? latest?.tactical_rating
        : cat.key === 'physical' ? latest?.physical_rating
        : latest?.mental_rating) ?? 0;
    return {
      category: cat.label,
      value: Number(v) || 0,
      positionAvg: positionAverages?.[cat.key] ?? null,
    };
  });
}

// ─────────────────────────────────────────────────────────── Position averages

/**
 * Average per category for the current profile of every player in `peerEvals`.
 * Used to compare a player against same-position peers.
 */
export function computePeerCategoryAverages(
  peerLatestEvals: EvaluationRow[],
): Record<AttributeCategory, number | null> {
  const out: Record<AttributeCategory, number | null> = {
    technical: null, tactical: null, physical: null, mental: null,
  };
  for (const cat of ATTRIBUTE_CATALOG) {
    const values: number[] = [];
    for (const e of peerLatestEvals) {
      const scores: AttributeScores =
        e.attributes && Object.keys(e.attributes).length > 0 ? e.attributes : {};
      const v = categoryAverage(scores, cat.key) ??
        (cat.key === 'technical' ? e.technical_rating
          : cat.key === 'tactical' ? e.tactical_rating
          : cat.key === 'physical' ? e.physical_rating
          : e.mental_rating);
      if (typeof v === 'number') values.push(v);
    }
    out[cat.key] = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }
  return out;
}

// ─────────────────────────────────────────────────────────── Availability timeline

export type AvailabilityState = 'available' | 'injured';
export interface AvailabilitySegment {
  start: string; // ISO date
  end: string;   // ISO date (today if ongoing)
  state: AvailabilityState;
  severity?: string | null;
}

/**
 * Build a timeline of injury vs available periods between `from` and today.
 * Useful to render a horizontal bar chart of availability.
 */
export function buildAvailabilityTimeline(
  injuries: InjuryRow[],
  from: string,
  to: string = new Date().toISOString().slice(0, 10),
): AvailabilitySegment[] {
  const periods = injuries
    .filter((i) => i.injury_date)
    .map((i) => ({
      start: i.injury_date < from ? from : i.injury_date,
      end: i.return_date ?? to,
      severity: i.severity ?? null,
    }))
    .filter((p) => p.start <= to && p.end >= from)
    .sort((a, b) => a.start.localeCompare(b.start));

  // Merge overlapping injury periods
  const merged: typeof periods = [];
  for (const p of periods) {
    const last = merged[merged.length - 1];
    if (last && p.start <= last.end) {
      last.end = p.end > last.end ? p.end : last.end;
    } else {
      merged.push({ ...p });
    }
  }

  // Stitch with available segments
  const segments: AvailabilitySegment[] = [];
  let cursor = from;
  for (const inj of merged) {
    if (cursor < inj.start) {
      segments.push({ start: cursor, end: inj.start, state: 'available' });
    }
    segments.push({
      start: inj.start,
      end: inj.end,
      state: 'injured',
      severity: inj.severity,
    });
    cursor = inj.end > cursor ? inj.end : cursor;
  }
  if (cursor < to) {
    segments.push({ start: cursor, end: to, state: 'available' });
  }
  return segments;
}
