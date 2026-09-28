/**
 * Substitution batch (draft) service.
 *
 * Centralises the logic for preparing several substitutions in a single
 * transactional step before persisting them. The flow is:
 *
 *   1. createSubstitutionDraft  → opens a fresh draft
 *   2. addPendingSubstitution   → user picks "out" + "in"
 *   3. removePendingSubstitution / updatePendingSubstitution
 *   4. validateSubstitutionBatch → verifies the whole batch is coherent
 *   5. commitSubstitutionBatch (consumer-side) writes everything atomically
 *      OR cancelSubstitutionBatch throws the draft away.
 *
 * Nothing in this file touches Supabase directly. Persistence belongs to
 * the consumer (LiveMatch / PostGameStepper) so we can reuse the same
 * validation rules everywhere.
 */

import {
  validateSubstitutionAttempt,
  type MatchEventForCalc,
} from './match-playing-time';

export type MatchPart = '1H' | '2H' | 'ET1' | 'ET2';

export interface PendingSubstitution {
  tempId: string;
  minute: number;
  period?: MatchPart;
  playerOutId: string;
  playerInId: string;
  teamId?: string;
  /** Optional destination slot for tactical persistence. */
  slotId?: string;
  /** Optional canonical role for the destination slot. */
  role?: string;
}

export interface SubstitutionBatchDraft {
  batchId: string;
  matchId: string;
  createdAt: string;
  substitutions: PendingSubstitution[];
}

export interface SubstitutionBatchValidationIssue {
  tempId?: string;
  message: string;
}

export interface SubstitutionBatchValidationResult {
  valid: boolean;
  issues: SubstitutionBatchValidationIssue[];
  /** projected on-field player ids after applying the whole batch in order */
  projectedOnField: string[];
}

let counter = 0;
function genId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createSubstitutionDraft(matchId: string): SubstitutionBatchDraft {
  return {
    batchId: genId('batch'),
    matchId,
    createdAt: new Date().toISOString(),
    substitutions: [],
  };
}

export function addPendingSubstitution(
  draft: SubstitutionBatchDraft,
  pending: Omit<PendingSubstitution, 'tempId'> & { tempId?: string },
): SubstitutionBatchDraft {
  return {
    ...draft,
    substitutions: [
      ...draft.substitutions,
      { ...pending, tempId: pending.tempId ?? genId('sub') },
    ],
  };
}

export function updatePendingSubstitution(
  draft: SubstitutionBatchDraft,
  tempId: string,
  patch: Partial<Omit<PendingSubstitution, 'tempId'>>,
): SubstitutionBatchDraft {
  return {
    ...draft,
    substitutions: draft.substitutions.map(s =>
      s.tempId === tempId ? { ...s, ...patch } : s,
    ),
  };
}

export function removePendingSubstitution(
  draft: SubstitutionBatchDraft,
  tempId: string,
): SubstitutionBatchDraft {
  return {
    ...draft,
    substitutions: draft.substitutions.filter(s => s.tempId !== tempId),
  };
}

export function cancelSubstitutionBatch(): null {
  return null;
}

export interface ValidateBatchInput {
  draft: SubstitutionBatchDraft;
  currentOnFieldIds: string[];
  events: MatchEventForCalc[];
  sportType: string | null | undefined;
  maxOnField: number;
}

/**
 * Validate the batch as a single transaction.
 *
 * Each pending substitution is checked against the *projected* state of
 * the field after the previous pending substitutions, so chained moves
 * inside the same batch are allowed (out → in → out → in …).
 */
export function validateSubstitutionBatch({
  draft,
  currentOnFieldIds,
  events,
  sportType,
  maxOnField,
}: ValidateBatchInput): SubstitutionBatchValidationResult {
  const issues: SubstitutionBatchValidationIssue[] = [];

  if (draft.substitutions.length === 0) {
    return {
      valid: false,
      issues: [{ message: 'Adicione pelo menos uma substituição antes de confirmar.' }],
      projectedOnField: [...currentOnFieldIds],
    };
  }

  const projected = new Set(currentOnFieldIds);
  // We accumulate synthetic events so the per-step validator (which
  // checks reentry rules) sees the previous batched moves.
  const projectedEvents: MatchEventForCalc[] = [...events];

  const seenOuts = new Set<string>();
  const seenIns = new Set<string>();

  for (const pending of draft.substitutions) {
    if (!pending.playerOutId || !pending.playerInId) {
      issues.push({
        tempId: pending.tempId,
        message: 'Linha incompleta: indique quem sai e quem entra.',
      });
      continue;
    }

    if (pending.playerOutId === pending.playerInId) {
      issues.push({
        tempId: pending.tempId,
        message: 'Não é permitido sair e entrar com o mesmo jogador.',
      });
      continue;
    }

    if (seenOuts.has(pending.playerOutId)) {
      issues.push({
        tempId: pending.tempId,
        message: 'O mesmo jogador não pode sair duas vezes neste lote.',
      });
      continue;
    }

    if (seenIns.has(pending.playerInId)) {
      issues.push({
        tempId: pending.tempId,
        message: 'O mesmo jogador não pode entrar duas vezes neste lote.',
      });
      continue;
    }

    const stepValidation = validateSubstitutionAttempt({
      playerOutId: pending.playerOutId,
      playerInId: pending.playerInId,
      currentOnFieldIds: Array.from(projected),
      events: projectedEvents,
      sportType,
    });

    if (!stepValidation.allowed) {
      issues.push({
        tempId: pending.tempId,
        message: stepValidation.reason ?? 'Substituição inválida.',
      });
      continue;
    }

    seenOuts.add(pending.playerOutId);
    seenIns.add(pending.playerInId);
    projected.delete(pending.playerOutId);
    projected.add(pending.playerInId);
    projectedEvents.push(
      {
        event_type: 'substitution_out',
        minute: pending.minute,
        player_id: pending.playerOutId,
        is_opponent: false,
      },
      {
        event_type: 'substitution_in',
        minute: pending.minute,
        player_id: pending.playerInId,
        is_opponent: false,
      },
    );
  }

  if (projected.size !== maxOnField && projected.size !== currentOnFieldIds.length) {
    issues.push({
      message: `Após o lote a equipa ficaria com ${projected.size} jogadores em campo (esperado ${maxOnField}).`,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    projectedOnField: Array.from(projected),
  };
}
