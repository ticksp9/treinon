/**
 * Central Match Rules Service
 * 
 * Single source of truth for sport rules configuration.
 * Queries match_rule_profiles from the database and provides
 * fallback to hardcoded SPORT_FORMAT_RULES for offline/legacy support.
 */

import { supabase } from '@/integrations/supabase/client';
import { SPORT_FORMAT_RULES, getSportFormatRules } from './match-playing-time';

export interface MatchRuleProfile {
  id: string;
  club_id: string | null;
  modality_code: string;
  age_group_code: string | null;
  competition_name: string | null;
  name: string;
  period_count: number;
  period_1_minutes: number;
  period_2_minutes: number;
  period_3_minutes: number | null;
  period_4_minutes: number | null;
  halftime_minutes: number;
  max_players_on_field: number;
  reentry_allowed: boolean;
  rolling_substitutions: boolean;
  is_system_default: boolean;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
}

export interface MatchRuleSnapshot {
  modality_code: string;
  age_group_code: string | null;
  period_count: number;
  period_1_minutes: number;
  period_2_minutes: number;
  period_3_minutes: number | null;
  period_4_minutes: number | null;
  halftime_minutes: number;
  max_players_on_field: number;
  reentry_allowed: boolean;
  rolling_substitutions: boolean;
  rule_profile_id: string | null;
  rule_profile_name: string | null;
}

/**
 * Map age group category strings to normalized codes used in match_rule_profiles.
 */
const CATEGORY_TO_AGE_GROUP: Record<string, string> = {
  'petizes': 'petizes',
  'traquinas': 'traquinas',
  'benjamins': 'benjamins',
  'infantis': 'infantis',
  'iniciados': 'iniciados',
  'juvenis': 'juvenis',
  'juniores': 'juniores',
  'seniores': 'seniores',
  // Common aliases
  'sub-7': 'petizes',
  'sub-8': 'traquinas',
  'sub-9': 'traquinas',
  'sub-10': 'benjamins',
  'sub-11': 'benjamins',
  'sub-12': 'infantis',
  'sub-13': 'infantis',
  'sub-14': 'iniciados',
  'sub-15': 'iniciados',
  'sub-16': 'juvenis',
  'sub-17': 'juvenis',
  'sub-18': 'juniores',
  'sub-19': 'juniores',
};

export function normalizeAgeGroupCode(category: string | null | undefined): string | null {
  if (!category) return null;
  const lower = category.toLowerCase().trim();
  return CATEGORY_TO_AGE_GROUP[lower] || lower;
}

/**
 * Get the best matching rule profile for a given modality + age group + competition.
 * Priority: club competition override > club profile > system default.
 */
