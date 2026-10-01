/**
 * Playing time, counted to the SECOND.
 *
 * Why: youth formats (F5/F7/F9) allow unlimited substitutions with re-entry.
 * A child can go in and out 6–10 times per match; rounding every stint to whole
 * minutes (the old approach) loses or adds several minutes per player.
 * Here every stint is measured in seconds on the match clock and minutes are
 * only rounded at the very end, so the sum is always consistent.
 *
 * Time model
 * - The match clock is cumulative over parts: part k starts at the sum of the
 *   REAL durations (seconds actually played) of the previous parts.
 * - A substitution event happens at `minute * 60 + second` on that clock.
 * - Part k covers [start_k, end_k); an event exactly at end_k belongs to the
 *   next part, except in the last part, which includes its end.
 * - At the start of each part the on-field players are the recorded snapshot
 *   for that part (half-time changes are not events); without a snapshot the
 *   players on the field at the end of the previous part continue.
 */

export interface SubEvent {
  event_type: string; // 'substitution_in' | 'substitution_out' (others ignored)
  player_id: string | null;
  minute: number;
  second?: number | null;
  is_opponent?: boolean | null;
}

export interface PlayingTimeInput {
  /** Real seconds played in each part so far (the part in progress = elapsed now). */
  partSeconds: number[];
  /** On-field snapshot at the start of each part, keyed by 1-based part number. */
  partStarters: Record<string, string[] | undefined> | Map<number, string[]>;
  /** Fallback for part 1 when there is no snapshot. */
  firstPartStarters?: string[];
  events: SubEvent[];
  /** Minutes typed after the match (quick entry), per player and part: they win over any calculation. */
  manualMinutes?: Record<string, number[]> | null;
}

export interface PlayerSeconds {
  playerId: string;
  totalSeconds: number;
  /** Seconds per part, index 0 = part 1 */
  secondsByPart: number[];
  /** Stints on the clock (seconds), for timelines */
  stints: { from: number; to: number; part: number }[];
  /** True if currently on the field at the end of the timeline */
  onField: boolean;
}

export const eventClockSeconds = (e: Pick<SubEvent, 'minute' | 'second'>) => e.minute * 60 + (e.second ?? 0);

function snapshotFor(input: PlayingTimeInput, part: number): string[] | undefined {
  const s = input.partStarters;
  const v = s instanceof Map ? s.get(part) : (s[String(part)] as string[] | undefined);
  if (v && v.length > 0) return v;
  if (part === 1) return input.firstPartStarters;
  return undefined;
}

export function computePlayingSeconds(input: PlayingTimeInput): Map<string, PlayerSeconds> {
  const parts = input.partSeconds.map((s) => Math.max(0, Math.round(s || 0)));
  const result = new Map<string, PlayerSeconds>();
  const get = (id: string) => {
    let p = result.get(id);
    if (!p) {
      p = { playerId: id, totalSeconds: 0, secondsByPart: parts.map(() => 0), stints: [], onField: false };
      result.set(id, p);
    }
    return p;
  };

  const subs = input.events
    .filter((e) => !e.is_opponent && e.player_id && (e.event_type === 'substitution_in' || e.event_type === 'substitution_out'))
    .map((e) => ({ id: e.player_id as string, type: e.event_type, t: eventClockSeconds(e) }))
    // same second: OUT before IN so a swap never counts 8 players on a 7-a-side pitch
    .sort((a, b) => a.t - b.t || (a.type === 'substitution_out' ? -1 : 1));

  const open = new Map<string, number>(); // playerId -> stint start (clock seconds)
  const close = (id: string, at: number, part: number) => {
    const from = open.get(id);
    if (from === undefined) return;
    open.delete(id);
    const dur = Math.max(0, at - from);
    const p = get(id);
    p.totalSeconds += dur;
    p.secondsByPart[part - 1] += dur;
    if (dur > 0) p.stints.push({ from, to: at, part });
  };

  let cursor = 0;
  let evIdx = 0;
  for (let k = 1; k <= parts.length; k++) {
    const start = cursor;
    const end = start + parts[k - 1];
    const last = k === parts.length;

    // who is on the field when the part starts
    const snap = snapshotFor(input, k);
    const onAtStart = snap ? new Set(snap) : new Set(open.keys());
    open.clear();
    onAtStart.forEach((id) => { open.set(id, start); get(id); });

    while (evIdx < subs.length && subs[evIdx].t < start) evIdx++; // stray events before this part
    while (evIdx < subs.length && (last ? subs[evIdx].t <= end : subs[evIdx].t < end)) {
      const ev = subs[evIdx++];
      if (ev.type === 'substitution_out') {
        close(ev.id, ev.t, k);
      } else if (!open.has(ev.id)) {
        open.set(ev.id, ev.t);
        get(ev.id);
      }
    }

    const stillOn = [...open.keys()];
    stillOn.forEach((id) => close(id, end, k));
    if (!last) stillOn.forEach((id) => open.set(id, end)); // carried over if no snapshot next part
    else stillOn.forEach((id) => { get(id).onField = true; });
    cursor = end;
  }
  return result;
}

