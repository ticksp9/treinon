import { describe, it, expect } from 'vitest';
import { PHASES, adherence, hoursInPhase, moveTo, phaseComplete, phaseOf, toggleCheck } from '@/lib/rehab';

describe('rehab phases', () => {
  it('has six phases in each protocol, ending with the return to play', () => {
    expect(PHASES.standard).toHaveLength(6);
    expect(PHASES.concussion).toHaveLength(6);
    expect(phaseOf('concussion', 6)?.name).toMatch(/Regresso ao jogo/);
    expect(phaseOf('standard', null)).toBeNull();
  });

  it('a phase is passed when all its criteria are ticked', () => {
    let c = toggleCheck({}, 1, 0);
    c = toggleCheck(c, 1, 1);
    expect(phaseComplete('standard', 1, c)).toBe(false);
    c = toggleCheck(c, 1, 2);
    expect(phaseComplete('standard', 1, c)).toBe(true);
    c = toggleCheck(c, 1, 2);
    expect(phaseComplete('standard', 1, c)).toBe(false);
  });

  it('keeps the history of moves, marking a step back', () => {
    const today = new Date('2026-10-19T10:00:00');
    const up = moveTo({ rehab_phase: 2, rehab_history: [] }, 3, 'u', today);
    expect(up).toMatchObject({ rehab_phase: 3, rehab_phase_since: '2026-10-19' });
    expect(up.rehab_history).toEqual([{ phase: 3, at: '2026-10-19', by: 'u' }]);
    const down = moveTo({ rehab_phase: 3, rehab_history: up.rehab_history }, 2, 'u', today);
    expect(down.rehab_history[1]).toEqual({ phase: 2, at: '2026-10-19', by: 'u', back: true });
  });

  it('counts the hours in a phase (concussion needs 24)', () => {
    expect(hoursInPhase('2026-10-18', new Date('2026-10-19T12:00:00'))).toBe(36);
    expect(hoursInPhase(null)).toBeNull();
  });

  it('counts the days each home exercise was done in the last week', () => {
    const today = new Date('2026-10-19T12:00:00');
    const a = adherence([
      { exercise_id: 'a', done_on: '2026-10-19' }, { exercise_id: 'a', done_on: '2026-10-13' }, { exercise_id: 'a', done_on: '2026-10-12' },
      { exercise_id: 'b', done_on: '2026-10-18' },
    ], today);
    expect(a.get('a')).toBe(2);
    expect(a.get('b')).toBe(1);
  });
});
