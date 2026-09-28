import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, BarChart3, Megaphone, ClipboardCheck, MessageSquare, Users, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import {
  useAnnouncementEngagement,
  useAttendanceEngagement,
  useChannelEngagement,
} from '@/hooks/useCommunicationPhase3';
import { EmptyState, PageLoading } from '@/components/ui/page-states';

interface EngagementAnalyticsProps {
  clubId: string | null;
  userId?: string | null;
}

export function EngagementAnalytics({ clubId, userId }: EngagementAnalyticsProps) {
  const { data: announcementData, isLoading: aLoading } = useAnnouncementEngagement(clubId, userId);
  const { data: attendanceData, isLoading: atLoading } = useAttendanceEngagement(clubId, userId);
  const { data: channelData = [], isLoading: cLoading } = useChannelEngagement(clubId, userId);

  const isLoading = aLoading || atLoading || cLoading;

  if (isLoading) {
    return <PageLoading message="A carregar analytics..." />;
  }

  const totalAnnouncements = announcementData?.totalAnnouncements || 0;
  const totalReads = announcementData?.totalReads || 0;
  const readRate = totalAnnouncements > 0 ? Math.round((totalReads / Math.max(totalAnnouncements, 1)) * 100) : 0;

  const attStats = attendanceData?.stats || { confirmed: 0, declined: 0, pending: 0, total: 0 };
  const confirmRate = attStats.total > 0 ? Math.round((attStats.confirmed / attStats.total) * 100) : 0;
  const pendingRate = attStats.total > 0 ? Math.round((attStats.pending / attStats.total) * 100) : 0;

  const activeChannels = channelData.filter(c => c.message_count > 0).length;
  const totalChannels = channelData.length;
  const totalMessages = channelData.reduce((s, c) => s + c.message_count, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Taxa de Leitura</p>
                <p className="text-2xl font-bold">{readRate}%</p>
                <p className="text-xs text-muted-foreground">{totalReads} leituras · {totalAnnouncements} anúncios</p>
              </div>
              <Megaphone className="h-8 w-8 text-primary/20" />
            </div>
            <Progress value={readRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Taxa de Confirmação</p>
                <p className="text-2xl font-bold">{confirmRate}%</p>
                <p className="text-xs text-muted-foreground">{attStats.confirmed} confirmados · {attStats.total} total</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-primary/20" />
            </div>
            <Progress value={confirmRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Itens Pendentes</p>
                <p className="text-2xl font-bold">{attStats.pending}</p>
                <p className="text-xs text-muted-foreground">{pendingRate}% sem resposta</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning/30" />
            </div>
            <Progress value={pendingRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Atividade de Grupos</p>
                <p className="text-2xl font-bold">{activeChannels}/{totalChannels}</p>
                <p className="text-xs text-muted-foreground">{totalMessages} mensagens</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Announcement engagement */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Engagement de Anúncios
            </CardTitle>
            <CardDescription className="text-xs">Últimos 20 anúncios</CardDescription>
          </CardHeader>
          <CardContent>
            {(announcementData?.announcements || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem anúncios</p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {(announcementData?.announcements || []).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.target_type}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={a.read_count > 0 ? 'default' : 'secondary'} className="text-xs">
                          {a.read_count} {a.read_count === 1 ? 'leitura' : 'leituras'}
                        </Badge>
                        {a.priority === 'important' && <AlertTriangle className="h-3 w-3 text-warning" />}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Channel activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Atividade por Grupo
            </CardTitle>
            <CardDescription className="text-xs">Mensagens e membros por canal</CardDescription>
          </CardHeader>
          <CardContent>
            {channelData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem grupos</p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {channelData.map((ch: any) => (
                    <div key={ch.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ch.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{ch.member_count}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ch.message_count}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">{ch.channel_type}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Resumo de Presenças
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-600">{attStats.confirmed}</div>
              <p className="text-xs text-muted-foreground">Confirmados</p>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600">{attStats.declined}</div>
              <p className="text-xs text-muted-foreground">Recusados</p>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-600">{attStats.pending}</div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
