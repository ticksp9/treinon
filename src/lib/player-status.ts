export type PlayerStatusValue = 'active' | 'injured' | 'suspended' | 'loan' | 'inactive' | 'away';

export interface DerivedStatusInput {
  is_active: boolean;
  status?: string | null;
  hasActiveInjury?: boolean;
  hasActiveSuspension?: boolean;
  isOnLoan?: boolean;
}

/**
 * Computes a real-time player availability status from explicit field +
 * runtime signals (active injuries / suspensions / loans).
 * Explicit non-default status wins over derivations.
 */
export function deriveStatus(input: DerivedStatusInput): PlayerStatusValue {
  if (!input.is_active) return 'inactive';
  if (input.status && input.status !== 'active') {
    return input.status as PlayerStatusValue;
  }
  if (input.hasActiveInjury) return 'injured';
  if (input.hasActiveSuspension) return 'suspended';
  if (input.isOnLoan) return 'loan';
  return 'active';
}
