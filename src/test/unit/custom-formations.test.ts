import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ upsert: async () => ({ error: null }), delete: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }) }) } }));
import {
  buildFormationFromCode, formationCodeProblem, getFormation, listAvailableFormations, parseFormationCode, setCustomFormations,
} from '@/lib/tactical-formations';
import { addCustomFormation, customFormationCodes, hasFormationLayout, removeCustomFormation, saveFormationLayout } from '@/lib/custom-formations';
import { emptyBoard, formationLines, layoutFromBoard, moveToken, placeFormation, positionsAt, removeToken } from '@/lib/tactic-board';

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

  it('positions dragged on the board become the drawing of the formation', async () => {
    await addCustomFormation('u1', 'football_9', '4-1-2-1');
    let b = placeFormation(emptyBoard('football_9'), 'home', '4-1-2-1');
    // untouched board gives back the default layout
    const def = getFormation('football_9', '4-1-2-1')!;
    const same = layoutFromBoard(b)!;
    def.slots.forEach((sl) => { expect(same[sl.slot_id][0]).toBeCloseTo(sl.x, 1); expect(same[sl.slot_id][1]).toBeCloseTo(sl.y, 1); });
    // the striker (last slot) is dragged wide and deeper
    const striker = b.tokens[b.tokens.length - 1];
    b = moveToken(b, striker.id, 0, [striker.x - 10, striker.y + 18]);
    const layout = layoutFromBoard(b)!;
    await saveFormationLayout('u1', 'football_9', '4-1-2-1', layout);
    expect(hasFormationLayout('football_9', '4-1-2-1')).toBe(true);
    // a new board opens with the saved drawing
    const again = placeFormation(emptyBoard('football_9'), 'home', '4-1-2-1');
    const s2 = again.tokens[again.tokens.length - 1];
    expect(s2.x).toBeCloseTo(striker.x - 10, 0);
    expect(s2.y).toBeCloseTo(striker.y + 18, 0);
    // the others did not move
    expect(again.tokens[1].x).toBeCloseTo(b.tokens[1].x, 0);
    // a board that no longer has the whole team cannot be saved as the formation
    expect(layoutFromBoard(removeToken(b, striker.id))).toBeNull();
    // back to the original positions
    await saveFormationLayout('u1', 'football_9', '4-1-2-1', null);
    expect(hasFormationLayout('football_9', '4-1-2-1')).toBe(false);
    expect(customFormationCodes('football_9')).toContain('4-1-2-1');
    const reset = placeFormation(emptyBoard('football_9'), 'home', '4-1-2-1');
    expect(reset.tokens[reset.tokens.length - 1].x).toBeCloseTo(striker.x, 0);
    await removeCustomFormation('u1', 'football_9', '4-1-2-1');
  });

  it('a formation of the app can get my drawing too, without becoming "mine" in the list', async () => {
    let b = placeFormation(emptyBoard('football_9'), 'home', '3-3-2');
    const gk = b.tokens[0];
    b = moveToken(b, b.tokens[2].id, 0, [b.tokens[2].x + 8, b.tokens[2].y]);
    await saveFormationLayout('u1', 'football_9', '3-3-2', layoutFromBoard(b));
    expect(customFormationCodes('football_9')).not.toContain('3-3-2');
    expect(listAvailableFormations('football_9').filter((f) => f.code === '3-3-2')).toHaveLength(1);
    const again = placeFormation(emptyBoard('football_9'), 'home', '3-3-2');
    expect(again.tokens[2].x).toBeCloseTo(b.tokens[2].x, 0);
    expect(again.tokens[0].x).toBeCloseTo(gk.x, 0);
    await saveFormationLayout('u1', 'football_9', '3-3-2', null);
    expect(placeFormation(emptyBoard('football_9'), 'home', '3-3-2').tokens[2].x).toBeCloseTo(b.tokens[2].x - 8, 0);
  });
});
