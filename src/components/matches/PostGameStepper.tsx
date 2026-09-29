import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Save, CheckCircle, RotateCcw,
  Clock, Target, Plus, Trash2, AlertTriangle, History, Users,
  ArrowRightLeft, ListChecks, ArrowUp, ArrowDown, Pencil, X,
  RefreshCw, UserMinus, UserPlus
} from 'lucide-react';
import {
  canFinalizeReportStatus,
  canReopenReportStatus,
  getOrCreateMatchReport,
  getReportEditLockReason,
  getReportMutationErrorMessage,
  isEditableReportStatus,
  updateReportStatus,
  saveReportVersion,
  logReportAudit,
  getReportVersions,
  getReportAuditLogs,
  REPORT_STATUS_LABELS,
  type ReportStatus,
  type ReportSnapshot,
} from '@/lib/match-report-service';
import {
  computeMatchPlayerStats,
  computeMatchPlayerStatsWithHalves,
  wasOriginalStarter,
  getPartTimesFromElapsed,
  checkMatchConsistency,
  type MatchEventForCalc,
  type StarterInfo,
} from '@/lib/match-playing-time';
import { applyPreciseMinutes } from '@/lib/playing-time-seconds';
import { getMatchRuleSnapshot, type MatchRuleSnapshot } from '@/lib/match-rules-service';
import { MatchRulesPanel } from './MatchRulesPanel';
import { ConflictAlertsPanel } from './ConflictAlertsPanel';
import { MatchStatusBadge } from './MatchStatusBadge';
import { useIsMobile } from '@/hooks/use-mobile';
import { SubstitutionBatchDialog } from './SubstitutionBatchDialog';
import type { PendingSubstitution } from '@/lib/substitution-batch-service';

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

interface PostGameStepperProps {
  matchId: string;
  teamId: string;
  reportStatus: ReportStatus;
  onStatusChange: (newStatus: ReportStatus) => void;
  onClose: () => void;
  onRequestTabChange?: (tab: string) => void;
  onDataChanged?: () => void;
}

const STEPS = [
  { key: 'result', label: 'Resultado', icon: Target, short: '1' },
  { key: 'lineup', label: 'Escalação', icon: Users, short: '2' },
  { key: 'substitutions', label: 'Substituições', icon: ArrowRightLeft, short: '3' },
  { key: 'events', label: 'Eventos', icon: Clock, short: '4' },
  { key: 'review', label: 'Revisão', icon: ListChecks, short: '5' },
] as const;

type StepKey = typeof STEPS[number]['key'];

