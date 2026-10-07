import { useState, useMemo } from 'react';
import {
  useAnnouncements,
  useAnnouncementReads,
  useMarkAnnouncementRead,
  CommunicationAnnouncement,
} from '@/hooks/useCommunication';
import { useSenderProfiles } from '@/hooks/useCommunicationPremium';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, CheckCircle2, Eye, Clock, AlertTriangle, Loader2, Shield, Users, Mail, MessageCircle } from 'lucide-react';
import { announcementText, openWhatsApp, sendNotice, toastNotice } from '@/lib/notice';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface AnnouncementsListProps {
  clubId: string | null;
  userId?: string | null;
}

const priorityConfig = {
  important: { label: 'Importante', icon: AlertTriangle, variant: 'destructive' as const, className: 'border-destructive/30 bg-destructive/5' },
  normal: { label: 'Normal', icon: Megaphone, variant: 'secondary' as const, className: '' },
};

const targetLabels: Record<string, { label: string; icon: typeof Users }> = {
  channel: { label: 'Grupo', icon: Users },
  team: { label: 'Equipa', icon: Users },
  age_group: { label: 'Escalão', icon: Users },
  role: { label: 'Função', icon: Shield },
};

export function AnnouncementsList({ clubId, userId }: AnnouncementsListProps) {
  const { user } = useAuth();
  const { data: announcements = [], isLoading } = useAnnouncements(clubId, userId ?? (!clubId ? user?.id : null));
  const markRead = useMarkAnnouncementRead();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emailing, setEmailing] = useState<string | null>(null);
  const emailAgain = async (id: string) => {
    setEmailing(id);
    toastNotice(await sendNotice({ kind: 'announcement', announcement_id: id }));
    setEmailing(null);
  };

  const senderIds = useMemo(() => announcements.map(a => a.created_by), [announcements]);
  const { data: senderNames } = useSenderProfiles(senderIds);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Megaphone className="h-8 w-8 opacity-30" />
        </div>
        <p className="text-sm font-medium">Nenhum anúncio</p>
        <p className="text-xs mt-1 text-muted-foreground/70">Os anúncios do clube e da equipa aparecerão aqui</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="max-h-[70vh] md:max-h-none">
        <div className="space-y-3">
          {announcements.map((a) => {
            const priority = priorityConfig[a.priority as keyof typeof priorityConfig] || priorityConfig.normal;
            const PriorityIcon = priority.icon;
            const target = targetLabels[a.target_type] || targetLabels.channel;
            const senderName = senderNames?.get(a.created_by);

            return (
              <Card
                key={a.id}
                className={`cursor-pointer transition-all hover:shadow-md ${priority.className}`}
                onClick={() => {
                  setSelectedId(a.id);
                  markRead.mutate(a.id);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Priority indicator */}
                    <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${
                      a.priority === 'important' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                    }`}>
                      <PriorityIcon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm truncate">{a.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.content}</p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          {a.created_by === user?.id && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Partilhar no WhatsApp" title="Partilhar no WhatsApp"
                                onClick={(e) => { e.stopPropagation(); openWhatsApp(announcementText(a)); }}>
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              {a.channel_id && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Enviar por email" title="Enviar (de novo) por email" disabled={emailing === a.id}
                                  onClick={(e) => { e.stopPropagation(); emailAgain(a.id); }}>
                                  {emailing === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                </Button>
                              )}
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {senderName && (
                          <span className="text-xs text-muted-foreground">{senderName}</span>
                        )}
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: pt })}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {target.label}
                        </Badge>
                        {a.priority === 'important' && (
                          <Badge variant="destructive" className="text-[10px] h-5">
                            Importante
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <AnnouncementDetailDialog
        announcement={announcements.find((a) => a.id === selectedId) || null}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        senderNames={senderNames}
      />
    </>
  );
}

function AnnouncementDetailDialog({
  announcement,
  open,
  onClose,
  senderNames,
}: {
  announcement: CommunicationAnnouncement | null;
  open: boolean;
  onClose: () => void;
  senderNames?: Map<string, string>;
}) {
  const { data: reads = [] } = useAnnouncementReads(announcement?.id || null);
  const readSenderIds = useMemo(() => reads.map(r => r.user_id), [reads]);
  const { data: readNames } = useSenderProfiles(readSenderIds);

  if (!announcement) return null;

  const senderName = senderNames?.get(announcement.created_by);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {announcement.priority === 'important' && (
              <div className="shrink-0 h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base">{announcement.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {senderName && (
                  <span className="text-xs text-muted-foreground">{senderName}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(announcement.created_at), "d MMM yyyy, HH:mm", { locale: pt })}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{announcement.content}</p>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Confirmações de leitura ({reads.length})
            </h4>
            {reads.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma leitura confirmada ainda</p>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-1.5">
                  {reads.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                      <span className="font-medium">
                        {readNames?.get(r.user_id) || r.user_id.slice(0, 8) + '...'}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(r.read_at), 'dd/MM HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
