import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ upsert: async () => ({ error: null }), delete: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }) }) } }));
import {
  buildFormationFromCode, formationCodeProblem, getFormation, listAvailableFormations, parseFormationCode, setCustomFormations,
} from '@/lib/tactical-formations';
import { addCustomFormation, customFormationCodes, removeCustomFormation } from '@/lib/custom-formations';
import { emptyBoard, formationLines, placeFormation, positionsAt } from '@/lib/tactic-board';

describe('formations created by the coach', () => {
  beforeEach(() => setCustomFormations({}));

  it('reads what the coach types, however he separates the lines', () => {
    expect(parseFormationCode('4-1-2-1')).toEqual([4, 1, 2, 1]);
    expect(parseFormationCode(' 4 1 2 1 ')).toEqual([4, 1, 2, 1]);
    expect(parseFormationCode('4.1.2.1')).toEqual([4, 1, 2, 1]);
    expect(parseFormationCode('quatro')).toBeNull();
    expect(parseFormationCode('9')).toBeNull();
  });

  it('accepts 4-1-2-1 in football 9 and explains what is wrong otherwise', () => {
    expect(formationCodeProblem('football_9', '4-1-2-1')).toBeNull();
    expect(formationCodeProblem('football_9', '4-4-2')).toContain('somar 8');
    expect(formationCodeProblem('football_7', '4-1-2-1')).toContain('somar 6');
    expect(formationCodeProblem('football_9', 'abc')).toContain('4-1-2-1');
  });

  it('lays out 4-1-2-1: keeper, four at the back, a holder, two, one striker', () => {
    const f = buildFormationFromCode('football_9', '4 1 2 1')!;
    expect(f.code).toBe('4-1-2-1');
    expect(f.slots).toHaveLength(9);
    expect(new Set(f.slots.map((s) => s.slot_id)).size).toBe(9);
    expect(f.slots.map((s) => s.label)).toEqual(['GR', 'DE', 'DC', 'DC', 'DD', 'MDC', 'ME', 'MD', 'PL']);
    // lines go up the pitch, each one centred, everyone inside it
    const ys = [...new Set(f.slots.slice(1).map((s) => s.y))];
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys).toHaveLength(4);
    f.slots.forEach((s) => { expect(s.x).toBeGreaterThan(0.05); expect(s.x).toBeLessThan(0.95); expect(s.y).toBeLessThan(0.95); });
    const back = f.slots.slice(1, 5).map((s) => s.x);
    expect(back[0] + back[3]).toBeCloseTo(1);
  });

  it('shows up in the list once added, and still draws on a device that has not loaded the list', () => {
    expect(listAvailableFormations('football_9').some((f) => f.code === '4-1-2-1')).toBe(false);
    expect(getFormation('football_9', '4-1-2-1')?.slots).toHaveLength(9); // built on the fly
    setCustomFormations({ football_9: ['4-1-2-1', '4-1-2-1', '3-3-2', '9-9'] });
    const codes = listAvailableFormations('football_9').map((f) => f.code);
    expect(codes.filter((c) => c === '4-1-2-1')).toHaveLength(1);
    expect(codes.filter((c) => c === '3-3-2')).toHaveLength(1); // a built-in one is not duplicated
    expect(codes).not.toContain('9-9');
    expect(getFormation('football_9', 'xpto')).toBeUndefined();
  });

  it('works on the tactical board, with the sector lines', () => {
    const b = placeFormation(emptyBoard('football_9'), 'home', '4-1-2-1');
    expect(b.tokens).toHaveLength(9);
    expect(b.homeFormation).toBe('4-1-2-1');
    expect(formationLines(b, 'home', positionsAt(b, 0)).map((l) => l.length)).toEqual([4, 2]);
  });

  it('a formation created by mistake can be removed from the list; what uses it still draws', async () => {
    expect((await addCustomFormation('u1', 'football_9', '4 1 2 1')).code).toBe('4-1-2-1');
    expect((await addCustomFormation('u1', 'football_9', '5-2-1')).code).toBe('5-2-1');
    expect((await addCustomFormation('u1', 'football_9', '4-4-2')).error).toContain('somar 8');
    expect(customFormationCodes('football_9')).toEqual(['4-1-2-1', '5-2-1']);
    await removeCustomFormation('u1', 'football_9', '5-2-1');
    expect(customFormationCodes('football_9')).toEqual(['4-1-2-1']);
    expect(listAvailableFormations('football_9').some((f) => f.code === '5-2-1')).toBe(false);
    expect(getFormation('football_9', '5-2-1')?.slots).toHaveLength(9);
    await removeCustomFormation('u1', 'football_9', '4-1-2-1');
    expect(customFormationCodes('football_9')).toEqual([]);
  });
});
