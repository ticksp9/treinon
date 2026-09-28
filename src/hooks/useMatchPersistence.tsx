import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cacheData, getCachedData, addPendingOperation } from '@/lib/offlineStorage';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from 'sonner';

export interface MatchState {
  matchId: string;
  phase: 'setup' | 'playing' | 'interval' | 'finished';
  currentPart: number;
  partsCount: number;
  partDurationMinutes: number;
  matchType: 'championship' | 'friendly' | 'tournament';
  tournamentLocked: boolean;
  partElapsedSeconds: number[];
  lastTimerStart: number | null;
  isRunning: boolean;
  events: MatchEvent[];
  lineups: LineupState[];
  goalsFor: number;
  goalsAgainst: number;
  lastSavedAt: number;
  // New fields for complete restoration
  starterIds: string[];
  benchIds: string[];
}

export interface MatchEvent {
  id: string;
  event_type: string;
  minute: number;
  second: number | null;
  player_id: string | null;
  assist_player_id: string | null;
  is_opponent: boolean;
  notes: string | null;
  synced: boolean;
}

export interface LineupState {
  id: string;
  player_id: string;
  is_starter: boolean;
  minutes_played: number | null;
}

const MATCH_STATE_KEY = (matchId: string) => `match_state_${matchId}`;
const AUTO_SAVE_INTERVAL = 5000; // Save every 5 seconds

export function useMatchPersistence(matchId: string) {
  const { isOnline } = useOnlineStatus();
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<MatchState | null>(null);

  // Save state to IndexedDB
  const saveStateLocally = useCallback(async (state: MatchState) => {
    try {
      const stateToSave = { ...state, lastSavedAt: Date.now() };
      await cacheData(MATCH_STATE_KEY(matchId), stateToSave);
      stateRef.current = stateToSave;
    } catch (error) {
      console.error('Error saving match state locally:', error);
    }
  }, [matchId]);

  // Save state to Supabase
  const saveStateToServer = useCallback(async (state: MatchState) => {
    if (!isOnline) {
      // Queue for later sync
      await addPendingOperation('matches', 'update', {
        id: matchId,
        current_part: state.currentPart,
        match_phase: state.phase,
        part_elapsed_seconds: state.partElapsedSeconds,
        last_timer_start: state.lastTimerStart ? new Date(state.lastTimerStart).toISOString() : null,
        last_paused_seconds: state.isRunning ? 0 : state.partElapsedSeconds[state.currentPart - 1] || 0,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          current_part: state.currentPart,
          match_phase: state.phase,
          part_elapsed_seconds: state.partElapsedSeconds,
          last_timer_start: state.lastTimerStart ? new Date(state.lastTimerStart).toISOString() : null,
          last_paused_seconds: state.isRunning ? 0 : state.partElapsedSeconds[state.currentPart - 1] || 0,
        })
        .eq('id', matchId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving match state to server:', error);
    }
  }, [matchId, isOnline]);

  // Load state from IndexedDB
  const loadLocalState = useCallback(async (): Promise<MatchState | null> => {
    try {
      const state = await getCachedData<MatchState>(MATCH_STATE_KEY(matchId));
      if (state) {
        stateRef.current = state;
      }
      return state;
    } catch (error) {
      console.error('Error loading local match state:', error);
      return null;
    }
  }, [matchId]);

  // Load state from server
  const loadServerState = useCallback(async (): Promise<Partial<MatchState> | null> => {
    if (!isOnline) return null;

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('current_part, match_phase, part_elapsed_seconds, last_timer_start, last_paused_seconds, match_type, parts_count, part_duration_minutes, tournament_locked')
        .eq('id', matchId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        currentPart: data.current_part || 0,
        phase: (data.match_phase as MatchState['phase']) || 'setup',
        partElapsedSeconds: (data.part_elapsed_seconds as number[]) || [],
        lastTimerStart: data.last_timer_start ? new Date(data.last_timer_start).getTime() : null,
        isRunning: !!data.last_timer_start,
        matchType: (data.match_type as MatchState['matchType']) || 'championship',
        partsCount: data.parts_count || 2,
        partDurationMinutes: data.part_duration_minutes || 0,
        tournamentLocked: data.tournament_locked || false,
      };
    } catch (error) {
      console.error('Error loading server match state:', error);
      return null;
    }
  }, [matchId, isOnline]);

  // Save event with offline support
  const saveEvent = useCallback(async (event: Omit<MatchEvent, 'id' | 'synced'>, ownerId: string) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventWithId: MatchEvent = { ...event, id: tempId, synced: false };

    // Save locally first
    if (stateRef.current) {
      stateRef.current.events.push(eventWithId);
      await saveStateLocally(stateRef.current);
    }

    if (!isOnline) {
      await addPendingOperation('match_events', 'insert', {
        ...event,
        match_id: matchId,
        owner_id: ownerId,
      });
      return eventWithId;
    }

    try {
      const { data, error } = await supabase
        .from('match_events')
        .insert([{
          match_id: matchId,
          event_type: event.event_type as 'goal' | 'own_goal' | 'yellow_card' | 'red_card' | 'substitution_in' | 'substitution_out',
          minute: event.minute,
          second: event.second,
          player_id: event.player_id,
          assist_player_id: event.assist_player_id,
          is_opponent: event.is_opponent,
          notes: event.notes,
          owner_id: ownerId,
        }])
        .select('id')
        .single();

      if (error) throw error;
      
      // Update event with real ID
      if (stateRef.current) {
        const eventIndex = stateRef.current.events.findIndex(e => e.id === tempId);
        if (eventIndex >= 0) {
          stateRef.current.events[eventIndex] = { ...eventWithId, id: data.id, synced: true };
          await saveStateLocally(stateRef.current);
        }
      }

      return { ...eventWithId, id: data.id, synced: true };
    } catch (error) {
      console.error('Error saving event to server:', error);
      return eventWithId;
    }
  }, [matchId, isOnline, saveStateLocally]);

  // Start auto-save interval
  const startAutoSave = useCallback((getState: () => MatchState) => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
    }

    saveIntervalRef.current = setInterval(async () => {
      const state = getState();
      await saveStateLocally(state);
      await saveStateToServer(state);
    }, AUTO_SAVE_INTERVAL);
  }, [saveStateLocally, saveStateToServer]);

  // Stop auto-save
  const stopAutoSave = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoSave();
    };
  }, [stopAutoSave]);

  // Sync unsaved events when coming back online
  useEffect(() => {
    if (isOnline && stateRef.current) {
      const unsyncedEvents = stateRef.current.events.filter(e => !e.synced);
      if (unsyncedEvents.length > 0) {
        toast.info(`A sincronizar ${unsyncedEvents.length} evento(s)...`);
      }
    }
  }, [isOnline]);

  return {
    saveStateLocally,
    saveStateToServer,
    loadLocalState,
    loadServerState,
    saveEvent,
    startAutoSave,
    stopAutoSave,
    isOnline,
  };
}
