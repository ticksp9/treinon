import { describe, it, expect } from 'vitest';
import { actionStats, durationLabel, inSeason, transitionStats, transitionTarget } from '@/lib/transitions';
import { cleanGuidelines, exampleTransitionPlan, guidelinesProgress } from '@/lib/guidelines';

describe('transition of players', () => {
  it('names where the player went', () => {
    const names = (id: string) => (id === 't15' ? 'Sub-15' : undefined);
    expect(transitionTarget({ to_team_id: 't15', to_team_name: null }, names)).toBe('Sub-15');
    expect(transitionTarget({ to_team_id: null, to_team_name: 'Sub-15 B' }, names)).toBe('Sub-15 B');
    expect(transitionTarget({ to_team_id: 'gone', to_team_name: null }, names)).toBe('—');
  });

  it('counts players, records and the ones still to evaluate', () => {
    expect(transitionStats([
      { player_id: 'a', evaluation: 'Bem' }, { player_id: 'a', evaluation: null }, { player_id: 'b', evaluation: ' ' },
    ])).toEqual({ records: 3, players: 2, withoutEvaluation: 2 });
  });

  it('keeps only the season dates', () => {
    const season = { start_date: '2026-07-01', end_date: '2027-06-30T00:00:00' };
    expect(inSeason('2026-07-01', season)).toBe(true);
    expect(inSeason('2027-06-30', season)).toBe(true);
    expect(inSeason('2026-06-30', season)).toBe(false);
  });

  it('the transition plan is written when it says who moves up and how', () => {
    expect(guidelinesProgress({ transition: { criteria: 'x' } }).hasTransition).toBe(false);
    expect(guidelinesProgress({ transition: { criteria: 'x', process: 'y' } }).hasTransition).toBe(true);
    const ex = exampleTransitionPlan();
    expect(ex.criteria).toBeTruthy();
    expect(ex.criteria).not.toMatch(/^Ex/);
    expect(cleanGuidelines({ transition: { criteria: ' a ', process: '', followUp: 'b' } }).transition).toEqual({ criteria: 'a', followUp: 'b' });
  });
});

describe('training actions for coaches', () => {
  it('counts actions with all the coaching staffs and the hours', () => {
    expect(actionStats([
      { kind: 'course', all_staff: true, duration_minutes: 120 }, { kind: 'meeting', all_staff: false, duration_minutes: null },
    ])).toEqual({ total: 2, withAllStaff: 1, minutes: 120 });
  });

  it('shows the length simply', () => {
    expect(durationLabel(150)).toBe('2 h 30');
    expect(durationLabel(120)).toBe('2 h');
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(null)).toBe('');
  });
});

describe('next age group', () => {
  it('suggests the team just above', async () => {
    const { nextAgeTeam } = await import('@/lib/guidelines');
    const teams = [{ id: 's17', category: 'Sub-17' }, { id: 's9', category: 'Sub-9' }, { id: 's15', category: 'Sub-15' }, { id: 'x', category: null }];
    expect(nextAgeTeam(teams, 'Sub-13')?.id).toBe('s15');
    expect(nextAgeTeam(teams, 'Sub-17')).toBeNull();
    expect(nextAgeTeam(teams, null)).toBeNull();
  });
});
