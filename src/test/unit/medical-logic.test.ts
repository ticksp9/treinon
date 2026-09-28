import { describe, it, expect } from 'vitest';
import {
  computeSquadFitness,
  computeExamCompliance,
  computeInjuryStats,
  computeDaysSince,
} from '@/hooks/useMedical';

describe('computeSquadFitness', () => {
  it('counts clearance statuses correctly', () => {
    const data = [
      { person_id: '1', clearance_type: 'global', clearance_status: 'fit', valid_to: null },
      { person_id: '2', clearance_type: 'global', clearance_status: 'fit', valid_to: null },
      { person_id: '3', clearance_type: 'global', clearance_status: 'fit_restricted', valid_to: null },
      { person_id: '4', clearance_type: 'global', clearance_status: 'unfit', valid_to: null },
      { person_id: '5', clearance_type: 'global', clearance_status: 'pending', valid_to: null },
      { person_id: '6', clearance_type: 'training', clearance_status: 'fit', valid_to: null },
    ];
    const r = computeSquadFitness(data);
    expect(r.fit).toBe(2);
    expect(r.fitRestricted).toBe(1);
    expect(r.unfit).toBe(1);
    expect(r.pending).toBe(1);
    expect(r.total).toBe(5);
  });

  it('returns zeros for empty input', () => {
    const r = computeSquadFitness([]);
    expect(r.total).toBe(0);
  });
});

describe('computeExamCompliance', () => {
  it('classifies exams correctly', () => {
    const today = new Date('2026-03-27');
    const data = [
      { person_id: '1', exam_type_code: 'annual', status: 'validated', expiry_date: '2026-06-01' },
      { person_id: '2', exam_type_code: 'annual', status: 'validated', expiry_date: '2026-04-15' },
      { person_id: '3', exam_type_code: 'annual', status: 'validated', expiry_date: '2026-01-01' },
      { person_id: '4', exam_type_code: 'annual', status: 'scheduled', expiry_date: null },
    ];
    const r = computeExamCompliance(data, today);
    expect(r.valid).toBe(1);
    expect(r.expiringSoon).toBe(1);
    expect(r.expired).toBe(1);
    expect(r.missing).toBe(1);
    expect(r.complianceRate).toBe(25);
  });

  it('returns 0% for empty', () => {
    expect(computeExamCompliance([]).complianceRate).toBe(0);
  });
});

describe('computeInjuryStats', () => {
  it('computes stats correctly', () => {
    const data = [
      { id: '1', person_id: 'a', severity: 'moderate', case_status: 'open', event_date: '2026-03-01', expected_days_out: 14, actual_days_out: null, body_area: 'knee_left' },
      { id: '2', person_id: 'b', severity: 'severe', case_status: 'closed', event_date: '2026-01-01', expected_days_out: 30, actual_days_out: 28, body_area: 'ankle_right' },
      { id: '3', person_id: 'c', severity: 'moderate', case_status: 'in_treatment', event_date: '2026-03-10', expected_days_out: 7, actual_days_out: null, body_area: 'knee_left' },
    ];
    const r = computeInjuryStats(data);
    expect(r.activeCases).toBe(2);
    expect(r.closedCases).toBe(1);
    expect(r.totalDaysLost).toBe(49);
    expect(r.avgRecovery).toBe(28);
    expect(r.bySeverity['moderate']).toBe(2);
    expect(r.byArea['knee_left']).toBe(2);
  });
});

describe('computeDaysSince', () => {
  it('calculates days correctly', () => {
    const today = new Date('2026-03-27');
    expect(computeDaysSince('2026-03-20', today)).toBe(7);
    expect(computeDaysSince('2026-03-27', today)).toBe(0);
  });
});
