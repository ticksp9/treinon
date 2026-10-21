import { tx } from '@/lib/i18n/ui';
// Scouting & Talent Pipeline – pure business logic + data hooks

// ─── Types ───────────────────────────────────────────────────────
export interface ProspectSummary {
  id: string;
  pipeline_status: string;
  primary_position: string | null;
  priority: string | null;
  status: string;
  birth_quarter: number | null;
  is_late_developer: boolean;
  confidence_score: number | null;
}

export interface ObservationSummary {
  id: string;
  prospect_id: string;
  scout_user_id: string | null;
  recommendation: string | null;
  observation_date: string;
}

export interface ReportScore {
  dimension: string;
  score: number | null;
  max_score: number;
  weight: number;
}

export interface PipelineEntry {
  prospect_id: string;
  current_stage: string;
  stage_entered_at: string;
}

export interface TrialSummary {
  id: string;
  prospect_id: string;
  status: string;
  outcome: string | null;
}

// ─── Pipeline stages ────────────────────────────────────────────
export const PIPELINE_STAGES = [
  'identified',
  'initial_observation',
  'active_monitoring',
  'formal_assessment',
  'watchlist',
  'shortlist',
  'coordinator_validation',
  'technical_validation',
  'exploratory_contact',
  'trial_scheduled',
  'due_diligence',
  'final_decision',
  'approved',
  'rejected',
  'deferred',
  'archived',
] as const;

export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  identified: 'Identificado',
  get initial_observation() { return tx('Observação Inicial'); },
  get active_monitoring() { return tx('Monitorização Ativa'); },
  get formal_assessment() { return tx('Avaliação Formal'); },
  watchlist: 'Watchlist',
  shortlist: 'Shortlist',
  get coordinator_validation() { return tx('Validação Coordenador'); },
  get technical_validation() { return tx('Validação Dir. Técnica'); },
  get exploratory_contact() { return tx('Contacto Exploratório'); },
  trial_scheduled: 'Trial Agendado',
  due_diligence: 'Due Diligence',
  get final_decision() { return tx('Decisão Final'); },
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  deferred: 'Adiado',
  archived: 'Arquivado',
};

export const RECOMMENDATION_OPTIONS = [
  { value: 'sign', get label() { return tx('Recrutar'); } },
  { value: 'shortlist', get label() { return tx('Shortlist'); } },
  { value: 'monitor', get label() { return tx('Monitorizar'); } },
  { value: 'trial', get label() { return tx('Trial'); } },
  { value: 'reject', get label() { return tx('Rejeitar'); } },
] as const;

export const OBSERVATION_TYPES = [
  { value: 'match', get label() { return tx('Jogo'); } },
  { value: 'training', get label() { return tx('Treino'); } },
  { value: 'tournament', get label() { return tx('Torneio'); } },
  { value: 'video', get label() { return tx('Vídeo'); } },
  { value: 'trial', get label() { return tx('Trial'); } },
  { value: 'showcase', get label() { return tx('Showcase'); } },
  { value: 'other', get label() { return tx('Outro'); } },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'critical', get label() { return tx('Crítica'); }, color: 'text-red-600' },
  { value: 'high', get label() { return tx('Alta'); }, color: 'text-orange-600' },
  { value: 'medium', get label() { return tx('Média'); }, color: 'text-yellow-600' },
  { value: 'low', get label() { return tx('Baixa'); }, color: 'text-muted-foreground' },
] as const;

export const SOURCE_OPTIONS = [
  { value: 'match_observation', get label() { return tx('Observação em Jogo'); } },
  { value: 'training_observation', get label() { return tx('Observação em Treino'); } },
  { value: 'tournament', get label() { return tx('Torneio'); } },
  { value: 'coach_recommendation', get label() { return tx('Recomendação de Treinador'); } },
  { value: 'scout_recommendation', get label() { return tx('Recomendação de Scout'); } },
  { value: 'internal_referral', get label() { return tx('Indicação Interna'); } },
  { value: 'partner_academy', get label() { return tx('Academia Parceira'); } },
  { value: 'video', get label() { return tx('Vídeo'); } },
  { value: 'school', get label() { return tx('Escola'); } },
  { value: 'grassroots', get label() { return tx('Grassroots'); } },
  { value: 'other', get label() { return tx('Outro'); } },
] as const;

