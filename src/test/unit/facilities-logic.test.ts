import { describe, it, expect } from 'vitest';
import { computeOccupancyRate, detectConflicts, computeCostsByFacility, computeCostsByTeam } from '@/hooks/useFacilities';

describe('computeOccupancyRate', () => {
  it('returns 0 when no spaces', () => {
    expect(computeOccupancyRate([], 30, 0)).toBe(0);
  });

  it('calculates occupancy correctly', () => {
    const reservations = [
      { starts_at: '2026-03-01T08:00:00Z', ends_at: '2026-03-01T10:00:00Z', reservation_status: 'confirmed' },
      { starts_at: '2026-03-02T08:00:00Z', ends_at: '2026-03-02T09:00:00Z', reservation_status: 'confirmed' },
    ];
    // 1 space, 30 days, 12h/day = 360 total hours. 3 booked hours = ~1%
    expect(computeOccupancyRate(reservations, 30, 1)).toBe(1);
  });

  it('ignores cancelled reservations', () => {
    const reservations = [
      { starts_at: '2026-03-01T08:00:00Z', ends_at: '2026-03-01T20:00:00Z', reservation_status: 'cancelled' },
    ];
    expect(computeOccupancyRate(reservations, 30, 1)).toBe(0);
  });
});

describe('detectConflicts', () => {
  const existing = [
    { id: 'r1', facility_space_id: 's1', starts_at: '2026-03-10T10:00:00Z', ends_at: '2026-03-10T12:00:00Z', reservation_status: 'confirmed' },
    { id: 'r2', facility_space_id: 's1', starts_at: '2026-03-10T14:00:00Z', ends_at: '2026-03-10T16:00:00Z', reservation_status: 'confirmed' },
    { id: 'r3', facility_space_id: 's2', starts_at: '2026-03-10T10:00:00Z', ends_at: '2026-03-10T12:00:00Z', reservation_status: 'confirmed' },
  ];

  it('detects overlap', () => {
    const conflicts = detectConflicts(new Date('2026-03-10T11:00:00Z'), new Date('2026-03-10T13:00:00Z'), 's1', existing);
    expect(conflicts).toEqual(['r1']);
  });

  it('no conflict for different space', () => {
    const conflicts = detectConflicts(new Date('2026-03-10T10:00:00Z'), new Date('2026-03-10T12:00:00Z'), 's3', existing);
    expect(conflicts).toHaveLength(0);
  });

  it('no conflict for adjacent times', () => {
    const conflicts = detectConflicts(new Date('2026-03-10T12:00:00Z'), new Date('2026-03-10T14:00:00Z'), 's1', existing);
    expect(conflicts).toHaveLength(0);
  });

  it('ignores cancelled reservations', () => {
    const withCancelled = [...existing, { id: 'r4', facility_space_id: 's1', starts_at: '2026-03-10T11:00:00Z', ends_at: '2026-03-10T13:00:00Z', reservation_status: 'cancelled' }];
    const conflicts = detectConflicts(new Date('2026-03-10T11:30:00Z'), new Date('2026-03-10T12:30:00Z'), 's1', withCancelled);
    expect(conflicts).toEqual(['r1']);
  });
});

describe('computeCostsByFacility', () => {
  it('aggregates costs correctly', () => {
    const costs = [
      { facility_id: 'f1', amount: 100 },
      { facility_id: 'f1', amount: 50 },
      { facility_id: 'f2', amount: 200 },
    ];
    expect(computeCostsByFacility(costs)).toEqual({ f1: 150, f2: 200 });
  });
});

describe('computeCostsByTeam', () => {
  it('aggregates by team with unassigned fallback', () => {
    const costs = [
      { team_id: 't1', amount: 100 },
      { team_id: null, amount: 50 },
      { team_id: 't1', amount: 30 },
    ];
    expect(computeCostsByTeam(costs)).toEqual({ t1: 130, unassigned: 50 });
  });
});
