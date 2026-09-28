// Engine único de disponibilidade médica para convocatória.
// Decide se um jogador pode ser convocado e que restrições aplicar,
// com base nos registos de `player_injuries` (estado clínico + can_play + datas).

export type ClinicalStatus =
  | 'apto'
  | 'inapto'
  | 'condicionado'
  | 'em_recuperacao'
  | 'retorno_progressivo';

export interface InjuryRecord {
  id: string;
  player_id: string;
  injury_date: string;
  return_date: string | null;
  expected_return_date: string | null;
  clinical_status: ClinicalStatus | string;
  can_play: boolean;
  restrictions: string | null;
  severity?: string | null;
}

export const CLINICAL_STATUS_OPTIONS: { value: ClinicalStatus; label: string; tone: string }[] = [
  { value: 'apto', label: 'Apto', tone: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  { value: 'inapto', label: 'Inapto', tone: 'bg-red-500/10 text-red-600 border-red-500/30' },
  { value: 'condicionado', label: 'Condicionado', tone: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  { value: 'em_recuperacao', label: 'Em Recuperação', tone: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  { value: 'retorno_progressivo', label: 'Retorno Progressivo', tone: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
];

export interface AvailabilityResult {
  callable: boolean;
  status: ClinicalStatus | 'apto';
  reason?: string;
  restrictions?: string | null;
  /** indica que o jogador termina recuperação mas precisa validação clínica (não auto-libera) */
  needsClearance: boolean;
  blockingInjuryId?: string;
}

/**
 * Lesão é considerada "ativa" enquanto:
 * - não houver return_date (alta efetiva), OU
 * - o estado clínico não for 'apto'.
 * O fim de expected_return_date NUNCA liberta automaticamente.
 */
export function isInjuryActive(inj: InjuryRecord): boolean {
  if (inj.clinical_status === 'apto' && inj.return_date) return false;
  if (inj.return_date) return false; // alta clínica registada
  return true;
}

/** Determina disponibilidade a partir do conjunto de lesões do jogador. */
export function computeAvailability(
  injuries: InjuryRecord[],
  today: Date = new Date(),
): AvailabilityResult {
  const active = injuries.filter(isInjuryActive);
  if (active.length === 0) {
    return { callable: true, status: 'apto', needsClearance: false };
  }

  // Prioridade: inapto > em_recuperacao > condicionado > retorno_progressivo
  const priority: Record<string, number> = {
    inapto: 4, em_recuperacao: 3, condicionado: 2, retorno_progressivo: 1, apto: 0,
  };
  const worst = [...active].sort(
    (a, b) => (priority[b.clinical_status] ?? 0) - (priority[a.clinical_status] ?? 0),
  )[0];

  const status = (worst.clinical_status as ClinicalStatus) || 'inapto';
  const todayStr = today.toISOString().slice(0, 10);
  const expectedDate = worst.expected_return_date;

  // Regra crítica: end-of-recovery sem alta NÃO liberta.
  const recoveryEnded =
    expectedDate != null && expectedDate <= todayStr && !worst.return_date;

  if (status === 'inapto' || status === 'em_recuperacao' || worst.can_play === false) {
    return {
      callable: false,
      status,
      reason: status === 'em_recuperacao'
        ? 'Em recuperação clínica'
        : 'Inapto clinicamente',
      restrictions: worst.restrictions,
      needsClearance: recoveryEnded,
      blockingInjuryId: worst.id,
    };
  }

  // condicionado / retorno_progressivo: convocável com restrição visível
  return {
    callable: true,
    status,
    reason: status === 'retorno_progressivo'
      ? 'Apto com restrição (retorno progressivo)'
      : 'Apto condicionado',
    restrictions: worst.restrictions,
    needsClearance: recoveryEnded,
    blockingInjuryId: worst.id,
  };
}

export function getClinicalStatusOption(value: string) {
  return CLINICAL_STATUS_OPTIONS.find((s) => s.value === value);
}
