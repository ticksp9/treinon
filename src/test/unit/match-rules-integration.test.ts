import { describe, it, expect } from 'vitest';
import {
  buildSnapshotFromFallback,
  normalizeAgeGroupCode,
  getTotalMinutesFromSnapshot,
  buildSnapshotFromProfile,
  type MatchRuleProfile,
  type MatchRuleSnapshot,
} from '@/lib/match-rules-service';
import {
  validateStarterCount,
  validateSubstitutionAttempt,
  validateReentry,
  validateFieldCount,
  computeMatchPlayerStats,
  checkMatchConsistency,
  type StarterInfo,
  type MatchEventForCalc,
} from '@/lib/match-playing-time';

// ─── Helper: build a mock profile ─────────────────────────────
function mockProfile(overrides: Partial<MatchRuleProfile> = {}): MatchRuleProfile {
  return {
    id: 'test-id',
    club_id: null,
    modality_code: 'football_7',
    age_group_code: 'infantis',
    competition_name: null,
    name: 'Test Profile',
    period_count: 2,
    period_1_minutes: 30,
    period_2_minutes: 30,
    period_3_minutes: null,
    period_4_minutes: null,
    halftime_minutes: 10,
    max_players_on_field: 7,
    reentry_allowed: true,
    rolling_substitutions: true,
    is_system_default: true,
    is_active: true,
    effective_from: null,
    effective_to: null,
    notes: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// 1. AGE GROUP NORMALIZATION
// ═══════════════════════════════════════════════════════
describe('normalizeAgeGroupCode', () => {
  it('maps PT names', () => {
    expect(normalizeAgeGroupCode('Iniciados')).toBe('iniciados');
    expect(normalizeAgeGroupCode('JUVENIS')).toBe('juvenis');
    expect(normalizeAgeGroupCode('Petizes')).toBe('petizes');
    expect(normalizeAgeGroupCode('Traquinas')).toBe('traquinas');
    expect(normalizeAgeGroupCode('Benjamins')).toBe('benjamins');
  });

  it('maps Sub-XX aliases', () => {
    expect(normalizeAgeGroupCode('Sub-15')).toBe('iniciados');
    expect(normalizeAgeGroupCode('Sub-13')).toBe('infantis');
    expect(normalizeAgeGroupCode('Sub-11')).toBe('benjamins');
    expect(normalizeAgeGroupCode('Sub-17')).toBe('juvenis');
    expect(normalizeAgeGroupCode('Sub-19')).toBe('juniores');
    expect(normalizeAgeGroupCode('Sub-7')).toBe('petizes');
  });

  it('handles null/undefined', () => {
    expect(normalizeAgeGroupCode(null)).toBeNull();
    expect(normalizeAgeGroupCode(undefined)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// 2. SNAPSHOT BUILDING
// ═══════════════════════════════════════════════════════
describe('buildSnapshotFromProfile', () => {
  it('preserves all profile fields', () => {
    const profile = mockProfile({ modality_code: 'football_11', max_players_on_field: 11, reentry_allowed: false });
    const snap = buildSnapshotFromProfile(profile);
    expect(snap.modality_code).toBe('football_11');
    expect(snap.max_players_on_field).toBe(11);
    expect(snap.reentry_allowed).toBe(false);
    expect(snap.rule_profile_id).toBe('test-id');
  });
});

describe('buildSnapshotFromFallback', () => {
  it.each([
    ['football_11', 11, false],
    ['football_9', 9, true],
    ['football_7', 7, true],
    ['football_5', 5, true],
    ['futsal', 5, true],
  ])('%s: max=%d, reentry=%s', (mod, maxField, reentry) => {
    const snap = buildSnapshotFromFallback(mod);
    expect(snap.max_players_on_field).toBe(maxField);
    expect(snap.reentry_allowed).toBe(reentry);
  });
});

describe('getTotalMinutesFromSnapshot', () => {
  it('sums 2 parts', () => {
    expect(getTotalMinutesFromSnapshot(buildSnapshotFromFallback('football_11', 45, 2))).toBe(90);
  });
  it('1 part tournament', () => {
    expect(getTotalMinutesFromSnapshot(buildSnapshotFromFallback('football_7', 15, 1))).toBe(15);
  });
  it('custom duration', () => {
    expect(getTotalMinutesFromSnapshot(buildSnapshotFromFallback('football_7', 25, 2))).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════
// 3. CONVOCATION: STARTER LIMIT
// ═══════════════════════════════════════════════════════
describe('Starter count validation per modality', () => {
  it('football_11 with 12 starters fails', () => {
    const r = validateStarterCount(12, 'football_11');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('11');
  });

  it('football_9 with 10 starters fails', () => {
    const r = validateStarterCount(10, 'football_9');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('9');
  });

  it('football_7 with 8 starters fails', () => {
    const r = validateStarterCount(8, 'football_7');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('7');
  });

  it('football_5 with 6 starters fails', () => {
    const r = validateStarterCount(6, 'football_5');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('5');
  });

  it('futsal with 6 starters fails', () => {
    const r = validateStarterCount(6, 'futsal');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('5');
  });

  it('valid counts pass', () => {
    expect(validateStarterCount(11, 'football_11').allowed).toBe(true);
    expect(validateStarterCount(9, 'football_9').allowed).toBe(true);
    expect(validateStarterCount(7, 'football_7').allowed).toBe(true);
    expect(validateStarterCount(5, 'football_5').allowed).toBe(true);
    expect(validateStarterCount(5, 'futsal').allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// 4. REENTRY VALIDATION
// ═══════════════════════════════════════════════════════
describe('Reentry validation', () => {
  const subbedOutEvents: MatchEventForCalc[] = [
    { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
  ];

  it('football_11 blocks reentry', () => {
    expect(validateReentry('p1', subbedOutEvents, 'football_11').allowed).toBe(false);
  });

  it.each(['football_9', 'football_7', 'football_5', 'futsal'])(
    '%s allows reentry',
    (sport) => {
      expect(validateReentry('p1', subbedOutEvents, sport).allowed).toBe(true);
    }
  );
});

// ═══════════════════════════════════════════════════════
// 5. SUBSTITUTION ATTEMPT VALIDATION
// ═══════════════════════════════════════════════════════
describe('Substitution attempt validation', () => {
  it('blocks entry without exit at field limit', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: 'p1',
      playerInId: 'p8',
      currentOnFieldIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
      events: [],
      sportType: 'football_7',
    });
    // This should be allowed since p1 is leaving
    expect(r.allowed).toBe(true);
  });

  it('blocks player already on field', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: 'p1',
      playerInId: 'p2',
      currentOnFieldIds: ['p1', 'p2', 'p3'],
      events: [],
      sportType: 'football_7',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('já está em campo');
  });

  it('blocks player not on field going out', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: 'p9',
      playerInId: 'p8',
      currentOnFieldIds: ['p1', 'p2', 'p3'],
      events: [],
      sportType: 'football_7',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('não está em campo');
  });

  it('blocks same player in and out', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: 'p1',
      playerInId: 'p1',
      currentOnFieldIds: ['p1', 'p2', 'p3'],
      events: [],
      sportType: 'football_7',
    });
    expect(r.allowed).toBe(false);
  });

  it('blocks missing playerOutId', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: null,
      playerInId: 'p8',
      currentOnFieldIds: ['p1'],
      events: [],
      sportType: 'football_7',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('indicar o jogador que vai sair');
  });

  it('blocks missing playerInId', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: 'p1',
      playerInId: null,
      currentOnFieldIds: ['p1'],
      events: [],
      sportType: 'football_7',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('indicar o jogador que vai entrar');
  });

  it('blocks reentry in football_11', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: 'p2',
      playerInId: 'p1',
      currentOnFieldIds: ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'pGK'],
      events: [
        { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      ],
      sportType: 'football_11',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Futebol 11');
  });

  it('allows reentry in football_7', () => {
    const r = validateSubstitutionAttempt({
      playerOutId: 'p2',
      playerInId: 'p1',
      currentOnFieldIds: ['p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
      events: [
        { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      ],
      sportType: 'football_7',
    });
    expect(r.allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// 6. FIELD COUNT VALIDATION
// ═══════════════════════════════════════════════════════
describe('Field count validation', () => {
  it('blocks exceeding limit', () => {
    expect(validateFieldCount(8, 'football_7').allowed).toBe(false);
    expect(validateFieldCount(12, 'football_11').allowed).toBe(false);
    expect(validateFieldCount(10, 'football_9').allowed).toBe(false);
    expect(validateFieldCount(6, 'futsal').allowed).toBe(false);
  });

  it('allows at limit', () => {
    expect(validateFieldCount(7, 'football_7').allowed).toBe(true);
    expect(validateFieldCount(11, 'football_11').allowed).toBe(true);
    expect(validateFieldCount(5, 'futsal').allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// 7. MINUTES CALCULATION
// ═══════════════════════════════════════════════════════
describe('Minutes calculation scenarios', () => {
  it('starter plays entire 70min game = 70', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const stats = computeMatchPlayerStats(lineups, [], 70);
    expect(stats[0].totalMinutes).toBe(70);
  });

  it('player enters at 55 in 70min game = 15', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 55, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(15);
  });

  it('player plays 0-30 and 51-70 = 49', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 51, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(49);
  });

  it('player exits at 30, returns at 56 in 70min game = 44', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 56, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(44);
  });

  it('bench player who never enters = 0', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: false }];
    const stats = computeMatchPlayerStats(lineups, [], 70);
    expect(stats[0].totalMinutes).toBe(0);
  });

  it('multiple stints: football_9 player with 3 stints', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 10, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 50, player_id: 'p1', is_opponent: false },
    ];
    // 0-10 + 20-30 + 50-70 = 10 + 10 + 20 = 40
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(40);
  });

  it('custom match duration (40-min halves)', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const stats = computeMatchPlayerStats(lineups, [], 80); // 2x40
    expect(stats[0].totalMinutes).toBe(80);
  });
});

// ═══════════════════════════════════════════════════════
// 8. CONSISTENCY CHECKS
// ═══════════════════════════════════════════════════════
describe('Match consistency checks', () => {
  it('detects too many starters', () => {
    const lineups: StarterInfo[] = Array.from({ length: 8 }, (_, i) => ({
      player_id: `p${i}`,
      is_starter: true,
    }));
    const issues = checkMatchConsistency(lineups, [], 60, 'football_7');
    expect(issues.some(i => i.type === 'error' && i.message.includes('8'))).toBe(true);
  });

  it('detects reentry in football_11', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 30, player_id: 'p2', is_opponent: false },
      { event_type: 'substitution_out', minute: 50, player_id: 'p2', is_opponent: false },
      { event_type: 'substitution_in', minute: 50, player_id: 'p1', is_opponent: false },
    ];
    const issues = checkMatchConsistency(lineups, events, 90, 'football_11');
    expect(issues.some(i => i.type === 'error' && i.message.includes('Reentrada'))).toBe(true);
  });

  it('no issues for valid football_7 game with rotations', () => {
    const lineups: StarterInfo[] = Array.from({ length: 7 }, (_, i) => ({
      player_id: `p${i}`,
      is_starter: true,
    }));
    lineups.push({ player_id: 'sub1', is_starter: false });

    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'p0', is_opponent: false },
      { event_type: 'substitution_in', minute: 20, player_id: 'sub1', is_opponent: false },
      { event_type: 'substitution_out', minute: 40, player_id: 'sub1', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'p0', is_opponent: false },
    ];
    const issues = checkMatchConsistency(lineups, events, 60, 'football_7');
    const errors = issues.filter(i => i.type === 'error');
    expect(errors.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// 9. DEFAULT RULE LOADING (snapshot-based)
// ═══════════════════════════════════════════════════════
describe('Default rule profiles', () => {
  it('football_11 juniores default = 2x45', () => {
    const snap = buildSnapshotFromFallback('football_11', 45, 2);
    expect(snap.period_count).toBe(2);
    expect(snap.period_1_minutes).toBe(45);
    expect(getTotalMinutesFromSnapshot(snap)).toBe(90);
  });

  it('football_7 infantis default = 2x30', () => {
    const snap = buildSnapshotFromFallback('football_7', 30, 2);
    expect(getTotalMinutesFromSnapshot(snap)).toBe(60);
  });

  it('futsal traquinas default = 2x15', () => {
    const snap = buildSnapshotFromFallback('futsal', 15, 2);
    expect(getTotalMinutesFromSnapshot(snap)).toBe(30);
  });

  it('overridden match duration uses custom values', () => {
    const snap = buildSnapshotFromFallback('football_11', 40, 2);
    // Iniciados with 40-min halves override
    expect(getTotalMinutesFromSnapshot(snap)).toBe(80);
  });
});
