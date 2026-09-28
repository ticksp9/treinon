import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageLoading } from '@/components/ui/page-states';
import { Home, Trophy, Calendar, BookOpen, MessageSquare, CheckCircle2, Clock, MapPin, FileText, Eye, Megaphone, Bell, BellRing } from 'lucide-react';
import { useAnnouncements, useMarkAnnouncementRead } from '@/hooks/useCommunication';
import { useNotificationsFeed, useUnreadNotificationCount, useMarkNotificationRead, useRealtimeNotifications } from '@/hooks/useCommunicationPremium';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';

function usePlayerData(playerId: string | null) {
  return useQuery({
    queryKey: ['player-portal-data', playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const { data, error } = await supabase
        .from('players')
        .select('*, teams(id, name, category)')
        .eq('id', playerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!playerId,
  });
}

function usePlayerMatches(teamId: string | null) {
  return useQuery({
    queryKey: ['player-matches', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('team_id', teamId)
        .neq('is_deleted', true)
        .order('match_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!teamId,
  });
}

function usePlayerCallups(playerId: string | null) {
  return useQuery({
    queryKey: ['player-callups', playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from('match_lineups')
        .select('*, matches(*)')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });
}

function usePlayerTrainings(teamId: string | null) {
  return useQuery({
    queryKey: ['player-trainings', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('coach_trainings')
        .select('*')
        .eq('team_id', teamId)
        .order('training_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!teamId,
  });
}

function usePlayerTechnicalContent(_playerId: string | null) {
  return useQuery({
    queryKey: ['player-technical-content', _playerId],
    queryFn: async () => {
      return [] as any[];
    },
    enabled: !!_playerId,
  });
}

function useMarkContentRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_data: { contentId: string; playerId: string }) => {
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-technical-content'] });
      toast.success('Conteúdo marcado como lido');
    },
  });
}

function PlayerCommunicationTab({ playerId, teamId }: { playerId: string | null; teamId: string | null }) {
  const { data: notifications = [] } = useNotificationsFeed(10);
  const { data: notifCount = 0 } = useUnreadNotificationCount();
  const markAnnouncementRead = useMarkAnnouncementRead();
  const markNotifRead = useMarkNotificationRead();

  const { data: teamChannels = [] } = useQuery({
    queryKey: ['player-team-channels', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data } = await supabase
        .from('communication_channels')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!teamId,
  });

  const channelIds = useMemo(() => teamChannels.map((c: any) => c.id), [teamChannels]);

  const { data: announcements = [] } = useQuery({
    queryKey: ['player-announcements', channelIds],
    queryFn: async () => {
      if (channelIds.length === 0) return [];
      const { data } = await supabase
        .from('communication_announcements')
        .select('*')
        .in('channel_id', channelIds)
        .order('created_at', { ascending: false })
        .limit(15);
      return data || [];
    },
    enabled: channelIds.length > 0,
  });

  const unreadNotifs = notifications.filter(n => !n.is_read);

  return (
    <div className="space-y-4">
      {/* Notifications section */}
      {unreadNotifs.length > 0 && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BellRing className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{notifCount} notificação(ões) por ler</span>
            </div>
            <div className="space-y-1.5">
              {unreadNotifs.slice(0, 5).map(n => (
                <div key={n.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => markNotifRead.mutate(n.id)}>
                    <CheckCircle2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Announcements */}
      <h3 className="text-sm font-semibold text-muted-foreground">Anúncios da Equipa</h3>
      {announcements.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title="Sem anúncios" description="Não há anúncios para a tua equipa." />
      ) : (
        <div className="space-y-3">
          {announcements.map((a: any) => (
            <Card key={a.id} className={a.priority === 'urgent' ? 'border-destructive/30' : a.priority === 'important' ? 'border-primary/30' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{a.title}</span>
                      {a.priority === 'urgent' && <Badge variant="destructive" className="text-[10px]">Urgente</Badge>}
                      {a.priority === 'important' && <Badge className="text-[10px]">Importante</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: pt })}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => markAnnouncementRead.mutate(a.id)}>
                    <Eye className="h-3 w-3 mr-1" /> Lido
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlayerPortal() {
  const { user } = useAuth();
  const { playerId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('inicio');

  const { data: playerData, isLoading: playerLoading } = usePlayerData(playerId);
  const teamId = playerData?.team_id || null;
  const { data: matches = [] } = usePlayerMatches(teamId);
  const { data: callups = [] } = usePlayerCallups(playerId);
  const { data: trainings = [] } = usePlayerTrainings(teamId);
  const { data: technicalContent = [] } = usePlayerTechnicalContent(playerId);
  const markRead = useMarkContentRead();

  // Premium communication
  const { data: notifCount = 0 } = useUnreadNotificationCount();
  useRealtimeNotifications();

  if (roleLoading || playerLoading) {
    return <AppLayout><div className="container py-8"><PageLoading message="A carregar portal do jogador..." /></div></AppLayout>;
  }

  if (!playerId || !playerData) {
    return (
      <AppLayout>
        <div className="container py-8">
          <EmptyState
            icon={<Trophy className="h-10 w-10" />}
            title="Portal do Jogador"
            description="Não foi encontrado um perfil de jogador associado à sua conta."
          />
        </div>
      </AppLayout>
    );
  }

  const now = new Date();
  const upcomingMatches = matches.filter(m => new Date(m.match_date) >= now && m.status !== 'completed');
  const completedMatches = matches.filter(m => m.status === 'completed').slice(0, 5);
  const upcomingTrainings = trainings.filter(t => t.training_date && new Date(t.training_date) >= now).slice(0, 5);
  const mandatoryUnread = technicalContent.filter((c: any) => c.is_mandatory_read);

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Portal do Jogador</h1>
              {notifCount > 0 && (
                <Badge className="text-xs">{notifCount} nova{notifCount > 1 ? 's' : ''}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {playerData.name} · {(playerData as any).teams?.name || 'Sem equipa'}
              {playerData.position && <Badge variant="outline" className="ml-2 text-xs">{playerData.position}</Badge>}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="inicio"><Home className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Início</span></TabsTrigger>
            <TabsTrigger value="jogos"><Trophy className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Jogos</span></TabsTrigger>
            <TabsTrigger value="treinos"><Calendar className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Treinos</span></TabsTrigger>
            <TabsTrigger value="comunicacao" className="flex items-center gap-1">
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">Comunicação</span>
              {notifCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                  {notifCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="conteudo"><BookOpen className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Conteúdo Técnico</span></TabsTrigger>
          </TabsList>

          {/* HOME */}
          <TabsContent value="inicio" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{upcomingMatches.length}</div>
                <p className="text-xs text-muted-foreground">Próximos Jogos</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{callups.length}</div>
                <p className="text-xs text-muted-foreground">Convocatórias</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{upcomingTrainings.length}</div>
                <p className="text-xs text-muted-foreground">Próximos Treinos</p>
              </CardContent></Card>
              <Card className={notifCount > 0 ? 'border-primary/30' : ''}><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{notifCount}</div>
                <p className="text-xs text-muted-foreground">Notificações</p>
              </CardContent></Card>
            </div>

            {/* Next match */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Próximo Jogo</CardTitle></CardHeader>
                <CardContent>
                  {upcomingMatches[0] ? (
                    <div className="space-y-1">
                      <p className="font-medium">{upcomingMatches[0].opponent_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(upcomingMatches[0].match_date), "d MMM yyyy, HH:mm", { locale: pt })}
                      </p>
                      {upcomingMatches[0].location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {upcomingMatches[0].location}</p>
                      )}
                      <Badge variant={upcomingMatches[0].is_home ? 'default' : 'secondary'} className="text-xs mt-1">
                        {upcomingMatches[0].is_home ? 'Casa' : 'Fora'}
                      </Badge>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Sem jogos agendados</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Próximo Treino</CardTitle></CardHeader>
                <CardContent>
                  {upcomingTrainings[0] ? (
                    <div className="space-y-1">
                      <p className="font-medium">{upcomingTrainings[0].name}</p>
                      {upcomingTrainings[0].training_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(upcomingTrainings[0].training_date), "d MMM yyyy, HH:mm", { locale: pt })}
                        </p>
                      )}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Sem treinos agendados</p>}
                </CardContent>
              </Card>
            </div>

            {mandatoryUnread.length > 0 && (
              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Conteúdo para rever</span>
                  </div>
                  {mandatoryUnread.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-muted/50 rounded mb-1">
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.content_type}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => {
                        if (playerId) markRead.mutate({ contentId: c.id, playerId });
                      }}>
                        <Eye className="h-3 w-3 mr-1" /> Marcar lido
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* GAMES */}
          <TabsContent value="jogos" className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Próximos Jogos</h3>
            {upcomingMatches.length === 0 ? (
              <EmptyState icon={<Trophy className="h-8 w-8" />} title="Sem jogos agendados" description="Não existem jogos futuros." />
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map((m: any) => (
                  <Card key={m.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={m.is_home ? 'default' : 'secondary'} className="text-xs">{m.is_home ? 'CASA' : 'FORA'}</Badge>
                            <span className="font-semibold text-sm">{m.opponent_name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(m.match_date), "d MMM yyyy, HH:mm", { locale: pt })}
                          </p>
                          {m.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {m.location}</p>}
                          {m.competition && <p className="text-xs text-muted-foreground mt-0.5">{m.competition}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs">{m.status === 'scheduled' ? 'Agendado' : m.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {completedMatches.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-muted-foreground mt-6">Resultados Recentes</h3>
                <div className="space-y-2">
                  {completedMatches.map((m: any) => (
                    <Card key={m.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">{m.opponent_name}</span>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(m.match_date), "d MMM", { locale: pt })}
                          </p>
                        </div>
                        <Badge variant={
                          (m.goals_for ?? 0) > (m.goals_against ?? 0) ? 'default' :
                          (m.goals_for ?? 0) < (m.goals_against ?? 0) ? 'destructive' : 'secondary'
                        }>
                          {m.goals_for ?? 0} - {m.goals_against ?? 0}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* TRAININGS */}
          <TabsContent value="treinos" className="space-y-4">
            {trainings.length === 0 ? (
              <EmptyState icon={<Calendar className="h-8 w-8" />} title="Sem treinos" description="Não há treinos registados." />
            ) : (
              <div className="space-y-3">
                {trainings.slice(0, 15).map((t: any) => (
                  <Card key={t.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{t.name}</p>
                          {t.training_date && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(t.training_date), "d MMM yyyy, HH:mm", { locale: pt })}
                            </p>
                          )}
                          {t.objectives && <p className="text-xs text-muted-foreground mt-1">{t.objectives}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs">{t.status || 'Planeado'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* COMMUNICATION */}
          <TabsContent value="comunicacao" className="space-y-4">
            <PlayerCommunicationTab playerId={playerId} teamId={teamId} />
          </TabsContent>

          {/* TECHNICAL CONTENT */}
          <TabsContent value="conteudo" className="space-y-4">
            {technicalContent.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-8 w-8" />} title="Sem conteúdo" description="Ainda não tens conteúdo técnico atribuído." />
            ) : (
              <div className="space-y-3">
                {technicalContent.map((c: any) => (
                  <Card key={c.id} className={c.is_mandatory_read ? 'border-primary/30' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{c.title}</span>
                            {c.is_mandatory_read && <Badge variant="default" className="text-xs">Obrigatório</Badge>}
                          </div>
                          <Badge variant="outline" className="text-xs mb-1">{
                            c.content_type === 'note' ? 'Nota' :
                            c.content_type === 'tactical_correction' ? 'Correção Tática' :
                            c.content_type === 'position_instruction' ? 'Instrução por Posição' :
                            c.content_type === 'play_instruction' ? 'Jogada/Situação' :
                            c.content_type
                          }</Badge>
                          {c.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.body}</p>}
                          {c.attachment_url && (
                            <a href={c.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1">
                              <FileText className="h-3 w-3" /> {c.attachment_name || 'Ver anexo'}
                            </a>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(c.created_at), "d MMM yyyy", { locale: pt })}
                          </p>
                        </div>
                        {c.is_mandatory_read && playerId && (
                          <Button size="sm" variant="outline" onClick={() => markRead.mutate({ contentId: c.id, playerId })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Lido
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
