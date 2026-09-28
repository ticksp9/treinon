// Season service: CRUD + lifecycle (close/archive/activate) + context resolution.
import { supabase } from '@/integrations/supabase/client';

export type SeasonStatus = 'planning' | 'active' | 'closed' | 'archived';

export interface SeasonRow {
  id: string;
  club_id: string | null;
  owner_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_planning: boolean;
  status: SeasonStatus;
  reference_date: string | null;
  closed_at: string | null;
  closed_by: string | null;
  archived_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeasonScope {
  clubId: string | null;
  ownerId: string;
}

export async function listSeasons(scope: SeasonScope): Promise<SeasonRow[]> {
  let q = supabase.from('seasons' as any).select('*').order('start_date', { ascending: false });
  if (scope.clubId) q = q.eq('club_id', scope.clubId);
  else q = q.eq('owner_id', scope.ownerId).is('club_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return (data as any[]) as SeasonRow[];
}

export async function getActiveSeason(scope: SeasonScope): Promise<SeasonRow | null> {
  let q = supabase.from('seasons' as any).select('*').eq('is_active', true).limit(1);
  if (scope.clubId) q = q.eq('club_id', scope.clubId);
  else q = q.eq('owner_id', scope.ownerId).is('club_id', null);
  const { data, error } = await q.maybeSingle();
  if (error && (error as any).code !== 'PGRST116') throw error;
  return (data as any) as SeasonRow | null;
}

/**
 * Most recent season of the owner/club that can act as a transition source:
 * status in ('active','closed','archived'), optionally starting before
 * `beforeStartDate`, ordered by start_date desc. Null when none exists.
 */
export async function getPreviousSeason(
  scope: SeasonScope,
  beforeStartDate?: string | null,
): Promise<SeasonRow | null> {
  let q = supabase
    .from('seasons' as any)
    .select('*')
    .in('status', ['active', 'closed', 'archived'])
    .order('start_date', { ascending: false })
    .limit(1);
  if (scope.clubId) q = q.eq('club_id', scope.clubId);
  else q = q.eq('owner_id', scope.ownerId).is('club_id', null);
  if (beforeStartDate) q = q.lt('start_date', beforeStartDate);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data as any[]) || [];
  return (rows[0] as SeasonRow) ?? null;
}

export interface CreateSeasonInput {
  name: string;
  start_date: string;
  end_date: string;
  reference_date?: string | null;
  notes?: string | null;
  previous_season_id?: string | null;
}

/** Existing season with the same name in the same context (owner/club), or null. */
export async function findSeasonByName(scope: SeasonScope, name: string): Promise<SeasonRow | null> {
  let q = supabase.from('seasons' as any).select('*').eq('name', name).limit(1);
  if (scope.clubId) q = q.eq('club_id', scope.clubId);
  else q = q.eq('owner_id', scope.ownerId).is('club_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return ((data as any[])?.[0] as SeasonRow) ?? null;
}

export class SeasonAlreadyExistsError extends Error {
  season: SeasonRow;
  constructor(season: SeasonRow) {
    super(`Já existe a época ${season.name}.`);
    this.name = 'SeasonAlreadyExistsError';
    this.season = season;
  }
}

export async function createSeason(scope: SeasonScope, input: CreateSeasonInput): Promise<SeasonRow> {
  const existing = await findSeasonByName(scope, input.name);
  if (existing) throw new SeasonAlreadyExistsError(existing);

  const payload: any = {
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    reference_date: input.reference_date ?? input.start_date,
    notes: input.notes ?? null,
    owner_id: scope.ownerId,
    club_id: scope.clubId,
    previous_season_id: input.previous_season_id ?? null,
    is_active: false,
    is_planning: true,
    status: 'planning' as SeasonStatus,
  };
  const { data, error } = await supabase.from('seasons' as any).insert(payload).select('*').single();
  if (error) {
    if ((error as any).code === '23505') {
      const dup = await findSeasonByName(scope, input.name);
      if (dup) throw new SeasonAlreadyExistsError(dup);
    }
    throw error;
  }
  return data as any as SeasonRow;
}

/** Number of dependent records blocking deletion of a season. */
export async function countSeasonDependencies(seasonId: string): Promise<number> {
  const c = await getSeasonCounts(seasonId);
  const { count: transitions } = await supabase
    .from('season_transitions' as any)
    .select('id', { count: 'exact', head: true })
    .or(`from_season_id.eq.${seasonId},to_season_id.eq.${seasonId}`);
  return c.matches + c.trainings + c.evaluations + c.players + (transitions ?? 0);
}

export function canDeleteSeason(status: SeasonStatus, dependencies: number): boolean {
  return status === 'planning' && dependencies === 0;
}

export async function deleteSeason(seasonId: string): Promise<void> {
  const { error } = await supabase.from('seasons' as any).delete().eq('id', seasonId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Edit season (name / dates) with per-status rules
// ---------------------------------------------------------------------------

export interface UpdateSeasonInput {
  name: string;
  start_date: string;
  end_date: string;
  reference_date?: string | null;
  notes?: string | null;
}

/** "2026/2027" with consecutive years. */
export function isValidSeasonName(name: string): boolean {
  const m = /^(\d{4})\/(\d{4})$/.exec(name.trim());
  if (!m) return false;
  return parseInt(m[2], 10) === parseInt(m[1], 10) + 1;
}

export interface SeasonEditRules {
  canEdit: boolean;
  canEditName: boolean;
  canEditDates: boolean;
  reason?: string;
}

export function getSeasonEditRules(status: SeasonStatus): SeasonEditRules {
  if (status === 'archived') {
    return { canEdit: false, canEditName: false, canEditDates: false, reason: 'Época arquivada — não editável.' };
  }
  if (status === 'closed') {
    return { canEdit: true, canEditName: true, canEditDates: false, reason: 'Época fechada — só o nome pode ser alterado.' };
  }
  return { canEdit: true, canEditName: true, canEditDates: true };
}

/** Warning when the period is far from the usual July–June window (never blocks). */
export function seasonPeriodWarning(start: string, end: string): string | null {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (s.getMonth() !== 6 || months < 10 || months > 13) {
    return 'Período fora do habitual (julho a junho). Confirme as datas.';
  }
  return null;
}

export interface SeasonDataRange {
  matches: number;
  trainings: number;
  minDate: string | null;
  maxDate: string | null;
}

/** Min/max dates of games and training sessions attached to a season. */
export async function getSeasonDataRange(seasonId: string): Promise<SeasonDataRange> {
  const [{ data: matches }, { data: trainings }] = await Promise.all([
    supabase.from('matches' as any).select('match_date').eq('season_id', seasonId),
    supabase.from('training_sessions' as any).select('session_date').eq('season_id', seasonId),
  ]);
  const dates = [
    ...(((matches as any[]) ?? []).map((m) => m.match_date as string | null)),
    ...(((trainings as any[]) ?? []).map((t) => t.session_date as string | null)),
  ].filter((d): d is string => !!d).sort();
  return {
    matches: ((matches as any[]) ?? []).length,
    trainings: ((trainings as any[]) ?? []).length,
    minDate: dates[0] ?? null,
    maxDate: dates[dates.length - 1] ?? null,
  };
}

/** How many games/trainings would fall outside a new [start, end] interval. */
export async function validateSeasonDatesAgainstData(
  seasonId: string,
  start: string,
  end: string,
): Promise<{ outside: number; matchesOutside: number; trainingsOutside: number }> {
  const [{ data: matches }, { data: trainings }] = await Promise.all([
    supabase.from('matches' as any).select('match_date').eq('season_id', seasonId),
    supabase.from('training_sessions' as any).select('session_date').eq('season_id', seasonId),
  ]);
  const out = (d: string | null | undefined) => !!d && (d.slice(0, 10) < start || d.slice(0, 10) > end);
  const matchesOutside = ((matches as any[]) ?? []).filter((m) => out(m.match_date)).length;
  const trainingsOutside = ((trainings as any[]) ?? []).filter((t) => out(t.session_date)).length;
  return { matchesOutside, trainingsOutside, outside: matchesOutside + trainingsOutside };
}

export async function updateSeason(
  season: SeasonRow,
  scope: SeasonScope,
  input: UpdateSeasonInput,
): Promise<SeasonRow> {
  const rules = getSeasonEditRules(season.status);
  if (!rules.canEdit) throw new Error('Época arquivada — não pode ser editada.');

  const name = input.name.trim();
  if (!isValidSeasonName(name)) throw new Error('Nome inválido. Use o formato AAAA/AAAA com anos consecutivos (ex.: 2026/2027).');

  const start = rules.canEditDates ? input.start_date : season.start_date;
  const end = rules.canEditDates ? input.end_date : season.end_date;
  if (!start || !end || start >= end) throw new Error('A data de início tem de ser anterior à data de fim.');

  if (name !== season.name) {
    const existing = await findSeasonByName(scope, name);
    if (existing && existing.id !== season.id) throw new SeasonAlreadyExistsError(existing);
  }

  if (rules.canEditDates && (start !== season.start_date || end !== season.end_date)) {
    const v = await validateSeasonDatesAgainstData(season.id, start, end);
    if (v.outside > 0) {
      throw new Error(
        `As novas datas deixam ${v.outside} registo(s) fora da época (${v.matchesOutside} jogos, ${v.trainingsOutside} treinos). Ajuste o intervalo.`,
      );
    }
  }

  const payload: any = {
    name,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (rules.canEditDates) {
    payload.start_date = start;
    payload.end_date = end;
    payload.reference_date = input.reference_date || start;
  }

  const { data, error } = await supabase.from('seasons' as any).update(payload).eq('id', season.id).select('*').single();
  if (error) {
    if ((error as any).code === '23505') {
      const dup = await findSeasonByName(scope, name);
      if (dup) throw new SeasonAlreadyExistsError(dup);
    }
    throw error;
  }
  return data as any as SeasonRow;
}

// ---------------------------------------------------------------------------
// Repair: active season that actually holds the previous season's data
// ---------------------------------------------------------------------------

/** True when the active season holds games/trainings dated before its own start. */
export function detectRenamedSeason(active: SeasonRow | null, range: SeasonDataRange | undefined): boolean {
  if (!active || !range || !range.minDate) return false;
  return range.minDate.slice(0, 10) < active.start_date;
}

export interface RepairRenamedSeasonInput {
  season: SeasonRow;
  correctedName: string;
  correctedStart: string;
  correctedEnd: string;
  newName: string;
  newStart: string;
  newEnd: string;
}

/**
 * Renames the mislabeled season back to its real identity (closed) and inserts
 * the new season as a fresh planning record. No game/training data is moved.
 */
export async function repairRenamedSeason(scope: SeasonScope, input: RepairRenamedSeasonInput): Promise<SeasonRow> {
  if (!isValidSeasonName(input.correctedName) || !isValidSeasonName(input.newName)) {
    throw new Error('Nomes inválidos. Use o formato AAAA/AAAA com anos consecutivos.');
  }
  const { data: authData } = await supabase.auth.getUser();

  const { error: upErr } = await supabase
    .from('seasons' as any)
    .update({
      name: input.correctedName,
      start_date: input.correctedStart,
      end_date: input.correctedEnd,
      reference_date: input.correctedStart,
      status: 'closed',
      is_active: false,
      is_planning: false,
      closed_at: new Date().toISOString(),
      closed_by: authData?.user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.season.id);
  if (upErr) throw upErr;

  return createSeason(scope, {
    name: input.newName,
    start_date: input.newStart,
    end_date: input.newEnd,
    reference_date: input.newStart,
    previous_season_id: input.season.id,
  });
}



/**
 * One entry per (context, name, start_date, end_date). Extra rows in the same
 * context are legacy duplicates and are returned alongside the kept season.
 */
export function dedupeSeasons(seasons: SeasonRow[]): { season: SeasonRow; duplicates: SeasonRow[] }[] {
  const groups = new Map<string, SeasonRow[]>();
  for (const s of seasons) {
    const key = `${s.club_id ?? s.owner_id}|${s.name}|${s.start_date}|${s.end_date}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  return Array.from(groups.values())
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return (a.created_at || '').localeCompare(b.created_at || '');
      });
      return { season: sorted[0], duplicates: sorted.slice(1) };
    })
    .sort((a, b) => (b.season.start_date || '').localeCompare(a.season.start_date || ''));
}

export async function closeSeason(seasonId: string): Promise<void> {
  // Consolidate the per-player historical record BEFORE locking the season, so the
  // history tab can read immutable snapshots afterwards. Idempotent (upsert).
  const { error: snapError } = await supabase.rpc('build_player_season_snapshots' as any, {
    p_season_id: seasonId,
  });
  if (snapError) throw snapError;

  const { error } = await supabase.rpc('close_season' as any, { p_season_id: seasonId });
  if (error) throw error;
}

/** Re-generate the season snapshots without closing the season (idempotent). */
export async function buildPlayerSeasonSnapshots(seasonId: string): Promise<number> {
  const { data, error } = await supabase.rpc('build_player_season_snapshots' as any, {
    p_season_id: seasonId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}
export async function archiveSeason(seasonId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_season' as any, { p_season_id: seasonId });
  if (error) throw error;
}
export async function activateSeason(seasonId: string): Promise<void> {
  const { error } = await supabase.rpc('activate_season' as any, { p_season_id: seasonId });
  if (error) throw error;
}


export interface SeasonContext {
  activeSeasonId: string | null;
  planningSeasonId: string | null;
  lastClosedSeasonId: string | null;
  isArchivedScope: (seasonId: string | null | undefined) => boolean;
  archivedSet: Set<string>;
}

export async function getSeasonContext(scope: SeasonScope): Promise<SeasonContext> {
  const seasons = await listSeasons(scope);
  const active = seasons.find((s) => s.is_active);
  const planning = seasons.find((s) => s.status === 'planning');
  const closed = seasons.filter((s) => s.status === 'closed').sort((a, b) => (b.closed_at || '').localeCompare(a.closed_at || ''));
  const archivedSet = new Set(seasons.filter((s) => s.status === 'archived').map((s) => s.id));
  return {
    activeSeasonId: active?.id ?? null,
    planningSeasonId: planning?.id ?? null,
    lastClosedSeasonId: closed[0]?.id ?? null,
    archivedSet,
    isArchivedScope: (id) => !!id && archivedSet.has(id),
  };
}

// ---------------------------------------------------------------------------
// Next-season suggestion (July → June, 12 months)
// ---------------------------------------------------------------------------

export interface SeasonSuggestion {
  name: string;
  start_date: string;
  end_date: string;
  reference_date: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Suggest the next season from a previous season name/date.
 * "2025/2026" -> { name: "2026/2027", 2026-07-01 .. 2027-06-30, ref 2026-12-31 }
 */
export function suggestNextSeason(previous?: { name?: string | null; start_date?: string | null } | null): SeasonSuggestion {
  let firstYear: number | null = null;
  const name = previous?.name ?? '';
  const m = name.match(/(\d{4})\s*[\/\-–]\s*(\d{2,4})/);
  if (m) firstYear = parseInt(m[1], 10) + 1;
  else {
    const single = name.match(/(\d{4})/);
    if (single) firstYear = parseInt(single[1], 10) + 1;
  }
  if (firstYear === null && previous?.start_date) {
    const d = new Date(previous.start_date);
    if (!isNaN(d.getTime())) firstYear = d.getFullYear() + 1;
  }
  if (firstYear === null) {
    const now = new Date();
    // Before July we are still inside the season that started the previous year.
    firstYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  }
  return buildSeasonFromFirstYear(firstYear);
}

/**
 * Suggestion derived from the MOST RECENT season of the context (by start_date),
 * skipping names that already exist ("2026/2027" taken -> "2027/2028").
 */
export function suggestNextSeasonFromList(seasons: { name: string; start_date: string }[]): SeasonSuggestion {
  const latest = [...seasons].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0] ?? null;
  let suggestion = suggestNextSeason(latest);
  const taken = new Set(seasons.map((s) => s.name));
  let guard = 0;
  while (taken.has(suggestion.name) && guard++ < 20) {
    suggestion = suggestNextSeason(suggestion);
  }
  return suggestion;
}



export function buildSeasonFromFirstYear(firstYear: number): SeasonSuggestion {
  return {
    name: `${firstYear}/${firstYear + 1}`,
    start_date: `${firstYear}-07-${pad(1)}`,
    end_date: `${firstYear + 1}-06-30`,
    reference_date: `${firstYear}-12-31`,
  };
}

export function formatSeasonPeriod(start: string, end: string): string {
  const f = (d: string) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  };
  return `${f(start)} – ${f(end)}`;
}

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  planning: 'Planeamento',
  active: 'Ativa',
  closed: 'Fechada',
  archived: 'Arquivada',
};

export interface SeasonCounts {
  matches: number;
  trainings: number;
  players: number;
  evaluations: number;
}

async function countRows(table: string, column: string, seasonId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table as any)
    .select('id', { count: 'exact', head: true })
    .eq(column, seasonId);
  if (error) return 0;
  return count ?? 0;
}

/** Aggregated stats for a season card / close confirmation. */
export async function getSeasonCounts(seasonId: string): Promise<SeasonCounts> {
  const [matches, trainings, evaluations, players] = await Promise.all([
    countRows('matches', 'season_id', seasonId),
    countRows('coach_trainings', 'season_id', seasonId),
    countRows('player_evaluations', 'season_id', seasonId),
    (async () => {
      const { count } = await supabase
        .from('season_player_enrollments' as any)
        .select('id', { count: 'exact', head: true })
        .eq('season_id', seasonId)
        .eq('status', 'active');
      return count ?? 0;
    })(),
  ]);
  return { matches, trainings, evaluations, players };
}
