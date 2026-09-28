/**
 * Match Playing Time Engine
 * 
 * Computes accurate playing minutes for each player based on substitution events.
 * Supports rotational substitutions (football 7/5/futsal) and single-stint rules (football 11).
 */

export interface PresenceInterval {
  start: number; // absolute game minute
  end: number;   // absolute game minute
}

export interface PlayerMatchStats {
  playerId: string;
  intervals: PresenceInterval[];
  totalMinutes: number;
  isStarter: boolean;
  /** Timeline annotations like "TIT", "E31'", "S40'" */
  annotations: string[];
}

export interface MatchEventForCalc {
  id?: string;
  event_type: string;
  minute: number;
  second?: number | null;
  player_id: string | null;
  is_opponent: boolean;
}

export interface StarterInfo {
  player_id: string;
  is_starter: boolean;
}

// ─── Sport format rules ───────────────────────────────────────────────────────

export interface SportFormatRules {
  code: string;
  label: string;
  playersOnField: number;
  reentryAllowed: boolean;
  rollingSubstitutions: boolean;
  maxPlayerStints: number | null; // null = unlimited
}

export const SPORT_FORMAT_RULES: Record<string, SportFormatRules> = {
  football_11: {
    code: 'football_11',
    label: 'Futebol 11',
    playersOnField: 11,
    reentryAllowed: false,
    rollingSubstitutions: false,
    maxPlayerStints: 1,
  },
  football_9: {
    code: 'football_9',
    label: 'Futebol 9',
    playersOnField: 9,
    reentryAllowed: true,
    rollingSubstitutions: true,
    maxPlayerStints: null,
  },
  football_7: {
    code: 'football_7',
    label: 'Futebol 7',
    playersOnField: 7,
    reentryAllowed: true,
    rollingSubstitutions: true,
    maxPlayerStints: null,
  },
  football_5: {
    code: 'football_5',
    label: 'Futebol 5',
    playersOnField: 5,
    reentryAllowed: true,
    rollingSubstitutions: true,
    maxPlayerStints: null,
  },
  futsal: {
    code: 'futsal',
    label: 'Futsal',
    playersOnField: 5,
    reentryAllowed: true,
    rollingSubstitutions: true,
    maxPlayerStints: null,
  },
};

export function getSportFormatRules(sportType: string | null | undefined): SportFormatRules {
  if (sportType && SPORT_FORMAT_RULES[sportType]) {
    return SPORT_FORMAT_RULES[sportType];
  }
  // Default to football_7 (most permissive youth format) to avoid blocking
  return SPORT_FORMAT_RULES.football_7;
}

// ─── Reentry validation ──────────────────────────────────────────────────────

export interface SubstitutionValidation {
  allowed: boolean;
  reason?: string;
}

/**
 * Validate whether a player can enter the field based on sport format rules.
 * For football_11: once a player has been substituted out, they cannot re-enter.
 */
export function validateReentry(
  playerId: string,
  events: MatchEventForCalc[],
  sportType: string | null | undefined
): SubstitutionValidation {
  const rules = getSportFormatRules(sportType);

  if (rules.reentryAllowed) {
    return { allowed: true };
  }

  // Check if this player was already substituted out
  const wasSubbedOut = events.some(
    e => !e.is_opponent && e.player_id === playerId && e.event_type === 'substitution_out'
  );

  if (wasSubbedOut) {
    return {
      allowed: false,
      reason: `Reentrada não permitida em ${rules.label}. Jogador já foi substituído.`,
    };
  }

  return { allowed: true };
}

/**
 * Validate field player count after a substitution.
 */
export function validateFieldCount(
  currentOnFieldCount: number,
  sportType: string | null | undefined
): SubstitutionValidation {
  const rules = getSportFormatRules(sportType);
  if (currentOnFieldCount > rules.playersOnField) {
    return {
      allowed: false,
      reason: `Máximo de ${rules.playersOnField} jogadores em campo para ${rules.label}.`,
    };
  }
  return { allowed: true };
}

/**
 * Validate starter count before a match/part starts.
 */
export function validateStarterCount(
  starterCount: number,
  sportType: string | null | undefined
): SubstitutionValidation {
  const rules = getSportFormatRules(sportType);

  if (starterCount > rules.playersOnField) {
    return {
      allowed: false,
      reason: `Escalação inválida: máximo de ${rules.playersOnField} jogadores titulares no ${rules.label}.`,
    };
  }

  return { allowed: true };
}

