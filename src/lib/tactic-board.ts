/**
 * Tactical board model (pure): tokens for both teams, drawings, and steps that
 * move the tokens — for the team talk and half-time, where time is short.
 * Board units: 105 × 68 (a pitch seen from the side, own goal on the left).
 */
import { getFormation, listAvailableFormations } from './tactical-formations';

export const BW = 105;
export const BH = 68;

export type TokenKind = 'home' | 'away' | 'ball' | 'cone';
export interface Token { id: string; kind: TokenKind; n?: string; name?: string; x: number; y: number }

/** curve: pts = [start, control, end]; zone/circle: two corners of the box; text: one point */
export type DrawKind = 'pass' | 'run' | 'curve' | 'free' | 'zone' | 'circle' | 'text';
export interface Drawing { id: string; t: DrawKind; pts: [number, number][]; color: string; step: number; text?: string }

export interface BoardState {
  sport: string;
  half: boolean;
  tokens: Token[];
  drawings: Drawing[];
  /** steps[k] = positions of the tokens that moved at step k+1 (step 0 = tokens' own x/y) */
  steps: Record<string, [number, number]>[];
  homeFormation?: string | null;
  awayFormation?: string | null;
  /** show the lines that link each sector (defence, midfield, attack) */
  lines?: { home?: boolean; away?: boolean };
  /** what the coach wants to remember about this play */
  note?: string;
}

export interface BoardPlayer { id: string; name: string; number?: number | null; position?: string | null }

let seq = 0;
export const uid = (p = 't') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyBoard = (sport: string): BoardState => ({ sport, half: false, tokens: [], drawings: [], steps: [], homeFormation: null, awayFormation: null });

export const shortName = (name?: string) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

/** Where a formation slot sits on the board. Home defends the left goal; away is mirrored. */
export function slotToBoard(slot: { x: number; y: number }, side: 'home' | 'away'): [number, number] {
  const bx = 3.5 + slot.y * 0.47 * BW;
  const by = 4 + slot.x * (BH - 8);
  return side === 'home' ? [round(bx), round(by)] : [round(BW - bx), round(BH - by)];
}
const round = (v: number) => Math.round(v * 10) / 10;

export function formationCodes(sport: string) {
  return listAvailableFormations(sport).map((f) => ({ code: f.code, name: f.name }));
}

/**
 * Put a team in a formation. Keeps the players already on the board (by order),
 * or uses `players` (the XI) when given; missing ones become numbered tokens.
 */
export function placeFormation(state: BoardState, side: 'home' | 'away', code: string, players?: BoardPlayer[], bySlot?: Record<string, string | null>): BoardState {
  const formation = getFormation(state.sport, code);
  if (!formation) return state;
  const existing = state.tokens.filter((t) => t.kind === side);
  const others = state.tokens.filter((t) => t.kind !== side);
  const byId = new Map((players ?? []).map((p) => [p.id, p]));
  const queue = [...(players ?? [])];
  const used = new Set<string>();
  const tokens: Token[] = formation.slots.map((slot, i) => {
    const [x, y] = slotToBoard(slot, side);
    // 1) explicit slot → player (the live match tactics)
    const pid = bySlot?.[slot.slot_id];
    let p = pid ? byId.get(pid) : undefined;
    // 2) next player of the XI not used yet
    if (!p && players) { while (queue.length && used.has(queue[0].id)) queue.shift(); p = queue.shift(); }
    if (p) { used.add(p.id); return { id: `${side}-${p.id}`, kind: side, n: p.number != null ? String(p.number) : String(i + 1), name: shortName(p.name), x, y }; }
    // 3) keep whoever was already on the board in that order
    const old = !players ? existing[i] : undefined;
    return old ? { ...old, x, y } : { id: uid(side[0]), kind: side, n: String(i + 1), x, y };
  });
  // moved to a new shape: old step positions of this team no longer make sense
  const ids = new Set(existing.map((t) => t.id));
  const steps = state.steps.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !ids.has(k))));
  return { ...state, tokens: [...others, ...tokens], steps, [side === 'home' ? 'homeFormation' : 'awayFormation']: code };
}

/** Position of every token at step k (earlier steps carry forward). */
export function positionsAt(state: BoardState, k: number): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  state.tokens.forEach((t) => { out[t.id] = [t.x, t.y]; });
  for (let s = 0; s < Math.min(k, state.steps.length); s++) {
    for (const [id, p] of Object.entries(state.steps[s])) if (out[id]) out[id] = p;
  }
  return out;
}

