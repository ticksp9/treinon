// Roster loading + transition proposal helpers for the season wizard.
import { supabase } from '@/integrations/supabase/client';
import {
  describeTransition,
  getBirthYear,
  isPlayerEligibleForAgeGroup,
  resolveAgeGroupForPlayer,
  type AgeGroupRule,
  type TransitionClassification,
} from '@/lib/age-group-rules';

export interface RosterPlayer {
  player_id: string;
  name: string;
  birth_date: string | null;
  team_id: string | null;
  team_name: string | null;
  age_group_id: string | null;
  /** Enrollment status in the source season ('active' when coming from players table). */
  status: string;
}

export interface TeamOption {
  id: string;
  name: string;
  category: string | null;
}

export interface TransitionSource {
  players: RosterPlayer[];
  ageGroups: AgeGroupRule[];
  teams: TeamOption[];
}

const INACTIVE_STATUSES = ['left', 'loaned_out'];

/**
 * Roster of a season: enrollments when they exist, otherwise the current
 * players table (first transition ever, before any enrollment exists).
 */
export async function loadTransitionSource(fromSeasonId: string | null, clubId: string | null): Promise<TransitionSource> {
  const [{ data: teamsData }, ageGroups] = await Promise.all([
    supabase.from('teams').select('id, name, category').order('name'),
    loadAgeGroups(clubId),
  ]);
  const teams = (teamsData || []) as TeamOption[];
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  let enrollments: Array<{ player_id: string; team_id: string | null; age_group_id: string | null; status: string | null }> = [];
  if (fromSeasonId) {
    const { data } = await supabase
      .from('season_player_enrollments' as never)
      .select('player_id, team_id, age_group_id, status')
      .eq('season_id', fromSeasonId);
    enrollments = (data as unknown as typeof enrollments) || [];
  }

  let base: Array<{ player_id: string; team_id: string | null; age_group_id: string | null; status: string }>;
  if (enrollments.length > 0) {
    base = enrollments.map((e) => ({
      player_id: e.player_id,
      team_id: e.team_id,
      age_group_id: e.age_group_id,
      status: e.status ?? 'active',
    }));
  } else {
    const { data: players } = await supabase
      .from('players')
      .select('id, team_id')
      .eq('is_active', true);
    base = (players || []).map((p) => ({ player_id: p.id, team_id: p.team_id, age_group_id: null, status: 'active' }));
  }

  if (base.length === 0) return { players: [], ageGroups, teams };

  // Fetch in chunks: a single `.in()` with hundreds of ids exceeds the URL limit
  // and silently returns nothing (names showed as "—" in big academies).
  const ids = base.map((b) => b.player_id);
  const info: Array<{ id: string; name: string; birth_date: string | null }> = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, birth_date')
      .in('id', ids.slice(i, i + 150));
    if (error) throw error;
    info.push(...(data || []));
  }
  const infoMap = new Map(info.map((p) => [p.id, p]));

  const players: RosterPlayer[] = base.map((b) => ({
    player_id: b.player_id,
    name: infoMap.get(b.player_id)?.name ?? '—',
    birth_date: infoMap.get(b.player_id)?.birth_date ?? null,
    team_id: b.team_id,
    team_name: b.team_id ? teamMap.get(b.team_id)?.name ?? null : null,
    age_group_id: b.age_group_id,
    status: b.status,
  }));
  players.sort((a, b) => a.name.localeCompare(b.name));
  return { players, ageGroups, teams };
}

export async function loadAgeGroups(clubId: string | null): Promise<AgeGroupRule[]> {
  if (!clubId) return [];
  const { data } = await supabase
    .from('academy_age_groups')
    .select('id, code, name, min_birth_year, max_birth_year, display_order, is_active')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('display_order');
  return (data || []) as AgeGroupRule[];
}

export type TransitionAction = TransitionClassification;

