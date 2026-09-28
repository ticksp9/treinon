import { useMemo } from 'react';
import { CommunicationChannel } from '@/hooks/useCommunication';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Megaphone, Users, Shield, Star, Lock, Shuffle, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { UnreadCount } from '@/hooks/useCommunicationPremium';

interface ChannelListProps {
  channels: CommunicationChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  unreadCounts?: UnreadCount[];
  previews?: Map<string, { content: string; sender_id: string; created_at: string }>;
  senderNames?: Map<string, string>;
  loading?: boolean;
}

const typeIcons: Record<string, typeof MessageSquare> = {
  official: Shield,
  official_club: Shield,
  official_team: Shield,
  team: Users,
  age_group: Star,
  role_based: Megaphone,
  restricted_internal: Lock,
  coaches_internal: Lock,
  staff_internal: Lock,
  coordination_internal: Lock,
  mixed_controlled: Shuffle,
  parents_team: Users,
  players_team: Users,
  custom: Hash,
};

const typeLabels: Record<string, string> = {
  official: 'Oficial',
  official_club: 'Oficial Clube',
  official_team: 'Oficial Equipa',
  team: 'Equipa',
  age_group: 'Escalão',
  role_based: 'Função',
  restricted_internal: 'Interno',
  coaches_internal: 'Treinadores',
  staff_internal: 'Staff',
  coordination_internal: 'Coordenação',
  mixed_controlled: 'Misto',
  parents_team: 'Pais',
  players_team: 'Atletas',
  custom: 'Personalizado',
};

const typePriority: Record<string, number> = {
  official: 0,
  official_club: 0,
  official_team: 1,
  restricted_internal: 2,
  coaches_internal: 2,
  staff_internal: 2,
  coordination_internal: 2,
  team: 3,
  age_group: 4,
  parents_team: 5,
  players_team: 5,
  role_based: 6,
  mixed_controlled: 7,
  custom: 8,
};

export function ChannelList({ channels, selectedId, onSelect, unreadCounts = [], previews, senderNames, loading }: ChannelListProps) {
  const unreadMap = useMemo(() => {
    const map = new Map<string, number>();
    unreadCounts.forEach(u => map.set(u.channelId, u.count));
    return map;
  }, [unreadCounts]);

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const aPri = typePriority[a.channel_type] ?? 10;
      const bPri = typePriority[b.channel_type] ?? 10;
      if (aPri !== bPri) return aPri - bPri;

      const aUnread = unreadMap.get(a.id) || 0;
      const bUnread = unreadMap.get(b.id) || 0;
      if (aUnread !== bUnread) return bUnread - aUnread;

      // Sort by last_message_at if available
      const aTime = (a as any).last_message_at;
      const bTime = (b as any).last_message_at;
      if (aTime && bTime) return new Date(bTime).getTime() - new Date(aTime).getTime();
      if (aTime) return -1;
      if (bTime) return 1;

      const aPreview = previews?.get(a.id);
      const bPreview = previews?.get(b.id);
      if (aPreview && bPreview) return new Date(bPreview.created_at).getTime() - new Date(aPreview.created_at).getTime();
      if (aPreview) return -1;
      if (bPreview) return 1;

      return 0;
    });
  }, [channels, unreadMap, previews]);

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Sem canais</p>
        <p className="text-xs mt-1">Crie um grupo para começar a comunicar</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-320px)]">
      <div className="p-1.5 space-y-0.5">
        {sortedChannels.map((ch) => {
          const Icon = typeIcons[ch.channel_type] || MessageSquare;
          const unread = unreadMap.get(ch.id) || 0;
          const preview = previews?.get(ch.id);
          const isSelected = selectedId === ch.id;
          const isOfficial = ch.channel_type === 'official' || ch.channel_type === 'official_club' || ch.channel_type === 'official_team';
          const chAny = ch as any;
          const isOfficialFlag = chAny.is_official === true;
          const priorityLevel = chAny.priority_level;

          return (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                isSelected
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : unread > 0
                    ? 'hover:bg-muted/80 bg-muted/40'
                    : 'hover:bg-muted/50 text-foreground',
                (isOfficial || isOfficialFlag) && !isSelected && 'border-l-2 border-primary/40'
              )}
            >
              {/* Icon */}
              <div className={cn(
                'shrink-0 h-9 w-9 rounded-lg flex items-center justify-center',
                isSelected ? 'bg-primary text-primary-foreground' :
                (isOfficial || isOfficialFlag) ? 'bg-primary/10 text-primary' :
                'bg-muted text-muted-foreground'
              )}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className={cn(
                      'text-sm truncate',
                      unread > 0 ? 'font-semibold' : 'font-medium'
                    )}>
                      {ch.name}
                    </p>
                    {priorityLevel === 'urgent' && (
                      <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {preview && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(preview.created_at), { addSuffix: false, locale: pt })}
                      </span>
                    )}
                    {unread > 0 && (
                      <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
                {preview ? (
                  <p className={cn(
                    'text-xs truncate mt-0.5',
                    unread > 0 ? 'text-foreground/70' : 'text-muted-foreground'
                  )}>
                    {senderNames?.get(preview.sender_id)
                      ? `${senderNames.get(preview.sender_id)}: `
                      : ''
                    }
                    {preview.content}
                  </p>
                ) : ch.description ? (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{ch.description}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/50 truncate mt-0.5">Sem mensagens</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
