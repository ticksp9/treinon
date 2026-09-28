import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Home, Calendar, Megaphone, ClipboardCheck, Shield, Bell, Users, Trophy, MapPin, Clock, CheckCircle2, XCircle, AlertTriangle, Euro, MessageSquare, BellRing, Eye, Inbox } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  useGuardianProfile,
  useGuardianAthletes,
  useGuardianUpcomingEvents,
  useGuardianAnnouncements,
  useGuardianCallups,
  useGuardianPendingConfirmations,
  useGuardianAttendanceRequests,
  useGuardianNotificationPrefs,
  useUpdateGuardianNotifPrefs,
  useRespondCallup,
} from '@/hooks/useCommunicationPhase3';
import { useRespondAttendance } from '@/hooks/useCommunicationPhase2';
import { useMarkAnnouncementRead } from '@/hooks/useCommunication';
import { useNotificationsFeed, useUnreadNotificationCount, useMarkNotificationRead, useRealtimeNotifications } from '@/hooks/useCommunicationPremium';
import { EmptyState, PageLoading } from '@/components/ui/page-states';
import { GuardianFinancialTab } from '@/components/billing/GuardianFinancialTab';

export default function GuardianPortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inicio');
  const [selectedAthleteIdx, setSelectedAthleteIdx] = useState(0);

  const { data: guardianProfile, isLoading: gpLoading } = useGuardianProfile();
  const { data: athleteLinks = [], isLoading: alLoading } = useGuardianAthletes(guardianProfile?.id || null);

  const playerIds = useMemo(() => athleteLinks.map((a: any) => a.player_id), [athleteLinks]);
  const teamIds = useMemo(() => {
    const ids = new Set<string>();
    athleteLinks.forEach((a: any) => {
      if (a.players?.team_id) ids.add(a.players.team_id);
    });
    return Array.from(ids);
  }, [athleteLinks]);

  const { data: upcomingEvents } = useGuardianUpcomingEvents(teamIds);
  const { data: announcements = [] } = useGuardianAnnouncements(teamIds);
  const { data: callups = [] } = useGuardianCallups(playerIds);
  const { data: pendingConfirmations = [] } = useGuardianPendingConfirmations(playerIds);
  const { data: attendanceReqs = [] } = useGuardianAttendanceRequests(teamIds);
  const { data: notifPrefs } = useGuardianNotificationPrefs(guardianProfile?.id || null);
  const updatePrefs = useUpdateGuardianNotifPrefs(guardianProfile?.id || null);
  const respondCallup = useRespondCallup();
  const respondAttendance = useRespondAttendance();
  const markRead = useMarkAnnouncementRead();

  // Premium communication integration
  const { data: notifications = [] } = useNotificationsFeed(15);
  const { data: notifCount = 0 } = useUnreadNotificationCount();
  const markNotifRead = useMarkNotificationRead();
  useRealtimeNotifications();

  if (gpLoading || alLoading) {
    return <AppLayout><div className="container py-8"><PageLoading message="A carregar portal..." /></div></AppLayout>;
  }

  if (!guardianProfile) {
    return (
      <AppLayout>
        <div className="container py-8">
          <EmptyState
            icon={<Shield className="h-10 w-10" />}
            title="Portal do Encarregado"
            description="Não foi encontrado um perfil de encarregado de educação associado à sua conta."
          />
        </div>
      </AppLayout>
    );
  }

  const selectedAthlete = athleteLinks[selectedAthleteIdx];
  const nextMatch = upcomingEvents?.matches?.[0];
  const nextTraining = upcomingEvents?.trainings?.[0];
  const totalPending = pendingConfirmations.length + attendanceReqs.length;
  const unreadAnnouncements = announcements.filter((a: any) => a.priority === 'important' || a.priority === 'urgent').length;

  const handleCallupResponse = (matchId: string, playerId: string, status: string) => {
    respondCallup.mutate({ matchId, playerId, status }, {
      onSuccess: () => toast.success(status === 'confirmed' ? 'Presença confirmada!' : 'Resposta registada'),
      onError: () => toast.error('Erro ao responder'),
    });
  };

  const handleAttendanceResponse = (requestId: string, response: string) => {
    respondAttendance.mutate({ requestId, response }, {
      onSuccess: () => toast.success('Resposta registada'),
      onError: () => toast.error('Erro ao responder'),
    });
  };

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Portal do Encarregado</h1>
                {(totalPending > 0 || notifCount > 0) && (
                  <Badge variant="destructive" className="text-xs">
                    {totalPending + notifCount} pendente{(totalPending + notifCount) > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                Bem-vindo(a), {guardianProfile.full_name}
              </p>
            </div>
          </div>
          {athleteLinks.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {athleteLinks.map((a: any, i: number) => (
                <Button
                  key={a.id}
                  variant={i === selectedAthleteIdx ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAthleteIdx(i)}
                >
                  <Users className="h-3 w-3 mr-1" />
                  {a.players?.name || 'Atleta'}
                </Button>
              ))}
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="inicio"><Home className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Início</span></TabsTrigger>
            <TabsTrigger value="convocatorias"><Trophy className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Convocatórias</span></TabsTrigger>
            <TabsTrigger value="confirmacoes" className="flex items-center gap-1">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Confirmações</span>
              {totalPending > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                  {totalPending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="anuncios" className="flex items-center gap-1">
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">Anúncios</span>
              {unreadAnnouncements > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                  {unreadAnnouncements}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-1">
              <BellRing className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
              {notifCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                  {notifCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="financeiro"><Euro className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Financeiro</span></TabsTrigger>
            <TabsTrigger value="agenda"><Calendar className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Agenda</span></TabsTrigger>
            <TabsTrigger value="preferencias"><Bell className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Preferências</span></TabsTrigger>
          </TabsList>

          {/* HOME TAB */}
          <TabsContent value="inicio" className="space-y-4">
            {/* Athletes overview */}
            {selectedAthlete && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {selectedAthlete.players?.name}
                  </CardTitle>
                  <CardDescription>
                    {(selectedAthlete.players as any)?.teams?.name || 'Sem equipa'} · {selectedAthlete.relationship || 'Encarregado'}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className={pendingConfirmations.length > 0 ? 'border-destructive/30' : ''}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{pendingConfirmations.length}</div>
                  <p className="text-xs text-muted-foreground">Confirmações Pendentes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{callups.length}</div>
                  <p className="text-xs text-muted-foreground">Convocatórias Ativas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{announcements.length}</div>
                  <p className="text-xs text-muted-foreground">Anúncios</p>
                </CardContent>
              </Card>
              <Card className={notifCount > 0 ? 'border-primary/30' : ''}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{notifCount}</div>
                  <p className="text-xs text-muted-foreground">Notificações</p>
                </CardContent>
              </Card>
            </div>

            {/* Next events */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Próximo Jogo</CardTitle>
                </CardHeader>
                <CardContent>
                  {nextMatch ? (
                    <div className="space-y-1">
                      <p className="font-medium">{nextMatch.opponent_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(nextMatch.match_date), "d MMM yyyy, HH:mm", { locale: pt })}
                      </p>
                      {nextMatch.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {nextMatch.location}
                        </p>
                      )}
                      <Badge variant={nextMatch.is_home ? 'default' : 'secondary'} className="text-xs mt-1">
                        {nextMatch.is_home ? 'Casa' : 'Fora'}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem jogos agendados</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Próximo Treino</CardTitle>
                </CardHeader>
                <CardContent>
                  {nextTraining ? (
                    <div className="space-y-1">
                      <p className="font-medium">{nextTraining.name}</p>
                      {nextTraining.training_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(nextTraining.training_date), "d MMM yyyy, HH:mm", { locale: pt })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem treinos agendados</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Pending confirmations alert */}
            {pendingConfirmations.length > 0 && (
              <Card className="border-destructive/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-semibold text-sm">Confirmações Pendentes</span>
                  </div>
                  <div className="space-y-2">
                    {pendingConfirmations.slice(0, 3).map((pc: any) => (
                      <div key={pc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <p className="text-sm font-medium">{pc.matches?.opponent_name || 'Jogo'}</p>
                          {pc.matches?.match_date && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(pc.matches.match_date), "d MMM, HH:mm", { locale: pt })}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => handleCallupResponse(pc.match_id, pc.player_id, 'confirmed')}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Sim
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleCallupResponse(pc.match_id, pc.player_id, 'declined')}>
                            <XCircle className="h-3 w-3 mr-1" /> Não
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent notifications */}
            {notifications.filter(n => !n.is_read).length > 0 && (
              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BellRing className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Notificações recentes</span>
                    <Button size="sm" variant="link" className="ml-auto text-xs" onClick={() => setActiveTab('notificacoes')}>
                      Ver todas
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {notifications.filter(n => !n.is_read).slice(0, 3).map(n => (
                      <div key={n.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                        </div>
                        <Button size="sm" variant="ghost" className="shrink-0" onClick={() => markNotifRead.mutate(n.id)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CALLUPS TAB */}
          <TabsContent value="convocatorias" className="space-y-4">
            {callups.length === 0 ? (
              <EmptyState icon={<Trophy className="h-8 w-8" />} title="Sem convocatórias" description="Não há convocatórias ativas para os seus atletas." />
            ) : (
              <div className="space-y-3">
                {callups.map((c: any) => {
                  const match = c.matches;
                  if (!match) return null;
                  return (
                    <Card key={c.match_id + c.player_id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">{match.is_home ? 'CASA' : 'FORA'}</Badge>
                              <span className="font-semibold text-sm">{match.opponent_name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(match.match_date), "d MMM yyyy, HH:mm", { locale: pt })}
                            </p>
                            {match.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" /> {match.location}
                              </p>
                            )}
                            {match.competition && (
                              <p className="text-xs text-muted-foreground mt-0.5">{match.competition}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">Convocado</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* CONFIRMATIONS TAB */}
          <TabsContent value="confirmacoes" className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Convocatórias Pendentes</h3>
            {pendingConfirmations.length === 0 && attendanceReqs.length === 0 ? (
              <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="Tudo em dia!" description="Não tem confirmações pendentes neste momento." />
            ) : (
              <div className="space-y-3">
                {pendingConfirmations.map((pc: any) => (
                  <Card key={pc.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{pc.matches?.opponent_name || 'Jogo'}</p>
                        {pc.matches?.match_date && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(pc.matches.match_date), "d MMM, HH:mm", { locale: pt })}
                          </p>
                        )}
                        {pc.confirmation_deadline && (
                          <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" /> Prazo: {format(new Date(pc.confirmation_deadline), "d MMM, HH:mm", { locale: pt })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleCallupResponse(pc.match_id, pc.player_id, 'confirmed')}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCallupResponse(pc.match_id, pc.player_id, 'declined')}>
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {attendanceReqs.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-muted-foreground mt-4">Presenças</h3>
                    {attendanceReqs.map((ar: any) => (
                      <Card key={ar.id}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{ar.event_title}</p>
                            <p className="text-xs text-muted-foreground">{ar.event_type}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => handleAttendanceResponse(ar.id, 'confirmed')}>Sim</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAttendanceResponse(ar.id, 'declined')}>Não</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* ANNOUNCEMENTS TAB */}
          <TabsContent value="anuncios" className="space-y-4">
            {announcements.length === 0 ? (
              <EmptyState icon={<Megaphone className="h-8 w-8" />} title="Sem anúncios" description="Não há anúncios recentes." />
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {announcements.map((a: any) => (
                    <Card
                      key={a.id}
                      className={
                        a.priority === 'urgent' ? 'border-destructive/30 cursor-pointer hover:bg-muted/50' :
                        a.priority === 'important' ? 'border-primary/30 cursor-pointer hover:bg-muted/50' :
                        'cursor-pointer hover:bg-muted/50'
                      }
                      onClick={() => markRead.mutate(a.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          {a.priority === 'urgent' && <Badge variant="destructive" className="text-[10px]">Urgente</Badge>}
                          {a.priority === 'important' && <Badge className="text-[10px]">Importante</Badge>}
                          <h4 className="font-semibold text-sm">{a.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{a.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: pt })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* NOTIFICATIONS TAB */}
          <TabsContent value="notificacoes" className="space-y-4">
            {notifications.length === 0 ? (
              <EmptyState icon={<Bell className="h-8 w-8" />} title="Sem notificações" description="Não tem notificações recentes." />
            ) : (
              <div className="space-y-2">
                {notifications.map(n => (
                  <Card
                    key={n.id}
                    className={n.is_read ? '' : 'border-primary/20 bg-primary/5'}
                  >
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={`text-sm truncate ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                            {n.priority_level === 'urgent' && <Badge variant="destructive" className="text-[9px]">Urgente</Badge>}
                            {n.priority_level === 'important' && <Badge className="text-[9px]">Importante</Badge>}
                          </div>
                          {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
                          </p>
                        </div>
                      </div>
                      {!n.is_read && (
                        <Button size="sm" variant="ghost" onClick={() => markNotifRead.mutate(n.id)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Lido
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* FINANCIAL TAB */}
          <TabsContent value="financeiro" className="space-y-4">
            <GuardianFinancialTab guardianProfileId={guardianProfile.id} userId={user?.id || ''} />
          </TabsContent>

          {/* AGENDA TAB */}
          <TabsContent value="agenda" className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Próximos Jogos</h3>
              {(upcomingEvents?.matches || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem jogos agendados</p>
              ) : (
                (upcomingEvents?.matches || []).map((m: any) => (
                  <Card key={m.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Trophy className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{m.opponent_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(m.match_date), "d MMM, HH:mm", { locale: pt })}
                          {m.location && ` · ${m.location}`}
                        </p>
                      </div>
                      <Badge variant={m.is_home ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {m.is_home ? 'Casa' : 'Fora'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}

              <h3 className="text-sm font-semibold text-muted-foreground mt-4">Próximos Treinos</h3>
              {(upcomingEvents?.trainings || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem treinos agendados</p>
              ) : (
                (upcomingEvents?.trainings || []).map((t: any) => (
                  <Card key={t.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{t.name}</p>
                        {t.training_date && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.training_date), "d MMM, HH:mm", { locale: pt })}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* PREFERENCES TAB */}
          <TabsContent value="preferencias" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preferências de Notificação</CardTitle>
                <CardDescription>Configure quais notificações deseja receber</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'match_reminders', label: 'Lembretes de Jogos', desc: 'Receber lembrete antes dos jogos' },
                  { key: 'training_reminders', label: 'Lembretes de Treinos', desc: 'Receber lembrete antes dos treinos' },
                  { key: 'announcement_alerts', label: 'Alertas de Anúncios', desc: 'Ser notificado sobre novos anúncios' },
                  { key: 'callup_alerts', label: 'Alertas de Convocatórias', desc: 'Ser notificado quando o atleta é convocado' },
                  { key: 'unread_followup', label: 'Reforço de Não Lidos', desc: 'Lembrete para itens importantes não lidos' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">{item.label}</Label>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={(notifPrefs as any)?.[item.key] ?? true}
                      onCheckedChange={(checked) => {
                        updatePrefs.mutate({ ...notifPrefs, [item.key]: checked } as any, {
                          onSuccess: () => toast.success('Preferências atualizadas'),
                        });
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
