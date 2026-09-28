import { describe, it, expect } from 'vitest';
import {
  computeMatchUsage,
  buildMinutesPerMatchSeries,
  computeAvgMinutesPerPeriod,
  computeTrainingPresence,
  buildEvolutionSeries,
  categoryEvolutionSummary,
  buildRadarFromLatest,
  computePeerCategoryAverages,
  buildAvailabilityTimeline,
  trendOf,
  type MatchRow, type LineupRow, type EvaluationRow,
} from '@/lib/player-analytics';

const PLAYER = 'p1';
const PEER = 'p2';

const M = (id: string, date: string, opts: Partial<MatchRow> = {}): MatchRow => ({
  id, match_date: date, opponent_name: 'X', is_home: true,
  parts_count: 2, part_duration_minutes: 30,
  starter_ids: [], bench_ids: [], ...opts,
});

const L = (mid: string, opts: Partial<LineupRow> = {}): LineupRow => ({
  match_id: mid, player_id: PLAYER, is_starter: false, minutes_played: 0, ...opts,
});

describe('computeMatchUsage', () => {
  it('counts called/uncalled/played correctly', () => {
    const matches = [
      M('m1', '2025-09-01', { starter_ids: [PLAYER] }),                         // titular
      M('m2', '2025-09-08', { bench_ids: [PLAYER] }),                            // suplente jogou
      M('m3', '2025-09-15', { bench_ids: [PLAYER] }),                            // convocado mas 0 min
      M('m4', '2025-09-22', { starter_ids: [PEER] }),                            // não convocado
      M('m5', '2025-09-29', { bench_ids: [PEER], starter_ids: [PEER] }),         // não convocado
    ];
    const lineups = [
      L('m1', { is_starter: true, minutes_played: 60 }),
      L('m2', { minutes_played: 20 }),
      L('m3', { minutes_played: 0 }),
    ];
    const r = computeMatchUsage(PLAYER, matches, lineups);
    expect(r.matchesCalled).toBe(3);
    expect(r.matchesNotCalled).toBe(2);
    expect(r.matchesPlayed).toBe(2);
    expect(r.matchesStarted).toBe(1);
    expect(r.matchesAsSub).toBe(1);
    expect(r.matchesUnused).toBe(1);
    expect(r.totalMinutes).toBe(80);
    expect(r.avgMinutesPerMatch).toBe(40);
    expect(r.utilizationPct).toBe(Math.round((80 / (5 * 60)) * 100));
  });

  it('handles empty data', () => {
    const r = computeMatchUsage(PLAYER, [], []);
    expect(r).toMatchObject({
      matchesCalled: 0, matchesPlayed: 0, totalMinutes: 0, utilizationPct: null,
    });
  });
});

describe('buildMinutesPerMatchSeries', () => {
  it('orders chronologically and reflects called flag', () => {
    const matches = [
      M('a', '2025-09-10', { starter_ids: [PLAYER] }),
      M('b', '2025-09-01'),
    ];
    const lineups = [L('a', { is_starter: true, minutes_played: 45 })];
    const s = buildMinutesPerMatchSeries(PLAYER, matches, lineups);
    expect(s.map((p) => p.matchId)).toEqual(['b', 'a']);
    expect(s[0].minutes).toBe(0);
    expect(s[0].called).toBe(false);
    expect(s[1].minutes).toBe(45);
    expect(s[1].isStarter).toBe(true);
  });
});

describe('computeAvgMinutesPerPeriod', () => {
  it('groups by month and averages played minutes', () => {
    const series = [
      { matchId: '1', date: '2025-09-01', label: '', minutes: 60, isStarter: true,  called: true },
      { matchId: '2', date: '2025-09-15', label: '', minutes: 30, isStarter: false, called: true },
      { matchId: '3', date: '2025-09-22', label: '', minutes: 0,  isStarter: false, called: true }, // ignored
      { matchId: '4', date: '2025-10-05', label: '', minutes: 90, isStarter: true,  called: true },
    ];
    const r = computeAvgMinutesPerPeriod(series);
    expect(r).toEqual([
      { period: '2025-09', matchesPlayed: 2, avgMinutes: 45 },
      { period: '2025-10', matchesPlayed: 1, avgMinutes: 90 },
    ]);
  });
});

describe('computeTrainingPresence', () => {
  it('handles empty', () => {
    expect(computeTrainingPresence([])).toEqual({ total: 0, attended: 0, missed: 0, presencePct: 0 });
  });
  it('computes percentage', () => {
    const rows = [
      { session_id: 's1', player_id: PLAYER, present: true },
      { session_id: 's2', player_id: PLAYER, present: false },
      { session_id: 's3', player_id: PLAYER, present: true },
      { session_id: 's4', player_id: PLAYER, present: true },
    ];
    expect(computeTrainingPresence(rows)).toEqual({ total: 4, attended: 3, missed: 1, presencePct: 75 });
  });
});

