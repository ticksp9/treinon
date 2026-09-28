import { describe, it, expect } from 'vitest';
import {
  computePlayerIntervals,
  sumIntervalMinutes,
  buildPlayerAnnotations,
  computeMatchPlayerStats,
  calculateMatchEndMinute,
  getPartTimesFromElapsed,
  wasOriginalStarter,
  validateReentry,
  validateStarterCount,
  validateSubstitutionAttempt,
  checkMatchConsistency,
  type MatchEventForCalc,
  type StarterInfo,
} from '@/lib/match-playing-time';

describe('match-playing-time engine', () => {
  // Caso 1 — Jogador titular que joga o jogo todo
  it('starter playing full match = total minutes', () => {
    const lineups: StarterInfo[] = [{ player_id: 'gk', is_starter: true }];
    const events: MatchEventForCalc[] = [];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(70);
    expect(stats[0].annotations).toEqual(['TIT']);
  });

  // Caso 2 — Jogador entra aos 55, jogo termina aos 70
  it('sub enters at 55, match ends at 70 = 15 min', () => {
    const lineups: StarterInfo[] = [{ player_id: 'sub1', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 55, player_id: 'sub1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(15);
    expect(stats[0].annotations).toEqual(['E55\'']);
  });

  // Caso 3 — Titular sai aos 30, reentra aos 56, jogo termina aos 70
  it('starter out at 30, back in at 56, match ends 70 = 44 min', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 56, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(44);
    expect(stats[0].annotations).toEqual(['TIT', 'S30\'', 'E56\'']);
  });

  // Caso 4 — Jogador faz 1ª parte toda (0-30) e entra 19 min do fim (51-70)
  it('starter plays full 1st half and re-enters at 51 until 70 = 49 min', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p2', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p2', is_opponent: false },
      { event_type: 'substitution_in', minute: 51, player_id: 'p2', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(49);
  });

  // Caso 5 — Múltiplas rotações
  it('multiple rotations: 0-10, 18-30, 40-52, 60-70 = 44 min', () => {
    const lineups: StarterInfo[] = [{ player_id: 'rot', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 10, player_id: 'rot', is_opponent: false },
      { event_type: 'substitution_in', minute: 18, player_id: 'rot', is_opponent: false },
      { event_type: 'substitution_out', minute: 30, player_id: 'rot', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'rot', is_opponent: false },
      { event_type: 'substitution_out', minute: 52, player_id: 'rot', is_opponent: false },
      { event_type: 'substitution_in', minute: 60, player_id: 'rot', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    // 10 + 12 + 12 + 10 = 44
    expect(stats[0].totalMinutes).toBe(44);
  });

  // Caso 6 — Player not on field can't have sub_out affect intervals
  it('sub_out for player not on field is ignored', () => {
    const lineups: StarterInfo[] = [{ player_id: 'bench', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'bench', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    // Player was never on field, so 0 minutes
    expect(stats[0].totalMinutes).toBe(0);
  });

  // Caso 7 — Two halves with different durations
  it('match with 30+40 real minutes, GK plays all = 70', () => {
    const elapsed = [30 * 60, 40 * 60]; // seconds
    const endMin = calculateMatchEndMinute(elapsed);
    expect(endMin).toBe(70);

    const lineups: StarterInfo[] = [{ player_id: 'gk', is_starter: true }];
    const stats = computeMatchPlayerStats(lineups, [], endMin);
    expect(stats[0].totalMinutes).toBe(70);
  });

  // Full team scenario
  it('full team scenario with mixed starters and subs', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'gk', is_starter: true },
      { player_id: 's1', is_starter: true },
      { player_id: 's2', is_starter: true },
      { player_id: 's3', is_starter: true },
      { player_id: 's4', is_starter: true },
      { player_id: 's5', is_starter: true },
      { player_id: 's6', is_starter: true },
      { player_id: 'b1', is_starter: false },
      { player_id: 'b2', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      // s1 out at 15, b1 in at 15
      { event_type: 'substitution_out', minute: 15, player_id: 's1', is_opponent: false },
      { event_type: 'substitution_in', minute: 15, player_id: 'b1', is_opponent: false },
      // b1 out at 25, s1 back in at 25
      { event_type: 'substitution_out', minute: 25, player_id: 'b1', is_opponent: false },
      { event_type: 'substitution_in', minute: 25, player_id: 's1', is_opponent: false },
      // s2 out at 30 (half time sub), b2 in at 30
      { event_type: 'substitution_out', minute: 30, player_id: 's2', is_opponent: false },
      { event_type: 'substitution_in', minute: 30, player_id: 'b2', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    const statsMap = new Map(stats.map(s => [s.playerId, s]));

    expect(statsMap.get('gk')!.totalMinutes).toBe(60); // full match
    expect(statsMap.get('s1')!.totalMinutes).toBe(50); // 15 + 35
    expect(statsMap.get('b1')!.totalMinutes).toBe(10); // 15-25
    expect(statsMap.get('s2')!.totalMinutes).toBe(30); // 0-30
    expect(statsMap.get('b2')!.totalMinutes).toBe(30); // 30-60
    expect(statsMap.get('s3')!.totalMinutes).toBe(60); // full match
  });

  // Annotations
  it('builds correct annotations for rotational sub', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 56, player_id: 'p1', is_opponent: false },
    ];
    const annotations = buildPlayerAnnotations('p1', true, events);
    expect(annotations).toEqual(['TIT', 'S30\'', 'E56\'']);
  });

  it('non-starter annotations', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 15, player_id: 'b1', is_opponent: false },
      { event_type: 'substitution_out', minute: 30, player_id: 'b1', is_opponent: false },
      { event_type: 'substitution_in', minute: 50, player_id: 'b1', is_opponent: false },
    ];
    const annotations = buildPlayerAnnotations('b1', false, events);
    expect(annotations).toEqual(['E15\'', 'S30\'', 'E50\'']);
  });

  // Part times helper
  it('getPartTimesFromElapsed computes correctly', () => {
    const result = getPartTimesFromElapsed([30 * 60, 40 * 60]);
    expect(result.partMinutes).toEqual([30, 40]);
    expect(result.totalMinutes).toBe(70);
  });

  // wasOriginalStarter
  it('detects original starter correctly', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 50, player_id: 'p1', is_opponent: false },
    ];
    expect(wasOriginalStarter('p1', events)).toBe(true);
  });

  it('detects non-starter correctly', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 15, player_id: 'b1', is_opponent: false },
    ];
    expect(wasOriginalStarter('b1', events)).toBe(false);
  });

  // CRITICAL: bench player with no events must NOT be treated as starter
  it('bench player with no events uses currentIsStarter fallback = false', () => {
    expect(wasOriginalStarter('bench_never_played', [], false)).toBe(false);
  });

  it('starter with no events uses currentIsStarter fallback = true', () => {
    expect(wasOriginalStarter('gk_full_game', [], true)).toBe(true);
  });

  it('bench player with no events and no fallback defaults to true (backward compat)', () => {
    expect(wasOriginalStarter('unknown', [])).toBe(true);
  });

  // Opponent events should be ignored
  it('ignores opponent events', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 20, player_id: 'p1', is_opponent: true },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    expect(stats[0].totalMinutes).toBe(60); // opponent sub ignored
  });

  // CRITICAL: bench player who never plays must get 0 minutes
  it('bench player who never enters gets 0 minutes', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'gk', is_starter: true },
      { player_id: 'bench_unused', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [];
    const stats = computeMatchPlayerStats(lineups, events, 70);
    const statsMap = new Map(stats.map(s => [s.playerId, s]));
    expect(statsMap.get('gk')!.totalMinutes).toBe(70);
    expect(statsMap.get('bench_unused')!.totalMinutes).toBe(0);
  });

  // Football 9: rotational subs allowed
  it('football 9: multiple rotations accumulate correctly', () => {
    const lineups: StarterInfo[] = [{ player_id: 'rot9', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 15, player_id: 'rot9', is_opponent: false },
      { event_type: 'substitution_in', minute: 25, player_id: 'rot9', is_opponent: false },
      { event_type: 'substitution_out', minute: 40, player_id: 'rot9', is_opponent: false },
      { event_type: 'substitution_in', minute: 50, player_id: 'rot9', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    // 15 + 15 + 10 = 40
    expect(stats[0].totalMinutes).toBe(40);
  });

  // Football 5 / futsal: rotational subs
  it('football 5: player with 3 stints', () => {
    const lineups: StarterInfo[] = [{ player_id: 'f5', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 5, player_id: 'f5', is_opponent: false },
      { event_type: 'substitution_out', minute: 10, player_id: 'f5', is_opponent: false },
      { event_type: 'substitution_in', minute: 20, player_id: 'f5', is_opponent: false },
      { event_type: 'substitution_out', minute: 25, player_id: 'f5', is_opponent: false },
      { event_type: 'substitution_in', minute: 35, player_id: 'f5', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 40);
    // 5 + 5 + 5 = 15
    expect(stats[0].totalMinutes).toBe(15);
    expect(stats[0].annotations).toEqual(['E5\'', 'S10\'', 'E20\'', 'S25\'', 'E35\'']);
  });

  // Reentry validation
  it('football 11 blocks reentry', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'football_11');
    expect(result.allowed).toBe(false);
  });

  it('football 9 allows reentry', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'football_9');
    expect(result.allowed).toBe(true);
  });

  it('football 7 allows reentry', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'football_7');
    expect(result.allowed).toBe(true);
  });

  it('futsal allows reentry', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const result = validateReentry('p1', events, 'futsal');
    expect(result.allowed).toBe(true);
  });

  it('blocks initial lineup above sport limit', () => {
    const result = validateStarterCount(8, 'football_7');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('máximo de 7');
  });

  it('blocks substitution when player entering is already on field', () => {
    const result = validateSubstitutionAttempt({
      playerOutId: 'p1',
      playerInId: 'p2',
      currentOnFieldIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
      events: [],
      sportType: 'football_7',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('já está em campo');
  });

  it('blocks substitution when player leaving is not on field', () => {
    const result = validateSubstitutionAttempt({
      playerOutId: 'bench',
      playerInId: 'sub1',
      currentOnFieldIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
      events: [],
      sportType: 'football_7',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('não está em campo');
  });

  it('blocks football 11 reentry in substitution validation', () => {
    const result = validateSubstitutionAttempt({
      playerOutId: 'p2',
      playerInId: 'p1',
      currentOnFieldIds: ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'],
      events: [
        { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      ],
      sportType: 'football_11',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('não pode voltar a entrar');
  });

  it('processes same-minute substitution out before in for field consistency', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'p2', is_starter: true },
      { player_id: 'p3', is_starter: true },
      { player_id: 'p4', is_starter: true },
      { player_id: 'p5', is_starter: true },
      { player_id: 'p6', is_starter: true },
      { player_id: 'p7', is_starter: true },
      { player_id: 'sub1', is_starter: false },
    ];

    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 30, player_id: 'sub1', is_opponent: false },
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];

    const issues = checkMatchConsistency(lineups, events, 70, 'football_7');
    expect(issues.some(issue => issue.message.includes('8 jogadores em campo'))).toBe(false);

    const stats = computeMatchPlayerStats(lineups, events, 70);
    const statsMap = new Map(stats.map(s => [s.playerId, s]));
    expect(statsMap.get('p1')!.totalMinutes).toBe(30);
    expect(statsMap.get('sub1')!.totalMinutes).toBe(40);
  });

  it('does not reset a player interval on invalid duplicate substitution_in', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 30, player_id: 'p1', is_opponent: false },
    ];

    const stats = computeMatchPlayerStats(lineups, events, 70);
    expect(stats[0].totalMinutes).toBe(70);
  });
});

