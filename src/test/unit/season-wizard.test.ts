import { describe, it, expect } from 'vitest';
import { suggestNextSeason, buildSeasonFromFirstYear, formatSeasonPeriod } from '@/lib/season-service';
import { buildClubProposals, buildCoachProposals, matchTeamForAgeGroup, type TransitionSource } from '@/lib/season-roster-service';

const ageGroups = [
  { id: 'sub13', code: 'SUB13', name: 'Sub-13', min_birth_year: 2013, max_birth_year: 2014, display_order: 1, is_active: true },
  { id: 'sub15', code: 'SUB15', name: 'Sub-15', min_birth_year: 2011, max_birth_year: 2012, display_order: 2, is_active: true },
] as any;

const source: TransitionSource = {
  ageGroups,
  teams: [
    { id: 't13', name: 'Sub-13 A', category: 'Sub-13' },
    { id: 't15', name: 'Sub-15 A', category: 'SUB 15' },
  ],
  players: [
    { player_id: 'p1', name: 'Ana', birth_date: '2012-05-01', team_id: 't13', team_name: 'Sub-13 A', age_group_id: 'sub13', status: 'active' },
    { player_id: 'p2', name: 'Bruno', birth_date: '2013-09-01', team_id: 't13', team_name: 'Sub-13 A', age_group_id: 'sub13', status: 'active' },
    { player_id: 'p3', name: 'Caio', birth_date: null, team_id: null, team_name: null, age_group_id: null, status: 'active' },
  ],
};

describe('season suggestion', () => {
  it('advances a "2025/2026" style name by one year', () => {
    expect(suggestNextSeason({ name: '2025/2026' }).name).toBe('2026/2027');
  });
  it('builds July to June periods', () => {
    const s = buildSeasonFromFirstYear(2026);
    expect(s.start_date).toBe('2026-07-01');
    expect(s.end_date).toBe('2027-06-30');
    expect(s.reference_date).toBe('2026-12-31');
  });
  it('formats the period', () => {
    expect(formatSeasonPeriod('2026-07-01', '2027-06-30')).toBe('01/07/2026 – 30/06/2027');
  });
});

describe('club proposals', () => {
  const rows = buildClubProposals(source, '2025-12-31');
  it('promotes a player whose birth year no longer fits the group', () => {
    const ana = rows.find((r) => r.player_id === 'p1')!;
    expect(ana.target_age_group_id).toBe('sub15');
    expect(ana.action).toBe('promotes');
    expect(ana.selected).toBe(true);
  });
  it('keeps a player in the same group', () => {
    const bruno = rows.find((r) => r.player_id === 'p2')!;
    expect(bruno.target_age_group_id).toBe('sub13');
    expect(bruno.action).toBe('stays');
  });
  it('keeps a player without a birth date selected for verification', () => {
    const caio = rows.find((r) => r.player_id === 'p3')!;
    expect(caio.target_age_group_id).toBeNull();
    expect(caio.action).toBe('unknown');
    expect(caio.selected).toBe(true);
  });
});

describe('coach proposals', () => {
  it('keeps only still-eligible players when staying in the same group', () => {
    const rows = buildCoachProposals(source, '2025-12-31', { keepSameAgeGroup: true, targetAgeGroupId: null, targetTeamId: null });
    expect(rows.find((r) => r.player_id === 'p1')!.selected).toBe(false); // 2012 out of Sub-13
    expect(rows.find((r) => r.player_id === 'p1')!.action).toBe('promotes');
    expect(rows.find((r) => r.player_id === 'p2')!.selected).toBe(true);
    expect(rows.find((r) => r.player_id === 'p2')!.action).toBe('stays');
  });
  it('marks players without birth date as "unknown" and keeps them by default', () => {
    const rows = buildCoachProposals(source, '2025-12-31', { keepSameAgeGroup: true, targetAgeGroupId: 'sub13', targetTeamId: 't13' });
    const caio = rows.find((r) => r.player_id === 'p3')!;
    expect(caio.action).toBe('unknown');
    expect(caio.selected).toBe(true);
    expect(caio.target_age_group_id).toBe('sub13');
  });
  it('moves eligible players to the chosen group and team', () => {
    const rows = buildCoachProposals(source, '2025-12-31', { keepSameAgeGroup: false, targetAgeGroupId: 'sub15', targetTeamId: 't15' });
    const ana = rows.find((r) => r.player_id === 'p1')!;
    expect(ana.selected).toBe(true);
    expect(ana.target_team_id).toBe('t15');
  });
});


describe('team matching', () => {
  it('matches team category to the age group code or name', () => {
    expect(matchTeamForAgeGroup(ageGroups[1], source.teams)).toBe('t15');
    expect(matchTeamForAgeGroup(null, source.teams)).toBeNull();
  });
});
