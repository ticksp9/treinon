import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { hasPendingOperations } from '@/lib/offlineStorage';

export function OfflineIndicator() {
  const { isOnline } = useOnlineStatus();
  const { syncPendingOperations } = useOfflineSync();
  const [pendingCount, setPendingCount] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      const hasPending = await hasPendingOperations();
      setPendingCount(hasPending);
    };
    
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await syncPendingOperations();
    setSyncing(false);
  };

  if (isOnline && !pendingCount) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 md:bottom-4">
      {pendingCount && isOnline && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="bg-background shadow-lg"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          Sincronizar
        </Button>
      )}
      
      <Badge 
        variant={isOnline ? "default" : "destructive"}
        className="shadow-lg flex items-center gap-1 py-1.5 px-3"
      >
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            Offline
          </>
        )}
      </Badge>
    </div>
  );
}
