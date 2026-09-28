// Pure helpers for player evaluations: filtering, aggregation, derived insights.
// Keep DB calls in the hooks; this module is testable in isolation.

import {
  ATTRIBUTE_CATALOG,
  type AttributeCategory,
  type AttributeScores,
  categoryAverage,
  overallAverage,
} from './player-attributes';

export type EvaluationType = 'training' | 'match' | 'period' | 'assessment' | 'other';

export interface EvaluationRow {
  id: string;
  evaluation_date: string;
  context: string | null;
  attributes: AttributeScores | null;
  technical_rating?: number | null;
  tactical_rating?: number | null;
  physical_rating?: number | null;
  mental_rating?: number | null;
  overall_rating?: number | null;
  strengths?: string | null;
  strengths_text?: string | null;
  weaknesses?: string | null;
  improvement_text?: string | null;
  recommendation?: string | null;
  notes?: string | null;
  evaluator_id?: string | null;
  season_label?: string | null;
}

export function filterByType(rows: EvaluationRow[], type: EvaluationType | 'all'): EvaluationRow[] {
  if (type === 'all') return rows;
  return rows.filter((r) => (r.context || 'other') === type);
}

export function filterBySeason(rows: EvaluationRow[], season: string | null | 'all'): EvaluationRow[] {
  if (!season || season === 'all') return rows;
  return rows.filter((r) => (r.season_label || '') === season);
}

/** Mean of overall scores (1-10). null when empty. */
export function averageOverall(rows: EvaluationRow[]): number | null {
  const values: number[] = [];
  for (const r of rows) {
    const v = r.attributes
      ? overallAverage(r.attributes)
      : r.overall_rating ?? null;
    if (typeof v === 'number') values.push(v);
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Per-category mean across rows. */
export function averageByCategory(
  rows: EvaluationRow[],
  category: AttributeCategory,
): number | null {
  const values: number[] = [];
  for (const r of rows) {
    const v = r.attributes
      ? categoryAverage(r.attributes, category)
      : (r as any)[`${category}_rating`] ?? null;
    if (typeof v === 'number') values.push(v);
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Top N attributes from the most recent evaluation that has attributes. */
export function deriveStrengthsFromLatest(
  rows: EvaluationRow[],
  limit = 3,
): Array<{ category: AttributeCategory; key: string; label: string; value: number }> {
  const latest = rows.find((r) => r.attributes && Object.keys(r.attributes).length > 0);
  if (!latest?.attributes) return [];
  return rankAttributes(latest.attributes, 'desc').slice(0, limit);
}

/** Bottom N attributes from the most recent evaluation. */
export function deriveImprovementsFromLatest(
  rows: EvaluationRow[],
  limit = 3,
): Array<{ category: AttributeCategory; key: string; label: string; value: number }> {
  const latest = rows.find((r) => r.attributes && Object.keys(r.attributes).length > 0);
  if (!latest?.attributes) return [];
  return rankAttributes(latest.attributes, 'asc').slice(0, limit);
}

function rankAttributes(scores: AttributeScores, dir: 'asc' | 'desc') {
  const out: Array<{ category: AttributeCategory; key: string; label: string; value: number }> = [];
  for (const cat of ATTRIBUTE_CATALOG) {
    const bag = scores[cat.key];
    if (!bag) continue;
    for (const a of cat.attributes) {
      const v = bag[a.key];
      if (typeof v === 'number') out.push({ category: cat.key, key: a.key, label: a.label, value: v });
    }
  }
  out.sort((a, b) => (dir === 'desc' ? b.value - a.value : a.value - b.value));
  return out;
}

export function evaluatorLabel(row: EvaluationRow, fallback = 'Avaliador'): string {
  return row.evaluator_id ? fallback : 'Sem avaliador';
}
