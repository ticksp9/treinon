import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cacheData, getCachedData } from '@/lib/offlineStorage';
import type { PlayerPresenceMap } from './usePlayerPresenceIntervals';

const LIVE_STATE_KEY = (matchId: string) => `live_match_state_${matchId}`;

export interface LiveMatchMinimalState {
  matchId: string;
  phase: 'setup' | 'playing' | 'interval' | 'finished';
  currentPart: number;
  partsCount: number;
  partDurationMinutes: number;
  matchType: 'championship' | 'friendly' | 'tournament';
  partStartedAtMs: number | null; // When current part timer started
  partElapsedBeforePause: number; // Seconds elapsed before last pause (for pause/resume)
  isTimerRunning: boolean;
  starterIds: string[];
  benchIds: string[];
  onFieldIds: string[]; // Current players on field (may differ from starterIds after substitutions)
  partElapsedSeconds: number[]; // Elapsed seconds per part
  lastSavedAt: number;
  // NEW: Player presence intervals for accurate playing time tracking
  playerPresenceIntervals?: PlayerPresenceMap;
}

/**
 * Hook to manage minimal live match state for offline-first persistence.
 * This state is the source of truth for restoring a match.
 */
export function useLiveMatchState(matchId: string) {
  
  // Save state to IndexedDB immediately
  const saveLocal = useCallback(async (state: LiveMatchMinimalState) => {
    try {
      await cacheData(LIVE_STATE_KEY(matchId), { ...state, lastSavedAt: Date.now() });
      console.log('[useLiveMatchState] Saved local state:', { 
        phase: state.phase, 
        currentPart: state.currentPart,
        isTimerRunning: state.isTimerRunning,
        partStartedAtMs: state.partStartedAtMs,
        hasIntervals: !!state.playerPresenceIntervals,
      });
    } catch (error) {
      console.error('[useLiveMatchState] Failed to save local state:', error);
    }
  }, [matchId]);

  // Load state from IndexedDB
  const loadLocal = useCallback(async (): Promise<LiveMatchMinimalState | null> => {
    try {
      const state = await getCachedData<LiveMatchMinimalState>(LIVE_STATE_KEY(matchId));
      if (state && state.matchId === matchId) {
        console.log('[useLiveMatchState] Loaded local state:', { 
          phase: state.phase, 
          currentPart: state.currentPart,
          isTimerRunning: state.isTimerRunning,
          partStartedAtMs: state.partStartedAtMs,
          hasIntervals: !!state.playerPresenceIntervals,
        });
        return state;
      }
      return null;
    } catch (error) {
      console.error('[useLiveMatchState] Failed to load local state:', error);
      return null;
    }
  }, [matchId]);

  // Sync minimal state to backend (for cross-device recovery)
  const syncToBackend = useCallback(async (state: LiveMatchMinimalState) => {
    try {
      // NOTE: starter_ids is the ORIGINAL starting XI and is written once when the
      // match starts. It must not be overwritten with the current on-field players,
      // otherwise playing time is recalculated with the wrong starters.
      const { error } = await supabase
        .from('matches')
        .update({
          match_phase: state.phase,
          current_part: state.currentPart,
          part_elapsed_seconds: state.partElapsedSeconds,
          part_started_at_ms: state.partStartedAtMs,
          bench_ids: state.benchIds,
          on_field_ids: state.onFieldIds,
          last_timer_start: state.partStartedAtMs && state.isTimerRunning 
            ? new Date(state.partStartedAtMs).toISOString() 
            : null,
        })
        .eq('id', matchId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[useLiveMatchState] Failed to sync to backend:', error);
      return false;
    }
  }, [matchId]);

  // Load state from backend (fallback when local is unavailable)
  const loadFromBackend = useCallback(async (): Promise<Partial<LiveMatchMinimalState> | null> => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          match_phase, current_part, part_elapsed_seconds, 
          part_started_at_ms, starter_ids, bench_ids, on_field_ids,
          last_timer_start, match_type, parts_count, part_duration_minutes
        `)
        .eq('id', matchId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        matchId,
        phase: (data.match_phase as LiveMatchMinimalState['phase']) || 'setup',
        currentPart: data.current_part || 0,
        partsCount: data.parts_count || 2,
        partDurationMinutes: data.part_duration_minutes || 45,
        matchType: (data.match_type as LiveMatchMinimalState['matchType']) || 'championship',
        partStartedAtMs: data.part_started_at_ms || null,
        partElapsedBeforePause: 0,
        isTimerRunning: !!data.last_timer_start,
        starterIds: (data.starter_ids as string[]) || [],
        benchIds: (data.bench_ids as string[]) || [],
        onFieldIds: (data.on_field_ids as string[]) || [],
        partElapsedSeconds: (data.part_elapsed_seconds as number[]) || [],
        lastSavedAt: Date.now(),
        // Note: intervals are only stored locally for now
        playerPresenceIntervals: undefined,
      };
    } catch (error) {
      console.error('[useLiveMatchState] Failed to load from backend:', error);
      return null;
    }
  }, [matchId]);

  // Clear local state (when match ends)
  const clearLocal = useCallback(async () => {
    try {
      await cacheData(LIVE_STATE_KEY(matchId), null);
    } catch (error) {
      console.error('[useLiveMatchState] Failed to clear local state:', error);
    }
  }, [matchId]);

  return {
    saveLocal,
    loadLocal,
    syncToBackend,
    loadFromBackend,
    clearLocal,
  };
}
