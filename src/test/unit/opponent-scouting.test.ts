import { describe, it, expect } from 'vitest';
import { MOMENTS, headToHead, matchesAgainst, newSchemeBoard, normalizeTeamName, sameTeam, schemesByMoment, sheetSummary, sortSquad, type OpponentScheme } from '@/lib/opponent-scouting';

describe('opponent scouting', () => {
  it('recognises the same team written in different ways', () => {
    expect(normalizeTeamName(' G.D. São João ')).toBe('g d sao joao');
    expect(sameTeam('Estrela do Monte', 'estrela  do monte')).toBe(true);
    expect(sameTeam('Estrela do Monte', 'Estrela do Monte B')).toBe(false);
    expect(sameTeam('', '')).toBe(false);
  });

  it('finds our matches against a team, most recent first, and sums only finished ones', () => {
    const matches = [
      { id: '1', opponent_name: 'Rival FC', match_date: '2026-09-01', status: 'completed', goals_for: 2, goals_against: 1 },
      { id: '2', opponent_name: 'rival fc', match_date: '2026-10-01', status: 'completed', goals_for: 0, goals_against: 0 },
      { id: '3', opponent_name: 'Rival FC', match_date: '2026-11-01', status: 'scheduled', goals_for: null, goals_against: null },
      { id: '4', opponent_name: 'Outro', match_date: '2026-10-05', status: 'completed', goals_for: 5, goals_against: 0 },
      { id: '5', opponent_name: 'Rival FC', match_date: '2026-08-01', status: 'completed', goals_for: 1, goals_against: 3 },
    ];
    const vs = matchesAgainst(matches, 'Rival FC');
    expect(vs.map((m) => m.id)).toEqual(['3', '2', '1', '5']);
    expect(headToHead(vs)).toEqual({ played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 4 });
  });

  it('puts key players first, then by shirt number', () => {
    const squad = sortSquad([
      { is_key: false, shirt_number: '4', name: 'Quatro' },
      { is_key: true, shirt_number: '10', name: 'Dez' },
      { is_key: false, shirt_number: null, name: 'Sem numero' },
      { is_key: false, shirt_number: '1', name: 'Um' },
      { is_key: true, shirt_number: '7', name: 'Sete' },
    ]);
    expect(squad.map((p) => p.name)).toEqual(['Sete', 'Dez', 'Um', 'Quatro', 'Sem numero']);
  });

  it('starts a scheme with the opponent in red, in his usual shape', () => {
    const b = newSchemeBoard('football_11', 'attack', '4-3-3');
    expect(b.tokens).toHaveLength(11);
    expect(b.tokens.every((t) => t.kind === 'away')).toBe(true);
    expect(b.awayFormation).toBe('4-3-3');
    expect(b.half).toBe(false);
    // set pieces open on half a pitch; an unknown formation falls back to the first of the format
    const sp = newSchemeBoard('football_7', 'set_piece_for', '9-9-9');
    expect(sp.half).toBe(true);
    expect(sp.tokens).toHaveLength(7);
  });

  it('files the schemes under every moment, even the empty ones', () => {
    const s = (id: string, moment: OpponentScheme['moment']) => ({ id, moment } as OpponentScheme);
    const g = schemesByMoment([s('a', 'attack'), s('b', 'defense'), s('c', 'attack')]);
    expect(Object.keys(g)).toEqual(MOMENTS.map((m) => m.key));
    expect(g.attack.map((x) => x.id)).toEqual(['a', 'c']);
    expect(g.set_piece_against).toEqual([]);
  });

  it('says in one line what a sheet holds', () => {
    expect(sheetSummary({ schemes: 3, players: 1, observations: 0 })).toBe('3 esquemas · 1 jogador');
    expect(sheetSummary({ schemes: 0, players: 0, observations: 0 })).toBe('Ficha ainda vazia');
  });
});
