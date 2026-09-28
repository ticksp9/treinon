import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight, Users, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AGE_CATEGORIES, getSportingAge, getSeasonStartYear, parseCalendarDate } from "@/lib/constants";
import { alignAgeGroupsToSeason, type AgeGroupRule } from "@/lib/age-group-rules";

interface SeasonTransitionTabProps {
  clubId: string;
}

interface PlayerProjection {
  playerId: string;
  playerName: string;
  playerAge: number | null;
  currentTeam: string;
  currentCategory: string | null;
  suggestedCategory: string | null;
  needsPromotion: boolean;
  hasTargetTeam: boolean;
}

export function SeasonTransitionTab({ clubId }: SeasonTransitionTabProps) {
  const navigate = useNavigate();

  // Fetch all players from the club's teams
  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: ['youth-players-projection', clubId],
    queryFn: async () => {
      // First get all teams for this club
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, category, club_id')
        .eq('club_id', clubId);

      if (teamsError) throw teamsError;
      if (!teams || teams.length === 0) return [];

      const teamIds = teams.map(t => t.id);
      const teamMap = new Map(teams.map(t => [t.id, t]));

      // Get all active players from these teams
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name, birth_date, team_id')
        .in('team_id', teamIds)
        .eq('is_active', true);

      if (playersError) throw playersError;
      
      return (playersData || []).map(p => ({
        ...p,
        team: teamMap.get(p.team_id)
      }));
    },
    enabled: !!clubId
  });

  // Fetch youth teams for target matching
  const { data: youthTeams } = useQuery({
    queryKey: ['youth-teams-for-transition', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_teams')
        .select(`
          id,
          name,
          youth_age_groups (id, name, min_birth_year, max_birth_year)
        `)
        .eq('club_id', clubId)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
    enabled: !!clubId
  });

  // Calculate projections
  const projections = useMemo(() => {
    if (!players) return [];

    // Next season relative to the one running today (season starts in July)
    const nextSeasonStartYear = getSeasonStartYear() + 1;

    return players.map(player => {
      if (!player.birth_date || !player.team) {
        return {
          playerId: player.id,
          playerName: player.name,
          playerAge: null,
          currentTeam: player.team?.name || 'N/A',
          currentCategory: player.team?.category || null,
          suggestedCategory: null,
          needsPromotion: false,
          hasTargetTeam: false
        } as PlayerProjection;
      }

      const playerAge = getSportingAge(player.birth_date, nextSeasonStartYear) ?? 0;
      const currentCategory = player.team.category;

      // Find the correct category for this age
      const correctCategory = AGE_CATEGORIES.find(cat =>
        playerAge >= cat.minAge && playerAge <= cat.maxAge
      );

      const needsPromotion = correctCategory && correctCategory.value !== currentCategory;

      // Check if there's a youth team for the suggested category
      const hasTargetTeam = needsPromotion && youthTeams?.some(yt => {
        if (!yt.youth_age_groups) return false;
        const birthYear = parseCalendarDate(player.birth_date)!.getFullYear();
        const [win] = alignAgeGroupsToSeason([{ id: '', code: '', ...yt.youth_age_groups } as AgeGroupRule], nextSeasonStartYear);
        return birthYear >= (win.min_birth_year ?? -Infinity) && 
               birthYear <= (win.max_birth_year ?? Infinity);
      });

      return {
        playerId: player.id,
        playerName: player.name,
        playerAge,
        currentTeam: player.team.name,
        currentCategory,
        suggestedCategory: correctCategory?.value || null,
        needsPromotion: !!needsPromotion,
        hasTargetTeam: !!hasTargetTeam
      } as PlayerProjection;
    });
  }, [players, youthTeams]);

  const playersNeedingPromotion = projections.filter(p => p.needsPromotion);
  const playersWithTarget = playersNeedingPromotion.filter(p => p.hasTargetTeam);
  const playersWithoutTarget = playersNeedingPromotion.filter(p => !p.hasTargetTeam);

  // Group by category for summary
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, { current: number; incoming: number }>();
    
    projections.forEach(p => {
      if (p.currentCategory) {
        const current = groups.get(p.currentCategory) || { current: 0, incoming: 0 };
        current.current++;
        groups.set(p.currentCategory, current);
      }
      
      if (p.needsPromotion && p.suggestedCategory) {
        const incoming = groups.get(p.suggestedCategory) || { current: 0, incoming: 0 };
        incoming.incoming++;
        groups.set(p.suggestedCategory, incoming);
      }
    });
    
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projections]);

  if (playersLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">A carregar projeções...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jogadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projections.length}</div>
            <p className="text-xs text-muted-foreground">Ativos no clube</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precisam de Promoção</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playersNeedingPromotion.length}</div>
            <p className="text-xs text-muted-foreground">
              {playersWithTarget.length} com equipa disponível
            </p>
          </CardContent>
        </Card>

        <Card className={playersWithoutTarget.length > 0 ? "border-amber-500" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Equipa Destino</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${playersWithoutTarget.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${playersWithoutTarget.length > 0 ? 'text-amber-500' : ''}`}>
              {playersWithoutTarget.length}
            </div>
            <p className="text-xs text-muted-foreground">Criar equipas necessárias</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Flow Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Previsão por Escalão</CardTitle>
          <CardDescription>
            Movimentação esperada para a próxima época
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoryGroups.length > 0 ? (
            <div className="space-y-3">
              {categoryGroups.map(([category, counts]) => (
                <div key={category} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="min-w-[80px] justify-center">
                      {category}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {counts.current} jogadores atuais
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {counts.incoming > 0 && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        +{counts.incoming} a entrar
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Sem dados de jogadores para projeção.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Players needing promotion */}
      {playersNeedingPromotion.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Jogadores a Promover</CardTitle>
                <CardDescription>
                  Mudanças de escalão na próxima época
                </CardDescription>
              </div>
              <Button onClick={() => navigate('/season-transition')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ir para Transição
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {playersNeedingPromotion.slice(0, 20).map((player) => (
                <div 
                  key={player.playerId}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    player.hasTargetTeam ? 'bg-green-500/5 border-green-500/30' : 'bg-amber-500/5 border-amber-500/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{player.playerName}</span>
                      {player.playerAge && (
                        <span className="text-sm text-muted-foreground">
                          ({player.playerAge} anos)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {player.currentTeam}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{player.currentCategory}</Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant={player.hasTargetTeam ? "default" : "secondary"}>
                      {player.suggestedCategory}
                    </Badge>
                  </div>
                  {player.hasTargetTeam ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
              ))}
              {playersNeedingPromotion.length > 20 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  E mais {playersNeedingPromotion.length - 20} jogadores...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {playersNeedingPromotion.length === 0 && projections.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Tudo em ordem!</h3>
            <p className="text-muted-foreground">
              Todos os jogadores estão nos escalões corretos para a próxima época.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
