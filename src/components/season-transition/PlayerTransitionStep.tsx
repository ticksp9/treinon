import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, ArrowRight, UserMinus, UserCheck, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AGE_CATEGORIES, calculateAge } from '@/lib/constants';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Database } from '@/integrations/supabase/types';

type SeasonPlayerStatus = Database['public']['Enums']['season_player_status'];

interface Team {
  id: string;
  name: string;
  category: string | null;
  gender: string;
  sport_type: string;
}

interface Player {
  id: string;
  name: string;
  birth_date: string | null;
  team_id: string;
  number: number | null;
  team: Team;
}

interface PlayerPlan {
  id?: string;
  player_id: string;
  status: SeasonPlayerStatus;
  target_team_id: string | null;
  target_category: string | null;
  current_team_id: string | null;
  current_category: string | null;
}

interface PlayerTransitionStepProps {
  seasonId: string;
  clubId: string;
  seasonName: string;
}

const STATUS_LABELS: Record<SeasonPlayerStatus, { label: string; icon: typeof UserCheck; color: string }> = {
  promotes: { label: 'Sobe de escalão', icon: ArrowRight, color: 'text-primary' },
  stays: { label: 'Mantém-se', icon: UserCheck, color: 'text-green-600' },
  leaves: { label: 'Sai do clube', icon: UserMinus, color: 'text-destructive' },
};