/**
 * Split a total into per-part minutes that always add up to the rounded total
 * (largest-remainder rounding), e.g. 7:30 + 7:30 → 8 + 7 = 15, never 8 + 8.
 */
export function roundPartsToTotal(secondsByPart: number[]): { total: number; byPart: number[] } {
  const total = secondsToMinutes(secondsByPart.reduce((s, x) => s + x, 0));
  const exact = secondsByPart.map((s) => s / 60);
  const byPart = exact.map(Math.floor);
  let rest = total - byPart.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) byPart[order[k].i]++;
  for (let k = order.length - 1; rest < 0 && k >= 0; k--) {
    if (byPart[order[k].i] > 0) { byPart[order[k].i]--; rest++; }
  }
  return { total, byPart };
}

interface MinuteStats {
  playerId: string;
  totalMinutes: number;
  firstHalfMinutes?: number;
  secondHalfMinutes?: number;
  realMinutesByPart?: Record<string, number>;
}

/**
 * Override the REAL minutes of engine stats with the seconds-precise values, so
 * reports show exactly what the live screen showed and what was saved.
 * Regulation-minute fields are left untouched.
 */
export function applyPreciseMinutes<T extends MinuteStats>(
  stats: T[],
  input: PlayingTimeInput,
): T[] {
  if (input.manualMinutes && Object.keys(input.manualMinutes).length > 0) return applyManualMinutes(stats, input.manualMinutes);
  if (!input.partSeconds.some((s) => s > 0)) return stats; // no real timing recorded (manual entry)
  const precise = computePlayingSeconds(input);
  return stats.map((s) => {
    const p = precise.get(s.playerId);
    const { total, byPart } = roundPartsToTotal(p?.secondsByPart ?? input.partSeconds.map(() => 0));
    const realMinutesByPart: Record<string, number> = {};
    byPart.forEach((m, i) => { realMinutesByPart[String(i + 1)] = m; });
    return {
      ...s,
      totalMinutes: total,
      firstHalfMinutes: byPart[0] ?? 0,
      secondHalfMinutes: byPart.slice(1).reduce((a, b) => a + b, 0),
      realMinutesByPart,
    };
  });
}

/** Minutes shown to people: rounded once, at the end. */
export const secondsToMinutes = (s: number) => Math.round(s / 60);

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Cumulative match clock (seconds) given finished parts and the current part's elapsed. */
export function matchClockSeconds(partElapsedSeconds: number[], currentPart: number, currentElapsed: number): number {
  let t = 0;
  for (let i = 0; i < currentPart - 1; i++) t += Math.max(0, Math.round(partElapsedSeconds[i] || 0));
  return t + Math.max(0, Math.floor(currentElapsed));
}

/** Quick post-match entry: the coach typed the minutes of each part for each player. */
export function applyManualMinutes<T extends MinuteStats>(stats: T[], manual: Record<string, number[]>): T[] {
  return stats.map((s) => {
    const parts = (manual[s.playerId] ?? []).map((m) => Math.max(0, Math.round(Number(m) || 0)));
    const realMinutesByPart: Record<string, number> = {};
    parts.forEach((m, i) => { realMinutesByPart[String(i + 1)] = m; });
    return {
      ...s,
      totalMinutes: parts.reduce((a, b) => a + b, 0),
      firstHalfMinutes: parts[0] ?? 0,
      secondHalfMinutes: parts.slice(1).reduce((a, b) => a + b, 0),
      realMinutesByPart,
    };
  });
}
