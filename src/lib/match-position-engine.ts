/**
 * Motor de cálculo de intervalos de posição por jogador.
 *
 * Recebe formações (match_formations) e intervalos brutos (match_player_positions),
 * fecha intervalos abertos no fim do jogo e produz totais por role / slot / formação.
 *
 * Regras:
 * - Cada jogador ocupa exatamente um slot em cada instante em campo.
 * - Mudanças táticas (formation_change, player_move) fecham/abrem intervalos.
 * - Substituição out: fecha intervalo; substituição in: abre intervalo no slot destino.
 * - Nenhum intervalo deve atravessar fronteiras de parte (responsabilidade do gravador).
 */

export interface MatchFormationLite {
  id: string;
  match_id: string;
  formation_code: string;
  formation_name?: string | null;
  sport_type: string;
  starts_at_minute_abs: number;
  ends_at_minute_abs: number | null;
  part_index: number;
}

export interface PlayerPositionInterval {
  playerId: string;
  formationId: string | null;
  slotId: string;
  role: string | null;
  partIndex: number;
  startMinuteAbs: number;
  endMinuteAbs: number | null;
  source: 'initial_lineup' | 'substitution_in' | 'tactical_move' | 'halftime_snapshot' | 'formation_change';
}

export interface PositionEngineInput {
  formations: MatchFormationLite[];
  positionEvents: PlayerPositionInterval[];
  matchEndMinuteAbs: number;
}

export interface PositionEngineWarning {
  type: 'duplicate_slot' | 'unknown_role' | 'no_slot_for_player' | 'negative_duration';
  message: string;
  playerId?: string;
  slotId?: string;
  minute?: number;
}

export interface PositionEngineResult {
  intervalsByPlayer: Map<string, PlayerPositionInterval[]>;
  minutesByPlayerByRole: Map<string, Map<string, number>>;
  minutesByPlayerBySlot: Map<string, Map<string, number>>;
  minutesByPlayerByFormation: Map<string, Map<string, number>>;
  warnings: PositionEngineWarning[];
}

function clampDuration(start: number, end: number): number {
  return Math.max(0, end - start);
}

export function runMatchPositionEngine(input: PositionEngineInput): PositionEngineResult {
  const { formations, positionEvents, matchEndMinuteAbs } = input;
  const warnings: PositionEngineWarning[] = [];
  const formationById = new Map<string, MatchFormationLite>();
  for (const f of formations) formationById.set(f.id, f);

  // Close open intervals at match end and validate
  const intervals: PlayerPositionInterval[] = positionEvents
    .map(ev => ({
      ...ev,
      endMinuteAbs:
        ev.endMinuteAbs == null
          ? matchEndMinuteAbs
          : ev.endMinuteAbs,
    }))
    .filter(ev => {
      const dur = (ev.endMinuteAbs ?? 0) - ev.startMinuteAbs;
      if (dur < 0) {
        warnings.push({
          type: 'negative_duration',
          message: `Intervalo com duração negativa para jogador ${ev.playerId} no slot ${ev.slotId}`,
          playerId: ev.playerId,
          slotId: ev.slotId,
          minute: ev.startMinuteAbs,
        });
        return false;
      }
      return true;
    });

  // Detect two players in the same slot simultaneously
  const bySlot = new Map<string, PlayerPositionInterval[]>();
  for (const iv of intervals) {
    const arr = bySlot.get(iv.slotId) ?? [];
    arr.push(iv);
    bySlot.set(iv.slotId, arr);
  }
  for (const [slotId, arr] of bySlot) {
    arr.sort((a, b) => a.startMinuteAbs - b.startMinuteAbs);
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const cur = arr[i];
      if ((prev.endMinuteAbs ?? 0) > cur.startMinuteAbs && prev.playerId !== cur.playerId) {
        warnings.push({
          type: 'duplicate_slot',
          message: `Slot ${slotId} ocupado simultaneamente por ${prev.playerId} e ${cur.playerId}`,
          slotId,
          minute: cur.startMinuteAbs,
        });
      }
    }
  }

  // Aggregate
  const intervalsByPlayer = new Map<string, PlayerPositionInterval[]>();
  const minutesByPlayerByRole = new Map<string, Map<string, number>>();
  const minutesByPlayerBySlot = new Map<string, Map<string, number>>();
  const minutesByPlayerByFormation = new Map<string, Map<string, number>>();

  for (const iv of intervals) {
    const list = intervalsByPlayer.get(iv.playerId) ?? [];
    list.push(iv);
    intervalsByPlayer.set(iv.playerId, list);

    const dur = clampDuration(iv.startMinuteAbs, iv.endMinuteAbs ?? iv.startMinuteAbs);

    const roleKey = iv.role ?? 'unknown';
    const roleMap = minutesByPlayerByRole.get(iv.playerId) ?? new Map<string, number>();
    roleMap.set(roleKey, (roleMap.get(roleKey) ?? 0) + dur);
    minutesByPlayerByRole.set(iv.playerId, roleMap);

    const slotMap = minutesByPlayerBySlot.get(iv.playerId) ?? new Map<string, number>();
    slotMap.set(iv.slotId, (slotMap.get(iv.slotId) ?? 0) + dur);
    minutesByPlayerBySlot.set(iv.playerId, slotMap);

    const fcode = iv.formationId ? formationById.get(iv.formationId)?.formation_code ?? 'unknown' : 'unknown';
    const fMap = minutesByPlayerByFormation.get(iv.playerId) ?? new Map<string, number>();
    fMap.set(fcode, (fMap.get(fcode) ?? 0) + dur);
    minutesByPlayerByFormation.set(iv.playerId, fMap);
  }

  // Sort each player's intervals chronologically
  for (const list of intervalsByPlayer.values()) {
    list.sort((a, b) => a.startMinuteAbs - b.startMinuteAbs);
  }

  return {
    intervalsByPlayer,
    minutesByPlayerByRole,
    minutesByPlayerBySlot,
    minutesByPlayerByFormation,
    warnings,
  };
}

/**
 * Validador opcional: soma de minutos por role tem de bater certo com os
 * minutos totais em campo do jogador.
 */
export function validatePositionMinutesAgainstOnField(
  result: PositionEngineResult,
  onFieldMinutesByPlayer: Map<string, number>,
  toleranceMinutes = 1,
): { playerId: string; expected: number; actual: number; diff: number }[] {
  const mismatches: { playerId: string; expected: number; actual: number; diff: number }[] = [];
  for (const [playerId, expected] of onFieldMinutesByPlayer) {
    const roleMap = result.minutesByPlayerByRole.get(playerId);
    const actual = roleMap ? Array.from(roleMap.values()).reduce((s, v) => s + v, 0) : 0;
    const diff = actual - expected;
    if (Math.abs(diff) > toleranceMinutes) {
      mismatches.push({ playerId, expected, actual, diff });
    }
  }
  return mismatches;
}

export function predominantRoleByPlayer(result: PositionEngineResult): Map<string, { role: string; minutes: number } | null> {
  const out = new Map<string, { role: string; minutes: number } | null>();
  for (const [playerId, roleMap] of result.minutesByPlayerByRole) {
    let best: { role: string; minutes: number } | null = null;
    for (const [role, minutes] of roleMap) {
      if (!best || minutes > best.minutes) best = { role, minutes };
    }
    out.set(playerId, best);
  }
  return out;
}
