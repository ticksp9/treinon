import { describe, it, expect } from 'vitest';
import { requiredStarters, sentOffCount, validateStarterCount } from '@/lib/match-playing-time';

const formats: [string, number][] = [['football_11', 11], ['football_9', 9], ['football_7', 7], ['football_5', 5], ['futsal', 5]];

describe('a match starts with the full team', () => {
  it.each(formats)('%s needs exactly %i on the pitch', (sport, n) => {
    expect(validateStarterCount(n, sport).allowed).toBe(true);
    const short = validateStarterCount(n - 1, sport);
    expect(short.allowed).toBe(false);
    expect(short.reason).toMatch(/Falta 1 jogador/);
    expect(validateStarterCount(n + 1, sport).allowed).toBe(false);
  });

  it('plays one short for each player sent off (football)', () => {
    expect(validateStarterCount(10, 'football_11', 1).allowed).toBe(true);
    expect(validateStarterCount(9, 'football_11', 1).allowed).toBe(false);
    expect(validateStarterCount(11, 'football_11', 1).allowed).toBe(false); // the sent-off player is not replaced
    expect(validateStarterCount(7, 'football_9', 2).allowed).toBe(true);
  });

  it('futsal: after the penalty a substitute comes in, so 4 or 5 may start the next part', () => {
    expect(validateStarterCount(4, 'futsal', 1).allowed).toBe(true);
    expect(validateStarterCount(5, 'futsal', 1).allowed).toBe(true);
    expect(validateStarterCount(3, 'futsal', 1).allowed).toBe(false);
  });

  it('counts our players sent off: a red card or two yellows, not the opponent', () => {
    const ev = (event_type: string, player_id: string | null, is_opponent = false) => ({ event_type, player_id, is_opponent });
    expect(sentOffCount([ev('red_card', 'a'), ev('yellow_card', 'b'), ev('yellow_card', 'b'), ev('yellow_card', 'c'), ev('red_card', 'x', true)])).toBe(2);
    expect(sentOffCount([ev('yellow_card', 'a'), ev('red_card', 'a')])).toBe(1);
    expect(requiredStarters('football_7', 1)).toBe(6);
    expect(requiredStarters(null)).toBe(7);
  });
});
