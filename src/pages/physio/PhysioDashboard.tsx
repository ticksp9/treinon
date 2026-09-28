import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  AlertTriangle, 
  Calendar, 
  ClipboardList,
  Heart,
  Users,
  Plus,
  ChevronRight,
  Clock,
  TrendingUp
} from 'lucide-react';
import { format, addDays, isPast, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';
import { INJURY_STATUSES, INJURY_SEVERITIES } from '@/lib/physio-constants';

export default function PhysioDashboard() {
  const { user } = useAuth();
  const { hasPhysioAccess, clubId, loading: accessLoading } = usePhysioAccess();
  const navigate = useNavigate();
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Fetch teams for filter
  const { data: teams } = useQuery({
    queryKey: ['club-teams', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from('teams')
        .select('id, name, category')
        .eq('club_id', clubId)
        .order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  // Fetch active injuries
  const { data: activeInjuries, isLoading: injuriesLoading } = useQuery({
    queryKey: ['physio-active-injuries', clubId, teamFilter],
    queryFn: async () => {
      if (!clubId) return [];
      let query = supabase
        .from('physio_injuries')
        .select(`
          *,
          player:players(id, name, number, team_id, team:teams(id, name))
        `)
        .eq('club_id', clubId)
        .in('status', ['active', 'recovering'])
        .order('start_date', { ascending: false });

      const { data } = await query;
      
      if (teamFilter !== 'all' && data) {
        return data.filter(injury => injury.player?.team_id === teamFilter);
      }
      return data || [];
    },
    enabled: !!clubId && hasPhysioAccess,
  });

  // Fetch upcoming reviews
  const { data: upcomingReviews } = useQuery({
    queryKey: ['physio-upcoming-reviews', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const today = new Date();
      const nextWeek = addDays(today, 7);
      
      const { data } = await supabase
        .from('physio_assessments')
        .select(`
          *,
          player:players(id, name, number, team:teams(id, name))
        `)
        .eq('club_id', clubId)
        .gte('next_review_date', format(today, 'yyyy-MM-dd'))
        .lte('next_review_date', format(nextWeek, 'yyyy-MM-dd'))
        .order('next_review_date');

      return data || [];
    },
    enabled: !!clubId && hasPhysioAccess,
  });

  // Fetch players with restrictions
  const { data: restrictedPlayers } = useQuery({
    queryKey: ['physio-restricted-players', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from('physio_injuries')
        .select(`
          *,
          player:players(id, name, number, team:teams(id, name))
        `)
        .eq('club_id', clubId)
        .eq('is_fit', false)
        .not('restrictions', 'is', null)
        .in('status', ['active', 'recovering']);

      return data || [];
    },
    enabled: !!clubId && hasPhysioAccess,
  });

  // Fetch active rehab plans
  const { data: activeRehabPlans } = useQuery({
    queryKey: ['physio-active-rehab', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from('rehab_plans')
        .select(`
          *,
          player:players(id, name, number, team:teams(id, name))
        `)
        .eq('club_id', clubId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!clubId && hasPhysioAccess,
  });

  if (accessLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPhysioAccess) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Esta funcionalidade está disponível apenas para fisioterapeutas e administradores do clube.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const getSeverityBadge = (severity: string) => {
    const config = INJURY_SEVERITIES.find(s => s.value === severity);
    return config ? (
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
    ) : null;
  };

  const getStatusBadge = (status: string) => {
    const config = INJURY_STATUSES.find(s => s.value === status);
    return config ? (
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
    ) : null;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-primary" />
              Saúde & Fisioterapia
            </h1>
            <p className="text-muted-foreground">Gestão de lesões, avaliações e reabilitação</p>
          </div>
          <div className="flex gap-2">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por equipa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Equipas</SelectItem>
                {teams?.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => navigate('/club/physio/injuries/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Lesão
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeInjuries?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Lesões Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{restrictedPlayers?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Com Restrições</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeRehabPlans?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Planos Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingReviews?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Reavaliações (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Injuries */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Lesões Ativas</CardTitle>
                <CardDescription>Casos que requerem acompanhamento</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/club/physio/injuries')}>
                Ver todas
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {injuriesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : activeInjuries?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma lesão ativa</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeInjuries?.slice(0, 5).map(injury => (
                    <div
                      key={injury.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/club/physio/injuries/${injury.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {injury.player?.number || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{injury.player?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {injury.player?.team?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(injury.severity)}
                        {getStatusBadge(injury.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Reavaliações Próximas</CardTitle>
                <CardDescription>Próximos 7 dias</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingReviews?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Sem reavaliações agendadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingReviews?.map(review => (
                    <div
                      key={review.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {review.player?.number || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{review.player?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {review.player?.team?.name}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {format(new Date(review.next_review_date!), 'dd MMM', { locale: pt })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Players with Restrictions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Jogadores com Restrições</CardTitle>
              <CardDescription>Limitações para treino/jogo</CardDescription>
            </CardHeader>
            <CardContent>
              {restrictedPlayers?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Todos os jogadores aptos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {restrictedPlayers?.slice(0, 5).map(injury => (
                    <div
                      key={injury.id}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{injury.player?.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            #{injury.player?.number}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                          Restrito
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{injury.restrictions}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Rehab Plans */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Planos de Reabilitação</CardTitle>
                <CardDescription>Planos ativos</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/club/physio/rehab')}>
                Ver todos
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {activeRehabPlans?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Sem planos ativos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRehabPlans?.map(plan => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/club/physio/rehab/${plan.id}`)}
                    >
                      <div>
                        <p className="font-medium">{plan.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.player?.name} • {plan.player?.team?.name}
                        </p>
                      </div>
                      <Badge variant="outline">{plan.phase}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
