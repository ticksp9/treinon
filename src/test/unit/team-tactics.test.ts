import { describe, it, expect } from 'vitest';
import { defaultTacticCode, parseTeamTactics, removeTactic, setDefaultTactic, splitFormations, tacticsFor, upsertTactic } from '@/lib/team-tactics';
import { listAvailableFormations } from '@/lib/tactical-formations';
import { moveSlot, reconcileTactics, resetSlotPositions, tacticsFormation } from '@/lib/live-tactics';

describe('tactics of a team', () => {
  it('the first tactic added is the one matches start with; more can be added and named', () => {
    let m = upsertTactic({}, 'football_9', '4-1-2-1', 'Principal');
    expect(defaultTacticCode(m, 'football_9')).toBe('4-1-2-1');
    m = upsertTactic(m, 'football_9', '3-3-2', 'A defender o resultado');
    expect(tacticsFor(m, 'football_9').list).toEqual([{ code: '4-1-2-1', name: 'Principal' }, { code: '3-3-2', name: 'A defender o resultado' }]);
    expect(defaultTacticCode(m, 'football_9')).toBe('4-1-2-1');
    // renaming does not duplicate
    m = upsertTactic(m, 'football_9', '3-3-2', 'Plano B');
    expect(tacticsFor(m, 'football_9').list).toHaveLength(2);
    expect(tacticsFor(m, 'football_9').list[1].name).toBe('Plano B');
  });

  it('the default can change during the season, and removing it promotes another', () => {
    let m = upsertTactic(upsertTactic({}, 'football_9', '4-1-2-1'), 'football_9', '3-3-2');
    m = setDefaultTactic(m, 'football_9', '3-3-2');
    expect(defaultTacticCode(m, 'football_9')).toBe('3-3-2');
    m = removeTactic(m, 'football_9', '3-3-2');
    expect(defaultTacticCode(m, 'football_9')).toBe('4-1-2-1');
    m = removeTactic(m, 'football_9', '4-1-2-1');
    expect(m).toEqual({});
    expect(defaultTacticCode(m, 'football_9')).toBeNull();
    // making a formation the default also adds it
    expect(tacticsFor(setDefaultTactic({}, 'football_7', '2-3-1'), 'football_7').list).toEqual([{ code: '2-3-1' }]);
  });

  it('each sport has its own tactics (a friendly in another format does not get them)', () => {
    const m = upsertTactic({}, 'football_9', '4-1-2-1');
    expect(defaultTacticCode(m, 'football_11')).toBeNull();
    expect(tacticsFor(m, null).list).toEqual([]);
  });

  it('reads what is saved on the team, ignoring rubbish and formations that do not fit the sport', () => {
    const m = parseTeamTactics({ football_9: { list: [{ code: '4-1-2-1', name: '  Principal  ' }, { code: '4-4-2' }, { code: '4-1-2-1' }, 'x', null], default: '4-4-2' }, futsal: { list: [] }, lixo: 3 });
    expect(m).toEqual({ football_9: { list: [{ code: '4-1-2-1', name: 'Principal' }], default: '4-1-2-1' } });
    expect(parseTeamTactics(null)).toEqual({});
  });

  it('lists my tactics first, the default on top, then the other formations', () => {
    let m = upsertTactic(upsertTactic({}, 'football_9', '4-1-2-1', 'Principal'), 'football_9', '3-3-2');
    m = setDefaultTactic(m, 'football_9', '3-3-2');
    const all = listAvailableFormations('football_9').map((f) => ({ code: f.code, name: f.name }));
    const { mine, others } = splitFormations(all, tacticsFor(m, 'football_9'));
    expect(mine.map((f) => f.label)).toEqual(['3-3-2', '4-1-2-1 · Principal']);
    expect(mine[0].isDefault).toBe(true);
    expect(others.some((f) => f.code === '3-3-2' || f.code === '4-1-2-1')).toBe(false);
    expect(others.length).toBe(all.length - 1); // 4-1-2-1 is not in the catalogue, 3-3-2 is
  });

  it('a new match opens in the team default instead of the first formation of the app', () => {
    const players = [{ player_id: 'a', position: 'GK' }];
    expect(reconcileTactics('football_9', null, players)?.formation).toBe(listAvailableFormations('football_9')[0].code);
    expect(reconcileTactics('football_9', null, players, '4-1-2-1')?.formation).toBe('4-1-2-1');
    // a formation already chosen for the match wins over the default
    expect(reconcileTactics('football_9', { formation: '3-3-2', slots: {} }, players, '4-1-2-1')?.formation).toBe('3-3-2');
    // a default that does not fit the format of this match is ignored
    expect(reconcileTactics('football_7', null, players, '4-1-2-1')?.formation).toBe(listAvailableFormations('football_7')[0].code);
  });

  it('a position dragged in a match stays there, moves its role, and is forgotten when the shape changes', () => {
    const players = [{ player_id: 'a', position: 'GK' }, { player_id: 'b', position: 'CM' }];
    let tac = reconcileTactics('football_9', null, players, '4-3-1')!;
    expect(tac.formation).toBe('4-3-1');
    const before = tacticsFormation('football_9', tac)!.slots.find((s) => s.slot_id === 'L2P1')!;
    expect(before.role).toBe('midfielder_left');
    tac = moveSlot(tac, 'L2P1', 0.1, 0.82);
    const after = tacticsFormation('football_9', tac)!.slots.find((s) => s.slot_id === 'L2P1')!;
    expect([after.x, after.y]).toEqual([0.1, 0.82]);
    expect(after.role).toBe('winger_left');
    // survives a substitution / reload of the match
    expect(reconcileTactics('football_9', tac, players)!.layout).toEqual({ L2P1: [0.1, 0.82] });
    // dragged off the pitch is kept inside it
    expect(moveSlot(tac, 'L2P1', 1.4, -0.2).layout!.L2P1).toEqual([0.97, 0.03]);
    // another formation starts with its own positions
    // (choosing a formation sends the new shape with the players, as the pitch does)
    expect(reconcileTactics('football_9', { formation: '3-3-2', slots: tac.slots }, players)!.layout).toBeUndefined();
    expect(resetSlotPositions(tac).layout).toBeUndefined();
  });
});