export function PlayerTransitionStep({ seasonId, clubId, seasonName }: PlayerTransitionStepProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [playerPlans, setPlayerPlans] = useState<Map<string, PlayerPlan>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch teams for this club
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

  // Fetch players
  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: ['all-club-players', clubId],
    queryFn: async () => {
      // First get club's team ids
      const teamIds = teams?.map(t => t.id) || [];
      if (teamIds.length === 0) return [];

      const { data, error } = await supabase
        .from('players')
        .select(`
          id, name, birth_date, team_id, number,
          team:teams(id, name, category, gender, sport_type)
        `)
        .eq('is_active', true)
        .in('team_id', teamIds)
        .order('name');

      if (error) throw error;
      return data.filter(p => p.team) as Player[];
    },
    enabled: !!clubId && !!teams && teams.length > 0,
  });

  // Fetch existing player plans for this season
  const { data: existingPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['season-player-plans', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_player_plans')
        .select('*')
        .eq('season_id', seasonId);

      if (error) throw error;
      return data;
    },
    enabled: !!seasonId,
  });

  // Initialize player plans from existing data
  useEffect(() => {
    if (!players || !existingPlans) return;

    const seasonStartYear = parseInt(seasonName.split('/')[0]) + 1;
    const seasonStart = new Date(seasonStartYear, 0, 1);

    const plans = new Map<string, PlayerPlan>();
    
    players.forEach(player => {
      const existingPlan = existingPlans.find(p => p.player_id === player.id);
      
      if (existingPlan) {
        plans.set(player.id, {
          id: existingPlan.id,
          player_id: player.id,
          status: existingPlan.status as SeasonPlayerStatus,
          target_team_id: existingPlan.target_team_id,
          target_category: existingPlan.target_category,
          current_team_id: existingPlan.current_team_id,
          current_category: existingPlan.current_category,
        });
      } else {
        // Calculate suggested category based on age
        let suggestedCategory = player.team?.category || null;
        if (player.birth_date) {
          const playerAge = calculateAge(player.birth_date, seasonStart);
          const correctCategory = AGE_CATEGORIES.find(cat => 
            playerAge >= cat.minAge && playerAge <= cat.maxAge
          );
          if (correctCategory) {
            suggestedCategory = correctCategory.value;
          }
        }

        const needsPromotion = suggestedCategory !== player.team?.category;

        plans.set(player.id, {
          player_id: player.id,
          status: needsPromotion ? 'promotes' : 'stays',
          target_team_id: null,
          target_category: suggestedCategory,
          current_team_id: player.team_id,
          current_category: player.team?.category || null,
        });
      }
    });

    setPlayerPlans(plans);
  }, [players, existingPlans, seasonName]);

  // Group players by current category
  const playersByCategory = useMemo(() => {
    if (!players) return new Map<string, Player[]>();
    
    const grouped = new Map<string, Player[]>();
    players.forEach(player => {
      const category = player.team?.category || 'Sem escalão';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(player);
    });
    return grouped;
  }, [players]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const updatePlayerPlan = (playerId: string, updates: Partial<PlayerPlan>) => {
    setPlayerPlans(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(playerId);
      if (existing) {
        newMap.set(playerId, { ...existing, ...updates });
      }
      return newMap;
    });
    setHasChanges(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const plansToSave = Array.from(playerPlans.values());
      
      for (const plan of plansToSave) {
        if (plan.id) {
          // Update existing
          const { error } = await supabase
            .from('season_player_plans')
            .update({
              status: plan.status,
              target_team_id: plan.target_team_id,
              target_category: plan.target_category,
            })
            .eq('id', plan.id);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from('season_player_plans')
            .insert({
              season_id: seasonId,
              club_id: clubId,
              player_id: plan.player_id,
              status: plan.status,
              target_team_id: plan.target_team_id,
              target_category: plan.target_category,
              current_team_id: plan.current_team_id,
              current_category: plan.current_category,
              created_by: user!.id,
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success('Planeamento de jogadores guardado');
      queryClient.invalidateQueries({ queryKey: ['season-player-plans', seasonId] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao guardar: ' + error.message);
    },
  });

  const isLoading = teamsLoading || playersLoading || plansLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const categories = Array.from(playersByCategory.keys()).sort();

  // Get available target teams for a player
  const getTargetTeams = (player: Player, targetCategory: string | null) => {
    if (!teams || !targetCategory) return [];
    return teams.filter(t => 
      t.category === targetCategory && 
      t.gender === player.team?.gender &&
      t.sport_type === player.team?.sport_type
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Jogadores por Escalão
          </h2>
          <p className="text-sm text-muted-foreground">
            Defina o destino de cada jogador para a época {seasonName}
          </p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'A guardar...' : 'Guardar Alterações'}
          </Button>
        )}
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum jogador ativo encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map(category => {
            const categoryPlayers = playersByCategory.get(category) || [];
            const isExpanded = expandedCategories.includes(category);
            
            // Count statuses for summary
            const statusCounts = {
              promotes: categoryPlayers.filter(p => playerPlans.get(p.id)?.status === 'promotes').length,
              stays: categoryPlayers.filter(p => playerPlans.get(p.id)?.status === 'stays').length,
              leaves: categoryPlayers.filter(p => playerPlans.get(p.id)?.status === 'leaves').length,
            };

            return (
              <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">{category}</CardTitle>
                          <Badge variant="secondary">{categoryPlayers.length} jogadores</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-primary">{statusCounts.promotes} sobem</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-green-600">{statusCounts.stays} mantêm</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-destructive">{statusCounts.leaves} saem</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {categoryPlayers.map(player => {
                          const plan = playerPlans.get(player.id);
                          const targetTeams = getTargetTeams(player, plan?.target_category || null);
                          const playerAge = player.birth_date 
                            ? calculateAge(player.birth_date, new Date(parseInt(seasonName.split('/')[0]) + 1, 0, 1))
                            : null;

                          return (
                            <div key={player.id} className="py-4 first:pt-0 last:pb-0">
                              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {player.number && (
                                      <Badge variant="outline">#{player.number}</Badge>
                                    )}
                                    <span className="font-medium">{player.name}</span>
                                    {playerAge && (
                                      <span className="text-sm text-muted-foreground">
                                        ({playerAge} anos)
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{player.team?.name}</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                  <RadioGroup
                                    value={plan?.status || 'stays'}
                                    onValueChange={(value) => updatePlayerPlan(player.id, { 
                                      status: value as SeasonPlayerStatus,
                                      target_team_id: value === 'leaves' ? null : plan?.target_team_id || null,
                                    })}
                                    className="flex gap-4"
                                  >
                                    {(Object.entries(STATUS_LABELS) as [SeasonPlayerStatus, typeof STATUS_LABELS[SeasonPlayerStatus]][]).map(([status, { label, icon: Icon, color }]) => (
                                      <div key={status} className="flex items-center space-x-2">
                                        <RadioGroupItem value={status} id={`${player.id}-${status}`} />
                                        <Label 
                                          htmlFor={`${player.id}-${status}`}
                                          className={`flex items-center gap-1 cursor-pointer ${plan?.status === status ? color : 'text-muted-foreground'}`}
                                        >
                                          <Icon className="w-4 h-4" />
                                          <span className="hidden sm:inline">{label}</span>
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>

                                  {plan?.status === 'promotes' && (
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={plan.target_category || ''}
                                        onValueChange={(value) => updatePlayerPlan(player.id, { 
                                          target_category: value,
                                          target_team_id: null, // Reset team when category changes
                                        })}
                                      >
                                        <SelectTrigger className="w-[120px]">
                                          <SelectValue placeholder="Escalão..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {AGE_CATEGORIES.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                              {cat.value}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>

                                      {targetTeams.length > 0 && (
                                        <Select
                                          value={plan.target_team_id || ''}
                                          onValueChange={(value) => updatePlayerPlan(player.id, { target_team_id: value })}
                                        >
                                          <SelectTrigger className="w-[150px]">
                                            <SelectValue placeholder="Equipa..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {targetTeams.map(team => (
                                              <SelectItem key={team.id} value={team.id}>
                                                {team.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}

                                      {plan.target_category && targetTeams.length === 0 && (
                                        <Badge variant="outline" className="text-amber-600 border-amber-600/30">
                                          Sem equipa disponível
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