export interface SubstitutionAttempt {
  playerOutId: string | null | undefined;
  playerInId: string | null | undefined;
  currentOnFieldIds: string[];
  events: MatchEventForCalc[];
  sportType: string | null | undefined;
}

/**
 * Validate a substitution attempt against current field state + sport rules.
 */
export function validateSubstitutionAttempt({
  playerOutId,
  playerInId,
  currentOnFieldIds,
  events,
  sportType,
}: SubstitutionAttempt): SubstitutionValidation {
  const rules = getSportFormatRules(sportType);

  if (!playerOutId) {
    return {
      allowed: false,
      reason: 'Substituição inválida: é necessário indicar o jogador que vai sair.',
    };
  }

  if (!playerInId) {
    return {
      allowed: false,
      reason: 'Substituição inválida: é necessário indicar o jogador que vai entrar.',
    };
  }

  if (playerOutId === playerInId) {
    return {
      allowed: false,
      reason: 'Substituição inválida: o jogador que sai deve ser diferente do jogador que entra.',
    };
  }

  if (!currentOnFieldIds.includes(playerOutId)) {
    return {
      allowed: false,
      reason: 'Substituição inválida: este jogador não está em campo.',
    };
  }

  if (currentOnFieldIds.includes(playerInId)) {
    return {
      allowed: false,
      reason: 'Substituição inválida: este jogador já está em campo.',
    };
  }

  if (currentOnFieldIds.length > rules.playersOnField) {
    return {
      allowed: false,
      reason: `Substituição inválida: já existem ${currentOnFieldIds.length} jogadores em campo no ${rules.label}.`,
    };
  }

  const projectedOnFieldCount = currentOnFieldIds.filter(id => id !== playerOutId).length + 1;
  if (projectedOnFieldCount > rules.playersOnField) {
    return {
      allowed: false,
      reason: `Substituição inválida: já existem ${currentOnFieldIds.length} jogadores em campo no ${rules.label}.`,
    };
  }

  const reentryValidation = validateReentry(playerInId, events, sportType);
  if (!reentryValidation.allowed) {
    return {
      allowed: false,
      reason: `Substituição inválida: no ${rules.label} um jogador substituído não pode voltar a entrar.`,
    };
  }

  return { allowed: true };
}

function getSubstitutionEventSortWeight(eventType: string): number {
  if (eventType === 'substitution_out') return 0;
  if (eventType === 'substitution_in') return 1;
  return 2;
}

function compareSubstitutionEvents(a: MatchEventForCalc, b: MatchEventForCalc): number {
  return (
    a.minute - b.minute ||
    (a.second ?? 0) - (b.second ?? 0) ||
    getSubstitutionEventSortWeight(a.event_type) - getSubstitutionEventSortWeight(b.event_type)
  );
}

// ─── Interval computation ─────────────────────────────────────────────────────

/**
 * A reconciliation log entry, returned to callers so they can persist
 * the auto-fix to match_conflict_alerts (e.g. swapped OUT/IN ids).
 */
export interface ReconciliationLog {
  type: 'swap_out_in' | 'duplicate_out' | 'duplicate_in' | 'orphan_out' | 'orphan_in';
  minute: number;
  details: string;
  /** Original event ids/players so the alert can reference them. */
  originalOutPlayerId?: string | null;
  originalInPlayerId?: string | null;
  resolvedOutPlayerId?: string | null;
  resolvedInPlayerId?: string | null;
}

/**
 * Pre-process substitution events for formats with free re-entry (F7/F9/F5/futsal).
 *
 * Detects and auto-reconciles common live-match input mistakes where the coach
 * inverted the OUT and IN ids on the same minute. Heuristic:
 *
 *   For every minute that has at least one OUT and one IN event, simulate the
 *   field state up to that minute. If there is exactly one OUT whose player is
 *   NOT on the field and exactly one IN whose player IS already on the field,
 *   swap them — clearly a coach typo.
 *
 * Returns the (possibly rewritten) events plus a list of reconciliation logs
 * so the UI / caller can persist alerts to match_conflict_alerts.
 *
 * For formats without re-entry (football_11) the original events are returned
 * unchanged so the strict consistency checker still flags issues.
 */
