import { describe, it, expect } from 'vitest';
import { emptyBoard, placeFormation, positionsAt, positionsAtTime, moveToken, addStep, deleteStep, removeToken, drawingAt, normalizeBoard, saveBoardDraft, loadBoardDraft, clearBoardDraft, formationCodes, formationLines, curveFromPath, curvePoints, translateDrawing, BW } from '@/lib/tactic-board';

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

  it('formation lines link each sector and follow the players', () => {
    const b = placeFormation(emptyBoard('football_7'), 'home', '2-3-1', xi);
    const lines = formationLines(b, 'home', positionsAt(b, 0));
    expect(lines.map((l) => l.length)).toEqual([2, 3]); // defence and midfield; the lone striker has no line
    // each line goes from one side of the pitch to the other
    lines.forEach((l) => l.forEach((p, i) => i && expect(p[1]).toBeGreaterThan(l[i - 1][1])));
    // a midfielder running past the striker stays on the midfield line
    const mids = lines[1];
    const runner = b.tokens.find((tk) => tk.x === mids[0][0] && tk.y === mids[0][1])!;
    const moved = moveToken(addStep(b, 0), runner.id, 1, [90, runner.y]);
    const after = formationLines(moved, 'home', positionsAt(moved, 1));
    expect(after[1]).toHaveLength(3);
    expect(after[1].some((p) => p[0] === 90)).toBe(true);
    // no formation chosen: players at a similar depth are grouped
    const free = { ...b, homeFormation: null };
    expect(formationLines(free, 'home', positionsAt(free, 0)).length).toBeGreaterThanOrEqual(2);
  });

  it('a finger arc becomes a curve through its furthest point; drawings can be moved and found', () => {
    const c = curveFromPath([[10, 30], [20, 22], [30, 20], [40, 22], [50, 30]]);
    expect(c).toHaveLength(3);
    const mid = curvePoints({ pts: c })[7];
    expect(mid[0]).toBeCloseTo(30, 0);
    expect(mid[1]).toBeCloseTo(20, 0);
    let b = emptyBoard('football_7');
    b = { ...b, drawings: [
      { id: 'c', t: 'curve', pts: c, color: '#fff', step: 0 },
      { id: 'o', t: 'circle', pts: [[60, 10], [80, 30]], color: '#fff', step: 0 },
      { id: 'x', t: 'text', pts: [[20, 60]], color: '#fff', step: 0, text: 'Pressão' },
    ] };
    expect(drawingAt(b, 0, [30, 20.5])?.id).toBe('c');
    expect(drawingAt(b, 0, [30, 29])).toBeNull(); // the straight line between the ends is not the curve
    expect(drawingAt(b, 0, [70, 20])?.id).toBe('o');
    expect(drawingAt(b, 0, [61, 11])).toBeNull(); // corner of the box is outside the ellipse
    expect(drawingAt(b, 0, [22, 60])?.id).toBe('x');
    expect(translateDrawing(b.drawings[1], 5, -5).pts).toEqual([[65, 5], [85, 25]]);
  });

  it('the board is still there when the coach comes back, until it is cleared', () => {
    localStorage.clear();
    const initial = placeFormation(placeFormation(emptyBoard('football_7'), 'home', f7, xi), 'away', f7);
    const id = initial.tokens.find((t) => t.kind === 'home')!.id;
    let work = moveToken(initial, id, 0, [40, 40]);
    work = { ...work, note: 'Canto 1', drawings: [{ id: 'd1', t: 'pass', pts: [[10, 10], [40, 10]], color: '#fff', step: 0 }] };
    saveBoardDraft('k', { state: work, sig: 'A', loaded: { id: 'play1', name: 'Canto 1' } });
    // same players: exactly as it was left
    const back = loadBoardDraft('k', initial, 'A')!;
    expect(back.state.tokens.find((t) => t.id === id)).toMatchObject({ x: 40, y: 40 });
    expect(back.state.drawings).toHaveLength(1);
    expect(back.loaded?.name).toBe('Canto 1');
    // a substitution meanwhile: drawings and opponent stay, my players are the ones on the pitch now
    const xi2 = [...xi.slice(0, 6), { id: 'sub', name: 'Novo Jogador', number: 12, position: 'CM' }];
    const initial2 = placeFormation(emptyBoard('football_7'), 'home', f7, xi2);
    const merged = loadBoardDraft('k', initial2, 'B')!.state;
    expect(merged.tokens.some((t) => t.id === 'home-sub')).toBe(true);
    expect(merged.tokens.some((t) => t.id === 'home-p7')).toBe(false);
    expect(merged.tokens.filter((t) => t.kind === 'away')).toHaveLength(7);
    expect(merged.drawings).toHaveLength(1);
    clearBoardDraft('k');
    expect(loadBoardDraft('k', initial, 'A')).toBeNull();
  });

  it('notes and line toggles survive saving', () => {
    const b = normalizeBoard({ tokens: [], drawings: [{ id: 'e', pts: [] }], lines: { home: 1 }, note: 'Canto 1' }, 'football_7');
    expect(b.lines).toEqual({ home: true, away: false });
    expect(b.note).toBe('Canto 1');
    expect(b.drawings).toEqual([]);
  });
});
