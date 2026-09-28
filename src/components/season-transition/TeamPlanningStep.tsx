import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AGE_CATEGORIES } from '@/lib/constants';
import { Database } from '@/integrations/supabase/types';

type SeasonPlayerStatus = Database['public']['Enums']['season_player_status'];

interface TeamPlanningStepProps {
  seasonId: string;
  clubId: string;
  seasonName: string;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
  gender: string;
  sport_type: string;
}

interface PlayerPlan {
  id: string;
  player_id: string;
  status: SeasonPlayerStatus;
  target_team_id: string | null;
  target_category: string | null;
  current_team_id: string | null;
  current_category: string | null;
  player: {
    id: string;
    name: string;
    number: number | null;
    birth_date: string | null;
  };
}

export function TeamPlanningStep({ seasonId, clubId, seasonName }: TeamPlanningStepProps) {
  // Fetch teams
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category, gender, sport_type')
        .order('category');

      if (error) throw error;
      return data as Team[];
    },
    enabled: !!clubId,
  });

  // Fetch player plans for this season
  const { data: playerPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['season-player-plans-with-details', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_player_plans')
        .select(`
          id, player_id, status, target_team_id, target_category, current_team_id, current_category,
          player:players(id, name, number, birth_date)
        `)
        .eq('season_id', seasonId);

      if (error) throw error;
      return data as PlayerPlan[];
    },
    enabled: !!seasonId,
  });

  // Group players by their target for next season
  const teamMappings = useMemo(() => {
    if (!teams || !playerPlans) return new Map<string, PlayerPlan[]>();

    const mappings = new Map<string, PlayerPlan[]>();

    // Initialize with all teams
    teams.forEach(team => {
      mappings.set(team.id, []);
    });

    // Add players who stay in their current team
    playerPlans.forEach(plan => {
      if (plan.status === 'stays' && plan.current_team_id) {
        const players = mappings.get(plan.current_team_id) || [];
        players.push(plan);
        mappings.set(plan.current_team_id, players);
      } else if (plan.status === 'promotes' && plan.target_team_id) {
        const players = mappings.get(plan.target_team_id) || [];
        players.push(plan);
        mappings.set(plan.target_team_id, players);
      }
    });

    return mappings;
  }, [teams, playerPlans]);

  // Get players without assigned team (promotes without target_team_id)
  const unassignedPlayers = useMemo(() => {
    if (!playerPlans) return [];
    return playerPlans.filter(p => 
      p.status === 'promotes' && !p.target_team_id
    );
  }, [playerPlans]);

  // Get players leaving
  const leavingPlayers = useMemo(() => {
    if (!playerPlans) return [];
    return playerPlans.filter(p => p.status === 'leaves');
  }, [playerPlans]);

  const isLoading = teamsLoading || plansLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Sort teams by category
  const sortedTeams = [...(teams || [])].sort((a, b) => {
    const catA = AGE_CATEGORIES.findIndex(c => c.value === a.category);
    const catB = AGE_CATEGORIES.findIndex(c => c.value === b.category);
    return catA - catB;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Equipas para a Próxima Época
        </h2>
        <p className="text-sm text-muted-foreground">
          Visualização das equipas com os jogadores previstos para {seasonName}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {playerPlans?.filter(p => p.status === 'stays').length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Mantêm-se</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">
                {playerPlans?.filter(p => p.status === 'promotes').length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Sobem de escalão</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">
                {leavingPlayers.length}
              </p>
              <p className="text-sm text-muted-foreground">Saem do clube</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unassigned Players Warning */}
      {unassignedPlayers.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <UserPlus className="w-5 h-5" />
              Jogadores sem Equipa Atribuída
            </CardTitle>
            <CardDescription>
              Estes jogadores precisam de uma equipa para a próxima época
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unassignedPlayers.map(plan => (
                <Badge key={plan.id} variant="outline" className="text-amber-600 border-amber-600/30">
                  {plan.player?.name} ({plan.target_category})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedTeams.map(team => {
          const teamPlayers = teamMappings.get(team.id) || [];
          const stayingPlayers = teamPlayers.filter(p => p.status === 'stays');
          const promotedPlayers = teamPlayers.filter(p => p.status === 'promotes');

          return (
            <Card key={team.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  <Badge variant="secondary">{team.category}</Badge>
                </div>
                <CardDescription>
                  {teamPlayers.length} jogadores previstos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {teamPlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sem jogadores atribuídos
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stayingPlayers.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Mantêm-se ({stayingPlayers.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {stayingPlayers.map(plan => (
                            <Badge key={plan.id} variant="outline" className="text-xs">
                              {plan.player?.number && `#${plan.player.number} `}
                              {plan.player?.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {promotedPlayers.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Chegam ({promotedPlayers.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {promotedPlayers.map(plan => (
                            <Badge key={plan.id} variant="default" className="text-xs">
                              {plan.player?.number && `#${plan.player.number} `}
                              {plan.player?.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Leaving Players */}
      {leavingPlayers.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Jogadores que Saem do Clube
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {leavingPlayers.map(plan => (
                <Badge key={plan.id} variant="outline" className="text-destructive border-destructive/30">
                  {plan.player?.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