/**
 * Build a function that, given a game minute, returns the authoritative on-field
 * snapshot to reset to when that minute is the first one seen in a new part
 * (half-time lineup changes are not recorded as events). Mirrors the engine:
 * part k covers [start_k, end_k).
 */
function makePartSnapshotResolver(options?: PlayingTimeOptions) {
  const realParts = options?.realPartMinutes ?? options?.partRealMinutes;
  const raw = options?.partStarters;
  const snapshots = new Map<number, string[]>();
  if (raw instanceof Map) {
    raw.forEach((v, k) => { if (v?.length) snapshots.set(Number(k), v); });
  } else if (raw) {
    Object.entries(raw).forEach(([k, v]) => { if (Array.isArray(v) && v.length) snapshots.set(Number(k), v); });
  }
  if (!snapshots.has(2) && options?.secondHalfStarters?.length) snapshots.set(2, options.secondHalfStarters);
  const ends: number[] = [];
  if (realParts && realParts.length > 0) {
    let cursor = 0;
    for (const m of realParts) { cursor += m || 0; ends.push(cursor); }
  }
  let part = 1;
  return (minute: number): string[] | null => {
    let entered: string[] | null = null;
    while (ends.length > 0 && part < ends.length && minute >= ends[part - 1]) {
      part++;
      entered = snapshots.get(part) ?? entered;
    }
    return entered;
  };
}

export function reconcileSubstitutionEvents(
  lineups: StarterInfo[],
  events: MatchEventForCalc[],
  sportType?: string | null,
  options?: PlayingTimeOptions,
): { events: MatchEventForCalc[]; logs: ReconciliationLog[] } {
  const rules = getSportFormatRules(sportType);
  const logs: ReconciliationLog[] = [];

  // Only auto-reconcile when re-entry is allowed; in F11 keep events strict.
  if (!rules.reentryAllowed) {
    return { events, logs };
  }

  // Work on a shallow-cloned array of substitution events only.
  const subs: MatchEventForCalc[] = events
    .filter(
      e =>
        !e.is_opponent &&
        e.player_id &&
        (e.event_type === 'substitution_in' || e.event_type === 'substitution_out')
    )
    .map(e => ({ ...e }))
    .sort(compareSubstitutionEvents);

  // Track who is currently on field, starting from the first-part starters.
  const onField = new Set<string>(getFirstPartStarters(lineups, options));
  const snapshotFor = makePartSnapshotResolver(options);

  // Group by minute so we can inspect OUT/IN pairs together.
  const byMinute = new Map<number, MatchEventForCalc[]>();
  for (const ev of subs) {
    const arr = byMinute.get(ev.minute) ?? [];
    arr.push(ev);
    byMinute.set(ev.minute, arr);
  }

  const minutes = Array.from(byMinute.keys()).sort((a, b) => a - b);

  for (const minute of minutes) {
    const group = byMinute.get(minute)!;
    const partSnapshot = snapshotFor(minute);
    if (partSnapshot) {
      onField.clear();
      partSnapshot.forEach(id => onField.add(id));
    }
    const outs = group.filter(e => e.event_type === 'substitution_out');
    const ins = group.filter(e => e.event_type === 'substitution_in');

    // Heuristic only applies to a clean 1×OUT + 1×IN pair. Multi-sub minutes are
    // left untouched (consistency checker will still flag real problems).
    if (outs.length === 1 && ins.length === 1) {
      const outEv = outs[0];
      const inEv = ins[0];
      const outPid = outEv.player_id!;
      const inPid = inEv.player_id!;

      const outOnField = onField.has(outPid);
      const inOnField = onField.has(inPid);

      // Mirror-swap case: OUT references someone NOT on field, IN references
      // someone already on field → coach typed OUT/IN ids reversed.
      if (!outOnField && inOnField && outPid !== inPid) {
        outEv.player_id = inPid;
        inEv.player_id = outPid;
        logs.push({
          type: 'swap_out_in',
          minute,
          details: `Substituição reconciliada: IDs OUT/IN trocados aos ${minute}'`,
          originalOutPlayerId: outPid,
          originalInPlayerId: inPid,
          resolvedOutPlayerId: inPid,
          resolvedInPlayerId: outPid,
        });
      }
    }

    // Re-process group (sorted: OUT first, then IN) to keep onField in sync.
    group.sort(
      (a, b) =>
        getSubstitutionEventSortWeight(a.event_type) -
        getSubstitutionEventSortWeight(b.event_type)
    );
    for (const ev of group) {
      const pid = ev.player_id!;
      if (ev.event_type === 'substitution_out') {
        if (onField.has(pid)) onField.delete(pid);
      } else if (ev.event_type === 'substitution_in') {
        onField.add(pid);
      }
    }
  }

  // Rebuild a full event list: keep non-substitution events untouched and
  // replace substitution events with the reconciled copies.
  const reconciledByKey = new Map<string, MatchEventForCalc>();
  for (const ev of subs) {
    // Use a stable key: minute + type + original index by serializing position.
    // Since we cloned in sorted order, push in order and consume sequentially.
    const key = `${ev.minute}|${ev.event_type}|${reconciledByKey.size}`;
    reconciledByKey.set(key, ev);
  }
  const reconciledList = Array.from(reconciledByKey.values());
  let i = 0;
  const finalEvents = events.map(ev => {
    const isSub =
      !ev.is_opponent &&
      ev.player_id &&
      (ev.event_type === 'substitution_in' || ev.event_type === 'substitution_out');
    if (!isSub) return ev;
    // Find the next reconciled sub event matching minute+type
    while (i < reconciledList.length) {
      const cand = reconciledList[i];
      if (cand.minute === ev.minute && cand.event_type === ev.event_type) {
        i++;
        return cand;
      }
      i++;
    }
    return ev;
  });

  return { events: finalEvents, logs };
}

