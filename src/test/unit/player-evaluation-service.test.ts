import { describe, it, expect } from 'vitest';
import {
  filterByType,
  filterBySeason,
  averageOverall,
  averageByCategory,
  deriveStrengthsFromLatest,
  deriveImprovementsFromLatest,
  type EvaluationRow,
} from '@/lib/player-evaluation-service';

const row = (over: Partial<EvaluationRow>): EvaluationRow => ({
  id: 'x',
  evaluation_date: '2025-01-01',
  context: 'training',
  attributes: null,
  ...over,
});

const fullAttrs = {
  technical: { short_pass: 8, long_pass: 6, reception: 7, driving: 5, dribble: 4, shot: 9, finishing: 8, cross: 6, '1v1_offensive': 7, '1v1_defensive': 5 },
  tactical: { positioning_off: 6, positioning_def: 7, game_reading: 8, decision_making: 5, transition_off: 6, transition_def: 7 },
  physical: { speed: 9, acceleration: 8, endurance: 7, agility: 6, strength: 5, mobility: 6 },
  mental: { attitude: 8, commitment: 9, concentration: 6, leadership: 5, resilience: 7, discipline: 8, learning: 7 },
};

describe('player-evaluation-service', () => {
  it('filters by type', () => {
    const rows = [row({ context: 'training' }), row({ id: 'b', context: 'match' })];
    expect(filterByType(rows, 'match')).toHaveLength(1);
    expect(filterByType(rows, 'all')).toHaveLength(2);
  });

  it('filters by season', () => {
    const rows = [row({ season_label: '2024/25' }), row({ id: 'b', season_label: '2025/26' })];
    expect(filterBySeason(rows, '2025/26')).toHaveLength(1);
    expect(filterBySeason(rows, 'all')).toHaveLength(2);
    expect(filterBySeason(rows, null)).toHaveLength(2);
  });

  it('computes overall average across rows with attributes', () => {
    const rows = [
      row({ attributes: fullAttrs }),
      row({ attributes: fullAttrs }),
    ];
    const avg = averageOverall(rows);
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThanOrEqual(10);
  });

  it('falls back to legacy overall_rating when attributes missing', () => {
    const rows = [row({ overall_rating: 6 }), row({ overall_rating: 8 })];
    expect(averageOverall(rows)).toBe(7);
  });

  it('returns null on empty', () => {
    expect(averageOverall([])).toBeNull();
    expect(averageByCategory([], 'technical')).toBeNull();
  });

  it('averageByCategory aggregates per dimension', () => {
    const rows = [row({ attributes: fullAttrs })];
    const v = averageByCategory(rows, 'physical');
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(5);
  });

  it('derives top strengths from latest evaluation', () => {
    const rows = [row({ attributes: fullAttrs })];
    const strengths = deriveStrengthsFromLatest(rows, 3);
    expect(strengths).toHaveLength(3);
    // first should be max — speed=9, shot=9, commitment=9
    expect(strengths[0].value).toBe(9);
  });

  it('derives improvements (lowest)', () => {
    const rows = [row({ attributes: fullAttrs })];
    const imp = deriveImprovementsFromLatest(rows, 2);
    expect(imp[0].value).toBeLessThanOrEqual(imp[1].value);
    expect(imp[0].value).toBe(4); // dribble
  });

  it('returns empty arrays when no attributes', () => {
    expect(deriveStrengthsFromLatest([row({})])).toEqual([]);
    expect(deriveImprovementsFromLatest([])).toEqual([]);
  });
});
