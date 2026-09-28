/**
 * Regression tests for bugs reported during the 2025/26 field-test season.
 */
import { describe, it, expect } from 'vitest';
import {
  computeMatchPlayerStatsWithHalves,
  checkMatchConsistency,
  type MatchEventForCalc,
} from '@/lib/match-playing-time';
import {
  canPlayerPlayInCategory,
  getSeasonStartYear,
  getSportingAge,
  getSuggestedCategory,
  parseCalendarDate,
} from '@/lib/constants';
import { alignAgeGroupsToSeason, resolveAgeGroupForPlayer, type AgeGroupRule } from '@/lib/age-group-rules';
import { buildClubProposals, type TransitionSource } from '@/lib/season-roster-service';

describe('season and age groups', () => {
  it('season starts in July', () => {
    expect(getSeasonStartYear(new Date(2026, 8, 28))).toBe(2026);
    expect(getSeasonStartYear(new Date(2027, 2, 1))).toBe(2026);
    expect(getSeasonStartYear(new Date(2026, 5, 30))).toBe(2025);
  });

  it('sporting age depends on birth year only (federation rule)', () => {
    expect(getSportingAge('2014-12-31', 2026)).toBe(12);
    expect(getSportingAge('2014-01-01', 2026)).toBe(12);
    expect(getSuggestedCategory('2014-06-01', 2026)?.value).toBe('Sub-13');
    expect(getSuggestedCategory('2013-02-01', 2026)?.value).toBe('Sub-14');
  });

  it('rejects a one-year-over player between September and December', () => {
    // Born Feb 2013 in 2026/27 is Sub-14: must not be eligible for Sub-13
    expect(canPlayerPlayInCategory('2013-02-01', 'Sub-13', 'male', false, new Date(2026, 9, 1)).eligible).toBe(false);
  });

  it('eligibility does not change in January (same season)', () => {
    const oct = canPlayerPlayInCategory('2014-03-01', 'Sub-13', 'male', false, new Date(2026, 9, 1)).eligible;
    const jan = canPlayerPlayInCategory('2014-03-01', 'Sub-13', 'male', false, new Date(2027, 0, 15)).eligible;
    expect(oct).toBe(true);
    expect(jan).toBe(true);
  });

  it('parses DB dates as calendar dates', () => {
    expect(parseCalendarDate('2014-01-01')!.getFullYear()).toBe(2014);
    expect(parseCalendarDate('2014-01-01')!.getDate()).toBe(1);
  });

  // Windows still configured for 2025/26 (nobody updated them in the summer)
  const stale: AgeGroupRule[] = [
    { id: 'sub13', code: 'SUB13', name: 'Infantis', min_birth_year: 2013, max_birth_year: 2014, display_order: 1, is_active: true },
    { id: 'sub15', code: 'SUB15', name: 'Iniciados', min_birth_year: 2011, max_birth_year: 2012, display_order: 2, is_active: true },
    { id: 'sen', code: 'SEN', name: 'Seniores', min_birth_year: null, max_birth_year: 2006, display_order: 9, is_active: true },
  ];

  it('aligns numbered age groups to the target season', () => {
    const aligned = alignAgeGroupsToSeason(stale, 2026);
    expect(aligned[0]).toMatchObject({ min_birth_year: 2014, max_birth_year: 2015 });
    expect(aligned[1]).toMatchObject({ min_birth_year: 2012, max_birth_year: 2013 });
    expect(aligned[2]).toEqual(stale[2]); // no age number → untouched
  });

  it('promotes players in the 2026/27 transition even with stale windows', () => {
    const res = resolveAgeGroupForPlayer('2013-05-10', '2026-12-31', stale);
    expect(res.ageGroup?.id).toBe('sub15');
    const source: TransitionSource = {
      ageGroups: stale,
      teams: [],
      players: [
        { player_id: 'a', name: 'A', birth_date: '2013-05-10', team_id: null, team_name: null, age_group_id: 'sub13', status: 'active' },
        { player_id: 'b', name: 'B', birth_date: '2014-05-10', team_id: null, team_name: null, age_group_id: 'sub13', status: 'active' },
      ],
    };
    const rows = buildClubProposals(source, '2026-12-31');
    expect(rows.find(r => r.player_id === 'a')!.action).toBe('promotes');
    expect(rows.find(r => r.player_id === 'b')!.action).toBe('stays');
  });
});

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
