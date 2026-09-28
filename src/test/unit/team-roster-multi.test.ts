import { describe, it, expect } from 'vitest';

/** Mirrors the roster/visibility rules implemented in the pages + service. */
interface Enrollment { season_id: string; player_id: string; team_id: string | null; status: string }

function activeRoster(enrollments: Enrollment[], seasonId: string, teamId: string) {
  return enrollments
    .filter((e) => e.season_id === seasonId && e.team_id === teamId && e.status === 'active')
    .map((e) => e.player_id);
}

function seasonRoster(enrollments: Enrollment[], seasonId: string | null, allPlayers: string[]) {
  if (!seasonId) return allPlayers;
  const ids = enrollments.filter((e) => e.season_id === seasonId && e.status === 'active').map((e) => e.player_id);
  return allPlayers.filter((p) => ids.includes(p));
}

function removeFromTeam(enrollments: Enrollment[], seasonId: string, teamId: string, playerId: string) {
  return enrollments.map((e) =>
    e.season_id === seasonId && e.team_id === teamId && e.player_id === playerId && e.status === 'active'
      ? { ...e, status: 'left' }
      : e,
  );
}

function canInsert(enrollments: Enrollment[], row: Enrollment) {
  return !enrollments.some(
    (e) => e.season_id === row.season_id && e.player_id === row.player_id && e.team_id === row.team_id,
  );
}

function isShared(enrollments: Enrollment[], seasonId: string, playerId: string) {
  return (
    enrollments.filter((e) => e.season_id === seasonId && e.player_id === playerId && e.status === 'active' && e.team_id)
      .length > 1
  );
}

function countsByTeam(enrollments: Enrollment[], seasonId: string) {
  const map = new Map<string, number>();
  for (const e of enrollments) {
    if (e.season_id !== seasonId || e.status !== 'active' || !e.team_id) continue;
    map.set(e.team_id, (map.get(e.team_id) ?? 0) + 1);
  }
  return map;
}

describe('season/team roster with shared players', () => {
  const base: Enrollment[] = [
    { season_id: 's2', player_id: 'p1', team_id: 'f7', status: 'active' },
    { season_id: 's2', player_id: 'p2', team_id: 'f7', status: 'active' },
    { season_id: 's1', player_id: 'p3', team_id: 'f7', status: 'active' },
  ];

  it('new season without enrollments never lists old players', () => {
    expect(seasonRoster(base, 's3', ['p1', 'p2', 'p3'])).toEqual([]);
  });

  it('falls back to global players only without any season', () => {
    expect(seasonRoster(base, null, ['p1', 'p2'])).toEqual(['p1', 'p2']);
  });

  it('removing from a team soft-removes and keeps the other season intact', () => {
    const after = removeFromTeam(base, 's2', 'f7', 'p1');
    expect(activeRoster(after, 's2', 'f7')).toEqual(['p2']);
    expect(activeRoster(after, 's1', 'f7')).toEqual(['p3']);
    expect(after).toHaveLength(base.length);
  });

  it('a player can be active in two teams and removal affects only one', () => {
    const withF9 = [...base, { season_id: 's2', player_id: 'p1', team_id: 'f9', status: 'active' }];
    expect(isShared(withF9, 's2', 'p1')).toBe(true);
    const after = removeFromTeam(withF9, 's2', 'f9', 'p1');
    expect(activeRoster(after, 's2', 'f7')).toContain('p1');
    expect(activeRoster(after, 's2', 'f9')).toEqual([]);
  });

  it('blocks duplicates in the same team but allows another team', () => {
    expect(canInsert(base, { season_id: 's2', player_id: 'p1', team_id: 'f7', status: 'active' })).toBe(false);
    expect(canInsert(base, { season_id: 's2', player_id: 'p1', team_id: 'f9', status: 'active' })).toBe(true);
  });

  it('counters match active enrollments per team', () => {
    const withF9 = [...base, { season_id: 's2', player_id: 'p1', team_id: 'f9', status: 'active' }];
    const counts = countsByTeam(withF9, 's2');
    expect(counts.get('f7')).toBe(2);
    expect(counts.get('f9')).toBe(1);
  });
});

describe('re-add and eligibility flags', () => {
  interface E { season_id: string; player_id: string; team_id: string; status: string; left_at: string | null }

  /** Mirrors addPlayerToTeam: reactivate instead of duplicating. */
  function addPlayer(rows: E[], row: Omit<E, 'status' | 'left_at'>) {
    const existing = rows.find(
      (e) => e.season_id === row.season_id && e.team_id === row.team_id && e.player_id === row.player_id,
    );
    if (existing) {
      existing.status = 'active';
      existing.left_at = null;
      return rows;
    }
    return [...rows, { ...row, status: 'active', left_at: null }];
  }

  it('re-adding a removed player reactivates without duplicating', () => {
    let rows: E[] = [{ season_id: 's2', player_id: 'p1', team_id: 'f9', status: 'left', left_at: '2026-08-01' }];
    rows = addPlayer(rows, { season_id: 's2', player_id: 'p1', team_id: 'f9' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'active', left_at: null });
  });

  it('flags players without birth date instead of blocking them', () => {
    const needsConfirmation = (birthDate: string | null, eligible: boolean) => !birthDate || !eligible;
    expect(needsConfirmation(null, true)).toBe(true);
    expect(needsConfirmation('2013-01-01', false)).toBe(true);
    expect(needsConfirmation('2013-01-01', true)).toBe(false);
  });
});
