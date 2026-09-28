import { describe, it, expect } from 'vitest';
import {
  buildInitialStateFromFirstHalfStarters,
  applySubstitutionEvent,
  validateSubstitutionEvent,
  reconcileSecondHalfStarters,
  closeAllAtMinute,
  summarisePlayerMinutes,
  runMatchPlayingTime,
  buildPartTimings,
  toEngineEvents,
  type MatchTimeMode,
  type SubstitutionEvent,
  applySubstitutionBatch,
  validateSubstitutionBatch,
} from '@/lib/match-playing-time-engine';
import {
  defaultSubstitutionModeForSport,
  resolveSubstitutionMode,
} from '@/lib/match-substitution-rules';

const f11Mode = (overrides: Partial<MatchTimeMode> = {}): MatchTimeMode => ({
  substitutionMode: 'NO_REENTRY',
  playersOnField: 11,
  parts: buildPartTimings([45, 45], [45, 45]),
  ...overrides,
});

const f7Mode = (overrides: Partial<MatchTimeMode> = {}): MatchTimeMode => ({
  substitutionMode: 'FREE_REENTRY',
  playersOnField: 7,
  parts: buildPartTimings([30, 30], [30, 30]),
  ...overrides,
});

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe('substitution mode resolution', () => {
  it('defaults football_11 to NO_REENTRY and others to FREE_REENTRY', () => {
    expect(defaultSubstitutionModeForSport('football_11')).toBe('NO_REENTRY');
    expect(defaultSubstitutionModeForSport('football_7')).toBe('FREE_REENTRY');
    expect(defaultSubstitutionModeForSport('futsal')).toBe('FREE_REENTRY');
    expect(defaultSubstitutionModeForSport(null)).toBe('FREE_REENTRY');
  });

  it('per-match override beats snapshot beats sport default', () => {
    expect(
      resolveSubstitutionMode({
        matchOverride: 'FREE_REENTRY',
        snapshotMode: 'NO_REENTRY',
        sportType: 'football_11',
      }),
    ).toBe('FREE_REENTRY');
    expect(
      resolveSubstitutionMode({
        snapshotMode: 'NO_REENTRY',
        sportType: 'football_7',
      }),
    ).toBe('NO_REENTRY');
    expect(resolveSubstitutionMode({ sportType: 'football_11' })).toBe('NO_REENTRY');
  });
});

// ─────────────── A. NO_REENTRY ───────────────

describe('NO_REENTRY mode', () => {
  it('A1: starter who plays the whole match gets full minutes', () => {
    const starters = ids(11);
    const { summaries } = runMatchPlayingTime({
      mode: f11Mode(),
      firstHalfStarters: starters,
      events: [],
      matchEndMinute: 90,
    });
    const s = summaries.get('p1')!;
    expect(s.totalRealMinutes).toBe(90);
    expect(s.totalRegulationMinutes).toBe(90);
    expect(s.startedFirstHalf).toBe(true);
  });

  it('A2: starter subbed out once gets minutes up to that minute', () => {
    const starters = ids(11);
    const { summaries } = runMatchPlayingTime({
      mode: f11Mode(),
      firstHalfStarters: starters,
      events: [
        { type: 'OUT', playerId: 'p1', minute: 60 },
        { type: 'IN', playerId: 'p12', minute: 60 },
      ],
      matchEndMinute: 90,
    });
    expect(summaries.get('p1')!.totalRealMinutes).toBe(60);
    expect(summaries.get('p12')!.totalRealMinutes).toBe(30);
  });

  it('A3: reentry is blocked', () => {
    const starters = ids(11);
    let state = buildInitialStateFromFirstHalfStarters(starters, 0, f11Mode());
    state = applySubstitutionEvent(state, { type: 'OUT', playerId: 'p1', minute: 30 });
    state = applySubstitutionEvent(state, { type: 'IN', playerId: 'p12', minute: 30 });

    const validation = validateSubstitutionEvent(state, {
      type: 'IN',
      playerId: 'p1',
      minute: 60,
    });
    expect(validation.allowed).toBe(false);
    expect(validation.reason!.type).toBe('reentry_blocked');
  });

  it('A4: 2H snapshot conflict is flagged when allowHalftimeReset=false', () => {
    const starters = ids(11);
    let state = buildInitialStateFromFirstHalfStarters(
      starters,
      0,
      f11Mode({ allowHalftimeReset: false }),
    );
    state = applySubstitutionEvent(state, { type: 'OUT', playerId: 'p1', minute: 30 });
    state = applySubstitutionEvent(state, { type: 'IN', playerId: 'p12', minute: 30 });
    // 2H snapshot tries to put p1 back on the field.
    const secondHalf = ['p1', ...ids(11).slice(1, 11)];
    state = reconcileSecondHalfStarters(state, secondHalf, 45);
    expect(
      state.inconsistencies.some(i => i.type === 'snapshot_conflict' && i.playerId === 'p1'),
    ).toBe(true);
  });
});

