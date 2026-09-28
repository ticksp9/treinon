import { describe, it, expect } from 'vitest';
import {
  buildSnapshotFromFallback,
  normalizeAgeGroupCode,
  getTotalMinutesFromSnapshot,
} from '@/lib/match-rules-service';

describe('Match Rules Service', () => {
  describe('normalizeAgeGroupCode', () => {
    it('maps category names to codes', () => {
      expect(normalizeAgeGroupCode('Iniciados')).toBe('iniciados');
      expect(normalizeAgeGroupCode('JUVENIS')).toBe('juvenis');
      expect(normalizeAgeGroupCode('Sub-15')).toBe('iniciados');
      expect(normalizeAgeGroupCode('Sub-11')).toBe('benjamins');
      expect(normalizeAgeGroupCode(null)).toBeNull();
      expect(normalizeAgeGroupCode(undefined)).toBeNull();
    });
  });

  describe('buildSnapshotFromFallback', () => {
    it('builds football_11 snapshot with correct rules', () => {
      const snap = buildSnapshotFromFallback('football_11', 45, 2);
      expect(snap.max_players_on_field).toBe(11);
      expect(snap.reentry_allowed).toBe(false);
      expect(snap.rolling_substitutions).toBe(false);
      expect(snap.period_1_minutes).toBe(45);
      expect(snap.period_2_minutes).toBe(45);
      expect(snap.period_count).toBe(2);
    });

    it('builds football_7 snapshot with reentry', () => {
      const snap = buildSnapshotFromFallback('football_7', 30, 2);
      expect(snap.max_players_on_field).toBe(7);
      expect(snap.reentry_allowed).toBe(true);
      expect(snap.rolling_substitutions).toBe(true);
    });

    it('builds futsal snapshot', () => {
      const snap = buildSnapshotFromFallback('futsal', 20, 2);
      expect(snap.max_players_on_field).toBe(5);
      expect(snap.reentry_allowed).toBe(true);
    });

    it('builds football_9 snapshot', () => {
      const snap = buildSnapshotFromFallback('football_9', 35, 2);
      expect(snap.max_players_on_field).toBe(9);
      expect(snap.reentry_allowed).toBe(true);
    });

    it('builds football_5 snapshot', () => {
      const snap = buildSnapshotFromFallback('football_5', 25, 2);
      expect(snap.max_players_on_field).toBe(5);
      expect(snap.reentry_allowed).toBe(true);
    });
  });

  describe('getTotalMinutesFromSnapshot', () => {
    it('computes 2-part total', () => {
      const snap = buildSnapshotFromFallback('football_11', 40, 2);
      expect(getTotalMinutesFromSnapshot(snap)).toBe(80);
    });

    it('computes custom duration', () => {
      const snap = buildSnapshotFromFallback('football_7', 25, 2);
      expect(getTotalMinutesFromSnapshot(snap)).toBe(50);
    });

    it('handles 1-part tournament', () => {
      const snap = buildSnapshotFromFallback('football_7', 15, 1);
      expect(snap.period_2_minutes).toBe(0);
      expect(getTotalMinutesFromSnapshot(snap)).toBe(15);
    });
  });

  describe('priority resolution rules', () => {
    it('snapshot from fallback uses correct modality rules per format', () => {
      // Football 11 must NOT allow reentry
      const f11 = buildSnapshotFromFallback('football_11');
      expect(f11.reentry_allowed).toBe(false);
      expect(f11.max_players_on_field).toBe(11);

      // Football 9 allows reentry
      const f9 = buildSnapshotFromFallback('football_9');
      expect(f9.reentry_allowed).toBe(true);
      expect(f9.max_players_on_field).toBe(9);

      // Football 5 allows reentry
      const f5 = buildSnapshotFromFallback('football_5');
      expect(f5.reentry_allowed).toBe(true);
      expect(f5.max_players_on_field).toBe(5);

      // Futsal allows reentry
      const fut = buildSnapshotFromFallback('futsal');
      expect(fut.reentry_allowed).toBe(true);
      expect(fut.max_players_on_field).toBe(5);
    });
  });
});
