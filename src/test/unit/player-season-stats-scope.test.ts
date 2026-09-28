import { describe, it, expect } from 'vitest';

/** Mirrors the season scoping applied to the profile stats queries. */
interface Lineup { match_id: string; season_id: string | null; minutes_played: number; is_starter: boolean }
interface Attendance { session_id: string; season_id: string | null; present: boolean }

interface Match { id: string; season_id: string | null }

function scopeByParent<T extends { match_id: string }>(rows: T[], matches: Match[], seasonId: string | null): T[] {
  if (!seasonId) return rows;
  const ids = new Set(matches.filter((match) => match.season_id === seasonId).map((match) => match.id));
  return rows.filter((row) => ids.has(row.match_id));
}

function scope<T extends { season_id: string | null }>(rows: T[], seasonId: string | null): T[] {
  if (!seasonId) return rows;
  return rows.filter((r) => r.season_id === seasonId);
}

function stats(lineups: Lineup[], attendance: Attendance[], seasonId: string | null) {
  const l = scope(lineups, seasonId);
  const a = scope(attendance, seasonId);
  return {
    matchesPlayed: l.length,
    minutesPlayed: l.reduce((s, r) => s + (r.minutes_played || 0), 0),
    trainingSessions: a.length,
    trainingAttendance: a.filter((r) => r.present).length,
  };
}

describe('player profile stats scoped by season', () => {
  const lineups: Lineup[] = [
    { match_id: 'm1', season_id: 's1', minutes_played: 90, is_starter: true },
    { match_id: 'm2', season_id: 's1', minutes_played: 530, is_starter: true },
  ];
  const attendance: Attendance[] = [
    { session_id: 't1', season_id: 's1', present: true },
    { session_id: 't2', season_id: 's1', present: false },
  ];

  it('new season without data shows zeros', () => {
    expect(stats(lineups, attendance, 's2')).toEqual({
      matchesPlayed: 0,
      minutesPlayed: 0,
      trainingSessions: 0,
      trainingAttendance: 0,
    });
  });

  it('previous season shows its own data', () => {
    expect(stats(lineups, attendance, 's1')).toEqual({
      matchesPlayed: 2,
      minutesPlayed: 620,
      trainingSessions: 2,
      trainingAttendance: 1,
    });
  });

  it('records without season never leak into a selected season', () => {
    const withNull = [...lineups, { match_id: 'm3', season_id: null, minutes_played: 45, is_starter: false }];
    expect(stats(withNull, [], 's2').matchesPlayed).toBe(0);
    expect(stats(withNull, [], 's1').matchesPlayed).toBe(2);
  });

  it('no season selected aggregates everything (first use)', () => {
    expect(stats(lineups, attendance, null).matchesPlayed).toBe(2);
  });

  it('filtra pela época do jogo mesmo quando o filho não tem season_id', () => {
    const legacyRows = [
      { match_id: 'old', minutes_played: 931 },
      { match_id: 'new', minutes_played: 0 },
    ];
    const matches: Match[] = [
      { id: 'old', season_id: 's1' },
      { id: 'new', season_id: 's2' },
    ];
    expect(scopeByParent(legacyRows, matches, 's2')).toEqual([{ match_id: 'new', minutes_played: 0 }]);
    expect(scopeByParent(legacyRows, matches, 's1')[0].minutes_played).toBe(931);
  });

  it('uma época sem jogos devolve uma lista vazia, nunca todas as épocas', () => {
    expect(scopeByParent([{ match_id: 'old' }], [{ id: 'old', season_id: 's1' }], 's2')).toEqual([]);
  });
});