export interface ProposalRow {
  player_id: string;
  name: string;
  birth_date: string | null;
  birth_year: number | null;
  current_team_id: string | null;
  current_team_name: string | null;
  current_age_group_id: string | null;
  current_status: string;
  target_age_group_id: string | null;
  target_team_id: string | null;
  action: TransitionAction;
  selected: boolean;
  /** true once the user changed the computed proposal. */
  manual: boolean;
  warning: string | null;
}

/** Best-effort team match for an age group, by comparing team.category with the group code/name. */
export function matchTeamForAgeGroup(group: AgeGroupRule | null | undefined, teams: TeamOption[]): string | null {
  if (!group) return null;
  const norm = (v: string) => v.toLowerCase().replace(/[\s\-_.]/g, '');
  const targets = [group.code, group.name].filter(Boolean).map((v) => norm(String(v)));
  const found = teams.find((t) => t.category && targets.includes(norm(t.category)));
  return found?.id ?? null;
}

/** Club mode: every player is placed in the age group matching their birth year at the reference date. */
export function buildClubProposals(src: TransitionSource, referenceDate: string): ProposalRow[] {
  return src.players.map((p) => {
    const res = resolveAgeGroupForPlayer(p.birth_date, referenceDate, src.ageGroups);
    const targetId = res.ageGroup?.id ?? null;
    let action: TransitionAction =
      res.reason === 'no_birth_date' ? 'unknown' : describeTransition(p.age_group_id, targetId, src.ageGroups);
    if (action === 'unknown' && targetId && !p.age_group_id && p.birth_date) action = 'stays';
    const inactive = INACTIVE_STATUSES.includes(p.status);
    return {
      player_id: p.player_id,
      name: p.name,
      birth_date: p.birth_date,
      birth_year: getBirthYear(p.birth_date),
      current_team_id: p.team_id,
      current_team_name: p.team_name,
      current_age_group_id: p.age_group_id,
      current_status: p.status,
      target_age_group_id: targetId ?? (action === 'unknown' ? p.age_group_id : null),
      target_team_id: targetId
        ? matchTeamForAgeGroup(res.ageGroup, src.teams) ?? p.team_id
        : action === 'unknown' ? p.team_id : null,
      action,
      // Missing birth dates remain included conservatively, but are clearly
      // marked for review. Players with no eligible formation group leave.
      selected: (action === 'unknown' || !!targetId) && action !== 'leaves' && !inactive,
      manual: false,
      warning: action === 'unknown'
        ? 'sem data de nascimento — confirmar elegibilidade'
        : res.warning,
    };
  });
}

/**
 * Coach mode. When keeping the same age group only still-eligible players transition;
 * the others are shown but generate no enrollment (never deleted from the database).
 */
