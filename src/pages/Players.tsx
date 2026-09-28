import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Search, Users, Filter, AlertTriangle, Target, UserPlus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlayerCard } from '@/components/players/PlayerCard';
import { PlayerForm } from '@/components/players/PlayerForm';
import { AGE_CATEGORIES, canPlayerPlayInCategory, Gender } from '@/lib/constants';
import { sanitizePlayerPayload, queryKeys } from '@/lib/query-helpers';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { classifyEnrollmentEligibility, type AgeGroupRule } from '@/lib/age-group-rules';
import {
  importRosterFromPreviousSeason,
  addPlayerToTeam,
  removePlayerFromTeam,
  listAvailablePlayersForTeam,
} from '@/lib/season-roster-service';
import { PlayerWithTeam } from '@/lib/types';
import { EmptyState } from '@/components/ui/page-states';


interface Team {
  id: string;
  name: string;
  sport_type: string;
  gender: Gender;
  category: string | null;
}

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  birth_date: string | null;
  is_active: boolean;
  photo_url: string | null;
  team_id: string;
  gender: 'male' | 'female';
  team?: Team;
}

export default function Players() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedSeasonId = useSelectedSeasonId();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addSelected, setAddSelected] = useState<string[]>([]);

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport_type, gender, category')
        .order('name');
      if (error) throw error;
      return data.map(t => ({
        ...t,
        gender: (t.gender || 'male') as Gender
      })) as Team[];
    },
    enabled: !!user,
  });

  // Age groups: used to flag legacy enrollments outside the player's age group.
  const { data: ageGroups } = useQuery({
    queryKey: ['academy-age-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academy_age_groups')
        .select('id, code, name, min_birth_year, max_birth_year, display_order, is_active');
      if (error) throw error;
      return (data || []) as AgeGroupRule[];
    },
    enabled: !!user,
  });

  // Season roster: strictly the enrollments of the selected season.
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['season-enrollments', selectedSeasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_player_enrollments' as any)
        .select('player_id, age_group_id, team_id')
        .eq('season_id', selectedSeasonId as string)
        .eq('status', 'active');
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user && !!selectedSeasonId,
  });

  // A player may hold several active enrollments in the season (one per team).
  const enrollmentsByPlayer = useMemo(() => {
    const map = new Map<string, { age_group_id: string | null; team_id: string | null }[]>();
    (enrollments || []).forEach((e: any) => {
      const list = map.get(e.player_id) || [];
      list.push(e);
      map.set(e.player_id, list);
    });
    return map;
  }, [enrollments]);

  const { data: players, isLoading: loadingPlayers } = useQuery({
    queryKey: ['players', selectedTeamId, selectedSeasonId, enrollments?.length ?? 0],
    queryFn: async () => {
      // No silent fallback: with a season selected the roster is exactly its
      // active enrollments (possibly empty). Team scoping also uses enrollments.
      const enrolledIds = selectedSeasonId
        ? (enrollments || [])
            .filter((e: any) => selectedTeamId === 'all' || e.team_id === selectedTeamId)
            .map((e: any) => e.player_id)
        : null;
      if (selectedSeasonId && (!enrolledIds || enrolledIds.length === 0)) return [] as Player[];

      let query = supabase
        .from('players')
        .select(`*, team:teams(id, name, sport_type, gender, category)`)
        .order('name');
      if (enrolledIds) {
        query = query.in('id', Array.from(new Set(enrolledIds)));
      } else if (selectedTeamId !== 'all') {
        // Legacy fallback (no season created yet).
        query = query.eq('team_id', selectedTeamId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data.map(p => ({
        ...p,
        gender: (p.gender || 'male') as 'male' | 'female',
        team: p.team ? { ...p.team, gender: (p.team.gender || 'male') as Gender } : undefined
      })) as Player[];
    },
    enabled: !!user && (!selectedSeasonId || enrollments !== undefined),
  });

  const isLoading = loadingPlayers || (!!selectedSeasonId && loadingEnrollments);


  // One-click import of the previous season roster (eligibility aware).
  const importRoster = useMutation({
    mutationFn: () => importRosterFromPreviousSeason(selectedSeasonId as string),
    onSuccess: (res) => {
      toast.success(
        `Importados ${res.imported} jogadores; ${res.promoted} subiram de escalão; ${res.needsAttention} requerem atenção (sem data de nascimento).`,
      );
      queryClient.invalidateQueries({ queryKey: ['season-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
    onError: (e: Error) => {
      console.error('[players] importar plantel falhou', e);
      toast.error(e.message);
    },
  });


  const { data: injuriesByPlayer } = useQuery({
    queryKey: ['active-injuries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_injuries')
        .select('id, player_id, injury_date, return_date, expected_return_date, clinical_status, can_play, restrictions, severity');
      if (error) throw error;
      const map = new Map<string, any[]>();
      for (const inj of data || []) {
        const arr = map.get(inj.player_id) || [];
        arr.push(inj);
        map.set(inj.player_id, arr);
      }
      return map;
    },
    enabled: !!user,
  });

  const createPlayer = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!user) throw new Error('Utilizador não autenticado');
      const teamId = (data.team_id || selectedTeamId) as string;
      if (!teamId || teamId === 'all') throw new Error('Selecione uma equipa');
      const { team_id: _, ...playerData } = data;
      const cleaned = sanitizePlayerPayload(playerData);
      const { data: inserted, error } = await supabase
        .from('players')
        .insert({ ...cleaned, team_id: teamId, owner_id: user.id } as any)
        .select('id')
        .single();
      if (error) throw error;
      // The season roster lives in enrollments, not in players.team_id.
      if (selectedSeasonId && inserted?.id) {
        await addPlayerToTeam(selectedSeasonId, teamId, inserted.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['season-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['team-players'] });
      toast.success('Jogador criado com sucesso!');
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao criar jogador: ' + error.message);
    },
  });

  const teamScoped = !!selectedSeasonId && selectedTeamId !== 'all';

  const removeFromTeam = useMutation({
    mutationFn: (playerId: string) =>
      removePlayerFromTeam(selectedSeasonId as string, selectedTeamId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['team-players'] });
      queryClient.invalidateQueries({ queryKey: ['available-players'] });
      queryClient.invalidateQueries({ queryKey: ['season-enrollment-counts'] });
      queryClient.invalidateQueries({ queryKey: ['seasons-list'] });
      queryClient.invalidateQueries({ queryKey: ['season-context'] });
      queryClient.invalidateQueries({ queryKey: ['season-counts'] });
      toast.success('Jogador removido da equipa nesta época (histórico mantido).');
    },

    onError: (e: Error) => {
      console.error('[players] remover da equipa falhou', e);
      toast.error(e.message);
    },
  });

  const { data: availablePlayers, isLoading: loadingAvailable } = useQuery({
    queryKey: ['available-players', selectedSeasonId, selectedTeamId],
    queryFn: () => listAvailablePlayersForTeam(selectedSeasonId as string, selectedTeamId),
    enabled: addExistingOpen && teamScoped,
  });

  const addExisting = useMutation({
    mutationFn: async (playerIds: string[]) => {
      for (const playerId of playerIds) {
        await addPlayerToTeam(selectedSeasonId as string, selectedTeamId, playerId);
      }
      return playerIds.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['season-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['available-players'] });
      queryClient.invalidateQueries({ queryKey: ['team-players'] });
      queryClient.invalidateQueries({ queryKey: ['season-enrollment-counts'] });
      queryClient.invalidateQueries({ queryKey: ['seasons-list'] });
      queryClient.invalidateQueries({ queryKey: ['season-context'] });
      queryClient.invalidateQueries({ queryKey: ['season-counts'] });
      setAddSelected([]);
      setAddExistingOpen(false);
      toast.success(n === 1 ? '1 jogador adicionado à equipa.' : `${n} jogadores adicionados à equipa.`);
    },
    onError: (e: Error) => {
      console.error('[players] adicionar jogador existente falhou', e);
      toast.error(e.message);
    },
  });



  const updatePlayer = useMutation({
    mutationFn: async (data: any) => {
      if (!editingPlayer) return;
      const cleaned = sanitizePlayerPayload(data);
      const { error } = await supabase.from('players').update(cleaned).eq('id', editingPlayer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Jogador atualizado!');
      setEditingPlayer(null);
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const deletePlayer = useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase.from('players').delete().eq('id', playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Jogador removido');
    },
  });

  const filteredPlayers = players?.filter(player =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const playersGroupedByCategory = useMemo(() => {
    if (!filteredPlayers) return {};
    const grouped: Record<string, { players: typeof filteredPlayers; team: Team | undefined }> = {};
    filteredPlayers.forEach(player => {
      const category = player.team?.category || 'Sem Escalão';
      if (!grouped[category]) {
        grouped[category] = { players: [], team: player.team };
      }
      grouped[category].players.push(player);
    });
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const catA = AGE_CATEGORIES.find(c => c.value === a);
      const catB = AGE_CATEGORIES.find(c => c.value === b);
      if (!catA && !catB) return 0;
      if (!catA) return 1;
      if (!catB) return -1;
      return catA.maxAge - catB.maxAge;
    });
    const sortedGrouped: typeof grouped = {};
    sortedCategories.forEach(cat => { sortedGrouped[cat] = grouped[cat]; });
    return sortedGrouped;
  }, [filteredPlayers]);

  const checkPlayerEligibility = (player: Player) => {
    if (!player.birth_date || !player.team?.category) {
      return { eligible: true, reason: undefined };
    }
    const playerIsFemale = player.gender === 'female';
    return canPlayerPlayInCategory(player.birth_date, player.team.category, player.team.gender || 'male', playerIsFemale);
  };

  const handleSubmit = (data: any) => {
    if (editingPlayer) {
      updatePlayer.mutate(data);
    } else {
      createPlayer.mutate(data);
    }
  };

  const openCreateDialog = () => { setEditingPlayer(null); setDialogOpen(true); };
  const openEditDialog = (player: Player) => { setEditingPlayer(player); setDialogOpen(true); };

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);
  const showTeamSelector = selectedTeamId === 'all' || !selectedTeamId;

  return (
    <AppLayout title="Jogadores">
      <div className="space-y-6">
        <PageHeader
          title="Jogadores"
          description={`${filteredPlayers?.length || 0} jogador(es) registados`}
          icon={<Target className="w-6 h-6 text-primary" />}
          actions={
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingPlayer(null);
            }}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Jogador
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">
                    {editingPlayer ? 'Editar Jogador' : 'Novo Jogador'}
                  </DialogTitle>
                </DialogHeader>
                <PlayerForm
                  defaultValues={editingPlayer ? {
                    name: editingPlayer.name,
                    number: editingPlayer.number,
                    position: editingPlayer.position || '',
                    birth_date: editingPlayer.birth_date || '',
                    team_id: editingPlayer.team_id,
                  } : undefined}
                  onSubmit={handleSubmit}
                  isLoading={createPlayer.isPending || updatePlayer.isPending}
                  sportType={selectedTeam?.sport_type || editingPlayer?.team?.sport_type}
                  teams={teams}
                  showTeamSelector={showTeamSelector && !editingPlayer}
                  selectedTeamId={selectedTeamId !== 'all' ? selectedTeamId : undefined}
                />
              </DialogContent>
            </Dialog>
          }
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar jogador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas as equipas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as equipas</SelectItem>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {teamScoped && (
            <Dialog open={addExistingOpen} onOpenChange={(open) => { setAddExistingOpen(open); if (!open) { setAddSearch(''); setAddSelected([]); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="sm:self-center">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar jogador existente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">Adicionar jogador existente</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Pesquisar por nome..."
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                  />
                  {loadingAvailable ? (
                    <Skeleton className="h-24 rounded-xl" />
                  ) : (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                      {(availablePlayers || [])
                        .filter((p) => p.name.toLowerCase().includes(addSearch.toLowerCase()))
                        .map((p) => {
                          const alsoIn = p.also_in_team_ids
                            .map((tid) => teams?.find((t) => t.id === tid)?.name)
                            .filter(Boolean) as string[];
                          const checked = addSelected.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-3 rounded-lg border p-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  setAddSelected((prev) =>
                                    v ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                                  )
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                {alsoIn.length > 0 && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    também em: {alsoIn.join(', ')}
                                  </Badge>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      {(availablePlayers || []).length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Todos os jogadores já estão inscritos nesta equipa.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setAddExistingOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={addSelected.length === 0 || addExisting.isPending}
                      onClick={() => {
                        const cat = selectedTeam?.category;
                        if (cat) {
                          const risky = (availablePlayers || [])
                            .filter((p) => addSelected.includes(p.id))
                            .filter((p) => {
                              if (!p.birth_date) return true;
                              return !canPlayerPlayInCategory(
                                p.birth_date,
                                cat,
                                (selectedTeam?.gender as 'male' | 'female') || 'male',
                                false,
                              ).eligible;
                            });
                          if (risky.length > 0) {
                            const ok = confirm(
                              `${risky.map((p) => p.name).join(', ')} está fora da idade do escalão (ou sem data de nascimento). Adicionar mesmo assim?`,
                            );
                            if (!ok) return;
                          }
                        }
                        addExisting.mutate(addSelected);
                      }}
                    >
                      Adicionar {addSelected.length > 0 ? `(${addSelected.length})` : ''}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          )}
        </div>


        {/* Players List */}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : filteredPlayers && filteredPlayers.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(playersGroupedByCategory).map(([category, { players: categoryPlayers, team }]) => (
              <Card key={category} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      {category}
                      {team && (
                        <Badge variant={team.gender === 'female' ? 'default' : 'secondary'} className="text-xs">
                          {team.gender === 'female' ? 'Feminino' : 'Masculino'}
                        </Badge>
                      )}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">{categoryPlayers.length} jogador(es)</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {categoryPlayers.map((player) => {
                      const eligibility = checkPlayerEligibility(player);
                      const playerInjuries = injuriesByPlayer?.get(player.id) || [];
                      const playerEnrollments = enrollmentsByPlayer.get(player.id) || [];
                      const enrollment =
                        (teamScoped
                          ? playerEnrollments.find((e) => e.team_id === selectedTeamId)
                          : playerEnrollments[0]) ?? null;
                      const shared = playerEnrollments.filter((e) => !!e.team_id).length > 1;
                      const enrolledGroup = enrollment?.age_group_id
                        ? (ageGroups || []).find((g) => g.id === enrollment.age_group_id) ?? null
                        : null;
                      const outOfGroup =
                        classifyEnrollmentEligibility(player.birth_date, enrolledGroup) === 'out_of_group';
                      return (
                        <div key={player.id} className="relative">
                          {!eligibility.eligible && (
                            <div className="absolute -top-2 -right-2 z-10" title={eligibility.reason}>
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                Inelegível
                              </Badge>
                            </div>
                          )}
                          {eligibility.eligible && outOfGroup && (
                            <div
                              className="absolute -top-2 -right-2 z-10"
                              title={`Nascido em ${player.birth_date?.slice(0, 4)} — fora do escalão ${enrolledGroup?.name ?? ''}`}
                            >
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                Fora do escalão
                              </Badge>
                            </div>
                          )}
                          {shared && (
                            <div
                              className="absolute -top-2 left-2 z-10"
                              title={`Também em: ${playerEnrollments
                                .filter((e) => e.team_id && e.team_id !== selectedTeamId)
                                .map((e) => teams?.find((t) => t.id === e.team_id)?.name)
                                .filter(Boolean)
                                .join(', ')}`}
                            >
                              <Badge variant="secondary" className="text-xs">Partilhado</Badge>
                            </div>
                          )}

                          <PlayerCard
                            player={player}
                            sportType={player.team?.sport_type}
                            injuries={playerInjuries}
                            onEdit={() => openEditDialog(player)}
                            onRemoveFromTeam={
                              teamScoped
                                ? () => {
                                    if (
                                      confirm(
                                        `Remover ${player.name} da equipa nesta época? O histórico é mantido.`,
                                      )
                                    ) {
                                      removeFromTeam.mutate(player.id);
                                    }
                                  }
                                : undefined
                            }
                            onDelete={() => {
                              if (confirm('Tem a certeza que pretende remover este jogador?')) {
                                deletePlayer.mutate(player.id);
                              }
                            }}
                            onView={() => navigate(`/players/${player.id}`)}
                          />

                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : selectedSeasonId && !searchQuery && (enrollments?.length ?? 0) === 0 ? (
          <div className="text-center py-10 space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base">Sem jogadores nesta época</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {teamScoped
                  ? 'Esta época ainda não tem jogadores inscritos nesta equipa.'
                  : 'Esta época ainda não tem jogadores inscritos.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {teamScoped && (
                <Button size="sm" variant="outline" onClick={() => setAddExistingOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar jogador existente
                </Button>
              )}
              <Button size="sm" onClick={() => importRoster.mutate()} disabled={importRoster.isPending}>
                {importRoster.isPending ? 'A importar…' : 'Importar plantel da época anterior'}
              </Button>
              <Button variant="outline" size="sm" onClick={openCreateDialog}>Novo Jogador</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/seasons/transition')}>
                Ir para Transição de época
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
            }
            title={searchQuery ? 'Nenhum jogador encontrado' : 'Sem jogadores'}
            description={searchQuery
              ? 'Tente uma pesquisa diferente'
              : selectedTeamId === 'all'
                ? 'Selecione uma equipa e adicione o primeiro jogador'
                : 'Adicione o primeiro jogador a esta equipa'}
            action={!searchQuery && selectedTeamId !== 'all' ? {
              label: 'Adicionar Jogador',
              onClick: openCreateDialog,
            } : undefined}
          />
        )}

      </div>
    </AppLayout>
  );
}
