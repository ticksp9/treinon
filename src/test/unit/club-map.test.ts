import { describe, it, expect } from 'vitest';
import { findClashes, weekStart, fixturesText, timetableText, type TrainingSlot, type MapMatch } from '@/lib/club-map';

const slot = (id: string, team: string, weekday: number, a: string, b: string, loc: string | null): TrainingSlot =>
  ({ id, team_id: team, weekday, start_time: a, end_time: b, location: loc, notes: null });

describe('club map', () => {
  it('flags two teams on the same field at the same time', () => {
    const c = findClashes([
      slot('a', 't1', 2, '18:30', '20:00', 'Campo 1'),
      slot('b', 't2', 2, '19:30', '21:00', 'campo 1 '),  // overlaps a (same field, different case)
      slot('c', 't3', 2, '20:00', '21:30', 'Campo 2'),   // other field
      slot('d', 't4', 3, '18:30', '20:00', 'Campo 1'),   // other day
      slot('e', 't5', 2, '20:00', '21:00', null),        // no field → never a clash
    ]);
    expect([...c].sort()).toEqual(['a', 'b']);
  });

  it('back-to-back sessions do not clash', () => {
    expect(findClashes([slot('a', 't1', 1, '18:00', '19:30', 'Campo'), slot('b', 't2', 1, '19:30', '21:00', 'Campo')]).size).toBe(0);
  });

  it('week starts on Monday', () => {
    expect(weekStart(new Date(2026, 9, 4)).getDate()).toBe(28);  // Sunday 4 Oct → Monday 28 Sep
    expect(weekStart(new Date(2026, 9, 5)).getDate()).toBe(5);   // Monday stays
  });

  it('builds the WhatsApp texts', () => {
    const m: MapMatch = { id: '1', team_id: 't1', team_name: 'Sub-13', match_date: new Date(2026, 9, 3, 10, 30).toISOString(), opponent_name: 'Rival', is_home: false,
      location: 'Campo do Rival', competition: null, match_type: 'championship', status: 'scheduled', goals_for: null, goals_against: null,
      logistics: { meet_time: '09:15', meet_place: 'Sede', transport: 'Carrinha' }, notes: null };
    const t = fixturesText('Clube', new Date(2026, 8, 28), [m]);
    expect(t).toContain('10:30 · Sub-13 @ Rival · Campo do Rival');
    expect(t).toContain('concentração 09:15 (Sede) · Carrinha');
    expect(timetableText('Clube', [slot('a', 't1', 2, '18:30:00', '20:00:00', 'Campo 1')], () => 'Sub-13')).toContain('18:30–20:00 · Sub-13 · Campo 1');
  });
});
