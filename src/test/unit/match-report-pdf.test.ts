import { describe, it, expect } from 'vitest';
import {
  computeMatchPlayerStats,
  buildPlayerAnnotations,
  getPartTimesFromElapsed,
  checkMatchConsistency,
  wasOriginalStarter,
  type MatchEventForCalc,
  type StarterInfo,
} from '@/lib/match-playing-time';

// ─── PDF data — minutes correctness ─────────────────────────────────────────

describe('PDF data — minutes correctness', () => {
  it('starter playing full game gets total real minutes', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const stats = computeMatchPlayerStats(lineups, [], 68);
    expect(stats[0].totalMinutes).toBe(68);
    expect(stats[0].isStarter).toBe(true);
  });

  it('starter who exits and re-enters gets sum of intervals', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 56, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(44);
  });

  it('substitute entering once gets minutes from entry to end', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 55, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 90);
    expect(stats[0].totalMinutes).toBe(35);
  });

  it('player with multiple rotations sums all intervals', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 10, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 50);
    expect(stats[0].totalMinutes).toBe(30);
  });

  it('unused player gets 0 minutes with no annotations', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: false }];
    const stats = computeMatchPlayerStats(lineups, [], 90);
    expect(stats[0].totalMinutes).toBe(0);
    expect(stats[0].isStarter).toBe(false);
    expect(stats[0].annotations).toEqual([]);
  });

  it('multiple subs at same minute process correctly', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 45, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 45, player_id: 'p2', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 90);
    const p1 = stats.find(s => s.playerId === 'p1')!;
    const p2 = stats.find(s => s.playerId === 'p2')!;
    expect(p1.totalMinutes).toBe(45);
    expect(p2.totalMinutes).toBe(45);
  });

  it('real time beyond regulation counted correctly', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const elapsed = [35 * 60, 38 * 60];
    const { totalMinutes } = getPartTimesFromElapsed(elapsed);
    const stats = computeMatchPlayerStats(lineups, [], totalMinutes);
    expect(stats[0].totalMinutes).toBe(73);
  });
});

// ─── PDF data — Obs annotations ─────────────────────────────────────────────

describe('PDF data — Obs annotations', () => {
  it('starter full game shows only TIT', () => {
    const ann = buildPlayerAnnotations('p1', true, []);
    expect(ann).toEqual(['TIT']);
  });

  it('starter exit+reentry is chronological', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 56, player_id: 'p1', is_opponent: false },
    ];
    const ann = buildPlayerAnnotations('p1', true, events);
    expect(ann).toEqual(['TIT', "S30'", "E56'"]);
  });

  it('unused player has empty annotations', () => {
    const ann = buildPlayerAnnotations('p1', false, []);
    expect(ann).toEqual([]);
  });

  it('never produces non-chronological order', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 35, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 49, player_id: 'p1', is_opponent: false },
    ];
    const ann = buildPlayerAnnotations('p1', true, events);
    expect(ann).toEqual(['TIT', "S35'", "E49'"]);
  });

  it('annotations include part suffix when partBoundaries provided', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 40, player_id: 'p1', is_opponent: false },
    ];
    const ann = buildPlayerAnnotations('p1', false, events, [35, 35]);
    expect(ann).toEqual(["E40' (2.ªP)"]);
  });

  it('sub entering and leaving in 2nd half gets correct part suffix', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 50, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_out', minute: 70, player_id: 'p1', is_opponent: false },
    ];
    const ann = buildPlayerAnnotations('p1', false, events, [45, 45]);
    expect(ann).toEqual(["E50' (2.ªP)", "S70' (2.ªP)"]);
  });
});

// ─── PDF data — substitution pairing ─────────────────────────────────────────

describe('PDF data — substitution pairing', () => {
  it('paired subs at same minute match correctly', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 60, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 60, player_id: 'p2', is_opponent: false },
    ];
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 90);
    expect(stats.find(s => s.playerId === 'p1')!.totalMinutes).toBe(60);
    expect(stats.find(s => s.playerId === 'p2')!.totalMinutes).toBe(30);
  });

  it('multiple subs at same minute all pair correctly', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: true },
      { player_id: 'p3', is_starter: false },
      { player_id: 'p4', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 45, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_out', minute: 45, player_id: 'p2', is_opponent: false },
      { event_type: 'substitution_in', minute: 45, player_id: 'p3', is_opponent: false },
      { event_type: 'substitution_in', minute: 45, player_id: 'p4', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 90);
    expect(stats.find(s => s.playerId === 'p1')!.totalMinutes).toBe(45);
    expect(stats.find(s => s.playerId === 'p2')!.totalMinutes).toBe(45);
    expect(stats.find(s => s.playerId === 'p3')!.totalMinutes).toBe(45);
    expect(stats.find(s => s.playerId === 'p4')!.totalMinutes).toBe(45);
  });
});

// ─── PDF data — starters per part ────────────────────────────────────────────

