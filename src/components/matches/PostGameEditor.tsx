import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Save, CheckCircle, RotateCcw, Clock, Target,
  UserPlus, UserMinus, AlertTriangle, History, Pencil, Trash2, Plus
} from 'lucide-react';
import {
  updateReportStatus,
  saveReportVersion,
  logReportEdit,
  logReportAudit,
  getReportVersions,
  getReportAuditLogs,
  REPORT_STATUS_LABELS,
  type ReportStatus,
  type ReportSnapshot,
} from '@/lib/match-report-service';
import {
  computeMatchPlayerStats,
  wasOriginalStarter,
  getPartTimesFromElapsed,
  checkMatchConsistency,
  type MatchEventForCalc,
  type StarterInfo,
} from '@/lib/match-playing-time';
import { getMatchRuleSnapshot, type MatchRuleSnapshot } from '@/lib/match-rules-service';
import { MatchRulesPanel } from './MatchRulesPanel';
import { ConflictAlertsPanel } from './ConflictAlertsPanel';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
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

interface Lineup {
  id: string;
  player_id: string;
  is_starter: boolean;
  minutes_played: number | null;
  position_played: string | null;
  player: Player;
}

interface PostGameEditorProps {
  matchId: string;
  teamId: string;
  reportStatus: ReportStatus;
  onStatusChange: (newStatus: ReportStatus) => void;
  onClose: () => void;
}