// ─────────────── B. FREE_REENTRY ───────────────

describe('FREE_REENTRY mode', () => {
  it('B5: player can leave and come back once', () => {
    const starters = ids(7);
    const { summaries } = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: starters,
      events: [
        { type: 'OUT', playerId: 'p1', minute: 14 },
        { type: 'IN', playerId: 'p8', minute: 14 },
        { type: 'OUT', playerId: 'p8', minute: 40 },
        { type: 'IN', playerId: 'p1', minute: 40 },
      ],
      matchEndMinute: 60,
    });
    const s = summaries.get('p1')!;
    expect(s.intervals.length).toBe(2);
    expect(s.totalRealMinutes).toBe(14 + (60 - 40));
  });

  it('B6+B7: multiple reentries sum correctly', () => {
    const starters = ids(7);
    const { summaries } = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: starters,
      events: [
        { type: 'OUT', playerId: 'p1', minute: 10 },
        { type: 'IN', playerId: 'p8', minute: 10 },
        { type: 'OUT', playerId: 'p8', minute: 20 },
        { type: 'IN', playerId: 'p1', minute: 20 },
        { type: 'OUT', playerId: 'p1', minute: 35 },
        { type: 'IN', playerId: 'p8', minute: 35 },
        { type: 'OUT', playerId: 'p8', minute: 50 },
        { type: 'IN', playerId: 'p1', minute: 50 },
      ],
      matchEndMinute: 60,
    });
    const s = summaries.get('p1')!;
    // 4 intervals because halftime (30') splits the 20'–35' segment in two.
    expect(s.intervals.length).toBe(4);
    expect(s.totalRealMinutes).toBe(10 + 15 + 10);
  });

  it('B8: cannot enter while already on field', () => {
    const starters = ids(7);
    const state = buildInitialStateFromFirstHalfStarters(starters, 0, f7Mode());
    const v = validateSubstitutionEvent(state, { type: 'IN', playerId: 'p1', minute: 10 });
    expect(v.allowed).toBe(false);
    expect(v.reason!.type).toBe('enter_already_on_field');
  });

  it('B9: cannot leave when not on field', () => {
    const starters = ids(7);
    const state = buildInitialStateFromFirstHalfStarters(starters, 0, f7Mode());
    const v = validateSubstitutionEvent(state, { type: 'OUT', playerId: 'p99', minute: 10 });
    expect(v.allowed).toBe(false);
    expect(v.reason!.type).toBe('leave_not_on_field');
  });
});

// ─────────────── C. RECONCILIATION ───────────────

describe('halftime reconciliation', () => {
  it('C10+C11: 1H starters open intervals; 2H snapshot opens fresh intervals', () => {
    const firstHalf = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const secondHalf = ['a', 'b', 'c', 'd', 'e', 'h', 'i']; // f,g out — h,i in
    const { summaries } = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: firstHalf,
      secondHalfStarters: secondHalf,
      events: [],
      matchEndMinute: 60,
    });
    expect(summaries.get('f')!.totalRealMinutes).toBe(30);
    expect(summaries.get('g')!.totalRealMinutes).toBe(30);
    expect(summaries.get('h')!.totalRealMinutes).toBe(30);
    expect(summaries.get('h')!.startedSecondHalf).toBe(true);
    expect(summaries.get('a')!.totalRealMinutes).toBe(60);
  });

  it('C12: no halftime event still produces correct minutes (snapshot wins)', () => {
    const firstHalf = ids(7);
    const secondHalf = ids(7); // identical → continuation
    const { summaries } = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: firstHalf,
      secondHalfStarters: secondHalf,
      events: [],
      matchEndMinute: 60,
    });
    expect(summaries.get('p1')!.totalRealMinutes).toBe(60);
  });

  it('C13: snapshot conflict in NO_REENTRY is detected', () => {
    const firstHalf = ids(11);
    let state = buildInitialStateFromFirstHalfStarters(firstHalf, 0, f11Mode({ allowHalftimeReset: false }));
    state = applySubstitutionEvent(state, { type: 'OUT', playerId: 'p1', minute: 20 });
    state = applySubstitutionEvent(state, { type: 'IN', playerId: 'p12', minute: 20 });
    state = reconcileSecondHalfStarters(state, ['p1', ...ids(11).slice(1)], 45);
    expect(state.inconsistencies.find(i => i.type === 'snapshot_conflict')).toBeDefined();
  });
});

// ─────────────── D. REAL vs REGULATION ───────────────

