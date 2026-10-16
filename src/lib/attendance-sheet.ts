/**
 * The paper attendance sheet: printed with the players' names in rows and the trainings in
 * columns, the players sign in their box, and a photo of the signed sheet is read back.
 *
 * Reading: four black squares sit at the corners of the table (the bottom-right one is hollow,
 * so the photo can be taken any way round). They are found in the photo, the sheet is mapped
 * onto it, and each box counts as signed when enough of it is ink. The coach checks the result
 * before anything is saved.
 *
 * Everything here is plain arithmetic on pixels, so it is tested with drawn images.
 */

// ── the sheet (millimetres, A4 portrait) ───────────────────────────────────

export const PAGE = { w: 210, h: 297 };
const X0 = 20, X1 = 190, Y0 = 52, BOTTOM_LIMIT = 266, NAME_W = 50, HEADER_H = 13, MARK = 7, MARK_GAP = 7;

export interface Rect { x: number; y: number; w: number; h: number }
export interface SheetLayout {
  rows: number; cols: number;
  table: Rect; header: Rect; nameW: number; colW: number; rowH: number;
  /** centres of the four marks: top-left, top-right, bottom-right (hollow), bottom-left */
  marks: [number, number][];
  markSize: number;
  cell: (row: number, col: number) => Rect;
}

export const MAX_SHEET_COLUMNS = 10;
export const MAX_SHEET_ROWS = 36;

export function sheetLayout(players: number, sessions: number): SheetLayout {
  const rows = Math.max(1, Math.min(players, MAX_SHEET_ROWS));
  const cols = Math.max(1, Math.min(sessions, MAX_SHEET_COLUMNS));
  const colW = (X1 - X0 - NAME_W) / cols;
  const rowH = Math.min(11, (BOTTOM_LIMIT - Y0 - HEADER_H) / rows);
  const tableH = HEADER_H + rows * rowH;
  const y1 = Y0 + tableH;
  const marks: [number, number][] = [
    [X0 - MARK_GAP, Y0 - MARK_GAP], [X1 + MARK_GAP, Y0 - MARK_GAP], [X1 + MARK_GAP, y1 + MARK_GAP], [X0 - MARK_GAP, y1 + MARK_GAP],
  ];
  return {
    rows, cols, nameW: NAME_W, colW, rowH, marks, markSize: MARK,
    table: { x: X0, y: Y0, w: X1 - X0, h: tableH },
    header: { x: X0, y: Y0, w: X1 - X0, h: HEADER_H },
    cell: (r, c) => ({ x: X0 + NAME_W + c * colW, y: Y0 + HEADER_H + r * rowH, w: colW, h: rowH }),
  };
}

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeSheetCode(random: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join('');
}

/** The next trainings to put on a sheet: from today on, in order. */
export function sessionsForSheet<T extends { date: string }>(sessions: T[], from: Date, max = 7): T[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return sessions.filter((s) => Date.parse(s.date) >= start).sort((a, b) => a.date.localeCompare(b.date)).slice(0, max);
}

// ── the week: training days kept on the team ───────────────────────────────

export interface TrainingDay { day: number; time: string }

export function cleanSchedule(raw: unknown): TrainingDay[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<number, TrainingDay>();
  for (const d of raw) {
    const day = Number((d as TrainingDay)?.day), time = String((d as TrainingDay)?.time ?? '');
    if (Number.isInteger(day) && day >= 0 && day <= 6 && /^\d{2}:\d{2}$/.test(time)) out.set(day, { day, time });
  }
  return [...out.values()].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
}

/**
 * The trainings of the schedule between two days (both included), as local date-times.
 * Days that already have a training of the team are left out.
 */
