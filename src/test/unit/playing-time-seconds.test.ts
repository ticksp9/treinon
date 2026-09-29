import { describe, it, expect } from 'vitest';
import { computePlayingSeconds, matchClockSeconds, secondsToMinutes, formatClock, roundPartsToTotal, applyPreciseMinutes, type SubEvent } from '@/lib/playing-time-seconds';
import { canPlayerPlayInCategory } from '@/lib/constants';

describe('reports use the same seconds', () => {
  it('per-part minutes always add up to the rounded total', () => {
    expect(roundPartsToTotal([450, 450])).toEqual({ total: 15, byPart: [8, 7] });
    expect(roundPartsToTotal([940, 910, 1825])).toEqual({ total: 61, byPart: [16, 15, 30] });
    for (const parts of [[29, 31], [89, 91, 30], [0, 0, 59], [600, 600, 1800]]) {
      const r = roundPartsToTotal(parts);
      expect(r.byPart.reduce((a, b) => a + b, 0)).toBe(r.total);
    }
  });

  it('overrides engine minutes with precise ones', () => {
    const stats = [{ playerId: 'a', totalMinutes: 7, firstHalfMinutes: 7, secondHalfMinutes: 0 }];
    const [a] = applyPreciseMinutes(stats, {
      partSeconds: [1500, 1500],
      partStarters: { '1': ['a'] },
      events: [
        { event_type: 'substitution_out', player_id: 'a', minute: 2, second: 50 },
        { event_type: 'substitution_in', player_id: 'a', minute: 5, second: 55 },
        { event_type: 'substitution_out', player_id: 'a', minute: 8, second: 50 },
      ],
    });
    expect(a.totalMinutes).toBe(6); // 2:50 + 2:55 = 5:45 → 6
  });

  it('keeps engine minutes when no real timing was recorded (manual report)', () => {
    const stats = [{ playerId: 'a', totalMinutes: 50 }];
    expect(applyPreciseMinutes(stats, { partSeconds: [0, 0], partStarters: {}, events: [] })[0].totalMinutes).toBe(50);
  });
});

describe('Sub-12 / Sub-13 eligibility (season 2026/27)', () => {
  const oct2026 = new Date(2026, 9, 1);
  it('a Sub-13 (born 2014) cannot play in the Sub-12', () => {
    expect(canPlayerPlayInCategory('2014-03-10', 'Sub-12', 'male', false, oct2026).eligible).toBe(false);
  });
  it('a Sub-12 (born 2015) can play in the Sub-12 and move up to the Sub-13', () => {
    expect(canPlayerPlayInCategory('2015-08-20', 'Sub-12', 'male', false, oct2026).eligible).toBe(true);
    expect(canPlayerPlayInCategory('2015-08-20', 'Sub-13', 'male', false, oct2026).eligible).toBe(true);
  });
  it('a Sub-11 (born 2016) can play in both', () => {
    expect(canPlayerPlayInCategory('2016-01-05', 'Sub-12', 'male', false, oct2026).eligible).toBe(true);
    expect(canPlayerPlayInCategory('2016-01-05', 'Sub-13', 'male', false, oct2026).eligible).toBe(true);
  });
});

const at = (sec: number) => ({ minute: Math.floor(sec / 60), second: sec % 60 });
const out = (id: string, sec: number): SubEvent => ({ event_type: 'substitution_out', player_id: id, ...at(sec) });
const inn = (id: string, sec: number): SubEvent => ({ event_type: 'substitution_in', player_id: id, ...at(sec) });
const swap = (o: string, i: string, sec: number) => [out(o, sec), inn(i, sec)];

const F7 = ['gr', 'a', 'b', 'c', 'd', 'e', 'f'];