export function buildCoachProposals(
  src: TransitionSource,
  referenceDate: string,
  opts: { keepSameAgeGroup: boolean; targetAgeGroupId: string | null; targetTeamId: string | null },
): ProposalRow[] {
  return src.players.map((p) => {
    const resolved = resolveAgeGroupForPlayer(p.birth_date, referenceDate, src.ageGroups);
    const resolvedGroupId = resolved.ageGroup?.id ?? null;
    const groupId = opts.keepSameAgeGroup ? p.age_group_id ?? opts.targetAgeGroupId : opts.targetAgeGroupId;
    const group = src.ageGroups.find((g) => g.id === groupId) ?? null;
    // null = undecidable (missing birth date) → never treated as "leaves".
    const eligibility = group ? isPlayerEligibleForAgeGroup(p.birth_date, group) : (p.birth_date ? true : null);
    const unknown = eligibility === null;
    const eligible = eligibility === true;
    const inactive = INACTIVE_STATUSES.includes(p.status);
    // Conservative: undecidable players stay in the team by default when the
    // coach keeps the same age group.
    const keepUnknown = unknown && opts.keepSameAgeGroup;
    const computedAction: TransitionAction = unknown
      ? 'unknown'
      : opts.keepSameAgeGroup
        ? describeTransition(p.age_group_id, resolvedGroupId, src.ageGroups)
        : eligible ? 'promotes' : resolved.reason === 'over_age' ? 'leaves' : 'promotes';
    const canTransit = opts.keepSameAgeGroup
      ? computedAction === 'stays' || computedAction === 'unknown'
      : eligible || keepUnknown;
    const row: ProposalRow = {
      player_id: p.player_id,
      name: p.name,
      birth_date: p.birth_date,
      birth_year: getBirthYear(p.birth_date),
      current_team_id: p.team_id,
      current_team_name: p.team_name,
      current_age_group_id: p.age_group_id,
      current_status: p.status,
      target_age_group_id: canTransit
        ? groupId ?? p.age_group_id ?? null
        : computedAction === 'promotes' ? resolvedGroupId : null,
      target_team_id: canTransit ? opts.targetTeamId ?? p.team_id : null,
      action: computedAction,
      selected: canTransit && !inactive,
      manual: false,
      warning: unknown ? 'sem data de nascimento — confirmar elegibilidade' : resolved.warning,
    };
    if (import.meta.env.DEV) {
      console.debug('[transition-preview]', {
        nome: row.name,
        birth_date: row.birth_date,
        birth_year: row.birth_year,
        escalao_calculado: row.target_age_group_id,
        classification: row.action,
      });
    }
    return row;
  });
}

export function splitCoachProposals(rows: ProposalRow[]) {
  return {
    continuing: rows.filter((r) => r.selected),
    leaving: rows.filter((r) => !r.selected && r.action !== 'unknown'),
    attention: rows.filter((r) => r.action === 'unknown'),
  };
}

/** Club preview grouped by destination age group, with counters per bucket. */
export interface AgeGroupBucket {
  ageGroupId: string | null;
  ageGroupName: string;
  incoming: ProposalRow[];
  staying: ProposalRow[];
  leaving: ProposalRow[];
}

export function groupProposalsByAgeGroup(rows: ProposalRow[], ageGroups: AgeGroupRule[]): AgeGroupBucket[] {
  const buckets: AgeGroupBucket[] = ageGroups.map((g) => ({
    ageGroupId: g.id,
    ageGroupName: g.name,
    incoming: [],
    staying: [],
    leaving: [],
  }));
  const outside: AgeGroupBucket = { ageGroupId: null, ageGroupName: 'Sem escalão elegível', incoming: [], staying: [], leaving: [] };

  for (const r of rows) {
    const bucket = buckets.find((b) => b.ageGroupId === r.target_age_group_id);
    if (!bucket) {
      outside.leaving.push(r);
      continue;
    }
    if (r.current_age_group_id && r.current_age_group_id !== r.target_age_group_id) bucket.incoming.push(r);
    else bucket.staying.push(r);
    // whoever left this group appears as "sai" in the origin bucket
    const origin = buckets.find((b) => b.ageGroupId === r.current_age_group_id);
    if (origin && origin !== bucket) origin.leaving.push(r);
  }
  return [...buckets, outside].filter(
    (b) => b.incoming.length > 0 || b.staying.length > 0 || b.leaving.length > 0,
  );
}

export function attentionRows(rows: ProposalRow[]): ProposalRow[] {
  return rows.filter((r) => r.action === 'unknown' || !r.birth_date);
}

export function inactiveSourceRows(rows: ProposalRow[]): ProposalRow[] {
  return rows.filter((r) => INACTIVE_STATUSES.includes(r.current_status));
}

// ---------------------------------------------------------------------------
// Import the roster of the previous season into a target season.
// ---------------------------------------------------------------------------

export interface ImportRosterResult {
  imported: number;
  promoted: number;
  needsAttention: number;
  promotedNames: string[];
  attentionNames: string[];
  fromSeasonName: string;
}