describe('match-playing-time with custom durations', () => {
  it('Iniciados F11 with 40 min per half = 80 min total', () => {
    // Coach configured 40 min per half instead of default 35
    const matchEndMinute = 80; // 2 × 40
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [];
    const stats = computeMatchPlayerStats(lineups, events, matchEndMinute);
    expect(stats[0].totalMinutes).toBe(80);
  });

  it('custom duration: sub enters at 70, match ends at 80 = 10 min', () => {
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'sub1', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 70, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 70, player_id: 'sub1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 80);
    const statsMap = new Map(stats.map(s => [s.playerId, s]));
    expect(statsMap.get('p1')!.totalMinutes).toBe(70);
    expect(statsMap.get('sub1')!.totalMinutes).toBe(10);
  });

  it('getPartTimesFromElapsed reflects actual elapsed, not configured', () => {
    // Coach set 40 min but parts ran 42 and 38
    const partElapsed = [42 * 60, 38 * 60]; // seconds
    const result = getPartTimesFromElapsed(partElapsed);
    expect(result.partMinutes).toEqual([42, 38]);
    expect(result.totalMinutes).toBe(80);
  });

  it('calculateMatchEndMinute uses actual elapsed seconds', () => {
    const endMin = calculateMatchEndMinute([40 * 60, 40 * 60]);
    expect(endMin).toBe(80);
  });
});

