import { useState, useEffect, useRef } from 'react';
import { useActiveTeam } from '@/hooks/useActiveTeam';
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
import { Trophy, Calendar, MapPin, Play, Users, Clock, User, Table as TableIcon, Trash2, FlaskConical, AlertTriangle, RotateCcw, Archive, ClipboardEdit } from 'lucide-react';
import { QuickMatchEntry } from '@/components/matches/QuickMatchEntry';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { clearLiveClock } from '@/lib/live-clock';
import { LiveMatch } from '@/components/matches/LiveMatch';
import { MatchResultsView } from '@/components/matches/MatchResultsView';
import { ChampionshipManager } from '@/components/matches/ChampionshipManager';
import { toast } from 'sonner';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { dateLocale, tx, useT, longDate } from '@/lib/i18n/ui';

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
  logistics?: Logistics;
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

type Logistics = { meet_time?: string; meet_place?: string; transport?: string; kit?: string; info?: string } | null | undefined;
/** What the coordinator set for the match: meeting time/place, transport, kit, other info. */
const logisticsLine = (l: Logistics) => !l ? '' : [
  l.meet_time && tx('Concentração {{time}}', { time: l.meet_time }) + (l.meet_place ? ` · ${l.meet_place}` : ''),
  l.transport,
  l.kit && tx('Equipamento: {{kit}}', { kit: l.kit }),
  l.info,
].filter(Boolean).join(' · ');