describe('evolution & trend', () => {
  const evals: EvaluationRow[] = [
    { evaluation_date: '2025-01-10', technical_rating: 5, tactical_rating: 5, physical_rating: 6, mental_rating: 5, overall_rating: 5 },
    { evaluation_date: '2025-04-10', technical_rating: 6, tactical_rating: 6, physical_rating: 6, mental_rating: 6, overall_rating: 6 },
    { evaluation_date: '2025-07-10', technical_rating: 7, tactical_rating: 6, physical_rating: 5, mental_rating: 7, overall_rating: 7 },
  ];

  it('builds chronological series', () => {
    const r = buildEvolutionSeries([evals[2], evals[0], evals[1]]);
    expect(r.map((p) => p.date)).toEqual(['2025-01-10', '2025-04-10', '2025-07-10']);
    expect(r[2].Técnica).toBe(7);
  });

  it('computes category trends and deltas', () => {
    const r = categoryEvolutionSummary(evals);
    const tech = r.find((c) => c.category === 'technical')!;
    expect(tech.current).toBe(7);
    expect(tech.previous).toBe(6);
    expect(tech.delta).toBe(1);
    expect(tech.trend).toBe('up');

    const phys = r.find((c) => c.category === 'physical')!;
    expect(phys.trend).toBe('down');
  });

  it('trendOf returns insufficient with <2 numbers', () => {
    expect(trendOf([])).toBe('insufficient');
    expect(trendOf([5])).toBe('insufficient');
    expect(trendOf([5, 5.1])).toBe('flat');
    expect(trendOf([5, 7])).toBe('up');
    expect(trendOf([7, 4])).toBe('down');
  });
});

describe('radar & peer comparison', () => {
  it('builds radar from rating columns when no attributes', () => {
    const r = buildRadarFromLatest({
      evaluation_date: '2025-01-01', technical_rating: 8, tactical_rating: 7, physical_rating: 6, mental_rating: 9,
    });
    expect(r.find((p) => p.category === 'Técnica')?.value).toBe(8);
    expect(r.find((p) => p.category === 'Mental')?.value).toBe(9);
  });

  it('attaches peer averages to radar', () => {
    const peers: EvaluationRow[] = [
      { evaluation_date: '2025-01-01', technical_rating: 6, tactical_rating: 6, physical_rating: 6, mental_rating: 6 },
      { evaluation_date: '2025-01-01', technical_rating: 8, tactical_rating: 8, physical_rating: 8, mental_rating: 8 },
    ];
    const peerAvg = computePeerCategoryAverages(peers);
    expect(peerAvg.technical).toBe(7);
    const r = buildRadarFromLatest(
      { evaluation_date: '2025-02-01', technical_rating: 9 } as EvaluationRow,
      peerAvg,
    );
    expect(r.find((p) => p.category === 'Técnica')?.positionAvg).toBe(7);
  });

  it('returns zeros when no evaluation', () => {
    const r = buildRadarFromLatest(null);
    expect(r.every((p) => p.value === 0)).toBe(true);
  });
});

describe('buildAvailabilityTimeline', () => {
  it('builds available-only segment when no injuries', () => {
    const r = buildAvailabilityTimeline([], '2025-01-01', '2025-06-01');
    expect(r).toEqual([{ start: '2025-01-01', end: '2025-06-01', state: 'available' }]);
  });

  it('interleaves injured periods', () => {
    const r = buildAvailabilityTimeline(
      [
        { injury_date: '2025-02-01', return_date: '2025-02-15', severity: 'moderate' },
        { injury_date: '2025-04-10', return_date: null, severity: 'severe' },
      ],
      '2025-01-01',
      '2025-05-01',
    );
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r[0]).toMatchObject({ state: 'available', start: '2025-01-01' });
    expect(r.some((s) => s.state === 'injured' && s.severity === 'moderate')).toBe(true);
    expect(r[r.length - 1].end).toBe('2025-05-01');
  });

  it('merges overlapping injuries', () => {
    const r = buildAvailabilityTimeline(
      [
        { injury_date: '2025-02-01', return_date: '2025-02-20' },
        { injury_date: '2025-02-10', return_date: '2025-03-05' },
      ],
      '2025-01-01',
      '2025-04-01',
    );
    const injured = r.filter((s) => s.state === 'injured');
    expect(injured).toHaveLength(1);
    expect(injured[0].start).toBe('2025-02-01');
    expect(injured[0].end).toBe('2025-03-05');
  });
});
