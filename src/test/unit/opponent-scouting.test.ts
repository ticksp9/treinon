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

import { cleanKeyPoints, nextMatchAgainst, plannedSchemes, sheetForMatch } from '@/lib/opponent-scouting';

describe('game plan', () => {
  it('keeps the key ideas short and clean', () => {
    expect(cleanKeyPoints(['  Pressionar   alto ', '', 'pressionar alto', 'Segundo poste'])).toEqual(['Pressionar alto', 'Segundo poste']);
    expect(cleanKeyPoints(Array.from({ length: 9 }, (_, i) => `Ideia ${i}`))).toHaveLength(6);
  });

  it('finds the sheet of the team a match is against', () => {
    const sheets = [
      { id: 'a', name: 'Rival FC', sport_type: 'football_11' },
      { id: 'b', name: 'rival fc', sport_type: 'football_7' },
      { id: 'c', name: 'Outro', sport_type: 'football_7' },
    ];
    expect(sheetForMatch(sheets, 'Rival FC', null, 'football_7')?.id).toBe('b');
    expect(sheetForMatch(sheets, 'Rival FC')?.id).toBe('a');
    // the plan's own link wins, even if the match was renamed
    expect(sheetForMatch(sheets, 'Rival FC', 'c')?.id).toBe('c');
    expect(sheetForMatch(sheets, 'Desconhecido')).toBeNull();
  });

  it('picks the next match still to play against a team', () => {
    const today = new Date('2026-10-13T15:00:00');
    const matches = [
      { id: 'past', opponent_name: 'Rival FC', match_date: '2026-10-01T10:00:00', status: 'completed' },
      { id: 'today', opponent_name: 'Rival FC', match_date: '2026-10-13T09:00:00', status: 'scheduled' },
      { id: 'later', opponent_name: 'Rival FC', match_date: '2026-11-20T10:00:00', status: 'scheduled' },
      { id: 'other', opponent_name: 'Outro', match_date: '2026-10-14T10:00:00', status: 'scheduled' },
    ];
    expect(nextMatchAgainst(matches, 'Rival FC', today)?.id).toBe('today');
    expect(nextMatchAgainst(matches, 'Ninguem', today)).toBeNull();
  });

  it('shows the picked schemes in the order of the plan and skips deleted ones', () => {
    const s = (id: string) => ({ id } as never);
    expect(plannedSchemes([s('1'), s('2'), s('3')], ['3', 'x', '1']).map((x) => (x as { id: string }).id)).toEqual(['3', '1']);
  });
});
