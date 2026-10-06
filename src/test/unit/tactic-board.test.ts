import { describe, it, expect } from 'vitest';
import { emptyBoard, placeFormation, positionsAt, positionsAtTime, moveToken, addStep, deleteStep, removeToken, drawingAt, normalizeBoard, formationCodes, BW } from '@/lib/tactic-board';

const f7 = formationCodes('football_7')[0].code;
const xi = Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, name: `Jogador ${i + 1} Silva`, number: i + 1, position: i === 0 ? 'GK' : 'CM' }));

describe('tactical board', () => {
  it('places my XI with names and the opponent mirrored on the other half', () => {
    let b = placeFormation(emptyBoard('football_7'), 'home', f7, xi);
    b = placeFormation(b, 'away', f7);
    const home = b.tokens.filter((t) => t.kind === 'home');
    const away = b.tokens.filter((t) => t.kind === 'away');
    expect(home).toHaveLength(7);
    expect(away).toHaveLength(7);
    expect(home[0].name).toBe('Jogador S.');
    expect(home.every((t) => t.x < BW / 2)).toBe(true);
    expect(away.every((t) => t.x > BW / 2)).toBe(true);
  });

  it('uses the live-match slots when given', () => {
    const b = placeFormation(emptyBoard('football_7'), 'home', f7, xi, { GK: 'p3' });
    const gk = b.tokens.reduce((a, t) => (t.x < a.x ? t : a));
    expect(gk.id).toBe('home-p3');
  });

  it('changing formation keeps the same players', () => {
    const codes = formationCodes('football_7');
    let b = placeFormation(emptyBoard('football_7'), 'home', codes[0].code, xi);
    const names = b.tokens.map((t) => t.name).sort();
    b = placeFormation(b, 'home', codes[codes.length - 1].code);
    expect(b.tokens.map((t) => t.name).sort()).toEqual(names);
  });

  it('steps move tokens and play back in between', () => {
    let b = placeFormation(emptyBoard('football_7'), 'home', f7, xi);
    const id = b.tokens[1].id;
    const start = [b.tokens[1].x, b.tokens[1].y];
    b = addStep(b, 0);
    b = moveToken(b, id, 1, [start[0] + 20, start[1]]);
    expect(positionsAt(b, 0)[id]).toEqual(start);
    expect(positionsAt(b, 1)[id][0]).toBeCloseTo(start[0] + 20);
    const mid = positionsAtTime(b, 0.5)[id][0];
    expect(mid).toBeGreaterThan(start[0]);
    expect(mid).toBeLessThan(start[0] + 20);
    b = deleteStep(b, 1);
    expect(b.steps).toHaveLength(0);
  });

  it('removing a token cleans its steps; eraser finds the drawing under the finger', () => {
    let b = placeFormation(emptyBoard('football_7'), 'home', f7, xi);
    const id = b.tokens[2].id;
    b = moveToken(addStep(b, 0), id, 1, [50, 30]);
    b = removeToken(b, id);
    expect(b.steps[0][id]).toBeUndefined();
    b = { ...b, drawings: [{ id: 'd1', t: 'pass', pts: [[10, 10], [40, 10]], color: '#fff', step: 0 }, { id: 'd2', t: 'zone', pts: [[60, 20], [80, 40]], color: '#ff0', step: 0 }] };
    expect(drawingAt(b, 0, [25, 11])?.id).toBe('d1');
    expect(drawingAt(b, 0, [70, 30])?.id).toBe('d2');
    expect(drawingAt(b, 0, [25, 30])).toBeNull();
    expect(drawingAt(b, 1, [25, 11])).toBeNull();
  });

  it('old or broken saved boards still open', () => {
    const b = normalizeBoard({ tokens: [{ id: 'a', kind: 'home', x: 1, y: 2 }, null, { id: 'b' }], drawings: 'x' }, 'football_9');
    expect(b.sport).toBe('football_9');
    expect(b.tokens).toHaveLength(1);
    expect(b.drawings).toEqual([]);
  });
});