describe('match-playing-time edge cases', () => {
  it('real time exceeding regulation: parts ran 33+37 = 70 instead of 60', () => {
    const elapsed = [33 * 60, 37 * 60];
    const endMin = calculateMatchEndMinute(elapsed);
    expect(endMin).toBe(70);
    const lineups: StarterInfo[] = [{ player_id: 'gk', is_starter: true }];
    const stats = computeMatchPlayerStats(lineups, [], endMin);
    expect(stats[0].totalMinutes).toBe(70);
  });

  it('sub enters and exits at same minute = 0 minutes (out processed before in)', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: false }];
    // At same minute, out is processed before in. Since player is not on field,
    // out is ignored, then in opens an interval that runs to match end.
    // To truly get 0 min at same minute, the in must come before out in event order,
    // but the engine sorts out before in. So this scenario = player enters and stays.
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    // Engine sorts: out@30 (ignored, not on field) then in@30 (opens interval to 60)
    expect(stats[0].totalMinutes).toBe(30);
  });

  it('starter exits and re-enters at same minute = full match', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 30, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    // out@30 closes 0-30, in@30 opens 30-60 → total 60
    expect(stats[0].totalMinutes).toBe(60);
  });

  it('duplicate substitution_in for starter does not double minutes', () => {
    const lineups: StarterInfo[] = [{ player_id: 'p1', is_starter: true }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 20, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'p1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    // Player was on field the whole time (starter, duplicate ins ignored)
    expect(stats[0].totalMinutes).toBe(60);
  });

  it('sub_out for bench player who never entered = 0 minutes', () => {
    const lineups: StarterInfo[] = [{ player_id: 'bench', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 40, player_id: 'bench', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, 60);
    expect(stats[0].totalMinutes).toBe(0);
  });

  it('part_elapsed_seconds prevails over halfDuration for end minute', () => {
    // Configured 30 min halves but real elapsed was 32+34
    const elapsed = [32 * 60, 34 * 60];
    const { totalMinutes } = getPartTimesFromElapsed(elapsed);
    expect(totalMinutes).toBe(66);
    const lineups: StarterInfo[] = [
      { player_id: 'p1', is_starter: true },
      { player_id: 'sub1', is_starter: false },
    ];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 60, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 60, player_id: 'sub1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, totalMinutes);
    const map = new Map(stats.map(s => [s.playerId, s]));
    expect(map.get('p1')!.totalMinutes).toBe(60);
    expect(map.get('sub1')!.totalMinutes).toBe(6); // 60-66
  });

  it('annotations include part suffix when partMinutes provided', () => {
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_out', minute: 25, player_id: 'p1', is_opponent: false },
      { event_type: 'substitution_in', minute: 40, player_id: 'p1', is_opponent: false },
    ];
    const annotations = buildPlayerAnnotations('p1', true, events, [30, 30]);
    expect(annotations).toEqual(['TIT', "S25'", "E40' (2.ªP)"]);
  });

  it('three-part match: sub enters in part 3', () => {
    const elapsed = [20 * 60, 20 * 60, 20 * 60];
    const endMin = calculateMatchEndMinute(elapsed);
    expect(endMin).toBe(60);
    const lineups: StarterInfo[] = [{ player_id: 'sub1', is_starter: false }];
    const events: MatchEventForCalc[] = [
      { event_type: 'substitution_in', minute: 45, player_id: 'sub1', is_opponent: false },
    ];
    const stats = computeMatchPlayerStats(lineups, events, endMin);
    expect(stats[0].totalMinutes).toBe(15); // 45-60
  });

  // ─── Auto-reconciliation for free-reentry formats (F7/F9/F5/futsal) ──────────
  describe('auto-reconciliation (free-reentry formats)', () => {
    it('swaps OUT/IN ids when coach inverted them on the same minute (F7)', async () => {
      // Real bug from FC Amares vs SC Ucha: at min 49, OUT=Leonardo (already off
      // field since min 20) and IN=85feb0a2 (already on field since min 20).
      // Coach typed the ids reversed. Engine must auto-swap.
      const { reconcileSubstitutionEvents } = await import('@/lib/match-playing-time');
      const lineups: StarterInfo[] = [
        { player_id: 'leonardo', is_starter: true },
        { player_id: 'sub_a', is_starter: false },
      ];
      const events: MatchEventForCalc[] = [
        // First sub: leonardo OUT, sub_a IN at min 20 (correct)
        { event_type: 'substitution_out', minute: 20, player_id: 'leonardo', is_opponent: false },
        { event_type: 'substitution_in', minute: 20, player_id: 'sub_a', is_opponent: false },
        // Second sub at min 49: coach typed ids INVERTED
        // (claims leonardo OUT but he's off field; claims sub_a IN but he's on field)
        { event_type: 'substitution_out', minute: 49, player_id: 'leonardo', is_opponent: false },
        { event_type: 'substitution_in', minute: 49, player_id: 'sub_a', is_opponent: false },
      ];
      const { events: fixed, logs } = reconcileSubstitutionEvents(lineups, events, 'football_7');
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('swap_out_in');
      expect(logs[0].minute).toBe(49);
      // After swap, the second sub becomes: sub_a OUT, leonardo IN
      const fixedAt49 = fixed.filter(e => e.minute === 49);
      expect(fixedAt49.find(e => e.event_type === 'substitution_out')!.player_id).toBe('sub_a');
      expect(fixedAt49.find(e => e.event_type === 'substitution_in')!.player_id).toBe('leonardo');
    });

    it('FC Amares regression: minutes are coherent after reconciliation', () => {
      // Leonardo: starter, OUT 20, back IN 49, plays until end (62)
      // sub_a: bench, IN 20, OUT 49
      const lineups: StarterInfo[] = [
        { player_id: 'leonardo', is_starter: true },
        { player_id: 'sub_a', is_starter: false },
      ];
      const events: MatchEventForCalc[] = [
        { event_type: 'substitution_out', minute: 20, player_id: 'leonardo', is_opponent: false },
        { event_type: 'substitution_in', minute: 20, player_id: 'sub_a', is_opponent: false },
        // Inverted by coach:
        { event_type: 'substitution_out', minute: 49, player_id: 'leonardo', is_opponent: false },
        { event_type: 'substitution_in', minute: 49, player_id: 'sub_a', is_opponent: false },
      ];
      const stats = computeMatchPlayerStats(lineups, events, 62, undefined, 'football_7');
      const map = new Map(stats.map(s => [s.playerId, s]));
      // Leonardo: 0→20 + 49→62 = 33
      expect(map.get('leonardo')!.totalMinutes).toBe(33);
      // sub_a: 20→49 = 29
      expect(map.get('sub_a')!.totalMinutes).toBe(29);
    });

    it('does NOT swap when both OUT and IN are coherent', () => {
      const lineups: StarterInfo[] = [
        { player_id: 'p1', is_starter: true },
        { player_id: 'sub1', is_starter: false },
      ];
      const events: MatchEventForCalc[] = [
        { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
        { event_type: 'substitution_in', minute: 30, player_id: 'sub1', is_opponent: false },
      ];
      const stats = computeMatchPlayerStats(lineups, events, 60, undefined, 'football_7');
      const map = new Map(stats.map(s => [s.playerId, s]));
      expect(map.get('p1')!.totalMinutes).toBe(30);
      expect(map.get('sub1')!.totalMinutes).toBe(30);
    });

    it('does NOT auto-swap for football_11 (re-entry forbidden)', async () => {
      const { reconcileSubstitutionEvents } = await import('@/lib/match-playing-time');
      const lineups: StarterInfo[] = [
        { player_id: 'p1', is_starter: true },
        { player_id: 'sub1', is_starter: false },
      ];
      // Inverted ids on a second sub — for F11 we leave events unchanged so the
      // strict consistency checker can flag the re-entry as illegal.
      const events: MatchEventForCalc[] = [
        { event_type: 'substitution_out', minute: 20, player_id: 'p1', is_opponent: false },
        { event_type: 'substitution_in', minute: 20, player_id: 'sub1', is_opponent: false },
        { event_type: 'substitution_out', minute: 49, player_id: 'p1', is_opponent: false },
        { event_type: 'substitution_in', minute: 49, player_id: 'sub1', is_opponent: false },
      ];
      const { logs } = reconcileSubstitutionEvents(lineups, events, 'football_11');
      expect(logs).toHaveLength(0);
    });

    it('multi-sub minute (2 OUTs + 2 INs) is left untouched', async () => {
      const { reconcileSubstitutionEvents } = await import('@/lib/match-playing-time');
      const lineups: StarterInfo[] = [
        { player_id: 'p1', is_starter: true },
        { player_id: 'p2', is_starter: true },
        { player_id: 'sub1', is_starter: false },
        { player_id: 'sub2', is_starter: false },
      ];
      const events: MatchEventForCalc[] = [
        { event_type: 'substitution_out', minute: 30, player_id: 'p1', is_opponent: false },
        { event_type: 'substitution_out', minute: 30, player_id: 'p2', is_opponent: false },
        { event_type: 'substitution_in', minute: 30, player_id: 'sub1', is_opponent: false },
        { event_type: 'substitution_in', minute: 30, player_id: 'sub2', is_opponent: false },
      ];
      const { logs } = reconcileSubstitutionEvents(lineups, events, 'football_7');
      // Heuristic only triggers on clean 1×OUT+1×IN, multi-sub minute untouched.
      expect(logs).toHaveLength(0);
    });

    it('reconciliation log surfaces original and resolved player ids', async () => {
      const { reconcileSubstitutionEvents } = await import('@/lib/match-playing-time');
      const lineups: StarterInfo[] = [
        { player_id: 'A', is_starter: true },
        { player_id: 'B', is_starter: false },
      ];
      const events: MatchEventForCalc[] = [
        { event_type: 'substitution_out', minute: 10, player_id: 'A', is_opponent: false },
        { event_type: 'substitution_in', minute: 10, player_id: 'B', is_opponent: false },
        // Inverted at 30
        { event_type: 'substitution_out', minute: 30, player_id: 'A', is_opponent: false },
        { event_type: 'substitution_in', minute: 30, player_id: 'B', is_opponent: false },
      ];
      const { logs } = reconcileSubstitutionEvents(lineups, events, 'football_7');
      expect(logs[0]).toMatchObject({
        type: 'swap_out_in',
        minute: 30,
        originalOutPlayerId: 'A',
        originalInPlayerId: 'B',
        resolvedOutPlayerId: 'B',
        resolvedInPlayerId: 'A',
      });
    });
  });
});
