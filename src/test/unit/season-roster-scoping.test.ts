import { describe, it, expect } from 'vitest';
import {
  classifyEnrollmentEligibility,
  isPlayerEligibleForAgeGroup,
  type AgeGroupRule,
} from '@/lib/age-group-rules';

const sub13: AgeGroupRule = {
  id: 'sub13', code: 'SUB13', name: 'Infantis',
  min_birth_year: 2013, max_birth_year: 2014, display_order: 2, is_active: true,
};

/** Mirrors the Players page rule: with a season selected there is no fallback. */
function seasonRoster(
  enrollments: { player_id: string }[] | undefined,
  allPlayers: { id: string }[],
  selectedSeasonId: string | null,
) {
  if (!selectedSeasonId) return allPlayers;
  const ids = (enrollments || []).map((e) => e.player_id);
  if (ids.length === 0) return [];
  return allPlayers.filter((p) => ids.includes(p.id));
}

describe('season roster scoping', () => {
  const players = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];

  it('shows only enrolled players of the selected season', () => {
    expect(seasonRoster([{ player_id: 'p1' }], players, 's2')).toEqual([{ id: 'p1' }]);
  });

  it('never falls back to the old roster when the season has 0 enrollments', () => {
    expect(seasonRoster([], players, 's2')).toEqual([]);
    expect(seasonRoster(undefined, players, 's2')).toEqual([]);
  });

  it('falls back to the global players only when no season exists', () => {
    expect(seasonRoster([], players, null)).toEqual(players);
  });

  it('flags legacy enrollments outside the age group', () => {
    expect(classifyEnrollmentEligibility('2013-04-01', sub13)).toBe('eligible');
    expect(classifyEnrollmentEligibility('2009-04-01', sub13)).toBe('out_of_group');
    expect(classifyEnrollmentEligibility(null, sub13)).toBe('unknown');
    expect(classifyEnrollmentEligibility('2013-04-01', null)).toBe('unknown');
  });

  it('coach same-group transition keeps eligible players and drops over-age ones', () => {
    const roster = [
      { id: 'a', birth_date: '2013-01-01' },
      { id: 'b', birth_date: '2009-01-01' },
      { id: 'c', birth_date: null },
    ];
    const transitioned = roster.filter((p) => isPlayerEligibleForAgeGroup(p.birth_date, sub13) !== false);
    expect(transitioned.map((p) => p.id)).toEqual(['a', 'c']); // unknown stays, over-age leaves
  });
});