/**
 * Build presence intervals for every player from lineup + events.
 * 
 * Algorithm:
 * 1. All starters get an open interval starting at minute 0
 * 2. Each substitution_out closes the player's open interval
 * 3. Each substitution_in opens a new interval for the entering player
 * 4. At match end, all open intervals are closed at matchEndMinute
 * 
 * This correctly handles:
 * - Players who play the entire match (1 interval: 0 → end)
 * - Players subbed out once (1 interval: 0 → subOut)
 * - Players subbed in once (1 interval: subIn → end)
 * - Rotational subs in football 7 (multiple intervals)
 *
 * NOTE: For free-reentry formats (F7/F9/F5/futsal), callers should pass events
 * already reconciled via reconcileSubstitutionEvents() to fix common OUT/IN
 * inversion mistakes. computeMatchPlayerStats does this automatically when a
 * sportType hint is provided.
 */
import * as engine from './match-playing-time-engine';
import { resolveSubstitutionMode } from './match-substitution-rules';

export interface PlayingTimeOptions {
  /** Authoritative 2nd-half starters snapshot. If omitted, continuity from end-of-1H is used. */
  secondHalfStarters?: string[] | null;
  /** Authoritative starter snapshots by 1-based part index. Primary source when provided. */
  partStarters?: Record<number, string[]> | Record<string, string[]> | Map<number, string[]> | null;
  /**
   * Per-part REAL minutes (e.g. [31, 31] when each half ran 31'). Used to clamp
   * intervals and to know halftime cutoff. If omitted, no halftime split is applied
   * (single linear timeline).
   */
  realPartMinutes?: number[];
  partRealMinutes?: number[];
  /** Per-part REGULATION minutes (e.g. [30, 30] from match rules). Defaults to realPartMinutes. */
  regulationPartMinutes?: number[];
  partRegulationMinutesByIndex?: number[];
  numberOfParts?: number;
  /** Match-level override for substitution mode. */
  substitutionMode?: 'NO_REENTRY' | 'FREE_REENTRY' | null;
}

function getFirstPartStarters(lineups: StarterInfo[], options?: PlayingTimeOptions): string[] {
  const snapshots = options?.partStarters;
  if (snapshots instanceof Map) {
    const first = snapshots.get(1);
    if (first?.length) return first;
  } else if (snapshots) {
    const first = (snapshots as Record<string, string[]>)[1] ?? (snapshots as Record<string, string[]>)['1'];
    if (Array.isArray(first) && first.length > 0) return first;
  }
  return lineups.filter(l => l.is_starter).map(l => l.player_id);
}