describe('real vs regulation minutes', () => {
  it('D14: 31+31 real vs 30+30 regulation are computed separately', () => {
    const mode: MatchTimeMode = {
      substitutionMode: 'FREE_REENTRY',
      playersOnField: 7,
      parts: buildPartTimings([31, 31], [30, 30]),
    };
    const starters = ids(7);
    const { summaries } = runMatchPlayingTime({
      mode,
      firstHalfStarters: starters,
      events: [],
      matchEndMinute: 62,
      halftimeMinute: 31,
    });
    const s = summaries.get('p1')!;
    expect(s.totalRealMinutes).toBe(62);
    expect(s.totalRegulationMinutes).toBe(60);
  });

  it('D16: partial player has correct values in both metrics', () => {
    const mode: MatchTimeMode = {
      substitutionMode: 'FREE_REENTRY',
      playersOnField: 7,
      parts: buildPartTimings([31, 31], [30, 30]),
    };
    const starters = ids(7);
    const { summaries } = runMatchPlayingTime({
      mode,
      firstHalfStarters: starters,
      events: [
        { type: 'OUT', playerId: 'p1', minute: 14 },
        { type: 'IN', playerId: 'p8', minute: 14 },
      ],
      matchEndMinute: 62,
      halftimeMinute: 31,
    });
    const s = summaries.get('p1')!;
    expect(s.totalRealMinutes).toBe(14);
    expect(s.totalRegulationMinutes).toBe(14);
  });
});

// ─────────────── E. BATCHED SUBS ───────────────

describe('batched substitutions', () => {
  it('E17: multiple subs at the same minute are processed (OUT before IN)', () => {
    const starters = ids(7);
    const events: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 20 },
      { type: 'OUT', playerId: 'p2', minute: 20 },
      { type: 'IN', playerId: 'p8', minute: 20 },
      { type: 'IN', playerId: 'p9', minute: 20 },
    ];
    const { state, summaries } = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: starters,
      events,
      matchEndMinute: 60,
    });
    expect(state.inconsistencies).toHaveLength(0);
    expect(summaries.get('p1')!.totalRealMinutes).toBe(20);
    expect(summaries.get('p8')!.totalRealMinutes).toBe(40);
  });

  it('E18+E19: same input → same output (deterministic, batch-friendly)', () => {
    const starters = ids(7);
    const events: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 14 },
      { type: 'IN', playerId: 'p8', minute: 14 },
    ];
    const r1 = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: starters,
      events,
      matchEndMinute: 60,
    });
    const r2 = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: starters,
      events,
      matchEndMinute: 60,
    });
    expect(Array.from(r1.summaries.entries())).toEqual(Array.from(r2.summaries.entries()));
  });
});

// ─────────────── F. INTEGRATION (single source) ───────────────

describe('single-engine consistency', () => {
  it('F24: same inputs always produce same per-player minutes', () => {
    const starters = ids(7);
    const events: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 10 },
      { type: 'IN', playerId: 'p8', minute: 10 },
      { type: 'OUT', playerId: 'p8', minute: 25 },
      { type: 'IN', playerId: 'p1', minute: 25 },
    ];
    const { summaries } = runMatchPlayingTime({
      mode: f7Mode(),
      firstHalfStarters: starters,
      events,
      matchEndMinute: 60,
    });
    expect(summaries.get('p1')!.totalRealMinutes).toBe(45); // 0-10 + 25-60
    expect(summaries.get('p8')!.totalRealMinutes).toBe(15);
  });

  it('toEngineEvents converts legacy match_events shape', () => {
    const raw = [
      { event_type: 'substitution_out', minute: 10, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 10, player_id: 'p8', is_opponent: false },
      { event_type: 'goal', minute: 12, player_id: 'p2', is_opponent: false },
    ];
    const evts = toEngineEvents(raw);
    expect(evts).toHaveLength(2);
    expect(evts[0]).toEqual({ type: 'OUT', playerId: 'p1', minute: 10, second: 0 });
  });

  it('summarisePlayerMinutes ignores still-open intervals (caller must close)', () => {
    const starters = ['p1'];
    let state = buildInitialStateFromFirstHalfStarters(starters, 0, {
      substitutionMode: 'FREE_REENTRY',
      playersOnField: 5,
    });
    expect(summarisePlayerMinutes(state).get('p1')!.totalRealMinutes).toBe(0);
    state = closeAllAtMinute(state, 30);
    expect(summarisePlayerMinutes(state).get('p1')!.totalRealMinutes).toBe(30);
  });
});

