import { describe, it, expect } from 'vitest';
import {
  computeWeightedScoutingScore,
  computePipelineDistribution,
  computeProspectsByPosition,
  computeProspectsByPriority,
  computeConversionRate,
  computeTrialApprovalRate,
  computeBirthQuarterDistribution,
  computePerformancePotentialMatrix,
  countLateDevs,
} from '@/hooks/useScouting';

describe('computeWeightedScoutingScore', () => {
  it('returns 0 for empty scores', () => {
    expect(computeWeightedScoutingScore([])).toBe(0);
  });

  it('computes weighted score correctly', () => {
    const scores = [
      { dimension: 'technical', score: 8, max_score: 10, weight: 2 },
      { dimension: 'physical', score: 6, max_score: 10, weight: 1 },
    ];
    // (8/10*2 + 6/10*1) / (2+1) = (1.6+0.6)/3 = 0.7333 * 100 = 73
    expect(computeWeightedScoutingScore(scores)).toBe(73);
  });

  it('skips null scores', () => {
    const scores = [
      { dimension: 'a', score: null, max_score: 10, weight: 1 },
      { dimension: 'b', score: 5, max_score: 10, weight: 1 },
    ];
    expect(computeWeightedScoutingScore(scores)).toBe(50);
  });
});

describe('computePipelineDistribution', () => {
  it('counts stages', () => {
    const entries = [
      { prospect_id: '1', current_stage: 'identified', stage_entered_at: '' },
      { prospect_id: '2', current_stage: 'identified', stage_entered_at: '' },
      { prospect_id: '3', current_stage: 'shortlist', stage_entered_at: '' },
    ];
    expect(computePipelineDistribution(entries)).toEqual({ identified: 2, shortlist: 1 });
  });
});

describe('computeProspectsByPosition', () => {
  it('groups by position', () => {
    const prospects = [
      { id: '1', pipeline_status: '', primary_position: 'GK', priority: 'high', status: 'active', birth_quarter: 1, is_late_developer: false, confidence_score: null },
      { id: '2', pipeline_status: '', primary_position: 'GK', priority: 'low', status: 'active', birth_quarter: 2, is_late_developer: false, confidence_score: null },
      { id: '3', pipeline_status: '', primary_position: null, priority: 'medium', status: 'active', birth_quarter: null, is_late_developer: false, confidence_score: null },
    ];
    const result = computeProspectsByPosition(prospects);
    expect(result['GK']).toBe(2);
    expect(result['Sem posição']).toBe(1);
  });
});

describe('computeConversionRate', () => {
  it('calculates rate', () => {
    const prospects = [
      { id: '1', pipeline_status: 'approved', primary_position: null, priority: null, status: 'active', birth_quarter: null, is_late_developer: false, confidence_score: null },
      { id: '2', pipeline_status: 'identified', primary_position: null, priority: null, status: 'active', birth_quarter: null, is_late_developer: false, confidence_score: null },
    ];
    expect(computeConversionRate(prospects)).toBe(50);
  });

  it('returns 0 for empty', () => {
    expect(computeConversionRate([])).toBe(0);
  });
});

describe('computeTrialApprovalRate', () => {
  it('calculates rate from completed trials', () => {
    const trials = [
      { id: '1', prospect_id: '1', status: 'completed', outcome: 'approved' },
      { id: '2', prospect_id: '2', status: 'completed', outcome: 'rejected' },
      { id: '3', prospect_id: '3', status: 'scheduled', outcome: null },
    ];
    expect(computeTrialApprovalRate(trials)).toBe(50);
  });
});

describe('computeBirthQuarterDistribution', () => {
  it('distributes by quarter', () => {
    const prospects = [
      { id: '1', pipeline_status: '', primary_position: null, priority: null, status: 'active', birth_quarter: 1, is_late_developer: false, confidence_score: null },
      { id: '2', pipeline_status: '', primary_position: null, priority: null, status: 'active', birth_quarter: 4, is_late_developer: false, confidence_score: null },
      { id: '3', pipeline_status: '', primary_position: null, priority: null, status: 'active', birth_quarter: null, is_late_developer: false, confidence_score: null },
    ];
    const result = computeBirthQuarterDistribution(prospects);
    expect(result.Q1).toBe(1);
    expect(result.Q4).toBe(1);
    expect(result.unknown).toBe(1);
  });
});

describe('computePerformancePotentialMatrix', () => {
  it('classifies correctly', () => {
    const data = [
      { prospect_id: '1', performance: 80, potential: 80 },
      { prospect_id: '2', performance: 80, potential: 50 },
      { prospect_id: '3', performance: 50, potential: 80 },
      { prospect_id: '4', performance: 30, potential: 80 },
      { prospect_id: '5', performance: 30, potential: 30 },
    ];
    const m = computePerformancePotentialMatrix(data);
    expect(m.highHigh).toBe(1);
    expect(m.highMod).toBe(1);
    expect(m.modHigh).toBe(1);
    expect(m.lowHigh).toBe(1);
    expect(m.other).toBe(1);
  });
});

describe('countLateDevs', () => {
  it('counts late developers', () => {
    const prospects = [
      { id: '1', pipeline_status: '', primary_position: null, priority: null, status: 'active', birth_quarter: null, is_late_developer: true, confidence_score: null },
      { id: '2', pipeline_status: '', primary_position: null, priority: null, status: 'active', birth_quarter: null, is_late_developer: false, confidence_score: null },
    ];
    expect(countLateDevs(prospects)).toBe(1);
  });
});