export function PostGameStepper({ matchId, teamId, reportStatus, onStatusChange, onClose, onRequestTabChange, onDataChanged }: PostGameStepperProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState(0);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [goalsFor, setGoalsFor] = useState(0);
  const [goalsAgainst, setGoalsAgainst] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partElapsed, setPartElapsed] = useState<number[]>([]);
  const [partDuration, setPartDuration] = useState(45);
  const [partsCount, setPartsCount] = useState(2);
  const [partStartersByIndex, setPartStartersByIndex] = useState<Record<string, string[]>>({});
  const [partRegulationMinutes, setPartRegulationMinutes] = useState<number[]>([]);
  const [ruleSnapshot, setRuleSnapshot] = useState<MatchRuleSnapshot | null>(null);
  const [sportType, setSportType] = useState<string | null>(null);
  // Event dialog
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({ event_type: 'goal', minute: 0, player_id: '', is_opponent: false, assist_player_id: '', notes: '' });
  // Reopen
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  // History
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  // Substitution dialog
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [editingSubPairIds, setEditingSubPairIds] = useState<{ outId: string; inId: string } | null>(null);
  const [subMinute, setSubMinute] = useState(0);
  const [subBatchInitial, setSubBatchInitial] = useState<Array<{ playerOutId: string; playerInId: string }> | null>(null);
  // Manual minutes overrides: playerId -> { value, reason }
  const [minuteOverrides, setMinuteOverrides] = useState<Record<string, { value: number; reason: string }>>({});
  const [editingMinutesPlayerId, setEditingMinutesPlayerId] = useState<string | null>(null);
  const [minuteOverrideValue, setMinuteOverrideValue] = useState(0);
  const [minuteOverrideReason, setMinuteOverrideReason] = useState('');
  // Team players not in lineup (for adding)
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  // Manual 2nd half starters override
  const [manual2ndHalfStarters, setManual2ndHalfStarters] = useState<Set<string> | null>(null);
  // Dirty flag
  const [isDirty, setIsDirty] = useState(false);

  const isEditable = isEditableReportStatus(reportStatus);
  const canFinalize = canFinalizeReportStatus(reportStatus);
  const canReopen = canReopenReportStatus(reportStatus);
  const isCorrectionFlow = reportStatus === 'reopened' || reportStatus === 'corrected' || reportStatus === 'pending_review';

  useEffect(() => { fetchData(); }, [matchId, user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const report = user ? await getOrCreateMatchReport(matchId, user.id, null) : null;
      if (report?.notes) setNotes(report.notes);
      if (report?.report_status && report.report_status !== reportStatus) {
        onStatusChange(report.report_status);
      }

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
        if ((matchData as any).second_half_starter_ids && Array.isArray((matchData as any).second_half_starter_ids)) {
          setManual2ndHalfStarters(new Set((matchData as any).second_half_starter_ids as string[]));
        }
        if (matchData.team_id) {
          const { data: td } = await supabase.from('teams').select('sport_type').eq('id', matchData.team_id).single();
          if (td) setSportType(td.sport_type);
          const { data: tp } = await supabase.from('players').select('id, name, number, position').eq('team_id', matchData.team_id).eq('is_active', true);
          setTeamPlayers(tp || []);
        }
      }

      const snap = await getMatchRuleSnapshot(matchId);
      if (snap) setRuleSnapshot(snap);

      const { data: ld } = await supabase
        .from('match_lineups')
        .select('id, player_id, is_starter, minutes_played, position_played, player:players(id, name, number, position)')
        .eq('match_id', matchId);
      setLineups((ld || []).map((l: any) => ({ ...l, player: Array.isArray(l.player) ? l.player[0] : l.player })));

      const { data: ed } = await supabase
        .from('match_events')
        .select('id, event_type, minute, second, player_id, assist_player_id, is_opponent, notes, player:players!match_events_player_id_fkey(id, name, number, position), assist_player:players!match_events_assist_player_id_fkey(id, name, number, position)')
        .eq('match_id', matchId).order('minute', { ascending: true });
      setEvents((ed || []).map((e: any) => ({ ...e, player: Array.isArray(e.player) ? e.player[0] : e.player, assist_player: Array.isArray(e.assist_player) ? e.assist_player[0] : e.assist_player })));

      setIsDirty(false);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const recalculateMinutes = useCallback(() => {
    const elapsed = partElapsed.length > 0 ? partElapsed : [];
    const { totalMinutes, partMinutes } = elapsed.length > 0 ? getPartTimesFromElapsed(elapsed) : { totalMinutes: partDuration * partsCount, partMinutes: Array(partsCount).fill(partDuration) };
    const firstPart = new Set(partStartersByIndex['1'] ?? lineups.filter(l => l.is_starter).map(l => l.player_id));
    const starterInfos: StarterInfo[] = lineups.map(l => ({
      player_id: l.player_id,
      is_starter: firstPart.has(l.player_id),
    }));
    const mergedPartStarters = { ...partStartersByIndex };
    if (manual2ndHalfStarters) mergedPartStarters['2'] = Array.from(manual2ndHalfStarters);
    const secondHalfIds = mergedPartStarters['2'] ?? null;
    const regulationPartMinutes = partRegulationMinutes.length === partsCount ? partRegulationMinutes : Array(partsCount).fill(partDuration);
    return applyPreciseMinutes(
      computeMatchPlayerStatsWithHalves(
        starterInfos,
        events as MatchEventForCalc[],
        totalMinutes,
        partMinutes,
        sportType,
        { secondHalfStarters: secondHalfIds, partStarters: mergedPartStarters, regulationPartMinutes, numberOfParts: partsCount },
      ),
      {
        partSeconds: partElapsed,
        partStarters: mergedPartStarters,
        firstPartStarters: starterInfos.filter(s => s.is_starter).map(s => s.player_id),
        events: events as MatchEventForCalc[],
      },
    );
  }, [lineups, events, partElapsed, partDuration, sportType, manual2ndHalfStarters, partStartersByIndex, partRegulationMinutes, partsCount]);

  const localIssues = useMemo(() => {
    const { totalMinutes: matchEnd, partMinutes } = partElapsed.length > 0
      ? getPartTimesFromElapsed(partElapsed)
      : { totalMinutes: partDuration * partsCount, partMinutes: Array(partsCount).fill(partDuration) };
    const mergedPartStarters = { ...partStartersByIndex };
    if (manual2ndHalfStarters) mergedPartStarters['2'] = Array.from(manual2ndHalfStarters);
    const firstPart = mergedPartStarters['1'] ? new Set(mergedPartStarters['1']) : null;
    return checkMatchConsistency(
      lineups.map(l => ({
        player_id: l.player_id,
        is_starter: firstPart ? firstPart.has(l.player_id) : wasOriginalStarter(l.player_id, events as MatchEventForCalc[], l.is_starter),
      })),
      events as MatchEventForCalc[], matchEnd, sportType,
      { partStarters: mergedPartStarters, realPartMinutes: partMinutes },
    );
  }, [lineups, events, partElapsed, partDuration, partsCount, sportType, partStartersByIndex, manual2ndHalfStarters]);

  const hasBlockingIssues = localIssues.some(i => i.type === 'error');

  const substitutionEvents = events.filter(e => e.event_type === 'substitution_in' || e.event_type === 'substitution_out');
  const otherEvents = events.filter(e => e.event_type !== 'substitution_in' && e.event_type !== 'substitution_out');
  const allPlayers = lineups.map(l => l.player);

  const playersOnField = useMemo(() => {
    const onField = new Set<string>();
    lineups.filter(l => l.is_starter).forEach(l => onField.add(l.player_id));
    const sortedSubs = [...substitutionEvents].sort((a, b) => a.minute - b.minute || (a.event_type === 'substitution_out' ? -1 : 1));
    for (const ev of sortedSubs) {
      if (ev.event_type === 'substitution_out' && ev.player_id) onField.delete(ev.player_id);
      if (ev.event_type === 'substitution_in' && ev.player_id) onField.add(ev.player_id);
    }
    return onField;
  }, [lineups, substitutionEvents]);

  const maxOnField = useMemo(() => {
    const limits: Record<string, number> = { 'futsal': 5, 'futebol_5': 5, 'futebol_7': 7, 'futebol_9': 9, 'futebol_11': 11 };
    return limits[sportType || ''] || 11;
  }, [sportType]);

  // Compute 2nd half starters: who was on field at half-time (or manual override)
  const secondHalfStarters = useMemo(() => {
    if (manual2ndHalfStarters) return manual2ndHalfStarters;
    const halfEndMinute = partElapsed.length > 0 ? Math.floor(partElapsed[0] / 60) : partDuration;
    const onField = new Set<string>();
    lineups.filter(l => l.is_starter).forEach(l => onField.add(l.player_id));
    const firstHalfSubs = [...substitutionEvents]
      .filter(e => e.minute <= halfEndMinute)
      .sort((a, b) => a.minute - b.minute || (a.event_type === 'substitution_out' ? -1 : 1));
    for (const ev of firstHalfSubs) {
      if (ev.event_type === 'substitution_out' && ev.player_id) onField.delete(ev.player_id);
      if (ev.event_type === 'substitution_in' && ev.player_id) onField.add(ev.player_id);
    }
    return onField;
  }, [lineups, substitutionEvents, partElapsed, partDuration, manual2ndHalfStarters]);

  // Players who never played
  const unusedPlayers = useMemo(() => {
    const stats = recalculateMinutes();
    const statsMap = new Map(stats.map(s => [s.playerId, s]));
    return lineups.filter(l => {
      if (l.is_starter) return false;
      const stat = statsMap.get(l.player_id);
      return !stat || stat.totalMinutes === 0;
    });
  }, [lineups, recalculateMinutes]);

  const usedSubstitutes = useMemo(() => {
    const unusedIds = new Set(unusedPlayers.map(l => l.player_id));
    return lineups.filter(l => !l.is_starter && !unusedIds.has(l.player_id));
  }, [lineups, unusedPlayers]);

  // ─── Lineup actions ───
  const handleToggleStarter = async (lineupId: string, playerId: string, currentIsStarter: boolean) => {
    if (!user || !isEditable) return;
    const starterCount = lineups.filter(l => l.is_starter).length;
    if (!currentIsStarter && starterCount >= maxOnField) {
      toast.error(`Máximo de ${maxOnField} titulares atingido.`);
      return;
    }
    await supabase.from('match_lineups').update({ is_starter: !currentIsStarter }).eq('id', lineupId);
    await logReportAudit(matchId, null, user.id, 'lineup_change', { player_id: playerId, was_starter: currentIsStarter }, { player_id: playerId, is_starter: !currentIsStarter });
    toast.success(!currentIsStarter ? 'Jogador definido como titular.' : 'Jogador movido para suplentes.');
    setIsDirty(true);
    await fetchData();
    onDataChanged?.();
  };

  const handleRemoveFromLineup = async (lineupId: string, playerId: string) => {
    if (!user || !isEditable) return;
    const playerEvents = events.filter(e => e.player_id === playerId);
    if (playerEvents.length > 0) {
      toast.error('Não é possível remover: o jogador tem eventos no relatório. Remova os eventos primeiro.');
      return;
    }
    await supabase.from('match_lineups').delete().eq('id', lineupId);
    await logReportAudit(matchId, null, user.id, 'player_removed', { player_id: playerId }, null);
    toast.success('Jogador removido do relatório.');
    setIsDirty(true);
    await fetchData();
    onDataChanged?.();
  };

  const handleAddPlayerToLineup = async (playerId: string) => {
    if (!user || !isEditable) return;
    const exists = lineups.find(l => l.player_id === playerId);
    if (exists) { toast.error('Jogador já está na escalação.'); return; }
    await supabase.from('match_lineups').insert({ match_id: matchId, player_id: playerId, is_starter: false, owner_id: user.id });
    await logReportAudit(matchId, null, user.id, 'player_added', null, { player_id: playerId });
    toast.success('Jogador adicionado à escalação.');
    setIsDirty(true);
    await fetchData();
    onDataChanged?.();
  };

  const handleMarkUnused = async (lineupId: string, playerId: string) => {
    if (!user || !isEditable) return;
    // If starter, move to bench first
    const lineup = lineups.find(l => l.id === lineupId);
    if (lineup?.is_starter) {
      await supabase.from('match_lineups').update({ is_starter: false }).eq('id', lineupId);
    }
    // Remove any substitution events for this player
    const playerSubEvents = events.filter(e => e.player_id === playerId && (e.event_type === 'substitution_in' || e.event_type === 'substitution_out'));
    for (const ev of playerSubEvents) {
      await supabase.from('match_events').delete().eq('id', ev.id);
    }
    await logReportAudit(matchId, null, user.id, 'player_marked_unused', { player_id: playerId }, null);
    toast.success('Jogador marcado como não utilizado.');
    setIsDirty(true);
    await fetchData();
    onDataChanged?.();
  };

  const handleReactivatePlayer = async (lineupId: string, playerId: string) => {
    if (!user || !isEditable) return;
    // Move to starter if there's room, else keep as sub (they can add subs later)
    const starterCount = lineups.filter(l => l.is_starter).length;
    if (starterCount < maxOnField) {
      await supabase.from('match_lineups').update({ is_starter: true }).eq('id', lineupId);
      toast.success('Jogador reativado como titular.');
    } else {
      toast.success('Jogador reativado. Adicione uma substituição para registar a entrada.');
    }
    await logReportAudit(matchId, null, user.id, 'player_reactivated', { player_id: playerId }, null);
    setIsDirty(true);
    await fetchData();
    onDataChanged?.();
  };

  const handleToggle2ndHalfStarter = async (playerId: string) => {
    if (!user || !isEditable) return;
    const current = manual2ndHalfStarters || new Set(secondHalfStarters);
    const updated = new Set(current);
    if (updated.has(playerId)) {
      updated.delete(playerId);
    } else {
      if (updated.size >= maxOnField) {
        toast.error(`Máximo de ${maxOnField} titulares da 2.ª parte atingido.`);
        return;
      }
      updated.add(playerId);
    }
    setManual2ndHalfStarters(updated);
    const nextPartStarters = { ...partStartersByIndex, '2': Array.from(updated) };
    setPartStartersByIndex(nextPartStarters);
    setIsDirty(true);
    // Persist authoritative 2H snapshot to matches table.
    const ids = Array.from(updated);
    const { error } = await supabase
      .from('matches')
      .update({
        part_starter_ids: nextPartStarters,
        second_half_starter_ids: ids,
        second_half_starter_set_at: new Date().toISOString(),
        second_half_starter_set_by: user.id,
      } as any)
      .eq('id', matchId);
    if (error) {
      toast.error('Não foi possível guardar os titulares da 2.ª parte.');
      return;
    }
    await logReportAudit(matchId, null, user.id, 'second_half_starters_updated', null, { ids });
    toast.success('Titulares da 2.ª parte atualizados.');
  };

  // ─── Substitution batch (commit) ───
  const handleCommitSubBatch = async (subs: PendingSubstitution[], batchMinute: number) => {
    if (!user || subs.length === 0) return;

    try {
      // If editing, drop the previous pair first so we don't duplicate events
      if (editingSubPairIds) {
        if (editingSubPairIds.outId) await supabase.from('match_events').delete().eq('id', editingSubPairIds.outId);
        if (editingSubPairIds.inId) await supabase.from('match_events').delete().eq('id', editingSubPairIds.inId);
      }

      const rows = subs.flatMap(sub => ([
        { match_id: matchId, event_type: 'substitution_out' as any, minute: batchMinute, second: 0, player_id: sub.playerOutId, is_opponent: false, owner_id: user.id },
        { match_id: matchId, event_type: 'substitution_in' as any, minute: batchMinute, second: 0, player_id: sub.playerInId, is_opponent: false, owner_id: user.id },
      ]));

      const { error } = await supabase.from('match_events').insert(rows);
      if (error) throw error;

      await logReportAudit(
        matchId,
        null,
        user.id,
        editingSubPairIds ? 'substitution_edited' : 'event_added',
        null,
        { event_type: 'substitution_batch', minute: batchMinute, count: subs.length, pairs: subs.map(s => ({ out: s.playerOutId, in: s.playerInId })) },
      );

      toast.success(
        subs.length === 1
          ? (editingSubPairIds ? 'Substituição editada com sucesso.' : 'Substituição guardada com sucesso.')
          : `${subs.length} substituições guardadas com sucesso.`,
      );
      setShowSubDialog(false);
      setEditingSubPairIds(null);
      setSubBatchInitial(null);
      setIsDirty(true);
      await fetchData();
      onDataChanged?.();
    } catch {
      toast.error('Erro ao guardar substituições.');
    }
  };

  const handleDeleteSubPair = async (outId: string, inId: string) => {
    if (!user) return;
    if (outId) await supabase.from('match_events').delete().eq('id', outId);
    if (inId) await supabase.from('match_events').delete().eq('id', inId);
    await logReportAudit(matchId, null, user.id, 'substitution_deleted', { outId, inId }, null);
    toast.success('Substituição removida com sucesso.');
    setIsDirty(true);
    await fetchData();
    onDataChanged?.();
  };

  const openEditSub = (pair: { minute: number; outPlayerId?: string; inPlayerId?: string; outId: string; inId: string }) => {
    setSubMinute(pair.minute);
    setEditingSubPairIds({ outId: pair.outId, inId: pair.inId });
    setSubBatchInitial(
      pair.outPlayerId && pair.inPlayerId
        ? [{ playerOutId: pair.outPlayerId, playerInId: pair.inPlayerId }]
        : null,
    );
    setShowSubDialog(true);
  };

  // ─── Event actions ───
  const handleAddEvent = async () => {
    if (!user) return;
    try {
      if (editingEventId) {
        await supabase.from('match_events').update({
          event_type: newEvent.event_type as any,
          minute: newEvent.minute,
          player_id: newEvent.player_id || null,
          assist_player_id: (newEvent.assist_player_id && newEvent.assist_player_id !== 'none') ? newEvent.assist_player_id : null,
          is_opponent: newEvent.is_opponent,
          notes: newEvent.notes || null,
        }).eq('id', editingEventId);
        await logReportAudit(matchId, null, user.id, 'event_edited', { id: editingEventId }, { event_type: newEvent.event_type, minute: newEvent.minute });
        const eventTypeLabel = newEvent.event_type.includes('goal') ? 'Golo atualizado' : newEvent.event_type.includes('card') ? 'Cartão atualizado' : 'Evento editado';
        toast.success(`${eventTypeLabel} com sucesso.`);
      } else {
        await supabase.from('match_events').insert([{
          match_id: matchId, event_type: newEvent.event_type as any, minute: newEvent.minute, second: 0,
          player_id: newEvent.player_id || null,
          assist_player_id: (newEvent.assist_player_id && newEvent.assist_player_id !== 'none') ? newEvent.assist_player_id : null,
          is_opponent: newEvent.is_opponent, notes: newEvent.notes || null, owner_id: user.id,
        }]);
        await logReportAudit(matchId, null, user.id, 'event_added', null, { event_type: newEvent.event_type, minute: newEvent.minute });
        const eventTypeLabel = newEvent.event_type.includes('goal') ? 'Golo adicionado' : newEvent.event_type.includes('card') ? 'Cartão adicionado' : 'Evento adicionado';
        toast.success(`${eventTypeLabel} com sucesso.`);
      }

      // Update match goals if goal event was added/edited
      if (newEvent.event_type === 'goal' || newEvent.event_type === 'own_goal') {
        // Re-count goals from events after save
        const { data: allEvents } = await supabase.from('match_events').select('event_type, is_opponent').eq('match_id', matchId);
        if (allEvents) {
          const gf = allEvents.filter(e => (e.event_type === 'goal' && !e.is_opponent) || (e.event_type === 'own_goal' && e.is_opponent)).length;
          const ga = allEvents.filter(e => (e.event_type === 'goal' && e.is_opponent) || (e.event_type === 'own_goal' && !e.is_opponent)).length;
          setGoalsFor(gf);
          setGoalsAgainst(ga);
          await supabase.from('matches').update({ goals_for: gf, goals_against: ga }).eq('id', matchId);
        }
      }

      setShowAddEventDialog(false);
      setEditingEventId(null);
      setNewEvent({ event_type: 'goal', minute: 0, player_id: '', is_opponent: false, assist_player_id: '', notes: '' });
      setIsDirty(true);
      await fetchData();
      onDataChanged?.();
    } catch { toast.error('Erro ao guardar evento.'); }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) return;
    const ev = events.find(e => e.id === eventId);
    await supabase.from('match_events').delete().eq('id', eventId);
    await logReportAudit(matchId, null, user.id, 'event_deleted', { event_type: ev?.event_type, minute: ev?.minute }, null);

    const eventTypeLabel = ev?.event_type?.includes('goal') ? 'Golo removido' : ev?.event_type?.includes('card') ? 'Cartão removido' : 'Evento removido';
    toast.success(`${eventTypeLabel} com sucesso.`);

    // Re-count goals if goal was deleted
    if (ev?.event_type === 'goal' || ev?.event_type === 'own_goal') {
      const { data: allEvents } = await supabase.from('match_events').select('event_type, is_opponent').eq('match_id', matchId);
      if (allEvents) {
        const gf = allEvents.filter(e => (e.event_type === 'goal' && !e.is_opponent) || (e.event_type === 'own_goal' && e.is_opponent)).length;
        const ga = allEvents.filter(e => (e.event_type === 'goal' && e.is_opponent) || (e.event_type === 'own_goal' && !e.is_opponent)).length;
        setGoalsFor(gf);
        setGoalsAgainst(ga);
        await supabase.from('matches').update({ goals_for: gf, goals_against: ga }).eq('id', matchId);
      }
    }

    setIsDirty(true);
    await fetchData();
    onDataChanged?.();
  };

  const openEditEvent = (event: MatchEvent) => {
    setEditingEventId(event.id);
    setNewEvent({
      event_type: event.event_type,
      minute: event.minute,
      player_id: event.player_id || '',
      is_opponent: event.is_opponent,
      assist_player_id: event.assist_player_id || '',
      notes: event.notes || '',
    });
    setShowAddEventDialog(true);
  };

  const openNewEvent = () => {
    setEditingEventId(null);
    setNewEvent({ event_type: 'goal', minute: 0, player_id: '', is_opponent: false, assist_player_id: '', notes: '' });
    setShowAddEventDialog(true);
  };

  // ─── Minutes override ───
  const handleSaveMinuteOverride = (playerId: string) => {
    if (!minuteOverrideReason.trim()) {
      toast.error('Ajuste manual de minutos requer motivo obrigatório.');
      return;
    }
    setMinuteOverrides(prev => ({ ...prev, [playerId]: { value: minuteOverrideValue, reason: minuteOverrideReason } }));
    setEditingMinutesPlayerId(null);
    setMinuteOverrideReason('');
    setIsDirty(true);
    toast.success('Ajuste manual aplicado.');
  };

  const handleRecalculateAll = () => {
    setMinuteOverrides({});
    setManual2ndHalfStarters(null);
    toast.success('Minutos recalculados com sucesso.');
  };

  // ─── Save / Finalize ───
  const handleSaveDraft = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const report = await getOrCreateMatchReport(matchId, user.id, null);
      if (!report) throw new Error('REPORT_CREATE_FAILED');

      await supabase.from('matches').update({ goals_for: goalsFor, goals_against: goalsAgainst, part_elapsed_seconds: partElapsed.length > 0 ? partElapsed : null }).eq('id', matchId);
      await supabase.from('match_reports').update({ notes, updated_by: user.id }).eq('id', report.id);

      const stats = recalculateMinutes();
      for (const stat of stats) {
        const lineup = lineups.find(l => l.player_id === stat.playerId);
        if (lineup) {
          const override = minuteOverrides[stat.playerId];
          const finalMinutes = override ? override.value : stat.totalMinutes;
          await supabase.from('match_lineups').update({ minutes_played: finalMinutes }).eq('id', lineup.id);
          if (override) {
            await logReportAudit(matchId, null, user.id, 'minutes_override', { calculated: stat.totalMinutes }, { applied: override.value, reason: override.reason });
          }
        }
      }
      const snapshot: ReportSnapshot = {
        lineups: lineups.map(l => ({ player_id: l.player_id, is_starter: l.is_starter })),
        events: events.map(e => ({ id: e.id, event_type: e.event_type, minute: e.minute, player_id: e.player_id })),
        goals_for: goalsFor, goals_against: goalsAgainst, part_elapsed_seconds: partElapsed, notes,
      };
      await saveReportVersion(matchId, user.id, snapshot);
      if (reportStatus === 'draft' || reportStatus === 'in_progress') {
        await updateReportStatus(matchId, 'pending_completion', user.id);
        onStatusChange('pending_completion');
      }
      setIsDirty(false);
      toast.success('Alterações guardadas com sucesso.');
      await fetchData();
      onDataChanged?.();
    } catch (error) {
      toast.error(getReportMutationErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const report = await getOrCreateMatchReport(matchId, user.id, null);
      if (!report) throw new Error('REPORT_CREATE_FAILED');

      const stats = recalculateMinutes();
      for (const stat of stats) {
        const lineup = lineups.find(l => l.player_id === stat.playerId);
        if (lineup) {
          const override = minuteOverrides[stat.playerId];
          const finalMinutes = override ? override.value : stat.totalMinutes;
          await supabase.from('match_lineups').update({ minutes_played: finalMinutes }).eq('id', lineup.id);
        }
      }
      await supabase.from('match_reports').update({ notes, updated_by: user.id }).eq('id', report.id);
      await supabase.from('matches').update({ goals_for: goalsFor, goals_against: goalsAgainst, status: 'completed', part_elapsed_seconds: partElapsed.length > 0 ? partElapsed : null }).eq('id', matchId);
      const snapshot: ReportSnapshot = {
        lineups: lineups.map(l => ({ player_id: l.player_id, is_starter: l.is_starter })),
        events: events.map(e => ({ id: e.id, event_type: e.event_type, minute: e.minute, player_id: e.player_id })),
        goals_for: goalsFor, goals_against: goalsAgainst, part_elapsed_seconds: partElapsed, notes,
      };
      await saveReportVersion(matchId, user.id, snapshot);
      const nextStatus: ReportStatus = reportStatus === 'reopened' || reportStatus === 'corrected' ? 'corrected' : 'finalized';
      await updateReportStatus(matchId, nextStatus, user.id);
      onStatusChange(nextStatus);
      setIsDirty(false);
      toast.success(nextStatus === 'finalized' ? 'Relatório finalizado com sucesso.' : 'Nova versão do relatório guardada com sucesso.');
      await fetchData();
      onDataChanged?.();
    } catch (error) {
      toast.error(getReportMutationErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!user || !reopenReason.trim()) { toast.error('Informe o motivo da reabertura.'); return; }
    await updateReportStatus(matchId, 'reopened', user.id, reopenReason);
    onStatusChange('reopened');
    setShowReopenDialog(false);
    setReopenReason('');
    toast.success('Relatório reaberto com sucesso. Já pode corrigir.');
    await fetchData();
  };

  const loadHistory = async () => {
    const [v, a] = await Promise.all([getReportVersions(matchId), getReportAuditLogs(matchId)]);
    setVersions(v); setAuditLogs(a); setShowHistory(true);
  };

  // ─── Step progress ───
  const stepCompletion = useMemo(() => {
    const hasResult = goalsFor >= 0 && goalsAgainst >= 0;
    const hasLineup = lineups.length > 0;
    return [hasResult, hasLineup, true, true, hasResult && hasLineup];
  }, [goalsFor, goalsAgainst, lineups]);

  const completedSteps = stepCompletion.filter(Boolean).length;
  const goNext = () => setCurrentStep(s => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setCurrentStep(s => Math.max(s - 1, 0));

  // ─── Sub pairs ───
  const subPairs = useMemo(() => {
    const pairs: { minute: number; outPlayer?: Player; inPlayer?: Player; outPlayerId?: string; inPlayerId?: string; outId: string; inId: string }[] = [];
    const outs = substitutionEvents.filter(e => e.event_type === 'substitution_out');
    const ins = substitutionEvents.filter(e => e.event_type === 'substitution_in');
    const usedIns = new Set<string>();
    for (const out of outs) {
      const matchingIn = ins.find(i => i.minute === out.minute && !usedIns.has(i.id));
      if (matchingIn) usedIns.add(matchingIn.id);
      pairs.push({ minute: out.minute, outPlayer: out.player, inPlayer: matchingIn?.player, outPlayerId: out.player_id || undefined, inPlayerId: matchingIn?.player_id || undefined, outId: out.id, inId: matchingIn?.id || '' });
    }
    for (const i of ins) {
      if (!usedIns.has(i.id)) pairs.push({ minute: i.minute, outPlayer: undefined, inPlayer: i.player, outPlayerId: undefined, inPlayerId: i.player_id || undefined, outId: '', inId: i.id });
    }
    return pairs.sort((a, b) => a.minute - b.minute);
  }, [substitutionEvents]);

  const availableToAdd = useMemo(() => {
    const inLineup = new Set(lineups.map(l => l.player_id));
    return teamPlayers.filter(p => !inLineup.has(p.id));
  }, [teamPlayers, lineups]);

  const eventLabel = (type: string) => {
    const labels: Record<string, string> = {
      goal: '⚽ Golo', own_goal: '⚽ Auto-golo', yellow_card: '🟨 Amarelo', red_card: '🟥 Vermelho',
      substitution_in: '↗ Entrou', substitution_out: '↘ Saiu',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">A carregar dados do relatório...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status banner for non-editable states */}
      {!isEditable && reportStatus === 'finalized' && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <span className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Este relatório está finalizado. Reabra para corrigir.</span>
          <Button size="sm" variant="outline" onClick={() => setShowReopenDialog(true)}><RotateCcw className="w-4 h-4 mr-1" /> Reabrir relatório</Button>
        </div>
      )}
      {!isEditable && reportStatus === 'locked' && (
        <div className="flex items-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <span className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Este relatório está bloqueado e não pode ser editado.</span>
        </div>
      )}

      {/* Dirty indicator */}
      {isDirty && isEditable && (
        <div className="flex items-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-xs text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Alterações pendentes — guarde o rascunho antes de sair.
          </span>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MatchStatusBadge status={reportStatus} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadHistory}><History className="w-4 h-4" /></Button>
          {canReopen && (
            <Button variant="outline" size="sm" onClick={() => setShowReopenDialog(true)}>
              <RotateCcw className="w-4 h-4 mr-1" /> Reabrir
            </Button>
          )}
        </div>
      </div>

      {/* Stepper progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Passo {currentStep + 1} de {STEPS.length}: {STEPS[currentStep].label}</span>
        </div>
        <Progress value={((currentStep + 1) / STEPS.length) * 100} className="h-2" />
        <div className="flex justify-between">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = stepCompletion[i];
            return (
              <button
                key={step.key}
                onClick={() => setCurrentStep(i)}
                className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                  isActive ? 'text-primary font-medium' : isDone ? 'text-primary/60' : 'text-muted-foreground'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isActive ? 'border-primary bg-primary text-primary-foreground' :
                  isDone ? 'border-primary/50 bg-primary/10' : 'border-muted'
                }`}>
                  {isMobile ? step.short : <Icon className="w-4 h-4" />}
                </div>
                {!isMobile && <span>{step.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {ruleSnapshot && <MatchRulesPanel snapshot={ruleSnapshot} sportType={sportType} compact />}

      {/* Step content */}
      <div className="min-h-[300px]">
        {/* STEP 1: Result */}
        {currentStep === 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="w-4 h-4" /> Resultado</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Golos a Favor</Label>
                  <Input type="number" min={0} value={goalsFor} onChange={e => { setGoalsFor(parseInt(e.target.value) || 0); setIsDirty(true); }} disabled={!isEditable} className="text-center text-2xl h-14" />
                </div>
                <div>
                  <Label>Golos Contra</Label>
                  <Input type="number" min={0} value={goalsAgainst} onChange={e => { setGoalsAgainst(parseInt(e.target.value) || 0); setIsDirty(true); }} disabled={!isEditable} className="text-center text-2xl h-14" />
                </div>
              </div>
              <div>
                <Label>Notas do jogo</Label>
                <Textarea value={notes} onChange={e => { setNotes(e.target.value); setIsDirty(true); }} placeholder="Observações sobre o jogo..." disabled={!isEditable} rows={3} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Duração real por parte (minutos)</Label>
                <div className="flex gap-2 mt-1">
                  {(partElapsed.length > 0 ? partElapsed : [partDuration * 60, partDuration * 60]).map((sec, i) => (
                    <div key={i} className="flex-1">
                      <Label className="text-xs">{i + 1}.ª Parte</Label>
                      <Input
                        type="number" min={0}
                        value={Math.floor(sec / 60)}
                        onChange={e => {
                          const mins = parseInt(e.target.value) || 0;
                          const newElapsed = [...(partElapsed.length > 0 ? partElapsed : [partDuration * 60, partDuration * 60])];
                          newElapsed[i] = mins * 60;
                          setPartElapsed(newElapsed);
                          setIsDirty(true);
                        }}
                        disabled={!isEditable}
                        className="h-8 text-xs text-center"
                      />
                      <span className="text-[10px] text-muted-foreground">min</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Lineup */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Escalação ({lineups.length})</span>
                {isEditable && availableToAdd.length > 0 && (
                  <Select onValueChange={handleAddPlayerToLineup}>
                    <SelectTrigger className="w-auto h-8 text-xs gap-1">
                      <Plus className="w-3 h-3" /><span>Adicionar jogador</span>
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAdd.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lineups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Ainda não definiu a escalação.</p>
                  {isEditable && availableToAdd.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Use &quot;Adicionar jogador&quot; acima para começar.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Titulares da 1ª Parte */}
                  <div className="text-sm font-medium mb-2">Titulares da 1.ª Parte ({lineups.filter(l => l.is_starter).length}/{maxOnField})</div>
                  {lineups.filter(l => l.is_starter).map(l => (
                    <div key={l.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-primary/5">
                      <Badge variant="secondary" className="min-w-[28px] justify-center text-xs">{l.player.number || '-'}</Badge>
                      <span className="text-sm flex-1">{l.player.name}</span>
                      {l.player.position && <span className="text-xs text-muted-foreground">{l.player.position}</span>}
                      {secondHalfStarters.has(l.player_id) && <Badge variant="outline" className="text-[10px]">2.ªP</Badge>}
                      {isEditable && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Mover para suplentes" onClick={() => handleToggleStarter(l.id, l.player_id, true)}>
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title={secondHalfStarters.has(l.player_id) ? 'Remover da 2.ª Parte' : 'Definir como titular da 2.ª Parte'} onClick={() => handleToggle2ndHalfStarter(l.player_id)}>
                            <span className="text-[9px] font-bold">2P</span>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-amber-600" title="Marcar como não utilizado" onClick={() => handleMarkUnused(l.id, l.player_id)}>
                            <UserMinus className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" title="Remover do relatório" onClick={() => handleRemoveFromLineup(l.id, l.player_id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Titulares da 2ª Parte - show if composition differs */}
                  {(() => {
                    const starterIds = new Set(lineups.filter(l => l.is_starter).map(l => l.player_id));
                    const hasDiff = [...secondHalfStarters].some(id => !starterIds.has(id)) || [...starterIds].some(id => !secondHalfStarters.has(id));
                    if (hasDiff && secondHalfStarters.size > 0) {
                      return (
                        <>
                          <div className="text-sm font-medium mt-4 mb-2">Titulares da 2.ª Parte ({secondHalfStarters.size})</div>
                          {lineups.filter(l => secondHalfStarters.has(l.player_id)).map(l => (
                            <div key={`2h-${l.id}`} className="flex items-center gap-2 py-1.5 px-2 rounded bg-accent/30">
                              <Badge variant="secondary" className="min-w-[28px] justify-center text-xs">{l.player.number || '-'}</Badge>
                              <span className="text-sm flex-1">{l.player.name}</span>
                              {!l.is_starter && <Badge variant="outline" className="text-[10px]">Entrou na 1.ªP</Badge>}
                              {isEditable && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Remover da 2.ª Parte" onClick={() => handleToggle2ndHalfStarter(l.player_id)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </>
                      );
                    }
                    return null;
                  })()}

                  {/* Suplentes Utilizados */}
                  {usedSubstitutes.length > 0 && (
                    <>
                      <div className="text-sm font-medium mt-4 mb-2">Suplentes Utilizados ({usedSubstitutes.length})</div>
                      {usedSubstitutes.map(l => (
                        <div key={l.id} className="flex items-center gap-2 py-1.5 px-2 rounded">
                          <Badge variant="outline" className="min-w-[28px] justify-center text-xs">{l.player.number || '-'}</Badge>
                          <span className="text-sm flex-1">{l.player.name}</span>
                          {l.player.position && <span className="text-xs text-muted-foreground">{l.player.position}</span>}
                          {secondHalfStarters.has(l.player_id) && <Badge variant="outline" className="text-[10px]">2.ªP</Badge>}
                          {isEditable && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Mover para titulares" onClick={() => handleToggleStarter(l.id, l.player_id, false)}>
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title={secondHalfStarters.has(l.player_id) ? 'Remover da 2.ª Parte' : 'Definir como titular da 2.ª Parte'} onClick={() => handleToggle2ndHalfStarter(l.player_id)}>
                                <span className="text-[9px] font-bold">2P</span>
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" title="Remover do relatório" onClick={() => handleRemoveFromLineup(l.id, l.player_id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Não Utilizados */}
                  {unusedPlayers.length > 0 && (
                    <>
                      <div className="text-sm font-medium mt-4 mb-2 text-muted-foreground">Não Utilizados ({unusedPlayers.length})</div>
                      {unusedPlayers.map(l => (
                        <div key={l.id} className="flex items-center gap-2 py-1.5 px-2 rounded opacity-60">
                          <Badge variant="outline" className="min-w-[28px] justify-center text-xs">{l.player.number || '-'}</Badge>
                          <span className="text-sm flex-1">{l.player.name}</span>
                          <Badge variant="outline" className="text-[10px]">0 min</Badge>
                          {isEditable && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Reativar no relatório" onClick={() => handleReactivatePlayer(l.id, l.player_id)}>
                                <UserPlus className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" title="Remover do relatório" onClick={() => handleRemoveFromLineup(l.id, l.player_id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Plain suplentes fallback */}
                  {usedSubstitutes.length === 0 && unusedPlayers.length === 0 && lineups.filter(l => !l.is_starter).length > 0 && (
                    <>
                      <div className="text-sm font-medium mt-4 mb-2">Suplentes ({lineups.filter(l => !l.is_starter).length})</div>
                      {lineups.filter(l => !l.is_starter).map(l => (
                        <div key={l.id} className="flex items-center gap-2 py-1.5 px-2 rounded">
                          <Badge variant="outline" className="min-w-[28px] justify-center text-xs">{l.player.number || '-'}</Badge>
                          <span className="text-sm flex-1">{l.player.name}</span>
                          {isEditable && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Mover para titulares" onClick={() => handleToggleStarter(l.id, l.player_id, false)}>
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-amber-600" title="Marcar como não utilizado" onClick={() => handleMarkUnused(l.id, l.player_id)}>
                                <UserMinus className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" title="Remover do relatório" onClick={() => handleRemoveFromLineup(l.id, l.player_id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Substitutions */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Substituições</span>
                {isEditable && (
                  <Button size="sm" variant="outline" onClick={() => { setSubMinute(0); setEditingSubPairIds(null); setSubBatchInitial(null); setShowSubDialog(true); }}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subPairs.length === 0 ? (
                <div className="text-center py-8">
                  <ArrowRightLeft className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Ainda não adicionou substituições.</p>
                  {isEditable && <Button size="sm" className="mt-3" onClick={() => { setSubMinute(0); setEditingSubPairIds(null); setSubBatchInitial(null); setShowSubDialog(true); }}><Plus className="w-4 h-4 mr-1" /> Adicionar substituição</Button>}
                </div>
              ) : (
                <div className="space-y-2">
                  {subPairs.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono">{p.minute}'</Badge>
                        {p.outPlayer && <span className="text-sm">Saiu: {p.outPlayer.name}</span>}
                        {p.outPlayer && p.inPlayer && <span className="text-muted-foreground">→</span>}
                        {p.inPlayer && <span className="text-sm">Entrou: {p.inPlayer.name}</span>}
                        {!p.outPlayer && p.inPlayer && <Badge variant="destructive" className="text-[10px]">Sem saída</Badge>}
                      </div>
                      {isEditable && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditSub(p)}><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteSubPair(p.outId, p.inId)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Events */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Eventos ({otherEvents.length})</span>
                {isEditable && (
                  <Button size="sm" variant="outline" onClick={openNewEvent}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {otherEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Ainda não adicionou eventos.</p>
                  {isEditable && <Button size="sm" className="mt-3" onClick={openNewEvent}><Plus className="w-4 h-4 mr-1" /> Adicionar evento</Button>}
                </div>
              ) : (
                <div className="space-y-2">
                  {otherEvents.map(event => (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono">{event.minute}'</Badge>
                        <span className="text-sm font-medium">{eventLabel(event.event_type)}</span>
                        <span className="text-sm text-muted-foreground">{event.is_opponent ? '(Adversário)' : event.player?.name || ''}</span>
                        {event.assist_player && <span className="text-xs text-muted-foreground">(Ast: {event.assist_player.name})</span>}
                        {event.notes && <span className="text-xs text-muted-foreground italic">— {event.notes}</span>}
                      </div>
                      {isEditable && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditEvent(event)}><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteEvent(event.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: Review */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="text-center text-3xl font-bold mb-2">{goalsFor} - {goalsAgainst}</div>
                <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                  <span>Titulares: {lineups.filter(l => l.is_starter).length}</span>
                  <span>Suplentes: {lineups.filter(l => !l.is_starter).length}</span>
                  <span>Eventos: {events.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Minutos Jogados</span>
                  {isEditable && (
                    <Button variant="outline" size="sm" onClick={handleRecalculateAll}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Recalcular
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {(() => {
                    const stats = recalculateMinutes();
                    const statsMap = new Map(stats.map(s => [s.playerId, s]));
                    return lineups
                      .map(l => ({ lineup: l, stat: statsMap.get(l.player_id) }))
                      .sort((a, b) => {
                        const aMin = minuteOverrides[a.lineup.player_id]?.value ?? a.stat?.totalMinutes ?? 0;
                        const bMin = minuteOverrides[b.lineup.player_id]?.value ?? b.stat?.totalMinutes ?? 0;
                        return bMin - aMin;
                      })
                      .map(({ lineup, stat }) => {
                        const override = minuteOverrides[lineup.player_id];
                        const displayMinutes = override ? override.value : (stat?.totalMinutes || 0);
                        const isEditingThis = editingMinutesPlayerId === lineup.player_id;
                        return (
                          <div key={lineup.id} className={`py-2 px-2 rounded hover:bg-secondary/20 ${displayMinutes === 0 ? 'opacity-60' : ''}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="min-w-[28px] justify-center text-xs">{lineup.player.number || '-'}</Badge>
                                <div className="flex flex-col">
                                  <span className="text-sm">{lineup.player.name}</span>
                                  {stat && (stat as any).firstHalfMinutes !== undefined && (
                                    <span className="text-[10px] text-muted-foreground">
                                      1.ªP {(stat as any).firstHalfMinutes}' · 2.ªP {(stat as any).secondHalfMinutes}'
                                    </span>
                                  )}
                                </div>
                                {override && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700">Ajuste manual</Badge>}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-medium">{displayMinutes}'</span>
                                  {override && <span className="text-[10px] text-muted-foreground">calc: {stat?.totalMinutes || 0}'</span>}
                                </div>
                                <div className="flex gap-1">
                                  {stat?.annotations.map((ann, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px]">{ann}</Badge>
                                  ))}
                                </div>
                                {isEditable && !isEditingThis && (
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                    setEditingMinutesPlayerId(lineup.player_id);
                                    setMinuteOverrideValue(displayMinutes);
                                    setMinuteOverrideReason(override?.reason || '');
                                  }}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {isEditingThis && (
                              <div className="mt-2 flex flex-col gap-2 pl-10">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs w-20">Minutos:</Label>
                                  <Input type="number" min={0} className="h-7 w-20 text-xs" value={minuteOverrideValue} onChange={e => setMinuteOverrideValue(parseInt(e.target.value) || 0)} />
                                  <span className="text-xs text-muted-foreground">(calc: {stat?.totalMinutes || 0}')</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs w-20">Motivo:</Label>
                                  <Input className="h-7 text-xs flex-1" placeholder="Motivo obrigatório" value={minuteOverrideReason} onChange={e => setMinuteOverrideReason(e.target.value)} />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingMinutesPlayerId(null)}>Cancelar</Button>
                                  {override && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                                      setMinuteOverrides(prev => { const n = { ...prev }; delete n[lineup.player_id]; return n; });
                                      setEditingMinutesPlayerId(null);
                                      toast.success('Ajuste manual removido. Valor automático restaurado.');
                                    }}>Restaurar automático</Button>
                                  )}
                                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveMinuteOverride(lineup.player_id)}>Guardar ajuste</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                  })()}
                </div>
              </CardContent>
            </Card>

            {localIssues.length > 0 && <ConflictAlertsPanel matchId={matchId} localIssues={localIssues} />}
          </div>
        )}
      </div>

      {/* Navigation + Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" onClick={currentStep === 0 ? onClose : goBack} size={isMobile ? 'sm' : 'default'}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          {currentStep === 0 ? 'Fechar' : 'Anterior'}
        </Button>

        <div className="flex gap-2">
          {isEditable && (
            <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'A guardar...' : isCorrectionFlow ? 'Guardar correção' : 'Guardar rascunho'}
            </Button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={goNext} size={isMobile ? 'sm' : 'default'}>
              Seguinte <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : isEditable && canFinalize ? (
            <Button onClick={handleFinalize} disabled={saving || hasBlockingIssues} title={hasBlockingIssues ? 'Resolva os conflitos bloqueantes' : ''}>
              <CheckCircle className="w-4 h-4 mr-1" />
              {saving ? 'A finalizar...' : isCorrectionFlow ? 'Finalizar nova versão' : 'Finalizar relatório'}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Add/Edit Event Dialog */}
      <Dialog open={showAddEventDialog} onOpenChange={v => { if (!v) { setShowAddEventDialog(false); setEditingEventId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEventId ? 'Editar Evento' : 'Adicionar Evento'}</DialogTitle>
            <DialogDescription>{editingEventId ? 'Corrija os dados do evento.' : 'Adicione um evento ao relatório do jogo.'}</DialogDescription>
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
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Minuto</Label>
              <Input type="number" min={0} value={newEvent.minute} onChange={e => setNewEvent(prev => ({ ...prev, minute: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newEvent.is_opponent} onCheckedChange={v => setNewEvent(prev => ({ ...prev, is_opponent: v }))} />
              <Label>Golo/evento do adversário</Label>
            </div>
            {!newEvent.is_opponent && (
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
            )}
            {(newEvent.event_type === 'goal' && !newEvent.is_opponent) && (
              <div>
                <Label>Assistência</Label>
                <Select value={newEvent.assist_player_id} onValueChange={v => setNewEvent(prev => ({ ...prev, assist_player_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
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
            <Button variant="outline" onClick={() => { setShowAddEventDialog(false); setEditingEventId(null); }}>Cancelar</Button>
            <Button onClick={handleAddEvent}>{editingEventId ? 'Guardar alterações' : 'Adicionar'}</Button>
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

      {/* Substitution Batch Dialog */}
      <SubstitutionBatchDialog
        open={showSubDialog}
        onOpenChange={(v) => {
          setShowSubDialog(v);
          if (!v) { setEditingSubPairIds(null); setSubBatchInitial(null); }
        }}
        matchId={matchId}
        starters={lineups.filter(l => playersOnField.has(l.player_id))}
        substitutes={lineups.filter(l => !playersOnField.has(l.player_id))}
        defaultMinute={subMinute || 0}
        editableMinute
        maxOnField={maxOnField}
        reentryAllowed={true}
        events={(editingSubPairIds
          ? events.filter(e => e.id !== editingSubPairIds.outId && e.id !== editingSubPairIds.inId)
          : events) as any}
        sportType={sportType}
        onCommit={handleCommitSubBatch}
        title={editingSubPairIds ? 'Editar substituição' : 'Substituições'}
        initialSubstitutions={subBatchInitial ?? undefined}
      />
    </div>
  );
}
