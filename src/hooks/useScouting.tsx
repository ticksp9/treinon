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
  initial_observation: 'Observação Inicial',
  active_monitoring: 'Monitorização Ativa',
  formal_assessment: 'Avaliação Formal',
  watchlist: 'Watchlist',
  shortlist: 'Shortlist',
  coordinator_validation: 'Validação Coordenador',
  technical_validation: 'Validação Dir. Técnica',
  exploratory_contact: 'Contacto Exploratório',
  trial_scheduled: 'Trial Agendado',
  due_diligence: 'Due Diligence',
  final_decision: 'Decisão Final',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  deferred: 'Adiado',
  archived: 'Arquivado',
};

export const RECOMMENDATION_OPTIONS = [
  { value: 'sign', label: 'Recrutar' },
  { value: 'shortlist', label: 'Shortlist' },
  { value: 'monitor', label: 'Monitorizar' },
  { value: 'trial', label: 'Trial' },
  { value: 'reject', label: 'Rejeitar' },
] as const;

export const OBSERVATION_TYPES = [
  { value: 'match', label: 'Jogo' },
  { value: 'training', label: 'Treino' },
  { value: 'tournament', label: 'Torneio' },
  { value: 'video', label: 'Vídeo' },
  { value: 'trial', label: 'Trial' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'other', label: 'Outro' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Crítica', color: 'text-red-600' },
  { value: 'high', label: 'Alta', color: 'text-orange-600' },
  { value: 'medium', label: 'Média', color: 'text-yellow-600' },
  { value: 'low', label: 'Baixa', color: 'text-muted-foreground' },
] as const;

export const SOURCE_OPTIONS = [
  { value: 'match_observation', label: 'Observação em Jogo' },
  { value: 'training_observation', label: 'Observação em Treino' },
  { value: 'tournament', label: 'Torneio' },
  { value: 'coach_recommendation', label: 'Recomendação de Treinador' },
  { value: 'scout_recommendation', label: 'Recomendação de Scout' },
  { value: 'internal_referral', label: 'Indicação Interna' },
  { value: 'partner_academy', label: 'Academia Parceira' },
  { value: 'video', label: 'Vídeo' },
  { value: 'school', label: 'Escola' },
  { value: 'grassroots', label: 'Grassroots' },
  { value: 'other', label: 'Outro' },
] as const;

export const ASSESSMENT_DIMENSIONS = [
  { key: 'technical', label: 'Técnica', weight: 1.5 },
  { key: 'tactical', label: 'Tática', weight: 1.2 },
  { key: 'physical', label: 'Física', weight: 1.0 },
  { key: 'mental', label: 'Mental', weight: 1.0 },
  { key: 'behavioral', label: 'Comportamental', weight: 0.8 },
  { key: 'competitive', label: 'Competitiva', weight: 1.0 },
  { key: 'potential', label: 'Potencial', weight: 1.5 },
  { key: 'club_fit', label: 'Fit com Clube', weight: 1.0 },
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
    const pos = p.primary_position || 'Sem posição';
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