interface SeasonLite {
  id: string;
  name: string;
  owner_id: string;
  club_id: string | null;
  start_date: string;
  end_date: string;
  reference_date: string | null;
  previous_season_id?: string | null;
}

/**
 * Copies the active enrollments of the previous season into `targetSeasonId`,
 * keeping only players still eligible for their age group at the new season's
 * reference date. Players without birth date are imported and flagged.
 * Idempotent: existing enrollments are never duplicated.
 */
export async function importRosterFromPreviousSeason(targetSeasonId: string): Promise<ImportRosterResult> {
  const { data: target, error: targetErr } = await supabase
    .from('seasons' as never)
    .select('*')
    .eq('id', targetSeasonId)
    .maybeSingle();
  if (targetErr) throw new Error(targetErr.message);
  if (!target) throw new Error('Época de destino não encontrada.');
  const to = target as unknown as SeasonLite;

  // Previous season: explicit link, otherwise the most recent one before it.
  let from: SeasonLite | null = null;
  if (to.previous_season_id) {
    const { data } = await supabase.from('seasons' as never).select('*').eq('id', to.previous_season_id).maybeSingle();
    from = (data as unknown as SeasonLite) ?? null;
  }
  if (!from) {
    let q = supabase
      .from('seasons' as never)
      .select('*')
      .lt('start_date', to.start_date)
      .order('start_date', { ascending: false })
      .limit(1);
    q = to.club_id ? q.eq('club_id', to.club_id) : q.eq('owner_id', to.owner_id).is('club_id', null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    from = ((data as unknown as SeasonLite[]) || [])[0] ?? null;
  }
  if (!from) throw new Error('Não existe época anterior para importar.');

  const { data: prevEnrollments, error: enrErr } = await supabase
    .from('season_player_enrollments' as never)
    .select('player_id, team_id, age_group_id, position, shirt_number')
    .eq('season_id', from.id)
    .eq('status', 'active');
  if (enrErr) throw new Error(enrErr.message);
  const source = (prevEnrollments as unknown as Array<{
    player_id: string;
    team_id: string | null;
    age_group_id: string | null;
    position: string | null;
    shirt_number: number | null;
  }>) || [];
  if (source.length === 0) throw new Error('A época anterior não tem jogadores inscritos.');

  const [{ data: playerRows, error: pErr }, ageGroups, { data: existingRows, error: exErr }] = await Promise.all([
    supabase.from('players').select('id, name, birth_date').in('id', source.map((s) => s.player_id)),
    loadAgeGroups(to.club_id),
    supabase.from('season_player_enrollments' as never).select('player_id').eq('season_id', to.id),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (exErr) throw new Error(exErr.message);
  const infoMap = new Map((playerRows || []).map((p) => [p.id, p]));
  const already = new Set(
    ((existingRows as unknown as Array<{ player_id: string }>) || []).map((e) => e.player_id),
  );

  const referenceDate = to.reference_date || to.start_date;
  const promotedNames: string[] = [];
  const attentionNames: string[] = [];
  const toInsert: Array<Record<string, unknown>> = [];

  for (const row of source) {
    const info = infoMap.get(row.player_id);
    const name = info?.name ?? '—';
    const group = ageGroups.find((g) => g.id === row.age_group_id) ?? null;
    const eligibility = group ? isPlayerEligibleForAgeGroup(info?.birth_date ?? null, group) : (info?.birth_date ? true : null);

    if (eligibility === false) {
      promotedNames.push(name);
      continue;
    }
    if (eligibility === null) attentionNames.push(name);
    if (already.has(row.player_id)) continue;

    toInsert.push({
      season_id: to.id,
      player_id: row.player_id,
      team_id: row.team_id,
      age_group_id: row.age_group_id,
      position: row.position,
      shirt_number: row.shirt_number,
      status: 'active',
      joined_at: referenceDate,
      notes: eligibility === null ? 'Importado sem data de nascimento — requer atenção' : null,
    });
  }

  // Destination team memberships must exist before enrolling players.
  const teamIds = Array.from(new Set(toInsert.map((r) => r.team_id).filter(Boolean))) as string[];
  if (teamIds.length > 0) {
    const { data: existingTeams, error: mErr } = await supabase
      .from('season_team_memberships' as never)
      .select('team_id')
      .eq('season_id', to.id);
    if (mErr) throw new Error(mErr.message);
    const have = new Set(((existingTeams as unknown as Array<{ team_id: string }>) || []).map((t) => t.team_id));
    const missing = teamIds.filter((id) => !have.has(id));
    if (missing.length > 0) {
      const prevGroups = new Map(source.filter((s) => s.team_id).map((s) => [s.team_id as string, s.age_group_id]));
      const { error: insErr } = await supabase
        .from('season_team_memberships' as never)
        .insert(missing.map((id) => ({ season_id: to.id, team_id: id, age_group_id: prevGroups.get(id) ?? null })) as never);
      if (insErr) throw new Error(insErr.message);
    }
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase
      .from('season_player_enrollments' as never)
      .insert(toInsert as never);
    if (insErr) {
      console.error('[import-roster] falha ao inscrever jogadores', { targetSeasonId, insErr });
      throw new Error(insErr.message);
    }
  }

  // Never trust the presumed count: read back what exists now.
  const { count, error: countErr } = await supabase
    .from('season_player_enrollments' as never)
    .select('id', { count: 'exact', head: true })
    .eq('season_id', to.id)
    .eq('status', 'active');
  if (countErr) throw new Error(countErr.message);
  if (toInsert.length > 0 && (count ?? 0) === 0) {
    throw new Error('A importação não inscreveu nenhum jogador na nova época.');
  }

  return {
    imported: toInsert.length,
    promoted: promotedNames.length,
    needsAttention: attentionNames.length,
    promotedNames,
    attentionNames,
    fromSeasonName: from.name,
  };
}

// ---------------------------------------------------------------------------
// Team roster per season (enrollments are the single source of truth).
// A player may hold several active enrollments in the same season, one per team.
// ---------------------------------------------------------------------------

export interface TeamRosterEntry {
  enrollment_id: string;
  player_id: string;
  team_id: string | null;
  age_group_id: string | null;
  position: string | null;
  shirt_number: number | null;
  status: string;
}

/** Active enrollments of a team in a season. */
export async function getTeamRoster(seasonId: string, teamId: string): Promise<TeamRosterEntry[]> {
  const { data, error } = await supabase
    .from('season_player_enrollments' as never)
    .select('id, player_id, team_id, age_group_id, position, shirt_number, status')
    .eq('season_id', seasonId)
    .eq('team_id', teamId)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  return ((data as unknown as Array<Record<string, unknown>>) || []).map((r) => ({
    enrollment_id: r.id as string,
    player_id: r.player_id as string,
    team_id: (r.team_id as string) ?? null,
    age_group_id: (r.age_group_id as string) ?? null,
    position: (r.position as string) ?? null,
    shirt_number: (r.shirt_number as number) ?? null,
    status: (r.status as string) ?? 'active',
  }));
}

export interface AvailablePlayer {
  id: string;
  name: string;
  birth_date: string | null;
  /** Teams (ids) where the player already has an active enrollment this season. */
  also_in_team_ids: string[];
}

/**
 * Players that can be added to `teamId` in `seasonId`: every player of the
 * user/club without an active enrollment in that team for that season.
 */
export async function listAvailablePlayersForTeam(
  seasonId: string,
  teamId: string,
): Promise<AvailablePlayer[]> {
  const [{ data: players, error: pErr }, { data: enrollments, error: eErr }] = await Promise.all([
    supabase.from('players').select('id, name, birth_date').eq('is_active', true).order('name'),
    supabase
      .from('season_player_enrollments' as never)
      .select('player_id, team_id')
      .eq('season_id', seasonId)
      .eq('status', 'active'),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (eErr) throw new Error(eErr.message);

  const rows = (enrollments as unknown as Array<{ player_id: string; team_id: string | null }>) || [];
  const byPlayer = new Map<string, string[]>();
  for (const r of rows) {
    const list = byPlayer.get(r.player_id) ?? [];
    if (r.team_id) list.push(r.team_id);
    byPlayer.set(r.player_id, list);
  }

  return (players || [])
    .filter((p) => !(byPlayer.get(p.id) ?? []).includes(teamId))
    .map((p) => ({
      id: p.id,
      name: p.name,
      birth_date: p.birth_date ?? null,
      also_in_team_ids: byPlayer.get(p.id) ?? [],
    }));
}

/** Enrolls an existing player in a team for the season (idempotent per team). */
export async function addPlayerToTeam(
  seasonId: string,
  teamId: string,
  playerId: string,
  opts?: { ageGroupId?: string | null; joinedAt?: string },
): Promise<void> {
  const joinedAt = opts?.joinedAt ?? new Date().toISOString().slice(0, 10);

  // Reactivate a previous (left) enrollment instead of creating a duplicate.
  const { data: existing, error: exErr } = await supabase
    .from('season_player_enrollments' as never)
    .select('id, status')
    .eq('season_id', seasonId)
    .eq('team_id', teamId)
    .eq('player_id', playerId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  if (existing) {
    const row = existing as unknown as { id: string; status: string };
    if (row.status === 'active') return;
    const { error } = await supabase
      .from('season_player_enrollments' as never)
      .update({ status: 'active', left_at: null, joined_at: joinedAt } as never)
      .eq('id', row.id);
    if (error) throw new Error(error.message);
    return;
  }

  // The destination team must belong to the season.
  const { error: mErr } = await supabase
    .from('season_team_memberships' as never)
    .upsert({ season_id: seasonId, team_id: teamId } as never, { onConflict: 'season_id,team_id' });
  if (mErr) throw new Error(mErr.message);

  const { error } = await supabase.from('season_player_enrollments' as never).insert({
    season_id: seasonId,
    player_id: playerId,
    team_id: teamId,
    age_group_id: opts?.ageGroupId ?? null,
    status: 'active',
    joined_at: joinedAt,
  } as never);
  if (error) {
    console.error('[addPlayerToTeam] insert failed', { seasonId, teamId, playerId, error });
    throw new Error(error.message);
  }
}

/** Soft-remove: keeps history, only marks the enrollment of this team as `left`. */
export async function removePlayerFromTeam(
  seasonId: string,
  teamId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('season_player_enrollments' as never)
    .update({ status: 'left', left_at: new Date().toISOString().slice(0, 10) } as never)
    .eq('season_id', seasonId)
    .eq('team_id', teamId)
    .eq('player_id', playerId)
    .eq('status', 'active');
  if (error) {
    console.error('[removePlayerFromTeam] update failed', { seasonId, teamId, playerId, error });
    throw new Error(error.message);
  }
}

/** Active enrollment counts per team for a season (team_id -> count). */
export async function countActiveEnrollmentsByTeam(seasonId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('season_player_enrollments' as never)
    .select('team_id')
    .eq('season_id', seasonId)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const r of (data as unknown as Array<{ team_id: string | null }>) || []) {
    if (!r.team_id) continue;
    map.set(r.team_id, (map.get(r.team_id) ?? 0) + 1);
  }
  return map;
}

/** Teams (ids) where the player holds an active enrollment in the season. */
export async function getPlayerTeamsInSeason(seasonId: string, playerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('season_player_enrollments' as never)
    .select('team_id')
    .eq('season_id', seasonId)
    .eq('player_id', playerId)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  return ((data as unknown as Array<{ team_id: string | null }>) || [])
    .map((r) => r.team_id)
    .filter((t): t is string => !!t);
}
