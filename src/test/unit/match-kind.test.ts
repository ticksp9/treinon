import { describe, it, expect } from 'vitest';
import { kindOf, minutesByKind } from '@/lib/match-kind';

describe('match kind', () => {
  it('takes the type, or reads the competition name of older matches', () => {
    expect(kindOf({ match_type: 'friendly' })).toBe('friendly');
    expect(kindOf({ match_type: null, competition: 'Amigável' })).toBe('friendly');
    expect(kindOf({ competition: 'Torneio da Páscoa' })).toBe('tournament');
    expect(kindOf({ competition: 'Distrital 1.ª Divisão' })).toBe('championship');
    expect(kindOf(null)).toBe('championship');
  });

  it('adds up minutes, matches and starts per kind', () => {
    const t = minutesByKind([
      { minutes_played: 60, is_starter: true, match: { match_type: 'championship' } },
      { minutes_played: 0, is_starter: false, match: { match_type: 'championship' } },
      { minutes_played: 30, is_starter: false, match: { match_type: 'friendly' } },
      { minutes_played: 45, is_starter: true, match: { competition: 'Amigável' } },
    ]);
    expect(t.find((x) => x.kind === 'championship')).toEqual({ kind: 'championship', matches: 2, played: 1, starts: 1, minutes: 60 });
    expect(t.find((x) => x.kind === 'friendly')).toEqual({ kind: 'friendly', matches: 2, played: 2, starts: 1, minutes: 75 });
    expect(t.find((x) => x.kind === 'tournament')!.minutes).toBe(0);
  });
});
