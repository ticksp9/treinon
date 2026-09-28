// Season transition: preview + apply + rollback.
import { supabase } from '@/integrations/supabase/client';
import {
  describeTransition,
  getBirthYear,
  isPlayerEligibleForAgeGroup,
  resolveAgeGroupForPlayer,
  type AgeGroupRule,
} from '@/lib/age-group-rules';
import { loadTransitionSource, matchTeamForAgeGroup, type ProposalRow } from '@/lib/season-roster-service';

export type TransitionMode = 'club_auto' | 'coach_manual';

export interface CoachManualOptions {
  keepSameAgeGroup: boolean;
  targetAgeGroupId?: string | null; // when keepSameAgeGroup=false
  selectedPlayerIds?: string[];     // explicit confirmation
  targetTeamId?: string | null;
}

export interface PreviewItem {
  player_id: string;
  player_name: string;
  birth_date: string | null;
  birth_year: number | null;
  current_team_id: string | null;
  current_age_group_id: string | null;
  current_status: string;
  proposed_team_id: string | null;
  proposed_age_group_id: string | null;
  age_at_reference: number | null;
  classification: 'stays' | 'promotes' | 'leaves' | 'unknown';
  reason: string;
  eligible: boolean;
  selected: boolean;
  manual: boolean;
  warning: string | null;
}

export interface PreviewResult {
  fromSeasonId: string;
  toSeasonId: string;
  mode: TransitionMode;
  referenceDate: string;
  items: PreviewItem[];
  warnings: string[];
  ageGroups: AgeGroupRule[];
  teams: Array<{ id: string; name: string; category: string | null }>;
}

interface PreviewArgs {
  fromSeasonId: string;
  toSeasonId: string;
  mode: TransitionMode;
  referenceDate: string;
  clubId?: string | null;
  coachOptions?: CoachManualOptions;
}

const INACTIVE_STATUSES = ['left', 'loaned_out'];

type RpcResult = { data: unknown; error: { message: string } | null };
const callRpc = (name: string, args: Record<string, unknown>): Promise<RpcResult> =>
  (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<RpcResult>)(name, args);

/**
 * Builds the editable proposal for a transition. Nothing is written here.
 * Blocks when the club has no configured age groups (club mode).
 */
export async function previewTransition(args: PreviewArgs): Promise<PreviewResult> {
  const { fromSeasonId, toSeasonId, mode, referenceDate, coachOptions } = args;

  let clubId = args.clubId ?? null;
  if (!clubId) {
    const { data: toSeason } = await supabase
      .from('seasons' as never)
      .select('club_id')
      .eq('id', toSeasonId)
      .maybeSingle();
    clubId = (toSeason as { club_id: string | null } | null)?.club_id ?? null;
  }

  const source = await loadTransitionSource(fromSeasonId, clubId);
  const ageGroups: AgeGroupRule[] = source.ageGroups;

  if (mode === 'club_auto' && clubId && ageGroups.length === 0) {
    throw new Error('Configure os escalões do clube (academy_age_groups) antes de transitar jogadores.');
  }

  const warnings: string[] = [];

  const items: PreviewItem[] = source.players.map((sp) => {
    const inactive = INACTIVE_STATUSES.includes(sp.status);

    const resolved = resolveAgeGroupForPlayer(sp.birth_date, referenceDate, ageGroups);
    const resolvedTargetId = resolved.ageGroup?.id ?? null;

    if (mode === 'club_auto') {
      let classification = resolved.reason === 'no_birth_date'
        ? 'unknown' as const
        : describeTransition(sp.age_group_id, resolvedTargetId, ageGroups);
      if (classification === 'unknown' && resolvedTargetId && sp.birth_date) classification = 'stays';
      if (resolved.warning) warnings.push(`${sp.name}: ${resolved.warning}`);
      const unknown = classification === 'unknown';
      return {
        player_id: sp.player_id,
        player_name: sp.name,
        birth_date: sp.birth_date,
        birth_year: getBirthYear(sp.birth_date),
        current_team_id: sp.team_id,
        current_age_group_id: sp.age_group_id,
        current_status: sp.status,
        proposed_team_id: resolvedTargetId
          ? matchTeamForAgeGroup(resolved.ageGroup, source.teams)
          : unknown ? sp.team_id : null,
        proposed_age_group_id: resolvedTargetId ?? (unknown ? sp.age_group_id : null),
        age_at_reference: resolved.ageAtReference,
        classification,
        reason: resolved.reason,
        eligible: unknown || !!resolvedTargetId,
        selected: (unknown || !!resolvedTargetId) && classification !== 'leaves' && !inactive,
        manual: false,
        warning: unknown ? 'sem data de nascimento — confirmar elegibilidade' : resolved.warning,
      };
    }

    // coach_manual
    const targetGroup = coachOptions?.keepSameAgeGroup
      ? ageGroups.find((g) => g.id === sp.age_group_id) ?? null
      : ageGroups.find((g) => g.id === coachOptions?.targetAgeGroupId) ?? null;
    const unknown = !sp.birth_date;
    const eligible = unknown ? false : targetGroup ? isPlayerEligibleForAgeGroup(sp.birth_date, targetGroup) === true : true;
    // Conservative: a missing birth date never expels a player when the coach
    // keeps the same age group.
    const keepUnknown = unknown && !!coachOptions?.keepSameAgeGroup;
    const classification = unknown
      ? 'unknown' as const
      : coachOptions?.keepSameAgeGroup
        ? describeTransition(sp.age_group_id, resolvedTargetId, ageGroups)
        : eligible ? 'promotes' as const : resolved.reason === 'over_age' ? 'leaves' as const : 'promotes' as const;
    const transits = coachOptions?.keepSameAgeGroup
      ? classification === 'stays' || classification === 'unknown'
      : eligible || keepUnknown;
    const selected = coachOptions?.selectedPlayerIds
      ? coachOptions.selectedPlayerIds.includes(sp.player_id)
      : transits && !inactive;
    return {
      player_id: sp.player_id,
      player_name: sp.name,
      birth_date: sp.birth_date,
      birth_year: getBirthYear(sp.birth_date),
      current_team_id: sp.team_id,
      current_age_group_id: sp.age_group_id,
      current_status: sp.status,
      proposed_team_id: transits ? coachOptions?.targetTeamId ?? sp.team_id : null,
      proposed_age_group_id: transits
        ? targetGroup?.id ?? sp.age_group_id ?? null
        : classification === 'promotes' ? resolvedTargetId : null,
      age_at_reference: getBirthYear(sp.birth_date) != null ? new Date(referenceDate).getFullYear() - (getBirthYear(sp.birth_date) as number) : null,
      classification,
      reason: unknown ? 'no_birth_date' : resolved.reason,
      eligible: transits,
      selected,
      manual: false,
      warning: unknown ? 'sem data de nascimento — confirmar elegibilidade' : resolved.warning,
    };

  });

  return { fromSeasonId, toSeasonId, mode, referenceDate, items, warnings, ageGroups, teams: source.teams };
}

