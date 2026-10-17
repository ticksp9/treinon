import { describe, it, expect } from 'vitest';
import {
  binarize, cleanSchedule, findMarks, homography, makeSheetCode, plannedTrainings, project, readSheet, sessionsForSheet, sheetLayout, toGray,
  type SheetLayout,
} from '@/lib/attendance-sheet';

type Pt = [number, number];

/**
 * Draws a "photo" of a signed sheet: the page seen in perspective (photo corners → page
 * corners given), black corner marks, table lines, scribbles in the signed boxes, a shadow
 * across the page and a little noise.
 */
function photo(layout: SheetLayout, signed: boolean[][], pageCornersInPhoto: Pt[], w = 900, h = 1200) {
  const page: Pt[] = [[0, 0], [210, 0], [210, 297], [0, 297]];
  const toPage = homography(pageCornersInPhoto, page);
  const rgba = new Uint8ClampedArray(w * h * 4);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const half = layout.markSize / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [px, py] = project(toPage, x, y);
    let v = 90; // table top behind the sheet
    if (px >= 0 && px <= 210 && py >= 0 && py <= 297) {
      v = 235;
      // marks: solid, the bottom-right one hollow
      layout.marks.forEach(([mx, my], i) => {
        if (Math.abs(px - mx) <= half && Math.abs(py - my) <= half) {
          const inner = i === 2 && Math.abs(px - mx) <= half * 0.6 && Math.abs(py - my) <= half * 0.6;
          if (!inner) v = 30;
        }
      });
      // printed lines
      const t = layout.table;
      if (px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.h) {
        const onRow = Math.abs(((py - t.y - layout.header.h) % layout.rowH + layout.rowH) % layout.rowH) < 0.25 || Math.abs(py - t.y) < 0.25 || Math.abs(py - t.y - layout.header.h) < 0.25;
        const cx = px - t.x - layout.nameW;
        const onCol = Math.abs(px - t.x) < 0.25 || (cx > -0.25 && Math.abs((cx % layout.colW + layout.colW) % layout.colW) < 0.25);
        if (onRow || onCol) v = 70;
        // names: a few dark strokes in the name column
        if (px > t.x + 2 && px < t.x + 30 && py > t.y + layout.header.h && Math.abs(((py - t.y - layout.header.h) % layout.rowH) - layout.rowH / 2) < 0.4) v = 60;
      }
      // signatures: a wavy stroke across the box
      for (let r = 0; r < layout.rows; r++) for (let c = 0; c < layout.cols; c++) {
        if (!signed[r][c]) continue;
        const cell = layout.cell(r, c);
        if (px > cell.x + cell.w * 0.15 && px < cell.x + cell.w * 0.85 && py > cell.y && py < cell.y + cell.h) {
          const wave = cell.y + cell.h / 2 + Math.sin((px - cell.x) * 1.3) * cell.h * 0.2;
          if (Math.abs(py - wave) < 0.45) v = 45;
        }
      }
      // a shadow over the left part of the page
      if (px < 80) v = Math.round(v * 0.7);
    }
    v = Math.max(0, Math.min(255, v + Math.round((rnd() - 0.5) * 16)));
    const i = (y * w + x) * 4;
    rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
  }
  return { rgba, w, h };
}

function read(layout: SheetLayout, p: { rgba: Uint8ClampedArray; w: number; h: number }) {
  const bin = binarize(toGray(p.rgba, p.w, p.h), p.w, p.h);
  const m = findMarks(bin, p.w, p.h);
  if (!m.ok) throw new Error(m.reason);
  return readSheet(bin, p.w, p.h, m.marks, layout);
}

const pattern = (rows: number, cols: number) => Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (r * 7 + c * 3) % 5 !== 0));

