import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, TrendingUp, AlertCircle, ArrowUpRight } from "lucide-react";

interface ReportsTabProps {
  clubId: string;
}

interface TeamMetrics {
  teamId: string;
  teamName: string;
  ageGroupName: string;
  playerCount: number;
  coachCount: number;
  maxPlayers: number;
  occupancy: number;
  playerCoachRatio: number;
}

interface AgeGroupMetrics {
  ageGroupId: string;
  ageGroupName: string;
  totalPlayers: number;
  totalCoaches: number;
  teamCount: number;
  avgOccupancy: number;
}

export function ReportsTab({ clubId }: ReportsTabProps) {
  // Fetch all data for metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['youth-coordination-metrics', clubId],
    queryFn: async () => {
      // Fetch teams with age groups
      const { data: teams, error: teamsError } = await supabase
        .from('youth_teams')
        .select(`
          id,
          name,
          is_active,
          youth_age_groups (id, name, min_birth_year, max_birth_year)
        `)
        .eq('club_id', clubId)
        .eq('is_active', true);

      if (teamsError) throw teamsError;

      // Fetch player and coach counts for each team
      const teamMetrics: TeamMetrics[] = await Promise.all(
        (teams || []).map(async (team) => {
          const [playersResult, coachesResult] = await Promise.all([
            supabase.from('youth_team_players').select('id', { count: 'exact' }).eq('youth_team_id', team.id),
            supabase.from('youth_team_coaches').select('id', { count: 'exact' }).eq('youth_team_id', team.id)
          ]);

          const playerCount = playersResult.count || 0;
          const coachCount = coachesResult.count || 0;
          const maxPlayers = 25; // Default max players per team

          return {
            teamId: team.id,
            teamName: team.name,
            ageGroupName: team.youth_age_groups?.name || 'N/A',
            playerCount,
            coachCount,
            maxPlayers,
            occupancy: Math.round((playerCount / maxPlayers) * 100),
            playerCoachRatio: coachCount > 0 ? Math.round(playerCount / coachCount) : playerCount
          };
        })
      );

      // Aggregate by age group
      const ageGroupMap = new Map<string, AgeGroupMetrics>();
      teamMetrics.forEach(tm => {
        const existing = ageGroupMap.get(tm.ageGroupName);
        if (existing) {
          existing.totalPlayers += tm.playerCount;
          existing.totalCoaches += tm.coachCount;
          existing.teamCount += 1;
          existing.avgOccupancy = Math.round(
            (existing.avgOccupancy * (existing.teamCount - 1) + tm.occupancy) / existing.teamCount
          );
        } else {
          ageGroupMap.set(tm.ageGroupName, {
            ageGroupId: tm.teamId,
            ageGroupName: tm.ageGroupName,
            totalPlayers: tm.playerCount,
            totalCoaches: tm.coachCount,
            teamCount: 1,
            avgOccupancy: tm.occupancy
          });
        }
      });

      // Calculate totals
      const totalPlayers = teamMetrics.reduce((sum, t) => sum + t.playerCount, 0);
      const totalCoaches = teamMetrics.reduce((sum, t) => sum + t.coachCount, 0);
      const totalTeams = teamMetrics.length;
      const avgOccupancy = totalTeams > 0 
        ? Math.round(teamMetrics.reduce((sum, t) => sum + t.occupancy, 0) / totalTeams)
        : 0;
      const avgRatio = totalCoaches > 0 ? Math.round(totalPlayers / totalCoaches) : 0;

      // Find teams with issues
      const lowOccupancy = teamMetrics.filter(t => t.occupancy < 50);
      const highOccupancy = teamMetrics.filter(t => t.occupancy > 90);
      const noCoach = teamMetrics.filter(t => t.coachCount === 0);

      return {
        teamMetrics,
        ageGroupMetrics: Array.from(ageGroupMap.values()),
        totals: {
          players: totalPlayers,
          coaches: totalCoaches,
          teams: totalTeams,
          avgOccupancy,
          avgRatio
        },
        alerts: {
          lowOccupancy,
          highOccupancy,
          noCoach
        }
      };
    },
    enabled: !!clubId
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">A carregar métricas...</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">Sem dados disponíveis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jogadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totals.players}</div>
            <p className="text-xs text-muted-foreground">
              Em {metrics.totals.teams} equipas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Treinadores</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totals.coaches}</div>
            <p className="text-xs text-muted-foreground">
              Rácio: 1:{metrics.totals.avgRatio} jogadores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ocupação Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totals.avgOccupancy}%</div>
            <Progress value={metrics.totals.avgOccupancy} className="mt-2" />
          </CardContent>
        </Card>

        <Card className={metrics.alerts.noCoach.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertCircle className={`h-4 w-4 ${metrics.alerts.noCoach.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.alerts.noCoach.length + metrics.alerts.lowOccupancy.length + metrics.alerts.highOccupancy.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Situações a rever
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Age Group Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas por Escalão</CardTitle>
          <CardDescription>Distribuição de jogadores e treinadores</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.ageGroupMetrics.length > 0 ? (
            <div className="space-y-4">
              {metrics.ageGroupMetrics.map((ag) => (
                <div key={ag.ageGroupName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ag.ageGroupName}</span>
                      <Badge variant="outline">{ag.teamCount} equipa(s)</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{ag.totalPlayers} jogadores</span>
                      <span>{ag.totalCoaches} treinadores</span>
                      <span className="font-medium">{ag.avgOccupancy}%</span>
                    </div>
                  </div>
                  <Progress value={ag.avgOccupancy} className="h-2" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Sem escalões configurados.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Team Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes por Equipa</CardTitle>
          <CardDescription>Ocupação e rácio jogador/treinador</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.teamMetrics.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {metrics.teamMetrics.map((team) => (
                <Card key={team.teamId} className={
                  team.coachCount === 0 ? "border-destructive" :
                  team.occupancy > 90 ? "border-amber-500" :
                  team.occupancy < 50 ? "border-muted" : ""
                }>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{team.teamName}</CardTitle>
                      <Badge variant="secondary">{team.ageGroupName}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Jogadores</span>
                      <span className="font-medium">{team.playerCount} / {team.maxPlayers}</span>
                    </div>
                    <Progress value={team.occupancy} className="h-2" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Treinadores</span>
                      <span className={`font-medium ${team.coachCount === 0 ? 'text-destructive' : ''}`}>
                        {team.coachCount}
                      </span>
                    </div>
                    
                    {team.coachCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rácio</span>
                        <span className="font-medium">1:{team.playerCoachRatio}</span>
                      </div>
                    )}
                    
                    {team.coachCount === 0 && (
                      <Badge variant="destructive" className="w-full justify-center">
                        Sem treinador
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Sem equipas configuradas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Alerts Section */}
      {(metrics.alerts.noCoach.length > 0 || metrics.alerts.lowOccupancy.length > 0 || metrics.alerts.highOccupancy.length > 0) && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Situações a Rever
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.alerts.noCoach.length > 0 && (
              <div>
                <h4 className="font-medium text-destructive mb-2">Equipas sem treinador:</h4>
                <div className="flex flex-wrap gap-2">
                  {metrics.alerts.noCoach.map(t => (
                    <Badge key={t.teamId} variant="destructive">{t.teamName}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {metrics.alerts.lowOccupancy.length > 0 && (
              <div>
                <h4 className="font-medium text-muted-foreground mb-2">Ocupação baixa (&lt;50%):</h4>
                <div className="flex flex-wrap gap-2">
                  {metrics.alerts.lowOccupancy.map(t => (
                    <Badge key={t.teamId} variant="outline">{t.teamName} ({t.occupancy}%)</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {metrics.alerts.highOccupancy.length > 0 && (
              <div>
                <h4 className="font-medium text-amber-600 mb-2">Ocupação alta (&gt;90%):</h4>
                <div className="flex flex-wrap gap-2">
                  {metrics.alerts.highOccupancy.map(t => (
                    <Badge key={t.teamId} variant="secondary">{t.teamName} ({t.occupancy}%)</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
