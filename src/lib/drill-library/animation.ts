/**
 * Animated drills: a drill is a set of diagram elements plus "steps" (frames) that
 * move players and balls. Playback interpolates between steps, like the animated
 * drills coaches share on social media.
 *
 * Element ids are their index in the elements array. Step 0 is the elements' own
 * positions; later steps only store what moved (earlier positions carry forward).
 */
import type { DiagramEl, Pt } from './types';

export interface AnimFrame {
  /** element index → position at this step (only what moved) */
  pos: Record<number, Pt>;
  note?: string;
}

export interface DrillAnimation {
  /** frames[0] is the starting layout (normally empty: elements' own positions) */
  frames: AnimFrame[];
  /** seconds per transition */
  stepSeconds?: number;
}

type PointEl = Extract<DiagramEl, { at: Pt }>;
const MOVABLE = new Set(['a', 'd', 'n', 'gk', 'ball']);
const PLAYERS = new Set(['a', 'd', 'n', 'gk']);
const ARROWS = new Set(['pass', 'run', 'drive', 'shot']);

export const isMovable = (el: DiagramEl): el is PointEl => MOVABLE.has(el.t);
export const isPlayer = (el: DiagramEl): el is PointEl => PLAYERS.has(el.t);
export const isArrow = (el: DiagramEl) => ARROWS.has(el.t);

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: Pt, b: Pt, f: number): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const ease = (f: number) => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);

/** Positions of every movable element at step k (carrying earlier steps forward). */
export function resolveFrame(elements: DiagramEl[], anim: DrillAnimation | null | undefined, k: number): Record<number, Pt> {
  const out: Record<number, Pt> = {};
  elements.forEach((el, i) => { if (isMovable(el)) out[i] = el.at; });
  if (!anim) return out;
  const last = Math.min(k, anim.frames.length - 1);
  for (let s = 0; s <= last; s++) {
    for (const [key, p] of Object.entries(anim.frames[s]?.pos ?? {})) {
      if (out[Number(key)]) out[Number(key)] = p;
    }
  }
  return out;
}

export const stepCount = (anim: DrillAnimation | null | undefined) => Math.max(1, anim?.frames.length ?? 1);

/**
 * The diagram to draw at playback time t (0 … steps-1, fractional between steps).
 * Static arrows are dropped; instead each movement to the next step is shown as a
 * faint arrow (ball = pass, player with ball = drive, player = run).
 */
export function elementsAt(elements: DiagramEl[], anim: DrillAnimation | null | undefined, t: number, showTrails = true): DiagramEl[] {
  const steps = stepCount(anim);
  const tt = Math.max(0, Math.min(t, steps - 1));
  const k = Math.floor(tt);
  const f = ease(tt - k);
  const a = resolveFrame(elements, anim, k);
  const b = k + 1 < steps ? resolveFrame(elements, anim, k + 1) : a;

  const out: DiagramEl[] = [];
  // static layer first (zones, lines, goals, cones, text), then trails, then players and balls on top
  elements.forEach((el) => { if (!isMovable(el) && !(anim && isArrow(el))) out.push(el); });
  if (!anim) return elements;

  if (showTrails && k + 1 < steps) {
    const balls = elements.map((el, i) => (el.t === 'ball' ? i : -1)).filter((i) => i >= 0);
    elements.forEach((el, i) => {
      if (!isMovable(el) || dist(a[i], b[i]) < 0.5) return;
      if (el.t === 'ball') {
        const carried = elements.some((p, j) => isPlayer(p) && dist(a[j], a[i]) < 3.5 && dist(b[j], b[i]) < 3.5);
        if (!carried) out.push({ t: 'pass', from: a[i], to: b[i] });
        return;
      }
      const withBall = balls.some((bi) => dist(a[bi], a[i]) < 3.5 && dist(b[bi], b[i]) < 3.5);
      out.push({ t: withBall ? 'drive' : 'run', from: a[i], to: b[i] });
    });
  }
  elements.forEach((el, i) => {
    if (!isMovable(el) || el.t === 'ball') return;
    out.push({ ...el, at: lerp(a[i], b[i], f) } as DiagramEl);
  });
  elements.forEach((el, i) => {
    if (el.t === 'ball') out.push({ ...el, at: lerp(a[i], b[i], f) });
  });
  return out;
}

