import { supabase } from '@/integrations/supabase/client';

export type ReportEntryMode = 'live' | 'post_game' | 'hybrid';
export type ReportStatus = 'draft' | 'in_progress' | 'pending_completion' | 'pending_review' | 'finalized' | 'reopened' | 'corrected' | 'locked';

export interface MatchReport {
  id: string;
  club_id: string | null;
  match_id: string;
  report_entry_mode: ReportEntryMode;
  report_status: ReportStatus;
  started_at: string | null;
  ended_at: string | null;
  finalized_at: string | null;
  reopened_at: string | null;
  finalized_by: string | null;
  reopened_by: string | null;
  current_version_no: number;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSnapshot {
  lineups: any[];
  events: any[];
  goals_for: number;
  goals_against: number;
  part_elapsed_seconds: number[];
  notes: string | null;
}

export const EDITABLE_REPORT_STATUSES: readonly ReportStatus[] = [
  'draft',
  'in_progress',
  'pending_completion',
  'pending_review',
  'reopened',
  'corrected',
];

export const FINALIZABLE_REPORT_STATUSES: readonly ReportStatus[] = [
  'draft',
  'in_progress',
  'pending_completion',
  'pending_review',
  'reopened',
  'corrected',
];

export const REOPENABLE_REPORT_STATUSES: readonly ReportStatus[] = ['finalized'];

function isKnownReportStatus(status: string | null | undefined): status is ReportStatus {
  return [
    'draft',
    'in_progress',
    'pending_completion',
    'pending_review',
    'finalized',
    'reopened',
    'corrected',
    'locked',
  ].includes(status as ReportStatus);
}

export function isEditableReportStatus(status: string | null | undefined): status is ReportStatus {
  return EDITABLE_REPORT_STATUSES.includes(status as ReportStatus);
}

export function canFinalizeReportStatus(status: string | null | undefined): status is ReportStatus {
  return FINALIZABLE_REPORT_STATUSES.includes(status as ReportStatus);
}

export function canReopenReportStatus(status: string | null | undefined): status is ReportStatus {
  return REOPENABLE_REPORT_STATUSES.includes(status as ReportStatus);
}

export function getReportEditLockReason(status: string | null | undefined): string | null {
  if (!status || isEditableReportStatus(status)) return null;

  if (status === 'locked') {
    return 'Este relatório está bloqueado e não pode ser editado.';
  }

  if (status === 'finalized') {
    return 'Este relatório está finalizado. Reabra para corrigir.';
  }

  return 'A edição só é permitida após criar uma nova versão.';
}

export function getReportMutationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (message.includes('row-level security') || message.includes('permission denied')) {
    return 'Você não tem permissão para editar este relatório.';
  }

  if (message.includes('REPORT_LOCKED')) {
    return 'Este relatório está bloqueado e não pode ser editado.';
  }

  if (message.includes('REPORT_FINALIZED')) {
    return 'Este relatório está finalizado. Reabra para corrigir.';
  }

  if (message.includes('REPORT_REOPEN_REASON_REQUIRED')) {
    return 'Informe o motivo da reabertura.';
  }

  return 'Erro ao guardar alterações.';
}

