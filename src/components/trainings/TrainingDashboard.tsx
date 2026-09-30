import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, ArrowRight, Activity } from 'lucide-react';
import { format, isToday, isTomorrow, isBefore, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { useAuth } from '@/lib/auth';

interface UpcomingSession {
  id: string;
  date: string;
  title: string | null;
  location: string | null;
  duration_minutes: number | null;
  status: string;
  intensity: string | null;
  team_id: string;
  team_name?: string;
}

interface DashboardStats {
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  sessionsWithoutAttendance: number;
  sessionsWithoutLoad: number;
}

interface TrainingDashboardProps {
  onNavigate?: (tab: string) => void;
}

export function TrainingDashboard({ onNavigate }: TrainingDashboardProps) {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    completedSessions: 0,
    upcomingSessions: 0,
    sessionsWithoutAttendance: 0,
    sessionsWithoutLoad: 0,
  });
  const [loading, setLoading] = useState(true);
  const seasonId = useSelectedSeasonId();

  useEffect(() => {
    if (user) fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, seasonId]);

  const fetchDashboard = async () => {
    const now = new Date().toISOString();
    const withSeason = <T,>(q: T): T => (seasonId ? (q as any).eq('season_id', seasonId) : q);
    const weekAhead = addDays(new Date(), 7).toISOString();
    const weekBehind = addDays(new Date(), -7).toISOString();

    const [upcomingRes, recentRes, attendanceRes, loadRes] = await Promise.all([
      withSeason(supabase
        .from('training_sessions')
        .select('id, date, title, location, duration_minutes, status, intensity, team_id')
        )
        .gte('date', now)
        .lte('date', weekAhead)
        .neq('status', 'cancelled')
        .order('date')
        .limit(5),
      withSeason(supabase
        .from('training_sessions')
        .select('id, date, status')
        )
        .gte('date', weekBehind)
        .lt('date', now)
        .neq('status', 'cancelled'),
      withSeason(supabase
        .from('training_attendance')
        .select('session_id')
        ),
      supabase
        .from('training_load')
        .select('session_id')
        ,
    ]);

    // Fetch team names for upcoming
    const upcomingWithNames: UpcomingSession[] = [];
    if ((upcomingRes.data || []).length > 0) {
      const teamIds = [...new Set((upcomingRes.data || []).map(s => s.team_id))];
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
      
      (upcomingRes.data || []).forEach(s => {
        upcomingWithNames.push({
          ...s,
          team_name: teams?.find(t => t.id === s.team_id)?.name || '',
        });
      });
    }

    const recentSessions = recentRes.data || [];
    const attendanceSessionIds = new Set((attendanceRes.data || []).map(a => a.session_id));
    const loadSessionIds = new Set((loadRes.data || []).map(l => l.session_id));

    const recentWithoutAttendance = recentSessions.filter(s => !attendanceSessionIds.has(s.id));
    const recentWithoutLoad = recentSessions.filter(s => !loadSessionIds.has(s.id));

    setUpcoming(upcomingWithNames);
    setStats({
      totalSessions: recentSessions.length + upcomingWithNames.length,
      completedSessions: recentSessions.filter(s => s.status === 'completed').length,
      upcomingSessions: upcomingWithNames.length,
      sessionsWithoutAttendance: recentWithoutAttendance.length,
      sessionsWithoutLoad: recentWithoutLoad.length,
    });
    setLoading(false);
  };

  const getTimeLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return format(d, "EEE dd/MM", { locale: pt });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">A carregar painel...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-5 h-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold">{stats.upcomingSessions}</div>
            <div className="text-xs text-muted-foreground">Próximos treinos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto text-green-500 mb-1" />
            <div className="text-2xl font-bold">{stats.completedSessions}</div>
            <div className="text-xs text-muted-foreground">Concluídos (7d)</div>
          </CardContent>
        </Card>
        <Card className={stats.sessionsWithoutAttendance > 0 ? 'border-orange-500/30' : ''}>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 mx-auto text-orange-500 mb-1" />
            <div className="text-2xl font-bold">{stats.sessionsWithoutAttendance}</div>
            <div className="text-xs text-muted-foreground">Sem presença</div>
          </CardContent>
        </Card>
        <Card className={stats.sessionsWithoutLoad > 0 ? 'border-orange-500/30' : ''}>
          <CardContent className="p-4 text-center">
            <Activity className="w-5 h-5 mx-auto text-orange-500 mb-1" />
            <div className="text-2xl font-bold">{stats.sessionsWithoutLoad}</div>
            <div className="text-xs text-muted-foreground">Sem carga</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      {(stats.sessionsWithoutAttendance > 0 || stats.sessionsWithoutLoad > 0) && (
        <Card className="border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              Ações Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.sessionsWithoutAttendance > 0 && (
              <Button variant="ghost" size="sm" className="w-full justify-start text-orange-600" onClick={() => onNavigate?.('attendance')}>
                <Users className="w-4 h-4 mr-2" />
                {stats.sessionsWithoutAttendance} treino{stats.sessionsWithoutAttendance > 1 ? 's' : ''} sem presenças registadas
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            )}
            {stats.sessionsWithoutLoad > 0 && (
              <Button variant="ghost" size="sm" className="w-full justify-start text-orange-600" onClick={() => onNavigate?.('load')}>
                <Activity className="w-4 h-4 mr-2" />
                {stats.sessionsWithoutLoad} treino{stats.sessionsWithoutLoad > 1 ? 's' : ''} sem carga registada
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Próximos Treinos</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sem treinos agendados esta semana</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => onNavigate?.('attendance')}>
                Configurar treinos semanais
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isToday(new Date(s.date)) ? 'default' : 'outline'} className="text-xs">
                        {getTimeLabel(s.date)}
                      </Badge>
                      <span className="text-sm font-medium">{s.title || 'Treino'}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(s.date), 'HH:mm')}
                      </span>
                      {s.duration_minutes && <span>{s.duration_minutes}min</span>}
                      {s.location && <span>{s.location}</span>}
                      {s.team_name && <span className="text-primary">{s.team_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
