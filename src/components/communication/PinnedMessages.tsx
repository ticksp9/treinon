import { usePinnedMessages, useUnpinMessage } from '@/hooks/useCommunicationPhase2';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pin, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';

interface PinnedMessagesProps {
  channelId: string;
  canManage: boolean;
}

export function PinnedMessages({ channelId, canManage }: PinnedMessagesProps) {
  const { data: pins = [], isLoading } = usePinnedMessages(channelId);
  const unpin = useUnpinMessage();

  if (isLoading || pins.length === 0) return null;

  return (
    <div className="border-b bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Pin className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium text-primary">Mensagens fixadas ({pins.length})</span>
      </div>
      <div className="space-y-1">
        {pins.slice(0, 3).map((pin) => (
          <div key={pin.id} className="flex items-center gap-2 text-xs">
            <p className="flex-1 text-muted-foreground truncate">
              {pin.communication_messages?.content || '...'}
            </p>
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() =>
                  unpin.mutate(
                    { channelId, messageId: pin.message_id },
                    { onSuccess: () => toast.success('Mensagem desafixada') }
                  )
                }
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
