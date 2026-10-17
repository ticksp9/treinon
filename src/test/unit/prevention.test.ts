import { describe, it, expect } from 'vitest';
import { addWorkingDays, daysLeft, examState, growthVelocity, measureDue, oneYearFrom, warmupByWeek } from '@/lib/prevention';

const today = new Date('2026-10-20T12:00:00');

describe('prevention', () => {
  it('works out growth in cm per year, needing at least two months between measures', () => {
    expect(growthVelocity([{ measured_on: '2026-04-20', height_cm: 148 }, { measured_on: '2026-10-20', height_cm: 152 }])?.cmYear).toBeCloseTo(8, 0);
    expect(growthVelocity([{ measured_on: '2026-09-20', height_cm: 150 }, { measured_on: '2026-10-20', height_cm: 151 }])).toBeNull();
    expect(growthVelocity([{ measured_on: '2026-10-20', height_cm: 151 }])).toBeNull();
    // prefers the measure nearest six months back
    const v = growthVelocity([{ measured_on: '2025-10-20', height_cm: 140 }, { measured_on: '2026-04-20', height_cm: 146 }, { measured_on: '2026-10-20', height_cm: 149 }]);
    expect(v?.from).toBe('2026-04-20');
  });

  it('says when it is time to measure again (3 months)', () => {
    expect(measureDue([{ measured_on: '2026-09-01', height_cm: 150 }], today)).toBe(false);
    expect(measureDue([{ measured_on: '2026-06-01', height_cm: 150 }], today)).toBe(true);
    expect(measureDue([], today)).toBe(true);
  });

  it('knows when the medical exam runs out', () => {
    expect(examState(null, today)).toBe('missing');
    expect(examState('2026-10-19', today)).toBe('expired');
    expect(examState('2026-11-10', today)).toBe('soon');
    expect(examState('2027-03-01', today)).toBe('ok');
    expect(oneYearFrom('2026-10-17')).toBe('2027-10-16');
  });

  it('counts the insurance deadline in working days', () => {
    // Friday 16/10 + 5 working days = Friday 23/10
    expect(addWorkingDays('2026-10-16', 5)).toBe('2026-10-23');
    // Saturday counts from Monday
    expect(addWorkingDays('2026-10-17', 1)).toBe('2026-10-19');
    expect(daysLeft('2026-10-23', today)).toBe(3);
  });

  it('counts the warm-up per week', () => {
    const w = warmupByWeek([
      { date: '2026-10-19T17:30:00Z', prevention_warmup: true },
      { date: '2026-10-14T17:30:00Z', prevention_warmup: true }, { date: '2026-10-15T17:30:00Z', prevention_warmup: false },
      { date: '2026-10-22T17:30:00Z', prevention_warmup: true },
    ], 2, today);
    expect(w).toEqual([{ week: '2026-10-12', done: 1, total: 2 }, { week: '2026-10-19', done: 1, total: 1 }]);
  });
});
