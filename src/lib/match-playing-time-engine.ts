/**
 * Match Playing Time Engine
 * =========================
 *
 * Single source of truth for per-player presence intervals and minutes.
 *
 * Replaces the old "events-only" calculation with an authoritative state
 * built from:
 *   - 1st-half starting lineup snapshot
 *   - 2nd-half starting lineup snapshot (optional but authoritative when given)
 *   - chronological substitution events
 *
 * Supports two substitution modes:
 *   - NO_REENTRY:   once a player leaves, they cannot return (e.g. football 11).
 *                   Halftime is the only legal "reset" and only when the 2H
 *                   snapshot explicitly puts the player back on the field.
 *   - FREE_REENTRY: players may have multiple intervals (e.g. F5/F7/F9/futsal).
 *
 * Produces both REAL minutes (using the actual elapsed duration of each part)
 * and REGULATION minutes (using the rule-book duration of each part).
 *
 * Pure functions only — no side effects, no Supabase. Suitable for offline use,
 * unit tests and shared logic across LiveMatch / PostGame / Reports.
 */

import type { SubstitutionMode } from './match-substitution-rules';

export type MatchPart = '1H' | '2H' | 'ET1' | 'ET2' | `P${number}`;

export const MATCH_PARTS: MatchPart[] = ['1H', '2H', 'ET1', 'ET2'];

export function getMatchPartLabel(partIndex: number): MatchPart {
  if (partIndex === 1) return '1H';
  if (partIndex === 2) return '2H';
  if (partIndex === 3) return 'P3';
  if (partIndex === 4) return 'P4';
  return `P${partIndex}` as MatchPart;
}

