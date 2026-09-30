import { describe, it, expect } from 'vitest';
import { isSportAllowed, filterSportTypes, scopeFromModalities, normalizeScope, defaultSportType } from '@/lib/sport-scope';

describe('football and futsal are separate', () => {
  const all = ['football_5', 'football_7', 'football_9', 'football_11', 'futsal'] as const;

  it('a football coach only sees football formats', () => {
    expect(filterSportTypes('football', all)).toEqual(['football_5', 'football_7', 'football_9', 'football_11']);
    expect(isSportAllowed('football', 'futsal')).toBe(false);
  });

  it('a futsal coach only sees futsal', () => {
    expect(filterSportTypes('futsal', all)).toEqual(['futsal']);
    expect(defaultSportType('futsal')).toBe('futsal');
  });

  it('only "both" sees both', () => {
    expect(filterSportTypes('both', all)).toHaveLength(5);
  });

  it('club modalities and stored values', () => {
    expect(scopeFromModalities(['football', 'futsal'])).toBe('both');
    expect(scopeFromModalities(['futsal'])).toBe('futsal');
    expect(scopeFromModalities(null)).toBe('football');
    expect(normalizeScope('xyz')).toBe('football');
  });
});
