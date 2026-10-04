import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Calendar, Ruler, Weight, MapPin, FileText, Shield, Heart, Download, Upload, Lock, Unlock, Activity } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PlayerSeasonStats } from '@/components/players/PlayerSeasonStats';
import { PlayerInjuries } from '@/components/players/PlayerInjuries';
import { PlayerEvaluations } from '@/components/players/PlayerEvaluations';
import { PlayerHistory } from '@/components/players/PlayerHistory';
import {
  PlayerSummaryTab, PlayerEvolutionTab, PlayerTrainingsTab,
  PlayerMatchesTab, PlayerMinutesTab, PlayerAvailabilityTab,
} from '@/components/players/PlayerProfileTabs';
import { PlayerDevelopmentPlanTab, PlayerObservationsTab } from '@/components/players/PlayerDevelopment';
import { PlayerAnalyticsTab } from '@/components/players/PlayerAnalyticsTab';
import { PlayerFMCard } from '@/components/players/PlayerFMCard';
import { PlayerStrengthsPanel, PlayerImprovementPanel } from '@/components/players/PlayerStrengthsPanel';
import { PlayerSeasonHistoryTab } from '@/components/players/PlayerSeasonHistoryTab';
import { PlayerPositionsTab } from '@/components/players/PlayerPositionsTab';
import { usePlayerPermissions } from '@/hooks/usePlayerPermissions';
import {
  canEditPlayerProfile,
  canCreatePlayerEvaluation,
  canEditStrengthsFocus,
} from '@/lib/player-permissions';
import { POSITIONS, FOOT_OPTIONS, ID_DOCUMENT_TYPES } from '@/lib/player-constants';
import { PLAYER_STATUS_OPTIONS } from '@/lib/player-attributes';
import { deriveStatus } from '@/lib/player-status';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerDocuments } from '@/components/players/PlayerDocuments';
import { format, differenceInYears } from 'date-fns';
import { generatePlayerPdf } from '@/lib/generatePlayerPdf';
import { toast } from 'sonner';
import { useSecurityPin } from '@/hooks/useSecurityPin';
import { PinDialog } from '@/components/security/PinDialog';
import { useState, useMemo } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPin, isPinVerified, verifyPin, lockSensitiveData, createPin } = useSecurityPin();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState<'create' | 'verify'>('verify');
  const selectedSeasonId = useSelectedSeasonId();

  // Fetch player data
  const { data: player, isLoading, isError, error: playerError, refetch: refetchPlayer } = useQuery({
    queryKey: ['player', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          team:teams(id, name, sport_type, season, club_id)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });


  // Last evaluation of the SELECTED season (used in Resumo). Never falls back to
  // other seasons — a new season starts with no evaluation.
  const { data: latestEval } = useQuery({
    queryKey: ['player-latest-eval', id, selectedSeasonId],
    enabled: !!id,
    queryFn: async () => {
      let q = supabase
        .from('player_evaluations')
        .select('*')
        .eq('player_id', id!);
      if (selectedSeasonId) q = q.eq('season_id', selectedSeasonId);
      const { data, error } = await q
        .order('evaluation_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  // Active injuries (for derived status)
  const { data: activeInjuries } = useQuery({
    queryKey: ['player-active-injuries', id],
    enabled: !!id,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('player_injuries')
        .select('id, return_date')
        .eq('player_id', id!)
        .or(`return_date.is.null,return_date.gte.${today}`);
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('players')
        .update({ status: status as any })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Estado atualizado');
      refetchPlayer();
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  // Fetch season stats — always scoped to the selected season.
  const { data: seasonStats } = useQuery({
    queryKey: ['player-season-stats', id, selectedSeasonId],
    queryFn: async () => {
      // Resolve the selected season's parents first. This avoids relying on
      // embedded-resource filters and keeps legacy child season_id values irrelevant.
      let matchesQuery = supabase
        .from('matches')
        .select('id, goals_against')
        .eq('is_deleted', false)
        .eq('is_test', false);
      if (selectedSeasonId) matchesQuery = matchesQuery.eq('season_id', selectedSeasonId);
      const { data: seasonMatches, error: matchesError } = await matchesQuery;
      if (matchesError) throw matchesError;
      const matchIds = (seasonMatches || []).map((match) => match.id);

      let lineupQuery = supabase
        .from('match_lineups')
        // only counted matches: not deleted, not test (filtered on the parent match row)
        .select('minutes_played, is_starter, match_id, match:matches!inner(season_id, is_deleted, is_test)')
        .eq('player_id', id!)
        .eq('match.is_deleted', false).eq('match.is_test', false);
      if (selectedSeasonId) lineupQuery = lineupQuery.eq('match.season_id', selectedSeasonId);
      const { data: lineups, error: lineupsError } = await lineupQuery;
      if (lineupsError) throw lineupsError;

      let eventsQuery = supabase
        .from('match_events')
        .select('event_type, match:matches!inner(season_id, is_deleted, is_test)')
        .eq('player_id', id!)
        .eq('match.is_deleted', false).eq('match.is_test', false);
      if (selectedSeasonId) eventsQuery = eventsQuery.eq('match.season_id', selectedSeasonId);
      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;

      let sessionsQuery = supabase.from('training_sessions').select('id');
      if (selectedSeasonId) sessionsQuery = sessionsQuery.eq('season_id', selectedSeasonId);
      const { data: seasonSessions, error: sessionsError } = await sessionsQuery;
      if (sessionsError) throw sessionsError;
      const sessionIds = (seasonSessions || []).map((session) => session.id);

      let attendanceQuery = supabase
        .from('training_attendance')
        .select('present, session_id')
        .eq('player_id', id!);
      if (selectedSeasonId) {
        attendanceQuery = sessionIds.length > 0
          ? attendanceQuery.in('session_id', sessionIds)
          : attendanceQuery.eq('session_id', '00000000-0000-0000-0000-000000000000');
      }
      const { data: attendance, error: attendanceError } = await attendanceQuery;
      if (attendanceError) throw attendanceError;

      // Count stats
      const goals = events?.filter(e => e.event_type === 'goal').length || 0;
      const yellowCards = events?.filter(e => e.event_type === 'yellow_card').length || 0;
      const redCards = events?.filter(e => e.event_type === 'red_card').length || 0;

      // Get assists (where player is assist_player)
      let assistQuery = supabase
        .from('match_events')
        .select('id, match:matches!inner(season_id, is_deleted, is_test)')
        .eq('assist_player_id', id!)
        .eq('match.is_deleted', false).eq('match.is_test', false);
      if (selectedSeasonId) assistQuery = assistQuery.eq('match.season_id', selectedSeasonId);
      const { data: assists, error: assistsError } = await assistQuery;
      if (assistsError) throw assistsError;

      // Calculate goals conceded for goalkeeper
      let goalsConceded = 0;
      if (player?.position === 'GK') {
        const playedIds = new Set((lineups || []).map((lineup) => lineup.match_id));
        goalsConceded = (seasonMatches || [])
          .filter((match) => playedIds.has(match.id))
          .reduce((sum, match) => sum + (match.goals_against || 0), 0);
      }

      return {
        minutesPlayed: lineups?.reduce((sum, l) => sum + (l.minutes_played || 0), 0) || 0,
        goals,
        assists: assists?.length || 0,
        goalsConceded,
        matchesPlayed: lineups?.length || 0,
        matchesStarted: lineups?.filter(l => l.is_starter).length || 0,
        trainingSessions: attendance?.length || 0,
        trainingAttendance: attendance?.filter(a => a.present).length || 0,
        yellowCards,
        redCards,
      };
    },
    enabled: !!id && !!player,
  });


  // Hooks must run on every render — keep them above the early returns.
  const perms = usePlayerPermissions();
  const derivedStatus = useMemo(() => deriveStatus({
    is_active: player?.is_active ?? true,
    status: (player as any)?.status,
    hasActiveInjury: (activeInjuries?.length ?? 0) > 0,
  }), [player, activeInjuries]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    if (import.meta.env.DEV) console.error('[PlayerDetail] erro na query principal:', playerError);
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-muted-foreground">
                Não foi possível carregar o jogador.
              </p>
              {import.meta.env.DEV && (
                <p className="text-xs text-muted-foreground">{(playerError as any)?.message}</p>
              )}
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchPlayer()}>
                  Tentar novamente
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/players')}>
                  Voltar à lista
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!player) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Jogador não encontrado ou sem acesso</p>
              <Button variant="link" onClick={() => navigate('/players')}>
                Voltar à lista
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const isFutsal = player.team?.sport_type === 'futsal';
  const positions = isFutsal ? POSITIONS.futsal : POSITIONS.football;
  const positionLabel = positions.find(p => p.value === player.position)?.label || player.position;
  const secondaryLabels = ((player as any).secondary_positions || [])
    .map((v: string) => positions.find(p => p.value === v)?.label || v);
  const footLabel = FOOT_OPTIONS.find(f => f.value === player.foot)?.label;
  const initials = (player.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const age = player.birth_date ? differenceInYears(new Date(), new Date(player.birth_date)) : null;
  const statusOption = PLAYER_STATUS_OPTIONS.find(s => s.value === derivedStatus);
  const clubId = player.team?.club_id ?? null;
  const playerScope = { id: player.id, team_id: player.team_id, club_id: clubId };
  const canEditFocus = canEditStrengthsFocus(perms, playerScope);


  return (
    <AppLayout>
      <ErrorBoundary label="página do jogador" showBack>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate('/players')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-bold truncate">{player.name}</h1>
              {statusOption && (
                <Badge className={statusOption.tone}>
                  <Activity className="w-3 h-3 mr-1" />
                  {statusOption.label}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{player.team?.name}</p>
          </div>
          <Select
            value={(player as any).status || 'active'}
            onValueChange={(v) => updateStatus.mutate(v)}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {PLAYER_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => generatePlayerPdf(player)}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
        </div>

        {/* Player Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center">
                <Avatar className="h-24 w-24 mb-2">
                  {player.photo_url && <AvatarImage src={player.photo_url} alt={player.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {player.number && (
                  <Badge variant="secondary" className="text-lg px-3">
                    #{player.number}
                  </Badge>
                )}
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                {positionLabel && (
                  <div>
                    <p className="text-xs text-muted-foreground">Posição Principal</p>
                    <p className="font-medium">{positionLabel}</p>
                  </div>
                )}
                {secondaryLabels.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Posições Secundárias</p>
                    <p className="font-medium text-sm">{secondaryLabels.join(', ')}</p>
                  </div>
                )}
                {age && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Idade</p>
                      <p className="font-medium">{age} anos</p>
                    </div>
                  </div>
                )}
                {player.height_cm && (
                  <div className="flex items-start gap-2">
                    <Ruler className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Altura</p>
                      <p className="font-medium">{player.height_cm} cm</p>
                    </div>
                  </div>
                )}
                {player.weight_kg && (
                  <div className="flex items-start gap-2">
                    <Weight className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Peso</p>
                      <p className="font-medium">{player.weight_kg} kg</p>
                    </div>
                  </div>
                )}
                {player.nationality && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nacionalidade</p>
                      <p className="font-medium">{player.nationality}</p>
                    </div>
                  </div>
                )}
                {footLabel && (
                  <div>
                    <p className="text-xs text-muted-foreground">Pé Dominante</p>
                    <p className="font-medium">{footLabel}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sensitive Data Section - Protected by PIN */}
            {(player.email || player.phone || player.address || 
              player.id_document_type || player.federation_id || player.tax_id ||
              player.parent_name || player.parent_name_2) && (
              <>
                {hasPin && !isPinVerified ? (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Lock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Dados Pessoais Protegidos</p>
                          <p className="text-sm text-muted-foreground">
                            Contactos, morada, documentos e dados dos pais
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setPinDialogMode('verify');
                          setShowPinDialog(true);
                        }}
                      >
                        <Unlock className="w-4 h-4 mr-1" />
                        Desbloquear
                      </Button>
                    </div>
                  </div>
                ) : !hasPin ? (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-lg">
                      <p className="text-sm text-warning">
                        ⚠️ Dados sensíveis não protegidos. Configure um PIN nas definições.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setPinDialogMode('create');
                          setShowPinDialog(true);
                        }}
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Criar PIN
                      </Button>
                    </div>
                    
                    {/* Show data without protection warning */}
                    {/* Contact Info */}
                    {(player.email || player.phone || player.address) && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-3">Contacto do Jogador</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {player.email && (
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium">{player.email}</p>
                            </div>
                          )}
                          {player.phone && (
                            <div>
                              <p className="text-xs text-muted-foreground">Telefone</p>
                              <p className="font-medium">{player.phone}</p>
                            </div>
                          )}
                          {player.address && (
                            <div className="md:col-span-3">
                              <p className="text-xs text-muted-foreground">Morada</p>
                              <p className="font-medium">{player.address}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* PIN verified - show all data */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-success flex items-center gap-1">
                          <Unlock className="w-3 h-3" />
                          Desbloqueado
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={lockSensitiveData}
                          className="h-6 text-xs"
                        >
                          <Lock className="w-3 h-3 mr-1" />
                          Bloquear
                        </Button>
                      </div>
                    </div>

                    {/* Contact Info */}
                    {(player.email || player.phone || player.address) && (
                      <div className="mt-2">
                        <h4 className="text-sm font-medium mb-3">Contacto do Jogador</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {player.email && (
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium">{player.email}</p>
                            </div>
                          )}
                          {player.phone && (
                            <div>
                              <p className="text-xs text-muted-foreground">Telefone</p>
                              <p className="font-medium">{player.phone}</p>
                            </div>
                          )}
                          {player.address && (
                            <div className="md:col-span-3">
                              <p className="text-xs text-muted-foreground">Morada</p>
                              <p className="font-medium">{player.address}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Documents Info */}
                    {(player.id_document_type || player.federation_id || player.tax_id) && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Documentação
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {player.id_document_type && (
                            <div>
                              <p className="text-xs text-muted-foreground">Documento de ID</p>
                              <p className="font-medium">
                                {ID_DOCUMENT_TYPES.find(d => d.value === player.id_document_type)?.label || player.id_document_type}
                                {player.id_document_number && ` - ${player.id_document_number}`}
                              </p>
                              {player.id_document_expiry && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Validade: {format(new Date(player.id_document_expiry), 'dd/MM/yyyy')}
                                </p>
                              )}
                            </div>
                          )}
                          {player.tax_id && (
                            <div>
                              <p className="text-xs text-muted-foreground">NIF</p>
                              <p className="font-medium">{player.tax_id}</p>
                            </div>
                          )}
                          {player.federation_id && (
                            <div className="flex items-start gap-2">
                              <Shield className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Nº Federado</p>
                                <p className="font-medium">{player.federation_id}</p>
                              </div>
                            </div>
                          )}
                          {player.medical_certificate_expiry && (
                            <div className="flex items-start gap-2">
                              <Heart className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Atestado Médico</p>
                                <p className="font-medium">
                                  Válido até {format(new Date(player.medical_certificate_expiry), 'dd/MM/yyyy')}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Parents Info */}
                    {(player.parent_name || player.parent_name_2) && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3">Encarregados de Educação</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {player.parent_name && (
                            <div className="space-y-2">
                              <p className="font-medium">{player.parent_name}</p>
                              <div className="text-sm text-muted-foreground space-y-1">
                                {player.parent_email && <p>{player.parent_email}</p>}
                                {player.parent_phone && <p>{player.parent_phone}</p>}
                              </div>
                            </div>
                          )}
                          {player.parent_name_2 && (
                            <div className="space-y-2">
                              <p className="font-medium">{player.parent_name_2}</p>
                              <div className="text-sm text-muted-foreground space-y-1">
                                {player.parent_email_2 && <p>{player.parent_email_2}</p>}
                                {player.parent_phone_2 && <p>{player.parent_phone_2}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {player.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">{player.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs - 360º Player Profile */}
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto justify-start">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="evaluations">Avaliações</TabsTrigger>
            <TabsTrigger value="evolution">Evolução</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="trainings">Treinos</TabsTrigger>
            <TabsTrigger value="matches">Jogos</TabsTrigger>
            <TabsTrigger value="positions">Posições</TabsTrigger>
            <TabsTrigger value="minutes">Minutos</TabsTrigger>
            <TabsTrigger value="plan">Plano Individual</TabsTrigger>
            <TabsTrigger value="observations">Observações</TabsTrigger>
            <TabsTrigger value="health">Saúde / Lesões</TabsTrigger>
            <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="seasons">Histórico Época</TabsTrigger>
            <TabsTrigger value="history">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <ErrorBoundary label="tab Resumo">
            <ErrorBoundary label="ficha FM">
              <PlayerFMCard playerId={player.id} />
            </ErrorBoundary>
            <PlayerSummaryTab player={player} seasonStats={seasonStats} latestEval={latestEval} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ErrorBoundary label="painel Pontos Fortes">
                <PlayerStrengthsPanel playerId={player.id} kind="strength" canEdit={canEditFocus} />
              </ErrorBoundary>
              <ErrorBoundary label="painel A Melhorar">
                <PlayerImprovementPanel playerId={player.id} canEdit={canEditFocus} />
              </ErrorBoundary>
            </div>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="evaluations">
            <ErrorBoundary label="tab Avaliações">
            <PlayerEvaluations playerId={player.id} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="evolution">
            <ErrorBoundary label="tab Evolução">
            <PlayerEvolutionTab playerId={player.id} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="analytics">
            <ErrorBoundary label="tab Analytics">
            <PlayerAnalyticsTab
              playerId={player.id}
              teamId={player.team?.id ?? null}
              position={player.position ?? null}
            />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="trainings">
            <ErrorBoundary label="tab Treinos">
            <PlayerTrainingsTab playerId={player.id} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="matches">
            <ErrorBoundary label="tab Jogos">
            <PlayerMatchesTab playerId={player.id} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="positions">
            <ErrorBoundary label="tab Posições">
            <PlayerPositionsTab
              playerId={player.id}
              declaredPosition={player.position}
              secondaryPositions={player.secondary_positions}
            />
            </ErrorBoundary>
          </TabsContent>


          <TabsContent value="minutes">
            <ErrorBoundary label="tab Minutos">
            <PlayerMinutesTab playerId={player.id} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="plan">
            <ErrorBoundary label="tab Plano Individual">
            <PlayerDevelopmentPlanTab playerId={player.id} clubId={clubId} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="observations">
            <ErrorBoundary label="tab Observações">
            <PlayerObservationsTab playerId={player.id} clubId={clubId} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="health">
            <ErrorBoundary label="tab Saúde / Lesões">
            <div className="space-y-4">
              {seasonStats && (
                <PlayerSeasonStats stats={seasonStats} isGoalkeeper={player.position === 'GK'} />
              )}
              <PlayerInjuries playerId={player.id} />
            </div>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="availability">
            <ErrorBoundary label="tab Disponibilidade">
            <PlayerAvailabilityTab playerId={player.id} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="documents">
            <ErrorBoundary label="tab Documentos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Gestão de Documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PlayerDocuments
                  playerId={player.id}
                  player={player}
                  onUpdate={() => queryClient.invalidateQueries({ queryKey: ['player', id] })}
                />
              </CardContent>
            </Card>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="seasons">
            <ErrorBoundary label="tab Histórico Época">
            <PlayerSeasonHistoryTab playerId={player.id} canEdit={canEditFocus} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="history">
            <ErrorBoundary label="tab Auditoria">
            <PlayerHistory playerId={player.id} />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>

        {/* PIN Dialog */}
        <PinDialog
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          mode={pinDialogMode}
          onSubmit={pinDialogMode === 'create' ? createPin : verifyPin}
        />
      </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
