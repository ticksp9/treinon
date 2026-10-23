import { describe, it, expect } from 'vitest';
import { cleanPlayerNotes, findSquadPlayer, MAX_PLAYER_NOTES, opponentResult } from '@/lib/opponent-scouting';

const row = (number: string, name: string, note = '', key = false) => ({ number, name, note, key });

describe('notes about the opponent in the match report', () => {
  it('keeps only rows that say who the player is, trimmed', () => {
    expect(cleanPlayerNotes([row('10', '', '  rápido '), row('', '  ', 'sem ninguém'), row('', ' Rui ', 'canhoto', true)]))
      .toEqual([row('10', '', 'rápido'), row('', 'Rui', 'canhoto', true)]);
  });

  it('accepts only digits as the shirt number and caps the list', () => {
    expect(cleanPlayerNotes([row('n.º 7a', '')])[0].number).toBe('7');
    expect(cleanPlayerNotes(Array.from({ length: 60 }, (_, i) => row(String(i + 1), '')))).toHaveLength(MAX_PLAYER_NOTES);
  });

  it('finds the squad player by number, otherwise by name', () => {
    const squad = [{ id: 'a', shirt_number: '10', name: 'Rui' }, { id: 'b', shirt_number: null, name: 'João Sá' }];
    expect(findSquadPlayer(squad, { number: '10', name: '' })?.id).toBe('a');
    expect(findSquadPlayer(squad, { number: '', name: 'joao sa' })?.id).toBe('b');
    expect(findSquadPlayer(squad, { number: '9', name: '' })).toBeUndefined();
  });

  it('writes the score as the opponent sheet reads it (their goals first)', () => {
    expect(opponentResult(3, 1)).toBe('1-3');
    expect(opponentResult(null, 1)).toBeNull();
  });
});
