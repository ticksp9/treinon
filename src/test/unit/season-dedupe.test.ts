import { describe, it, expect } from 'vitest';
import {
  canDeleteSeason,
  dedupeSeasons,
  detectRenamedSeason,
  getSeasonEditRules,
  isValidSeasonName,
  seasonPeriodWarning,
  suggestNextSeasonFromList,
} from '@/lib/season-service';

const base = {
  club_id: null,
  owner_id: 'owner-1',
  start_date: '2026-07-01',
  end_date: '2027-06-30',
  is_planning: false,
  reference_date: null,
  closed_at: null,
  closed_by: null,
  archived_at: null,
  notes: null,
  updated_at: '',
} as any;

const season = (over: any) => ({ ...base, ...over });

describe('dedupeSeasons', () => {
  it('keeps a single entry per context and reports duplicates', () => {
    const rows = [
      season({ id: 'a', name: '2026/2027', status: 'planning', is_active: false, created_at: '2026-01-02' }),
      season({ id: 'b', name: '2026/2027', status: 'active', is_active: true, created_at: '2026-01-03' }),
      season({ id: 'c', name: '2026/2027', status: 'planning', is_active: false, created_at: '2026-01-04' }),
    ];
    const groups = dedupeSeasons(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].season.id).toBe('b'); // active wins
    expect(groups[0].duplicates.map((d) => d.id)).toEqual(['a', 'c']);
  });

  it('keeps same-name seasons from different contexts separate', () => {
    const rows = [
      season({ id: 'a', name: '2026/2027', status: 'active', is_active: true, created_at: '1' }),
      season({ id: 'b', name: '2026/2027', status: 'active', is_active: true, created_at: '1', club_id: 'club-9' }),
    ];
    expect(dedupeSeasons(rows)).toHaveLength(2);
  });

  it('orders most recent first', () => {
    const rows = [
      season({ id: 'a', name: '2025/2026', start_date: '2025-07-01', status: 'closed', is_active: false, created_at: '1' }),
      season({ id: 'b', name: '2026/2027', status: 'active', is_active: true, created_at: '2' }),
    ];
    expect(dedupeSeasons(rows).map((g) => g.season.id)).toEqual(['b', 'a']);
  });
});

describe('canDeleteSeason', () => {
  it('allows deleting empty planning seasons only', () => {
    expect(canDeleteSeason('planning', 0)).toBe(true);
    expect(canDeleteSeason('planning', 3)).toBe(false);
    expect(canDeleteSeason('active', 0)).toBe(false);
    expect(canDeleteSeason('archived', 0)).toBe(false);
    expect(canDeleteSeason('closed', 0)).toBe(false);
  });
});

describe('suggestNextSeasonFromList', () => {
  it('derives from the most recent season and skips taken names', () => {
    const s1 = suggestNextSeasonFromList([{ name: '2025/2026', start_date: '2025-07-01' }]);
    expect(s1.name).toBe('2026/2027');
    expect(s1.start_date).toBe('2026-07-01');
    expect(s1.end_date).toBe('2027-06-30');

    const s2 = suggestNextSeasonFromList([
      { name: '2025/2026', start_date: '2025-07-01' },
      { name: '2026/2027', start_date: '2026-07-01' },
    ]);
    expect(s2.name).toBe('2027/2028');
  });
});

describe('isValidSeasonName', () => {
  it('accepts consecutive-year names', () => {
    expect(isValidSeasonName('2026/2027')).toBe(true);
  });
  it('rejects non consecutive years and junk', () => {
    expect(isValidSeasonName('2026/2028')).toBe(false);
    expect(isValidSeasonName('abc')).toBe(false);
    expect(isValidSeasonName('2026-2027')).toBe(false);
  });
});

describe('getSeasonEditRules', () => {
  it('allows everything for planning and active', () => {
    for (const st of ['planning', 'active'] as const) {
      const r = getSeasonEditRules(st);
      expect(r.canEdit && r.canEditName && r.canEditDates).toBe(true);
    }
  });
  it('locks dates for closed and blocks archived', () => {
    expect(getSeasonEditRules('closed')).toMatchObject({ canEdit: true, canEditName: true, canEditDates: false });
    expect(getSeasonEditRules('archived').canEdit).toBe(false);
  });
});

describe('detectRenamedSeason', () => {
  const active = season({ id: 'a', name: '2026/2027', status: 'active', is_active: true, created_at: '1' });
  it('flags data older than the season start', () => {
    expect(detectRenamedSeason(active, { matches: 3, trainings: 1, minDate: '2025-09-10', maxDate: '2026-05-01' })).toBe(true);
  });
  it('does not flag consistent data or empty seasons', () => {
    expect(detectRenamedSeason(active, { matches: 1, trainings: 0, minDate: '2026-09-10', maxDate: '2027-01-01' })).toBe(false);
    expect(detectRenamedSeason(active, { matches: 0, trainings: 0, minDate: null, maxDate: null })).toBe(false);
    expect(detectRenamedSeason(null, undefined)).toBe(false);
  });
});

describe('seasonPeriodWarning', () => {
  it('is silent for july-june seasons and warns otherwise', () => {
    expect(seasonPeriodWarning('2026-07-01', '2027-06-30')).toBeNull();
    expect(seasonPeriodWarning('2026-01-01', '2026-03-01')).toBeTruthy();
  });
});
