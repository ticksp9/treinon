import { describe, it, expect } from 'vitest';
import {
  ATTRIBUTE_CATALOG,
  emptyAttributeScores,
  categoryAverage,
  categoryRounded,
  overallAverage,
  roundedOverall,
} from '@/lib/player-attributes';
import { deriveStatus } from '@/lib/player-status';

describe('player-attributes catalog', () => {
  it('exposes 4 categories with the required attributes', () => {
    const keys = ATTRIBUTE_CATALOG.map((c) => c.key);
    expect(keys).toEqual(['technical', 'tactical', 'physical', 'mental']);
    const tech = ATTRIBUTE_CATALOG.find((c) => c.key === 'technical')!;
    expect(tech.attributes.map((a) => a.key)).toEqual(
      expect.arrayContaining(['short_pass', 'long_pass', 'finishing', '1v1_offensive'])
    );
  });

  it('emptyAttributeScores defaults all attributes to 5', () => {
    const s = emptyAttributeScores();
    for (const cat of ATTRIBUTE_CATALOG) {
      const bag = s[cat.key]!;
      for (const a of cat.attributes) expect(bag[a.key]).toBe(5);
    }
  });

  it('categoryAverage and overallAverage compute as expected', () => {
    const s = {
      technical: { short_pass: 8, finishing: 6 },
      mental: { attitude: 10 },
    };
    expect(categoryAverage(s as any, 'technical')).toBe(7);
    expect(categoryAverage(s as any, 'tactical')).toBeNull();
    expect(overallAverage(s as any)).toBeCloseTo((7 + 10) / 2, 5);
    expect(roundedOverall(s as any)).toBe(9);
    expect(categoryRounded(s as any, 'technical')).toBe(7);
  });

  it('roundedOverall clamps to [1,10]', () => {
    expect(roundedOverall({ technical: { x: 11 } } as any)).toBe(10);
    expect(roundedOverall({ technical: { x: 0 } } as any)).toBe(1);
    expect(roundedOverall({})).toBeNull();
  });
});

describe('deriveStatus', () => {
  it('inactive when not active', () => {
    expect(deriveStatus({ is_active: false })).toBe('inactive');
  });
  it('explicit non-default status wins', () => {
    expect(deriveStatus({ is_active: true, status: 'loan' })).toBe('loan');
  });
  it('falls back to injured when active injury present', () => {
    expect(deriveStatus({ is_active: true, status: 'active', hasActiveInjury: true })).toBe('injured');
  });
  it('falls back to suspended when suspension flagged', () => {
    expect(deriveStatus({ is_active: true, hasActiveSuspension: true })).toBe('suspended');
  });
  it('defaults to active otherwise', () => {
    expect(deriveStatus({ is_active: true })).toBe('active');
  });
});
