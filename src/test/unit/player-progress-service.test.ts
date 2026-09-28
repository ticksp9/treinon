import { describe, it, expect } from 'vitest';
import {
  aggregateBySeason,
  utilizationPercent,
  recentMatchSequence,
  type MatchUsageRow,
  type CalledUpMatchRow,
  type TrainingAttendanceRow,
} from '@/lib/player-progress-service';

describe('player-progress-service', () => {
  it('aggregates per season including starters/subs and minutes', () => {
    const played: MatchUsageRow[] = [
      { match_id: 'm1', match_date: '2025-09-10', season: '2025/26', is_starter: true, minutes_played: 60 },
      { match_id: 'm2', match_date: '2025-10-10', season: '2025/26', is_starter: false, minutes_played: 25 },
      { match_id: 'm3', match_date: '2024-11-10', season: '2024/25', is_starter: true, minutes_played: 80 },
    ];
    const called: CalledUpMatchRow[] = [
      ...played.map((p) => ({ match_id: p.match_id, match_date: p.match_date, season: p.season ?? null })),
      { match_id: 'm4', match_date: '2025-11-01', season: '2025/26' }, // called but not used
    ];
    const trainings: TrainingAttendanceRow[] = [
      { session_id: 's1', session_date: '2025-09-01', season: '2025/26', present: true },
      { session_id: 's2', session_date: '2025-09-08', season: '2025/26', present: false },
    ];

    const agg = aggregateBySeason({ played, called, trainings });
    const cur = agg.find((a) => a.season === '2025/26')!;
    expect(cur.gamesPlayed).toBe(2);
    expect(cur.gamesStarted).toBe(1);
    expect(cur.gamesAsSub).toBe(1);
    expect(cur.minutesTotal).toBe(85);
    expect(cur.avgMinutes).toBe(43);
    expect(cur.gamesCalledNotPlayed).toBe(1);
    expect(cur.trainingsTotal).toBe(2);
    expect(cur.trainingsAttended).toBe(1);
    expect(cur.attendanceRate).toBe(50);

    const old = agg.find((a) => a.season === '2024/25')!;
    expect(old.gamesPlayed).toBe(1);
  });

  it('utilizationPercent handles zero divisions', () => {
    expect(
      utilizationPercent({
        season: 'x',
        gamesPlayed: 0,
        gamesStarted: 0,
        gamesAsSub: 0,
        gamesCalledNotPlayed: 0,
        minutesTotal: 0,
        avgMinutes: 0,
        trainingsTotal: 0,
        trainingsAttended: 0,
        attendanceRate: 0,
      }),
    ).toBe(0);
  });

  it('utilizationPercent computes ratio', () => {
    expect(
      utilizationPercent({
        season: 'x',
        gamesPlayed: 7,
        gamesStarted: 4,
        gamesAsSub: 3,
        gamesCalledNotPlayed: 3,
        minutesTotal: 0,
        avgMinutes: 0,
        trainingsTotal: 0,
        trainingsAttended: 0,
        attendanceRate: 0,
      }),
    ).toBe(70);
  });

  it('recentMatchSequence returns most recent first', () => {
    const rows: MatchUsageRow[] = [
      { match_id: 'a', match_date: '2025-01-01', is_starter: true, minutes_played: 10 },
      { match_id: 'b', match_date: '2025-03-01', is_starter: true, minutes_played: 10 },
      { match_id: 'c', match_date: '2025-02-01', is_starter: true, minutes_played: 10 },
    ];
    const seq = recentMatchSequence(rows, 2);
    expect(seq.map((r) => r.match_id)).toEqual(['b', 'c']);
  });

  it('returns empty when no data', () => {
    expect(aggregateBySeason({ played: [], called: [], trainings: [] })).toEqual([]);
  });
});