describe('seconds-precise playing time', () => {
  it('sums many short stints exactly (free re-entry, F7)', () => {
    // 2 × 25 min. Player "a" goes out/in every ~3 min at odd seconds.
    const events: SubEvent[] = [
      ...swap('a', 'x', 170), // a on 0:00–2:50 (170s)
      ...swap('x', 'a', 355), // a off 2:50–5:55, back on 5:55
      ...swap('a', 'x', 530), // a on 5:55–8:50 (175s)
      ...swap('x', 'a', 725), // back 12:05
      ...swap('a', 'x', 890), // 12:05–14:50 (165s)
    ];
    const r = computePlayingSeconds({ partSeconds: [1500, 1500], partStarters: { '1': F7 }, events });
    const a = r.get('a')!;
    // part 1: 170 + 175 + 165 = 510; part 2: x carried over, a off
    expect(a.secondsByPart[0]).toBe(510);
    expect(a.totalSeconds).toBe(510);
    const x = r.get('x')!;
    expect(x.totalSeconds).toBe((355 - 170) + (725 - 530) + (1500 - 890) + 1500);
    // old minute rounding would have given a = 2+3+2 = 7 min; real is 8:30 → 9 rounded
    expect(secondsToMinutes(a.totalSeconds)).toBe(9);
  });

  it('never has more than 7 players on the field and total time is 7 × match length', () => {
    const events: SubEvent[] = [];
    let t = 60;
    const bench = ['x', 'y', 'z'];
    const field = [...F7];
    for (let n = 0; n < 12; n++, t += 247) {
      const o = field[1 + (n % 6)];
      const i = bench[n % 3];
      events.push(...swap(o, i, t));
      field[field.indexOf(o)] = i;
      bench[n % 3] = o;
    }
    const parts = [1500, 1500];
    const r = computePlayingSeconds({ partSeconds: parts, partStarters: { '1': F7 }, events });
    const total = [...r.values()].reduce((s, p) => s + p.totalSeconds, 0);
    expect(total).toBe(7 * 3000);
  });

  it('three parts of 15 + 15 + 30 with a half-time change and stoppage time', () => {
    // part 1 ran 15:40, part 2 ran 15:10, part 3 ran 30:25 (real time)
    const parts = [940, 910, 1825];
    const p2 = ['gr', 'x', 'b', 'c', 'd', 'e', 'f']; // x replaced a at the break
    const events = [...swap('x', 'a', 940 + 910 + 600)]; // 10:00 into part 3 a comes back
    const r = computePlayingSeconds({ partSeconds: parts, partStarters: { '1': F7, '2': p2 }, events });
    expect(r.get('a')!.secondsByPart).toEqual([940, 0, 1825 - 600]);
    expect(r.get('x')!.secondsByPart).toEqual([0, 910, 600]);
    expect(r.get('b')!.totalSeconds).toBe(940 + 910 + 1825);
  });

  it('event at the exact part boundary belongs to the next part', () => {
    const r = computePlayingSeconds({
      partSeconds: [600, 600],
      partStarters: { '1': ['a'] },
      events: swap('a', 'b', 600),
    });
    expect(r.get('a')!.totalSeconds).toBe(600);
    expect(r.get('b')!.secondsByPart).toEqual([0, 600]);
  });

  it('batch substitutions in the same second keep counts correct', () => {
    const r = computePlayingSeconds({
      partSeconds: [1200],
      partStarters: { '1': ['a', 'b', 'c'] },
      events: [out('a', 300), out('b', 300), inn('x', 300), inn('y', 300)],
    });
    expect(r.get('a')!.totalSeconds).toBe(300);
    expect(r.get('x')!.totalSeconds).toBe(900);
    expect(r.get('c')!.totalSeconds).toBe(1200);
  });

  it('live: counts up to the current second of the part in progress', () => {
    const r = computePlayingSeconds({ partSeconds: [1500, 95], partStarters: { '1': ['a'] }, events: [] });
    expect(r.get('a')!.totalSeconds).toBe(1595);
    expect(r.get('a')!.onField).toBe(true);
  });

  it('ignores invalid input (out of a player not on the field, double in)', () => {
    const r = computePlayingSeconds({
      partSeconds: [600],
      partStarters: { '1': ['a'] },
      events: [out('z', 100), inn('a', 200), inn('b', 300), inn('b', 400)],
    });
    expect(r.get('a')!.totalSeconds).toBe(600);
    expect(r.get('b')!.totalSeconds).toBe(300);
  });

  it('helpers', () => {
    expect(matchClockSeconds([940, 910], 3, 125)).toBe(940 + 910 + 125);
    expect(formatClock(510)).toBe('8:30');
    expect(secondsToMinutes(89)).toBe(1);
    expect(secondsToMinutes(90)).toBe(2);
  });
});
