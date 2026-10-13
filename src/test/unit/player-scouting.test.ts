import { describe, it, expect } from 'vitest';
import { ageOf, areaAverages, birthQuarter, cleanLinks, filterPlayers, isMinor, markHistory, observationMark, overallMark, relativeAgeNote, sortPlayers } from '@/lib/player-scouting';

const obs = (technical: number | null, tactical: number | null, physical: number | null, mental: number | null, potential: number | null, observed_on = '2026-10-01') =>
  ({ technical, tactical, physical, mental, potential, observed_on });

describe('player scouting', () => {
  it('averages the marks of each area, ignoring the ones not marked', () => {
    const a = areaAverages([obs(4, 3, null, 4, 5), obs(5, 3, null, 3, null)]);
    expect(a).toEqual({ technical: 4.5, tactical: 3, physical: null, mental: 3.5, potential: 5 });
    expect(overallMark([obs(4, 3, null, 4, 5), obs(5, 3, null, 3, null)])).toBe(4);
    expect(overallMark([])).toBeNull();
  });

  it('gives one mark per observation and the evolution in date order', () => {
    expect(observationMark(obs(4, 4, 3, 3, null))).toBe(3.5);
    expect(observationMark(obs(null, null, null, null, null))).toBeNull();
    expect(markHistory([obs(4, 4, 4, 4, 4, '2026-10-10'), obs(null, null, null, null, null, '2026-10-05'), obs(2, 2, 2, 2, 2, '2026-09-01')]))
      .toEqual([{ date: '2026-09-01', mark: 2 }, { date: '2026-10-10', mark: 4 }]);
  });

  it('knows the age from the date, or from the year alone', () => {
    const today = new Date('2026-10-13T12:00:00');
    expect(ageOf({ birth_date: '2014-10-13', birth_year: null }, today)).toBe(12);
    expect(ageOf({ birth_date: '2014-10-14', birth_year: null }, today)).toBe(11);
    expect(ageOf({ birth_date: null, birth_year: 2000 }, today)).toBe(26);
    expect(ageOf({ birth_date: null, birth_year: null }, today)).toBeNull();
    expect(isMinor({ birth_date: null, birth_year: 2010 }, today)).toBe(true);
    expect(isMinor({ birth_date: null, birth_year: 2000 }, today)).toBe(false);
    // unknown age is not treated as a minor here: the contact needs permission either way
    expect(isMinor({ birth_date: null, birth_year: null }, today)).toBe(false);
  });

  it('warns about relative age only for young players born at the ends of the year', () => {
    const today = new Date('2026-10-13T12:00:00');
    expect(birthQuarter('2014-11-02')).toBe(4);
    expect(birthQuarter('2014-01-31')).toBe(1);
    expect(birthQuarter(null)).toBeNull();
    expect(relativeAgeNote({ birth_date: '2014-11-02', birth_year: null }, today)).toMatch(/mais novos/);
    expect(relativeAgeNote({ birth_date: '2014-02-02', birth_year: null }, today)).toMatch(/mais velhos/);
    expect(relativeAgeNote({ birth_date: '2014-06-02', birth_year: null }, today)).toBeNull();
    expect(relativeAgeNote({ birth_date: '1998-11-02', birth_year: null }, today)).toBeNull();
    expect(relativeAgeNote({ birth_date: null, birth_year: 2014 }, today)).toBeNull();
  });

  it('filters by status, position and text, and lists priorities first', () => {
    const players = [
      { name: 'Zé', current_club: 'Rival FC', category: 'Sub-15', position: 'ST', status: 'identified' as const },
      { name: 'Ana', current_club: 'Outro', category: 'Seniores', position: 'GK', status: 'priority' as const },
      { name: 'Rui', current_club: 'Rival FC', category: 'Sub-15', position: 'ST', status: 'discarded' as const },
      { name: 'Bia', current_club: null, category: null, position: 'CM', status: 'signed' as const },
    ];
    expect(filterPlayers(players, { search: '', status: 'open', position: '' }).map((p) => p.name)).toEqual(['Zé', 'Ana']);
    expect(filterPlayers(players, { search: 'rival', status: 'all', position: 'st' }).map((p) => p.name)).toEqual(['Zé', 'Rui']);
    expect(filterPlayers(players, { search: '', status: 'signed', position: '' }).map((p) => p.name)).toEqual(['Bia']);
    expect(sortPlayers(players).map((p) => p.name)).toEqual(['Ana', 'Zé', 'Bia', 'Rui']);
  });

  it('keeps only real links', () => {
    expect(cleanLinks('https://youtu.be/abc  javascript:alert(1)\nhttp://exemplo.pt/v?id=1 texto https://youtu.be/abc')).toEqual(['https://youtu.be/abc', 'http://exemplo.pt/v?id=1']);
  });
});