export function plannedTrainings(schedule: TrainingDay[], from: Date, until: Date, existing: string[] = []): Date[] {
  const taken = new Set(existing.map((d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; }));
  const out: Date[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(until.getFullYear(), until.getMonth(), until.getDate());
  for (; day <= end; day.setDate(day.getDate() + 1)) {
    const slot = schedule.find((s) => s.day === day.getDay());
    if (!slot || taken.has(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`)) continue;
    const [h, m] = slot.time.split(':').map(Number);
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    if (at.getTime() > from.getTime()) out.push(at);
  }
  return out;
}

// ── reading a photo ────────────────────────────────────────────────────────

export function toGray(rgba: ArrayLike<number>, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return g;
}

/** Ink = darker than its surroundings (copes with shadows and uneven light). 1 = ink. */
export function binarize(gray: Uint8Array, w: number, h: number, windowFrac = 1 / 8, ratio = 0.78): Uint8Array {
  const r = Math.max(4, Math.round(Math.min(w, h) * windowFrac / 2));
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += gray[y * w + x]; sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row; }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1);
      const s = sum[yb * (w + 1) + xb] - sum[ya * (w + 1) + xb] - sum[yb * (w + 1) + xa] + sum[ya * (w + 1) + xa];
      const mean = s / ((yb - ya) * (xb - xa));
      out[y * w + x] = gray[y * w + x] < mean * ratio || gray[y * w + x] < 60 ? 1 : 0;
    }
  }
  return out;
}

export interface Blob { area: number; minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number }

/** Groups of touching ink pixels. */
export function blobs(bin: Uint8Array, w: number, h: number, minArea = 20): Blob[] {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const out: Blob[] = [];
  for (let start = 0; start < bin.length; start++) {
    if (!bin[start] || seen[start]) continue;
    let top = 0; stack[top++] = start; seen[start] = 1;
    let area = 0, minX = w, minY = h, maxX = 0, maxY = 0, sx = 0, sy = 0;
    while (top) {
      const p = stack[--top], x = p % w, y = (p / w) | 0;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && bin[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && bin[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[top++] = p - w; }
      if (y < h - 1 && bin[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[top++] = p + w; }
    }
    if (area >= minArea) out.push({ area, minX, minY, maxX, maxY, cx: sx / area, cy: sy / area });
  }
  return out;
}

type Pt = [number, number];
export type MarkResult = { ok: true; marks: [Pt, Pt, Pt, Pt]; reason?: undefined } | { ok: false; reason: string; marks?: undefined };

/**
 * The four corner squares, in sheet order (top-left, top-right, bottom-right, bottom-left),
 * whichever way the photo was taken. The hollow one is the bottom-right.
 */
export function findMarks(bin: Uint8Array, w: number, h: number): MarkResult {
  const side = Math.min(w, h);
  const all = blobs(bin, w, h, Math.round((side * 0.008) ** 2));
  const squares = all.filter((b) => {
    const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
    const aspect = bw / bh;
    return aspect > 0.6 && aspect < 1.65 && Math.max(bw, bh) > side * 0.012 && Math.max(bw, bh) < side * 0.09;
  }).map((b) => {
    const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
    const fill = b.area / (bw * bh);
    const centre = bin[Math.round(b.cy) * w + Math.round(b.cx)];
    return { ...b, size: (bw + bh) / 2, fill, hollow: fill > 0.4 && fill < 0.8 && !centre, solid: fill >= 0.8 };
  }).filter((b) => b.solid || b.hollow);

  const hollows = squares.filter((b) => b.hollow), solids = squares.filter((b) => b.solid);
  if (!hollows.length || solids.length < 3) return { ok: false, reason: 'Não encontrei os quatro quadrados pretos dos cantos. Fotografe a folha inteira, de frente e com boa luz.' };

  // try each hollow square with the three solid ones of the most similar size that make the biggest quadrilateral
  let best: { pts: Pt[]; area: number } | null = null;
  for (const hollow of hollows) {
    const near = solids.filter((s) => s.size > hollow.size * 0.6 && s.size < hollow.size * 1.6);
    if (near.length < 3) continue;
    // the three solid squares farthest apart from each other and from the hollow one
    const pick = near.sort((a, b) => Math.hypot(b.cx - hollow.cx, b.cy - hollow.cy) - Math.hypot(a.cx - hollow.cx, a.cy - hollow.cy));
    const far = pick[0];
    const rest = pick.slice(1).sort((a, b) =>
      (Math.hypot(b.cx - hollow.cx, b.cy - hollow.cy) + Math.hypot(b.cx - far.cx, b.cy - far.cy)) -
      (Math.hypot(a.cx - hollow.cx, a.cy - hollow.cy) + Math.hypot(a.cx - far.cx, a.cy - far.cy)));
    const quad: Pt[] = [[hollow.cx, hollow.cy], [far.cx, far.cy], [rest[0].cx, rest[0].cy], [rest[1].cx, rest[1].cy]];
    const area = polygonArea(orderClockwise(quad));
    if (!best || area > best.area) best = { pts: quad, area };
  }
  if (!best || best.area < w * h * 0.08) return { ok: false, reason: 'A folha está muito pequena na fotografia. Aproxime-se até a folha encher o ecrã.' };

  // clockwise on the photo, starting at the hollow (bottom-right): BR, BL, TL, TR
  const ordered = orderClockwise(best.pts);
  const hi = ordered.findIndex((p) => p[0] === best!.pts[0][0] && p[1] === best!.pts[0][1]);
  const br = ordered[hi], bl = ordered[(hi + 1) % 4], tl = ordered[(hi + 2) % 4], tr = ordered[(hi + 3) % 4];
  return { ok: true, marks: [tl, tr, br, bl] };
}

function orderClockwise(pts: Pt[]): Pt[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // y grows downwards, so increasing angle runs clockwise on screen
  return [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}
function polygonArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}

/** The projective map that sends the four `from` points onto the four `to` points. */
export function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gauss–Jordan with partial pivoting
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return [...b.map((v, i) => v / A[i][i]), 1];
}
export function project(H: number[], x: number, y: number): Pt {
  const d = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
}

export interface SheetReading { ink: number[][]; signed: boolean[][]; unsure: boolean[][]; H: number[] }

/** How much of each box is ink (inner part only, so the printed lines do not count). */
export function readSheet(bin: Uint8Array, w: number, h: number, marks: [Pt, Pt, Pt, Pt], layout: SheetLayout, threshold = 0.035): SheetReading {
  const H = homography(layout.marks, marks);
  const ink: number[][] = [], signed: boolean[][] = [], unsure: boolean[][] = [];
  const N = 14, M = 7;
  for (let r = 0; r < layout.rows; r++) {
    ink.push([]); signed.push([]); unsure.push([]);
    for (let c = 0; c < layout.cols; c++) {
      const cell = layout.cell(r, c);
      const ix = cell.w * 0.14, iy = cell.h * 0.2;
      let dark = 0, total = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
        const [px, py] = project(H, cell.x + ix + ((cell.w - 2 * ix) * (i + 0.5)) / N, cell.y + iy + ((cell.h - 2 * iy) * (j + 0.5)) / M);
        const x = Math.round(px), y = Math.round(py);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        total++; dark += bin[y * w + x];
      }
      const f = total ? dark / total : 0;
      ink[r].push(f);
      signed[r].push(f >= threshold);
      unsure[r].push(f >= threshold * 0.5 && f < threshold * 2);
    }
  }
  return { ink, signed, unsure, H };
}

/** The photo, made smaller for reading (the long side at most `max` pixels). Browser only. */
export async function photoPixels(file: File, max = 1600): Promise<{ rgba: Uint8ClampedArray; w: number; h: number; canvas: HTMLCanvasElement }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return { rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width, h: canvas.height, canvas };
}
