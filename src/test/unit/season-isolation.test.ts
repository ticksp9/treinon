import { describe, it, expect } from 'vitest';
import { isPlayerEligibleForAgeGroup, type AgeGroupRule } from '@/lib/age-group-rules';

const sub13: AgeGroupRule = {
  id: 'sub13', code: 'SUB13', name: 'Infantis',
  min_birth_year: 2013, max_birth_year: 2014, display_order: 2, is_active: true,
};

/** Mirrors the back-fill rule: season whose [start,end] contains the record date. */
function seasonForDate(date: string, seasons: { id: string; start: string; end: string }[]) {
  const inside = seasons.find((s) => date >= s.start && date <= s.end);
  if (inside) return inside.id;
  const previous = seasons
    .filter((s) => s.end < date)
    .sort((a, b) => b.end.localeCompare(a.end))[0];
  return previous?.id ?? null;
}

/** Mirrors the Matches page filter: strict season match, no legacy null rows. */
function matchFilter(matches: { id: string; season_id: string | null }[], selected: string | null) {
  if (!selected) return matches;
  return matches.filter((m) => m.season_id === selected);
}

/** Mirrors importRosterFromPreviousSeason classification. */
function classifyImport(
  rows: { player_id: string; birth_date: string | null; group: AgeGroupRule | null }[],
  existing: string[],
) {
  const imported: string[] = [];
  const promoted: string[] = [];
  const attention: string[] = [];
  for (const r of rows) {
    const eligible = r.group ? isPlayerEligibleForAgeGroup(r.birth_date, r.group) : (r.birth_date ? true : null);
    if (eligible === false) { promoted.push(r.player_id); continue; }
    if (eligible === null) attention.push(r.player_id);
    if (existing.includes(r.player_id)) continue;
    imported.push(r.player_id);
  }
  return { imported, promoted, attention };
}

describe('season_id back-fill by date', () => {
  const seasons = [
    { id: 's2025', start: '2025-07-31', end: '2026-07-31' },
    { id: 's2026', start: '2026-08-01', end: '2027-07-31' },
  ];

  it('assigns a 18/04/2026 match to the season covering that date', () => {
    expect(seasonForDate('2026-04-18', seasons)).toBe('s2025');
  });

  it('falls back to the closest previous season when outside every range', () => {
    expect(seasonForDate('2028-01-10', seasons)).toBe('s2026');
  });

  it('has no season for dates before any season', () => {
    expect(seasonForDate('2020-01-01', seasons)).toBeNull();
  });
});

describe('matches strict season filter', () => {
  const matches = [
    { id: 'm1', season_id: 's2025' },
    { id: 'm2', season_id: 's2026' },
    { id: 'm3', season_id: null },
  ];

  it('returns only matches of the selected season (no legacy nulls)', () => {
    expect(matchFilter(matches, 's2026').map((m) => m.id)).toEqual(['m2']);
  });

  it('returns everything only when the user has no season', () => {
    expect(matchFilter(matches, null)).toHaveLength(3);
  });
});

describe('import roster from previous season', () => {
  const rows = [
    { player_id: 'ok', birth_date: '2014-05-01', group: sub13 },
    { player_id: 'old', birth_date: '2012-03-01', group: sub13 },
    { player_id: 'nodob', birth_date: null, group: sub13 },
  ];

  it('imports eligible players, skips promoted ones and flags missing birth dates', () => {
    const res = classifyImport(rows, []);
    expect(res.imported).toEqual(['ok', 'nodob']);
    expect(res.promoted).toEqual(['old']);
    expect(res.attention).toEqual(['nodob']);
  });

  it('does not duplicate enrollments on a second import', () => {
    const res = classifyImport(rows, ['ok', 'nodob']);
    expect(res.imported).toEqual([]);
    expect(res.promoted).toEqual(['old']);
  });
});