describe('substitution batch (same-minute)', () => {
  it('applies multiple OUT/IN at same minute atomically (free reentry)', () => {
    const starters = ids(7);
    let state = buildInitialStateFromFirstHalfStarters(starters, 0, f7Mode());
    const batch: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 15 },
      { type: 'OUT', playerId: 'p2', minute: 15 },
      { type: 'IN', playerId: 'p8', minute: 15 },
      { type: 'IN', playerId: 'p9', minute: 15 },
    ];
    state = applySubstitutionBatch(state, batch, '1H');
    expect(state.inconsistencies).toHaveLength(0);
    expect(state.onFieldNow.has('p1')).toBe(false);
    expect(state.onFieldNow.has('p2')).toBe(false);
    expect(state.onFieldNow.has('p8')).toBe(true);
    expect(state.onFieldNow.has('p9')).toBe(true);
    expect(state.onFieldNow.size).toBe(7);
  });

  it('rejects batch where same player would enter twice', () => {
    const starters = ids(7);
    const state = buildInitialStateFromFirstHalfStarters(starters, 0, f7Mode());
    const batch: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 10 },
      { type: 'OUT', playerId: 'p2', minute: 10 },
      { type: 'IN', playerId: 'p8', minute: 10 },
      { type: 'IN', playerId: 'p8', minute: 10 },
    ];
    const result = validateSubstitutionBatch(state, batch);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.type === 'enter_already_on_field')).toBe(true);
  });

  it('rejects batch that exceeds players-on-field limit', () => {
    const starters = ids(7);
    const state = buildInitialStateFromFirstHalfStarters(starters, 0, f7Mode());
    const batch: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 12 },
      { type: 'IN', playerId: 'p8', minute: 12 },
      { type: 'IN', playerId: 'p9', minute: 12 },
    ];
    const result = validateSubstitutionBatch(state, batch);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.type === 'too_many_on_field')).toBe(true);
  });

  it('rejects reentry inside batch in NO_REENTRY mode', () => {
    let state = buildInitialStateFromFirstHalfStarters(ids(11), 0, f11Mode());
    state = applySubstitutionEvent(state, { type: 'OUT', playerId: 'p1', minute: 30, period: '1H' });
    state = applySubstitutionEvent(state, { type: 'IN', playerId: 'p12', minute: 30, period: '1H' });
    const batch: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p2', minute: 60 },
      { type: 'IN', playerId: 'p1', minute: 60 },
    ];
    const result = validateSubstitutionBatch(state, batch);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.type === 'reentry_blocked')).toBe(true);
  });
});

describe('runMatchPlayingTime multi-pair same-minute substitutions', () => {
  it('counts 2 pairs at the same minute as 4 distinct intervals (second-based ordering)', () => {
    // F7, 2 halves of 25 minutes. Starters p1..p7. At minute 20 of 1H,
    // two substitutions happen in the same batch: p1↔p8 and p2↔p9.
    const starters = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    const events: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 20, second: 0 },
      { type: 'IN', playerId: 'p8', minute: 20, second: 1 },
      { type: 'OUT', playerId: 'p2', minute: 20, second: 2 },
      { type: 'IN', playerId: 'p9', minute: 20, second: 3 },
    ];
    const { summaries } = runMatchPlayingTime({
      mode: { substitutionMode: 'FREE_REENTRY', playersOnField: 7, parts: buildPartTimings([25, 25], [25, 25]) },
      firstHalfStarters: starters,
      events,
      matchEndMinute: 50,
    });
    // Both p1 and p2 should leave at minute 20; both p8 and p9 should enter at minute 20.
    expect(summaries.get('p1')!.totalRealMinutes).toBe(20);
    expect(summaries.get('p2')!.totalRealMinutes).toBe(20);
    expect(summaries.get('p8')!.totalRealMinutes).toBe(30);
    expect(summaries.get('p9')!.totalRealMinutes).toBe(30);
  });

  it('handles same-minute pairs even when second is missing (defence in depth)', () => {
    const starters = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    const events: SubstitutionEvent[] = [
      { type: 'OUT', playerId: 'p1', minute: 20 },
      { type: 'IN', playerId: 'p8', minute: 20 },
      { type: 'OUT', playerId: 'p2', minute: 20 },
      { type: 'IN', playerId: 'p9', minute: 20 },
    ];
    const { summaries } = runMatchPlayingTime({
      mode: { substitutionMode: 'FREE_REENTRY', playersOnField: 7, parts: buildPartTimings([25, 25], [25, 25]) },
      firstHalfStarters: starters,
      events,
      matchEndMinute: 50,
    });
    expect(summaries.get('p1')!.totalRealMinutes).toBe(20);
    expect(summaries.get('p2')!.totalRealMinutes).toBe(20);
    expect(summaries.get('p8')!.totalRealMinutes).toBe(30);
    expect(summaries.get('p9')!.totalRealMinutes).toBe(30);
  });
});

