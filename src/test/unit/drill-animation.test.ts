import { describe, it, expect } from 'vitest';
import { autoAnimate, elementsAt, resolveFrame, removeElement, stepCount } from '@/lib/drill-library/animation';
import { DRILLS } from '@/lib/drill-library';
import type { DiagramEl } from '@/lib/drill-library/types';

const els: DiagramEl[] = [
  { t: 'cone', at: [50, 50] },
  { t: 'a', at: [10, 10], n: '1' },   // 1
  { t: 'a', at: [40, 10], n: '2' },   // 2
  { t: 'ball', at: [12, 12] },        // 3
  { t: 'pass', from: [10, 10], to: [40, 10] },
  { t: 'run', from: [10, 10], to: [25, 30] },
  { t: 'pass', from: [40, 10], to: [25, 30] },
];

describe('animated drills', () => {
  it('turns arrows into steps: pass-and-move, then return pass', () => {
    const anim = autoAnimate(els)!;
    expect(stepCount(anim)).toBe(3);
    const s1 = resolveFrame(els, anim, 1);
    expect(s1[3]).toEqual([40, 10]);   // ball at player 2
    expect(s1[1]).toEqual([25, 30]);   // player 1 moved in the same step
    const s2 = resolveFrame(els, anim, 2);
    expect(s2[3]).toEqual([25, 30]);   // ball back to player 1
    expect(s2[2]).toEqual([40, 10]);   // player 2 stayed
  });

  it('interpolates halfway and hides static arrows while animating', () => {
    const anim = autoAnimate(els)!;
    const mid = elementsAt(els, anim, 0.5);
    const ball = mid.find((e) => e.t === 'ball') as Extract<DiagramEl, { t: 'ball' }>;
    expect(ball.at[0]).toBeGreaterThan(12);
    expect(ball.at[0]).toBeLessThan(40);
    // shows the upcoming movements (a pass and a run) instead of the original 3 arrows
    expect(mid.filter((e) => e.t === 'pass' || e.t === 'run')).toHaveLength(2);
  });

  it('without animation the diagram is unchanged', () => {
    expect(elementsAt(els, null, 0)).toBe(els);
  });

  it('removing an element keeps the other steps right', () => {
    const anim = autoAnimate(els)!;
    const r = removeElement(els, anim, 0); // remove the cone
    expect(resolveFrame(r.elements, r.anim, 1)[2]).toEqual([40, 10]); // ball is now index 2
  });

  it('most library drills with arrows get an automatic animation', () => {
    const withArrows = DRILLS.filter((d) => d.diagram.some((e) => ['pass', 'run', 'drive', 'shot'].includes(e.t)));
    const animated = withArrows.filter((d) => autoAnimate(d.diagram));
    expect(animated.length).toBeGreaterThan(withArrows.length * 0.8);
  });
});
