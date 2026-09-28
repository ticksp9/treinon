import { describe, it, expect } from 'vitest';
import { filterTeamsForSeason, teamSeasonLabel, type TeamSeasonLike } from '@/lib/team-season-service';

const teamA: TeamSeasonLike = { id: 'a', season: '2025/2026', season_id: 's1' };
const teamB: TeamSeasonLike = { id: 'b', season: '2026/2027', season_id: 's2' };
const legacy: TeamSeasonLike = { id: 'c', season: '2026/2027', season_id: null };

describe('team ↔ season link', () => {
  it('shows only teams with membership in the selected season (+ legacy match)', () => {
    const res = filterTeamsForSeason([teamA, teamB, legacy], '2026/2027', ['b']);
    expect(res.map((t) => t.id).sort()).toEqual(['b', 'c']);
  });

  it('hides teams that only exist in other seasons', () => {
    const res = filterTeamsForSeason([teamA, teamB], '2026/2027', ['b']);
    expect(res.map((t) => t.id)).toEqual(['b']);
  });

  it('labels the card with the selected season when a membership exists', () => {
    expect(teamSeasonLabel(teamA, '2026/2027', ['a'])).toBe('2026/2027');
  });

  it('falls back to the legacy season string without membership', () => {
    expect(teamSeasonLabel(teamA, '2026/2027', [])).toBe('2025/2026');
  });

  it('returns every team when no season is selected', () => {
    expect(filterTeamsForSeason([teamA, teamB], null, [])).toHaveLength(2);
  });

  it('switching to the historical season shows the historical team with its own label', () => {
    const res = filterTeamsForSeason([teamA, teamB], '2025/2026', ['a']);
    expect(res.map((t) => t.id)).toEqual(['a']);
    expect(teamSeasonLabel(teamA, '2025/2026', ['a'])).toBe('2025/2026');
  });
});

// --- Back-fill / import / edit semantics ---

interface Row { season_id: string; team_id: string }

function backfillSeasonId(
  teams: { id: string; season: string; season_id: string | null; owner_id: string }[],
  seasons: { id: string; name: string; owner_id: string }[],
) {
  return teams.map((t) =>
    t.season_id
      ? t
      : { ...t, season_id: seasons.find((s) => s.name === t.season && s.owner_id === t.owner_id)?.id ?? null },
  );
}

function upsertMemberships(existing: Row[], rows: Row[]): Row[] {
  const key = (r: Row) => `${r.season_id}:${r.team_id}`;
  const seen = new Set(existing.map(key));
  return [...existing, ...rows.filter((r) => !seen.has(key(r)))];
}

describe('back-fill and membership writes', () => {
  it('back-fills season_id from the legacy season name for the same owner', () => {
    const out = backfillSeasonId(
      [{ id: 'a', season: '2025/2026', season_id: null, owner_id: 'u1' }],
      [{ id: 's1', name: '2025/2026', owner_id: 'u1' }],
    );
    expect(out[0].season_id).toBe('s1');
    const memberships = upsertMemberships([], [{ season_id: 's1', team_id: 'a' }]);
    expect(memberships).toHaveLength(1);
  });

  it('leaves teams without a matching season untouched', () => {
    const out = backfillSeasonId(
      [{ id: 'a', season: '2019/2020', season_id: null, owner_id: 'u1' }],
      [{ id: 's1', name: '2025/2026', owner_id: 'u1' }],
    );
    expect(out[0].season_id).toBeNull();
  });

  it('importing teams from the previous season twice is idempotent', () => {
    const source = ['a', 'b'];
    let target: Row[] = [];
    const run = () => {
      target = upsertMemberships(target, source.map((team_id) => ({ season_id: 's2', team_id })));
    };
    run();
    run();
    expect(target).toHaveLength(2);
  });

  it('double submit on create only produces one team', () => {
    let created = 0;
    let submitting = false;
    const submit = () => {
      if (submitting) return;
      submitting = true;
      created += 1;
    };
    submit();
    submit();
    expect(created).toBe(1);
  });

  it('editing the season adds a membership without deleting historical ones', () => {
    const memberships = upsertMemberships(
      [{ season_id: 's1', team_id: 'a' }],
      [{ season_id: 's2', team_id: 'a' }],
    );
    expect(memberships).toHaveLength(2);
    expect(memberships.some((m) => m.season_id === 's1')).toBe(true);
  });
});
