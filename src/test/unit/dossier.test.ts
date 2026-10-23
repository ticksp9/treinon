import { describe, it, expect } from 'vitest';
import { dossierScore, dossierSections, type DossierCounts } from '@/lib/dossier';

const full: DossierCounts = {
  players: 16, playersWithBehaviour: 16, playersWithPerformance: 16, hasObjectives: true, periods: 4, mesocycles: 3,
  weeksSoFar: 8, weeksPlanned: 8, weeksOver: 7, weeksReviewed: 7, sessionsDone: 20, sessionsRecorded: 20, matchesPlayed: 5, matchesEvaluated: 5,
};
const state = (c: DossierCounts, key: string) => dossierSections(c).find((s) => s.key === key)!.state;

describe('training dossier', () => {
  it('has the same parts for every team, in the FPF order', () => {
    expect(dossierSections(full).map((s) => s.key)).toEqual(['squad', 'behaviour', 'performance', 'objectives', 'annual', 'meso', 'micro', 'sessions', 'matches']);
    expect(dossierScore(dossierSections(full))).toBe(100);
  });

  it('marks what is missing or half done', () => {
    const c = { ...full, playersWithBehaviour: 4, weeksReviewed: 2, sessionsRecorded: 0, hasObjectives: false };
    expect(state(c, 'behaviour')).toBe('partial');
    expect(state(c, 'micro')).toBe('partial'); // all weeks planned but reviews missing
    expect(state(c, 'sessions')).toBe('missing');
    expect(state(c, 'objectives')).toBe('missing');
    expect(dossierScore(dossierSections(c))).toBeLessThan(100);
  });

  it('does not count what cannot apply yet', () => {
    const c = { ...full, matchesPlayed: 0, matchesEvaluated: 0, playersWithPerformance: 0 };
    expect(state(c, 'matches')).toBe('info');
    expect(state(c, 'performance')).toBe('info'); // only from the specialisation phase
    expect(dossierScore(dossierSections(c))).toBe(100);
  });
});
