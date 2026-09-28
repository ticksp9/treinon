/**
 * useMatchPlayingTime
 * ===================
 * Single source of truth for per-player presence intervals + per-half minutes
 * for any match screen (LiveMatch, PostGameStepper, ReportReviewScreen,
 * MatchReport). Wraps `computeMatchPlayerStatsWithHalves` with sensible
 * defaults derived from match data.
 */
import { useMemo } from 'react';
import {
  computeMatchPlayerStatsWithHalves,
  computeMatchPlayingTimeFull,
  getPartTimesFromElapsed,
  wasOriginalStarter,
  type MatchEventForCalc,
  type PlayerMatchStatsWithHalves,
  type StarterInfo,
} from '@/lib/match-playing-time';
import type { EngineInconsistency } from '@/lib/match-playing-time-engine';

export interface UseMatchPlayingTimeInput {
  lineups: Array<{ player_id: string; is_starter: boolean }>;
  events: MatchEventForCalc[];
  /** Per-part real elapsed seconds (preferred — comes from the live timer). */
  partElapsedSeconds?: number[];
  /** Per-part regulation duration in minutes (from match rules / part_duration_minutes). */
  partDurationMinutes: number;
  partRegulationMinutes?: number[] | null;
  partRegulationMinutesByIndex?: number[] | null;
  numberOfParts?: number;
  sportType?: string | null;
  /** Authoritative 2H starters (uuid[]). null/undefined → continuity from end-of-1H. */
  secondHalfStarters?: string[] | null;
  /** Authoritative starters by 1-based part index. Primary source when present. */
  partStartersByIndex?: Record<number, string[] | null> | Record<string, string[] | null> | null;
  substitutionMode?: 'NO_REENTRY' | 'FREE_REENTRY' | null;
}

export interface UseMatchPlayingTimeResult {
  stats: PlayerMatchStatsWithHalves[];
  byPlayerId: Map<string, PlayerMatchStatsWithHalves>;
  inconsistencies: EngineInconsistency[];
  realPartMinutes: number[];
  regulationPartMinutes: number[];
  matchEndMinute: number;
  totalRegulationMinutes: number;
}

export function useMatchPlayingTime(input: UseMatchPlayingTimeInput): UseMatchPlayingTimeResult {
  return useMemo(() => {
    const numParts = input.numberOfParts ?? 2;
    const elapsed = input.partElapsedSeconds ?? [];

    const realPartMinutes =
      elapsed.length > 0
        ? getPartTimesFromElapsed(elapsed).partMinutes
        : Array(numParts).fill(input.partDurationMinutes);

    const regulationPartMinutes =
      input.partRegulationMinutes && input.partRegulationMinutes.length === numParts
        ? input.partRegulationMinutes
        : input.partRegulationMinutesByIndex && input.partRegulationMinutesByIndex.length === numParts
          ? input.partRegulationMinutesByIndex
        : Array(numParts).fill(input.partDurationMinutes);
    const matchEndMinute = realPartMinutes.reduce((s, m) => s + m, 0);
    const totalRegulationMinutes = regulationPartMinutes.reduce((s, m) => s + m, 0);

    const normalisedPartStarters = input.partStartersByIndex
      ? Object.fromEntries(
          Object.entries(input.partStartersByIndex)
            .filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
            .map(([idx, ids]) => [idx, ids as string[]]),
        )
      : null;

    // The recorded first-part snapshot is authoritative; is_starter in the DB is
    // toggled by substitutions/half-time changes, so it is only a fallback.
    const firstPart = normalisedPartStarters?.['1'] ? new Set(normalisedPartStarters['1']) : null;
    const starterInfos: StarterInfo[] = input.lineups.map(l => ({
      player_id: l.player_id,
      is_starter: firstPart ? firstPart.has(l.player_id) : wasOriginalStarter(l.player_id, input.events, l.is_starter),
    }));

    const stats = computeMatchPlayerStatsWithHalves(
      starterInfos,
      input.events,
      matchEndMinute,
      realPartMinutes,
      input.sportType,
      {
        secondHalfStarters: input.secondHalfStarters ?? null,
        partStarters: normalisedPartStarters,
        regulationPartMinutes,
        substitutionMode: input.substitutionMode ?? null,
        numberOfParts: numParts,
      },
    );

    const { inconsistencies } = computeMatchPlayingTimeFull(
      starterInfos,
      input.events,
      matchEndMinute,
      input.sportType,
      {
        secondHalfStarters: input.secondHalfStarters ?? null,
        partStarters: normalisedPartStarters,
        realPartMinutes,
        regulationPartMinutes,
        substitutionMode: input.substitutionMode ?? null,
        numberOfParts: numParts,
      },
    );

    const byPlayerId = new Map(stats.map(s => [s.playerId, s]));

    return {
      stats,
      byPlayerId,
      inconsistencies,
      realPartMinutes,
      regulationPartMinutes,
      matchEndMinute,
      totalRegulationMinutes,
    };
  }, [
    input.lineups,
    input.events,
    input.partElapsedSeconds,
    input.partDurationMinutes,
    input.partRegulationMinutes,
    input.partRegulationMinutesByIndex,
    input.numberOfParts,
    input.sportType,
    input.secondHalfStarters,
    input.partStartersByIndex,
    input.substitutionMode,
  ]);
}