export default function Matches() {
  const { scopeTeams, defaultTeamId, activeTeamId } = useActiveTeam();
  // switching team at the top of the screen re-scopes this page
  useEffect(() => { if (activeTeamId) fetchTeams(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTeamId]);
  const { user, loading: authLoading } = useAuth();
  const t = useT();
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
  const [quickEntryId, setQuickEntryId] = useState<string | null>(null);
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

        .order('name');

      if (error) throw error;
      // only the teams of the club/context the coach is working in
      const scoped = scopeTeams(data || []);
      setTeams(scoped);

      // Use teamId from URL search params if valid, otherwise the active team
      const paramTeamId = searchParams.get('teamId');
      if (paramTeamId && scoped.some(t => t.id === paramTeamId)) {
        setSelectedTeam(paramTeamId);
      } else if (scoped.length > 0) {
        setSelectedTeam(defaultTeamId(scoped) ?? scoped[0].id);
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
      const MATCH_FIELDS = 'id, match_date, opponent_name, is_home, location, competition, status, goals_for, goals_against, match_type, parts_count, part_duration_minutes, last_timer_start, is_test, is_deleted, deleted_at, owner_id, report_status, report_entry_mode, logistics';
      let activeQuery = supabase
        .from('matches')
        .select(MATCH_FIELDS)
        .eq('team_id', selectedTeam)
        .eq('is_deleted', false);
      if (selectedSeasonId) activeQuery = activeQuery.eq('season_id', selectedSeasonId);
      const { data, error } = await activeQuery.order('match_date', { ascending: false });

      if (error) throw error;
      setMatches((data || []) as unknown as Match[]);

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
        setDeletedMatches((deletedData || []) as unknown as Match[]);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  // "Voltar ao jogo" (bar shown on the other screens): reopen the live match directly
  const liveParam = searchParams.get('live');
  const openedLiveRef = useRef<string | null>(null);
  useEffect(() => {
    if (!liveParam || openedLiveRef.current === liveParam) return;
    const m = matches.find(x => x.id === liveParam);
    if (!m) return;
    openedLiveRef.current = liveParam;
    setSelectedMatch({ ...m, _isResume: true } as any);
    setActiveTab('live');
  }, [liveParam, matches]);

  // Find in-progress match (only status = 'in_progress' counts as "a decorrer")
  const inProgressMatch = matches.find(m => m.status === 'in_progress');

  const handleStartMatch = (match: Match) => {
    // Check if there's already a game in progress
    if (inProgressMatch && inProgressMatch.id !== match.id) {
      toast.error(t('Já existe um jogo a decorrer. Termina ou finaliza o jogo atual antes de iniciar outro.'));
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
        return <Badge variant="outline">{t('Agendado')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-green-500">{t('Em Curso')}</Badge>;
      case 'completed':
        return <Badge variant="secondary">{t('Terminado')}</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">{t('Cancelado')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const testMatchesCount = matches.filter(m => m.is_test).length;

  const deleteTestMatches = async () => {
    if (!user || testMatchesCount === 0) return;

    const confirmed = confirm(t('Vais eliminar {{n}} jogo(s) de teste. Continuar?', { n: testMatchesCount }));
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

      toast.success(t('{{n}} jogo(s) de teste eliminado(s)!', { n: testMatchesCount }));
      fetchMatches();
    } catch (error: any) {
      toast.error(t('Erro ao eliminar: {{msg}}', { msg: error.message }));
    }
  };

  /**
   * Friendlies and test matches are what coaches try the app with: they can be deleted in
   * any state — even running or already finished. A deleted match does not count for
   * minutes, goals or ratings.
   */
  const canDeleteAnytime = (match: Match) => match.match_type === 'friendly' || !!match.is_test;

  const handleDeleteMatch = (match: Match) => {
    if (match.status === 'in_progress' && !canDeleteAnytime(match)) {
      toast.error(tx('Não podes eliminar um jogo de campeonato a decorrer. Termina o jogo primeiro (ou muda-o para amigável na preparação).'));
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
          deleted_by: user.id,
          // a running match is stopped for good: restored later, it must not come back with the clock going
          ...(deleteDialogMatch.status === 'in_progress'
            ? { status: 'cancelled', match_phase: 'finished', last_timer_start: null, part_started_at_ms: null }
            : {}),
        } as never)
        .eq('id', deleteDialogMatch.id);

      if (error) throw error;
      // nothing of it stays "a decorrer" on this device
      clearLiveClock(deleteDialogMatch.id);
      try { if (localStorage.getItem('tacticaflow_active_match_id') === deleteDialogMatch.id) localStorage.removeItem('tacticaflow_active_match_id'); } catch { /* ignore */ }

      toast.success(t('Jogo eliminado!'));
      setDeleteDialogMatch(null);
      fetchMatches();
    } catch (error: any) {
      toast.error(t('Erro ao eliminar: {{msg}}', { msg: error.message }));
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

      toast.success(t('Jogo restaurado!'));
      fetchMatches();
    } catch (error: any) {
      toast.error(t('Erro ao restaurar: {{msg}}', { msg: error.message }));
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
        <div>
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
        <div>
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('Sessão Necessária')}</h3>
              <p className="text-muted-foreground">
                {t('Faça login para aceder aos jogos.')}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">{t('Gestão de Jogos')}</h1>
          <p className="text-muted-foreground">
            {t('Gerir jogos, resultados e classificação do campeonato')}
          </p>
        </div>


        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('Jogos')}
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              {t('Resultados')}
            </TabsTrigger>
            <TabsTrigger value="championship" className="flex items-center gap-2">
              <TableIcon className="w-4 h-4" />
              {t('Campeonato')}
            </TabsTrigger>
            {deletedMatches.length > 0 && (
              <TabsTrigger value="deleted" className="flex items-center gap-2">
                <Archive className="w-4 h-4" />
                {tx('Eliminados (')}{deletedMatches.length})
              </TabsTrigger>
            )}
            {selectedMatch && (
              <TabsTrigger value="live" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                {t('Jogo ao Vivo')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            {/* Team Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {t('Equipa')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder={t('Selecione uma equipa')} />
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
                  <h3 className="text-lg font-semibold mb-2">{t('Sem Equipas')}</h3>
                  <p className="text-muted-foreground">
                    {t('Crie uma equipa primeiro para gerir jogos.')}
                  </p>
                </CardContent>
              </Card>
            ) : matches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('Sem Jogos')}</h3>
                  <p className="text-muted-foreground">
                    {t('Crie jogos na secção de Treinos → Convocatória')}
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
                          {testMatchesCount === 1 ? tx('1 jogo de teste') : tx('{{n}} jogos de teste', { n: testMatchesCount })}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-300">
                          {t('Jogos de teste não contam para estatísticas')}
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
                      {t('Apagar jogos de teste')}
                    </Button>
                  </div>
                )}

                {/* In-Progress Matches - Always shown first */}
                {inProgressMatches.length > 0 && (
                  <Card className="border-green-500/30 bg-green-50/30 dark:bg-green-900/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Play className="w-5 h-5 fill-current" />
                        {t('Jogo a Decorrer')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {inProgressMatches.map(match => (
                        <div
                          key={match.id}
                          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg bg-green-100/50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        >
                          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="text-center min-w-[52px] shrink-0">
                              <div className="text-sm font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: dateLocale() })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(match.match_date), 'HH:mm')}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                    <FlaskConical className="w-3 h-3 mr-0.5" />
                                    {t('TESTE')}
                                  </Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                                  {match.is_home ? t('CASA') : t('FORA')}
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
                            {t('Continuar Jogo')}
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
                        {t('Próximos Jogos')}
                      </CardTitle>
                      <CardDescription>
                        {t('Jogos agendados para as próximas semanas')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {upcomingMatches.map(match => (
                        <div
                          key={match.id}
                          className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg hover:bg-secondary/50 transition-colors ${
                            match.is_test
                              ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
                              : 'bg-secondary/30'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="text-center min-w-[52px] shrink-0">
                              <div className="text-sm font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: dateLocale() })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(match.match_date), 'HH:mm')}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                    <FlaskConical className="w-3 h-3 mr-0.5" />
                                    {t('TESTE')}
                                  </Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                                  {match.is_home ? t('CASA') : t('FORA')}
                                </Badge>
                                {match.opponent_name}
                              </div>
                              {match.location && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {match.location}
                                </div>
                              )}
                              {logisticsLine(match.logistics) && (
                                <div className="text-xs text-muted-foreground mt-1">{logisticsLine(match.logistics)}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {getStatusBadge(match.status)}
                            {match.status === 'in_progress' ? (
                              <>
                                <Button size="sm" onClick={() => handleContinueMatch(match)}>
                                  <Play className="w-4 h-4 mr-1 fill-current" />
                                  {t('Continuar')}
                                </Button>
                                {canDeleteAnytime(match) && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }} title={t('Eliminar este jogo (amigável/teste)')} aria-label={t('Eliminar jogo')}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleStartMatch(match)}
                                  disabled={!!inProgressMatch}
                                  title={inProgressMatch ? t('Já existe um jogo a decorrer') : ''}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  {t('Iniciar Jogo')}
                                </Button>
                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setQuickEntryId(match.id); }} title={t('Não deu para fazer ao vivo? Registe minutos, golos e cartões depois do jogo')}>
                                  <ClipboardEdit className="w-4 h-4 mr-1" />
                                  {t('Registar depois')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                                  title={t('Eliminar jogo')}
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
                        {t('Jogos Pendentes')}
                      </CardTitle>
                      <CardDescription>
                        {t('Jogos passados ainda não terminados')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pastMatches.map(match => (
                        <div
                          key={match.id}
                          className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg hover:bg-secondary/50 transition-colors ${
                            match.is_test
                              ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
                              : 'bg-secondary/30'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="text-center min-w-[52px] shrink-0">
                              <div className="text-sm font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: dateLocale() })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(match.match_date), 'yyyy')}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                    <FlaskConical className="w-3 h-3 mr-0.5" />
                                    {t('TESTE')}
                                  </Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                                  {match.is_home ? t('CASA') : t('FORA')}
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
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {getStatusBadge(match.status)}
                            {match.status === 'in_progress' ? (
                              <Button size="sm" onClick={() => handleContinueMatch(match)}>
                                <Play className="w-4 h-4 mr-1 fill-current" />
                                {t('Continuar')}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartMatch(match)}
                                  disabled={!!inProgressMatch}
                                  title={inProgressMatch ? t('Já existe um jogo a decorrer') : ''}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  {t('Iniciar Jogo')}
                                </Button>
                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setQuickEntryId(match.id); }} title={t('Não deu para fazer ao vivo? Registe minutos, golos e cartões depois do jogo')}>
                                  <ClipboardEdit className="w-4 h-4 mr-1" />
                                  {t('Registar depois')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                                  title={t('Eliminar jogo')}
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
                        {completedMatches.length > 0 ? t('Todos os Jogos Terminados') : t('Sem Jogos Ativos')}
                      </CardTitle>
                      <CardDescription>
                        {completedMatches.length > 0
                          ? t('{{n}} jogo(s) terminado(s). Crie novos jogos em Treinos → Convocatória.', { n: completedMatches.length })
                          : t('Não existem jogos agendados. Crie novos jogos em Treinos → Convocatória.')
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
                        {t('Resultados ({{n}})', { n: completedMatches.length })}
                      </CardTitle>
                      <CardDescription>{t('Últimos jogos terminados')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {completedMatches.slice(0, 5).map(match => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="text-center min-w-[50px] shrink-0">
                              <div className="text-xs font-medium">
                                {format(new Date(match.match_date), 'dd MMM', { locale: dateLocale() })}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                                {match.is_test && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-600">{t('TESTE')}</Badge>
                                )}
                                <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-[10px]">
                                  {(match.is_home ? t('CASA') : t('FORA')).charAt(0)}
                                </Badge>
                                {match.opponent_name}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="whitespace-nowrap font-bold text-sm">
                              {match.goals_for ?? 0} - {match.goals_against ?? 0}
                            </div>
                            {canDeleteAnytime(match) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteMatch(match)} title={t('Eliminar este jogo (amigável/teste): os minutos deixam de contar')} aria-label={t('Eliminar jogo')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
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
                  {t('Equipa')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder={t('Selecione uma equipa')} />
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
              onDelete={(m) => { const full = matches.find(x => x.id === m.id); if (full) handleDeleteMatch(full); }}
              canDelete={(m) => { const full = matches.find(x => x.id === m.id); return !!full && canDeleteAnytime(full); }}
            />
          </TabsContent>

          <TabsContent value="championship" className="space-y-6">
            {/* Team Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {t('Equipa')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder={t('Selecione uma equipa')} />
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
                  {t('Jogos Eliminados')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deletedMatches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {t('Sem jogos eliminados.')}
                  </p>
                ) : (
                  deletedMatches.map(match => (
                    <div
                      key={match.id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className="text-center min-w-[52px] shrink-0">
                          <div className="text-sm font-medium">
                            {format(new Date(match.match_date), 'dd MMM', { locale: dateLocale() })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(match.match_date), 'HH:mm')}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                            {match.is_test && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">
                                <FlaskConical className="w-3 h-3 mr-0.5" />
                                {t('TESTE')}
                              </Badge>
                            )}
                            <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                              {match.is_home ? t('CASA') : t('FORA')}
                            </Badge>
                            {match.opponent_name}
                          </div>
                          {match.deleted_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t('Eliminado em')} {format(new Date(match.deleted_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale() })}
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
                        {t('Restaurar')}
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
                {t('Eliminar Jogo')}
              </DialogTitle>
              <DialogDescription>
                {t('Tens a certeza que queres eliminar este jogo?')}
              </DialogDescription>
            </DialogHeader>
            {deleteDialogMatch && (
              <div className="py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">
                    {deleteDialogMatch.is_home ? t('Casa') : t('Fora')} vs {deleteDialogMatch.opponent_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {longDate(new Date(deleteDialogMatch.match_date), 'dateTime')}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {deleteDialogMatch.status === 'in_progress' && t('O jogo está a decorrer: o relógio pára e o jogo fica cancelado.') + ' '}
                  {t('Os minutos, golos, cartões e notas deste jogo deixam de contar nas fichas dos jogadores. O jogo fica em "Eliminados" e pode ser restaurado mais tarde.')}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogMatch(null)}>
                {t('Cancelar')}
              </Button>
              <Button variant="destructive" onClick={confirmDeleteMatch}>
                <Trash2 className="w-4 h-4 mr-1" />
                {t('Eliminar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {quickEntryId && (
          <QuickMatchEntry matchId={quickEntryId} open onClose={() => setQuickEntryId(null)} onSaved={() => fetchMatches()} />
        )}
      </div>
    </AppLayout>
  );
}
