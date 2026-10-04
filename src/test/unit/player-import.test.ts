import { describe, it, expect } from 'vitest';
import { detectHeader, extractPlayers, parseBirth, parseCsv, isDuplicate, suggestBirthYears, teamsForYear, parsePosition, parseFoot } from '@/lib/player-import';

describe('player import from the club spreadsheet', () => {
  it('finds the header under a title (attendance sheet with dates as columns)', () => {
    const rows = [
      ['Época 2026/2027', null, null],
      ['Folha de Presenças', null, null],
      ['Nome', new Date(Date.UTC(2026, 8, 30)), new Date(Date.UTC(2026, 9, 1))],
      ['Abraham', null, null],
      ['  Bruno   Silva ', null, null],
      [null, null, null],
      ['Lia Costa', 'x', null],
    ];
    const { headerIndex, mapping } = detectHeader(rows);
    expect(headerIndex).toBe(2);
    expect(mapping).toEqual({ name: 0 });
    const players = extractPlayers(rows, headerIndex, mapping);
    expect(players.map((p) => p.name)).toEqual(['Abraham', 'Bruno Silva', 'Lia Costa']);
    expect(players[0].birth_date).toBeNull();
  });

  it('maps a full club sheet', () => {
    const rows = [
      ['Nome', 'Apelido', 'Data Nasc.', 'Nº', 'Posição', 'Pé', 'Encarregado de Educação', 'Telefone EE', 'Email EE'],
      ['Rui', 'Gomes', '07/03/2014', 1, 'GR', 'Direito', 'Ana Gomes', '912345678', 'ana@mail.pt'],
      ['Tomás', 'Reis', new Date(Date.UTC(2013, 11, 31)), '10', 'Avançado', 'E', '', '', 'sem-email'],
    ];
    const { headerIndex, mapping } = detectHeader(rows);
    expect(mapping).toMatchObject({ name: 0, last_name: 1, birth_date: 2, number: 3, position: 4, foot: 5, parent_name: 6, parent_phone: 7, parent_email: 8 });
    const [a, b] = extractPlayers(rows, headerIndex, mapping);
    expect(a).toMatchObject({ name: 'Rui Gomes', birth_date: '2014-03-07', birth_year: 2014, number: 1, position: 'GK', foot: 'right', parent_name: 'Ana Gomes', parent_phone: '912345678', parent_email: 'ana@mail.pt' });
    expect(b).toMatchObject({ name: 'Tomás Reis', birth_date: '2013-12-31', number: 10, position: 'ST', foot: 'left', parent_email: null });
  });

  it('understands the usual birth date formats', () => {
    expect(parseBirth('2014-03-07').date).toBe('2014-03-07');
    expect(parseBirth('7-3-14').date).toBe('2014-03-07');
    expect(parseBirth(2014)).toEqual({ date: '2014-01-01', year: 2014, yearOnly: true });
    expect(parseBirth(41705).date).toBe('2014-03-07'); // Excel serial
    expect(parseBirth(null, '2013').year).toBe(2013);
    expect(parseBirth('abc').date).toBeNull();
    expect(parsePosition('Ponta de lança')).toBe('ST');
    expect(parseFoot('canhoto')).toBe('left');
  });

  it('reads CSV with semicolons and quotes', () => {
    expect(parseCsv('Nome;Ano\n"Silva; João";2014\nAna;2013\n')).toEqual([['Nome', 'Ano'], ['Silva; João', '2014'], ['Ana', '2013']]);
  });

  it('spots players that already exist', () => {
    const existing = [{ name: 'Rodrigo Simões', birth_date: '2014-05-01' }, { name: 'Diogo', birth_date: null }];
    const row = (name: string, year: number | null) => ({ name, birth_year: year } as Parameters<typeof isDuplicate>[0]);
    expect(isDuplicate(row('rodrigo simoes', 2014), existing)).toBe(true);
    expect(isDuplicate(row('Rodrigo Simões', 2013), existing)).toBe(false); // same name, other year
    expect(isDuplicate(row('Diogo', 2015), existing)).toBe(true);
    expect(isDuplicate(row('Diogo Fernandes', null), existing)).toBe(false);
  });

  it('distributes by birth year (2013+2014 → Sub-13), possibly to two teams', () => {
    expect(suggestBirthYears('Sub-13', 2026)).toEqual([2014, 2015]);
    expect(suggestBirthYears('Seniores', 2026)).toEqual([]);
    const teams = [
      { id: 'sub13', name: 'Sub-13', category: 'Sub-13', birth_years: [2013, 2014] },
      { id: 'sub12', name: 'Sub-12', category: 'Sub-12', birth_years: [2014, 2015] },
    ];
    expect(teamsForYear(2013, teams)).toEqual(['sub13']);
    expect(teamsForYear(2014, teams)).toEqual(['sub13', 'sub12']);
    expect(teamsForYear(2016, teams)).toEqual([]);
    expect(teamsForYear(null, teams)).toEqual([]);
  });
});
