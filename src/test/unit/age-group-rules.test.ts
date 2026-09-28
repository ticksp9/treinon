import { describe, it, expect } from 'vitest';
import {
  ageAt,
  describeTransition,
  getBirthYear,
  isPlayerEligibleForAgeGroup,
  listEligiblePlayersForAgeGroup,
  resolveAgeGroupByBirthYear,
  resolveAgeGroupForPlayer,
  resolveTargetAgeGroup,
  isEligibleForGroup,
  type AgeGroupRule,
} from '@/lib/age-group-rules';

const groups: AgeGroupRule[] = [
  { id: 'sub11', code: 'SUB11', name: 'Sub-11', min_birth_year: 2015, max_birth_year: 2016, display_order: 1, is_active: true },
  { id: 'sub13', code: 'SUB13', name: 'Infantis', min_birth_year: 2013, max_birth_year: 2014, display_order: 2, is_active: true },
  { id: 'sub15', code: 'SUB15', name: 'Sub-15', min_birth_year: 2011, max_birth_year: 2012, display_order: 3, is_active: true },
];

const REF = '2026-12-31';

describe('age-group-rules', () => {
  it('ageAt calculates birthday-aware age', () => {
    expect(ageAt('2010-06-15', '2026-06-14')).toBe(15);
    expect(ageAt('2010-06-15', '2026-06-15')).toBe(16);
  });

  it('getBirthYear handles missing/invalid dates', () => {
    expect(getBirthYear('2013-05-10')).toBe(2013);
    expect(getBirthYear(null)).toBeNull();
    expect(getBirthYear('not-a-date')).toBeNull();
  });

  it('resolves the group by birth year (season 2026/2027)', () => {
    const res = resolveAgeGroupForPlayer('2013-05-10', REF, groups);
    expect(res.reason).toBe('matched');
    expect(res.ageGroup?.id).toBe('sub13');
    expect(res.birthYear).toBe(2013);
    const res2 = resolveAgeGroupForPlayer('2014-11-30', REF, groups);
    expect(res2.ageGroup?.id).toBe('sub13');
  });

  it('respects inclusive interval boundaries', () => {
    expect(resolveAgeGroupByBirthYear(2013, groups).ageGroup?.id).toBe('sub13');
    expect(resolveAgeGroupByBirthYear(2014, groups).ageGroup?.id).toBe('sub13');
    expect(resolveAgeGroupByBirthYear(2012, groups).ageGroup?.id).toBe('sub15');
  });

  it('returns null (leaves) when the player is out of every range', () => {
    const res = resolveAgeGroupForPlayer('2008-01-01', REF, groups);
    expect(res.ageGroup).toBeNull();
    expect(res.reason).toBe('over_age');
    expect(describeTransition('sub15', null, groups)).toBe('leaves');
  });

  it('marks unknown when the birth date is missing', () => {
    const res = resolveAgeGroupForPlayer(null, REF, groups);
    expect(res.reason).toBe('no_birth_date');
    expect(res.ageGroup).toBeNull();
  });

  it('blocks resolution when no age groups are configured', () => {
    expect(resolveAgeGroupForPlayer('2013-01-01', REF, []).reason).toBe('no_groups');
  });

  it('picks the lowest display_order and warns on overlapping ranges', () => {
    const overlapping: AgeGroupRule[] = [
      ...groups,
      { id: 'dup', code: 'DUP', name: 'Duplicado', min_birth_year: 2013, max_birth_year: 2013, display_order: 9, is_active: true },
    ];
    const res = resolveAgeGroupForPlayer('2013-04-04', REF, overlapping);
    expect(res.ageGroup?.id).toBe('sub13');
    expect(res.warning).toContain('2013');
  });

  it('ignores inactive groups', () => {
    const inactive = groups.map((g) => (g.id === 'sub13' ? { ...g, is_active: false } : g));
    expect(resolveAgeGroupForPlayer('2013-01-01', REF, inactive).ageGroup).toBeNull();
  });

  it('classifies transitions', () => {
    expect(describeTransition('sub13', 'sub13', groups)).toBe('stays');
    expect(describeTransition('sub13', 'sub15', groups)).toBe('promotes');
    expect(describeTransition('sub13', null, groups)).toBe('leaves');
    expect(describeTransition(null, 'sub13', groups)).toBe('unknown');
    expect(describeTransition(null, null, groups)).toBe('unknown');
  });

  it('eligibility helpers', () => {
    expect(isPlayerEligibleForAgeGroup('2013-05-10', groups[1])).toBe(true);
    expect(isPlayerEligibleForAgeGroup('2010-01-01', groups[1])).toBe(false);
    // missing birth date is undecidable, never "not eligible"
    expect(isPlayerEligibleForAgeGroup(null, groups[1])).toBeNull();
    expect(isPlayerEligibleForAgeGroup('not-a-date', groups[1])).toBeNull();
    expect(isEligibleForGroup('2013-05-10', groups[1])).toBe(true);
    const players = [
      { birth_date: '2013-02-02' },
      { birth_date: '2016-02-02' },
      { birth_date: null },
    ];
    expect(listEligiblePlayersForAgeGroup(players, groups[1], REF)).toHaveLength(1);
  });

  it('keeps the legacy resolveTargetAgeGroup contract', () => {
    const r = resolveTargetAgeGroup('2013-05-10', REF, groups);
    expect(r.ageGroupId).toBe('sub13');
    expect(r.reason).toBe('matched');
    expect(resolveTargetAgeGroup('2020-01-01', REF, groups).reason).toBe('under_age');
  });
});
