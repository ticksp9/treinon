import { describe, it, expect } from 'vitest';
import { currentAbility, abilityStars, computeForm, playerOfTheMatch, normalizeRating, ratingBg } from '@/lib/player-card';

describe('player card (FM style)', () => {
  it('ability from the latest evaluation', () => {
    expect(currentAbility({ technical: { a: 8, b: 6 }, physical: { c: 7 } })).toBe(7);
    expect(currentAbility(null, 6)).toBe(6);
    expect(currentAbility(null)).toBeNull();
  });

  it('stars in halves', () => {
    expect(abilityStars(10)).toBe(5);
    expect(abilityStars(7)).toBe(3.5);
    expect(abilityStars(6.2)).toBe(3);
    expect(abilityStars(null)).toBe(0);
  });

  it('form: last 5 games, average and trend', () => {
    const f = computeForm([5, 6, 6, 6.5, 7, 7.5, 8]);
    expect(f.last).toEqual([6, 6.5, 7, 7.5, 8]);
    expect(f.average).toBe(7);
    expect(f.trend).toBe('up');
    expect(computeForm([8, 8, 7, 6, 6]).trend).toBe('down');
    expect(computeForm([]).average).toBeNull();
  });

  it('player of the match', () => {
    expect(playerOfTheMatch([
      { player_id: 'a', rating: 7.5, minutes: 40 },
      { player_id: 'b', rating: 7.5, minutes: 60 },
      { player_id: 'c', rating: null, minutes: 60 },
    ])).toBe('b');
    expect(playerOfTheMatch([])).toBeNull();
  });

  it('ratings are clamped to 1–10 with one decimal', () => {
    expect(normalizeRating(11)).toBe(10);
    expect(normalizeRating(0)).toBe(1);
    expect(normalizeRating(6.66)).toBe(6.7);
    expect(ratingBg(9)).toContain('emerald');
  });
});