export const ASSESSMENT_DIMENSIONS = [
  { key: 'technical', get label() { return tx('Técnica'); }, weight: 1.5 },
  { key: 'tactical', get label() { return tx('Tática'); }, weight: 1.2 },
  { key: 'physical', get label() { return tx('Física'); }, weight: 1.0 },
  { key: 'mental', get label() { return tx('Mental'); }, weight: 1.0 },
  { key: 'behavioral', get label() { return tx('Comportamental'); }, weight: 0.8 },
  { key: 'competitive', get label() { return tx('Competitiva'); }, weight: 1.0 },
  { key: 'potential', get label() { return tx('Potencial'); }, weight: 1.5 },
  { key: 'club_fit', get label() { return tx('Fit com Clube'); }, weight: 1.0 },
] as const;

// ─── Pure business functions ─────────────────────────────────────

export function computeWeightedScoutingScore(scores: ReportScore[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of scores) {
    if (s.score == null || s.max_score === 0) continue;
    weightedSum += (s.score / s.max_score) * s.weight;
    totalWeight += s.weight;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

export function computePipelineDistribution(entries: PipelineEntry[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const e of entries) {
    dist[e.current_stage] = (dist[e.current_stage] || 0) + 1;
  }
  return dist;
}

export function computeProspectsByPosition(prospects: ProspectSummary[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const p of prospects) {
    const pos = p.primary_position || tx('Sem posição');
    dist[pos] = (dist[pos] || 0) + 1;
  }
  return dist;
}

export function computeProspectsByPriority(prospects: ProspectSummary[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const p of prospects) {
    const pri = p.priority || 'medium';
    dist[pri] = (dist[pri] || 0) + 1;
  }
  return dist;
}

export function computeObservationsPerScout(observations: ObservationSummary[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const o of observations) {
    const key = o.scout_user_id || 'unknown';
    dist[key] = (dist[key] || 0) + 1;
  }
  return dist;
}

export function computeConversionRate(
  prospects: ProspectSummary[],
  targetStatuses: string[] = ['approved']
): number {
  if (prospects.length === 0) return 0;
  const converted = prospects.filter(p => targetStatuses.includes(p.pipeline_status));
  return Math.round((converted.length / prospects.length) * 100);
}

export function computeTrialApprovalRate(trials: TrialSummary[]): number {
  const completed = trials.filter(t => t.status === 'completed');
  if (completed.length === 0) return 0;
  const approved = completed.filter(t => t.outcome === 'approved');
  return Math.round((approved.length / completed.length) * 100);
}

export function computeBirthQuarterDistribution(prospects: ProspectSummary[]): Record<string, number> {
  const dist: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, unknown: 0 };
  for (const p of prospects) {
    if (!p.birth_quarter || p.birth_quarter < 1 || p.birth_quarter > 4) {
      dist.unknown++;
    } else {
      dist[`Q${p.birth_quarter}`]++;
    }
  }
  return dist;
}

export function computePerformancePotentialMatrix(
  prospects: { prospect_id: string; performance: number; potential: number }[]
): { highHigh: number; highMod: number; modHigh: number; lowHigh: number; other: number } {
  let highHigh = 0, highMod = 0, modHigh = 0, lowHigh = 0, other = 0;
  for (const p of prospects) {
    const perf = p.performance;
    const pot = p.potential;
    if (perf >= 70 && pot >= 70) highHigh++;
    else if (perf >= 70 && pot >= 40) highMod++;
    else if (perf >= 40 && pot >= 70) modHigh++;
    else if (perf < 40 && pot >= 70) lowHigh++;
    else other++;
  }
  return { highHigh, highMod, modHigh, lowHigh, other };
}

export function countLateDevs(prospects: ProspectSummary[]): number {
  return prospects.filter(p => p.is_late_developer).length;
}
