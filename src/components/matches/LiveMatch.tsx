import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Play, Pause, Square, ArrowLeft, 
  UserMinus, RotateCcw,
  Clock, Pencil, AlertTriangle, Share2
} from 'lucide-react';
import { shareText } from '@/lib/share';
import { computePlayingSeconds, matchClockSeconds, formatClock, secondsToMinutes } from '@/lib/playing-time-seconds';
import { reconcileTactics, applySubstitution, swapSlots, estimateFreshness, type LiveTactics } from '@/lib/live-tactics';
import { LivePitch, type PitchPlayerInfo } from './LivePitch';
import { MatchRatingsPanel } from './MatchRatingsPanel';
import { useSquadProfiles } from '@/hooks/useSquadProfiles';
import { useSportScope } from '@/hooks/useSportScope';
import { isSportAllowed } from '@/lib/sport-scope';
import { pickStartingXI, assistantReport, type Candidate, type PickMode } from '@/lib/team-selection';
import { PreMatchPanel } from './PreMatchPanel';
import { LineupSelector } from './LineupSelector';
import { MatchEvents } from './MatchEvents';
import { SubstitutionBatchDialog } from './SubstitutionBatchDialog';
import type { PendingSubstitution } from '@/lib/substitution-batch-service';
import { LiveActionBar } from './LiveActionBar';
import { MatchContextBar } from './MatchContextBar';
import { EventSheet } from './EventSheet';
import { MatchReport } from './MatchReport';
import { MatchConfigModal, type MatchFormatConfig } from './MatchConfigModal';
import { getHalfDurationForCategory } from '@/lib/constants';
import { useMatchTimer } from '@/hooks/useMatchTimer';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { useLiveMatchState, LiveMatchMinimalState } from '@/hooks/useLiveMatchState';
import { usePlayerPresenceIntervals, PlayerPresenceMap } from '@/hooks/usePlayerPresenceIntervals';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPartLabel, getEndPartLabel, getStartPartLabel, getDisplayMinute as calcDisplayMinute } from '@/lib/match-constants';
import { getSportFormatRules, validateStarterCount } from '@/lib/match-playing-time';
import { getMatchRuleSnapshot, saveMatchRuleSnapshot, buildSnapshotFromFallback, getDefaultRuleProfile, normalizeAgeGroupCode, buildSnapshotFromProfile, logConflictAlert, type MatchRuleSnapshot } from '@/lib/match-rules-service';
import { FieldPlayerCounter } from './FieldPlayerCounter';
import { MatchRulesPanel } from './MatchRulesPanel';
import { ConflictAlertsPanel } from './ConflictAlertsPanel';
import { checkMatchConsistency, type ConsistencyIssue } from '@/lib/match-playing-time';
import { cacheData, getCachedData, addPendingOperation, isNetworkError } from '@/lib/offlineStorage';

const LIVE_DATA_KEY = (matchId: string) => `live_match_data_${matchId}`;

interface CachedLiveData {
  match: Match;
  team: Team;
  lineups: Lineup[];
  events: MatchEvent[];
}
interface LiveMatchProps {
  matchId: string;
  teamId: string;
  onExit: () => void;
  isResume?: boolean;
}

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

interface Lineup {
  id: string;
  player_id: string;
  is_starter: boolean;
  minutes_played: number | null;
  position_played: string | null;
  player: Player;
}

interface MatchEvent {
  id: string;
  event_type: string;
  minute: number;
  second: number | null;
  player_id: string | null;
  assist_player_id: string | null;
  is_opponent: boolean;
  notes: string | null;
  player?: Player;
  assist_player?: Player;
}

interface Match {
  id: string;
  opponent_name: string;
  is_home: boolean;
  status: string;
  goals_for: number | null;
  goals_against: number | null;
  match_date?: string;
  competition?: string | null;
  location?: string | null;
  match_type?: string;
  parts_count?: number;
  part_duration_minutes?: number | null;
  tournament_locked?: boolean;
  current_part?: number;
  match_phase?: string;
  part_elapsed_seconds?: number[];
  part_starter_ids?: Record<string, string[]> | null;
  part_real_seconds?: number[] | null;
  part_regulation_minutes?: number[] | null;
  starter_ids?: string[] | null;
  last_timer_start?: string | null;
  /** Modality for this match only (e.g. an 11-a-side friendly); null = team's */
  sport_type?: string | null;
  /** Live pitch: formation and who plays in each slot */
  live_tactics?: LiveTactics | null;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
  sport_type?: string | null;
  /** Format the coach set for the team, e.g. { parts: [15, 15, 30] } */
  match_format?: { parts?: number[] } | null;
}

type MatchPhase = 'setup' | 'playing' | 'interval' | 'finished';

const SPORT_LABELS: Record<string, string> = {
  football_5: 'F5',
  football_7: 'F7',
  football_9: 'F9',
  football_11: 'F11',
  futsal: 'Futsal',
};

