import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { 
  getPendingOperations, 
  removePendingOperation,
  cacheData,
  getCachedData
} from '@/lib/offlineStorage';
import { toast } from 'sonner';

export function useOfflineSync() {
  const { isOnline } = useOnlineStatus();
  const queryClient = useQueryClient();
  const syncInProgress = useRef(false);

  // Sync pending operations when online
  const syncPendingOperations = useCallback(async () => {
    if (syncInProgress.current || !isOnline) return;
    
    syncInProgress.current = true;
    
    try {
      const pendingOps = await getPendingOperations();
      
      if (pendingOps.length === 0) {
        syncInProgress.current = false;
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const op of pendingOps) {
        try {
          if (op.operation === 'insert') {
            const { error } = await (supabase as any)
              .from(op.table)
              .insert(op.data);
            if (error) throw error;
          } else if (op.operation === 'update') {
            const { id, ...updateData } = op.data;
            const { error } = await (supabase as any)
              .from(op.table)
              .update(updateData)
              .eq('id', id);
            if (error) throw error;
          } else if (op.operation === 'delete') {
            const { error } = await (supabase as any)
              .from(op.table)
              .delete()
              .eq('id', op.data.id);
            if (error) throw error;
          }

          await removePendingOperation(op.id);
          successCount++;
        } catch (error) {
          console.error('Error syncing operation:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} operação(ões) sincronizada(s) com sucesso!`);
        // Invalidate all queries to refresh data
        queryClient.invalidateQueries();
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} operação(ões) falharam. Tentaremos novamente mais tarde.`);
      }
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      syncInProgress.current = false;
    }
  }, [isOnline, queryClient]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncPendingOperations();
    }
  }, [isOnline, syncPendingOperations]);

  // Cache query data for offline use
  const cacheQueryData = useCallback(async (key: string, data: unknown) => {
    await cacheData(key, data);
  }, []);

  // Get cached data when offline
  const getOfflineData = useCallback(async function<T>(key: string): Promise<T | null> {
    return getCachedData<T>(key);
  }, []);

  return {
    isOnline,
    syncPendingOperations,
    cacheQueryData,
    getOfflineData
  };
}
