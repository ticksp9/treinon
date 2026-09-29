import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  RotateCcw, CheckCircle, Clock, FileText, History,
  AlertTriangle, ArrowRight, RefreshCw, Shield
} from 'lucide-react';
import {
  canReopenReportStatus,
  getOrCreateMatchReport,
  getReportEditLockReason,
  getReportMutationErrorMessage,
  isEditableReportStatus,
  updateReportStatus,
  saveReportVersion,
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
import { applyPreciseMinutes } from '@/lib/playing-time-seconds';
import { ConflictAlertsPanel } from './ConflictAlertsPanel';
import { MatchStatusBadge } from './MatchStatusBadge';

interface ReportReviewScreenProps {
  matchId: string;
  reportStatus: ReportStatus;
  onStatusChange: (newStatus: ReportStatus) => void;
  onClose: () => void;
  onRequestTabChange?: (tab: string) => void;
}

interface VersionSnapshot {
  id: string;
  version_no: number;
  snapshot_json: ReportSnapshot | null;
  created_at: string;
  created_by: string | null;
}

export function ReportReviewScreen({ matchId, reportStatus, onStatusChange, onClose, onRequestTabChange }: ReportReviewScreenProps) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersionA, setSelectedVersionA] = useState<number | null>(null);
  const [selectedVersionB, setSelectedVersionB] = useState<number | null>(null);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [sportType, setSportType] = useState<string | null>(null);
  const [lineups, setLineups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [partElapsed, setPartElapsed] = useState<number[]>([]);
  const [partDuration, setPartDuration] = useState(45);
  const [partsCount, setPartsCount] = useState(2);
  const [partStartersByIndex, setPartStartersByIndex] = useState<Record<string, string[]>>({});
  const [partRegulationMinutes, setPartRegulationMinutes] = useState<number[]>([]);
  const [goalsFor, setGoalsFor] = useState(0);
  const [goalsAgainst, setGoalsAgainst] = useState(0);
  const [secondHalfStarterIds, setSecondHalfStarterIds] = useState<string[] | null>(null);
  const [reportNotes, setReportNotes] = useState<string | null>(null);

  const canReopen = canReopenReportStatus(reportStatus);
  const isEditable = isEditableReportStatus(reportStatus);
  const editLockReason = getReportEditLockReason(reportStatus);

  useEffect(() => { loadData(); }, [matchId, user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const report = user ? await getOrCreateMatchReport(matchId, user.id, null) : null;
      if (report?.report_status && report.report_status !== reportStatus) {
        onStatusChange(report.report_status);
      }
      setReportNotes(report?.notes || null);

      const [v, a] = await Promise.all([getReportVersions(matchId), getReportAuditLogs(matchId)]);
      setVersions(v as VersionSnapshot[]);
      setAuditLogs(a);

      if (v.length >= 2) {
        setSelectedVersionA(v[1]?.version_no);
        setSelectedVersionB(v[0]?.version_no);
      } else if (v.length === 1) {
        setSelectedVersionB(v[0]?.version_no);
      }

      // Load match data for recalculation
      const { data: matchData } = await supabase
        .from('matches')
        .select('goals_for, goals_against, part_elapsed_seconds, part_duration_minutes, team_id, second_half_starter_ids, part_starter_ids, part_regulation_minutes, parts_count')
        .eq('id', matchId).single();

      if (matchData) {
        setGoalsFor(matchData.goals_for || 0);
        setGoalsAgainst(matchData.goals_against || 0);
        setPartElapsed((matchData.part_elapsed_seconds as number[]) || []);
        setPartDuration(matchData.part_duration_minutes || 45);
        setPartsCount((matchData as any).parts_count || 2);
        setPartStartersByIndex((((matchData as any).part_starter_ids as Record<string, string[]> | null) ?? {}));
        setPartRegulationMinutes(((matchData as any).part_regulation_minutes as number[] | null) ?? []);
        setSecondHalfStarterIds(((matchData as any).second_half_starter_ids as string[] | null) ?? null);
        if (matchData.team_id) {
          const { data: td } = await supabase.from('teams').select('sport_type').eq('id', matchData.team_id).single();
          if (td) setSportType(td.sport_type);
        }
      }

      const { data: ld } = await supabase.from('match_lineups')
        .select('id, player_id, is_starter, minutes_played, player:players(id, name, number, position)')
        .eq('match_id', matchId);
      setLineups((ld || []).map((l: any) => ({ ...l, player: Array.isArray(l.player) ? l.player[0] : l.player })));

      const { data: ed } = await supabase.from('match_events')
        .select('id, event_type, minute, second, player_id, assist_player_id, is_opponent, notes')
        .eq('match_id', matchId).order('minute', { ascending: true });
      setEvents(ed || []);
    } catch (error) {
      console.error('Error loading review data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!user || !reopenReason.trim()) { toast.error('Informe o motivo da reabertura.'); return; }
    await updateReportStatus(matchId, 'reopened', user.id, reopenReason);
    onStatusChange('reopened');
    setShowReopenDialog(false);
    setReopenReason('');
    toast.success('Relatório reaberto com sucesso. Já pode corrigir.');
    // Navigate to edit tab immediately
    onRequestTabChange?.('edit');
    loadData();
  };

  const handleRecalculate = async () => {
    if (!user) return;
    setRecalculating(true);
    try {
      const elapsed = partElapsed.length > 0 ? partElapsed : [];
      const { totalMinutes, partMinutes: pm } = elapsed.length > 0 ? getPartTimesFromElapsed(elapsed) : { totalMinutes: partDuration * partsCount, partMinutes: Array(partsCount).fill(partDuration) };
      const firstPart = new Set(partStartersByIndex['1'] ?? lineups.filter((l: any) => l.is_starter).map((l: any) => l.player_id));
      const starterInfos: StarterInfo[] = lineups.map((l: any) => ({
        player_id: l.player_id,
        is_starter: firstPart.has(l.player_id),
      }));
      const regulationPartMinutes = partRegulationMinutes.length === partsCount ? partRegulationMinutes : Array(partsCount).fill(partDuration);
      const stats = applyPreciseMinutes(
        computeMatchPlayerStats(starterInfos, events as MatchEventForCalc[], totalMinutes, pm, sportType, { secondHalfStarters: partStartersByIndex['2'] ?? secondHalfStarterIds, partStarters: partStartersByIndex, regulationPartMinutes, numberOfParts: partsCount }),
        {
          partSeconds: partElapsed,
          partStarters: { ...partStartersByIndex, ...(!partStartersByIndex['2'] && secondHalfStarterIds?.length ? { '2': secondHalfStarterIds } : {}) },
          firstPartStarters: starterInfos.filter(s => s.is_starter).map(s => s.player_id),
          events: events as MatchEventForCalc[],
        },
      );
      for (const stat of stats) {
        const lineup = lineups.find((l: any) => l.player_id === stat.playerId);
        if (lineup) await supabase.from('match_lineups').update({ minutes_played: stat.totalMinutes }).eq('id', lineup.id);
      }
      toast.success('Minutos recalculados com sucesso');
      loadData();
    } catch (error) {
      toast.error('Erro ao recalcular');
    } finally {
      setRecalculating(false);
    }
  };

  const handleFinalizeCorrection = async () => {
    if (!user) return;
    try {
      const report = await getOrCreateMatchReport(matchId, user.id, null);
      if (!report) throw new Error('REPORT_CREATE_FAILED');

      await supabase.from('match_reports').update({ notes: reportNotes, updated_by: user.id }).eq('id', report.id);
      const snapshot: ReportSnapshot = {
        lineups: lineups.map((l: any) => ({ player_id: l.player_id, is_starter: l.is_starter })),
        events: events.map((e: any) => ({ id: e.id, event_type: e.event_type, minute: e.minute, player_id: e.player_id })),
        goals_for: goalsFor, goals_against: goalsAgainst, part_elapsed_seconds: partElapsed, notes: reportNotes,
      };
      await saveReportVersion(matchId, user.id, snapshot);
      await updateReportStatus(matchId, 'corrected', user.id);
      onStatusChange('corrected');
      toast.success('Nova versão finalizada com sucesso');
      loadData();
    } catch (error) { toast.error(getReportMutationErrorMessage(error)); }
  };

  // Compute issues
  const localIssues = (() => {
    const { totalMinutes: matchEnd, partMinutes } = partElapsed.length > 0
      ? getPartTimesFromElapsed(partElapsed)
      : { totalMinutes: partDuration * partsCount, partMinutes: Array(partsCount).fill(partDuration) };
    const firstPart = partStartersByIndex['1'] ? new Set(partStartersByIndex['1']) : null;
    return checkMatchConsistency(
      lineups.map((l: any) => ({
        player_id: l.player_id,
        is_starter: firstPart ? firstPart.has(l.player_id) : wasOriginalStarter(l.player_id, events as MatchEventForCalc[], l.is_starter),
      })),
      events as MatchEventForCalc[], matchEnd, sportType,
      { partStarters: partStartersByIndex, realPartMinutes: partMinutes },
    );
  })();

  // Diff between two versions
  const computeDiff = () => {
    const vA = versions.find(v => v.version_no === selectedVersionA);
    const vB = versions.find(v => v.version_no === selectedVersionB);
    if (!vA?.snapshot_json || !vB?.snapshot_json) return [];

    const changes: { field: string; before: string; after: string }[] = [];
    const a = vA.snapshot_json;
    const b = vB.snapshot_json;

    if (a.goals_for !== b.goals_for) changes.push({ field: 'Golos a Favor', before: String(a.goals_for), after: String(b.goals_for) });
    if (a.goals_against !== b.goals_against) changes.push({ field: 'Golos Contra', before: String(a.goals_against), after: String(b.goals_against) });
    if (JSON.stringify(a.lineups) !== JSON.stringify(b.lineups)) changes.push({ field: 'Escalação', before: `${a.lineups?.length || 0} jogadores`, after: `${b.lineups?.length || 0} jogadores` });
    if (JSON.stringify(a.events) !== JSON.stringify(b.events)) changes.push({ field: 'Eventos', before: `${a.events?.length || 0} eventos`, after: `${b.events?.length || 0} eventos` });
    if (a.notes !== b.notes) changes.push({ field: 'Notas', before: a.notes || '(vazio)', after: b.notes || '(vazio)' });

    return changes;
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">A carregar revisão...</p>
      </div>
    );
  }

  const diff = computeDiff();
  const latestVersion = versions[0];

  const ACTION_LABELS: Record<string, string> = {
    status_change: 'Alteração de estado',
    event_added: 'Evento adicionado',
    event_deleted: 'Evento removido',
    event_edited: 'Evento editado',
    report_created: 'Relatório criado',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MatchStatusBadge status={reportStatus} />
          {latestVersion && (
            <Badge variant="secondary" className="text-xs">v{latestVersion.version_no}</Badge>
          )}
          {!isEditable && editLockReason && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {editLockReason}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {canReopen && (
            <Button variant="outline" size="sm" onClick={() => setShowReopenDialog(true)}>
              <RotateCcw className="w-4 h-4 mr-1" /> Reabrir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
            <RefreshCw className={`w-4 h-4 mr-1 ${recalculating ? 'animate-spin' : ''}`} /> Recalcular
          </Button>
          {isEditable && (
            <Button size="sm" onClick={handleFinalizeCorrection} disabled={localIssues.some(i => i.type === 'error')}>
              <CheckCircle className="w-4 h-4 mr-1" /> Finalizar nova versão
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="summary"><FileText className="w-4 h-4 mr-1 hidden sm:inline" /> Resumo</TabsTrigger>
          <TabsTrigger value="diff"><ArrowRight className="w-4 h-4 mr-1 hidden sm:inline" /> Diferenças</TabsTrigger>
          <TabsTrigger value="conflicts"><AlertTriangle className="w-4 h-4 mr-1 hidden sm:inline" /> Conflitos</TabsTrigger>
          <TabsTrigger value="audit"><History className="w-4 h-4 mr-1 hidden sm:inline" /> Auditoria</TabsTrigger>
        </TabsList>

        {/* Summary */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Minutos por Atleta</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {lineups.sort((a: any, b: any) => (b.minutes_played || 0) - (a.minutes_played || 0)).map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-secondary/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="min-w-[28px] justify-center text-xs">{l.player?.number || '-'}</Badge>
                      <span className="text-sm">{l.player?.name}</span>
                    </div>
                    <span className="text-sm font-medium">{l.minutes_played || 0}'</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Versões ({versions.length})</CardTitle></CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem versões guardadas</p>
              ) : (
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{v.version_no}</Badge>
                        <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString('pt-PT')}</span>
                      </div>
                      {v.snapshot_json && (
                        <span className="text-xs text-muted-foreground">
                          {(v.snapshot_json as any).goals_for ?? '?'} - {(v.snapshot_json as any).goals_against ?? '?'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diff */}
        <TabsContent value="diff" className="space-y-4">
          {versions.length < 2 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <ArrowRight className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">São necessárias pelo menos 2 versões para comparar diferenças.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">v{selectedVersionA}</Badge>
                <ArrowRight className="w-4 h-4" />
                <Badge variant="outline">v{selectedVersionB}</Badge>
              </div>
              {diff.length === 0 ? (
                <Card>
                  <CardContent className="py-4 text-center text-sm text-muted-foreground">Sem diferenças detetadas entre estas versões.</CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-4 space-y-3">
                    {diff.map((d, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded bg-secondary/20">
                        <div className="font-medium text-sm min-w-[100px]">{d.field}</div>
                        <div className="flex-1 text-sm">
                          <span className="text-destructive line-through">{d.before}</span>
                          <ArrowRight className="w-3 h-3 inline mx-2 text-muted-foreground" />
                          <span className="text-primary font-medium">{d.after}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Conflicts */}
        <TabsContent value="conflicts">
          {localIssues.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 mx-auto text-primary/50 mb-2" />
                <p className="text-sm text-muted-foreground">Sem conflitos detetados.</p>
              </CardContent>
            </Card>
          ) : (
            <ConflictAlertsPanel matchId={matchId} localIssues={localIssues} />
          )}
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          {auditLogs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <History className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Ainda não existem registos de auditoria.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4 space-y-2">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="p-3 border rounded text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{ACTION_LABELS[log.action] || log.action}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString('pt-PT')}</span>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-1">Motivo: {log.reason}</p>
                    )}
                    {(log.before_data || log.after_data) && (
                      <div className="flex gap-4 mt-1 text-xs">
                        {log.before_data && <span className="text-destructive">Antes: {JSON.stringify(log.before_data)}</span>}
                        {log.after_data && <span className="text-primary">Depois: {JSON.stringify(log.after_data)}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Close */}
      <div className="flex justify-end pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </div>

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
    </div>
  );
}