export function PostGameEditor({ matchId, teamId, reportStatus, onStatusChange, onClose }: PostGameEditorProps) {
  const { user } = useAuth();
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [goalsFor, setGoalsFor] = useState(0);
  const [goalsAgainst, setGoalsAgainst] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ event_type: 'goal', minute: 0, player_id: '', is_opponent: false, assist_player_id: '', notes: '' });
  const [partElapsed, setPartElapsed] = useState<number[]>([]);
  const [partDuration, setPartDuration] = useState(45);
  const [ruleSnapshot, setRuleSnapshot] = useState<MatchRuleSnapshot | null>(null);
  const [sportType, setSportType] = useState<string | null>(null);

  const isEditable = ['draft', 'pending_completion', 'reopened', 'in_progress'].includes(reportStatus);
  const canFinalize = ['draft', 'pending_completion', 'pending_review', 'reopened', 'corrected', 'in_progress'].includes(reportStatus);
  const canReopen = ['finalized', 'corrected'].includes(reportStatus);

  useEffect(() => {
    fetchData();
  }, [matchId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch match
      const { data: matchData } = await supabase
        .from('matches')
        .select('goals_for, goals_against, part_elapsed_seconds, part_duration_minutes, team_id')
        .eq('id', matchId)
        .single();

      if (matchData) {
        setGoalsFor(matchData.goals_for || 0);
        setGoalsAgainst(matchData.goals_against || 0);
        setPartElapsed((matchData.part_elapsed_seconds as number[]) || []);
        setPartDuration(matchData.part_duration_minutes || 45);
        // Fetch team sport type
        if (matchData.team_id) {
          const { data: teamData } = await supabase.from('teams').select('sport_type').eq('id', matchData.team_id).single();
          if (teamData) setSportType(teamData.sport_type);
        }
      }

      // Fetch rule snapshot
      const snap = await getMatchRuleSnapshot(matchId);
      if (snap) setRuleSnapshot(snap);

      // Fetch lineups
      const { data: lineupsData } = await supabase
        .from('match_lineups')
        .select('id, player_id, is_starter, minutes_played, position_played, player:players(id, name, number, position)')
        .eq('match_id', matchId);

      const transformedLineups = (lineupsData || []).map((l: any) => ({
        ...l,
        player: Array.isArray(l.player) ? l.player[0] : l.player,
      }));
      setLineups(transformedLineups);

      // Fetch events
      const { data: eventsData } = await supabase
        .from('match_events')
        .select('id, event_type, minute, second, player_id, assist_player_id, is_opponent, notes, player:players!match_events_player_id_fkey(id, name, number, position), assist_player:players!match_events_assist_player_id_fkey(id, name, number, position)')
        .eq('match_id', matchId)
        .order('minute', { ascending: true });

      const transformedEvents = (eventsData || []).map((e: any) => ({
        ...e,
        player: Array.isArray(e.player) ? e.player[0] : e.player,
        assist_player: Array.isArray(e.assist_player) ? e.assist_player[0] : e.assist_player,
      }));
      setEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const recalculateMinutes = () => {
    const elapsed = partElapsed.length > 0 ? partElapsed : [];
    const { totalMinutes } = elapsed.length > 0
      ? getPartTimesFromElapsed(elapsed)
      : { totalMinutes: partDuration * 2 };

    const starterInfos: StarterInfo[] = lineups.map(l => ({
      player_id: l.player_id,
      is_starter: wasOriginalStarter(l.player_id, events as MatchEventForCalc[], l.is_starter),
    }));

    return computeMatchPlayerStats(starterInfos, events as MatchEventForCalc[], totalMinutes, undefined, sportType);
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Update match goals
      await supabase.from('matches').update({
        goals_for: goalsFor,
        goals_against: goalsAgainst,
      }).eq('id', matchId);

      // Recalculate and save minutes
      const stats = recalculateMinutes();
      for (const stat of stats) {
        const lineup = lineups.find(l => l.player_id === stat.playerId);
        if (lineup) {
          await supabase.from('match_lineups').update({
            minutes_played: stat.totalMinutes,
          }).eq('id', lineup.id);
        }
      }

      // Save version
      const snapshot: ReportSnapshot = {
        lineups: lineups.map(l => ({ player_id: l.player_id, is_starter: l.is_starter })),
        events: events.map(e => ({ id: e.id, event_type: e.event_type, minute: e.minute, player_id: e.player_id })),
        goals_for: goalsFor,
        goals_against: goalsAgainst,
        part_elapsed_seconds: partElapsed,
        notes,
      };
      await saveReportVersion(matchId, user.id, snapshot);

      if (reportStatus === 'draft' || reportStatus === 'in_progress') {
        await updateReportStatus(matchId, 'pending_completion', user.id);
        onStatusChange('pending_completion');
      }

      toast.success('Rascunho guardado com sucesso');
      await fetchData();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Erro ao guardar rascunho');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Recalculate minutes first
      const stats = recalculateMinutes();
      for (const stat of stats) {
        const lineup = lineups.find(l => l.player_id === stat.playerId);
        if (lineup) {
          await supabase.from('match_lineups').update({
            minutes_played: stat.totalMinutes,
          }).eq('id', lineup.id);
        }
      }

      // Update match
      await supabase.from('matches').update({
        goals_for: goalsFor,
        goals_against: goalsAgainst,
        status: 'completed',
      }).eq('id', matchId);

      // Save final version
      const snapshot: ReportSnapshot = {
        lineups: lineups.map(l => ({ player_id: l.player_id, is_starter: l.is_starter })),
        events: events.map(e => ({ id: e.id, event_type: e.event_type, minute: e.minute, player_id: e.player_id })),
        goals_for: goalsFor,
        goals_against: goalsAgainst,
        part_elapsed_seconds: partElapsed,
        notes,
      };
      await saveReportVersion(matchId, user.id, snapshot);

      const prevStatus = reportStatus;
      const nextStatus: ReportStatus = prevStatus === 'reopened' ? 'corrected' : 'finalized';
      await updateReportStatus(matchId, nextStatus, user.id);
      onStatusChange(nextStatus);

      toast.success('Relatório finalizado com sucesso');
    } catch (error) {
      console.error('Error finalizing:', error);
      toast.error('Erro ao finalizar relatório');
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!user || !reopenReason.trim()) {
      toast.error('Indique o motivo da reabertura');
      return;
    }
    try {
      await updateReportStatus(matchId, 'reopened', user.id, reopenReason);
      onStatusChange('reopened');
      setShowReopenDialog(false);
      setReopenReason('');
      toast.success('Relatório reaberto para edição');
    } catch (error) {
      toast.error('Erro ao reabrir relatório');
    }
  };

  const handleAddEvent = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('match_events').insert([{
        match_id: matchId,
        event_type: newEvent.event_type as any,
        minute: newEvent.minute,
        second: 0,
        player_id: newEvent.player_id || null,
        assist_player_id: newEvent.assist_player_id || null,
        is_opponent: newEvent.is_opponent,
        notes: newEvent.notes || null,
        owner_id: user.id,
      }]);

      if (error) throw error;

      await logReportAudit(matchId, null, user.id, 'event_added', null, {
        event_type: newEvent.event_type,
        minute: newEvent.minute,
      });

      toast.success('Evento adicionado');
      setShowAddEventDialog(false);
      setNewEvent({ event_type: 'goal', minute: 0, player_id: '', is_opponent: false, assist_player_id: '', notes: '' });
      await fetchData();
    } catch (error) {
      console.error('Error adding event:', error);
      toast.error('Erro ao adicionar evento');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) return;
    try {
      const deletedEvent = events.find(e => e.id === eventId);
      await supabase.from('match_events').delete().eq('id', eventId);

      await logReportAudit(matchId, null, user.id, 'event_deleted', {
        event_type: deletedEvent?.event_type,
        minute: deletedEvent?.minute,
      }, null);

      toast.success('Evento removido');
      await fetchData();
    } catch (error) {
      toast.error('Erro ao remover evento');
    }
  };

  const loadHistory = async () => {
    const [v, a] = await Promise.all([
      getReportVersions(matchId),
      getReportAuditLogs(matchId),
    ]);
    setVersions(v);
    setAuditLogs(a);
    setShowHistory(true);
  };

  const allPlayers = lineups.map(l => l.player);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">A carregar dados do jogo...</p>
      </div>
    );
  }

  // Compute consistency issues
  const statsForCheck = recalculateMinutes();
  const matchEnd = partElapsed.length > 0 ? getPartTimesFromElapsed(partElapsed).totalMinutes : partDuration * 2;
  const localIssues = checkMatchConsistency(
    lineups.map(l => ({ player_id: l.player_id, is_starter: wasOriginalStarter(l.player_id, events as MatchEventForCalc[], l.is_starter) })),
    events as MatchEventForCalc[],
    matchEnd,
    sportType
  );
  const hasBlockingIssues = localIssues.some(i => i.type === 'error');

  return (
    <div className="space-y-6">
      {/* Rules Panel */}
      {ruleSnapshot && (
        <MatchRulesPanel snapshot={ruleSnapshot} sportType={sportType} compact />
      )}
      {/* Status Header */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={reportStatus === 'finalized' || reportStatus === 'corrected' ? 'default' : 'secondary'}>
                {REPORT_STATUS_LABELS[reportStatus] || reportStatus}
              </Badge>
              {!isEditable && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Relatório não editável neste estado
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadHistory}>
                <History className="w-4 h-4 mr-1" />
                Histórico
              </Button>
              {canReopen && (
                <Button variant="outline" size="sm" onClick={() => setShowReopenDialog(true)}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reabrir
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Resultado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Golos a Favor</Label>
              <Input
                type="number"
                min={0}
                value={goalsFor}
                onChange={e => setGoalsFor(parseInt(e.target.value) || 0)}
                disabled={!isEditable}
              />
            </div>
            <div>
              <Label>Golos Contra</Label>
              <Input
                type="number"
                min={0}
                value={goalsAgainst}
                onChange={e => setGoalsAgainst(parseInt(e.target.value) || 0)}
                disabled={!isEditable}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Eventos ({events.length})
            </span>
            {isEditable && (
              <Button size="sm" variant="outline" onClick={() => setShowAddEventDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem eventos registados</p>
          ) : (
            events.map(event => (
              <div key={event.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{event.minute}'</Badge>
                  <span className="text-sm font-medium">
                    {event.event_type === 'goal' ? '⚽ Golo' :
                     event.event_type === 'own_goal' ? '⚽ Auto-golo' :
                     event.event_type === 'yellow_card' ? '🟨 Amarelo' :
                     event.event_type === 'red_card' ? '🟥 Vermelho' :
                     event.event_type === 'substitution_in' ? '↗ Entrou' :
                     event.event_type === 'substitution_out' ? '↘ Saiu' :
                     event.event_type}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {event.is_opponent ? '(Adversário)' : event.player?.name || ''}
                  </span>
                </div>
                {isEditable && (
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteEvent(event.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Players Minutes Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Minutos Jogados (recalculados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {(() => {
              const stats = recalculateMinutes();
              const statsMap = new Map(stats.map(s => [s.playerId, s]));
              return lineups
                .map(l => ({ lineup: l, stat: statsMap.get(l.player_id) }))
                .sort((a, b) => (b.stat?.totalMinutes || 0) - (a.stat?.totalMinutes || 0))
                .map(({ lineup, stat }) => (
                  <div key={lineup.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-secondary/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="min-w-[32px] justify-center text-xs">
                        {lineup.player.number || '-'}
                      </Badge>
                      <span className="text-sm">{lineup.player.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{stat?.totalMinutes || 0}'</span>
                      <div className="flex gap-1">
                        {stat?.annotations.map((ann, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {ann}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ));
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Notas do Treinador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observações sobre o jogo..."
            disabled={!isEditable}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Conflict Alerts */}
      {localIssues.length > 0 && (
        <ConflictAlertsPanel matchId={matchId} localIssues={localIssues} />
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        {isEditable && (
          <>
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'A guardar...' : 'Guardar Rascunho'}
            </Button>
            {canFinalize && (
              <Button onClick={handleFinalize} disabled={saving || hasBlockingIssues} title={hasBlockingIssues ? 'Resolva os conflitos bloqueantes antes de finalizar' : ''}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {saving ? 'A finalizar...' : 'Finalizar Relatório'}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Evento</DialogTitle>
            <DialogDescription>Adicione um evento ao relatório do jogo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={newEvent.event_type} onValueChange={v => setNewEvent(prev => ({ ...prev, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="goal">Golo</SelectItem>
                  <SelectItem value="own_goal">Auto-golo</SelectItem>
                  <SelectItem value="yellow_card">Cartão Amarelo</SelectItem>
                  <SelectItem value="red_card">Cartão Vermelho</SelectItem>
                  <SelectItem value="substitution_in">Entrada</SelectItem>
                  <SelectItem value="substitution_out">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Minuto</Label>
              <Input type="number" min={0} value={newEvent.minute} onChange={e => setNewEvent(prev => ({ ...prev, minute: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Jogador</Label>
              <Select value={newEvent.player_id} onValueChange={v => setNewEvent(prev => ({ ...prev, player_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar jogador" /></SelectTrigger>
                <SelectContent>
                  {allPlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newEvent.event_type === 'goal' && (
              <div>
                <Label>Assistência</Label>
                <Select value={newEvent.assist_player_id} onValueChange={v => setNewEvent(prev => ({ ...prev, assist_player_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {allPlayers.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notas</Label>
              <Input value={newEvent.notes} onChange={e => setNewEvent(prev => ({ ...prev, notes: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEventDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddEvent}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir Relatório</DialogTitle>
            <DialogDescription>Indique o motivo para reabrir o relatório finalizado.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo da reabertura</Label>
            <Textarea value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="Ex: Corrigir substituição registada incorretamente" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>Cancelar</Button>
            <Button onClick={handleReopen}>Confirmar Reabertura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do Relatório</DialogTitle>
            <DialogDescription>Versões e alterações registadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Versões ({versions.length})</h4>
              {versions.map((v: any) => (
                <div key={v.id} className="p-2 border rounded mb-2 text-sm">
                  <div className="flex justify-between">
                    <span>Versão {v.version_no}</span>
                    <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString('pt-PT')}</span>
                  </div>
                </div>
              ))}
              {versions.length === 0 && <p className="text-sm text-muted-foreground">Sem versões guardadas</p>}
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Auditoria ({auditLogs.length})</h4>
              {auditLogs.map((log: any) => (
                <div key={log.id} className="p-2 border rounded mb-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString('pt-PT')}</span>
                  </div>
                  {log.reason && <p className="text-muted-foreground text-xs mt-1">Motivo: {log.reason}</p>}
                </div>
              ))}
              {auditLogs.length === 0 && <p className="text-sm text-muted-foreground">Sem registos de auditoria</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
