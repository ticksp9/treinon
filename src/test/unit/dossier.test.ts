import { describe, it, expect } from 'vitest';
import { dossierScore, dossierSections, type DossierCounts } from '@/lib/dossier';

const full: DossierCounts = {
  players: 16, playersWithBehaviour: 16, playersWithPerformance: 16, hasObjectives: true, periods: 4, mesocycles: 3,
  weeksSoFar: 8, weeksPlanned: 8, weeksOver: 7, weeksReviewed: 7, sessionsDone: 20, sessionsRecorded: 20, matchesPlayed: 5, matchesEvaluated: 5,
  teamObjectives: 3, teamObjectivesMeasurable: 3, teamObjectivesEvaluated: 1, playersWithObjectives: 16,
  guidelinesModel: true, guidelinesStages: 5, slots: 3, slotsWithSpace: 3, needsFullPitch: false, hasMaterials: true, matchesReviewed: 5,
};
const state = (c: DossierCounts, key: string) => dossierSections(c).find((s) => s.key === key)!.state;

describe('training dossier', () => {
  it('has the same parts for every team, in the FPF order', () => {
    expect(dossierSections(full).map((s) => s.key)).toEqual([
      'guidelines', 'squad', 'behaviour', 'performance', 'objectives', 'individual', 'annual', 'meso', 'micro', 'sessions', 'space', 'materials', 'matches',
    ]);
    expect(dossierScore(dossierSections(full))).toBe(100);
  });

  it('marks what is missing or half done', () => {
    const c = { ...full, playersWithBehaviour: 4, weeksReviewed: 2, sessionsRecorded: 0, hasObjectives: false, teamObjectives: 0, teamObjectivesMeasurable: 0 };
    expect(state(c, 'behaviour')).toBe('partial');
    expect(state(c, 'micro')).toBe('partial'); // all weeks planned but reviews missing
    expect(state(c, 'sessions')).toBe('missing');
    expect(state(c, 'objectives')).toBe('missing');
    expect(dossierScore(dossierSections(c))).toBeLessThan(100);
  });

  it('does not count what cannot apply yet', () => {
    const c = { ...full, matchesPlayed: 0, matchesEvaluated: 0, playersWithPerformance: 0, playersWithObjectives: 0 };
    expect(state(c, 'matches')).toBe('info');
    expect(state(c, 'performance')).toBe('info'); // only from the specialisation phase
    expect(state(c, 'individual')).toBe('info'); // required from 4 stars
    expect(dossierScore(dossierSections(c))).toBe(100);
  });

  it('asks for objectives with a target, not only the text', () => {
    expect(state({ ...full, teamObjectives: 0, teamObjectivesMeasurable: 0 }, 'objectives')).toBe('partial');
    expect(state({ ...full, hasObjectives: false }, 'objectives')).toBe('partial');
  });

  it('checks the guiding document, the space map and the materials', () => {
    expect(state({ ...full, guidelinesModel: false, guidelinesStages: 0 }, 'guidelines')).toBe('missing');
    expect(state({ ...full, guidelinesStages: 0 }, 'guidelines')).toBe('partial');
    expect(state({ ...full, slots: 0, slotsWithSpace: 0 }, 'space')).toBe('missing');
    expect(state({ ...full, slotsWithSpace: 1 }, 'space')).toBe('partial');
    expect(state({ ...full, needsFullPitch: true }, 'space')).toBe('partial');
    expect(state({ ...full, hasMaterials: false }, 'materials')).toBe('missing');
  });

  it('keeps working with the counts of phase 1 only', () => {
    const old: DossierCounts = { players: 1, playersWithBehaviour: 1, playersWithPerformance: 0, hasObjectives: true, periods: 1, mesocycles: 1,
      weeksSoFar: 0, weeksPlanned: 0, weeksOver: 0, weeksReviewed: 0, sessionsDone: 0, sessionsRecorded: 0, matchesPlayed: 0, matchesEvaluated: 0 };
    expect(() => dossierSections(old)).not.toThrow();
    expect(state(old, 'space')).toBe('missing');
  });
});
