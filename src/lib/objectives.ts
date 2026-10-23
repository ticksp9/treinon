/**
 * Objectives of the training dossier (FPF certification, criterion 4.2): each one says what is wanted,
 * how it is seen (indicator), the target, until when and how it is evaluated; at the end, the result.
 * The same shape for the team and for each player (player_id).
 */
import { tx } from '@/lib/i18n/ui';

export type ObjectiveStatus = 'open' | 'achieved' | 'partial' | 'not_achieved';

export interface DossierObjective {
  id: string;
  team_id: string;
  season_id: string | null;
  player_id: string | null;
  objective: string;
  indicator: string | null;
  target: string | null;
  deadline: string | null;
  evaluation: string | null;
  status: ObjectiveStatus;
  result: string | null;
  sort_order: number;
}

export const OBJECTIVE_STATUS: { value: ObjectiveStatus; readonly label: string; tone: string }[] = [
  { value: 'open', get label() { return tx('Em curso'); }, tone: 'border-sky-500/50 text-sky-700 dark:text-sky-300' },
  { value: 'achieved', get label() { return tx('Atingido'); }, tone: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { value: 'partial', get label() { return tx('Parcialmente'); }, tone: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { value: 'not_achieved', get label() { return tx('Não atingido'); }, tone: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300' },
];
export const objectiveStatusLabel = (s: string) => OBJECTIVE_STATUS.find((o) => o.value === s)?.label ?? s;

export type ObjectiveDraft = Pick<DossierObjective, 'objective' | 'indicator' | 'target' | 'deadline' | 'evaluation' | 'status' | 'result'>;

export const emptyObjective = (): ObjectiveDraft => ({ objective: '', indicator: '', target: '', deadline: '', evaluation: '', status: 'open', result: '' });

/** Trimmed, with empty fields as null (what goes to the database). */
export function cleanObjective(d: ObjectiveDraft): ObjectiveDraft {
  const t = (s: string | null | undefined, max: number) => (s ?? '').trim().slice(0, max) || null;
  return {
    objective: (d.objective ?? '').trim().slice(0, 500),
    indicator: t(d.indicator, 500), target: t(d.target, 300), deadline: t(d.deadline, 10), evaluation: t(d.evaluation, 500),
    status: d.status, result: t(d.result, 2000),
  };
}

/** How many there are, how many already have a verdict, how many were achieved. */
export function objectiveStats(list: Pick<DossierObjective, 'status' | 'indicator' | 'target'>[]) {
  return {
    total: list.length,
    measurable: list.filter((o) => !!o.indicator?.trim() && !!o.target?.trim()).length,
    evaluated: list.filter((o) => o.status !== 'open').length,
    achieved: list.filter((o) => o.status === 'achieved').length,
  };
}

/** Past the deadline and still without a verdict. */
export const objectiveOverdue = (o: Pick<DossierObjective, 'status' | 'deadline'>, today = new Date()) =>
  o.status === 'open' && !!o.deadline && o.deadline < today.toISOString().slice(0, 10);