export function computePlayerIntervals(
  lineups: StarterInfo[],
  events: MatchEventForCalc[],
  matchEndMinute: number,
  sportType?: string | null,
  options?: PlayingTimeOptions,
): Map<string, PresenceInterval[]> {
  const rules = getSportFormatRules(sportType);
  const starters = getFirstPartStarters(lineups, options);
  const engineEvents = engine.toEngineEvents(events);
  const realParts = options?.realPartMinutes ?? options?.partRealMinutes;
  const regParts = options?.regulationPartMinutes ?? options?.partRegulationMinutesByIndex ?? realParts;
  const parts = realParts && realParts.length > 0
    ? engine.buildPartTimings(realParts, regParts ?? realParts)
    : undefined;

  const { state } = engine.runMatchPlayingTime({
    mode: {
      substitutionMode: resolveSubstitutionMode({
        sportType,
        matchOverride: options?.substitutionMode ?? undefined,
      }),
      playersOnField: rules.playersOnField,
      parts,
    },
    firstHalfStarters: starters,
    secondHalfStarters: options?.secondHalfStarters ?? null,
    partStarters: options?.partStarters ?? null,
    partTimings: parts,
    numberOfParts: options?.numberOfParts ?? parts?.length,
    events: engineEvents,
    matchEndMinute,
  });

  const result = new Map<string, PresenceInterval[]>();
  lineups.forEach(l => result.set(l.player_id, []));
  for (const [pid, ivs] of state.intervalsByPlayer.entries()) {
    result.set(
      pid,
      ivs
        .filter(i => i.endMinute !== null)
        .map(i => ({ start: i.startMinute, end: i.endMinute as number })),
    );
  }
  return result;
}

/**
 * Run the engine and return both presence intervals AND per-half summaries.
 * Use this in screens that need to display "1ª parte X' + 2ª parte Y' = Z'".
 */
export function computeMatchPlayingTimeFull(
  lineups: StarterInfo[],
  events: MatchEventForCalc[],
  matchEndMinute: number,
  sportType?: string | null,
  options?: PlayingTimeOptions,
): { summaries: Map<string, engine.PlayerMinutesSummary>; inconsistencies: engine.EngineInconsistency[] } {
  const rules = getSportFormatRules(sportType);
  const starters = getFirstPartStarters(lineups, options);
  const engineEvents = engine.toEngineEvents(events);
  const realParts = options?.realPartMinutes ?? options?.partRealMinutes;
  const regParts = options?.regulationPartMinutes ?? options?.partRegulationMinutesByIndex ?? realParts;
  const parts = realParts && realParts.length > 0
    ? engine.buildPartTimings(realParts, regParts ?? realParts)
    : undefined;

  const { state, summaries } = engine.runMatchPlayingTime({
    mode: {
      substitutionMode: resolveSubstitutionMode({
        sportType,
        matchOverride: options?.substitutionMode ?? undefined,
      }),
      playersOnField: rules.playersOnField,
      parts,
    },
    firstHalfStarters: starters,
    secondHalfStarters: options?.secondHalfStarters ?? null,
    partStarters: options?.partStarters ?? null,
    partTimings: parts,
    numberOfParts: options?.numberOfParts ?? parts?.length,
    events: engineEvents,
    matchEndMinute,
  });
  return { summaries, inconsistencies: state.inconsistencies };
}

/**
 * Compute total minutes from intervals
 */
export function sumIntervalMinutes(intervals: PresenceInterval[]): number {
  return intervals.reduce((sum, iv) => sum + Math.max(0, iv.end - iv.start), 0);
}

/**
 * Build display annotations from events for a player.
 * e.g. ["TIT", "S30'", "E56'"] or ["E15'", "S30'", "E55'"]
 */
