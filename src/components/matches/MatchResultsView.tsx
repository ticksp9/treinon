import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Trophy, Eye, MapPin, Pencil, FileSearch, Trash2 } from 'lucide-react';
import { MatchReport } from './MatchReport';
import { PostGameStepper } from './PostGameStepper';
import { QuickMatchEntry } from './QuickMatchEntry';
import { ReportReviewScreen } from './ReportReviewScreen';
import { getHalfDurationForCategory } from '@/lib/constants';
import { isEditableReportStatus, REPORT_STATUS_LABELS, type ReportStatus } from '@/lib/match-report-service';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

interface Lineup {
  id: string;
  player_id: string;
  is_starter: boolean;
  minutes_played: number | null;
  position_played: string | null;
  player: Player;
}

interface MatchEvent {
  id: string;
  event_type: string;
  minute: number;
  second: number | null;
  player_id: string | null;
  assist_player_id: string | null;
  is_opponent: boolean;
  notes: string | null;
  player?: Player;
  assist_player?: Player;
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
  is_test?: boolean;
  is_deleted?: boolean;
  report_status?: string;
  report_entry_mode?: string;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
  sport_type?: string | null;
}

interface MatchResultsViewProps {
  teamId: string;
  matches: Match[];
  team?: Team;
  /** friendlies / test matches can be deleted after they ended */
  onDelete?: (match: { id: string }) => void;
  canDelete?: (match: { id: string }) => boolean;
}

function getInitialTab(reportStatus: string | undefined): string {
  if (!reportStatus) return 'edit';
  if (isEditableReportStatus(reportStatus)) return 'edit';
  if (reportStatus === 'finalized') return 'review';
  if (reportStatus === 'locked') return 'report';
  return 'edit';
}

