import { describe, it, expect } from 'vitest';
import { kindOf, minutesByKind, sumKinds, teamByKind } from '@/lib/match-kind';

describe('match kind', () => {
  it('takes the type, or reads the competition name of older matches', () => {
    expect(kindOf({ match_type: 'friendly' })).toBe('friendly');
    expect(kindOf({ match_type: null, competition: 'Amigável' })).toBe('friendly');
    expect(kindOf({ competition: 'Torneio da Páscoa' })).toBe('tournament');
    expect(kindOf({ competition: 'Distrital 1.ª Divisão' })).toBe('championship');
    expect(kindOf(null)).toBe('championship');
  });

  it('adds up minutes, matches, starts, goals and cards per kind', () => {
    const t = minutesByKind([
      { minutes_played: 60, is_starter: true, match: { match_type: 'championship' } },
      { minutes_played: 0, is_starter: false, match: { match_type: 'championship' } },
      { minutes_played: 30, is_starter: false, match: { match_type: 'friendly' } },
      { minutes_played: 45, is_starter: true, match: { competition: 'Amigável' } },
    ], [
      { event_type: 'goal', match: { match_type: 'championship' } },
      { event_type: 'goal', match: { match_type: 'friendly' } },
      { event_type: 'yellow_card', match: { match_type: 'friendly' } },
      { event_type: 'red_card', match: { competition: 'Torneio' } },
      { event_type: 'goal', is_opponent: true, match: { match_type: 'championship' } },
    ]);
    expect(t.find((x) => x.kind === 'championship')).toEqual({ kind: 'championship', matches: 2, played: 1, starts: 1, minutes: 60, goals: 1, yellow: 0, red: 0 });
    expect(t.find((x) => x.kind === 'friendly')).toEqual({ kind: 'friendly', matches: 2, played: 2, starts: 1, minutes: 75, goals: 1, yellow: 1, red: 0 });
    expect(t.find((x) => x.kind === 'tournament')).toMatchObject({ minutes: 0, red: 1 });
    expect(sumKinds(t)).toEqual({ matches: 4, played: 3, starts: 2, minutes: 135, goals: 2, yellow: 1, red: 1 });
  });

  it('builds the team table per player', () => {
    const team = teamByKind([
      { player_id: 'a', minutes_played: 60, is_starter: true, match: { match_type: 'championship' } },
      { player_id: 'b', minutes_played: 20, is_starter: false, match: { match_type: 'friendly' } },
    ], [{ player_id: 'b', event_type: 'goal', match: { match_type: 'friendly' } }]);
    expect(team.get('a')!.find((x) => x.kind === 'championship')!.minutes).toBe(60);
    expect(team.get('b')!.find((x) => x.kind === 'friendly')).toMatchObject({ minutes: 20, goals: 1 });
  });
});
