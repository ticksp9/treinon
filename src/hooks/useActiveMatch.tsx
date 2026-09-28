import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

const ACTIVE_MATCH_KEY = 'tacticaflow_active_match_id';

/**
 * Hook to manage the "active match" for the current user.
 * Source of truth: localStorage (offline-first) + profiles.active_match_id (synced to backend).
 */
export function useActiveMatch() {
  const { user } = useAuth();
  const syncingRef = useRef(false);

  // Get active match ID from localStorage
  const getActiveMatchId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_MATCH_KEY);
  }, []);

  // Set active match ID in localStorage and sync to backend
  const setActiveMatchId = useCallback(async (matchId: string | null) => {
    if (typeof window === 'undefined') return;
    
    // Update localStorage immediately (offline-first)
    if (matchId) {
      localStorage.setItem(ACTIVE_MATCH_KEY, matchId);
    } else {
      localStorage.removeItem(ACTIVE_MATCH_KEY);
    }

    // Sync to backend if online and user is authenticated
    if (user && !syncingRef.current) {
      syncingRef.current = true;
      try {
        await supabase
          .from('profiles')
          .update({ active_match_id: matchId })
          .eq('id', user.id);
        
        console.log('[useActiveMatch] Synced active_match_id to backend:', matchId);
      } catch (error) {
        console.error('[useActiveMatch] Failed to sync active_match_id:', error);
      } finally {
        syncingRef.current = false;
      }
    }
  }, [user]);

  // Clear active match when game ends
  const clearActiveMatch = useCallback(async () => {
    await setActiveMatchId(null);
  }, [setActiveMatchId]);

  // Sync from backend on initial load (if localStorage is empty but backend has a value)
  useEffect(() => {
    const syncFromBackend = async () => {
      if (!user || syncingRef.current) return;
      
      const localValue = getActiveMatchId();
      
      // If local is empty, try to restore from backend
      if (!localValue) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('active_match_id')
            .eq('id', user.id)
            .maybeSingle();
          
          if (data?.active_match_id) {
            localStorage.setItem(ACTIVE_MATCH_KEY, data.active_match_id);
            console.log('[useActiveMatch] Restored active_match_id from backend:', data.active_match_id);
          }
        } catch (error) {
          console.error('[useActiveMatch] Failed to fetch active_match_id from backend:', error);
        }
      }
    };

    syncFromBackend();
  }, [user, getActiveMatchId]);

  return {
    getActiveMatchId,
    setActiveMatchId,
    clearActiveMatch,
  };
}
