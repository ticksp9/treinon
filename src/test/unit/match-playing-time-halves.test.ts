import { describe, it, expect } from 'vitest';
import {
  runMatchPlayingTime,
  buildPartTimings,
  type MatchTimeMode,
} from '@/lib/match-playing-time-engine';
import {
  computeMatchPlayerStatsWithHalves,
  type StarterInfo,
  type MatchEventForCalc,
} from '@/lib/match-playing-time';

const f7Mode = (overrides: Partial<MatchTimeMode> = {}): MatchTimeMode => ({
  substitutionMode: 'FREE_REENTRY',
  playersOnField: 7,
  parts: buildPartTimings([30, 30], [30, 30]),
  ...overrides,
});

const f11Mode = (): MatchTimeMode => ({
  substitutionMode: 'NO_REENTRY',
  playersOnField: 11,
  parts: buildPartTimings([45, 45], [45, 45]),
});

const ids = (n: number, prefix = 'p') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

describe('per-half engine summaries', () => {
  it('A. starter who plays both halves gets 1H + 2H breakdown', () => {
    const { summaries } = runMatchPlayingTime({
      mode: f11Mode(),
      firstHalfStarters: ids(11),
      events: [],
      matchEndMinute: 90,
    });
    const s = summaries.get('p1')!;
    expect(s.firstHalfRealMinutes).toBe(45);
    expect(s.secondHalfRealMinutes).toBe(45);
    expect(s.totalRealMinutes).toBe(90);
    expect(s.playedFirstHalf).toBe(true);
    expect(s.playedSecondHalf).toBe(true);
  });

  it('B. player who ends 1H on field but is NOT a 2H starter has interval closed at halftime', () => {
    const starters = ids(11);
    const secondHalf = ['p12', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11']; // p12 replaces p1
    const { summaries } = runMatchPlayingTime({
      mode: f11Mode(),
      firstHalfStarters: starters,
      secondHalfStarters: secondHalf,
      events: [],
      matchEndMinute: 90,
      halftimeMinute: 45,
    });
    const p1 = summaries.get('p1')!;
    expect(p1.firstHalfRealMinutes).toBe(45);
    expect(p1.secondHalfRealMinutes).toBe(0);
    expect(p1.playedSecondHalf).toBe(false);

    const p12 = summaries.get('p12')!;
    expect(p12.firstHalfRealMinutes).toBe(0);
    expect(p12.secondHalfRealMinutes).toBe(45);
    expect(p12.startedSecondHalf).toBe(true);
  });

  it('C. FREE_REENTRY: player out 1H + back in 2H sums both stints', () => {
    const starters = ids(7);
    const events = [
      { type: 'OUT' as const, playerId: 'p1', minute: 14 },
      { type: 'IN' as const, playerId: 'p8', minute: 14 },
      { type: 'OUT' as const, playerId: 'p8', minute: 35 },
      { type: 'IN' as const, playerId: 'p1', minute: 35 },
    ];
    const { summaries } = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: starters,
      events,
      matchEndMinute: 60,
      halftimeMinute: 30,
    });
    const p1 = summaries.get('p1')!;
    // 0-14 in 1H = 14, 35-60 in 2H = 25
    expect(p1.firstHalfRealMinutes).toBe(14);
    expect(p1.secondHalfRealMinutes).toBe(25);
    expect(p1.totalRealMinutes).toBe(39);
  });

  it('D. real minutes can exceed regulation when half ran long', () => {
    const mode: MatchTimeMode = {
      substitutionMode: 'FREE_REENTRY',
      playersOnField: 7,
      parts: buildPartTimings([31, 31], [30, 30]),
    };
    const { summaries } = runMatchPlayingTime({
      mode,
      firstHalfStarters: ids(7),
      events: [],
      matchEndMinute: 62,
      halftimeMinute: 31,
    });
    const p = summaries.get('p1')!;
    expect(p.firstHalfRealMinutes).toBe(31);
    expect(p.firstHalfRegulationMinutes).toBe(30);
    expect(p.totalRealMinutes).toBe(62);
    expect(p.totalRegulationMinutes).toBe(60);
  });
});

describe('computeMatchPlayerStatsWithHalves wrapper', () => {
  it('threads secondHalfStarters and partMinutes correctly', () => {
    const lineups: StarterInfo[] = ids(7).map(id => ({ player_id: id, is_starter: true }))
      .concat([{ player_id: 'p8', is_starter: false }]);
    const events: MatchEventForCalc[] = [];
    const stats = computeMatchPlayerStatsWithHalves(
      lineups,
      events,
      60,
      [30, 30],
      'football_7',
      { secondHalfStarters: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p8'] },
    );
    const p7 = stats.find(s => s.playerId === 'p7')!;
    // p7 was a starter in 1H but not in 2H snapshot → only 1H minutes
    expect(p7.firstHalfMinutes).toBe(30);
    expect(p7.secondHalfMinutes).toBe(0);
    const p8 = stats.find(s => s.playerId === 'p8')!;
    expect(p8.firstHalfMinutes).toBe(0);
    expect(p8.secondHalfMinutes).toBe(30);
    expect(p8.startedSecondHalf).toBe(true);
  });
});