const ease = (f: number) => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);
/** Interpolated positions at time t (0 … steps), for playback. */
export function positionsAtTime(state: BoardState, t: number): Record<string, [number, number]> {
  const max = state.steps.length;
  const tt = Math.max(0, Math.min(t, max));
  const k = Math.floor(tt);
  const a = positionsAt(state, k);
  if (k >= max) return a;
  const b = positionsAt(state, k + 1);
  const f = ease(tt - k);
  const out: Record<string, [number, number]> = {};
  for (const id of Object.keys(a)) out[id] = [a[id][0] + (b[id][0] - a[id][0]) * f, a[id][1] + (b[id][1] - a[id][1]) * f];
  return out;
}

export function moveToken(state: BoardState, id: string, step: number, p: [number, number]): BoardState {
  const q: [number, number] = [round(clamp(p[0], 0, BW)), round(clamp(p[1], 0, BH))];
  if (step === 0) return { ...state, tokens: state.tokens.map((t) => (t.id === id ? { ...t, x: q[0], y: q[1] } : t)) };
  const steps = state.steps.map((s, i) => (i === step - 1 ? { ...s, [id]: q } : s));
  return { ...state, steps };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function removeToken(state: BoardState, id: string): BoardState {
  return {
    ...state,
    tokens: state.tokens.filter((t) => t.id !== id),
    steps: state.steps.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== id))),
  };
}

export function addStep(state: BoardState, after: number): BoardState {
  const steps = [...state.steps];
  steps.splice(after, 0, {});
  // drawings of later steps move one step forward
  const drawings = state.drawings.map((d) => (d.step > after ? { ...d, step: d.step + 1 } : d));
  return { ...state, steps, drawings };
}
export function deleteStep(state: BoardState, step: number): BoardState {
  if (step < 1) return state;
  return {
    ...state,
    steps: state.steps.filter((_, i) => i !== step - 1),
    drawings: state.drawings.filter((d) => d.step !== step).map((d) => (d.step > step ? { ...d, step: d.step - 1 } : d)),
  };
}

/** Squared distance from point p to segment ab (to find the drawing under the finger). */
export function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
/** A finger-drawn arc becomes a clean curve: start, end and the point furthest from the straight line. */
export function curveFromPath(pts: [number, number][]): [number, number][] {
  const a = pts[0], b = pts[pts.length - 1];
  let apex: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], far = 1;
  for (const p of pts) { const d = distToSegment(p, a, b); if (d > far) { far = d; apex = p; } }
  // control point of the quadratic that passes through the apex half-way
  return [a, [round(2 * apex[0] - (a[0] + b[0]) / 2), round(2 * apex[1] - (a[1] + b[1]) / 2)], b];
}
export function curvePoints(d: Pick<Drawing, 'pts'>, n = 14): [number, number][] {
  const [a, c, b] = d.pts;
  if (!c || !b) return d.pts;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as [number, number];
  });
}

export function translateDrawing(d: Drawing, dx: number, dy: number): Drawing {
  return { ...d, pts: d.pts.map((p) => [round(p[0] + dx), round(p[1] + dy)] as [number, number]) };
}

/**
 * Lines linking each sector of a team, from where the players are right now.
 * Sectors come from the formation ("2-3-1"); without one, players at a similar depth are grouped.
 * Who belongs to each sector is decided at the first step, so a line keeps following the
 * same players when they move.
 */
export function formationLines(state: BoardState, side: 'home' | 'away', pos: Record<string, [number, number]>): [number, number][][] {
  const toks = state.tokens.filter((t) => t.kind === side && pos[t.id]);
  if (toks.length < 3) return [];
  const depth = (t: Token) => (side === 'home' ? t.x : BW - t.x);
  const outfield = [...toks].sort((a, b) => depth(a) - depth(b)).slice(1); // the deepest one is the keeper
  let sizes = ((side === 'home' ? state.homeFormation : state.awayFormation)?.match(/\d+/g) ?? []).map(Number);
  if (sizes.reduce((a, b) => a + b, 0) === outfield.length + 1 && sizes[0] === 1) sizes = sizes.slice(1);
  if (sizes.reduce((a, b) => a + b, 0) !== outfield.length) {
    sizes = [];
    outfield.forEach((p, i) => { if (i === 0 || depth(p) - depth(outfield[i - 1]) > 8) sizes.push(1); else sizes[sizes.length - 1]++; });
  }
  const out: [number, number][][] = [];
  let i = 0;
  for (const n of sizes) {
    const group = outfield.slice(i, i + n).sort((a, b) => a.y - b.y);
    i += n;
    if (group.length >= 2) out.push(group.map((t) => pos[t.id]));
  }
  return out;
}

