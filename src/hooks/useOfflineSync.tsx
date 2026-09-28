import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { 
  getPendingOperations, 
  removePendingOperation,
  updatePendingOperation,
  isNetworkError,
  PENDING_OP_EVENT,
  cacheData,
  getCachedData
} from '@/lib/offlineStorage';

const MAX_ATTEMPTS = 8;
const RETRY_INTERVAL_MS = 30_000;
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
          } else if (op.operation === 'rpc') {
            const { error } = await (supabase as any).rpc(op.table, op.data);
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
          if (isNetworkError(error)) {
            // Still no real connection: keep order and try again later.
            break;
          }
          const attempts = (op.attempts ?? 0) + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await removePendingOperation(op.id);
            toast.error('Um registo offline não pôde ser gravado no servidor e foi descartado. Verifique o jogo/treino.');
          } else {
            await updatePendingOperation({ ...op, attempts });
          }
          errorCount++;
          // Preserve ordering: later operations may depend on this one.
          break;
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

  // Weak signal on the pitch: navigator.onLine can stay "true" while requests fail,
  // so also retry periodically and whenever something new is queued.
  useEffect(() => {
    const trigger = () => { if (navigator.onLine) syncPendingOperations(); };
    const timer = setInterval(trigger, RETRY_INTERVAL_MS);
    window.addEventListener(PENDING_OP_EVENT, trigger);
    document.addEventListener('visibilitychange', trigger);
    return () => {
      clearInterval(timer);
      window.removeEventListener(PENDING_OP_EVENT, trigger);
      document.removeEventListener('visibilitychange', trigger);
    };
  }, [syncPendingOperations]);

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