describe('attendance sheet: the page', () => {
  it('fits every player and training on one page', () => {
    const l = sheetLayout(30, 7);
    expect(l.rows).toBe(30);
    expect(l.table.y + l.table.h).toBeLessThanOrEqual(266.01);
    expect(l.marks[2][1]).toBeLessThan(297 - 10);
    expect(l.cell(29, 6).x + l.cell(29, 6).w).toBeCloseTo(190, 5);
  });

  it('makes short codes without letters that look alike', () => {
    expect(makeSheetCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('puts the next trainings on the sheet, from today on', () => {
    const s = ['2026-10-12T17:30:00Z', '2026-10-14T17:30:00Z', '2026-10-19T17:30:00Z', '2026-10-15T17:30:00Z'].map((date) => ({ date }));
    expect(sessionsForSheet(s, new Date('2026-10-14T20:00:00'), 2).map((x) => x.date)).toEqual(['2026-10-14T17:30:00Z', '2026-10-15T17:30:00Z']);
  });
});

describe('attendance sheet: the week', () => {
  it('keeps one time per weekday, Monday first', () => {
    expect(cleanSchedule([{ day: 3, time: '18:30' }, { day: 1, time: '18:30' }, { day: 0, time: '10:00' }, { day: 1, time: '19:00' }, { day: 9, time: '10:00' }, { day: 2, time: '7' }]))
      .toEqual([{ day: 1, time: '19:00' }, { day: 3, time: '18:30' }, { day: 0, time: '10:00' }]);
    expect(cleanSchedule(null)).toEqual([]);
  });

  it('plans the trainings of the coming weeks, skipping days that already have one', () => {
    const sched = [{ day: 1, time: '18:30' }, { day: 3, time: '18:30' }, { day: 4, time: '18:30' }];
    const out = plannedTrainings(sched, new Date('2026-10-12T19:00:00'), new Date('2026-10-25T12:00:00'), ['2026-10-14T17:30:00Z']);
    // Mon 12 already past its hour; Wed 14 exists; then Thu 15, Mon 19, Wed 21, Thu 22
    expect(out.map((d) => `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`)).toEqual(['15/10 18:30', '19/10 18:30', '21/10 18:30', '22/10 18:30']);
  });
});

describe('attendance sheet: reading a photo', () => {
  it('reads a sheet photographed from the front', () => {
    const l = sheetLayout(12, 7);
    const signed = pattern(12, 7);
    const r = read(l, photo(l, signed, [[40, 60], [860, 60], [860, 1140], [40, 1140]]));
    expect(r.signed).toEqual(signed);
  });

  it('reads it in perspective, with a shadow', () => {
    const l = sheetLayout(20, 6);
    const signed = pattern(20, 6);
    const r = read(l, photo(l, signed, [[90, 40], [840, 110], [880, 1160], [20, 1100]]));
    expect(r.signed).toEqual(signed);
  });

  it('reads it upside down (the hollow mark tells which corner is which)', () => {
    const l = sheetLayout(15, 7);
    const signed = pattern(15, 7);
    const r = read(l, photo(l, signed, [[860, 1140], [40, 1140], [40, 60], [860, 60]]));
    expect(r.signed).toEqual(signed);
  });

  it('says so when the corners are not in the photo', () => {
    const blank = new Uint8ClampedArray(400 * 300 * 4).fill(230);
    const bin = binarize(toGray(blank, 400, 300), 400, 300);
    const m = findMarks(bin, 400, 300);
    expect(m.ok).toBe(false);
  });
});

import { alignSessions, sessionFor } from '@/lib/attendance-sheet';

describe('attendance sheet: teams that train together', () => {
  it('finds the other team training of the same day', () => {
    const cols = [{ date: '2026-10-19T17:30:00Z' }, { date: '2026-10-21T17:30:00Z' }, { date: '2026-10-22T17:30:00Z' }];
    const other = [{ id: 'b', date: '2026-10-21T17:00:00Z' }, { id: 'a', date: '2026-10-19T17:30:00Z' }, { id: 'x', date: '2026-10-25T17:30:00Z' }];
    expect(alignSessions(cols, other).map((s) => s?.id ?? null)).toEqual(['a', 'b', null]);
  });

  it('saves each signature in the player own team', () => {
    const sheet = { team_id: 'T13', session_ids: ['s1', 's2'], session_map: { T13: ['s1', 's2'], T12: ['u1', 'u2'] } };
    expect(sessionFor(sheet, 'T12', 1)).toBe('u2');
    expect(sessionFor(sheet, 'T13', 0)).toBe('s1');
    expect(sessionFor(sheet, 'T99', 0)).toBeNull();
    // older sheets (one team only)
    expect(sessionFor({ team_id: 'T13', session_ids: ['s1'] }, 'T13', 0)).toBe('s1');
  });
});

describe('attendance sheet: more room to sign (version 2)', () => {
  it('gives the boxes the room the old name column took', () => {
    const v1 = sheetLayout(29, 7);
    const v2 = sheetLayout(29, 7, { version: 2, nameW: 34 });
    expect(v2.colW).toBeGreaterThan(v1.colW + 3);
    expect(v2.rowH).toBeGreaterThan(v1.rowH);
    expect(v2.marks[2][1] + v2.markSize / 2).toBeLessThan(297 - 8);
    expect(v2.marks[0][0] - v2.markSize / 2).toBeGreaterThanOrEqual(6);
    // the name column never gets absurdly thin or wide
    expect(sheetLayout(29, 7, { version: 2, nameW: 10 }).nameW).toBe(28);
    expect(sheetLayout(29, 7, { version: 2, nameW: 90 }).nameW).toBe(46);
    // a sheet printed before keeps its old boxes
    expect(sheetLayout(29, 7, {}).nameW).toBe(50);
  });

  it('reads a version-2 sheet photographed at an angle', () => {
    const l = sheetLayout(29, 7, { version: 2, nameW: 34 });
    const signed = pattern(29, 7);
    const r = read(l, photo(l, signed, [[70, 30], [860, 80], [890, 1170], [30, 1130]]));
    expect(r.signed).toEqual(signed);
  });
});
