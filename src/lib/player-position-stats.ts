/**
 * Estatísticas de posições jogadas por um jogador.
 * Faz as queries em bruto sobre match_player_positions e agrega no cliente.
 */
import { supabase } from '@/integrations/supabase/client';

export interface PositionStatsResult {
  totalMinutes: number;
  byRole: Record<string, number>;
  bySlot: Record<string, number>;
  byFormation: Record<string, number>;
  predominantRole: string | null;
}

function emptyResult(): PositionStatsResult {
  return { totalMinutes: 0, byRole: {}, bySlot: {}, byFormation: {}, predominantRole: null };
}

function logIssue(scope: string, error: unknown) {
  if (import.meta.env.DEV) console.error(`[player-position-stats] ${scope}:`, error);
}

interface RawRow {
  match_id: string;
  formation_id: string | null;
  slot_id: string;
  role: string | null;
  starts_at_minute_abs: number;
  ends_at_minute_abs: number | null;
  season_id: string | null;
}

function aggregate(rows: RawRow[], formationCodeById: Map<string, string>): PositionStatsResult {
  const byRole: Record<string, number> = {};
  const bySlot: Record<string, number> = {};
  const byFormation: Record<string, number> = {};
  let total = 0;

  for (const r of rows) {
    const end = r.ends_at_minute_abs;
    if (end == null) continue; // ignora intervalos em aberto (jogo a decorrer)
    const dur = Math.max(0, end - r.starts_at_minute_abs);
    if (dur <= 0) continue;
    total += dur;
    const role = r.role ?? 'unknown';
    byRole[role] = (byRole[role] ?? 0) + dur;
    bySlot[r.slot_id] = (bySlot[r.slot_id] ?? 0) + dur;
    const fcode = r.formation_id ? formationCodeById.get(r.formation_id) ?? 'unknown' : 'unknown';
    byFormation[fcode] = (byFormation[fcode] ?? 0) + dur;
  }

  let predominantRole: string | null = null;
  let best = 0;
  for (const [k, v] of Object.entries(byRole)) {
    if (v > best) { best = v; predominantRole = k; }
  }

  return { totalMinutes: total, byRole, bySlot, byFormation, predominantRole };
}

async function fetchFormationCodes(rows: RawRow[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(rows.map(r => r.formation_id).filter(Boolean) as string[]));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('match_formations' as any)
    .select('id, formation_code')
    .in('id', ids);
  if (error) { logIssue('fetchFormationCodes', error); return new Map(); }
  const map = new Map<string, string>();
  for (const f of (((data as unknown) as any[]) || [])) map.set(f.id, f.formation_code);
  return map;
}

export async function getPlayerPositionMinutesByMatch(playerId: string, matchId: string): Promise<PositionStatsResult> {
  const { data, error } = await supabase
    .from('match_player_positions' as any)
    .select('match_id, formation_id, slot_id, role, starts_at_minute_abs, ends_at_minute_abs, season_id')
    .eq('player_id', playerId)
    .eq('match_id', matchId);
  if (error) { logIssue('positions query', error); return emptyResult(); }
  const rows = (((data as unknown) as RawRow[]) || []);
  const codes = await fetchFormationCodes(rows);
  return aggregate(rows, codes);
}

export async function getPlayerPositionMinutesBySeason(playerId: string, seasonId: string): Promise<PositionStatsResult> {
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id')
    .eq('season_id', seasonId)
    .eq('is_deleted', false);
  if (matchesError) { logIssue('season matches query', matchesError); return emptyResult(); }
  const matchIds = (matches || []).map((match) => match.id);
  if (matchIds.length === 0) return emptyResult();

  const { data, error } = await supabase
    .from('match_player_positions' as any)
    .select('match_id, formation_id, slot_id, role, starts_at_minute_abs, ends_at_minute_abs, season_id')
    .eq('player_id', playerId)
    .in('match_id', matchIds);
  if (error) { logIssue('positions query', error); return emptyResult(); }
  const rows = (((data as unknown) as RawRow[]) || []);
  const codes = await fetchFormationCodes(rows);
  return aggregate(rows, codes);
}

export async function getPlayerPositionMinutesAllTime(playerId: string): Promise<PositionStatsResult> {
  const { data, error } = await supabase
    .from('match_player_positions' as any)
    .select('match_id, formation_id, slot_id, role, starts_at_minute_abs, ends_at_minute_abs, season_id')
    .eq('player_id', playerId);
  if (error) { logIssue('positions query', error); return emptyResult(); }
  const rows = (((data as unknown) as RawRow[]) || []);
  const codes = await fetchFormationCodes(rows);
  return aggregate(rows, codes);
}
