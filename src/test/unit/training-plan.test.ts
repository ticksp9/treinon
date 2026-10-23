import { describe, it, expect } from 'vitest';
import { cleanPeriods, defaultPeriods, mesoFor, nextMesoDates, seasonWeeks, sessionRecorded, weekNumber, weekStartOf, weekSummary } from '@/lib/training-plan';

describe('season planning', () => {
  it('splits the season in weeks starting on Monday', () => {
    const w = seasonWeeks('2026-09-01', '2026-09-30');
    expect(w[0]).toBe('2026-08-31'); // the Monday of the first day
    expect(w.at(-1)).toBe('2026-09-28');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05'); // a Sunday belongs to the week before
    expect(weekNumber('2026-09-01', '2026-10-05')).toBe(6);
  });

  it('starts the annual plan from the FPF example, on the season dates', () => {
    const p = defaultPeriods('2026-07-01', '2027-06-30');
    expect(p.map((x) => [x.from, x.to])).toEqual([['2026-07-01', '2026-08-31'], ['2026-09-01', '2026-12-31'], ['2027-01-01', '2027-04-30'], ['2027-05-01', '2027-06-30']]);
    // a season that starts in September drops the summer period
    expect(defaultPeriods('2026-09-01', '2027-06-30')[0].from).toBe('2026-09-01');
    expect(cleanPeriods([{ label: ' ', from: '', to: '', priority: '', control: '' }, { label: 'A', from: '', to: '', priority: ' x ', control: '' }])).toHaveLength(1);
  });

  it('finds the block of a day and suggests the next one', () => {
    const mesos = [{ start_date: '2026-09-01', end_date: '2026-10-04' }, { start_date: '2026-10-05', end_date: '2026-11-01' }];
    expect(mesoFor(mesos, '2026-10-05T18:30:00Z')).toBe(mesos[1]);
    expect(mesoFor(mesos, '2026-12-01')).toBeNull();
    expect(nextMesoDates(mesos, '2026-09-01', '2027-06-30')).toEqual({ start: '2026-11-02', end: '2026-11-29' });
    expect(nextMesoDates([], '2026-09-01', '2027-06-30').start).toBe('2026-09-01');
  });

  it('summarises a week: planned, reviewed, sessions recorded', () => {
    const sessions = [
      { date: '2026-10-06T18:30:00Z', closed_at: '2026-10-06T20:00:00Z', exercises: null, status: 'scheduled' },
      { date: '2026-10-08T18:30:00Z', closed_at: null, exercises: '', status: 'scheduled' },
      { date: '2026-10-09T18:30:00Z', closed_at: null, exercises: null, status: 'cancelled' },
      { date: '2026-10-13T18:30:00Z', closed_at: null, exercises: 'rondo', status: 'scheduled' },
    ];
    const s = weekSummary('2026-10-05', { objectives: 'Transições', review: null }, sessions, new Date('2026-10-20'));
    expect(s).toMatchObject({ planned: true, reviewed: false, sessions: 2, recorded: 1, past: true });
    expect(sessionRecorded({ closed_at: null, exercises: 'rondo' })).toBe(true);
  });
});