async function ensureMatchReportRecord(
  matchId: string,
  userId: string,
  clubId: string | null,
  fallbackEntryMode: ReportEntryMode = 'live'
): Promise<MatchReport | null> {
  const { data: existing } = await supabase
    .from('match_reports')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle();

  if (existing) return existing as unknown as MatchReport;

  const { data: matchMeta } = await supabase
    .from('matches')
    .select('report_status, report_entry_mode')
    .eq('id', matchId)
    .maybeSingle();

  const resolvedEntryMode = ((matchMeta?.report_entry_mode as ReportEntryMode | null) || fallbackEntryMode);
  const resolvedStatus: ReportStatus = isKnownReportStatus(matchMeta?.report_status)
    ? matchMeta.report_status
    : resolvedEntryMode === 'post_game'
      ? 'draft'
      : 'in_progress';

  const { data, error } = await supabase
    .from('match_reports')
    .insert({
      match_id: matchId,
      club_id: clubId,
      report_entry_mode: resolvedEntryMode,
      report_status: resolvedStatus,
      started_at: isEditableReportStatus(resolvedStatus) ? new Date().toISOString() : null,
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating match report:', error);
    return null;
  }

  await supabase.from('matches').update({
    report_entry_mode: resolvedEntryMode,
    report_status: resolvedStatus,
  }).eq('id', matchId);

  return data as unknown as MatchReport;
}

/** Create or get existing match report */
export async function getOrCreateMatchReport(
  matchId: string,
  userId: string,
  clubId: string | null,
  entryMode: ReportEntryMode = 'live'
): Promise<MatchReport | null> {
  return ensureMatchReportRecord(matchId, userId, clubId, entryMode);
}

/** Update report status */
export async function updateReportStatus(
  matchId: string,
  newStatus: ReportStatus,
  userId: string,
  reason?: string
): Promise<boolean> {
  let { data: report } = await supabase
    .from('match_reports')
    .select('id, report_status, current_version_no')
    .eq('match_id', matchId)
    .maybeSingle();

  if (!report) {
    report = await ensureMatchReportRecord(matchId, userId, null);
  }

  if (!report) return false;

  const oldStatus = (report as any).report_status;
  const updates: Record<string, any> = {
    report_status: newStatus,
    updated_by: userId,
  };

  if (newStatus === 'finalized') {
    updates.finalized_at = new Date().toISOString();
    updates.finalized_by = userId;
  } else if (newStatus === 'reopened') {
    updates.reopened_at = new Date().toISOString();
    updates.reopened_by = userId;
  }

  const { error } = await supabase
    .from('match_reports')
    .update(updates)
    .eq('id', (report as any).id);

  if (error) {
    console.error('Error updating report status:', error);
    return false;
  }

  // Sync status to matches table
  await supabase.from('matches').update({ report_status: newStatus }).eq('id', matchId);

  // Audit log
  await logReportAudit(matchId, (report as any).id, userId, 'status_change', { status: oldStatus }, { status: newStatus }, reason);

  return true;
}

/** Save a version snapshot of the report */
export async function saveReportVersion(
  matchId: string,
  userId: string,
  snapshot: ReportSnapshot
): Promise<boolean> {
  let { data: report } = await supabase
    .from('match_reports')
    .select('id, current_version_no')
    .eq('match_id', matchId)
    .maybeSingle();

  if (!report) {
    report = await ensureMatchReportRecord(matchId, userId, null);
  }

  if (!report) return false;

  const newVersion = ((report as any).current_version_no || 0) + 1;

  const { error: versionError } = await supabase
    .from('match_report_versions')
    .insert({
      match_report_id: (report as any).id,
      version_no: newVersion,
      snapshot_json: snapshot as any,
      created_by: userId,
    });

  if (versionError) {
    console.error('Error saving version:', versionError);
    return false;
  }

  await supabase
    .from('match_reports')
    .update({ current_version_no: newVersion, updated_by: userId })
    .eq('id', (report as any).id);

  return true;
}

/** Log a report edit with diff */
export async function logReportEdit(
  matchId: string,
  userId: string,
  versionFrom: number,
  versionTo: number,
  diff: Record<string, any>,
  reason?: string
): Promise<void> {
  const { data: report } = await supabase
    .from('match_reports')
    .select('id')
    .eq('match_id', matchId)
    .maybeSingle();

  if (!report) return;

  await supabase.from('match_report_edits').insert({
    match_report_id: (report as any).id,
    version_from: versionFrom,
    version_to: versionTo,
    changed_by: userId,
    change_reason: reason || null,
    diff_json: diff as any,
  });
}

/** Log audit entry */
export async function logReportAudit(
  matchId: string,
  reportId: string | null,
  userId: string,
  action: string,
  beforeData?: any,
  afterData?: any,
  reason?: string
): Promise<void> {
  await supabase.from('match_report_audit_logs').insert({
    match_id: matchId,
    match_report_id: reportId,
    actor_id: userId,
    action,
    before_data: beforeData || null,
    after_data: afterData || null,
    reason: reason || null,
  });
}

/** Get report versions for a match */
export async function getReportVersions(matchId: string): Promise<any[]> {
  const { data: report } = await supabase
    .from('match_reports')
    .select('id')
    .eq('match_id', matchId)
    .maybeSingle();

  if (!report) return [];

  const { data } = await supabase
    .from('match_report_versions')
    .select('*')
    .eq('match_report_id', (report as any).id)
    .order('version_no', { ascending: false });

  return data || [];
}

/** Get report audit logs */
export async function getReportAuditLogs(matchId: string): Promise<any[]> {
  const { data } = await supabase
    .from('match_report_audit_logs')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });

  return data || [];
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Rascunho',
  in_progress: 'Em Progresso',
  pending_completion: 'Pendente',
  pending_review: 'Em Revisão',
  finalized: 'Finalizado',
  reopened: 'Reaberto',
  corrected: 'Corrigido',
  locked: 'Bloqueado',
};

export const ENTRY_MODE_LABELS: Record<ReportEntryMode, string> = {
  live: 'Ao Vivo',
  post_game: 'Pós-Jogo',
  hybrid: 'Híbrido',
};

export const ENTRY_MODE_DESCRIPTIONS: Record<ReportEntryMode, string> = {
  live: 'Regista eventos durante o jogo em tempo real.',
  post_game: 'Preenche todos os dados apenas no final do jogo.',
  hybrid: 'Regista alguns eventos durante o jogo e completa/corrige depois.',
};
