import { useMemo, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useAccessContext } from '@/hooks/useAccessContext';
import {
  canCreateAnnouncement, canViewAnalytics, canManageInvites,
  canManageAutomations, canManageTemplates, canCreateChannel,
  canCreateAttendanceRequest, hasOperationalAccess,
} from '@/lib/communication-access-service';
import { useChannels } from '@/hooks/useCommunication';
import {
  useUnreadCounts, useChannelPreviews, useSenderProfiles,
  useRealtimeMessages, useRealtimeAnnouncements,
  useRealtimeNotifications, useRealtimeMemberStates,
  useUnreadSummary, useUnreadNotificationCount,
  useNotificationsFeed, useMarkNotificationRead,
} from '@/hooks/useCommunicationPremium';
import { ChannelList } from '@/components/communication/ChannelList';
import { ChatView } from '@/components/communication/ChatView';
import { AnnouncementsList } from '@/components/communication/AnnouncementsList';
import { RemindersList } from '@/components/communication/RemindersList';
import { AttendanceTab } from '@/components/communication/AttendanceTab';
import { TemplatesTab } from '@/components/communication/TemplatesTab';
import { AutomationsTab } from '@/components/communication/AutomationsTab';
import { EngagementAnalytics } from '@/components/communication/EngagementAnalytics';
import { CreateChannelDialog } from '@/components/communication/CreateChannelDialog';
import { CreateAnnouncementDialog } from '@/components/communication/CreateAnnouncementDialog';
import { InviteFromCommunication } from '@/components/communication/InviteFromCommunication';
import { InvitesManagementTab } from '@/components/communication/InvitesManagementTab';
import {
  MessageSquare, Megaphone, Bell, Plus, Loader2,
  ClipboardCheck, FileText, Zap, BarChart3,
  UserPlus, Send, Users, ShieldCheck, Inbox,
  BellRing, X, Check,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function Communication() {
  const { user } = useAuth();
  const { ctx, loading: ctxLoading } = useAccessContext();
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [inviteType, setInviteType] = useState<'guardian' | 'player' | 'coach' | 'assistant_coach' | 'staff' | null>(null);

  const clubId = ctx?.clubId ?? null;
  const isIndividualMode = !clubId && ctx?.profileType === 'individual_coach';
  const coachUserId = isIndividualMode ? user?.id || null : null;

  // Channel loading - membership-based
  const effectiveClubId = (ctx?.isGuardian || ctx?.isPlayer) ? null : clubId;
  const effectiveUserId = (ctx?.isGuardian || ctx?.isPlayer)
    ? user?.id || null
    : coachUserId || (ctx?.isCoach && !isIndividualMode ? user?.id : null);

  const { data: channels = [], isLoading: channelsLoading } = useChannels(effectiveClubId, effectiveUserId);
  const channelIds = useMemo(() => channels.map(c => c.id), [channels]);

  // Premium features
  const { data: unreadCounts = [] } = useUnreadCounts(channelIds);
  const { data: previews } = useChannelPreviews(channelIds);
  const previewSenderIds = useMemo(() => {
    if (!previews) return [];
    return Array.from(previews.values()).map(p => p.sender_id);
  }, [previews]);
  const { data: senderNames } = useSenderProfiles(previewSenderIds);

  // Notifications
  const { data: notifCount = 0 } = useUnreadNotificationCount();
  const { data: notifications = [] } = useNotificationsFeed(15);
  const markNotifRead = useMarkNotificationRead();

  // Realtime
  useRealtimeMessages(channelIds);
  useRealtimeAnnouncements(clubId);
  useRealtimeNotifications();
  useRealtimeMemberStates();

  const summary = useUnreadSummary(channelIds);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || null;

  const handleChannelSelect = useCallback((id: string) => {
    setSelectedChannelId(id);
  }, []);

  if (ctxLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const canManage = ctx ? hasOperationalAccess(ctx) : false;
  const showCreateChannelBtn = ctx ? canCreateChannel(ctx) : false;
  const showAnalytics = ctx ? canViewAnalytics(ctx) : false;
  const showInvites = ctx ? canManageInvites(ctx) : false;
  const showAutomations = ctx ? canManageAutomations(ctx) : false;
  const showAnnounceBtn = ctx ? canCreateAnnouncement(ctx) : false;
  const showTemplates = ctx ? canManageTemplates(ctx) : false;
  const showAttendanceCreate = ctx ? canCreateAttendanceRequest(ctx) : false;

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Comunicação</h1>
                {summary.total > 0 && (
                  <Badge className="text-xs">{summary.total} nova{summary.total > 1 ? 's' : ''}</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {canManage
                  ? 'Gestão de grupos, anúncios, convites e presenças'
                  : 'Mensagens, anúncios e presenças da equipa'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Notification bell */}
            <div className="relative">
              <Button
                size="icon"
                variant={showNotifications ? 'default' : 'ghost'}
                className="h-9 w-9 rounded-lg relative"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <BellRing className="h-4 w-4" />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </Button>

              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-11 z-50 w-80 bg-card border rounded-xl shadow-lg">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold">Notificações</h3>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowNotifications(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <ScrollArea className="max-h-80">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">Sem notificações</p>
                      </div>
                    ) : (
                      <div className="p-1">
                        {notifications.map(n => (
                          <button
                            key={n.id}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                              n.is_read ? 'hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'
                            }`}
                            onClick={() => {
                              if (!n.is_read) markNotifRead.mutate(n.id);
                              if (n.channel_id) {
                                setSelectedChannelId(n.channel_id);
                                setActiveTab('chat');
                                setShowNotifications(false);
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                                  {n.title}
                                </p>
                                {n.body && <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>}
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
                                </p>
                              </div>
                              {n.priority_level === 'urgent' && (
                                <Badge variant="destructive" className="text-[9px] shrink-0">Urgente</Badge>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>

            {showInvites && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <UserPlus className="h-4 w-4 mr-1" /> Convidar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setInviteType('guardian')}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> Encarregado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteType('player')}>
                    <Users className="h-4 w-4 mr-2" /> Atleta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteType('coach')}>
                    <UserPlus className="h-4 w-4 mr-2" /> Treinador
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteType('assistant_coach')}>
                    <UserPlus className="h-4 w-4 mr-2" /> Treinador Adjunto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteType('staff')}>
                    <UserPlus className="h-4 w-4 mr-2" /> Staff
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showCreateChannelBtn && (
              <Button size="sm" onClick={() => setShowCreateChannel(true)}>
                <Plus className="h-4 w-4 mr-1" /> Criar Grupo
              </Button>
            )}
            {showAnnounceBtn && (
              <Button size="sm" variant="outline" onClick={() => setShowCreateAnnouncement(true)}>
                <Megaphone className="h-4 w-4 mr-1" /> Novo Anúncio
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="chat" className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Conversas</span>
              {summary.totalMessages > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                  {summary.totalMessages > 99 ? '99+' : summary.totalMessages}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-1.5">
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">Anúncios</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Presenças</span>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex items-center gap-1.5">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Lembretes</span>
            </TabsTrigger>
            {showInvites && (
              <TabsTrigger value="invites" className="flex items-center gap-1.5">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Convites</span>
              </TabsTrigger>
            )}
            {showTemplates && (
              <TabsTrigger value="templates" className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Modelos</span>
              </TabsTrigger>
            )}
            {showAutomations && (
              <TabsTrigger value="automations" className="flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Automações</span>
              </TabsTrigger>
            )}
            {showAnalytics && (
              <TabsTrigger value="analytics" className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="chat">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-0 min-h-[600px] border rounded-lg overflow-hidden bg-card">
              {/* Channel sidebar */}
              <div className="md:col-span-4 border-r">
                <div className="px-4 py-3 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground">Canais</h2>
                    {showCreateChannelBtn && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreateChannel(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <ChannelList
                  channels={channels}
                  selectedId={selectedChannelId}
                  onSelect={handleChannelSelect}
                  unreadCounts={unreadCounts}
                  previews={previews}
                  senderNames={senderNames}
                  loading={channelsLoading}
                />
              </div>

              {/* Chat area */}
              <div className="md:col-span-8 flex flex-col">
                {selectedChannel ? (
                  <ChatView
                    channelId={selectedChannel.id}
                    channelName={selectedChannel.name}
                    channelType={selectedChannel.channel_type}
                    channelDescription={selectedChannel.description}
                    canManage={!!canManage}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">Selecione um canal</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">Escolha um canal à esquerda para iniciar</p>
                    {showCreateChannelBtn && channels.length === 0 && (
                      <Button size="sm" variant="link" onClick={() => setShowCreateChannel(true)} className="mt-3">
                        <Plus className="h-3 w-3 mr-1" /> Criar primeiro grupo
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="announcements">
            <AnnouncementsList clubId={clubId} userId={coachUserId} />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceTab clubId={clubId} userId={coachUserId} canManage={!!showAttendanceCreate} />
          </TabsContent>

          <TabsContent value="reminders">
            <RemindersList clubId={clubId} userId={coachUserId} channels={channels} />
          </TabsContent>

          {showInvites && (
            <TabsContent value="invites">
              <InvitesManagementTab />
            </TabsContent>
          )}

          {showTemplates && (
            <TabsContent value="templates">
              <TemplatesTab clubId={clubId} userId={coachUserId} />
            </TabsContent>
          )}

          {showAutomations && (
            <TabsContent value="automations">
              <AutomationsTab clubId={clubId} userId={coachUserId} />
            </TabsContent>
          )}

          {showAnalytics && (
            <TabsContent value="analytics">
              <EngagementAnalytics clubId={clubId} userId={coachUserId} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateChannelDialog
        clubId={clubId}
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        isCoordinator={ctx?.isCoordinator || ctx?.isClubAdmin || false}
      />
      <CreateAnnouncementDialog
        clubId={clubId}
        channels={channels}
        open={showCreateAnnouncement}
        onClose={() => setShowCreateAnnouncement(false)}
      />
      {inviteType && (
        <InviteFromCommunication
          inviteType={inviteType}
          open={!!inviteType}
          onClose={() => setInviteType(null)}
        />
      )}
    </AppLayout>
  );
}
