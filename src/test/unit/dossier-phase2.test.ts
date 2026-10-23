import { describe, it, expect } from 'vitest';
import { cleanObjective, emptyObjective, objectiveOverdue, objectiveStats } from '@/lib/objectives';
import { ageOfCategory, cleanGuidelines, defaultStages, formatOfTeam, guidelinesProgress, materialSuggestion } from '@/lib/guidelines';
import { typicalMap, type TrainingSlot } from '@/lib/club-map';

describe('objectives with a target', () => {
  it('cleans what goes to the database', () => {
    const o = cleanObjective({ ...emptyObjective(), objective: '  Sair a jogar  ', target: ' 60% ', indicator: '' });
    expect(o).toMatchObject({ objective: 'Sair a jogar', target: '60%', indicator: null, deadline: null, status: 'open' });
  });

  it('counts measurable, evaluated and achieved', () => {
    const s = objectiveStats([
      { status: 'open', indicator: 'x', target: '6/10' },
      { status: 'achieved', indicator: 'x', target: '' },
      { status: 'partial', indicator: null, target: null },
    ]);
    expect(s).toEqual({ total: 3, measurable: 1, evaluated: 2, achieved: 1 });
  });

  it('flags an objective past its deadline without a verdict', () => {
    const today = new Date('2026-12-01T12:00:00Z');
    expect(objectiveOverdue({ status: 'open', deadline: '2026-11-30' }, today)).toBe(true);
    expect(objectiveOverdue({ status: 'achieved', deadline: '2026-11-30' }, today)).toBe(false);
    expect(objectiveOverdue({ status: 'open', deadline: null }, today)).toBe(false);
  });
});

describe('guiding document', () => {
  it('knows the age and the game format of a team', () => {
    expect(ageOfCategory('Sub-13')).toBe(13);
    expect(ageOfCategory('Iniciados A')).toBe(15);
    expect(ageOfCategory('Seniores')).toBe(99);
    expect(ageOfCategory(null)).toBeNull();
    expect(formatOfTeam({ category: 'Sub-11' })).toBe('7');
    expect(formatOfTeam({ category: 'Sub-13' })).toBe('9');
    expect(formatOfTeam({ category: 'Sub-17' })).toBe('11');
    expect(formatOfTeam({ category: 'Sub-17', sport_type: 'futsal' })).toBe('futsal');
    expect(formatOfTeam({ category: 'Sub-15', sport_type: 'football_9' })).toBe('9');
  });

  it('keeps only the known fields and drops empty stages', () => {
    const g = cleanGuidelines({
      vision: ' Formar ', models: { '9': { system: ' 1-3-3-2 ', attack: '' }, '7': { attack: '' } },
      stages: [{ name: '', ages: '', game: '', motor: '', psych: '', positions: '', coach: '' }, { ...defaultStages()[0] }],
      // @ts-expect-error unknown fields are dropped
      junk: 1,
    });
    expect(g.vision).toBe('Formar');
    expect(g.models).toEqual({ '9': { system: '1-3-3-2' } });
    expect(g.stages).toHaveLength(1);
    expect((g as Record<string, unknown>).junk).toBeUndefined();
  });

  it('measures what the FPF asks: the model for 7, 9 and 11 and the stages', () => {
    const model = { system: 'a', attack: 'b', defence: 'c', toAttack: 'd', toDefend: 'e' };
    const p = guidelinesProgress({ models: { '7': model, '9': { ...model, defence: '' }, '11': model }, stages: defaultStages() });
    expect(p.formats).toBe(2);
    expect(p.stages).toBe(5);
    expect(guidelinesProgress(null)).toMatchObject({ formats: 0, stages: 0 });
  });

  it('suggests materials by age', () => {
    expect(materialSuggestion({ category: 'Sub-9' })).toMatch(/n\.º 3/);
    expect(materialSuggestion({ category: 'Sub-11' })).toMatch(/n\.º 4/);
    expect(materialSuggestion({ category: 'Sub-17' })).toMatch(/n\.º 5/);
  });
});

describe('FPF typical map', () => {
  const slot = (team_id: string, weekday: number, start: string, end: string, space: TrainingSlot['space']): TrainingSlot =>
    ({ id: `${team_id}${weekday}`, team_id, weekday, start_time: start, end_time: end, location: 'Campo 1', notes: null, space });

  it('sums sessions, minutes and spaces per team, youngest first', () => {
    const rows = typicalMap(
      [slot('a', 2, '18:30', '20:00', 'half'), slot('a', 4, '18:30', '20:00', 'half'), slot('b', 1, '17:00', '18:00', 'quarter')],
      [{ id: 'a', name: 'Sub-17', category: 'Sub-17' }, { id: 'b', name: 'Sub-9', category: 'Sub-9' }, { id: 'c', name: 'Seniores', category: 'Seniores' }],
      ageOfCategory,
    );
    expect(rows.map((r) => r.name)).toEqual(['Sub-9', 'Sub-17', 'Seniores']);
    expect(rows[1]).toMatchObject({ sessions: 2, minutes: 180, avg: 90, spaces: { half: 2 }, needsFullPitch: true });
    expect(rows[0].needsFullPitch).toBe(false);
    expect(rows[2]).toMatchObject({ sessions: 0, needsFullPitch: false });
  });

  it('a Sub-15 with one full-pitch session is fine', () => {
    const [r] = typicalMap([slot('a', 2, '18:30', '20:00', 'full'), slot('a', 4, '18:30', '20:00', 'half')], [{ id: 'a', name: 'Sub-15', category: 'Sub-15' }], ageOfCategory);
    expect(r.needsFullPitch).toBe(false);
  });
});