/**
 * Many diagrams draw passes without a ball: add one at the start of the first pass
 * so the animation can show the ball travelling.
 */
export function withBall(elements: DiagramEl[]): DiagramEl[] {
  if (elements.some((e) => e.t === 'ball')) return elements;
  const first = elements.find((e) => e.t === 'pass' || e.t === 'shot' || e.t === 'drive') as Extract<DiagramEl, { from: Pt }> | undefined;
  if (!first) return elements;
  return [...elements, { t: 'ball', at: [first.from[0] + 1.5, first.from[1] + 1.2] }];
}

/**
 * Build an animation from a static diagram's arrows (library drills): passes and
 * shots move the nearest ball, runs move the nearest player, drives move both.
 * A pass/drive/shot starts a new step; a run joins the current step when that
 * player hasn't moved in it yet (pass-and-move).
 */
export function autoAnimate(elements: DiagramEl[]): DrillAnimation | null {
  const arrows = elements.filter(isArrow) as Extract<DiagramEl, { from: Pt; to: Pt }>[];
  if (arrows.length === 0) return null;
  const cur = resolveFrame(elements, null, 0);
  const idx = (pred: (el: DiagramEl) => boolean) => elements.map((el, i) => (pred(el) ? i : -1)).filter((i) => i >= 0);
  const balls = idx((el) => el.t === 'ball');
  const players = idx(isPlayer);
  const nearest = (ids: number[], p: Pt, max = Infinity) => {
    let best = -1, bd = max;
    for (const i of ids) { const d = dist(cur[i], p); if (d < bd) { bd = d; best = i; } }
    return best;
  };

  const frames: AnimFrame[] = [{ pos: {} }];
  let step: AnimFrame | null = null;
  const newStep = () => { step = { pos: {} }; frames.push(step); return step; };

  for (const ar of arrows) {
    const move = (i: number, to: Pt, s: AnimFrame) => { s.pos[i] = to; cur[i] = to; };
    if (ar.t === 'run') {
      const p = nearest(players, ar.from, 6);
      if (p < 0) continue;
      const s = step && !(p in step.pos) ? step : newStep();
      move(p, ar.to, s);
      continue;
    }
    const s = newStep();
    if (ar.t === 'drive') {
      const p = nearest(players, ar.from, 6);
      const ball = nearest(balls, ar.from, 6);
      if (p >= 0) move(p, ar.to, s);
      if (ball >= 0) move(ball, [ar.to[0] + 1.5, ar.to[1] + 1.2], s);
    } else {
      const ball = nearest(balls, ar.from, 6) >= 0 ? nearest(balls, ar.from, 6) : nearest(balls, ar.from);
      if (ball >= 0) move(ball, ar.to, s);
    }
  }
  const useful = frames.filter((f, i) => i === 0 || Object.keys(f.pos).length > 0);
  return useful.length > 1 ? { frames: useful, stepSeconds: 1.2 } : null;
}

/** Keep frames consistent after removing element `removed` (indices shift down). */
export function removeElement(elements: DiagramEl[], anim: DrillAnimation | null, removed: number) {
  const els = elements.filter((_, i) => i !== removed);
  if (!anim) return { elements: els, anim };
  const frames = anim.frames.map((f) => {
    const pos: Record<number, Pt> = {};
    for (const [k, p] of Object.entries(f.pos)) {
      const i = Number(k);
      if (i === removed) continue;
      pos[i > removed ? i - 1 : i] = p;
    }
    return { ...f, pos };
  });
  return { elements: els, anim: { ...anim, frames } };
}
