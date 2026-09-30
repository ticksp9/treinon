import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Users, Edit, Trash2, Trophy } from 'lucide-react';
import { SPORT_TYPES, SportType, AGE_CATEGORIES, CURRENT_SEASONS, GENDERS, Gender } from '@/lib/constants';
import { DEFAULTS } from '@/lib/app-config';
import { TeamWithCount, TeamFormData } from '@/lib/types';
import { fetchTeamsWithCounts, queryKeys } from '@/lib/query-helpers';
import { EmptyState, PageLoadingSkeleton } from '@/components/ui/page-states';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useSportScope } from '@/hooks/useSportScope';
import { useUserRole } from '@/hooks/useUserRole';
import { filterSportTypes, defaultSportType, isSportAllowed } from '@/lib/sport-scope';
import { Skeleton } from '@/components/ui/skeleton';
import { useSeasonContext, useSeasonsList } from '@/hooks/useSeasonContext';
import {
  ensureTeamMembership,
  fetchSeasonTeamIds,
  filterTeamsForSeason,
  importTeamsFromPreviousSeason,
  teamSeasonLabel,
} from '@/lib/team-season-service';
import { countActiveEnrollmentsByTeam } from '@/lib/season-roster-service';


const teamSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  sport_type: z.enum(['football_5', 'football_7', 'football_9', 'football_11', 'futsal']),
  gender: z.enum(['male', 'female']),
  category: z.string().optional(),
  season: z.string(),
  formation: z.string().optional(),
});