export function LiveMatch({ matchId, teamId, onExit }: LiveMatchProps) {
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const isMobile = useIsMobile();
  const [match, setMatch] = useState<Match | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  /** Modality actually used in this match: the match's own choice, else the team's */
  const matchSport = match?.sport_type || team?.sport_type || null;
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [phase, setPhase] = useState<MatchPhase>('setup');
  const [currentPart, setCurrentPart] = useState(0);
  const [partElapsedSeconds, setPartElapsedSeconds] = useState<number[]>([]);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [editLineupOpen, setEditLineupOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [eventSheetDefaults, setEventSheetDefaults] = useState<{ type?: string; playerId?: string }>({});
  const [syncStatus, setSyncStatus] = useState<'saving' | 'saved' | 'pending' | 'error'>('saved');
  const [liveView, setLiveView] = useState<'pitch' | 'list'>('pitch');
  
  // CRITICAL: Flags to control restoration and prevent unwanted resets
  const hasRestoredRef = useRef(false);
  const isGameActiveRef = useRef(false);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Match configuration
  const [partsCount, setPartsCount] = useState(2);
  const [partDurationMinutes, setPartDurationMinutes] = useState(45);
  const [matchType, setMatchType] = useState<'championship' | 'friendly' | 'tournament'>('championship');
  const [isLocked, setIsLocked] = useState(false);
  const [categoryDuration, setCategoryDuration] = useState(45);
  const [ruleSnapshot, setRuleSnapshot] = useState<MatchRuleSnapshot | null>(null);

  // New hooks for proper persistence
  const { setActiveMatchId, clearActiveMatch } = useActiveMatch();
  const liveState = useLiveMatchState(matchId);

  // Parts can have different lengths (e.g. 15 + 15 + 30): alerts use the current part
  const currentPartRegulation =
    ((match as any)?.part_regulation_minutes as number[] | null | undefined)?.[Math.max(0, currentPart - 1)] ||
    partDurationMinutes;

  // Timer hook - must be before presenceTracker
  const timer = useMatchTimer({
    partDurationMinutes: currentPartRegulation,
    onTimeAlert: (type) => {
      console.log('[LiveMatch] Time alert:', type);
    },
  });

  // Calculate total game minutes for presence tracking
  const getCurrentGameMinutes = useCallback(() => {
    if (currentPart === 0) return 0;
    let total = 0;
    for (let i = 0; i < currentPart - 1; i++) {
      total += Math.floor((partElapsedSeconds[i] || 0) / 60);
    }
    total += Math.floor(timer.elapsedSeconds / 60);
    return total;
  }, [currentPart, partElapsedSeconds, timer.elapsedSeconds]);

  // Player presence intervals hook for accurate playing time
  const presenceTracker = usePlayerPresenceIntervals({
    starterIds: lineups.filter(l => l.is_starter).map(l => l.player_id),
    onFieldIds: lineups.filter(l => l.is_starter).map(l => l.player_id),
    currentGameMinutes: getCurrentGameMinutes(),
    isPlaying: phase === 'playing' && timer.isRunning,
  });

  // =================== INITIALIZATION ===================
  
  useEffect(() => {
    console.log('[LiveMatch] Component mounted for match:', matchId);
    fetchMatchData();
    
    return () => {
      console.log('[LiveMatch] Component unmounting, saving state...');
      stopAutoSave();
      // Save state on unmount if game is active
      if (isGameActiveRef.current) {
        saveCurrentState();
      }
    };
  }, [matchId]);

  // =================== CRITICAL: Restore state when match data is loaded ===================
  
  useEffect(() => {
    if (!match || !team || loading || hasRestoredRef.current) return;

    const restore = async () => {
      console.log('[LiveMatch] Starting restoration check...', { 
        matchStatus: match.status, 
        matchId,
        hasRestored: hasRestoredRef.current 
      });

      // If match is completed, just show finished
      if (match.status === 'completed') {
        setPhase('finished');
        hasRestoredRef.current = true;
        return;
      }

      // If match is in_progress, MUST restore state and skip setup
      if (match.status === 'in_progress') {
        hasRestoredRef.current = true;
        isGameActiveRef.current = true;
        
        // Try to restore from local storage first (offline-first)
        const localState = await liveState.loadLocal();
        
        if (localState && localState.phase !== 'setup' && localState.currentPart > 0) {
          console.log('[LiveMatch] Restoring from LOCAL state:', {
            phase: localState.phase,
            currentPart: localState.currentPart,
            isTimerRunning: localState.isTimerRunning,
            partStartedAtMs: localState.partStartedAtMs,
          });
          
          applyRestoredState(localState);
        } else {
          // Fallback: try to restore from backend
          const backendState = await liveState.loadFromBackend();
          
          if (backendState && backendState.phase !== 'setup' && (backendState.currentPart || 0) > 0) {
            console.log('[LiveMatch] Restoring from BACKEND state:', {
              phase: backendState.phase,
              currentPart: backendState.currentPart,
            });
            
            applyRestoredState(backendState as LiveMatchMinimalState);
          } else {
            // Last fallback: use match record directly
            console.log('[LiveMatch] Restoring from MATCH record:', {
              phase: match.match_phase,
              currentPart: match.current_part,
            });
            
            const matchPhase = (match.match_phase as MatchPhase) || 'playing';
            const matchCurrentPart = match.current_part || 1;
            const matchPartElapsed = (match.part_elapsed_seconds as number[]) || [];
            
            setPhase(matchPhase);
            setCurrentPart(matchCurrentPart);
            setPartElapsedSeconds(matchPartElapsed);
            
            // Restore timer
            if (matchPhase === 'playing' && match.last_timer_start) {
              const startMs = new Date(match.last_timer_start).getTime();
              const elapsedSinceStart = Math.floor((Date.now() - startMs) / 1000);
              timer.restoreTimer(elapsedSinceStart, startMs);
            }
            
            startAutoSave();
          }
        }
        return;
      }

      // Match is not in_progress - show setup screen
      hasRestoredRef.current = true;
      console.log('[LiveMatch] Match not in_progress, showing setup');
    };

    restore();
  }, [match, team, loading]);

  // Apply restored state to component
  const applyRestoredState = (state: LiveMatchMinimalState | Partial<LiveMatchMinimalState>) => {
    const restoredPhase = (state.phase || 'playing') as MatchPhase;
    const restoredPart = state.currentPart || 1;
    const restoredPartElapsed = state.partElapsedSeconds || [];
    
    setPhase(restoredPhase);
    setCurrentPart(restoredPart);
    setPartElapsedSeconds(restoredPartElapsed);
    setPartsCount(state.partsCount || partsCount);
    setPartDurationMinutes(state.partDurationMinutes || partDurationMinutes);
    setMatchType((state.matchType || matchType) as 'championship' | 'friendly' | 'tournament');

    // Restore player presence intervals for accurate playing time
    if (state.playerPresenceIntervals && Object.keys(state.playerPresenceIntervals).length > 0) {
      presenceTracker.restoreIntervals(state.playerPresenceIntervals);
      console.log('[LiveMatch] Restored player presence intervals');
    }

    // Restore timer based on phase
    if (restoredPhase === 'playing') {
      const partStartedAtMs = state.partStartedAtMs;
      const isTimerRunning = state.isTimerRunning !== false;
      const partElapsedBeforePause = state.partElapsedBeforePause || 0;
      
      if (partStartedAtMs && isTimerRunning) {
        // Timer was running - calculate elapsed from timestamp
        const elapsedSinceStart = Math.floor((Date.now() - partStartedAtMs) / 1000);
        console.log('[LiveMatch] Restoring RUNNING timer:', { 
          partStartedAtMs, 
          elapsedSinceStart,
          partElapsedBeforePause 
        });
        timer.restoreTimer(elapsedSinceStart, partStartedAtMs);
      } else {
        // Timer was paused
        const savedElapsed = restoredPartElapsed[restoredPart - 1] || partElapsedBeforePause || 0;
        console.log('[LiveMatch] Restoring PAUSED timer:', { savedElapsed });
        timer.restoreTimer(savedElapsed, null);
      }
      
      startAutoSave();
    }
    
    console.log('[LiveMatch] State restoration complete:', {
      phase: restoredPhase,
      currentPart: restoredPart,
      timerRunning: timer.isRunning,
    });
  };

  // =================== SAVE STATE FUNCTIONS ===================

  const buildCurrentState = useCallback((): LiveMatchMinimalState => {
    const currentStarters = lineups.filter(l => l.is_starter);
    const currentBench = lineups.filter(l => !l.is_starter);
    
    // On-field is same as starters (after substitutions, is_starter reflects current field state)
    const onFieldIds = currentStarters.map(l => l.player_id);
    
    // Calculate current part elapsed
    const currentPartElapsed = [...partElapsedSeconds];
    const exactElapsed = timer.getExactElapsedSeconds();
    if (currentPart > 0) {
      currentPartElapsed[currentPart - 1] = exactElapsed;
    }
    
    return {
      matchId,
      phase,
      currentPart,
      partsCount,
      partDurationMinutes,
      matchType,
      partStartedAtMs: timer.isRunning ? timer.getTimerState().startTime : null,
      partElapsedBeforePause: timer.isRunning ? 0 : exactElapsed,
      isTimerRunning: timer.isRunning,
      starterIds: currentStarters.map(l => l.player_id),
      benchIds: currentBench.map(l => l.player_id),
      onFieldIds,
      partElapsedSeconds: currentPartElapsed,
      lastSavedAt: Date.now(),
      // Include player presence intervals for accurate playing time
      playerPresenceIntervals: presenceTracker.getIntervalsForPersistence(),
    };
  }, [matchId, phase, currentPart, partsCount, partDurationMinutes, matchType, timer, lineups, partElapsedSeconds, presenceTracker]);

  const saveCurrentState = useCallback(async () => {
    if (!isGameActiveRef.current || phase === 'setup' || phase === 'finished') return;
    
    const state = buildCurrentState();
    
    setSyncStatus('saving');
    // Always save locally first (offline-first)
    await liveState.saveLocal(state);
    
    // Sync to backend if online (state is also kept locally, so a failure is recoverable)
    const synced = isOnline ? await liveState.syncToBackend(state) : false;
    setSyncStatus(synced ? 'saved' : 'pending');
  }, [buildCurrentState, liveState, isOnline, phase]);

  // Always point the auto-save at the latest state. Without this the interval kept
  // saving the snapshot from when it was started (old lineup after substitutions),
  // and a reload restored the wrong players on the field.
  const saveCurrentStateRef = useRef(saveCurrentState);
  useEffect(() => {
    saveCurrentStateRef.current = saveCurrentState;
  }, [saveCurrentState]);

  // Auto-save interval
  const startAutoSave = useCallback(() => {
    if (autoSaveIntervalRef.current) return;

    autoSaveIntervalRef.current = setInterval(() => {
      saveCurrentStateRef.current();
    }, 5000);

    console.log('[LiveMatch] Auto-save started');
  }, []);

  const stopAutoSave = useCallback(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
      console.log('[LiveMatch] Auto-save stopped');
    }
  }, []);

  // Save state whenever critical game state changes (including who is on the
  // field and pause/resume — previously only the lineup *length* was watched,
  // so substitutions and pauses were not persisted immediately).
  const onFieldSignature = lineups.filter(l => l.is_starter).map(l => l.player_id).sort().join(',');
  useEffect(() => {
    if (!isGameActiveRef.current || phase === 'setup' || phase === 'finished') return;
    saveCurrentState();
  }, [phase, currentPart, onFieldSignature, timer.isRunning]);

  // Phone locked / app sent to background: save right away (iOS may kill the PWA).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') saveCurrentStateRef.current();
    };
    const onPageHide = () => saveCurrentStateRef.current();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // Keep the screen on during the match so the phone does not sleep mid-game.
  useEffect(() => {
    if (phase !== 'playing' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await (navigator as any).wakeLock.request('screen');
        if (cancelled) l.release(); else lock = l;
      } catch { /* not allowed (battery saver, etc.) */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [phase]);

  // Keep an offline copy of the match so it can be reopened without network.
  useEffect(() => {
    if (!match || !team) return;
    cacheData(LIVE_DATA_KEY(matchId), { match, team, lineups, events });
  }, [matchId, match, team, lineups, events]);

  // =================== FETCH DATA ===================

  const fetchMatchData = async () => {
    try {
      const [matchRes, teamRes, lineupsRes, eventsRes] = await Promise.all([
        supabase.from('matches').select('*').eq('id', matchId).single(),
        // '*' so an older database without match_format still works
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase.from('match_lineups')
          .select(`
            id, player_id, is_starter, minutes_played, position_played,
            player:players(id, name, number, position)
          `)
          .eq('match_id', matchId),
        supabase.from('match_events')
          .select(`
            id, event_type, minute, second, player_id, assist_player_id, is_opponent, notes,
            player:players!match_events_player_id_fkey(id, name, number, position),
            assist_player:players!match_events_assist_player_id_fkey(id, name, number, position)
          `)
          .eq('match_id', matchId)
          .order('minute', { ascending: true })
      ]);

      if (matchRes.error) throw matchRes.error;
      const matchData = matchRes.data as Match;
      setMatch(matchData);

      // Set match configuration
      const catDuration = getHalfDurationForCategory(teamRes.data?.category);
      setCategoryDuration(catDuration);
      setPartsCount(matchData.parts_count || 2);
      setPartDurationMinutes(matchData.part_duration_minutes || catDuration);
      setMatchType((matchData.match_type as any) || 'championship');
      setIsLocked(matchData.tournament_locked || matchData.match_type === 'championship' || (matchData.match_type === 'tournament' && matchData.status === 'in_progress'));

      // Load rule snapshot for this match
      const snapshot = await getMatchRuleSnapshot(matchId);
      if (snapshot) {
        setRuleSnapshot(snapshot);
        // Override duration from snapshot if available and no match-specific override
        if (!matchData.part_duration_minutes && snapshot.period_1_minutes) {
          setPartDurationMinutes(snapshot.period_1_minutes);
        }
      }

      if (teamRes.data) {
        setTeam(teamRes.data as unknown as Team);
      }

      if (lineupsRes.data) {
        const formattedLineups = lineupsRes.data.map(l => ({
          ...l,
          player: Array.isArray(l.player) ? l.player[0] : l.player
        })) as Lineup[];
        setLineups(formattedLineups);
      }

      if (eventsRes.data) {
        const formattedEvents = eventsRes.data.map(e => ({
          ...e,
          player: Array.isArray(e.player) ? e.player[0] : e.player,
          assist_player: Array.isArray(e.assist_player) ? e.assist_player[0] : e.assist_player
        })) as MatchEvent[];
        setEvents(formattedEvents);
      }

    } catch (error) {
      console.error('[LiveMatch] Error fetching match data:', error);
      const cached = await getCachedData<CachedLiveData>(LIVE_DATA_KEY(matchId));
      if (cached?.match) {
        setMatch(prev => prev ?? cached.match);
        setTeam(prev => prev ?? cached.team);
        setLineups(prev => (prev.length > 0 ? prev : cached.lineups));
        setEvents(prev => (prev.length > 0 ? prev : cached.events));
        setPartsCount(cached.match.parts_count || 2);
        setPartDurationMinutes(cached.match.part_duration_minutes || getHalfDurationForCategory(cached.team?.category));
        toast.warning('Sem rede: a usar a cópia do jogo guardada neste aparelho.');
      } else {
        toast.error('Erro ao carregar dados do jogo');
      }
    } finally {
      setLoading(false);
    }
  };

  // =================== MATCH CONTROL HANDLERS ===================

  /**
   * Match clock in seconds: real time of the finished parts + exact elapsed of the
   * current one. Every event is stamped with it (minute = clock / 60, second = clock % 60)
   * so playing time can be summed to the second, however many times a player re-enters.
   */
  const getClockSeconds = useCallback(() => {
    if (currentPart === 0) return 0;
    // Exact wall-clock time (the rendered tick can lag after the phone sleeps)
    return matchClockSeconds(partElapsedSeconds, currentPart, timer.getExactElapsedSeconds());
  }, [currentPart, partElapsedSeconds, timer]);

  const getCurrentMinute = useCallback(() => Math.floor(getClockSeconds() / 60), [getClockSeconds]);

  /**
   * Persist a change to the match row. The local copy is updated first so later
   * calculations (e.g. 2nd-half starters for playing time) never use stale data;
   * without network the update is queued and synced later.
   */
  const updateMatchRecord = useCallback(async (patch: Record<string, unknown>) => {
    setMatch(prev => (prev ? ({ ...prev, ...patch } as Match) : prev));
    try {
      const { error } = await supabase.from('matches').update(patch as any).eq('id', matchId);
      if (error) throw error;
    } catch (error) {
      if (isNetworkError(error)) {
        await addPendingOperation('matches', 'update', { id: matchId, ...patch });
        setSyncStatus('pending');
      } else {
        console.error('[LiveMatch] Error updating match:', error);
        setSyncStatus('error');
      }
    }
  }, [matchId]);

  const buildRegulationPartMinutes = useCallback((count: number = partsCount) => {
    const stored = (match as any)?.part_regulation_minutes as number[] | null | undefined;
    if (Array.isArray(stored) && stored.length === count) return stored;
    return Array(count).fill(partDurationMinutes);
  }, [match, partsCount, partDurationMinutes]);

  const buildPartStartersByIndex = useCallback((): Record<string, string[]> => {
    const stored = ((match as any)?.part_starter_ids ?? {}) as Record<string, string[]>;
    const out: Record<string, string[]> = {};
    Object.entries(stored).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) out[key] = value;
    });
    if (!out['1']) {
      const first = ((match as any)?.starter_ids as string[] | null | undefined) ?? lineups.filter(l => l.is_starter).map(l => l.player_id);
      out['1'] = first;
    }
    const secondHalf = ((match as any)?.second_half_starter_ids as string[] | null | undefined) ?? null;
    if (!out['2'] && Array.isArray(secondHalf) && secondHalf.length > 0) out['2'] = secondHalf;
    return out;
  }, [match, lineups]);

  const handlePrepareStartMatch = () => {
    const starters = lineups.filter(l => l.is_starter);
    if (starters.length === 0) {
      toast.error('Selecione pelo menos um jogador titular');
      return;
    }

    const starterValidation = validateStarterCount(starters.length, matchSport);
    if (!starterValidation.allowed) {
      toast.error(starterValidation.reason || 'Escalação inválida');
      return;
    }

    // Always show config modal so coach can review/edit duration
    setConfigModalOpen(true);
  };

  const handleStartMatchWithConfig = async (config: MatchFormatConfig) => {
    try {
      // Remember the format for this team (e.g. 15 + 15 + 30) so the next match starts with it
      if (config.saveAsTeamFormat && team) {
        const format = { parts: config.partMinutes };
        setTeam(prev => (prev ? { ...prev, match_format: format } : prev));
        supabase.from('teams').update({ match_format: format } as any).eq('id', team.id)
          .then(({ error }) => { if (error) console.warn('[LiveMatch] Could not save team format:', error.message); });
      }
      const now = new Date().toISOString();
      const nowMs = Date.now();
      
      const currentStarters = lineups.filter(l => l.is_starter);
      const currentBench = lineups.filter(l => !l.is_starter);
      const starterPlayerIds = currentStarters.map(l => l.player_id);

      const starterValidation = validateStarterCount(starterPlayerIds.length, matchSport);
      if (!starterValidation.allowed) {
        toast.error(starterValidation.reason || 'Escalação inválida');
        logConflictAlert({
          matchId,
          alertType: 'invalid_lineup',
          severity: 'blocking',
          message: starterValidation.reason || 'Escalação inválida',
          metadata: { starterCount: starterPlayerIds.length, sportType: matchSport },
        });
        return;
      }
      
      // Update match in database
      const initialPartStarters = { '1': starterPlayerIds };
      const initialRegulationMinutes = config.partMinutes; // parts may differ, e.g. [15, 15, 30]
      await updateMatchRecord({ 
          status: 'in_progress',
          match_phase: 'playing',
          current_part: 1,
          part_elapsed_seconds: [0],
          part_starter_ids: initialPartStarters,
          part_real_seconds: [0],
          part_regulation_minutes: initialRegulationMinutes,
          last_timer_start: now,
          last_paused_seconds: 0,
          parts_count: config.partsCount,
          part_duration_minutes: config.partDurationMinutes,
          tournament_locked: matchType === 'tournament',
          part_started_at_ms: nowMs,
          starter_ids: starterPlayerIds,
          bench_ids: currentBench.map(l => l.player_id),
          on_field_ids: starterPlayerIds,
        });

      // Set active match
      await setActiveMatchId(matchId);

      // Initialize player presence intervals - starters start at minute 0
      const initialIntervals = presenceTracker.initializeIntervals(starterPlayerIds, 0);

      // Update local state
      setPartsCount(config.partsCount);
      setPartDurationMinutes(config.partDurationMinutes);
      setPhase('playing');
      setCurrentPart(1);
      setPartElapsedSeconds([0]);
      setMatch(prev => prev ? { ...prev, status: 'in_progress', last_timer_start: now } : null);
      
      if (matchType === 'tournament') {
        setIsLocked(true);
      }
      
      // Mark game as active
      hasRestoredRef.current = true;
      isGameActiveRef.current = true;
      
      // Start timer
      timer.startTimer(0);
      
      // Save state immediately with presence intervals
      const state: LiveMatchMinimalState = {
        matchId,
        phase: 'playing',
        currentPart: 1,
        partsCount: config.partsCount,
        partDurationMinutes: config.partDurationMinutes,
        matchType,
        partStartedAtMs: nowMs,
        partElapsedBeforePause: 0,
        isTimerRunning: true,
        starterIds: starterPlayerIds,
        benchIds: currentBench.map(l => l.player_id),
        onFieldIds: starterPlayerIds,
        partElapsedSeconds: [0],
        lastSavedAt: nowMs,
        playerPresenceIntervals: initialIntervals,
      };
      await liveState.saveLocal(state);

      // Save/update rule snapshot if not already present
      if (!ruleSnapshot) {
        const ageCode = normalizeAgeGroupCode(team?.category);
        const profile = await getDefaultRuleProfile(
          matchSport || 'football_7',
          ageCode,
          null,
          match?.competition
        );
        const snapshot = profile
          ? buildSnapshotFromProfile(profile)
          : buildSnapshotFromFallback(matchSport || 'football_7', config.partDurationMinutes, config.partsCount);
        // Apply config overrides
        snapshot.period_1_minutes = config.partMinutes[0];
        snapshot.period_2_minutes = config.partMinutes[1] ?? config.partMinutes[0];
        snapshot.period_count = config.partsCount;
        await saveMatchRuleSnapshot(matchId, snapshot, profile?.id);
        setRuleSnapshot(snapshot);
      }
      
      startAutoSave();
      toast.success(`${getPartLabel(1, config.partsCount)} iniciada!`);
    } catch (error) {
      console.error('[LiveMatch] Error starting match:', error);
      toast.error('Erro ao iniciar jogo');
    }
  };

  const handleStartMatch = async () => {
    handlePrepareStartMatch();
  };

  const handleEndPart = async () => {
    const partSeconds = timer.pauseTimer();
    const newPartElapsed = [...partElapsedSeconds];
    newPartElapsed[currentPart - 1] = partSeconds;
    const newPartRealSeconds = [...(((match as any)?.part_real_seconds as number[] | null) ?? partElapsedSeconds)];
    newPartRealSeconds[currentPart - 1] = partSeconds;
    const newPartRegulationMinutes = buildRegulationPartMinutes(partsCount);
    newPartRegulationMinutes[currentPart - 1] = partDurationMinutes;
    setPartElapsedSeconds(newPartElapsed);

    // Close all open presence intervals at current minute
    presenceTracker.handleEndPart(getCurrentMinute());

    await updateMinutesPlayed(getCurrentMinute());

    if (currentPart >= partsCount) {
      await finishMatch(newPartElapsed, newPartRealSeconds, newPartRegulationMinutes);
    } else {
      setPhase('interval');
      
      await updateMatchRecord({ 
          match_phase: 'interval',
          part_elapsed_seconds: newPartElapsed,
          part_real_seconds: newPartRealSeconds,
          part_regulation_minutes: newPartRegulationMinutes,
          last_timer_start: null,
          part_started_at_ms: null,
        });
      
      // Save state
      await saveCurrentState();
      
      toast.info(`${getPartLabel(currentPart, partsCount)} terminada: ${Math.floor(partSeconds / 60)}'`);
    }
  };

  const handleStartNextPart = async () => {
    const nextPart = currentPart + 1;
    timer.resetTimer();
    
    setPhase('playing');
    setCurrentPart(nextPart);
    
    const newPartElapsed = [...partElapsedSeconds, 0];
    setPartElapsedSeconds(newPartElapsed);
    
    const now = new Date().toISOString();
    const nowMs = Date.now();
    
    const currentStarters = lineups.filter(l => l.is_starter);
    const currentBench = lineups.filter(l => !l.is_starter);
    const onFieldPlayerIds = currentStarters.map(l => l.player_id);
    const previousPartStarters = buildPartStartersByIndex();
    const nextPartStarters = { ...previousPartStarters, [String(nextPart)]: onFieldPlayerIds };
    const regulationPartMinutes = buildRegulationPartMinutes(Math.max(partsCount, nextPart));
    regulationPartMinutes[nextPart - 1] = regulationPartMinutes[nextPart - 1] ?? partDurationMinutes;

    const starterValidation = validateStarterCount(currentStarters.length, matchSport);
    if (!starterValidation.allowed) {
      toast.error(starterValidation.reason || 'Escalação inválida');
      return;
    }
    
    await updateMatchRecord({ 
        match_phase: 'playing',
        current_part: nextPart,
        part_elapsed_seconds: newPartElapsed,
          part_starter_ids: nextPartStarters,
          second_half_starter_ids: nextPart === 2 ? onFieldPlayerIds : ((match as any)?.second_half_starter_ids ?? null),
          second_half_starter_set_at: nextPart === 2 ? now : ((match as any)?.second_half_starter_set_at ?? null),
          second_half_starter_set_by: nextPart === 2 ? user?.id : ((match as any)?.second_half_starter_set_by ?? null),
          part_regulation_minutes: regulationPartMinutes,
          parts_count: Math.max(partsCount, nextPart),
        last_timer_start: now,
        last_paused_seconds: 0,
        part_started_at_ms: nowMs,
          on_field_ids: onFieldPlayerIds,
      });

    isGameActiveRef.current = true;
    
    timer.startTimer(0);
    
    // Save state immediately
    // Re-open presence intervals for players on field at start of new part
    presenceTracker.handleStartPart(onFieldPlayerIds, getCurrentMinute(), true);

    // Save state immediately with updated intervals
    const state: LiveMatchMinimalState = {
      matchId,
      phase: 'playing',
      currentPart: nextPart,
      partsCount,
      partDurationMinutes,
      matchType,
      partStartedAtMs: nowMs,
      partElapsedBeforePause: 0,
      isTimerRunning: true,
      starterIds: currentStarters.map(l => l.player_id),
      benchIds: currentBench.map(l => l.player_id),
      onFieldIds: onFieldPlayerIds,
      partElapsedSeconds: newPartElapsed,
      lastSavedAt: nowMs,
      playerPresenceIntervals: presenceTracker.getIntervalsForPersistence(),
    };
    await liveState.saveLocal(state);
    
    startAutoSave();
    toast.success(`${getPartLabel(nextPart, partsCount)} iniciada!`);
  };

  const finishMatch = async (finalPartElapsed: number[], finalPartRealSeconds?: number[], finalPartRegulationMinutes?: number[]) => {
    const goalsFor = events.filter(e => e.event_type === 'goal' && !e.is_opponent).length;
    const goalsAgainst = events.filter(e => 
      (e.event_type === 'goal' && e.is_opponent) || 
      (e.event_type === 'own_goal' && !e.is_opponent)
    ).length;

    try {
      // Final recalculation using definitive part_elapsed_seconds
      const { calculateMatchEndMinute } = await import('@/lib/match-playing-time');
      const finalMatchEndMinute = calculateMatchEndMinute(finalPartElapsed);
      await updateMinutesPlayed(finalMatchEndMinute);

      await updateMatchRecord({ 
          status: 'completed',
          match_phase: 'finished',
          goals_for: goalsFor,
          goals_against: goalsAgainst,
          part_elapsed_seconds: finalPartElapsed,
          part_real_seconds: finalPartRealSeconds ?? finalPartElapsed,
          part_regulation_minutes: finalPartRegulationMinutes ?? buildRegulationPartMinutes(partsCount),
          last_timer_start: null,
          part_started_at_ms: null,
          report_status: 'pending_completion',
        });

      // Also update match_reports status
      await supabase
        .from('match_reports')
        .update({ 
          report_status: 'pending_completion',
          ended_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('match_id', matchId);

      // Clear active match
      await clearActiveMatch();
      
      // Clear local state
      await liveState.clearLocal();

      setPhase('finished');
      stopAutoSave();
      isGameActiveRef.current = false;
      
      setMatch(prev => prev ? { 
        ...prev, 
        status: 'completed',
        goals_for: goalsFor,
        goals_against: goalsAgainst
      } : null);
      toast.success('Jogo terminado!');
    } catch (error) {
      console.error('[LiveMatch] Error finishing match:', error);
      toast.error('Erro ao terminar jogo');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateMinutesPlayed = async (_matchEndMinute: number) => {
    // Same seconds-precise calculation as the live view, rounded once per player.
    const realSeconds = [...(((match as any)?.part_real_seconds as number[] | null | undefined) ?? partElapsedSeconds)];
    const exactElapsed = timer.getExactElapsedSeconds();
    if (currentPart > 0) realSeconds[currentPart - 1] = exactElapsed;
    const seconds = computePlayingSeconds({
      partSeconds: realSeconds.slice(0, Math.max(1, currentPart)),
      partStarters: buildPartStartersByIndex(),
      events,
    });

    for (const lineup of lineups) {
      const minutes = secondsToMinutes(seconds.get(lineup.player_id)?.totalSeconds ?? 0);
      {
        try {
          const { error } = await supabase
            .from('match_lineups')
            .update({ minutes_played: minutes })
            .eq('id', lineup.id);
          if (error) throw error;
        } catch (error) {
          if (isNetworkError(error)) {
            await addPendingOperation('match_lineups', 'update', { id: lineup.id, minutes_played: minutes });
          } else {
            console.error('[LiveMatch] Error saving minutes:', error);
          }
        }
      }
    }
    fetchMatchData();
  };

  const handleEvent = async (eventType: string, playerId: string | null, isOpponent: boolean = false, assistPlayerId: string | null = null) => {
    if (!user) return;
    
    const clock = getClockSeconds();
    const minute = Math.floor(clock / 60);
    const second = clock % 60;
    // Client-generated id so the same event can be queued offline and synced later
    const eventId = crypto.randomUUID();
    const row = {
      id: eventId,
      match_id: matchId,
      event_type: eventType as 'goal' | 'own_goal' | 'yellow_card' | 'red_card' | 'substitution_in' | 'substitution_out',
      minute,
      second,
      player_id: playerId,
      assist_player_id: assistPlayerId,
      is_opponent: isOpponent,
      owner_id: user.id,
    };
    const eventLabels: Record<string, string> = {
      goal: 'Golo registado',
      own_goal: 'Auto-golo registado',
      yellow_card: 'Cartão amarelo registado',
      red_card: 'Cartão vermelho registado',
    };

    try {
      const { data, error } = await supabase
        .from('match_events')
        .insert([{
          id: eventId,
          match_id: matchId,
          event_type: eventType as 'goal' | 'own_goal' | 'yellow_card' | 'red_card' | 'substitution_in' | 'substitution_out',
          minute,
          second,
          player_id: playerId,
          assist_player_id: assistPlayerId,
          is_opponent: isOpponent,
          owner_id: user.id
        }])
        .select(`
          id, event_type, minute, second, player_id, assist_player_id, is_opponent, notes,
          player:players!match_events_player_id_fkey(id, name, number, position),
          assist_player:players!match_events_assist_player_id_fkey(id, name, number, position)
        `)
        .single();

      if (error) throw error;

      const formattedEvent = {
        ...data,
        player: Array.isArray(data.player) ? data.player[0] : data.player,
        assist_player: Array.isArray(data.assist_player) ? data.assist_player[0] : data.assist_player
      } as MatchEvent;

      setEvents(prev => [...prev, formattedEvent].sort((a, b) => a.minute - b.minute));

      toast.success(eventLabels[eventType] || 'Evento registado');
    } catch (error) {
      if (!isNetworkError(error)) {
        console.error('[LiveMatch] Error recording event:', error);
        toast.error('Erro ao registar evento');
        return;
      }
      // No network: keep the event on this device and sync it later.
      await addPendingOperation('match_events', 'insert', row);
      const findPlayer = (id: string | null) => lineups.find(l => l.player_id === id)?.player;
      const localEvent: MatchEvent = {
        ...row,
        notes: null,
        player: findPlayer(playerId),
        assist_player: findPlayer(assistPlayerId),
      };
      setEvents(prev => [...prev, localEvent].sort((a, b) => a.minute - b.minute));
      setSyncStatus('pending');
      toast.success(`${eventLabels[eventType] || 'Evento registado'} (sem rede — será enviado depois)`);
    }
  };

  const handleSubstitutionBatch = async (substitutions: PendingSubstitution[], _minute: number) => {
    if (!user || substitutions.length === 0) return;

    const clock = getClockSeconds();
    const minute = Math.floor(clock / 60);
    const second = clock % 60;

    try {
      // Local pre-validation for immediate feedback (no DB write if it fails).
      const lineupByPlayer = new Map(lineups.map(l => [l.player_id, l] as const));
      const projectedOnField = new Set(lineups.filter(l => l.is_starter).map(l => l.player_id));
      for (const sub of substitutions) {
        if (!projectedOnField.has(sub.playerOutId)) {
          toast.error('Substituição inválida: jogador que sai não está em campo.');
          return;
        }
        if (projectedOnField.has(sub.playerInId)) {
          toast.error('Substituição inválida: jogador que entra já está em campo.');
          return;
        }
        if (!lineupByPlayer.has(sub.playerOutId) || !lineupByPlayer.has(sub.playerInId)) {
          toast.error('Substituição inválida: jogador não pertence à convocatória.');
          return;
        }
        projectedOnField.delete(sub.playerOutId);
        projectedOnField.add(sub.playerInId);
      }

      // Atomic server-side commit (single transaction, deterministic ordering via second).
      const rpcParams = {
        p_match_id: matchId,
        p_owner_id: user.id,
        p_minute: minute,
        p_second_base: second,
        p_subs: substitutions.map(s => ({ out: s.playerOutId, in: s.playerInId })),
      };
      let queuedOffline = false;
      try {
        const { error: rpcError } = await supabase.rpc('commit_substitution_batch', rpcParams);
        if (rpcError) throw rpcError;
      } catch (rpcError) {
        if (!isNetworkError(rpcError)) throw rpcError;
        await addPendingOperation('commit_substitution_batch', 'rpc', rpcParams);
        queuedOffline = true;
      }

      if (queuedOffline) {
        // Apply locally so the coach keeps working; the server copy follows when online.
        const outIds = new Set(substitutions.map(s => s.playerOutId));
        const inIds = new Set(substitutions.map(s => s.playerInId));
        setLineups(prev => prev.map(l =>
          outIds.has(l.player_id) ? { ...l, is_starter: false }
            : inIds.has(l.player_id) ? { ...l, is_starter: true } : l));
        const findPlayer = (id: string) => lineups.find(l => l.player_id === id)?.player;
        const localSubEvents: MatchEvent[] = substitutions.flatMap((s, i) => ([
          { id: `local-${crypto.randomUUID()}`, event_type: 'substitution_out', minute, second: second + i, player_id: s.playerOutId, assist_player_id: null, is_opponent: false, notes: null, player: findPlayer(s.playerOutId) },
          { id: `local-${crypto.randomUUID()}`, event_type: 'substitution_in', minute, second: second + i, player_id: s.playerInId, assist_player_id: null, is_opponent: false, notes: null, player: findPlayer(s.playerInId) },
        ]));
        setEvents(prev => [...prev, ...localSubEvents].sort((a, b) => a.minute - b.minute));
        presenceTracker.handleSubstitutionBatch(
          substitutions.map(s => ({ playerOutId: s.playerOutId, playerInId: s.playerInId })),
          minute,
        );
        setSyncStatus('pending');
        toast.success('Substituição guardada neste aparelho (sem rede — será enviada depois).');
        return;
      }

      // Update presence intervals atomically (single setState)
      presenceTracker.handleSubstitutionBatch(
        substitutions.map(s => ({ playerOutId: s.playerOutId, playerInId: s.playerInId })),
        minute,
      );

      toast.success(
        substitutions.length === 1
          ? 'Substituição confirmada.'
          : `${substitutions.length} substituições confirmadas.`,
      );

      await refreshLineupsAndEvents();
      await saveCurrentState();
    } catch (error) {
      console.error('[LiveMatch] Error committing substitution batch:', error);
      toast.error('Erro ao guardar substituições. Tente novamente.');
    }
  };

  const refreshLineupsAndEvents = async () => {
    try {
      const [lineupsRes, eventsRes] = await Promise.all([
        supabase.from('match_lineups')
          .select(`
            id, player_id, is_starter, minutes_played, position_played,
            player:players(id, name, number, position)
          `)
          .eq('match_id', matchId),
        supabase.from('match_events')
          .select(`
            id, event_type, minute, second, player_id, assist_player_id, is_opponent, notes,
            player:players!match_events_player_id_fkey(id, name, number, position),
            assist_player:players!match_events_assist_player_id_fkey(id, name, number, position)
          `)
          .eq('match_id', matchId)
          .order('minute', { ascending: true })
      ]);

      if (lineupsRes.data) {
        const formattedLineups = lineupsRes.data.map(l => ({
          ...l,
          player: Array.isArray(l.player) ? l.player[0] : l.player
        })) as Lineup[];
        setLineups(formattedLineups);
      }

      if (eventsRes.data) {
        const formattedEvents = eventsRes.data.map(e => ({
          ...e,
          player: Array.isArray(e.player) ? e.player[0] : e.player,
          assist_player: Array.isArray(e.assist_player) ? e.assist_player[0] : e.assist_player
        })) as MatchEvent[];
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('[LiveMatch] Error refreshing lineups and events:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (eventId.startsWith('local-')) {
      toast.error('Esta substituição ainda não foi enviada. Poderá corrigi-la quando houver rede.');
      return;
    }
    try {
      const { error } = await supabase.from('match_events').delete().eq('id', eventId);
      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast.success('Evento removido');
    } catch (error) {
      if (isNetworkError(error)) {
        await addPendingOperation('match_events', 'delete', { id: eventId });
        setEvents(prev => prev.filter(e => e.id !== eventId));
        toast.success('Evento removido (sem rede — será sincronizado depois)');
      } else {
        toast.error('Erro ao remover evento');
      }
    }
  };

  // =================== DISPLAY CALCULATIONS ===================

  const regulationByPart = buildRegulationPartMinutes(partsCount);
  const displayMinute =
    regulationByPart.slice(0, Math.max(0, currentPart - 1)).reduce((s, m) => s + (m || 0), 0) +
    Math.floor(timer.elapsedSeconds / 60);
  const goalsFor = events.filter(e => e.event_type === 'goal' && !e.is_opponent).length;
  const goalsAgainst = events.filter(e => 
    (e.event_type === 'goal' && e.is_opponent) || 
    (e.event_type === 'own_goal' && !e.is_opponent)
  ).length;
  const isOvertime = timer.elapsedSeconds > currentPartRegulation * 60;
  const sportRules = getSportFormatRules(matchSport);

  // Playing time to the second, from the same calculation used for the final minutes
  const liveSeconds = currentPart > 0
    ? computePlayingSeconds({
        partSeconds: [...partElapsedSeconds.slice(0, currentPart - 1), timer.elapsedSeconds],
        partStarters: buildPartStartersByIndex(),
        events,
      })
    : new Map();
  const playerSeconds = (id: string) => liveSeconds.get(id)?.totalSeconds ?? 0;
  const playerPlayTimes = new Map(lineups.map(l => [l.player_id, secondsToMinutes(playerSeconds(l.player_id))]));

  const starters = lineups.filter(l => l.is_starter);
  // Bench sorted by who has played least: helps give every child fair minutes
  const substitutes = lineups
    .filter(l => !l.is_starter)
    .sort((a, b) => playerSeconds(a.player_id) - playerSeconds(b.player_id));

  // ── Live pitch (Football Manager style) ──
  const clockNow = currentPart > 0 ? matchClockSeconds(partElapsedSeconds, currentPart, timer.elapsedSeconds) : 0;
  const pitchTactics = matchSport
    ? reconcileTactics(matchSport, match?.live_tactics ?? null, starters.map(l => ({ player_id: l.player_id, position: l.player?.position })))
    : null;
  const pitchTacticsKey = pitchTactics ? JSON.stringify(pitchTactics) : '';
  // Ability (last evaluation) + form (last match ratings), FM style — shown before kick-off
  const { scope: sportScope } = useSportScope();
  const { data: squadProfiles } = useSquadProfiles(lineups.map(l => l.player_id));
  const pitchPlayers = new Map<string, PitchPlayerInfo>(lineups.map(l => {
    const mine = events.filter(e => e.player_id === l.player_id && !e.is_opponent);
    const prof = squadProfiles?.get(l.player_id);
    return [l.player_id, {
      player_id: l.player_id,
      name: l.player?.name ?? '—',
      number: l.player?.number,
      seconds: playerSeconds(l.player_id),
      freshness: estimateFreshness(liveSeconds.get(l.player_id)?.stints ?? [], clockNow),
      goals: mine.filter(e => e.event_type === 'goal').length,
      yellow: mine.filter(e => e.event_type === 'yellow_card').length,
      red: mine.filter(e => e.event_type === 'red_card').length,
      ability: prof?.ability ?? null,
      formAvg: prof?.form.average ?? null,
      formTrend: prof?.form.trend,
      tags: pitchTactics?.roles?.captain === l.player_id ? ['C'] : [],
    }];
  }));
  const saveTactics = (t: LiveTactics | null) => (t ? updateMatchRecord({ live_tactics: t }) : Promise.resolve());
  const handlePitchSubstitute = async (outId: string, inId: string) => {
    if (pitchTactics) saveTactics(applySubstitution(pitchTactics, outId, inId));
    const minute = getCurrentMinute();
    await handleSubstitutionBatch([{ tempId: `pitch-${Date.now()}`, minute, playerOutId: outId, playerInId: inId }], minute);
  };

  // Before kick-off: moving players on the pitch changes who starts (match_lineups.is_starter)
  const setStarter = async (playerId: string, isStarter: boolean) => {
    const row = lineups.find(l => l.player_id === playerId);
    if (!row) return;
    const { error } = await supabase.from('match_lineups').update({ is_starter: isStarter }).eq('id', row.id);
    if (error) throw error;
  };
  const handleSetupSubstitute = async (outId: string, inId: string) => {
    try {
      if (pitchTactics) await saveTactics(applySubstitution(pitchTactics, outId, inId));
      await setStarter(outId, false);
      await setStarter(inId, true);
    } catch { toast.error('Não foi possível alterar o onze.'); }
    fetchMatchData();
  };
  const handleSetupFill = async (slotId: string, playerId: string) => {
    if (starters.length >= sportRules.playersOnField) {
      toast.error(`Já tem ${sportRules.playersOnField} titulares. Troque com um jogador em campo.`);
      return;
    }
    try {
      if (pitchTactics) await saveTactics({ ...pitchTactics, slots: { ...pitchTactics.slots, [slotId]: playerId } });
      await setStarter(playerId, true);
    } catch { toast.error('Não foi possível alterar o onze.'); }
    fetchMatchData();
  };

  // FM-style automatic selection + assistant report (before kick-off)
  const candidates: Candidate[] = lineups.map(l => {
    const prof = squadProfiles?.get(l.player_id);
    return {
      player_id: l.player_id,
      name: l.player?.name,
      position: l.player?.position,
      ability: prof?.ability ?? null,
      form: prof?.form.average ?? null,
      formTrend: prof?.form.trend,
      seasonMinutes: prof?.seasonMinutes ?? 0,
    };
  });
  const assistantNotes = phase === 'setup' ? assistantReport(candidates, starters.map(l => l.player_id), sportRules.playersOnField) : [];
  const applyAutoPick = async (mode: PickMode) => {
    if (!pitchTactics || !matchSport) return;
    const r = pickStartingXI(matchSport, pitchTactics.formation, candidates, mode, pitchTactics.roles);
    if (!r) return;
    const want = new Set(r.starterIds);
    try {
      await saveTactics(r.tactics);
      for (const l of lineups) {
        if (l.is_starter !== want.has(l.player_id)) await setStarter(l.player_id, want.has(l.player_id));
      }
      toast.success(mode === 'best' ? 'Melhor onze escolhido.' : 'Onze com quem tem menos minutos.');
    } catch { toast.error('Não foi possível alterar o onze.'); }
    fetchMatchData();
  };
  const saveRoles = (roles: NonNullable<LiveTactics['roles']>) => { if (pitchTactics) saveTactics({ ...pitchTactics, roles }); };

  // Keep the stored tactics in step with who is on the field (after subs, edits…)
  useEffect(() => {
    if (!pitchTactics || phase === 'setup' || phase === 'finished') return;
    if (JSON.stringify(match?.live_tactics ?? null) !== pitchTacticsKey) saveTactics(pitchTactics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchTacticsKey, phase]);

  // Compute consistency issues for conflict display
  const matchEndEstimate = partElapsedSeconds.reduce((s, sec) => s + Math.floor(sec / 60), 0) + (phase === 'playing' ? timer.getMinutes() : 0);
  const starterInfosForCheck = lineups.map(l => ({ player_id: l.player_id, is_starter: l.is_starter }));
  const eventsForCheck = events.map(e => ({ event_type: e.event_type, minute: e.minute, player_id: e.player_id, is_opponent: e.is_opponent }));
  const livePartStarters = buildPartStartersByIndex();
  const firstPartIds = new Set(livePartStarters['1'] ?? []);
  const consistencyIssues = phase !== 'setup'
    ? checkMatchConsistency(
        firstPartIds.size > 0 ? lineups.map(l => ({ player_id: l.player_id, is_starter: firstPartIds.has(l.player_id) })) : starterInfosForCheck,
        eventsForCheck,
        matchEndEstimate || 90,
        matchSport,
        {
          partStarters: livePartStarters,
          // completed parts + the part in progress (open-ended)
          realPartMinutes: [...partElapsedSeconds.slice(0, Math.max(0, currentPart - 1)).map(sec => Math.floor(sec / 60)), 999],
        },
      )
    : [];

  // =================== RENDER ===================

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-pulse">A carregar...</div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'finished' && match) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onExit}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const scorers = events
                  .filter(e => e.event_type === 'goal' && !e.is_opponent)
                  .map(e => `⚽ ${e.player?.name ?? 'Golo'} ${e.minute}'`);
                const home = match.is_home;
                const us = team?.name ?? 'Nós';
                const text = [
                  `🏁 *Resultado final*`,
                  home ? `${us} ${goalsFor} – ${goalsAgainst} ${match.opponent_name}` : `${match.opponent_name} ${goalsAgainst} – ${goalsFor} ${us}`,
                  ...(scorers.length ? ['', ...scorers] : []),
                  '',
                  'Registado com TreinON',
                ].join('\n');
                shareText(text, 'Resultado');
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Partilhar resultado
            </Button>
            <Badge variant="outline" className="text-lg px-4 py-2">
              Terminado
            </Badge>
          </div>
        </div>
        
        <MatchRatingsPanel matchId={matchId} />

        <MatchReport
          match={match}
          lineups={lineups}
          events={events}
          teamName={team?.name}
          partElapsedSeconds={partElapsedSeconds}
          halfDuration={partDurationMinutes}
          partRegulationMinutes={(match as any)?.part_regulation_minutes ?? null}
          partStartersByIndex={(match as any)?.part_starter_ids ?? null}
          partsCount={(match as any)?.parts_count ?? partsCount}
          sportType={matchSport}
          ruleSnapshot={ruleSnapshot}
          secondHalfStarterIds={(match as any)?.second_half_starter_ids ?? null}
        />
      </div>
    );
  }

  return (
    <div className={`${phase === 'playing' && isMobile ? 'pb-20' : ''}`}>
      {/* Mobile context bar - sticky top */}
      {phase !== 'setup' && phase !== 'finished' && (
        <MatchContextBar
          opponentName={match?.opponent_name || ''}
          goalsFor={goalsFor}
          goalsAgainst={goalsAgainst}
          currentPeriod={phase === 'playing' ? getPartLabel(currentPart, partsCount) : phase === 'interval' ? 'Intervalo' : undefined}
          displayMinute={phase === 'playing' ? displayMinute : undefined}
          modality={matchSport || undefined}
          ageGroup={team?.category || undefined}
          isOnline={isOnline}
          syncStatus={syncStatus}
          compact={isMobile}
        />
      )}

      <div className="p-4 md:p-6 space-y-4">
        {/* Header - only in setup or desktop */}
        {(phase === 'setup' || !isMobile) && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Button variant="outline" size={isMobile ? 'sm' : 'default'} onClick={onExit}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              {ruleSnapshot && (
                <MatchRulesPanel snapshot={ruleSnapshot} compact />
              )}
              {!ruleSnapshot && (
                <Badge variant="secondary" className="text-sm">
                  {team?.category || 'Escalão'} ({partsCount}x{partDurationMinutes}')
                </Badge>
              )}
              <Badge variant="outline" className="text-lg px-4 py-2">
                {phase === 'setup' && 'Preparação'}
                {phase === 'playing' && getPartLabel(currentPart, partsCount)}
                {phase === 'interval' && 'Intervalo'}
              </Badge>
            </div>
          </div>
        )}

        {/* Desktop Scoreboard - hidden on mobile playing (context bar shows it) */}
        {phase !== 'setup' && !isMobile && (
          <Card className={`border-primary/20 ${isOvertime ? 'bg-destructive/5 border-destructive/30' : 'bg-primary/5'}`}>
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">
                    {match?.is_home ? 'Casa' : 'Visitante'}
                  </div>
                  <div className="text-4xl font-bold">{goalsFor}</div>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-mono font-bold ${isOvertime ? 'text-destructive' : 'text-primary'}`}>
                    {displayMinute}'
                  </div>
                  <div className="text-lg text-muted-foreground">
                    {timer.formatTime(timer.elapsedSeconds)}
                  </div>
                  {isOvertime && (
                    <div className="text-xs text-destructive mt-1 flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Tempo extra
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">
                    {match?.opponent_name}
                  </div>
                  <div className="text-4xl font-bold">{goalsAgainst}</div>
                </div>
              </div>

              {/* Desktop Timer Controls */}
              {phase === 'playing' && (
                <div className="flex justify-center gap-2 mt-4 flex-wrap">
                  {!timer.isRunning ? (
                    <Button onClick={() => timer.startTimer()} size="sm">
                      <Play className="w-4 h-4 mr-1" />
                      Continuar
                    </Button>
                  ) : (
                    <Button onClick={() => timer.pauseTimer()} variant="outline" size="sm">
                      <Pause className="w-4 h-4 mr-1" />
                      Pausar
                    </Button>
                  )}
                  {!isLocked && (
                    <Button onClick={() => timer.resetTimer()} variant="outline" size="sm">
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reiniciar
                    </Button>
                  )}
                  <Button 
                    onClick={handleEndPart} 
                    variant={currentPart >= partsCount ? 'destructive' : 'secondary'} 
                    size="sm"
                  >
                    {currentPart >= partsCount ? (
                      <Square className="w-4 h-4 mr-1" />
                    ) : (
                      <Clock className="w-4 h-4 mr-1" />
                    )}
                    {getEndPartLabel(currentPart, partsCount)}
                  </Button>
                </div>
              )}

              {phase === 'interval' && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button onClick={handleStartNextPart} size="sm">
                    <Play className="w-4 h-4 mr-1" />
                    {getStartPartLabel(currentPart + 1, partsCount)}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Friendlies / tournaments: the coach decides the modality of this match */}
        {phase === 'setup' && matchType !== 'championship' && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Modalidade deste jogo</p>
                <p className="text-xs text-muted-foreground">
                  {matchType === 'friendly' ? 'Amigável: escolha livremente (ex.: 11 contra 11).' : 'Torneio: conforme o regulamento do torneio.'}
                  {team?.sport_type && ` A equipa joga ${SPORT_LABELS[team.sport_type] ?? team.sport_type}.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(SPORT_LABELS).filter(([value]) => isSportAllowed(sportScope, value) || value === matchSport).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={matchSport === value ? 'default' : 'outline'}
                    onClick={() => updateMatchRecord({ sport_type: value === team?.sport_type ? null : value, live_tactics: null })}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Phase: the XI on the pitch, FM style */}
        {phase === 'setup' && pitchTactics && matchSport && lineups.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Tática e onze inicial</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <LivePitch
                mode="setup"
                sportType={matchSport}
                tactics={pitchTactics}
                players={pitchPlayers}
                bench={lineups.filter(l => !l.is_starter)
                  .sort((a, b) => (pitchPlayers.get(b.player_id)?.ability ?? 0) - (pitchPlayers.get(a.player_id)?.ability ?? 0))
                  .map(l => l.player_id)}
                onFormationChange={(code) => saveTactics(reconcileTactics(matchSport, { formation: code, slots: pitchTactics.slots }, starters.map(l => ({ player_id: l.player_id, position: l.player?.position }))))}
                onSwap={(a, b) => saveTactics(swapSlots(pitchTactics, a, b))}
                onSubstitute={handleSetupSubstitute}
                onFillSlot={handleSetupFill}
                onEvent={() => {}}
              />
              <PreMatchPanel
                squad={candidates}
                roles={pitchTactics.roles ?? {}}
                notes={assistantNotes}
                onAutoPick={applyAutoPick}
                onRolesChange={saveRoles}
              />
            </CardContent>
          </Card>
        )}

        {phase === 'setup' && (
          <LineupSelector
            matchId={matchId}
            teamId={teamId}
            lineups={lineups}
            onLineupsChange={fetchMatchData}
            onStartMatch={handleStartMatch}
            sportType={matchSport}
          />
        )}

        {/* Interval Phase */}
        {phase === 'interval' && (
          <>
            {isMobile && (
              <div className="flex justify-center py-3">
                <Button onClick={handleStartNextPart} size="lg" className="w-full max-w-sm h-14 text-lg">
                  <Play className="w-5 h-5 mr-2" />
                  {getStartPartLabel(currentPart + 1, partsCount)}
                </Button>
              </div>
            )}
            <LineupSelector
              matchId={matchId}
              teamId={teamId}
              lineups={lineups}
              onLineupsChange={fetchMatchData}
              onStartMatch={handleStartNextPart}
              isHalftime
              sportType={matchSport}
            />
          </>
        )}

        {/* Playing Phase - Mobile-first layout */}
        {phase === 'playing' && (
          <div className="space-y-3">
            {/* Mobile: compact scoreboard with timer */}
            {isMobile && (
              <div className={`text-center py-2 rounded-lg ${isOvertime ? 'bg-destructive/10' : 'bg-primary/5'}`}>
                <div className="text-lg text-muted-foreground font-mono">
                  {timer.formatTime(timer.elapsedSeconds)}
                </div>
                {isOvertime && (
                  <div className="text-xs text-destructive flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Tempo extra
                  </div>
                )}
              </div>
            )}

            {/* View switch: pitch (Football Manager style) or list */}
            <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-1">
              {(['pitch', 'list'] as const).map(v => (
                <Button key={v} type="button" size="sm" variant={liveView === v ? 'default' : 'ghost'} onClick={() => setLiveView(v)}>
                  {v === 'pitch' ? 'Campo' : 'Lista'}
                </Button>
              ))}
            </div>

            {liveView === 'pitch' && pitchTactics && matchSport && (
              <Card>
                <CardContent className="p-3">
                  <LivePitch
                    sportType={matchSport}
                    tactics={pitchTactics}
                    players={pitchPlayers}
                    bench={substitutes.map(s => s.player_id)}
                    onFormationChange={(code) => saveTactics(reconcileTactics(matchSport, { formation: code, slots: pitchTactics.slots }, starters.map(l => ({ player_id: l.player_id, position: l.player?.position }))))}
                    onSwap={(a, b) => saveTactics(swapSlots(pitchTactics, a, b))}
                    onSubstitute={handlePitchSubstitute}
                    onEvent={(type, pid) => handleEvent(type, pid)}
                  />
                </CardContent>
              </Card>
            )}

            {liveView === 'list' && (<>
            {/* Players on Field */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <span>Em Campo</span>
                    <FieldPlayerCounter current={starters.length} max={sportRules.playersOnField} />
                  </div>
                  {!isMobile && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditLineupOpen(true)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSubstitutionOpen(true)}>
                        <UserMinus className="w-4 h-4 mr-1" />
                        Substituir
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5">
                {starters.map(lineup => {
                  const playTime = formatClock(playerSeconds(lineup.player_id));
                  return (
                    <div 
                      key={lineup.id}
                      className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-lg"
                      onClick={() => {
                        if (isMobile) {
                          setEventSheetDefaults({ playerId: lineup.player_id });
                          setEventSheetOpen(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="min-w-[32px] justify-center text-xs shrink-0">
                          {lineup.player.number || '-'}
                        </Badge>
                        <div className="min-w-0">
                          <span className="font-medium text-sm truncate block">{lineup.player.name}</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono tabular-nums">{playTime}</span> {lineup.player.position && `• ${lineup.player.position}`}
                          </span>
                        </div>
                      </div>
                      {/* Desktop quick actions */}
                      {!isMobile && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-green-100"
                            onClick={(e) => { e.stopPropagation(); handleEvent('goal', lineup.player_id); }}
                            title="Golo"
                          >
                            <span className="text-lg">⚽</span>
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-yellow-100"
                            onClick={(e) => { e.stopPropagation(); handleEvent('yellow_card', lineup.player_id); }}
                            title="Cartão Amarelo"
                          >
                            <div className="w-4 h-5 bg-yellow-400 rounded-sm shadow-sm border border-yellow-500" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-red-100"
                            onClick={(e) => { e.stopPropagation(); handleEvent('red_card', lineup.player_id); }}
                            title="Cartão Vermelho"
                          >
                            <div className="w-4 h-5 bg-red-600 rounded-sm shadow-sm border border-red-700" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!isMobile && (
                  <>
                    <Separator className="my-3" />
                    <Button variant="outline" className="w-full" onClick={() => handleEvent('goal', null, true)}>
                      <span className="text-lg mr-2">⚽</span>
                      Golo do Adversário
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Substitutes */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base">Suplentes ({substitutes.length})</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5">
                {substitutes.map((lineup, idx) => {
                  const secs = playerSeconds(lineup.player_id);
                  const playTime = formatClock(secs);
                  return (
                    <div key={lineup.id} className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="min-w-[32px] justify-center text-xs shrink-0">
                          {lineup.player.number || '-'}
                        </Badge>
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{lineup.player.name}</span>
                          <span className={`text-[11px] flex items-center gap-1 ${idx === 0 ? 'text-accent font-semibold' : 'text-muted-foreground'}`}>
                            <Clock className="w-3 h-3" />
                            <span className="font-mono tabular-nums">{playTime}</span> jogados
                            {idx === 0 && ' · jogou menos'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {substitutes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sem suplentes disponíveis
                  </p>
                )}
              </CardContent>
            </Card>
            </>)}
          </div>
        )}

        {/* Interval Info - Mobile */}
        {phase === 'interval' && isMobile && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold">Intervalo</span>
                <span className="text-muted-foreground">
                  • {getPartLabel(currentPart, partsCount)}: {Math.floor((partElapsedSeconds[currentPart - 1] || 0) / 60)}'
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events Timeline */}
        {phase !== 'setup' && (
          <MatchEvents 
            events={events} 
            onDeleteEvent={handleDeleteEvent}
            canEdit={phase !== 'finished'}
          />
        )}

        {/* Conflict Alerts */}
        {phase !== 'setup' && consistencyIssues.length > 0 && (
          <ConflictAlertsPanel matchId={matchId} localIssues={consistencyIssues} />
        )}
      </div>

      {/* Mobile Bottom Action Bar */}
      {phase === 'playing' && isMobile && (
        <LiveActionBar
          onGoal={() => {
            setEventSheetDefaults({ type: 'goal' });
            setEventSheetOpen(true);
          }}
          onOpponentGoal={() => handleEvent('goal', null, true)}
          onSubstitution={() => setSubstitutionOpen(true)}
          onYellowCard={() => {
            setEventSheetDefaults({ type: 'yellow_card' });
            setEventSheetOpen(true);
          }}
          onRedCard={() => {
            setEventSheetDefaults({ type: 'red_card' });
            setEventSheetOpen(true);
          }}
          onEndPart={handleEndPart}
          onPauseResume={() => timer.isRunning ? timer.pauseTimer() : timer.startTimer()}
          isTimerRunning={timer.isRunning}
          isLastPart={currentPart >= partsCount}
          endPartLabel={getEndPartLabel(currentPart, partsCount)}
        />
      )}

      {/* Substitution Batch Dialog (mobile + desktop) */}
      <SubstitutionBatchDialog
        open={substitutionOpen}
        onOpenChange={setSubstitutionOpen}
        matchId={matchId}
        starters={starters}
        substitutes={substitutes}
        defaultMinute={getCurrentMinute()}
        editableMinute={false}
        maxOnField={sportRules.playersOnField}
        reentryAllowed={sportRules.reentryAllowed}
        events={events as any}
        sportType={matchSport}
        playerPlayTimes={playerPlayTimes}
        onCommit={handleSubstitutionBatch}
      />

      {/* Event Sheet (Mobile) */}
      <EventSheet
        open={eventSheetOpen}
        onOpenChange={setEventSheetOpen}
        players={lineups.map(l => l.player)}
        currentMinute={getCurrentMinute()}
        defaultEventType={eventSheetDefaults.type}
        defaultPlayerId={eventSheetDefaults.playerId}
        onSubmit={(evt) => {
          handleEvent(evt.event_type, evt.player_id, evt.is_opponent, evt.assist_player_id);
        }}
      />

      {/* Edit Lineup Dialog */}
      {editLineupOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 z-50 overflow-y-auto">
            <div className="flex min-h-full items-start justify-center p-4">
              <div className="w-full max-w-4xl bg-background rounded-lg border shadow-lg">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">Editar Equipa</h2>
                  <Button variant="ghost" size="sm" onClick={() => setEditLineupOpen(false)}>
                    Fechar
                  </Button>
                </div>
                <div className="p-4">
                  <LineupSelector
                    matchId={matchId}
                    teamId={teamId}
                    lineups={lineups}
                    onLineupsChange={fetchMatchData}
                    onStartMatch={() => setEditLineupOpen(false)}
                    isEditing
                    sportType={matchSport}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Config Modal */}
      <MatchConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        matchType={matchType}
        defaultPartDuration={categoryDuration}
        savedPartDuration={match?.part_duration_minutes}
        savedPartsCount={match?.parts_count}
        teamFormat={Array.isArray(team?.match_format?.parts) && team!.match_format!.parts!.length > 0 ? team!.match_format!.parts! : null}
        onConfirm={handleStartMatchWithConfig}
      />
    </div>
  );
}
