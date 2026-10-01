import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Users, User, UserPlus, X, Timer } from 'lucide-react';
import { MatchConfigModal } from '@/components/matches/MatchConfigModal';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { SPORT_TYPES, SportType, AGE_CATEGORIES, GENDERS, canPlayerPlayInCategory, getHalfDurationForCategory } from '@/lib/constants';
import { PlayerForm } from '@/components/players/PlayerForm';
import { differenceInYears } from 'date-fns';
import { useSeasonContext } from '@/hooks/useSeasonContext';
import { fetchSeasonTeamIds, teamSeasonLabel } from '@/lib/team-season-service';
import { SquadDepth } from '@/components/teams/SquadDepth';
import { StaffInviteDialog, PendingStaffInvites, type StaffInviteType } from '@/components/invites/StaffInviteDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { TeamStaffPanel } from '@/components/teams/TeamStaffPanel';
import {
  getTeamRoster,
  addPlayerToTeam,
  listAvailablePlayersForTeam,
  removePlayerFromTeam,
} from '@/lib/season-roster-service';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  birth_date: string | null;
  photo_url: string | null;
  is_active: boolean;
  gender: 'male' | 'female';
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [addingExisting, setAddingExisting] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { selectedSeasonId, selectedSeason } = useSeasonContext();

  // Season association is resolved via memberships (teams.season is legacy fallback).
  const { data: membershipTeamIds = [] } = useQuery({
    queryKey: ['season-team-memberships', selectedSeasonId],
    queryFn: () => fetchSeasonTeamIds(selectedSeasonId!),
    enabled: !!selectedSeasonId,
  });

  const { isClubAdmin, staffRole } = useUserRole();
  const [staffInviteOpen, setStaffInviteOpen] = useState(false);
  // my role in this team: head coaches invite their assistants
  const { data: myTeamRole } = useQuery({
    queryKey: ['my-team-role', id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data } = await supabase.from('team_coaches').select('role').eq('team_id', id as string).eq('coach_id', user!.id).maybeSingle();
      return (data?.role as string | undefined) ?? null;
    },
  });

  // Fetch team data
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return {
        ...data,
        sport_type: data.sport_type as SportType,
        gender: (data.gender || 'male') as 'male' | 'female',
      };
    },
    enabled: !!id,
  });

  // Roster: with a season selected it is exactly the active enrollments of this
  // team in that season; players.team_id remains a legacy fallback only.
  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ['team-players', id, selectedSeasonId],
    queryFn: async () => {
      let playerIds: string[] | null = null;
      if (selectedSeasonId) {
        const roster = await getTeamRoster(selectedSeasonId, id as string);
        playerIds = roster.map((r) => r.player_id);
        if (playerIds.length === 0) return [] as Player[];
      }

      let query = supabase
        .from('players')
        .select('id, name, number, position, birth_date, photo_url, is_active, gender')
        .order('number', { ascending: true });
      query = playerIds ? query.in('id', playerIds) : query.eq('team_id', id as string);

      const { data, error } = await query;
      if (error) throw error;
      return data.map(p => ({ ...p, gender: (p.gender || 'male') as 'male' | 'female' })) as Player[];
    },
    enabled: !!id,
  });

  // Season teams (names) to label shared players.
  const { data: seasonTeams = [] } = useQuery({
    queryKey: ['season-teams-names', selectedSeasonId],
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('id, name');
      if (error) throw error;
      return data || [];
    },
  });
  const teamName = (tid: string) => seasonTeams.find((t) => t.id === tid)?.name ?? 'Outra equipa';

  // Active enrollments of the season → shared-player badge.
  const { data: seasonEnrollments = [] } = useQuery({
    queryKey: ['season-enrollments', selectedSeasonId],
    enabled: !!selectedSeasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_player_enrollments' as never)
        .select('player_id, team_id')
        .eq('season_id', selectedSeasonId!)
        .eq('status', 'active');
      if (error) throw error;
      return (data as unknown as Array<{ player_id: string; team_id: string | null }>) || [];
    },
  });
  const playerTeams = (playerId: string) =>
    seasonEnrollments.filter((e) => e.player_id === playerId && e.team_id).map((e) => e.team_id as string);

  const { data: availablePlayers = [], isLoading: availableLoading } = useQuery({
    queryKey: ['available-players', selectedSeasonId, id],
    enabled: !!selectedSeasonId && !!id && addExistingOpen,
    queryFn: () => listAvailablePlayersForTeam(selectedSeasonId!, id as string),
  });

  const refetchRoster = () => {
    queryClient.invalidateQueries({ queryKey: ['team-players', id] });
    queryClient.invalidateQueries({ queryKey: ['season-enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['available-players'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
    queryClient.invalidateQueries({ queryKey: ['team-active-counts'] });
  };

  const handleAddExisting = async () => {
    if (!selectedSeasonId || picked.length === 0) return;
    setAddingExisting(true);
    let ok = 0;
    const failed: string[] = [];
    for (const pid of picked) {
      try {
        await addPlayerToTeam(selectedSeasonId, id as string, pid);
        ok += 1;
      } catch (e: any) {
        console.error('[TeamDetail] addPlayerToTeam falhou', { pid, e });
        failed.push(availablePlayers.find((p) => p.id === pid)?.name ?? pid);
      }
    }
    setAddingExisting(false);
    setPicked([]);
    setAddExistingOpen(false);
    refetchRoster();
    if (ok > 0) toast.success(`${ok} jogador(es) adicionado(s) à equipa.`);
    if (failed.length > 0) toast.error(`Falhou: ${failed.join(', ')}`);
  };

  const handleRemoveFromTeam = async (playerId: string, name: string) => {
    if (!selectedSeasonId) return;
    if (!window.confirm(`Remover ${name} desta equipa nesta época? O histórico é mantido.`)) return;
    try {
      await removePlayerFromTeam(selectedSeasonId, id as string, playerId);
      toast.success(`${name} removido desta equipa.`);
      refetchRoster();
    } catch (e: any) {
      console.error('[TeamDetail] removePlayerFromTeam falhou', e);
      toast.error(e.message || 'Erro ao remover jogador');
    }
  };

  const handleCreatePlayer = async (data: any) => {
    if (!user || !team) return;

    setSaving(true);
    try {
      const { data: inserted, error } = await supabase
        .from('players')
        .insert({ ...data, team_id: id, owner_id: user.id })
        .select('id')
        .single();

      if (error) throw error;
      if (selectedSeasonId && inserted?.id) {
        await addPlayerToTeam(selectedSeasonId, id as string, inserted.id);
      }

      toast.success('Jogador adicionado com sucesso');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['team-players', id] });
      queryClient.invalidateQueries({ queryKey: ['season-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
    } catch (error: any) {
      console.error('Error creating player:', error);
      toast.error(error.message || 'Erro ao criar jogador');
    } finally {
      setSaving(false);
    }
  };


  const isLoading = teamLoading || playersLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!team) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Equipa não encontrada</p>
              <Button variant="link" onClick={() => navigate('/teams')}>
                Voltar à lista
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const categoryInfo = AGE_CATEGORIES.find(c => c.value === team.category);
  const genderInfo = GENDERS.find(g => g.value === team.gender);
  const rawFormat = (team as { match_format?: { parts?: unknown } | null }).match_format;
  const teamFormatParts = Array.isArray(rawFormat?.parts) && rawFormat!.parts.length > 0 ? (rawFormat!.parts as number[]) : null;

  // who can this user invite to the team's technical staff?
  const staffInviteTypes: StaffInviteType[] = (isClubAdmin || staffRole === 'coordenador') && team.club_id
    ? ['coach', 'assistant_coach']
    : myTeamRole === 'head_coach' || (!team.club_id && team.owner_id === user?.id)
      ? ['assistant_coach']
      : [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/teams')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">{team.name}</h1>
            <p className="text-muted-foreground">
              {teamSeasonLabel(team, selectedSeason?.name ?? null, membershipTeamIds)}
            </p>
          </div>
        </div>

        {/* Team Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {SPORT_TYPES[team.sport_type]?.label || team.sport_type}
              </Badge>
              <Badge variant={team.gender === 'female' ? 'default' : 'outline'}>
                {genderInfo?.label || 'Masculino'}
              </Badge>
              {categoryInfo && (
                <Badge variant="outline">
                  {categoryInfo.label} ({categoryInfo.minAge}-{categoryInfo.maxAge} anos)
                </Badge>
              )}
              {team.formation && (
                <Badge variant="outline">{team.formation}</Badge>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Formato de jogo</p>
                <p className="font-mono text-sm text-muted-foreground">
                  {teamFormatParts
                    ? `${teamFormatParts.map((m) => `${m}'`).join(' + ')} = ${teamFormatParts.reduce((s, m) => s + m, 0)} min`
                    : 'Por definir — escolha os tempos do seu campeonato'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setFormatOpen(true)}>
                <Timer className="w-4 h-4 mr-2" />
                {teamFormatParts ? 'Alterar' : 'Definir formato'}
              </Button>
            </div>
          </CardContent>
        </Card>
        {staffInviteTypes.length > 0 && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Equipa técnica</p>
                <p className="text-xs text-muted-foreground">
                  {staffInviteTypes.includes('coach') ? 'Convide o treinador principal e os adjuntos desta equipa.' : 'Convide o seu treinador adjunto.'}
                </p>
              </div>
              <Button size="sm" onClick={() => setStaffInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {staffInviteTypes.includes('coach') ? 'Convidar treinador' : 'Convidar adjunto'}
              </Button>
            </CardContent>
          </Card>
        )}
        {staffInviteTypes.length > 0 && <PendingStaffInvites teamIds={[team.id]} />}
        <TeamStaffPanel teamId={team.id} canManageAll={((isClubAdmin || staffRole === 'coordenador') && !!team.club_id) || team.owner_id === user?.id} />
        <StaffInviteDialog
          open={staffInviteOpen}
          onClose={() => setStaffInviteOpen(false)}
          teams={[{ id: team.id, name: team.name }]}
          defaultTeamId={team.id}
          allowedTypes={staffInviteTypes.length > 0 ? staffInviteTypes : ['assistant_coach']}
        />
        <MatchConfigModal
          open={formatOpen}
          onOpenChange={setFormatOpen}
          mode="team"
          matchType="championship"
          defaultPartDuration={getHalfDurationForCategory(team.category)}
          teamFormat={teamFormatParts}
          onConfirm={async ({ partMinutes }) => {
            const { error } = await supabase.from('teams').update({ match_format: { parts: partMinutes } } as never).eq('id', team.id);
            if (error) {
              toast.error('Não foi possível guardar o formato: ' + error.message);
              return;
            }
            toast.success(`Formato guardado: ${partMinutes.map((m) => `${m}'`).join(' + ')}`);
            queryClient.invalidateQueries({ queryKey: ['team', id] });
          }}
        />

        {/* Players Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">Jogadores</h2>
              <Badge variant="secondary">{players.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
            {selectedSeasonId && (
              <Button variant="outline" onClick={() => setAddExistingOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar jogador existente
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Jogador
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">Novo Jogador</DialogTitle>
                </DialogHeader>
                <PlayerForm
                  onSubmit={handleCreatePlayer}
                  isLoading={saving}
                  sportType={team.sport_type}
                />
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <Dialog open={addExistingOpen} onOpenChange={(o) => { setAddExistingOpen(o); if (!o) { setPicked([]); setSearch(''); } }}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Adicionar jogador existente</DialogTitle>
              </DialogHeader>
              <Input placeholder="Pesquisar jogador..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="divide-y max-h-[45vh] overflow-y-auto">
                {availableLoading && <p className="py-6 text-center text-sm text-muted-foreground">A carregar...</p>}
                {!availableLoading && availablePlayers.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sem jogadores disponíveis.</p>
                )}
                {availablePlayers
                  .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-3 py-2 cursor-pointer">
                      <Checkbox
                        checked={picked.includes(p.id)}
                        onCheckedChange={(c) =>
                          setPicked((prev) => (c ? [...prev, p.id] : prev.filter((x) => x !== p.id)))
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.also_in_team_ids.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            também em: {p.also_in_team_ids.map(teamName).join(', ')}
                          </p>
                        )}
                        {!p.birth_date && (
                          <p className="text-xs text-amber-600">sem data de nascimento — confirmar elegibilidade</p>
                        )}
                      </div>
                    </label>
                  ))}
              </div>
              <Button onClick={handleAddExisting} disabled={picked.length === 0 || addingExisting}>
                {addingExisting ? 'A adicionar...' : `Adicionar ${picked.length || ''}`.trim()}
              </Button>
            </DialogContent>
          </Dialog>

          {players.length > 0 && <SquadDepth players={players} />}

          {players.length === 0 ? (
            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Sem jogadores</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  Esta equipa ainda não tem jogadores. Adicione o primeiro jogador.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Jogador
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => {
                const age = player.birth_date 
                  ? differenceInYears(new Date(), new Date(player.birth_date)) 
                  : null;
                const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const playerIsFemale = player.gender === 'female';
                const canPlay = team.category && player.birth_date
                  ? canPlayerPlayInCategory(player.birth_date, team.category, team.gender, playerIsFemale).eligible
                  : true;

                return (
                  <Card
                    key={player.id}
                    className={`cursor-pointer hover:border-primary/50 transition-all hover:shadow-md ${
                      !canPlay ? 'opacity-60 border-destructive/30' : ''
                    }`}
                    onClick={() => navigate(`/players/${player.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {player.number && (
                              <span className="text-lg font-bold text-primary">
                                #{player.number}
                              </span>
                            )}
                            <span className="font-medium truncate">{player.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {player.position && <span>{player.position}</span>}
                            {age !== null && <span>• {age} anos</span>}
                          </div>
                        </div>
                        {playerTeams(player.id).length > 1 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="shrink-0">Partilhado</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {playerTeams(player.id).map(teamName).join(', ')}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {!canPlay && (
                          <Badge variant="destructive" className="shrink-0">
                            Inelegível
                          </Badge>
                        )}
                        {selectedSeasonId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            title="Remover da equipa"
                            onClick={(e) => { e.stopPropagation(); handleRemoveFromTeam(player.id, player.name); }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
