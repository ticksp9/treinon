import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Trophy, Calendar, MapPin, Play, Users, Clock, User, Table as TableIcon, Trash2, FlaskConical, AlertTriangle, RotateCcw, Archive } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LiveMatch } from '@/components/matches/LiveMatch';
import { MatchResultsView } from '@/components/matches/MatchResultsView';
import { ChampionshipManager } from '@/components/matches/ChampionshipManager';
import { toast } from 'sonner';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';

interface Team {
  id: string;
  name: string;
  category: string | null;
}

interface Match {
  id: string;
  match_date: string;
  opponent_name: string;
  is_home: boolean;
  location: string | null;
  competition: string | null;
  status: string;
  goals_for: number | null;
  goals_against: number | null;
  match_type?: string;
  parts_count?: number;
  part_duration_minutes?: number | null;
  last_timer_start?: string | null;
  is_test?: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  owner_id?: string;
}

export default function Matches() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedTeamData, setSelectedTeamData] = useState<Team | undefined>();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteDialogMatch, setDeleteDialogMatch] = useState<Match | null>(null);
  const [deletedMatches, setDeletedMatches] = useState<Match[]>([]);
  const selectedSeasonId = useSelectedSeasonId();

  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [user]);

  useEffect(() => {
    if (selectedTeam) {
      fetchMatches();
      const teamData = teams.find(t => t.id === selectedTeam);
      setSelectedTeamData(teamData);
    }
  }, [selectedTeam, teams, selectedSeasonId]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category')
        .eq('owner_id', user?.id)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
      
      // Use teamId from URL search params if valid, otherwise first team
      const paramTeamId = searchParams.get('teamId');
      if (paramTeamId && data?.some(t => t.id === paramTeamId)) {
        setSelectedTeam(paramTeamId);
      } else if (data && data.length > 0) {
        setSelectedTeam(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      // Season scoping: strictly the selected season. No legacy null fallback —
      // records without season are back-filled by migration. Only when the user
      // has no season at all (selectedSeasonId null) the filter is skipped.
      const MATCH_FIELDS = 'id, match_date, opponent_name, is_home, location, competition, status, goals_for, goals_against, match_type, parts_count, part_duration_minutes, last_timer_start, is_test, is_deleted, deleted_at, owner_id, report_status, report_entry_mode';
      let activeQuery = supabase
        .from('matches')
        .select(MATCH_FIELDS)
        .eq('team_id', selectedTeam)
        .eq('is_deleted', false);
      if (selectedSeasonId) activeQuery = activeQuery.eq('season_id', selectedSeasonId);
      const { data, error } = await activeQuery.order('match_date', { ascending: false });

      if (error) throw error;
      setMatches(data || []);

      // Fetch deleted matches (same strict season filter)
      let deletedQuery = supabase
        .from('matches')
        .select(MATCH_FIELDS)
        .eq('team_id', selectedTeam)
        .eq('is_deleted', true);
      if (selectedSeasonId) deletedQuery = deletedQuery.eq('season_id', selectedSeasonId);
      const { data: deletedData, error: deletedError } = await deletedQuery
        .order('deleted_at', { ascending: false });

      if (!deletedError) {
        setDeletedMatches(deletedData || []);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  // Find in-progress match (only status = 'in_progress' counts as "a decorrer")
  const inProgressMatch = matches.find(m => m.status === 'in_progress');

  const handleStartMatch = (match: Match) => {
    // Check if there's already a game in progress
    if (inProgressMatch && inProgressMatch.id !== match.id) {
      toast.error('Já existe um jogo a decorrer. Termina ou finaliza o jogo atual antes de iniciar outro.');
      return;
    }
    // Pass isResume=false to indicate this is a fresh start
    setSelectedMatch({ ...match, _isResume: false } as any);
    setActiveTab('live');
  };

  const handleContinueMatch = (match: Match) => {
    // Pass isResume=true to indicate this is a resume action
    setSelectedMatch({ ...match, _isResume: true } as any);
    setActiveTab('live');
  };

  const handleExitLiveMatch = () => {
    setSelectedMatch(null);
    setActiveTab('list');
    fetchMatches(); // Refresh matches to get updated scores
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline">Agendado</Badge>;
      case 'in_progress':
        return <Badge className="bg-green-500">Em Curso</Badge>;
      case 'completed':
        return <Badge variant="secondary">Terminado</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const testMatchesCount = matches.filter(m => m.is_test).length;

  const deleteTestMatches = async () => {
    if (!user || testMatchesCount === 0) return;
    
    const confirmed = confirm(`Vais eliminar ${testMatchesCount} jogo${testMatchesCount === 1 ? '' : 's'} de teste. Continuar?`);
    if (!confirmed) return;

    try {
      const testMatchIds = matches.filter(m => m.is_test).map(m => m.id);
      
      // Soft delete matches (mark as deleted)
      const { error } = await supabase
        .from('matches')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          deleted_by: user.id 
        })
        .in('id', testMatchIds);

      if (error) throw error;

      toast.success(`${testMatchesCount} jogo${testMatchesCount === 1 ? '' : 's'} de teste eliminado${testMatchesCount === 1 ? '' : 's'}!`);
      fetchMatches();
    } catch (error: any) {
      toast.error('Erro ao eliminar: ' + error.message);
    }
  };

  const handleDeleteMatch = (match: Match) => {
    if (match.status === 'in_progress') {
      toast.error('Não podes eliminar um jogo a decorrer. Termina ou cancela o jogo primeiro.');
      return;
    }
    setDeleteDialogMatch(match);
  };

  const confirmDeleteMatch = async () => {
    if (!user || !deleteDialogMatch) return;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          deleted_by: user.id 
        })
        .eq('id', deleteDialogMatch.id);

      if (error) throw error;

      toast.success('Jogo eliminado!');
      setDeleteDialogMatch(null);
      fetchMatches();
    } catch (error: any) {
      toast.error('Erro ao eliminar: ' + error.message);
    }
  };

  const restoreMatch = async (matchId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ 
          is_deleted: false, 
          deleted_at: null,
          deleted_by: null 
        })
        .eq('id', matchId);

      if (error) throw error;

      toast.success('Jogo restaurado!');
      fetchMatches();
    } catch (error: any) {
      toast.error('Erro ao restaurar: ' + error.message);
    }
  };

  // In-progress matches always show at top
  const inProgressMatches = matches.filter(m => m.status === 'in_progress');
  // Upcoming: future date OR scheduled status (not completed, not in_progress)
  const upcomingMatches = matches.filter(m => 
    m.status !== 'completed' && 
    m.status !== 'in_progress' && 
    m.status !== 'cancelled' &&
    (new Date(m.match_date) >= new Date() || m.status === 'scheduled')
  );
  // Past pending: past date, not completed, not in_progress, not scheduled-future
  const pastMatches = matches.filter(m => 
    m.status !== 'completed' && 
    m.status !== 'in_progress' && 
    m.status !== 'cancelled' &&
    m.status !== 'scheduled' &&
    new Date(m.match_date) < new Date()
  );
  const completedMatches = matches.filter(m => m.status === 'completed');
  const cancelledMatches = matches.filter(m => m.status === 'cancelled');
  const hasNoGroupedMatches = inProgressMatches.length === 0 && upcomingMatches.length === 0 && pastMatches.length === 0;

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sessão Necessária</h3>
              <p className="text-muted-foreground">
                Faça login para aceder aos jogos.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Gestão de Jogos</h1>
          <p className="text-muted-foreground">
            Gerir jogos, resultados e classificação do campeonato
          </p>
        </div>


        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Jogos
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Resultados
            </TabsTrigger>
            <TabsTrigger value="championship" className="flex items-center gap-2">
              <TableIcon className="w-4 h-4" />
              Campeonato
            </TabsTrigger>
            {deletedMatches.length > 0 && (
              <TabsTrigger value="deleted" className="flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Eliminados ({deletedMatches.length})
              </TabsTrigger>
            )}
            {selectedMatch && (
              <TabsTrigger value="live" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Jogo ao Vivo
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            {/* Team Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Equipa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Selecione uma equipa" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} {team.category && `(${team.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {teams.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sem Equipas</h3>
                  <p className="text-muted-foreground">
                    Crie uma equipa primeiro para gerir jogos.
                  </p>
                </CardContent>
              </Card>
            ) : matches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sem Jogos</h3>
                  <p className="text-muted-foreground">
                    Crie jogos na secção de Treinos → Convocatória
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Test Matches Cleanup Button */}
                {testMatchesCount > 0 && (
                  <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3">
                      <FlaskConical className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          {testMatchesCount} jogo{testMatchesCount === 1 ? '' : 's'} de teste
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-300">
                          Jogos de teste não contam para estatísticas
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deleteTestMatches}
                      className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Apagar jogos de teste
                    </Button>
                  </div>
                )}

                {/* In-Progress Matches - Always shown first */}
                {inProgressMatches.length > 0 && (
                  <Card className="border-green-500/30 bg-green-50/30 dark:bg-green-900/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Play className="w-5 h-5 fill-current" />
                        Jogo a Decorrer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {inProgressMatches.map(match => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-green-100/50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="text-sm font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: pt })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(match.match_date), 'HH:mm')}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                    <FlaskConical className="w-3 h-3 mr-0.5" />
                                    TESTE
                                  </Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                                  {match.is_home ? 'CASA' : 'FORA'}
                                </Badge>
                                {match.opponent_name}
                              </div>
                              {match.goals_for !== null && match.goals_against !== null && (
                                <div className="text-sm font-bold mt-1">
                                  {match.goals_for} - {match.goals_against}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleContinueMatch(match)} className="bg-green-600 hover:bg-green-700">
                            <Play className="w-4 h-4 mr-1 fill-current" />
                            Continuar Jogo
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Upcoming Matches */}
                {upcomingMatches.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Próximos Jogos
                      </CardTitle>
                      <CardDescription>
                        Jogos agendados para as próximas semanas
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {upcomingMatches.map(match => (
                        <div
                          key={match.id}
                          className={`flex items-center justify-between p-4 rounded-lg hover:bg-secondary/50 transition-colors ${
                            match.is_test 
                              ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800' 
                              : 'bg-secondary/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="text-sm font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: pt })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(match.match_date), 'HH:mm')}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                    <FlaskConical className="w-3 h-3 mr-0.5" />
                                    TESTE
                                  </Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                                  {match.is_home ? 'CASA' : 'FORA'}
                                </Badge>
                                {match.opponent_name}
                              </div>
                              {match.location && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {match.location}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(match.status)}
                            {match.status === 'in_progress' ? (
                              <Button size="sm" onClick={() => handleContinueMatch(match)}>
                                <Play className="w-4 h-4 mr-1 fill-current" />
                                Continuar
                              </Button>
                            ) : (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleStartMatch(match)}
                                  disabled={!!inProgressMatch}
                                  title={inProgressMatch ? 'Já existe um jogo a decorrer' : ''}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Iniciar Jogo
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                                  title="Eliminar jogo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Past Matches (not completed) */}
                {pastMatches.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Jogos Pendentes
                      </CardTitle>
                      <CardDescription>
                        Jogos passados ainda não terminados
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pastMatches.map(match => (
                        <div
                          key={match.id}
                          className={`flex items-center justify-between p-4 rounded-lg hover:bg-secondary/50 transition-colors ${
                            match.is_test 
                              ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800' 
                              : 'bg-secondary/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="text-sm font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: pt })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(match.match_date), 'yyyy')}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                    <FlaskConical className="w-3 h-3 mr-0.5" />
                                    TESTE
                                  </Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                                  {match.is_home ? 'CASA' : 'FORA'}
                                </Badge>
                                {match.opponent_name}
                              </div>
                              {match.competition && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {match.competition}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(match.status)}
                            {match.status === 'in_progress' ? (
                              <Button size="sm" onClick={() => handleContinueMatch(match)}>
                                <Play className="w-4 h-4 mr-1 fill-current" />
                                Continuar
                              </Button>
                            ) : (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleStartMatch(match)}
                                  disabled={!!inProgressMatch}
                                  title={inProgressMatch ? 'Já existe um jogo a decorrer' : ''}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Iniciar Jogo
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                                  title="Eliminar jogo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Fallback: all matches are completed or no active groups */}
                {hasNoGroupedMatches && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        {completedMatches.length > 0 ? 'Todos os Jogos Terminados' : 'Sem Jogos Ativos'}
                      </CardTitle>
                      <CardDescription>
                        {completedMatches.length > 0 
                          ? `${completedMatches.length} jogo${completedMatches.length !== 1 ? 's' : ''} terminado${completedMatches.length !== 1 ? 's' : ''}. Crie novos jogos em Treinos → Convocatória.`
                          : 'Não existem jogos agendados. Crie novos jogos em Treinos → Convocatória.'
                        }
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}

                {/* Completed Matches Summary */}
                {completedMatches.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        Resultados ({completedMatches.length})
                      </CardTitle>
                      <CardDescription>Últimos jogos terminados</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {completedMatches.slice(0, 5).map(match => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-center min-w-[50px]">
                              <div className="text-xs font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: pt })}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-600">TESTE</Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-[10px]">
                                  {match.is_home ? 'C' : 'F'}
                                </Badge>
                                {match.opponent_name}
                              </div>
                            </div>
                          </div>
                          <div className="font-bold text-sm">
                            {match.goals_for ?? 0} - {match.goals_against ?? 0}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {/* Team Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Equipa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Selecione uma equipa" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} {team.category && `(${team.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <MatchResultsView
              teamId={selectedTeam}
              matches={matches}
              team={selectedTeamData}
            />
          </TabsContent>

          <TabsContent value="championship" className="space-y-6">
            {/* Team Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Equipa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Selecione uma equipa" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} {team.category && `(${team.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedTeam && (
              <ChampionshipManager
                teamId={selectedTeam}
                team={selectedTeamData}
              />
            )}
          </TabsContent>

          <TabsContent value="deleted" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  Jogos Eliminados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deletedMatches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Sem jogos eliminados.
                  </p>
                ) : (
                  deletedMatches.map(match => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-sm font-medium">
                            {format(new Date(match.match_date), 'dd MMM', { locale: pt })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(match.match_date), 'HH:mm')}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {match.is_test && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                <FlaskConical className="w-3 h-3 mr-0.5" />
                                TESTE
                              </Badge>
                            )}
                            <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                              {match.is_home ? 'CASA' : 'FORA'}
                            </Badge>
                            {match.opponent_name}
                          </div>
                          {match.deleted_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Eliminado em {format(new Date(match.deleted_at), 'dd/MM/yyyy HH:mm', { locale: pt })}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => restoreMatch(match.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restaurar
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live">
            {selectedMatch && (
              <LiveMatch
                matchId={selectedMatch.id}
                isResume={(selectedMatch as any)._isResume === true}
                teamId={selectedTeam}
                onExit={handleExitLiveMatch}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteDialogMatch} onOpenChange={() => setDeleteDialogMatch(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Eliminar Jogo
              </DialogTitle>
              <DialogDescription>
                Tens a certeza que queres eliminar este jogo?
              </DialogDescription>
            </DialogHeader>
            {deleteDialogMatch && (
              <div className="py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">
                    {deleteDialogMatch.is_home ? 'Casa' : 'Fora'} vs {deleteDialogMatch.opponent_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(deleteDialogMatch.match_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  O jogo será movido para "Eliminados" e poderá ser restaurado posteriormente.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogMatch(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteMatch}>
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