export function drawingAt(state: BoardState, step: number, p: [number, number], tolerance = 2.2): Drawing | null {
  const list = state.drawings.filter((d) => d.step === step);
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    if (d.t === 'text') {
      const w = Math.max(3, (d.text?.length ?? 0) * 0.75);
      if (Math.abs(p[0] - d.pts[0][0]) <= w && Math.abs(p[1] - d.pts[0][1]) <= 2.4) return d;
      continue;
    }
    if (d.t === 'circle') {
      const [a, b] = d.pts;
      const rx = Math.abs(a[0] - b[0]) / 2, ry = Math.abs(a[1] - b[1]) / 2;
      const nx = (p[0] - (a[0] + b[0]) / 2) / (rx || 1), ny = (p[1] - (a[1] + b[1]) / 2) / (ry || 1);
      if (nx * nx + ny * ny <= 1) return d;
      continue;
    }
    if (d.t === 'curve') {
      const c = curvePoints(d);
      for (let j = 0; j < c.length - 1; j++) if (distToSegment(p, c[j], c[j + 1]) <= tolerance) return d;
      continue;
    }
    if (d.t === 'zone') {
      const [a, b] = d.pts;
      if (p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])) return d;
      continue;
    }
    for (let j = 0; j < d.pts.length - 1; j++) if (distToSegment(p, d.pts[j], d.pts[j + 1]) <= tolerance) return d;
  }
  return null;
}

/**
 * The board the coach left on this device: it stays until "Limpar tudo".
 * `sig` says who was on the pitch; if that changed meanwhile (substitution, other XI),
 * the drawings, the opponent and the ball are kept and only my players are refreshed.
 */
export interface BoardDraft { state: BoardState; sig?: string; loaded?: { id: string; name: string } | null }
const DRAFT_KEY = (key: string) => `treinon_board_${key}`;

export function saveBoardDraft(key: string, draft: BoardDraft): void {
  try { localStorage.setItem(DRAFT_KEY(key), JSON.stringify(draft)); } catch { /* private mode / full */ }
}
export function clearBoardDraft(key: string): void {
  try { localStorage.removeItem(DRAFT_KEY(key)); } catch { /* ignore */ }
}
export function loadBoardDraft(key: string, initial: BoardState, sig?: string): { state: BoardState; loaded: { id: string; name: string } | null } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(key));
    if (!raw) return null;
    const d = JSON.parse(raw) as BoardDraft;
    if (!d?.state) return null;
    let state = normalizeBoard(d.state, initial.sport);
    if ((d.sig ?? '') !== (sig ?? '')) {
      const home = initial.tokens.filter((t) => t.kind === 'home');
      const tokens = [...state.tokens.filter((t) => t.kind !== 'home'), ...home];
      const ids = new Set(tokens.map((t) => t.id));
      state = {
        ...state, sport: initial.sport, tokens, homeFormation: initial.homeFormation,
        steps: state.steps.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => ids.has(k)))),
      };
    }
    return { state, loaded: d.loaded && typeof d.loaded.id === 'string' ? d.loaded : null };
  } catch { return null; }
}

/** Saved boards must survive old/partial data. */
export function normalizeBoard(raw: unknown, fallbackSport: string): BoardState {
  const r = (raw ?? {}) as Partial<BoardState>;
  return {
    sport: typeof r.sport === 'string' ? r.sport : fallbackSport,
    half: !!r.half,
    tokens: Array.isArray(r.tokens) ? r.tokens.filter((t) => t && typeof t.x === 'number' && typeof t.y === 'number') : [],
    drawings: Array.isArray(r.drawings) ? r.drawings.filter((d) => d && Array.isArray(d.pts) && d.pts.length > 0) : [],
    steps: Array.isArray(r.steps) ? r.steps : [],
    homeFormation: r.homeFormation ?? null,
    awayFormation: r.awayFormation ?? null,
    lines: r.lines && typeof r.lines === 'object' ? { home: !!r.lines.home, away: !!r.lines.away } : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
  };
}