export async function applyTransition(preview: PreviewResult): Promise<{ transitionId: string; enrolled: number }> {
  return applyWizardTransition({
    fromSeasonId: preview.fromSeasonId,
    toSeasonId: preview.toSeasonId,
    mode: preview.mode,
    referenceDate: preview.referenceDate,
    rows: preview.items.map((i) => ({
      player_id: i.player_id,
      player_name: i.player_name,
      birth_date: i.birth_date,
      birth_year: i.birth_year,
      from_age_group_id: i.current_age_group_id,
      target_team_id: i.proposed_team_id,
      target_age_group_id: i.proposed_age_group_id,
      selected: i.selected,
      action: i.classification,
      manual: i.manual,
      reason: i.reason,
    })),
    warnings: preview.warnings,
    ageGroups: preview.ageGroups,
  });
}

export async function rollbackTransition(transitionId: string): Promise<void> {
  const { error } = await callRpc('rollback_season_transition', { p_transition_id: transitionId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Wizard entry point: persists the transition, the team memberships and the
// enrollments for the destination season.
// ---------------------------------------------------------------------------

export interface WizardTransitionRow {
  player_id: string;
  player_name?: string;
  birth_date?: string | null;
  birth_year?: number | null;
  from_age_group_id?: string | null;
  target_team_id: string | null;
  target_age_group_id: string | null;
  selected: boolean;
  action?: string;
  manual?: boolean;
  reason?: string;
}

export interface WizardTransitionInput {
  fromSeasonId: string | null;
  toSeasonId: string;
  mode: TransitionMode;
  referenceDate: string;
  rows: WizardTransitionRow[];
  warnings?: string[];
  /** Set when the club has age groups configured; used for auto team creation. */
  ageGroups?: AgeGroupRule[];
}

export function buildSelectedEnrollments(
  rows: WizardTransitionRow[],
  createdTeams: Map<string, string>,
  joinedAt: string,
) {
  return rows.filter((r) => r.selected).map((r) => ({
    player_id: r.player_id,
    team_id: r.target_team_id ?? (r.target_age_group_id ? createdTeams.get(r.target_age_group_id) ?? null : null),
    age_group_id: r.target_age_group_id,
    status: 'active' as const,
    joined_at: joinedAt,
  }));
}

export function buildTransitionAuditRows(rows: WizardTransitionRow[]) {
  return rows.map((r) => ({
    player_id: r.player_id,
    classification: r.action ?? null,
    from_age_group: r.from_age_group_id ?? null,
    to_age_group: r.selected ? r.target_age_group_id : null,
    included: r.selected,
    manual_override: !!r.manual,
    motivo: r.reason ?? r.action ?? null,
  }));
}

export function validateTransitionSelection(rows: WizardTransitionRow[], mode: TransitionMode): void {
  const selectedRows = rows.filter((row) => row.selected);
  if (selectedRows.length === 0) {
    throw new Error('Nenhum jogador selecionado para transitar.');
  }
  if (selectedRows.some((row) => row.action === 'leaves')) {
    throw new Error('Jogadores classificados como “Sai” não podem ser inscritos na nova época.');
  }
  if (mode === 'coach_manual' && selectedRows.some((row) => row.action === 'promotes')) {
    throw new Error('No modo treinador, jogadores que sobem não ficam inscritos neste plantel.');
  }
}

/** Guard: a given (from, to) pair can only be applied once. */
async function assertNotAlreadyApplied(fromSeasonId: string | null, toSeasonId: string): Promise<void> {
  let q = supabase
    .from('season_transitions' as never)
    .select('id')
    .eq('to_season_id', toSeasonId)
    .eq('status', 'applied');
  q = fromSeasonId ? q.eq('from_season_id', fromSeasonId) : q.is('from_season_id', null);
  const { data } = await q.limit(1);
  if (data && (data as unknown[]).length > 0) {
    throw new Error('Já existe uma transição aplicada entre estas duas épocas.');
  }
}

/**
 * Creates the destination teams that do not exist yet, copying name/config from
 * the equivalent team of the previous season when possible.
 */
async function ensureDestinationTeams(
  input: WizardTransitionInput,
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const groups = input.ageGroups ?? [];
  const missingGroupIds = Array.from(
    new Set(
      input.rows
        .filter((r) => r.selected && r.target_age_group_id && !r.target_team_id)
        .map((r) => r.target_age_group_id as string),
    ),
  );
  if (missingGroupIds.length === 0) return mapping;

  const { data: season } = await supabase
    .from('seasons' as never)
    .select('id, club_id, owner_id, name')
    .eq('id', input.toSeasonId)
    .maybeSingle();
  const s = season as { club_id: string | null; owner_id: string | null; name: string } | null;
  const { data: authData } = await supabase.auth.getUser();
  const ownerId = authData?.user?.id ?? s?.owner_id ?? null;

  for (const groupId of missingGroupIds) {
    const group = groups.find((g) => g.id === groupId);
    const name = group ? `${group.name} ${s?.name ?? ''}`.trim() : `Equipa ${s?.name ?? ''}`.trim();
    const { data: created, error } = await supabase
      .from('teams')
      .insert({
        name,
        category: group?.name ?? null,
        club_id: s?.club_id ?? null,
        owner_id: ownerId ?? undefined,
        season_id: input.toSeasonId,
      } as never)
      .select('id')
      .single();
    if (error) {
      console.error('[season-transition] falha ao criar equipa de destino', { groupId, error });
      throw new Error(`Não foi possível criar a equipa do escalão: ${error.message}`);
    }
    mapping.set(groupId, (created as { id: string }).id);
  }
  return mapping;
}


export async function applyWizardTransition(input: WizardTransitionInput): Promise<{ transitionId: string; enrolled: number }> {
  if (!input.fromSeasonId) {
    throw new Error("Sem época anterior: usa 'Criar sem transitar jogadores'.");
  }
  validateTransitionSelection(input.rows, input.mode);
  const selectedRows = input.rows.filter((r) => r.selected);
  await assertNotAlreadyApplied(input.fromSeasonId, input.toSeasonId);

  const createdTeams = await ensureDestinationTeams(input);

  const { data: seasonRow } = await supabase
    .from('seasons' as never)
    .select('start_date')
    .eq('id', input.toSeasonId)
    .maybeSingle();
  const joinedAt = (seasonRow as { start_date: string | null } | null)?.start_date ?? input.referenceDate;

  const enrollments = buildSelectedEnrollments(input.rows, createdTeams, joinedAt);

  // Team/age-group memberships created by the same server-side transaction.
  const memberships = Array.from(
    new Map(
      enrollments
        .filter((e) => e.team_id)
        .map((e) => [e.team_id as string, { team_id: e.team_id, age_group_id: e.age_group_id }]),
    ).values(),
  );

  const { data: authData } = await supabase.auth.getUser();

  const audit = {
    generated_at: new Date().toISOString(),
    user_id: authData?.user?.id ?? null,
    reference_date: input.referenceDate,
    warnings: input.warnings ?? [],
    players: input.rows.map((r) => ({
      player_id: r.player_id,
      player_name: r.player_name ?? null,
      birth_date: r.birth_date ?? null,
      birth_year: r.birth_year ?? null,
      from_age_group: r.from_age_group_id ?? null,
      to_age_group: r.selected ? r.target_age_group_id : null,
      classification: r.action ?? null,
      manual_override: !!r.manual,
      included: r.selected,
      motivo: r.reason ?? r.action ?? null,
    })),
  };

  const { data: created, error: insErr } = await supabase
    .from('season_transitions' as never)
    .insert({
      from_season_id: input.fromSeasonId,
      to_season_id: input.toSeasonId,
      mode: input.mode,
      reference_date: input.referenceDate,
      triggered_by: authData?.user?.id ?? null,
      status: 'previewed',
      payload: { enrollments, memberships, rows: buildTransitionAuditRows(input.rows), audit },
    } as never)
    .select('id')
    .single();
  if (insErr) {
    console.error('[season-transition] falha ao criar a transição', insErr);
    throw new Error(insErr.message || 'Não foi possível criar a transição.');
  }
  const transitionId = (created as { id: string }).id;

  try {
    const { error: applyErr } = await callRpc('apply_season_transition', { p_transition_id: transitionId });
    if (applyErr) throw applyErr;

    // Never trust the presumed count: read back what was really written.
    const { count, error: countErr } = await supabase
      .from('season_player_enrollments' as never)
      .select('id', { count: 'exact', head: true })
      .eq('season_id', input.toSeasonId)
      .eq('status', 'active')
      .in('player_id', selectedRows.map((r) => r.player_id));
    if (countErr) throw new Error(countErr.message);
    const enrolled = count ?? 0;
    if (enrolled !== selectedRows.length) {
      throw new Error(`A transição inscreveu ${enrolled} de ${selectedRows.length} jogadores selecionados.`);
    }
    return { transitionId, enrolled };
  } catch (err) {

    // Atomicity: the RPC runs in a single transaction; on failure nothing was
    // written except the draft row, which we remove here.
    console.error('[season-transition] falha ao aplicar a transição', {
      transitionId,
      enrollments: enrollments.length,
      memberships: memberships.length,
      error: err,
    });
    // No partial state: roll back anything the RPC may have committed, then
    // remove the draft row.
    try {
      await callRpc('rollback_season_transition', { p_transition_id: transitionId });
    } catch (rollbackErr) {
      console.error('[season-transition] rollback falhou', { transitionId, rollbackErr });
    }
    await supabase.from('season_transitions' as never).delete().eq('id', transitionId);

    const message = (err as { message?: string })?.message ?? 'Erro desconhecido ao aplicar a transição.';
    throw new Error(message);
  }
}


/**
 * Validation used when enrolling a brand new player (no previous enrollment)
 * into an age group of the current season.
 */
export function validateNewPlayerEnrollment(
  birthDate: string | null,
  group: AgeGroupRule | null | undefined,
): { eligible: boolean; message: string | null } {
  if (!group) return { eligible: true, message: null };
  if (!birthDate) return { eligible: false, message: 'Jogador sem data de nascimento: confirmação manual necessária.' };
  const eligible = isPlayerEligibleForAgeGroup(birthDate, group);
  return {
    eligible,
    message: eligible
      ? null
      : `Jogador nascido em ${getBirthYear(birthDate)} não é elegível para ${group.name} (${group.min_birth_year}–${group.max_birth_year}). Requer confirmação explícita.`,
  };
}

/** Kept for callers that only need the row shape from the wizard. */
export type { ProposalRow };

/**
 * Creates the minimal player record used by the wizard's "+ Adicionar jogador".
 * Never duplicates: existing players are picked from the list instead.
 */
export async function createTransitionPlayer(input: {
  name: string;
  birth_date: string;
  team_id: string;
}): Promise<{ id: string; name: string; birth_date: string | null }> {
  if (!input.name.trim()) throw new Error('Nome obrigatório.');
  if (!input.birth_date) throw new Error('Data de nascimento obrigatória.');
  if (!input.team_id) throw new Error('Equipa obrigatória.');
  const { data: authData } = await supabase.auth.getUser();
  const ownerId = authData?.user?.id;
  if (!ownerId) throw new Error('Sessão inválida.');
  const { data, error } = await supabase
    .from('players')
    .insert({
      name: input.name.trim(),
      birth_date: input.birth_date,
      team_id: input.team_id,
      owner_id: ownerId,
    } as never)
    .select('id, name, birth_date')
    .single();
  if (error) {
    console.error('[season-transition] falha ao criar jogador', error);
    throw new Error(error.message);
  }
  return data as { id: string; name: string; birth_date: string | null };
}
