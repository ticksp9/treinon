import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Represents a time interval when a player was on the field.
 * startTime is in game minutes (total elapsed), endTime is null if still on field.
 */
export interface PresenceInterval {
  startTime: number; // Game minute when player entered
  endTime: number | null; // Game minute when player left (null = still on field)
}

export interface PlayerPresenceMap {
  [playerId: string]: PresenceInterval[];
}

interface UsePlayerPresenceIntervalsProps {
  starterIds: string[];
  onFieldIds: string[];
  currentGameMinutes: number; // Total elapsed game minutes
  isPlaying: boolean;
}

/**
 * Hook to manage player presence intervals for accurate playing time tracking.
 * Uses interval-based tracking: each interval has a start and end time.
 */
export function usePlayerPresenceIntervals({
  starterIds,
  onFieldIds,
  currentGameMinutes,
  isPlaying,
}: UsePlayerPresenceIntervalsProps) {
  const [intervals, setIntervals] = useState<PlayerPresenceMap>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize intervals when game starts (starters get interval from minute 0)
  const initializeIntervals = useCallback((initialStarterIds: string[], startMinute: number = 0) => {
    const initial: PlayerPresenceMap = {};
    initialStarterIds.forEach(playerId => {
      initial[playerId] = [{ startTime: startMinute, endTime: null }];
    });
    setIntervals(initial);
    setInitialized(true);
    console.log('[PlayerPresence] Initialized intervals:', initial);
    return initial;
  }, []);

  // Restore intervals from persisted state
  const restoreIntervals = useCallback((savedIntervals: PlayerPresenceMap) => {
    if (savedIntervals && Object.keys(savedIntervals).length > 0) {
      setIntervals(savedIntervals);
      setInitialized(true);
      console.log('[PlayerPresence] Restored intervals:', savedIntervals);
    }
  }, []);

  // Handle substitution: playerOut leaves, playerIn enters at current minute
  const handleSubstitution = useCallback((playerOutId: string, playerInId: string, minute: number) => {
    setIntervals(prev => {
      const updated = { ...prev };
      
      // Close interval for player going out
      if (updated[playerOutId]) {
        const playerOutIntervals = [...updated[playerOutId]];
        const lastInterval = playerOutIntervals[playerOutIntervals.length - 1];
        if (lastInterval && lastInterval.endTime === null) {
          playerOutIntervals[playerOutIntervals.length - 1] = {
            ...lastInterval,
            endTime: minute,
          };
        }
        updated[playerOutId] = playerOutIntervals;
      }
      
      // Open new interval for player coming in
      if (!updated[playerInId]) {
        updated[playerInId] = [];
      }
      updated[playerInId] = [...updated[playerInId], { startTime: minute, endTime: null }];
      
      console.log('[PlayerPresence] Substitution at minute', minute, ':', playerOutId, '→', playerInId);
      return updated;
    });
  }, []);

  // Apply several substitutions in a single state update so the batch is atomic.
  const handleSubstitutionBatch = useCallback(
    (pairs: Array<{ playerOutId: string; playerInId: string }>, minute: number) => {
      if (pairs.length === 0) return;
      setIntervals(prev => {
        const updated: PlayerPresenceMap = { ...prev };
        for (const { playerOutId, playerInId } of pairs) {
          if (updated[playerOutId]) {
            const outIntervals = [...updated[playerOutId]];
            const last = outIntervals[outIntervals.length - 1];
            if (last && last.endTime === null) {
              outIntervals[outIntervals.length - 1] = { ...last, endTime: minute };
            }
            updated[playerOutId] = outIntervals;
          }
          if (!updated[playerInId]) updated[playerInId] = [];
          updated[playerInId] = [
            ...updated[playerInId],
            { startTime: minute, endTime: null },
          ];
        }
        console.log('[PlayerPresence] Batch substitution at minute', minute, pairs);
        return updated;
      });
    },
    [],
  );

  // Calculate playing minutes for each player
  const calculatePlayingMinutes = useCallback((currentMinute: number): Map<string, number> => {
    const result = new Map<string, number>();
    
    Object.entries(intervals).forEach(([playerId, playerIntervals]) => {
      let totalMinutes = 0;
      
      playerIntervals.forEach(interval => {
        const start = interval.startTime;
        const end = interval.endTime ?? currentMinute; // If still on field, use current time
        totalMinutes += Math.max(0, end - start);
      });
      
      result.set(playerId, Math.floor(totalMinutes));
    });
    
    return result;
  }, [intervals]);

  // Get current playing minutes (updates with currentGameMinutes)
  const playerPlayingMinutes = useMemo(() => {
    return calculatePlayingMinutes(currentGameMinutes);
  }, [calculatePlayingMinutes, currentGameMinutes]);

  // Get raw intervals for persistence
  const getIntervalsForPersistence = useCallback(() => {
    return intervals;
  }, [intervals]);

  // Handle starting a new part - force part boundaries, then open the snapshot players
  const handleStartPart = useCallback((onFieldPlayerIds: string[], partStartMinute: number, force: boolean = true) => {
    setIntervals(prev => {
      const updated = { ...prev };
      const snapshot = new Set(onFieldPlayerIds);

      if (force) {
        Object.keys(updated).forEach(playerId => {
          const playerIntervals = [...updated[playerId]];
          const lastInterval = playerIntervals[playerIntervals.length - 1];
          if (lastInterval && lastInterval.endTime === null && !snapshot.has(playerId)) {
            playerIntervals[playerIntervals.length - 1] = {
              ...lastInterval,
              endTime: partStartMinute,
            };
            updated[playerId] = playerIntervals;
          }
        });
      }
      
      onFieldPlayerIds.forEach(playerId => {
        if (!updated[playerId]) {
          updated[playerId] = [];
        }
        
        // Check if player already has an open interval
        const playerIntervals = updated[playerId];
        const hasOpenInterval = playerIntervals.some(i => i.endTime === null);
        
        if (!hasOpenInterval) {
          // Open new interval for this part
          updated[playerId] = [...playerIntervals, { startTime: partStartMinute, endTime: null }];
        }
      });
      
      console.log('[PlayerPresence] Started part at minute', partStartMinute, ':', updated);
      return updated;
    });
  }, []);

  // Handle ending a part - close all open intervals at current minute
  const handleEndPart = useCallback((endMinute: number) => {
    setIntervals(prev => {
      const updated = { ...prev };
      
      Object.keys(updated).forEach(playerId => {
        const playerIntervals = [...updated[playerId]];
        const lastInterval = playerIntervals[playerIntervals.length - 1];
        
        if (lastInterval && lastInterval.endTime === null) {
          playerIntervals[playerIntervals.length - 1] = {
            ...lastInterval,
            endTime: endMinute,
          };
          updated[playerId] = playerIntervals;
        }
      });
      
      console.log('[PlayerPresence] Ended part at minute', endMinute, ':', updated);
      return updated;
    });
  }, []);

  // Clear all intervals (for new game)
  const clearIntervals = useCallback(() => {
    setIntervals({});
    setInitialized(false);
  }, []);

  return {
    intervals,
    playerPlayingMinutes,
    initialized,
    initializeIntervals,
    restoreIntervals,
    handleSubstitution,
    handleSubstitutionBatch,
    handleStartPart,
    handleEndPart,
    getIntervalsForPersistence,
    clearIntervals,
  };
}