export async function getDefaultRuleProfile(
  modalityCode: string,
  ageGroupCode: string | null,
  clubId: string | null,
  competitionName?: string | null
): Promise<MatchRuleProfile | null> {
  let query = supabase
    .from('match_rule_profiles')
    .select('*')
    .eq('modality_code', modalityCode)
    .eq('is_active', true)
    .order('is_system_default', { ascending: true }); // club profiles first

  if (ageGroupCode) {
    query = query.eq('age_group_code', ageGroupCode);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  // Priority resolution
  // 1. Club + competition match
  if (clubId && competitionName) {
    const clubComp = data.find(
      r => r.club_id === clubId && r.competition_name === competitionName
    );
    if (clubComp) return clubComp as MatchRuleProfile;
  }

  // 2. Club profile (no competition)
  if (clubId) {
    const clubDefault = data.find(
      r => r.club_id === clubId && !r.competition_name
    );
    if (clubDefault) return clubDefault as MatchRuleProfile;
  }

  // 3. System default
  const systemDefault = data.find(r => r.is_system_default);
  return (systemDefault as MatchRuleProfile) || (data[0] as MatchRuleProfile);
}

/**
 * Build a snapshot object from a rule profile.
 */
export function buildSnapshotFromProfile(profile: MatchRuleProfile): MatchRuleSnapshot {
  return {
    modality_code: profile.modality_code,
    age_group_code: profile.age_group_code,
    period_count: profile.period_count,
    period_1_minutes: profile.period_1_minutes,
    period_2_minutes: profile.period_2_minutes,
    period_3_minutes: profile.period_3_minutes,
    period_4_minutes: profile.period_4_minutes,
    halftime_minutes: profile.halftime_minutes,
    max_players_on_field: profile.max_players_on_field,
    reentry_allowed: profile.reentry_allowed,
    rolling_substitutions: profile.rolling_substitutions,
    rule_profile_id: profile.id,
    rule_profile_name: profile.name,
  };
}

/**
 * Build a snapshot from the hardcoded fallback rules (for offline/legacy).
 */
export function buildSnapshotFromFallback(
  modalityCode: string,
  partDuration: number = 45,
  partsCount: number = 2
): MatchRuleSnapshot {
  const rules = getSportFormatRules(modalityCode);
  return {
    modality_code: modalityCode,
    age_group_code: null,
    period_count: partsCount,
    period_1_minutes: partDuration,
    period_2_minutes: partsCount >= 2 ? partDuration : 0,
    period_3_minutes: partsCount >= 3 ? partDuration : null,
    period_4_minutes: partsCount >= 4 ? partDuration : null,
    halftime_minutes: 10,
    max_players_on_field: rules.playersOnField,
    reentry_allowed: rules.reentryAllowed,
    rolling_substitutions: rules.rollingSubstitutions,
    rule_profile_id: null,
    rule_profile_name: null,
  };
}

/**
 * Save a rule snapshot for a match (upsert).
 */
export async function saveMatchRuleSnapshot(
  matchId: string,
  snapshot: MatchRuleSnapshot,
  ruleProfileId?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('match_rule_snapshots')
    .upsert({
      match_id: matchId,
      rule_profile_id: ruleProfileId || null,
      modality_code: snapshot.modality_code,
      age_group_code: snapshot.age_group_code,
      snapshot_data: snapshot as any,
    }, { onConflict: 'match_id' });

  if (error) {
    console.error('Failed to save match rule snapshot:', error);
  }
}

/**
 * Get the rule snapshot for a match (if exists).
 */
export async function getMatchRuleSnapshot(
  matchId: string
): Promise<MatchRuleSnapshot | null> {
  const { data, error } = await supabase
    .from('match_rule_snapshots')
    .select('snapshot_data')
    .eq('match_id', matchId)
    .maybeSingle();

  if (error || !data) return null;
  return data.snapshot_data as unknown as MatchRuleSnapshot;
}

/**
 * Compute total expected match minutes from a snapshot.
 */
export function getTotalMinutesFromSnapshot(snapshot: MatchRuleSnapshot): number {
  let total = snapshot.period_1_minutes + (snapshot.period_2_minutes || 0);
  if (snapshot.period_3_minutes) total += snapshot.period_3_minutes;
  if (snapshot.period_4_minutes) total += snapshot.period_4_minutes;
  return total;
}

/**
 * Log a rule audit event.
 */
export async function logRuleAudit(params: {
  clubId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorRole?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('match_rule_audit_logs')
    .insert({
      club_id: params.clubId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      actor_id: params.actorId,
      actor_role: params.actorRole,
      old_values: params.oldValues as any,
      new_values: params.newValues as any,
      reason: params.reason,
    });

  if (error) {
    console.error('Failed to log rule audit:', error);
  }
}

/**
 * Log a conflict alert for a match.
 */
export async function logConflictAlert(params: {
  matchId: string;
  alertType: string;
  severity: 'warning' | 'error' | 'blocking';
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase
    .from('match_conflict_alerts')
    .insert({
      match_id: params.matchId,
      alert_type: params.alertType,
      severity: params.severity,
      message: params.message,
      metadata: params.metadata as any,
    });

  if (error) {
    console.error('Failed to log conflict alert:', error);
  }
}

/**
 * Get unresolved conflict alerts for a match.
 */
export async function getMatchConflictAlerts(matchId: string) {
  const { data, error } = await supabase
    .from('match_conflict_alerts')
    .select('*')
    .eq('match_id', matchId)
    .eq('resolved', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch conflict alerts:', error);
    return [];
  }
  return data || [];
}