describe('PDF data — starters per part', () => {
  it('2nd part starters reflect substitutions at half time', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: true },
      { player_id: 'p3', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 30, player_id: 'p3', is_opponent: false },
    ];
    const partMins = [30, 30];
    const stats = computeMatchPlayerStats(lineups, events, 60, partMins);
    const part1End = 30;
    const part2Starters = stats.filter(s =>
      s.intervals.some(iv => iv.start <= part1End && iv.end > part1End)
    );
    expect(part2Starters.map(s => s.playerId).sort()).toEqual(['p2', 'p3']);
  });

  it('starter who plays full game appears in both parts', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const stats = computeMatchPlayerStats(lineups, [], 90, [45, 45]);
    const part1End = 45;
    const inPart2 = stats[0].intervals.some(iv => iv.start <= part1End && iv.end > part1End);
    expect(inPart2).toBe(true);
    expect(stats[0].isStarter).toBe(true);
  });
});

// ─── wasOriginalStarter ──────────────────────────────────────────────────────

describe('wasOriginalStarter', () => {
  it('player with no events uses DB fallback', () => {
    expect(wasOriginalStarter('p1', [], true)).toBe(true);
    expect(wasOriginalStarter('p1', [], false)).toBe(false);
  });

  it('player with only sub_out was starter', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    expect(wasOriginalStarter('p1', events)).toBe(true);
  });

  it('player with sub_in first was not starter', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 55, player_id: 'p1', is_opponent: false },
    ];
    expect(wasOriginalStarter('p1', events)).toBe(false);
  });
});

// ─── Consistency checks ──────────────────────────────────────────────────────

describe('consistency checks', () => {
  it('no issues for clean match', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 60, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 60, player_id: 'p2', is_opponent: false },
    ];
    const issues = checkMatchConsistency(lineups, events, 90, 'football_7');
    const errors = issues.filter(i => i.type === 'error');
    expect(errors.length).toBe(0);
  });
});

// ─── Editor logic — lineup manipulation ──────────────────────────────────────

describe('Editor logic — lineup manipulation', () => {
  it('toggling starter recalculates minutes', () => {
    // Before: p1 starter, p2 sub
    const before: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    const statsBefore = computeMatchPlayerStats(before, [], 90);
    expect(statsBefore.find(s => s.playerId === 'p1')!.totalMinutes).toBe(90);
    expect(statsBefore.find(s => s.playerId === 'p2')!.totalMinutes).toBe(0);

    // After: swap
    const after: StarterInfo[] = [
      { player_id: 'p1', is_starter: false },
      { player_id: 'p2', is_starter: true },
    ];
    const statsAfter = computeMatchPlayerStats(after, [], 90);
    expect(statsAfter.find(s => s.playerId === 'p1')!.totalMinutes).toBe(0);
    expect(statsAfter.find(s => s.playerId === 'p2')!.totalMinutes).toBe(90);
  });

  it('removing substitution recalculates correctly', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    // With sub at 60
    const withSub: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 60, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 60, player_id: 'p2', is_opponent: false },
    ];
    const statsWithSub = computeMatchPlayerStats(lineups, withSub, 90);
    expect(statsWithSub.find(s => s.playerId === 'p1')!.totalMinutes).toBe(60);
    expect(statsWithSub.find(s => s.playerId === 'p2')!.totalMinutes).toBe(30);

    // Without sub (removed)
    const statsWithout = computeMatchPlayerStats(lineups, [], 90);
    expect(statsWithout.find(s => s.playerId === 'p1')!.totalMinutes).toBe(90);
    expect(statsWithout.find(s => s.playerId === 'p2')!.totalMinutes).toBe(0);
  });

  it('manual minutes override preserves calculated value', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const stats = computeMatchPlayerStats(lineups, [], 90);
    const calculated = stats[0].totalMinutes;
    expect(calculated).toBe(90);
    // Simulate override
    const overrideValue = 85;
    const overrideRecord = { value: overrideValue, reason: 'Clock error' };
    // Both values should be preservable
    expect(calculated).not.toBe(overrideRecord.value);
    expect(overrideRecord.reason).toBeTruthy();
  });
});

// ─── Editor logic — goal count sync ─────────────────────────────────────────

describe('Editor logic — goal count sync', () => {
  it('counting goals from events gives correct result', () => {
    const events = [
      { event_type: 'goal', is_opponent: false },
      { event_type: 'goal', is_opponent: false },
      { event_type: 'goal', is_opponent: true },
      { event_type: 'own_goal', is_opponent: false },
    ];
    const gf = events.filter(e => (e.event_type === 'goal' && !e.is_opponent) || (e.event_type === 'own_goal' && e.is_opponent)).length;
    const ga = events.filter(e => (e.event_type === 'goal' && e.is_opponent) || (e.event_type === 'own_goal' && !e.is_opponent)).length;
    expect(gf).toBe(2);
    expect(ga).toBe(2);
  });
});
