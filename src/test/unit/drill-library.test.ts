import { describe, it, expect } from 'vitest';
import { DRILLS, SESSION_PLANS, AGE_GUIDES, AGE_BANDS, getDrill, sessionDrills, drillsToExercises, isLowResource } from '@/lib/drill-library';

describe('drill library integrity', () => {
  it('has unique drill ids', () => {
    const ids = DRILLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every drill is complete', () => {
    for (const d of DRILLS) {
      expect(d.ages.length, d.id).toBeGreaterThan(0);
      expect(d.howTo.length, d.id).toBeGreaterThan(0);
      expect(d.coachingPoints.length, d.id).toBeGreaterThan(0);
      expect(d.players.min, d.id).toBeLessThanOrEqual(d.players.max);
      expect(d.diagram.length, d.id).toBeGreaterThan(0);
      for (const el of d.diagram) {
        const pts = 'at' in el ? [el.at] : 'from' in el ? [el.from, el.to] : [];
        for (const [x, y] of pts) {
          expect(x, `${d.id} x`).toBeGreaterThanOrEqual(0);
          expect(x, `${d.id} x`).toBeLessThanOrEqual(100);
          expect(y, `${d.id} y`).toBeGreaterThanOrEqual(0);
          expect(y, `${d.id} y`).toBeLessThanOrEqual(64);
        }
      }
    }
  });

  it('session plans only reference existing drills and add up their time', () => {
    for (const s of SESSION_PLANS) {
      for (const b of s.blocks) expect(getDrill(b.drillId), `${s.id} → ${b.drillId}`).toBeDefined();
      const total = s.blocks.reduce((sum, b) => sum + b.minutes, 0);
      expect(total, s.id).toBe(s.minutes);
      expect(sessionDrills(s)).toHaveLength(s.blocks.length);
    }
  });

  it('every age band has content and a guide', () => {
    for (const { value } of AGE_BANDS) {
      expect(DRILLS.some((d) => d.ages.includes(value)), value).toBe(true);
      expect(SESSION_PLANS.some((s) => s.ages.includes(value)), value).toBe(true);
      expect(AGE_GUIDES.some((g) => g.age === value), value).toBe(true);
    }
  });

  it('offers plenty of low-resource drills', () => {
    expect(DRILLS.filter(isLowResource).length).toBeGreaterThanOrEqual(20);
  });

  it('converts drills into training exercises', () => {
    const ex = drillsToExercises([{ drill: DRILLS[0], minutes: 7, note: 'x' }]);
    expect(ex[0]).toMatchObject({ name: DRILLS[0].name, duration: 7 });
    expect(ex[0].description).toContain('Pontos-chave');
  });
});