export function buildPlayerAnnotations(
  playerId: string,
  isStarter: boolean,
  events: MatchEventForCalc[],
  partBoundaries?: number[]
): string[] {
  const annotations: string[] = [];

  // Helper to get part label for a given minute
  const getPartSuffix = (minute: number): string => {
    if (!partBoundaries || partBoundaries.length <= 1) return '';
    let cumulative = 0;
    for (let i = 0; i < partBoundaries.length; i++) {
      cumulative += partBoundaries[i];
      if (minute <= cumulative) {
        return i > 0 ? ` (${i + 1}.ªP)` : '';
      }
    }
    return ` (${partBoundaries.length}.ªP)`;
  };
  
  if (isStarter) {
    annotations.push('TIT');
  }

  const playerEvents = events
    .filter(e => 
      !e.is_opponent && 
      e.player_id === playerId && 
      (e.event_type === 'substitution_in' || e.event_type === 'substitution_out')
    )
    .sort(compareSubstitutionEvents);

  for (const ev of playerEvents) {
    const partSuffix = getPartSuffix(ev.minute);
    if (ev.event_type === 'substitution_in') {
      annotations.push(`E${ev.minute}'${partSuffix}`);
    } else if (ev.event_type === 'substitution_out') {
      annotations.push(`S${ev.minute}'${partSuffix}`);
    }
  }

  return annotations;
}

/**
 * Compute full player stats for a completed match.
 * This is the single source of truth for match reports.
 *
 * When sportType is provided AND it's a free-reentry format, common live-match
 * input mistakes (OUT/IN ids inverted on the same minute) are auto-reconciled
 * before computing intervals. The reconciliation log is returned alongside the
 * stats so callers can persist alerts to match_conflict_alerts if desired.
 */
export interface PlayerMatchStatsWithHalves extends PlayerMatchStats {
  firstHalfMinutes: number;
  secondHalfMinutes: number;
  firstHalfRegulationMinutes: number;
  secondHalfRegulationMinutes: number;
  totalRegulationMinutes: number;
  realMinutesByPart?: Record<string, number>;
  regulationMinutesByPart?: Record<string, number>;
  startedFirstHalf: boolean;
  startedSecondHalf: boolean;
  playedFirstHalf: boolean;
  playedSecondHalf: boolean;
}

export function computeMatchPlayerStats(
  lineups: StarterInfo[],
  events: MatchEventForCalc[],
  matchEndMinute: number,
  partMinutes?: number[],
  sportType?: string | null,
  options?: PlayingTimeOptions,
): PlayerMatchStats[] {
  const opts: PlayingTimeOptions = {
    ...options,
    realPartMinutes: options?.realPartMinutes ?? options?.partRealMinutes ?? partMinutes,
    regulationPartMinutes: options?.regulationPartMinutes ?? options?.partRegulationMinutesByIndex ?? partMinutes,
  };
  const { events: reconciledEvents } = reconcileSubstitutionEvents(lineups, events, sportType, opts);
  const intervals = computePlayerIntervals(lineups, reconciledEvents, matchEndMinute, sportType, opts);

  return lineups.map(lineup => {
    const playerIntervals = intervals.get(lineup.player_id) || [];
    const totalMinutes = sumIntervalMinutes(playerIntervals);
    const annotations = buildPlayerAnnotations(lineup.player_id, lineup.is_starter, reconciledEvents, partMinutes);

    return {
      playerId: lineup.player_id,
      intervals: playerIntervals,
      totalMinutes,
      isStarter: lineup.is_starter,
      annotations,
    };
  });
}

/**
 * Same as computeMatchPlayerStats but also returns the reconciliation log so
 * callers (e.g. PostGameStepper, LiveMatch) can persist swap alerts.
 */
export function computeMatchPlayerStatsWithReconciliation(
  lineups: StarterInfo[],
  events: MatchEventForCalc[],
  matchEndMinute: number,
  partMinutes?: number[],
  sportType?: string | null,
  options?: PlayingTimeOptions,
): { stats: PlayerMatchStats[]; reconciliationLogs: ReconciliationLog[] } {
  const opts: PlayingTimeOptions = {
    ...options,
    realPartMinutes: options?.realPartMinutes ?? options?.partRealMinutes ?? partMinutes,
    regulationPartMinutes: options?.regulationPartMinutes ?? options?.partRegulationMinutesByIndex ?? partMinutes,
  };
  const { events: reconciledEvents, logs } = reconcileSubstitutionEvents(lineups, events, sportType, opts);
  const intervals = computePlayerIntervals(lineups, reconciledEvents, matchEndMinute, sportType, opts);

  const stats = lineups.map(lineup => {
    const playerIntervals = intervals.get(lineup.player_id) || [];
    const totalMinutes = sumIntervalMinutes(playerIntervals);
    const annotations = buildPlayerAnnotations(lineup.player_id, lineup.is_starter, reconciledEvents, partMinutes);

    return {
      playerId: lineup.player_id,
      intervals: playerIntervals,
      totalMinutes,
      isStarter: lineup.is_starter,
      annotations,
    };
  });

  return { stats, reconciliationLogs: logs };
}