function getPartIndexFromLabel(part: MatchPart): number {
  if (part === '1H') return 1;
  if (part === '2H') return 2;
  if (part === 'ET1') return 3;
  if (part === 'ET2') return 4;
  const parsed = Number(String(part).replace(/^P/, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export interface PlayerInterval {
  playerId: string;
  period: MatchPart;
  partIndex?: number;
  startMinute: number;
  /** null while the interval is open */
  endMinute: number | null;
  source: 'starting_lineup' | 'substitution' | 'halftime_snapshot';
}

export interface SubstitutionEvent {
  type: 'IN' | 'OUT';
  playerId: string;
  minute: number;
  /** Optional intra-minute ordering. Lower values come first within the same minute. */
  second?: number | null;
  period?: MatchPart;
}

export interface PartTiming {
  /** 1-based part index. */
  index?: number;
  /** Stable display/legacy label for this part. */
  label?: MatchPart;
  /** Minute of the global timeline at which this part starts. */
  startMinute: number;
  /** Real elapsed minutes of this part (may differ from regulationMinutes). */
  realMinutes: number;
  /** Regulation minutes of this part (rule-book duration). */
  regulationMinutes: number;
}

export interface MatchTimeMode {
  substitutionMode: SubstitutionMode;
  playersOnField: number;
  /** Optional explicit per-part timings. If omitted, all minutes treated as one part. */
  parts?: PartTiming[] | Partial<Record<MatchPart, PartTiming>>;
  /** Default true: when a part snapshot puts a previously-out player back on, accept it. */
  allowHalftimeReset?: boolean;
}

export interface EngineInconsistency {
  type:
    | 'reentry_blocked'
    | 'overlap'
    | 'enter_already_on_field'
    | 'leave_not_on_field'
    | 'too_many_on_field'
    | 'snapshot_conflict';
  playerId?: string;
  minute?: number;
  message: string;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: EngineInconsistency;
}

export interface EngineState {
  mode: MatchTimeMode;
  /** Players currently on field (open interval). */
  onFieldNow: Set<string>;
  /** All intervals (open + closed) per player. */
  intervalsByPlayer: Map<string, PlayerInterval[]>;
  /** Players that have ever been definitively substituted out (NO_REENTRY guard). */
  definitivelyOut: Set<string>;
  inconsistencies: EngineInconsistency[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeState(mode: MatchTimeMode): EngineState {
  return {
    mode,
    onFieldNow: new Set(),
    intervalsByPlayer: new Map(),
    definitivelyOut: new Set(),
    inconsistencies: [],
  };
}

function getOpenInterval(state: EngineState, playerId: string): PlayerInterval | null {
  const list = state.intervalsByPlayer.get(playerId);
  if (!list || list.length === 0) return null;
  const last = list[list.length - 1];
  return last.endMinute === null ? last : null;
}

function pushInterval(state: EngineState, iv: PlayerInterval): void {
  if (!state.intervalsByPlayer.has(iv.playerId)) {
    state.intervalsByPlayer.set(iv.playerId, []);
  }
  state.intervalsByPlayer.get(iv.playerId)!.push(iv);
}

function closeOpenInterval(state: EngineState, playerId: string, minute: number): boolean {
  const open = getOpenInterval(state, playerId);
  if (!open) return false;
  open.endMinute = Math.max(open.startMinute, minute);
  state.onFieldNow.delete(playerId);
  return true;
}

function getPartTiming(parts: MatchTimeMode['parts'], part: MatchPart | number): PartTiming | undefined {
  if (!parts) return undefined;
  const index = typeof part === 'number' ? part : getPartIndexFromLabel(part);
  if (Array.isArray(parts)) {
    return parts.find(p => (p.index ?? parts.indexOf(p) + 1) === index) ?? parts[index - 1];
  }
  const label = typeof part === 'number' ? getMatchPartLabel(part) : part;
  return parts[label] ?? parts[getMatchPartLabel(index)];
}

function getPartTimingsList(parts: MatchTimeMode['parts']): PartTiming[] {
  if (!parts) return [];
  if (Array.isArray(parts)) return parts;
  return Object.entries(parts)
    .map(([label, timing]) => ({ ...timing, label: timing.label ?? (label as MatchPart), index: timing.index ?? getPartIndexFromLabel(label as MatchPart) }))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function getPartEndMinute(part: PartTiming | undefined, fallback: number): number {
  return part ? part.startMinute + part.realMinutes : fallback;
}

function normalisePartStarters(input?: Record<number, string[]> | Record<string, string[]> | Map<number, string[]> | null): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (!input) return out;
  if (input instanceof Map) {
    input.forEach((value, key) => {
      if (Array.isArray(value)) out.set(Number(key), value);
    });
    return out;
  }
  Object.entries(input).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    const index = Number(key);
    if (Number.isFinite(index) && index > 0) out.set(index, value);
  });
  return out;
}

function sourceForPart(partIndex: number): PlayerInterval['source'] {
  return partIndex === 1 ? 'starting_lineup' : 'halftime_snapshot';
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Open intervals for every 1st-half starter at the given minute (typically 0).
 */
export function buildInitialStateFromFirstHalfStarters(
  starters: string[],
  partStartMinute: number,
  mode: MatchTimeMode,
): EngineState {
  const state = makeState(mode);
  for (const pid of starters) {
    if (state.onFieldNow.has(pid)) continue;
    state.onFieldNow.add(pid);
    pushInterval(state, {
      playerId: pid,
      period: '1H',
      partIndex: 1,
      startMinute: partStartMinute,
      endMinute: null,
      source: 'starting_lineup',
    });
  }
  if (starters.length > mode.playersOnField) {
    state.inconsistencies.push({
      type: 'too_many_on_field',
      message: `Escalação inicial com ${starters.length} jogadores (máx ${mode.playersOnField}).`,
    });
  }
  return state;
}

export function buildInitialStateFromPartStarters(
  starters: string[],
  partStartMinute: number,
  mode: MatchTimeMode,
  partIndex = 1,
): EngineState {
  const state = makeState(mode);
  return reconcilePartStarters(state, partIndex, starters, partStartMinute);
}

/**
 * Reconcile the field with the 2nd-half snapshot.
 *
 *  - First, close every open interval at `halftimeMinute` (1H ended).
 *  - Then, for every player in the 2H snapshot, open a fresh interval
 *    at `halftimeMinute`. The source is `starting_lineup` if they were
 *    already on the field at the end of 1H (continuation) and
 *    `halftime_snapshot` otherwise.
 *  - In NO_REENTRY mode, opening a halftime_snapshot interval for a
 *    player previously OUT is allowed when `allowHalftimeReset !== false`
 *    (the 2H snapshot is authoritative); otherwise it's flagged.
 */
export function reconcileSecondHalfStarters(
  state: EngineState,
  secondHalfStarters: string[],
  halftimeMinute: number,
): EngineState {
  return reconcilePartStarters(state, 2, secondHalfStarters, halftimeMinute);
}

export function reconcilePartStarters(
  state: EngineState,
  partIndex: number,
  partStarters: string[],
  partStartMinute: number,
): EngineState {
  for (const pid of Array.from(state.onFieldNow)) {
    closeOpenInterval(state, pid, partStartMinute);
  }
  state.onFieldNow.clear();

  const allowReset = state.mode.allowHalftimeReset !== false;
  const label = getMatchPartLabel(partIndex);
  const uniqueStarters = Array.from(new Set(partStarters));

  for (const pid of uniqueStarters) {
    if (state.onFieldNow.has(pid)) continue;
    const wasOut = state.definitivelyOut.has(pid);
    if (wasOut && state.mode.substitutionMode === 'NO_REENTRY' && !allowReset) {
      state.inconsistencies.push({
        type: 'snapshot_conflict',
        playerId: pid,
        minute: partStartMinute,
        message: `Snapshot ${partIndex}.ª parte coloca em campo um jogador já substituído definitivamente.`,
      });
      continue;
    }
    state.onFieldNow.add(pid);
    pushInterval(state, {
      playerId: pid,
      period: label,
      partIndex,
      startMinute: partStartMinute,
      endMinute: null,
      source: sourceForPart(partIndex),
    });
    if (wasOut && allowReset) state.definitivelyOut.delete(pid);
  }

  if (uniqueStarters.length > state.mode.playersOnField) {
    state.inconsistencies.push({
      type: 'too_many_on_field',
      minute: partStartMinute,
      message: `Snapshot ${partIndex}.ª parte com ${uniqueStarters.length} jogadores (máx ${state.mode.playersOnField}).`,
    });
  }
  return state;
}

/**
 * Validate (without mutating) whether a substitution event is legal in the
 * current engine state.
 */
export function validateSubstitutionEvent(
  state: EngineState,
  evt: SubstitutionEvent,
): ValidationResult {
  if (evt.type === 'OUT') {
    if (!state.onFieldNow.has(evt.playerId)) {
      return {
        allowed: false,
        reason: {
          type: 'leave_not_on_field',
          playerId: evt.playerId,
          minute: evt.minute,
          message: `Jogador não está em campo aos ${evt.minute}'.`,
        },
      };
    }
    return { allowed: true };
  }

  // type === 'IN'
  if (state.onFieldNow.has(evt.playerId)) {
    return {
      allowed: false,
      reason: {
        type: 'enter_already_on_field',
        playerId: evt.playerId,
        minute: evt.minute,
        message: `Jogador já está em campo aos ${evt.minute}'.`,
      },
    };
  }
  if (
    state.mode.substitutionMode === 'NO_REENTRY' &&
    state.definitivelyOut.has(evt.playerId)
  ) {
    return {
      allowed: false,
      reason: {
        type: 'reentry_blocked',
        playerId: evt.playerId,
        minute: evt.minute,
        message: `Reentrada não permitida (NO_REENTRY) aos ${evt.minute}'.`,
      },
    };
  }
  if (state.onFieldNow.size >= state.mode.playersOnField) {
    return {
      allowed: false,
      reason: {
        type: 'too_many_on_field',
        minute: evt.minute,
        message: `Já existem ${state.onFieldNow.size} jogadores em campo (máx ${state.mode.playersOnField}).`,
      },
    };
  }
  return { allowed: true };
}

/**
 * Apply a substitution event. Logs an inconsistency rather than throwing
 * when the event is invalid (so the caller can render the warning).
 */
export function applySubstitutionEvent(
  state: EngineState,
  evt: SubstitutionEvent,
): EngineState {
  const validation = validateSubstitutionEvent(state, evt);
  if (!validation.allowed) {
    state.inconsistencies.push(validation.reason!);
    return state;
  }

  const period: MatchPart = evt.period ?? '2H';
  const partIndex = getPartIndexFromLabel(period);

  if (evt.type === 'OUT') {
    closeOpenInterval(state, evt.playerId, evt.minute);
    if (state.mode.substitutionMode === 'NO_REENTRY') {
      state.definitivelyOut.add(evt.playerId);
    }
    return state;
  }

  // IN
  state.onFieldNow.add(evt.playerId);
  pushInterval(state, {
    playerId: evt.playerId,
    period,
    partIndex,
    startMinute: evt.minute,
    endMinute: null,
    source: 'substitution',
  });
  return state;
}

/**
 * Validate a *batch* of substitution events that all occur at the same minute.
 *
 * Spec rules:
 *  - same player cannot OUT twice in the same batch
 *  - same player cannot IN twice in the same batch
 *  - all OUTs reference players currently on the field (before the batch)
 *  - all INs reference players NOT currently on the field (before the batch)
 *  - in NO_REENTRY mode, no IN may target a definitively-out player
 *  - the post-batch on-field count must respect playersOnField
 *
 * Returns a structured result rather than throwing so the caller can render
 * warnings and decide whether to apply partially.
 */
export function validateSubstitutionBatch(
  state: EngineState,
  batch: SubstitutionEvent[],
): { allowed: boolean; reasons: EngineInconsistency[] } {
  const reasons: EngineInconsistency[] = [];
  const outs = batch.filter(e => e.type === 'OUT');
  const ins = batch.filter(e => e.type === 'IN');

  const seenOut = new Set<string>();
  for (const e of outs) {
    if (seenOut.has(e.playerId)) {
      reasons.push({
        type: 'leave_not_on_field',
        playerId: e.playerId,
        minute: e.minute,
        message: `Jogador aparece duas vezes a sair no mesmo minuto (${e.minute}').`,
      });
    }
    seenOut.add(e.playerId);
    if (!state.onFieldNow.has(e.playerId)) {
      reasons.push({
        type: 'leave_not_on_field',
        playerId: e.playerId,
        minute: e.minute,
        message: `Jogador não está em campo aos ${e.minute}'.`,
      });
    }
  }

  const seenIn = new Set<string>();
  const onFieldAfterOuts = new Set(state.onFieldNow);
  for (const o of outs) onFieldAfterOuts.delete(o.playerId);

  for (const e of ins) {
    if (seenIn.has(e.playerId)) {
      reasons.push({
        type: 'enter_already_on_field',
        playerId: e.playerId,
        minute: e.minute,
        message: `Jogador aparece duas vezes a entrar no mesmo minuto (${e.minute}').`,
      });
    }
    seenIn.add(e.playerId);
    if (onFieldAfterOuts.has(e.playerId)) {
      reasons.push({
        type: 'enter_already_on_field',
        playerId: e.playerId,
        minute: e.minute,
        message: `Jogador já estará em campo após o batch aos ${e.minute}'.`,
      });
    }
    if (
      state.mode.substitutionMode === 'NO_REENTRY' &&
      state.definitivelyOut.has(e.playerId)
    ) {
      reasons.push({
        type: 'reentry_blocked',
        playerId: e.playerId,
        minute: e.minute,
        message: `Reentrada não permitida (NO_REENTRY) aos ${e.minute}'.`,
      });
    }
  }

  const projected = onFieldAfterOuts.size + ins.length;
  if (projected > state.mode.playersOnField) {
    reasons.push({
      type: 'too_many_on_field',
      minute: batch[0]?.minute,
      message: `Batch deixaria ${projected} jogadores em campo (máx ${state.mode.playersOnField}).`,
    });
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Apply a same-minute batch atomically: all OUTs first (free seats), then all
 * INs (claim seats). On validation failure, log inconsistencies and skip.
 */
export function applySubstitutionBatch(
  state: EngineState,
  batch: SubstitutionEvent[],
  period: MatchPart = '2H',
): EngineState {
  const validation = validateSubstitutionBatch(state, batch);
  if (!validation.allowed) {
    state.inconsistencies.push(...validation.reasons);
    return state;
  }
  // OUTs first
  for (const e of batch.filter(e => e.type === 'OUT')) {
    applySubstitutionEvent(state, { ...e, period });
  }
  // Then INs
  for (const e of batch.filter(e => e.type === 'IN')) {
    applySubstitutionEvent(state, { ...e, period });
  }
  return state;
}

/**
 * Close any still-open intervals at the given minute (e.g. final whistle).
 */
export function closeAllAtMinute(state: EngineState, minute: number): EngineState {
  for (const pid of Array.from(state.onFieldNow)) {
    closeOpenInterval(state, pid, minute);
  }
  return state;
}

// ─── Minutes calculation ─────────────────────────────────────────────────────

export interface PartCalcDurations {
  durationReal: number;
  durationRegulation: number;
}

export interface PlayerIntervalBreakdown {
  start: number;
  end: number;
  period: MatchPart;
  durationReal: number;
  durationRegulation: number;
}

export interface PlayerMinutesSummary {
  playerId: string;
  intervals: PlayerIntervalBreakdown[];
  totalRealMinutes: number;
  totalRegulationMinutes: number;
  /** Per-period real minutes (sum of clamped intervals in each period). */
  realMinutesByPart: Record<string, number>;
  /** Per-period regulation minutes. */
  regulationMinutesByPart: Record<string, number>;
  /** Convenience accessors. */
  firstHalfRealMinutes: number;
  secondHalfRealMinutes: number;
  firstHalfRegulationMinutes: number;
  secondHalfRegulationMinutes: number;
  startedFirstHalf: boolean;
  startedSecondHalf: boolean;
  playedFirstHalf: boolean;
  playedSecondHalf: boolean;
  enteredFromBench: boolean;
  substitutionMode: SubstitutionMode;
}

/**
 * For an interval that lives in `period`, compute how many of its minutes
 * count towards real vs regulation totals based on the part's timings.
 */
function clampToPart(
  interval: PlayerInterval,
  parts: MatchTimeMode['parts'],
): PartCalcDurations {
  const partTiming = getPartTiming(parts, interval.partIndex ?? interval.period);
  const start = interval.startMinute;
  const end = interval.endMinute ?? start;
  const rawDuration = Math.max(0, end - start);

  if (!partTiming) {
    return { durationReal: rawDuration, durationRegulation: rawDuration };
  }

  const realCap = partTiming.startMinute + partTiming.realMinutes;
  const regCap = partTiming.startMinute + partTiming.regulationMinutes;

  const durationReal = Math.max(0, Math.min(end, realCap) - start);
  const durationRegulation = Math.max(0, Math.min(end, regCap) - start);
  return { durationReal, durationRegulation };
}

export function summarisePlayerMinutes(state: EngineState): Map<string, PlayerMinutesSummary> {
  const result = new Map<string, PlayerMinutesSummary>();
  const zeroByPart = (): Record<string, number> => {
    const base: Record<string, number> = { '1H': 0, '2H': 0, ET1: 0, ET2: 0 };
    for (const part of getPartTimingsList(state.mode.parts)) {
      const label = part.label ?? getMatchPartLabel(part.index ?? 1);
      base[label] = 0;
      base[String(part.index ?? getPartIndexFromLabel(label))] = 0;
    }
    return base;
  };

  for (const [playerId, intervals] of state.intervalsByPlayer.entries()) {
    let totalReal = 0;
    let totalReg = 0;
    let startedFirstHalf = false;
    let startedSecondHalf = false;
    let enteredFromBench = false;
    const realByPart = zeroByPart();
    const regByPart = zeroByPart();

    const breakdown: PlayerIntervalBreakdown[] = intervals
      .filter(i => i.endMinute !== null)
      .map(i => {
        const { durationReal, durationRegulation } = clampToPart(i, state.mode.parts);
        totalReal += durationReal;
        totalReg += durationRegulation;
        const partIndex = i.partIndex ?? getPartIndexFromLabel(i.period);
        realByPart[i.period] = (realByPart[i.period] ?? 0) + durationReal;
        regByPart[i.period] = (regByPart[i.period] ?? 0) + durationRegulation;
        realByPart[String(partIndex)] = (realByPart[String(partIndex)] ?? 0) + durationReal;
        regByPart[String(partIndex)] = (regByPart[String(partIndex)] ?? 0) + durationRegulation;
        if (i.source === 'starting_lineup' && partIndex === 1) startedFirstHalf = true;
        if ((i.source === 'halftime_snapshot' || i.source === 'starting_lineup') && partIndex === 2) startedSecondHalf = true;
        if (i.source === 'substitution') enteredFromBench = true;
        return {
          start: i.startMinute,
          end: i.endMinute!,
          period: i.period,
          durationReal,
          durationRegulation,
        };
      });

    result.set(playerId, {
      playerId,
      intervals: breakdown,
      totalRealMinutes: totalReal,
      totalRegulationMinutes: totalReg,
      realMinutesByPart: realByPart,
      regulationMinutesByPart: regByPart,
      firstHalfRealMinutes: realByPart['1H'],
      secondHalfRealMinutes: realByPart['2H'],
      firstHalfRegulationMinutes: regByPart['1H'],
      secondHalfRegulationMinutes: regByPart['2H'],
      playedFirstHalf: realByPart['1H'] > 0,
      playedSecondHalf: realByPart['2H'] > 0,
      startedFirstHalf,
      startedSecondHalf,
      enteredFromBench,
      substitutionMode: state.mode.substitutionMode,
    });
  }

  return result;
}

// ─── High-level driver ──────────────────────────────────────────────────────

export interface RunEngineInput {
  mode: MatchTimeMode;
  firstHalfStarters: string[];
  secondHalfStarters?: string[] | null;
  partStarters?: Record<number, string[]> | Record<string, string[]> | Map<number, string[]> | null;
  partTimings?: PartTiming[];
  numberOfParts?: number;
  /** Substitution events sorted/unsorted; engine sorts by minute then OUT before IN. */
  events: SubstitutionEvent[];
  halftimeMinute?: number;
  /** Final whistle minute (real). */
  matchEndMinute: number;
}

export interface RunEngineResult {
  state: EngineState;
  summaries: Map<string, PlayerMinutesSummary>;
}

function sortEvents(events: SubstitutionEvent[]): SubstitutionEvent[] {
  return [...events]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.minute !== b.e.minute) return a.e.minute - b.e.minute;
      const sa = a.e.second ?? 0;
      const sb = b.e.second ?? 0;
      if (sa !== sb) return sa - sb;
      if (a.e.type !== b.e.type) return a.e.type === 'OUT' ? -1 : 1;
      return a.i - b.i;
    })
    .map(x => x.e);
}

export function runMatchPlayingTime(input: RunEngineInput): RunEngineResult {
  const explicitTimings = input.partTimings && input.partTimings.length > 0 ? input.partTimings : getPartTimingsList(input.mode.parts);
  const timings = explicitTimings.length > 0 ? explicitTimings : [{ index: 1, label: '1H' as MatchPart, startMinute: 0, realMinutes: input.matchEndMinute, regulationMinutes: input.matchEndMinute }];
  const numberOfParts = input.numberOfParts ?? timings.length;
  const mode: MatchTimeMode = { ...input.mode, parts: timings };
  const snapshots = normalisePartStarters(input.partStarters);
  if (!snapshots.has(1)) snapshots.set(1, input.firstHalfStarters);
  if (input.secondHalfStarters && input.secondHalfStarters.length > 0 && !snapshots.has(2)) {
    snapshots.set(2, input.secondHalfStarters);
  }

  let state = makeState(mode);
  const events = sortEvents(input.events);
  let eventCursor = 0;
  let carryOverStarters: string[] = [];

  for (let idx = 1; idx <= numberOfParts; idx++) {
    const timing = timings[idx - 1] ?? getPartTiming(timings, idx);
    const partStart = timing?.startMinute ?? (idx === 1 ? 0 : getPartEndMinute(timings[idx - 2], input.matchEndMinute));
    const partEnd = idx === numberOfParts ? input.matchEndMinute : getPartEndMinute(timing, input.matchEndMinute);
    const partLabel = timing?.label ?? getMatchPartLabel(idx);
    const snapshot = snapshots.get(idx);

    if (idx === 1 || snapshot) {
      state = reconcilePartStarters(state, idx, snapshot ?? Array.from(state.onFieldNow), partStart);
    } else if (idx > 1) {
      state = reconcilePartStarters(state, idx, carryOverStarters, partStart);
    }

    while (eventCursor < events.length && events[eventCursor].minute < partStart) eventCursor++;
    while (
      eventCursor < events.length &&
      (idx === numberOfParts ? events[eventCursor].minute <= partEnd : events[eventCursor].minute < partEnd)
    ) {
      const e = events[eventCursor];
      state = applySubstitutionEvent(state, { ...e, period: partLabel });
      eventCursor++;
    }

    carryOverStarters = Array.from(state.onFieldNow);
    closeAllAtMinute(state, partEnd);
  }

  state = closeAllAtMinute(state, input.matchEndMinute);
  return { state, summaries: summarisePlayerMinutes(state) };
}

/**
 * Convenience helper: convert legacy `substitution_in/out` events from the
 * `match_events` table into the engine's `SubstitutionEvent` shape.
 */
export function toEngineEvents(
  raw: Array<{
    event_type: string;
    minute: number;
    second?: number | null;
    player_id: string | null;
    is_opponent?: boolean;
  }>,
): SubstitutionEvent[] {
  const out: SubstitutionEvent[] = [];
  for (const e of raw) {
    if (e.is_opponent) continue;
    if (!e.player_id) continue;
    if (e.event_type === 'substitution_in') {
      out.push({ type: 'IN', playerId: e.player_id, minute: e.minute, second: e.second ?? 0 });
    } else if (e.event_type === 'substitution_out') {
      out.push({ type: 'OUT', playerId: e.player_id, minute: e.minute, second: e.second ?? 0 });
    }
  }
  return out;
}

/**
 * Build PartTiming map from real per-part minutes (e.g. measured from the
 * timer) and the regulation per-part minutes (from match rules).
 */
export function buildPartTimings(
  realPartMinutes: number[],
  regulationPartMinutes: number[],
): PartTiming[] {
  return buildPartTimingsFromArrays(realPartMinutes, regulationPartMinutes);
}

export function buildPartTimingsFromArrays(
  realPartMinutes: number[],
  regulationPartMinutes: number[],
): PartTiming[] {
  const parts: PartTiming[] = [];
  let cursor = 0;
  const len = Math.max(realPartMinutes.length, regulationPartMinutes.length);
  for (let i = 0; i < len; i++) {
    const real = realPartMinutes[i] ?? regulationPartMinutes[i] ?? 0;
    const reg = regulationPartMinutes[i] ?? real;
    parts.push({
      index: i + 1,
      label: getMatchPartLabel(i + 1),
      startMinute: cursor,
      realMinutes: real,
      regulationMinutes: reg,
    });
    cursor += real;
  }
  return parts;
}
