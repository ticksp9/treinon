import { describe, it, expect } from 'vitest';
import {
  computeWeightedScore,
  computePathwayDistribution,
  computeGoalSummary,
  computeRetentionRate,
  computePromotionRate,
  computeComplianceScore,
  computeAssessmentCompletion,
} from '@/hooks/useAcademy';

describe('computeWeightedScore', () => {
  it('returns 0 for empty scores', () => {
    expect(computeWeightedScore([], [])).toBe(0);
  });

  it('calculates equal-weighted scores', () => {
    const dims = [
      { id: 'd1', name: 'Tech', code: 'TECH', category: 'technical', weight: 1 },
      { id: 'd2', name: 'Tact', code: 'TACT', category: 'tactical', weight: 1 },
    ];
    const scores = [
      { dimension_id: 'd1', score: 8, max_score: 10 },
      { dimension_id: 'd2', score: 6, max_score: 10 },
    ];
    // (0.8*1 + 0.6*1) / 2 * 100 = 70
    expect(computeWeightedScore(scores, dims)).toBe(70);
  });

  it('respects dimension weights', () => {
    const dims = [
      { id: 'd1', name: 'Tech', code: 'TECH', category: 'technical', weight: 3 },
      { id: 'd2', name: 'Phys', code: 'PHYS', category: 'physical', weight: 1 },
    ];
    const scores = [
      { dimension_id: 'd1', score: 10, max_score: 10 },
      { dimension_id: 'd2', score: 5, max_score: 10 },
    ];
    // (1*3 + 0.5*1) / 4 * 100 = 87.5
    expect(computeWeightedScore(scores, dims)).toBe(87.5);
  });

  it('skips null scores', () => {
    const dims = [{ id: 'd1', name: 'T', code: 'T', category: 'technical', weight: 1 }];
    const scores = [{ dimension_id: 'd1', score: null, max_score: 10 }];
    expect(computeWeightedScore(scores, dims)).toBe(0);
  });
});

describe('computePathwayDistribution', () => {
  it('counts by status', () => {
    const profiles = [
      { pathway_status: 'active' },
      { pathway_status: 'active' },
      { pathway_status: 'high_potential' },
      { pathway_status: 'released' },
    ];
    expect(computePathwayDistribution(profiles)).toEqual({
      active: 2,
      high_potential: 1,
      released: 1,
    });
  });
});

describe('computeGoalSummary', () => {
  it('aggregates goal stats', () => {
    const goals = [
      { status: 'open', progress_pct: 0 },
      { status: 'in_progress', progress_pct: 50 },
      { status: 'achieved', progress_pct: 100 },
      { status: 'cancelled', progress_pct: 0 },
    ];
    const s = computeGoalSummary(goals);
    expect(s.total).toBe(4);
    expect(s.open).toBe(1);
    expect(s.in_progress).toBe(1);
    expect(s.achieved).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.avgProgress).toBe(37.5);
  });
});

describe('computeRetentionRate', () => {
  it('returns 100 for all active', () => {
    expect(computeRetentionRate([{ pathway_status: 'active' }, { pathway_status: 'high_potential' }])).toBe(100);
  });

  it('excludes released and archived', () => {
    const profiles = [
      { pathway_status: 'active' },
      { pathway_status: 'released' },
      { pathway_status: 'archived' },
      { pathway_status: 'active' },
    ];
    expect(computeRetentionRate(profiles)).toBe(50);
  });

  it('returns 0 for empty', () => {
    expect(computeRetentionRate([])).toBe(0);
  });
});

describe('computePromotionRate', () => {
  it('calculates promotion percentage', () => {
    const profiles = [
      { pathway_status: 'promoted' },
      { pathway_status: 'active' },
      { pathway_status: 'active' },
      { pathway_status: 'active' },
    ];
    expect(computePromotionRate(profiles)).toBe(25);
  });
});

describe('computeComplianceScore', () => {
  it('returns 100 for all compliant', () => {
    expect(computeComplianceScore([{ status: 'compliant' }, { status: 'compliant' }])).toBe(100);
  });

  it('returns 50 for half compliant', () => {
    expect(computeComplianceScore([{ status: 'compliant' }, { status: 'pending' }])).toBe(50);
  });

  it('returns 100 for empty', () => {
    expect(computeComplianceScore([])).toBe(100);
  });
});

describe('computeAssessmentCompletion', () => {
  it('calculates rate correctly', () => {
    const assessments = [
      { status: 'draft' },
      { status: 'submitted' },
      { status: 'validated' },
      { status: 'published' },
    ];
    const result = computeAssessmentCompletion(assessments);
    expect(result.total).toBe(4);
    expect(result.submitted).toBe(3);
    expect(result.rate).toBe(75);
  });
});