/**
 * Per-half-aware stats — the recommended call for LiveMatch / PostGame /
 * ReportReview / MatchReport screens. Returns total + per-half real and
 * regulation minutes for every lineup entry.
 */
export function computeMatchPlayerStatsWithHalves(
  lineups: StarterInfo[],
  events: MatchEventForCalc[],
  matchEndMinute: number,
  partMinutes?: number[],
  sportType?: string | null,
  options?: PlayingTimeOptions,
): PlayerMatchStatsWithHalves[] {
  const opts: PlayingTimeOptions = {
    ...options,
    realPartMinutes: options?.realPartMinutes ?? options?.partRealMinutes ?? partMinutes,
    regulationPartMinutes: options?.regulationPartMinutes ?? options?.partRegulationMinutesByIndex ?? partMinutes,
  };
  const { events: reconciledEvents } = reconcileSubstitutionEvents(lineups, events, sportType, opts);
  const { summaries } = computeMatchPlayingTimeFull(
    lineups,
    reconciledEvents,
    matchEndMinute,
    sportType,
    opts,
  );

  return lineups.map(lineup => {
    const sum = summaries.get(lineup.player_id);
    const annotations = buildPlayerAnnotations(lineup.player_id, lineup.is_starter, reconciledEvents, partMinutes);
    const intervalsForPlayer = (sum?.intervals ?? []).map(i => ({ start: i.start, end: i.end }));
    return {
      playerId: lineup.player_id,
      intervals: intervalsForPlayer,
      totalMinutes: sum?.totalRealMinutes ?? 0,
      isStarter: lineup.is_starter,
      annotations,
      firstHalfMinutes: sum?.firstHalfRealMinutes ?? 0,
      secondHalfMinutes: sum?.secondHalfRealMinutes ?? 0,
      firstHalfRegulationMinutes: sum?.firstHalfRegulationMinutes ?? 0,
      secondHalfRegulationMinutes: sum?.secondHalfRegulationMinutes ?? 0,
      totalRegulationMinutes: sum?.totalRegulationMinutes ?? 0,
      realMinutesByPart: sum?.realMinutesByPart ?? {},
      regulationMinutesByPart: sum?.regulationMinutesByPart ?? {},
      startedFirstHalf: sum?.startedFirstHalf ?? lineup.is_starter,
      startedSecondHalf: sum?.startedSecondHalf ?? false,
      playedFirstHalf: sum?.playedFirstHalf ?? false,
      playedSecondHalf: sum?.playedSecondHalf ?? false,
    };
  });
}

/**
 * Calculate the real match end minute from part elapsed seconds.
 * partElapsedSeconds is an array of elapsed seconds per part.
 */
export function calculateMatchEndMinute(partElapsedSeconds: number[]): number {
  return partElapsedSeconds.reduce((sum, seconds) => sum + Math.floor(seconds / 60), 0);
}

/**
 * Get half/part times from partElapsedSeconds for display.
 */
export function getPartTimesFromElapsed(partElapsedSeconds: number[]): { partMinutes: number[]; totalMinutes: number } {
  const partMinutes = partElapsedSeconds.map(s => Math.floor(s / 60));
  const totalMinutes = partMinutes.reduce((s, m) => s + m, 0);
  return { partMinutes, totalMinutes };
}

/**
 * Determine if a player was an original starter (started the match, not just currently on field).
 * In the current system, is_starter gets toggled on substitution, so we need events to determine
 * original starter status.
 */
