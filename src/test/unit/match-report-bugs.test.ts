import { describe, it, expect } from 'vitest';
import {
  computePlayerIntervals,
  sumIntervalMinutes,
  buildPlayerAnnotations,
  computeMatchPlayerStats,
  validateReentry,
  validateSubstitutionAttempt,
  checkMatchConsistency,
  wasOriginalStarter,
  type MatchEventForCalc,
  type StarterInfo,
} from '@/lib/match-playing-time';

describe('Bug fixes — interval-based minutes', () => {
  // BUG 1: Multiple intervals must all be summed
  it('sums all intervals for player with multiple stints (F7 reentry)', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 10, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 50);
    // Intervals: 0-10 (10), 20-30 (10), 40-50 (10) = 30 min
    expect(stats[0].totalMinutes).toBe(30);
    expect(stats[0].intervals).toHaveLength(3);
  });

  it('starter who exits and re-enters gets correct total', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 15, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 35, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    // 0-15 (15) + 35-60 (25) = 40
    expect(stats[0].totalMinutes).toBe(40);
  });

  it('bench player with two stints', () => {
    const lineups: StarterInfo[] = [{ player_id: 'b1', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 5, player_id: 'b1', is_opponent: false },
      { event_type: 'substitution_out', minute: 20, player_id: 'b1', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'b1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 50);
    // 5-20 (15) + 40-50 (10) = 25
    expect(stats[0].totalMinutes).toBe(25);
  });
});

describe('Bug fixes — substitution validation', () => {
  // BUG 2: Entry without exit must be blocked when at max
  it('blocks entry without exit when team is at max (F7)', () => {
    const onField = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    const result = validateSubstitutionAttempt({
      playerOutId: null,
      playerInId: 'p8',
      currentOnFieldIds: onField,
      events: [],
      sportType: 'football_7',
    });
    expect(result.allowed).toBe(false);
  });

  it('blocks reentry in football_11', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'football_11');
    expect(result.allowed).toBe(false);
  });

  it('allows reentry in football_7', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'football_7');
    expect(result.allowed).toBe(true);
  });

  it('allows reentry in football_9', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'football_9');
    expect(result.allowed).toBe(true);
  });

  it('allows reentry in futsal', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'futsal');
    expect(result.allowed).toBe(true);
  });

  it('blocks duplicate player on field', () => {
    const result = validateSubstitutionAttempt({
      playerOutId: 'p1',
      playerInId: 'p2',
      currentOnFieldIds: ['p1', 'p2', 'p3'],
      events: [],
      sportType: 'football_7',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('já está em campo');
  });

  it('blocks exit of player not on field', () => {
    const result = validateSubstitutionAttempt({
      playerOutId: 'p99',
      playerInId: 'p8',
      currentOnFieldIds: ['p1', 'p2'],
      events: [],
      sportType: 'football_7',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('não está em campo');
  });
});

describe('Bug fixes — Obs field coherence', () => {
  it('generates chronological Obs for starter who exits and re-enters', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 48, player_id: 'p1', is_opponent: false },
    ];
    const annotations = buildPlayerAnnotations('p1', true, events);
    expect(annotations).toEqual(['TIT', "S20'", "E48'"]);
  });

  it('generates correct Obs for bench player entering once', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 55, player_id: 'p1', is_opponent: false },
    ];
    const annotations = buildPlayerAnnotations('p1', false, events);
    expect(annotations).toEqual(["E55'"]);
  });

  it('generates correct Obs for player with multiple rotations', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_out', minute: 40, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 55, player_id: 'p1', is_opponent: false },
    ];
    const annotations = buildPlayerAnnotations('p1', true, events);
    expect(annotations).toEqual(['TIT', "S20'", "E30'", "S40'", "E55'"]);
    // Verify chronological order
    const minutes = annotations.slice(1).map(a => parseInt(a.replace(/[ES']/g, '')));
    for (let i = 1; i < minutes.length; i++) {
      expect(minutes[i]).toBeGreaterThanOrEqual(minutes[i - 1]);
    }
  });

  it('never produces impossible sequence like TIT, E49, S35', () => {
    // This tests that annotations are always chronological
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 35, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 49, player_id: 'p1', is_opponent: false },
    ];
    const annotations = buildPlayerAnnotations('p1', true, events);
    // Must be TIT, S35', E49' — never TIT, E49', S35'
    expect(annotations).toEqual(['TIT', "S35'", "E49'"]);
  });
});

describe('Bug fixes — real time beyond regulation', () => {
  it('player minutes can exceed regulation when real time is longer', () => {
    const lineups: StarterInfo[] = [{ player_id: 'gk', is_starter: true }];
    const events: MatchEventForCalc[] = [];
    // Regulation: 2x30 = 60, but real time was 68 due to stoppages
    const stats = computeMatchPlayerStats(lineups, events, 68);
    expect(stats[0].totalMinutes).toBe(68);
  });

  it('consistency check allows time up to real match end', () => {
    const lineups: StarterInfo[] = [{ player_id: 'gk', is_starter: true }];
    const events: MatchEventForCalc[] = [];
    // Real match end = 68 (beyond regulation 60)
    const issues = checkMatchConsistency(lineups, events, 68, 'football_7');
    const timeErrors = issues.filter(i => i.message.includes('min'));
    expect(timeErrors).toHaveLength(0);
  });
});

describe('Bug fixes — wasOriginalStarter', () => {
  it('identifies original starter correctly when is_starter was toggled', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    // After sub, DB has is_starter=false, but player was original starter
    expect(wasOriginalStarter('p1', events, false)).toBe(true);
  });

  it('identifies bench player who entered as non-starter', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 30, player_id: 'p2', is_opponent: false },
    ];
    expect(wasOriginalStarter('p2', events, true)).toBe(false);
  });

  it('bench player with no events uses DB fallback', () => {
    expect(wasOriginalStarter('p3', [], false)).toBe(false);
    expect(wasOriginalStarter('p3', [], true)).toBe(true);
  });
});

describe('Bug fixes — consistency checks', () => {
  it('detects excess starters for F7', () => {
    const lineups: StarterInfo[] = Array.from({ length: 8 }, (_, i) => ({
      player_id: `p${i}`,
      is_starter: true,
    }));
    const issues = checkMatchConsistency(lineups, [], 50, 'football_7');
    expect(issues.some(i => i.type === 'error' && i.message.includes('8'))).toBe(true);
  });

  it('detects sub out of player not on field', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'p2', is_opponent: false },
    ];
    const issues = checkMatchConsistency(lineups, events, 50, 'football_7');
    expect(issues.some(i => i.type === 'error' && i.message.includes('sem estar em campo'))).toBe(true);
  });

  it('detects reentry violation in F11', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'p1', is_opponent: false },
    ];
    const issues = checkMatchConsistency(lineups, events, 80, 'football_11');
    expect(issues.some(i => i.type === 'error' && i.message.includes('Reentrada'))).toBe(true);
  });

  it('allows reentry in F7 with no error', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 20, player_id: 'p2', is_opponent: false },
      { event_type: 'substitution_out', minute: 40, player_id: 'p2', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'p1', is_opponent: false },
    ];
    const issues = checkMatchConsistency(lineups, events, 50, 'football_7');
    const reentryErrors = issues.filter(i => i.message.includes('Reentrada'));
    expect(reentryErrors).toHaveLength(0);
  });
});