export function MatchResultsView({ teamId, matches, team, onDelete, canDelete }: MatchResultsViewProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [quickEntryId, setQuickEntryId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDialogTab, setActiveDialogTab] = useState<string>('edit');
  const [reportStatus, setReportStatus] = useState<ReportStatus>('draft');
  const [matchPartElapsed, setMatchPartElapsed] = useState<number[]>([]);
  const [matchPartStarters, setMatchPartStarters] = useState<Record<string, string[]>>({});
  const [matchPartRegulation, setMatchPartRegulation] = useState<number[]>([]);
  const [matchPartsCount, setMatchPartsCount] = useState(2);

  // Show matches that are completed, finished, or have any report status
  const completedMatches = matches.filter(m =>
    !m.is_test && !m.is_deleted && (
      m.status === 'completed' ||
      m.status === 'finished' ||
      m.report_status === 'pending_completion' ||
      m.report_status === 'draft' ||
      m.report_status === 'in_progress' ||
      m.report_status === 'finalized' ||
      m.report_status === 'reopened' ||
      m.report_status === 'corrected' ||
      m.report_status === 'locked'
    )
  );

  const fetchMatchDetails = useCallback(async (matchId: string) => {
    setLoading(true);
    try {
      const { data: matchData } = await supabase
        .from('matches')
        .select('goals_for, goals_against, part_elapsed_seconds, part_duration_minutes, part_starter_ids, part_regulation_minutes, parts_count')
        .eq('id', matchId)
        .single();

      if (matchData?.part_elapsed_seconds) {
        setMatchPartElapsed(matchData.part_elapsed_seconds as number[]);
      } else {
        setMatchPartElapsed([]);
      }
      setMatchPartStarters((((matchData as any)?.part_starter_ids as Record<string, string[]> | null) ?? {}));
      setMatchPartRegulation((((matchData as any)?.part_regulation_minutes as number[] | null) ?? []));
      setMatchPartsCount(((matchData as any)?.parts_count as number | null) ?? 2);

      // Update match goals from DB
      if (matchData && selectedMatch) {
        setSelectedMatch(prev => prev ? {
          ...prev,
          goals_for: matchData.goals_for,
          goals_against: matchData.goals_against,
        } : prev);
      }

      const { data: lineupsData } = await supabase
        .from('match_lineups')
        .select('id, player_id, is_starter, minutes_played, position_played, player:players(id, name, number, position)')
        .eq('match_id', matchId);

      const { data: eventsData } = await supabase
        .from('match_events')
        .select('id, event_type, minute, second, player_id, assist_player_id, is_opponent, notes, player:players!match_events_player_id_fkey(id, name, number, position), assist_player:players!match_events_assist_player_id_fkey(id, name, number, position)')
        .eq('match_id', matchId)
        .order('minute', { ascending: true });

      setLineups((lineupsData || []).map((l: any) => ({
        ...l,
        player: Array.isArray(l.player) ? l.player[0] : l.player,
      })));
      setEvents((eventsData || []).map((e: any) => ({
        ...e,
        player: Array.isArray(e.player) ? e.player[0] : e.player,
        assist_player: Array.isArray(e.assist_player) ? e.assist_player[0] : e.assist_player,
      })));
    } catch (error) {
      console.error('Error fetching match details:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMatch]);

  const handleViewReport = (match: Match) => {
    const status = (match.report_status as ReportStatus) || 'draft';
    setSelectedMatch(match);
    setReportStatus(status);
    setActiveDialogTab(getInitialTab(match.report_status));
    fetchMatchDetails(match.id);
  };

  const handleStatusChange = (newStatus: ReportStatus) => {
    setReportStatus(newStatus);
    if (selectedMatch) {
      setSelectedMatch({ ...selectedMatch, report_status: newStatus });
    }
    if (newStatus === 'reopened') {
      setActiveDialogTab('edit');
    }
  };

  // Refresh data after PostGameStepper saves — keeps Report/Review tabs in sync
  const handleDataChanged = useCallback(() => {
    if (selectedMatch) {
      fetchMatchDetails(selectedMatch.id);
    }
  }, [selectedMatch, fetchMatchDetails]);

  const getResultBadge = (match: Match) => {
    const goalsFor = match.goals_for ?? 0;
    const goalsAgainst = match.goals_against ?? 0;
    if (goalsFor > goalsAgainst) return <Badge className="bg-green-600">V</Badge>;
    if (goalsFor < goalsAgainst) return <Badge variant="destructive">D</Badge>;
    return <Badge variant="secondary">E</Badge>;
  };

  const halfDuration = getHalfDurationForCategory(team?.category || null);

  if (completedMatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sem Resultados</h3>
          <p className="text-muted-foreground">Ainda não há jogos terminados.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Resultados ({completedMatches.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {completedMatches.map(match => {
            const goalsFor = match.goals_for ?? 0;
            const goalsAgainst = match.goals_against ?? 0;
            return (
              <div
                key={match.id}
                className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => handleViewReport(match)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <div className="text-sm font-medium">{format(new Date(match.match_date), 'dd MMM', { locale: pt })}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(match.match_date), 'yyyy')}</div>
                  </div>
                  {getResultBadge(match)}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-xs">
                        {match.is_home ? 'CASA' : 'FORA'}
                      </Badge>
                      {match.is_home
                        ? `${team?.name || 'Equipa'} vs ${match.opponent_name}`
                        : `${match.opponent_name} vs ${team?.name || 'Equipa'}`}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {match.competition && <span>{match.competition}</span>}
                      {match.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{match.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold">
                    {match.is_home ? `${goalsFor} - ${goalsAgainst}` : `${goalsAgainst} - ${goalsFor}`}
                  </div>
                  <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" />Ver</Button>
                  {onDelete && canDelete?.(match) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(match); }} title="Eliminar este jogo (amigável/teste): os minutos deixam de contar" aria-label="Eliminar jogo">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {match.report_status && match.report_status !== 'locked' && (
                    <Badge variant="outline" className="text-xs">
                      {REPORT_STATUS_LABELS[(match.report_status as ReportStatus)] || match.report_status}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {quickEntryId && (
        <QuickMatchEntry matchId={quickEntryId} open onClose={() => setQuickEntryId(null)} onSaved={() => selectedMatch && fetchMatchDetails(selectedMatch.id)} />
      )}
      <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />Relatório do Jogo
              {selectedMatch && (
                <Button size="sm" variant="outline" className="ml-auto mr-6" onClick={() => setQuickEntryId(selectedMatch.id)} title="Corrigir minutos, golos e cartões de forma simples">
                  Registo rápido
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">A carregar...</p>
            </div>
          ) : selectedMatch && (
            <Tabs value={activeDialogTab} onValueChange={setActiveDialogTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="report"><Eye className="w-4 h-4 mr-1" />Relatório</TabsTrigger>
                <TabsTrigger value="edit"><Pencil className="w-4 h-4 mr-1" />Editar</TabsTrigger>
                <TabsTrigger value="review"><FileSearch className="w-4 h-4 mr-1" />Revisão</TabsTrigger>
              </TabsList>
              <TabsContent value="report">
                <MatchReport
                  match={selectedMatch}
                  lineups={lineups}
                  events={events}
                  teamName={team?.name}
                  partElapsedSeconds={matchPartElapsed}
                  halfDuration={halfDuration}
                  partRegulationMinutes={matchPartRegulation}
                  partStartersByIndex={matchPartStarters}
                  partsCount={matchPartsCount}
                  sportType={team?.sport_type}
                  secondHalfStarterIds={(selectedMatch as any)?.second_half_starter_ids ?? null}
                />
              </TabsContent>
              <TabsContent value="edit">
                <PostGameStepper
                  matchId={selectedMatch.id}
                  teamId={teamId}
                  reportStatus={reportStatus}
                  onStatusChange={handleStatusChange}
                  onClose={() => setSelectedMatch(null)}
                  onRequestTabChange={setActiveDialogTab}
                  onDataChanged={handleDataChanged}
                />
              </TabsContent>
              <TabsContent value="review">
                <ReportReviewScreen
                  matchId={selectedMatch.id}
                  reportStatus={reportStatus}
                  onStatusChange={handleStatusChange}
                  onClose={() => setSelectedMatch(null)}
                  onRequestTabChange={setActiveDialogTab}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