export function wasOriginalStarter(
  playerId: string,
  events: MatchEventForCalc[],
  currentIsStarter?: boolean
): boolean {
  const playerSubIns = events.filter(
    e => !e.is_opponent && e.player_id === playerId && e.event_type === 'substitution_in'
  ).sort((a, b) => a.minute - b.minute);
  
  const playerSubOuts = events.filter(
    e => !e.is_opponent && e.player_id === playerId && e.event_type === 'substitution_out'
  ).sort((a, b) => a.minute - b.minute);
  
  // No substitution events at all → use current DB is_starter as fallback
  // (a bench player who never played still has is_starter=false, a starter who
  // played the whole game still has is_starter=true — neither was toggled)
  if (playerSubIns.length === 0 && playerSubOuts.length === 0) {
    return currentIsStarter ?? true;
  }
  
  if (playerSubIns.length === 0) {
    // Only sub outs, no sub ins → was original starter
    return true;
  }
  
  if (playerSubOuts.length > 0 && playerSubOuts[0].minute < playerSubIns[0].minute) {
    // First event was a sub out → was original starter
    return true;
  }
  
  return false;
}

// ─── Consistency checks ───────────────────────────────────────────────────────

export interface ConsistencyIssue {
  type: 'error' | 'warning';
  message: string;
  playerId?: string;
  minute?: number;
}

/**
 * Check match events for consistency issues.
 */
export function checkMatchConsistency(
  lineups: StarterInfo[],
  events: MatchEventForCalc[],
  matchEndMinute: number,
  sportType?: string | null,
  options?: PlayingTimeOptions,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const rules = getSportFormatRules(sportType);
  
  // Track who is on field at each point
  const onField = new Set<string>(getFirstPartStarters(lineups, options));
  const snapshotFor = makePartSnapshotResolver(options);

  if (onField.size > rules.playersOnField) {
    issues.push({
      type: 'error',
      message: `Escalação inicial com ${onField.size} jogadores em campo (máx: ${rules.playersOnField})`,
    });
  }
  
  // Track players who were ever subbed out (for reentry check in F11)
  const everSubbedOut = new Set<string>();

  // Auto-reconcile OUT/IN inversions for free-reentry formats so the consistency
  // checker reports the *real* remaining issues, not the typos we already fixed.
  const { events: reconciledEvents } = reconcileSubstitutionEvents(lineups, events, sportType, options);

  const sorted = [...reconciledEvents]
    .filter(e => !e.is_opponent && e.player_id &&
      (e.event_type === 'substitution_in' || e.event_type === 'substitution_out'))
    .sort(compareSubstitutionEvents);
  
  for (const event of sorted) {
    const pid = event.player_id!;
    const partSnapshot = snapshotFor(event.minute);
    if (partSnapshot) {
      onField.clear();
      partSnapshot.forEach(id => onField.add(id));
    }
    
    if (event.event_type === 'substitution_out') {
      if (!onField.has(pid)) {
        issues.push({
          type: 'error',
          message: `Jogador saiu sem estar em campo ao minuto ${event.minute}'`,
          playerId: pid,
          minute: event.minute,
        });
      }
      onField.delete(pid);
      everSubbedOut.add(pid);
    } else if (event.event_type === 'substitution_in') {
      if (onField.has(pid)) {
        issues.push({
          type: 'warning',
          message: `Jogador entrou mas já estava em campo ao minuto ${event.minute}'`,
          playerId: pid,
          minute: event.minute,
        });
      }
      if (!rules.reentryAllowed && everSubbedOut.has(pid)) {
        issues.push({
          type: 'error',
          message: `Reentrada não permitida em ${rules.label} ao minuto ${event.minute}'`,
          playerId: pid,
          minute: event.minute,
        });
      }
      onField.add(pid);
    }
    
    // Check field count
    if (onField.size > rules.playersOnField) {
      issues.push({
        type: 'error',
        message: `${onField.size} jogadores em campo (máx: ${rules.playersOnField}) ao minuto ${event.minute}'`,
        minute: event.minute,
      });
    }
  }
  
  // Check total minutes don't exceed match length
  const stats = computeMatchPlayerStats(lineups, events, matchEndMinute, undefined, sportType, options);
  for (const s of stats) {
    if (s.totalMinutes > matchEndMinute) {
      issues.push({
        type: 'error',
        message: `Jogador com ${s.totalMinutes} min (jogo tem ${matchEndMinute} min)`,
        playerId: s.playerId,
      });
    }
    if (s.totalMinutes < 0) {
      issues.push({
        type: 'error',
        message: `Jogador com minutos negativos: ${s.totalMinutes}`,
        playerId: s.playerId,
      });
    }
  }
  
  return issues;
}
