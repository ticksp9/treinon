/**
 * Regression tests for bugs reported during the 2025/26 field-test season.
 */
import { describe, it, expect } from 'vitest';
import {
  computeMatchPlayerStatsWithHalves,
  checkMatchConsistency,
  type MatchEventForCalc,
} from '@/lib/match-playing-time';

const P = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
const BENCH = ['b1', 'b2'];

function sub(minute: number, out: string, inn: string, second = 0): MatchEventForCalc[] {
  return [
    { event_type: 'substitution_out', minute, second, player_id: out, is_opponent: false } as MatchEventForCalc,
    { event_type: 'substitution_in', minute, second, player_id: inn, is_opponent: false } as MatchEventForCalc,
  ];
}

describe('F7 half-time change followed by a 2nd-half substitution', () => {
  // Part 1: p1..p7. At half-time b1 replaces p1 (lineup change, no event).
  // Minute 40 (15' into the 2nd half of 25'): b1 OUT, p1 IN.
  const lineups = [...P, ...BENCH].map(id => ({ player_id: id, is_starter: P.includes(id) }));
  const partStarters = { '1': P, '2': ['b1', ...P.slice(1)] };
  const events = sub(40, 'b1', 'p1');

  const stats = computeMatchPlayerStatsWithHalves(lineups, events, 50, [25, 25], 'football_7', {
    partStarters,
    secondHalfStarters: partStarters['2'],
    regulationPartMinutes: [25, 25],
    numberOfParts: 2,
  });
  const byId = new Map(stats.map(s => [s.playerId, s.totalMinutes]));

  it('does not invert a correct substitution', () => {
    expect(byId.get('p1')).toBe(25 + 10);
    expect(byId.get('b1')).toBe(15);
  });

  it('keeps everyone else at full time', () => {
    expect(byId.get('p2')).toBe(50);
    expect(byId.get('b2')).toBe(0);
  });
});

describe('consistency check uses part snapshots', () => {
  it('does not flag a valid 2nd-half substitution after a half-time change', () => {
    const lineups = [...P, ...BENCH].map(id => ({ player_id: id, is_starter: P.includes(id) }));
    const issues = checkMatchConsistency(lineups, sub(40, 'b1', 'p1'), 50, 'football_7', {
      partStarters: { '1': P, '2': ['b1', ...P.slice(1)] },
      realPartMinutes: [25, 25],
    });
    expect(issues.filter(i => i.type === 'error')).toEqual([]);
  });
});