export default function Teams() {
  const { user } = useAuth();
  const { scope: sportScope } = useSportScope();
  const { clubId } = useUserRole();
  const defaultTeamSport = isSportAllowed(sportScope, DEFAULTS.sportType) ? DEFAULTS.sportType : defaultSportType(sportScope);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithCount | null>(null);

  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    sport_type: DEFAULTS.sportType,
    gender: DEFAULTS.gender,
    category: '',
    season: DEFAULTS.season,
    formation: '',
  });

  const { selectedSeasonId, selectedSeason } = useSeasonContext();
  const { data: seasons = [] } = useSeasonsList();
  const [formSeasonId, setFormSeasonId] = useState<string | null>(null);

  const { data: teams, isLoading } = useQuery({
    queryKey: queryKeys.teamsWithCounts,
    queryFn: fetchTeamsWithCounts,
    enabled: !!user,
  });

  const { data: membershipTeamIds = [] } = useQuery({
    queryKey: ['season-team-memberships', selectedSeasonId],
    queryFn: () => fetchSeasonTeamIds(selectedSeasonId!),
    enabled: !!selectedSeasonId,
  });

  // Active-enrollment counts of the selected season (never global players).
  const { data: enrollmentCounts } = useQuery({
    queryKey: ['season-enrollment-counts', selectedSeasonId],
    queryFn: () => countActiveEnrollmentsByTeam(selectedSeasonId!),
    enabled: !!selectedSeasonId,
  });



  const seasonName = selectedSeason?.name ?? null;
  const visibleTeams = filterTeamsForSeason(
    (teams ?? []) as unknown as (TeamWithCount & { season_id?: string | null })[],
    seasonName,
    membershipTeamIds,
  );

  const previousSeason = seasons
    .filter((s) => s.id !== selectedSeasonId && (!selectedSeason || s.start_date < selectedSeason.start_date))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];

  // A futsal-only coach starts new teams in futsal (and a football coach in football)
  useEffect(() => {
    if (!editingTeam && !isSportAllowed(sportScope, formData.sport_type)) {
      setFormData((d) => ({ ...d, sport_type: defaultTeamSport, formation: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportScope]);

  const resetForm = () => {
    setFormData({
      name: '',
      sport_type: defaultTeamSport,
      gender: DEFAULTS.gender,
      category: '',
      season: seasonName || DEFAULTS.season,
      formation: '',
    });
    setFormSeasonId(selectedSeasonId);
    setEditingTeam(null);
  };

  const openEditDialog = (team: TeamWithCount) => {
    setEditingTeam(team);
    const teamSeasonId =
      (team as unknown as { season_id?: string | null }).season_id ??
      seasons.find((s) => s.name === team.season)?.id ??
      null;
    setFormSeasonId(teamSeasonId);
    setFormData({
      name: team.name,
      sport_type: team.sport_type as string,
      gender: (team.gender || 'male') as string,
      category: team.category || '',
      season: team.season,
      formation: team.formation || '',
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      if (!user) throw new Error('Não autenticado');
      const chosenSeason = seasons.find((s) => s.id === formSeasonId) ?? null;
      const payload: TeamFormData = { ...data, season: chosenSeason?.name ?? data.season };
      teamSchema.parse(payload);
      const teamData = {
        name: payload.name,
        sport_type: payload.sport_type,
        gender: payload.gender,
        category: payload.category || null,
        season: payload.season,
        season_id: chosenSeason?.id ?? null,
        formation: payload.formation || SPORT_TYPES[payload.sport_type as SportType]?.formations[0],
        owner_id: user.id,
      };
      let teamId = editingTeam?.id ?? null;
      if (editingTeam) {
        const { error } = await supabase.from('teams').update(teamData).eq('id', editingTeam.id);
        if (error) throw error;
      } else {
        // in a club, new teams belong to the club (so the club can invite its coaches)
        const { data: inserted, error } = await supabase.from('teams').insert({ ...teamData, club_id: clubId ?? null }).select('id').single();
        if (error) throw error;
        teamId = inserted.id;
      }
      // Season association lives in season_team_memberships (idempotent).
      if (teamId && chosenSeason) {
        await ensureTeamMembership(chosenSeason.id, teamId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamsWithCounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams });
      queryClient.invalidateQueries({ queryKey: ['season-team-memberships'] });
      toast.success(editingTeam ? 'Equipa atualizada com sucesso' : 'Equipa criada com sucesso');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error('[Teams] save failed', error);
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || 'Erro ao guardar equipa');
      }
    },
  });

  const importTeamsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSeasonId) throw new Error('Nenhuma época selecionada.');
      if (!previousSeason) throw new Error('Não existe época anterior.');
      return importTeamsFromPreviousSeason(previousSeason.id, selectedSeasonId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['season-team-memberships'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamsWithCounts });
      toast.success(`${result.imported} equipas associadas a ${seasonName ?? 'esta época'}.`);
    },
    onError: (error: Error) => {
      console.error('[Teams] import failed', error);
      toast.error(error.message || 'Erro ao trazer equipas');
    },
  });


  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamsWithCounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams });
      toast.success('Equipa eliminada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao eliminar equipa');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleDelete = (teamId: string) => {
    if (!confirm('Tem certeza que deseja eliminar esta equipa? Esta ação não pode ser desfeita.')) return;
    deleteMutation.mutate(teamId);
  };

  const availableFormations = SPORT_TYPES[formData.sport_type as SportType]?.formations || [];

  return (
    <AppLayout title="Equipas">
      <div className="space-y-6">
        <PageHeader
          title="As Minhas Equipas"
          description="Gerencie as suas equipas de futebol e futsal"
          icon={<Users className="w-6 h-6 text-primary" />}
          actions={
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Equipa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle className="font-display">
                      {editingTeam ? 'Editar Equipa' : 'Criar Nova Equipa'}
                    </DialogTitle>
                    <DialogDescription>
                      Preencha os dados da equipa. Pode criar equipas para diferentes modalidades.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Equipa *</Label>
                      <Input
                        id="name"
                        placeholder="Ex: Juvenis A"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sport_type">Modalidade *</Label>
                      <Select
                        value={formData.sport_type}
                        onValueChange={(value: string) => setFormData({ 
                          ...formData, 
                          sport_type: value,
                          formation: SPORT_TYPES[value as SportType]?.formations[0] || ''
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a modalidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterSportTypes(sportScope, Object.keys(SPORT_TYPES) as SportType[]).map((type) => (
                            <SelectItem key={type} value={type}>
                              {SPORT_TYPES[type].label} ({SPORT_TYPES[type].players} jogadores)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Género</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value: string) => setFormData({ ...formData, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o género" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Escalão</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {AGE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="season">Época *</Label>
                        {seasons.length > 0 ? (
                          <Select
                            value={formSeasonId ?? ''}
                            onValueChange={(value) => {
                              setFormSeasonId(value);
                              const s = seasons.find((x) => x.id === value);
                              if (s) setFormData({ ...formData, season: s.name });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a época" />
                            </SelectTrigger>
                            <SelectContent>
                              {seasons.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                  {s.is_active ? ' (ativa)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={formData.season}
                            onValueChange={(value) => setFormData({ ...formData, season: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENT_SEASONS.map((season) => (
                                <SelectItem key={season} value={season}>
                                  {season}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="formation">Formação</Label>
                      <Select
                        value={formData.formation}
                        onValueChange={(value) => setFormData({ ...formData, formation: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a formação" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFormations.map((formation) => (
                            <SelectItem key={formation} value={formation}>
                              {formation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? 'A guardar...' : editingTeam ? 'Guardar' : 'Criar Equipa'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Teams Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : visibleTeams.length === 0 ? (
          <EmptyState
            icon={
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Trophy className="w-7 h-7 text-primary" />
              </div>
            }
            title={seasonName ? 'Esta época ainda não tem equipas.' : 'Crie a sua primeira equipa'}
            description={
              seasonName
                ? 'Crie uma equipa nesta época ou traga as equipas da época anterior (sem duplicar).'
                : 'Comece por criar uma equipa para depois adicionar jogadores e gerir jogos.'
            }
            action={{
              label: 'Criar Equipa',
              onClick: () => setDialogOpen(true),
            }}
          >
            {seasonName && previousSeason && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={importTeamsMutation.isPending}
                onClick={() => importTeamsMutation.mutate()}
              >
                {importTeamsMutation.isPending
                  ? 'A associar...'
                  : `Trazer equipas de ${previousSeason.name}`}
              </Button>
            )}
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleTeams.map((team) => (
              <Card 
                key={team.id} 
                className="border-border/50 hover:border-primary/20 transition-all hover:shadow-md cursor-pointer group"
                onClick={() => navigate(`/teams/${team.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="font-display text-base">{team.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {teamSeasonLabel(team, seasonName, membershipTeamIds)}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(team);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(team.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {SPORT_TYPES[team.sport_type as SportType]?.label || team.sport_type}
                    </Badge>
                    <Badge variant={team.gender === 'female' ? 'default' : 'outline'} className="text-xs">
                      {team.gender === 'female' ? 'Feminino' : 'Masculino'}
                    </Badge>
                    {team.category && (
                      <Badge variant="outline" className="text-xs">{team.category}</Badge>
                    )}
                    {team.formation && (
                      <Badge variant="outline" className="text-xs">{team.formation}</Badge>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      {(selectedSeasonId ? enrollmentCounts?.get(team.id) ?? 0 : team.players_count || 0)} jogadores
                    </span>
                    <span className="text-primary text-xs font-medium group-hover:underline">
                      Ver detalhes →
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
