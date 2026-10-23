/**
 * Transition of players (FPF certification, criterion 4.3) and the club's internal training actions
 * for its coaches (criterion 4.1). Pure helpers, shared by the screens, the dossier and its PDF.
 */
import { tx } from '@/lib/i18n/ui';

export type TransitionKind = 'training' | 'match' | 'trial' | 'promotion';
export const TRANSITION_KINDS: { value: TransitionKind; readonly label: string }[] = [
  { value: 'training', get label() { return tx('Treinou noutro escalão'); } },
  { value: 'match', get label() { return tx('Jogou noutro escalão'); } },
  { value: 'trial', get label() { return tx('Período de observação'); } },
  { value: 'promotion', get label() { return tx('Subiu de escalão'); } },
];
export const transitionKindLabel = (k: string) => TRANSITION_KINDS.find((x) => x.value === k)?.label ?? k;

export interface PlayerTransition {
  id: string;
  player_id: string;
  team_id: string;
  to_team_id: string | null;
  to_team_name: string | null;
  kind: TransitionKind;
  event_date: string;
  note: string | null;
  evaluation: string | null;
}

/** Where the player went: the club's team name, else the name written. */
export const transitionTarget = (t: Pick<PlayerTransition, 'to_team_id' | 'to_team_name'>, teamName: (id: string) => string | undefined) =>
  (t.to_team_id && teamName(t.to_team_id)) || t.to_team_name || '—';

/** In the season's dates (inclusive). */
export const inSeason = (date: string, season: { start_date: string; end_date: string }) =>
  date >= season.start_date.slice(0, 10) && date <= season.end_date.slice(0, 10);

/** Players with at least one record, and records still without the evaluation of how it went. */
export function transitionStats(list: Pick<PlayerTransition, 'player_id' | 'evaluation'>[]) {
  return {
    records: list.length,
    players: new Set(list.map((t) => t.player_id)).size,
    withoutEvaluation: list.filter((t) => !t.evaluation?.trim()).length,
  };
}

export type ActionKind = 'course' | 'meeting' | 'observation' | 'external';
export const ACTION_KINDS: { value: ActionKind; readonly label: string }[] = [
  { value: 'course', get label() { return tx('Ação de formação interna'); } },
  { value: 'meeting', get label() { return tx('Reunião técnica'); } },
  { value: 'observation', get label() { return tx('Observação de treinos'); } },
  { value: 'external', get label() { return tx('Formação externa'); } },
];
export const actionKindLabel = (k: string) => ACTION_KINDS.find((x) => x.value === k)?.label ?? k;

export interface TrainingAction {
  id: string;
  club_id: string | null;
  owner_id: string | null;
  title: string;
  kind: ActionKind;
  action_date: string;
  duration_minutes: number | null;
  trainer: string | null;
  topics: string | null;
  attendees: string | null;
  all_staff: boolean;
  notes: string | null;
}

/** The FPF asks for a training action with all the coaching staffs: is there one in the season? */
export function actionStats(list: Pick<TrainingAction, 'kind' | 'all_staff' | 'duration_minutes'>[]) {
  return {
    total: list.length,
    withAllStaff: list.filter((a) => a.all_staff).length,
    minutes: list.reduce((s, a) => s + (a.duration_minutes ?? 0), 0),
  };
}

/** "2 h 30" / "45 min" */
export function durationLabel(minutes: number | null | undefined): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
}
