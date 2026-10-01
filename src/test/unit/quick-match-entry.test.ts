import { describe, it, expect } from 'vitest';
import { spreadMinutes, assignAssists } from '@/components/matches/QuickMatchEntry';
import { applyPreciseMinutes } from '@/lib/playing-time-seconds';

describe('quick post-match entry', () => {
  it('spreads an old total over the parts (15+15+30)', () => {
    expect(spreadMinutes(40, [15, 15, 30])).toEqual([15, 15, 10]);
    expect(spreadMinutes(0, [15, 15, 30])).toEqual([0, 0, 0]);
    expect(spreadMinutes(99, [15, 15, 30])).toEqual([15, 15, 30]);
  });

  it('gives each assist to a goal of someone else', () => {
    const r = assignAssists([['a', 2], ['b', 1]], [['b', 1], ['a', 1], ['c', 2]]);
    expect(r.goals.map((g) => [g.scorer, g.assist])).toEqual([['a', 'b'], ['a', 'c'], ['b', 'a']]);
    expect(r.unassigned).toBe(1);
  });

  it('typed minutes win over the live calculation in reports', () => {
    const stats = [{ playerId: 'a', totalMinutes: 60 }, { playerId: 'b', totalMinutes: 0 }];
    const out = applyPreciseMinutes(stats, {
      partSeconds: [900, 900, 1800], partStarters: {}, events: [],
      manualMinutes: { a: [15, 0, 20], b: [0, 15, 10] },
    });
    expect(out[0]).toMatchObject({ totalMinutes: 35, firstHalfMinutes: 15, secondHalfMinutes: 20, realMinutesByPart: { '1': 15, '2': 0, '3': 20 } });
    expect(out[1].totalMinutes).toBe(25);
  });
});
