import { describe, it, expect } from 'vitest';
import { careGroups, daysOut, isEarlyRecurrence, seasonSummary, severityByDays } from '@/lib/injury-care';

const today = new Date('2026-10-18T12:00:00');

describe('injury care', () => {
  it('counts the days out, until the return or until today', () => {
    expect(daysOut('2026-10-01', '2026-10-09', today)).toBe(8);
    expect(daysOut('2026-10-15', null, today)).toBe(3);
    expect(daysOut('2026-10-18', '2026-10-18', today)).toBe(0);
  });

  it('grades severity by days out (FIFA consensus)', () => {
    expect([0, 1, 3, 7, 8, 28, 29].map((d) => severityByDays(d).key)).toEqual(['slight', 'slight', 'minimal', 'mild', 'moderate', 'moderate', 'severe']);
  });

  it('spots an early recurrence: same place and type within 2 months of returning', () => {
    const history = [{ injury_date: '2026-08-01', return_date: '2026-08-20', body_part: 'thigh', injury_type: 'muscle' }];
    expect(isEarlyRecurrence({ injury_date: '2026-10-10', body_part: 'thigh', injury_type: 'muscle' }, history)).toBe(true);
    expect(isEarlyRecurrence({ injury_date: '2026-11-10', body_part: 'thigh', injury_type: 'muscle' }, history)).toBe(false);
    expect(isEarlyRecurrence({ injury_date: '2026-10-10', body_part: 'knee', injury_type: 'muscle' }, history)).toBe(false);
    expect(isEarlyRecurrence({ injury_date: '2026-10-10', body_part: 'thigh', injury_type: 'muscle' }, [{ ...history[0], return_date: null }])).toBe(false);
  });

  it('files each injury where the medical department looks for it', () => {
    const base = { id: 'x', injury_date: '2026-10-10', return_date: null, body_part: 'knee', injury_type: 'sprain', clinical_status: 'inapto', can_play: false, expected_return_date: null, assessed_at: null, restrictions: null };
    expect(careGroups(base, today)).toEqual(['to_assess', 'out']);
    expect(careGroups({ ...base, assessed_at: '2026-10-11', clinical_status: 'condicionado', can_play: true, expected_return_date: '2026-10-22' }, today)).toEqual(['limited', 'back_soon']);
    expect(careGroups({ ...base, return_date: '2026-10-12' }, today)).toEqual(['recently_cleared']);
    expect(careGroups({ ...base, return_date: '2026-09-01' }, today)).toEqual([]);
  });

  it('sums up the season for the leadership', () => {
    const s = seasonSummary([
      { injury_date: '2026-09-01', return_date: '2026-09-11', body_part: 'ankle', injury_type: 'sprain', mechanism: 'contact' },
      { injury_date: '2026-10-01', return_date: null, body_part: 'ankle', injury_type: 'sprain', mechanism: 'contact', is_recurrence: true },
      { injury_date: '2026-10-10', return_date: '2026-10-12', body_part: 'thigh', injury_type: 'muscle', mechanism: 'non_contact' },
    ], today);
    expect(s).toMatchObject({ injuries: 3, open: 1, daysLost: 10 + 17 + 2, recurrences: 1 });
    expect(s.byPart[0]).toEqual({ part: 'ankle', n: 2 });
    expect(s.byMechanism[0]).toEqual({ mechanism: 'contact', n: 2 });
  });
});
