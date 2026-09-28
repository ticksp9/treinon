import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowRight, Users, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AGE_CATEGORIES, calculateAge, Gender, CURRENT_SEASONS } from '@/lib/constants';
import { differenceInYears } from 'date-fns';

interface Team {
  id: string;
  name: string;
  category: string | null;
  gender: Gender;
  season: string;
  sport_type: string;
}

interface Player {
  id: string;
  name: string;
  birth_date: string | null;
  team_id: string;
  team: Team;
  number: number | null;
}

interface PlayerPromotion {
  player: Player;
  currentCategory: string | null;
  suggestedCategory: string | null;
  suggestedTeamId: string | null;
  suggestedTeamName: string | null;
  playerAge: number | null;
  needsPromotion: boolean;
  selected: boolean;
}

export default function SeasonTransition() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSeason, setSelectedSeason] = useState<string>(CURRENT_SEASONS[0]);
  const [processing, setProcessing] = useState(false);
  const [promotions, setPromotions] = useState<PlayerPromotion[]>([]);

  // Fetch teams
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category, gender, season, sport_type')
        .order('category');

      if (error) throw error;
      return data.map(t => ({
        ...t,
        gender: (t.gender || 'male') as Gender
      })) as Team[];
    },
    enabled: !!user,
  });

  // Fetch all players with teams
  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: ['all-players-for-transition'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id, name, birth_date, team_id, number,
          team:teams(id, name, category, gender, season, sport_type)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data.filter(p => p.team).map(p => ({
        ...p,
        team: {
          ...p.team,
          gender: ((p.team as any).gender || 'male') as Gender
        }
      })) as Player[];
    },
    enabled: !!user,
  });

  // Calculate promotions needed
  const calculatePromotions = useMemo(() => {
    if (!players || !teams) return [];

    const seasonStart = new Date(parseInt(selectedSeason.split('/')[0]) + 1, 0, 1);

    return players.map(player => {
      if (!player.birth_date) {
        return {
          player,
          currentCategory: player.team.category,
          suggestedCategory: null,
          suggestedTeamId: null,
          suggestedTeamName: null,
          playerAge: null,
          needsPromotion: false,
          selected: false,
        };
      }

      const playerAge = calculateAge(player.birth_date, seasonStart);
      const currentCategory = player.team.category;

      // Find the correct category for this age
      const correctCategory = AGE_CATEGORIES.find(cat => 
        playerAge >= cat.minAge && playerAge <= cat.maxAge
      );

      if (!correctCategory || correctCategory.value === currentCategory) {
        return {
          player,
          currentCategory,
          suggestedCategory: currentCategory,
          suggestedTeamId: null,
          suggestedTeamName: null,
          playerAge,
          needsPromotion: false,
          selected: false,
        };
      }

      // Find a team with the correct category, same gender, and same sport type
      const suggestedTeam = teams.find(t => 
        t.category === correctCategory.value &&
        t.gender === player.team.gender &&
        t.sport_type === player.team.sport_type &&
        t.id !== player.team_id
      );

      return {
        player,
        currentCategory,
        suggestedCategory: correctCategory.value,
        suggestedTeamId: suggestedTeam?.id || null,
        suggestedTeamName: suggestedTeam?.name || null,
        playerAge,
        needsPromotion: true,
        selected: !!suggestedTeam,
      };
    });
  }, [players, teams, selectedSeason]);

  // Initialize promotions state
  useState(() => {
    setPromotions(calculatePromotions);
  });

  // Update promotions when calculation changes
  useMemo(() => {
    setPromotions(calculatePromotions);
  }, [calculatePromotions]);

  const playersNeedingPromotion = promotions.filter(p => p.needsPromotion);
  const playersWithTarget = playersNeedingPromotion.filter(p => p.suggestedTeamId);
  const playersWithoutTarget = playersNeedingPromotion.filter(p => !p.suggestedTeamId);

  const togglePlayerSelection = (playerId: string) => {
    setPromotions(prev => prev.map(p => 
      p.player.id === playerId ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAll = () => {
    setPromotions(prev => prev.map(p => 
      p.suggestedTeamId ? { ...p, selected: true } : p
    ));
  };

  const deselectAll = () => {
    setPromotions(prev => prev.map(p => ({ ...p, selected: false })));
  };

  const handleProcessPromotions = async () => {
    const selectedPromotions = promotions.filter(p => p.selected && p.suggestedTeamId);
    
    if (selectedPromotions.length === 0) {
      toast.error('Selecione pelo menos um jogador para promover');
      return;
    }

    setProcessing(true);

    try {
      // Update each player's team
      for (const promo of selectedPromotions) {
        const { error } = await supabase
          .from('players')
          .update({ team_id: promo.suggestedTeamId })
          .eq('id', promo.player.id);

        if (error) throw error;
      }

      toast.success(`${selectedPromotions.length} jogador(es) promovido(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['all-players-for-transition'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['team-players'] });
    } catch (error: any) {
      console.error('Error promoting players:', error);
      toast.error('Erro ao promover jogadores: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const isLoading = teamsLoading || playersLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Transição de Época</h1>
            <p className="text-muted-foreground">
              Promova jogadores para os escalões adequados à nova época
            </p>
          </div>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENT_SEASONS.map(season => (
                <SelectItem key={season} value={season}>{season}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{players?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Jogadores ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <ArrowRight className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{playersNeedingPromotion.length}</p>
                  <p className="text-sm text-muted-foreground">Precisam de promoção</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{playersWithTarget.length}</p>
                  <p className="text-sm text-muted-foreground">Com equipa disponível</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Players needing promotion with target team */}
        {playersWithTarget.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Promoções Automáticas</CardTitle>
                  <CardDescription>
                    Jogadores que podem ser movidos para equipas existentes
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Limpar seleção
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {playersWithTarget.map((promo) => (
                  <div 
                    key={promo.player.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      promo.selected ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={promo.selected}
                      onCheckedChange={() => togglePlayerSelection(promo.player.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {promo.player.number && (
                          <Badge variant="secondary">#{promo.player.number}</Badge>
                        )}
                        <span className="font-medium truncate">{promo.player.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({promo.playerAge} anos)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{promo.currentCategory}</Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="default">{promo.suggestedCategory}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground hidden md:block">
                      → {promo.suggestedTeamName}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-end">
                <Button 
                  onClick={handleProcessPromotions}
                  disabled={processing || promotions.filter(p => p.selected).length === 0}
                >
                  {processing ? 'A processar...' : 'Processar Promoções'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Players needing promotion without target team */}
        {playersWithoutTarget.length > 0 && (
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Sem Equipa Disponível
              </CardTitle>
              <CardDescription>
                Estes jogadores precisam de promoção mas não existe equipa com o escalão adequado.
                Crie as equipas necessárias primeiro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {playersWithoutTarget.map((promo) => (
                  <div 
                    key={promo.player.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-amber-500/5 border-amber-500/20"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {promo.player.number && (
                          <Badge variant="secondary">#{promo.player.number}</Badge>
                        )}
                        <span className="font-medium truncate">{promo.player.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({promo.playerAge} anos)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {promo.player.team.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{promo.currentCategory}</Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        {promo.suggestedCategory} (sem equipa)
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {playersNeedingPromotion.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tudo em ordem!</h3>
              <p className="text-muted-foreground">
                Todos os jogadores estão nos escalões corretos para a época {selectedSeason}.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
