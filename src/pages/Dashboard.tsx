import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Trophy, Calendar, TrendingUp, Plus, ArrowRight, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats, queryKeys } from '@/lib/query-helpers';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { DashboardStats } from '@/lib/types';
import { PageLoading } from '@/components/ui/page-states';

export default function Dashboard() {
  const { user } = useAuth();
  const { isGuardian, isPlayer, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const selectedSeasonId = useSelectedSeasonId();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: queryKeys.dashboardStats(selectedSeasonId),
    queryFn: () => fetchDashboardStats(selectedSeasonId),
    enabled: !!user && !roleLoading && !isGuardian && !isPlayer,
  });

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Treinador';

  // Redirect restricted roles to their portals
  if (!roleLoading && isGuardian) return <Navigate to="/guardian" replace />;
  if (!roleLoading && isPlayer) return <Navigate to="/player" replace />;
  if (roleLoading) return <AppLayout title="Dashboard"><PageLoading /></AppLayout>;

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-8">
        {/* Welcome Section */}
        <PageHeader
          title={`Olá, ${userName}`}
          description="Bem-vindo ao seu centro de gestão desportiva"
          actions={
            <>
              <Button onClick={() => navigate('/teams')} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova Equipa
              </Button>
              <Button onClick={() => navigate('/matches')} size="sm">
                <Trophy className="w-4 h-4 mr-2" />
                Novo Jogo
              </Button>
            </>
          }
        />

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Equipas', value: stats?.teamsCount, icon: Users, sub: 'Equipas ativas' },
            { label: 'Jogadores', value: stats?.playersCount, icon: Target, sub: 'Jogadores registados' },
            { label: 'Jogos', value: stats?.matchesCount, icon: Trophy, sub: 'Total de jogos' },
            { label: 'Próximos Jogos', value: stats?.upcomingMatches, icon: Calendar, sub: 'Agendados' },
          ].map(({ label, value, icon: Icon, sub }) => (
            <Card key={label} className="border-border/50 hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold font-display">{value ?? 0}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Quadro Tático',
              description: 'Desenhe jogadas e explique táticas aos seus jogadores',
              icon: TrendingUp,
              path: '/tactical-board',
              cta: 'Abrir quadro',
            },
            {
              title: 'Gestão de Jogos',
              description: 'Registe eventos em tempo real: golos, cartões, substituições',
              icon: Trophy,
              path: '/matches',
              cta: 'Ver jogos',
            },
            {
              title: 'Estatísticas',
              description: 'Acompanhe minutos, golos, cartões e performance dos jogadores',
              icon: Users,
              path: '/players',
              cta: 'Ver jogadores',
            },
          ].map(({ title, description, icon: Icon, path, cta }) => (
            <Card
              key={path}
              className="border-border/50 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(path)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 font-display text-base">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  {title}
                </CardTitle>
                <CardDescription className="text-sm">{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary font-medium group-hover:underline inline-flex items-center gap-1">
                  {cta} <ArrowRight className="w-3 h-3" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State for new users */}
        {!isLoading && stats?.teamsCount === 0 && (
          <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">Comece por criar uma equipa</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Crie a sua primeira equipa para começar a gerir jogadores, jogos e treinos.
              </p>
              <Button onClick={() => navigate('/teams')} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Criar Equipa
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
