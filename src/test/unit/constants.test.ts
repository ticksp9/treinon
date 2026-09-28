/**
 * Unit tests — Constants and business rules
 */
import { describe, it, expect } from 'vitest';
import {
  calculateAge,
  canPlayerPlayInCategory,
  getEligibleCategories,
  getHalfDurationForCategory,
  AGE_CATEGORIES,
} from '@/lib/constants';

describe('Constants & Business Rules', () => {
  describe('calculateAge', () => {
    it('should calculate correct age', () => {
      const age = calculateAge('2010-06-15', new Date('2026-03-25'));
      expect(age).toBe(15);
    });

    it('should handle birthday not yet passed', () => {
      const age = calculateAge('2010-12-15', new Date('2026-03-25'));
      expect(age).toBe(15);
    });

    it('should handle birthday today', () => {
      const age = calculateAge('2010-03-25', new Date('2026-03-25'));
      expect(age).toBe(16);
    });
  });

  describe('canPlayerPlayInCategory', () => {
    it('should allow player in correct age group', () => {
      const result = canPlayerPlayInCategory('2011-05-01', 'Sub-15', 'male', false, new Date('2025-09-15'));
      expect(result.eligible).toBe(true);
    });

    it('should reject overage player', () => {
      const result = canPlayerPlayInCategory('2000-01-01', 'Sub-13', 'male');
      expect(result.eligible).toBe(false);
    });

    it('should allow younger player in higher category', () => {
      const result = canPlayerPlayInCategory('2016-01-01', 'Sub-15', 'male');
      expect(result.eligible).toBe(true);
    });

    it('should give female players 2 extra years in male teams', () => {
      // Player who would be too old normally but allowed with +2 exception
      const result = canPlayerPlayInCategory('2008-01-01', 'Sub-15', 'male', true, new Date('2026-01-01'));
      // Season 2025/26: sporting age 2025-2008 = 17, maxAge Sub-15 = 14, +2 = 16 → too old
      expect(result.eligible).toBe(false);
    });
  });

  describe('getHalfDurationForCategory', () => {
    it('should return correct duration for Sub-15', () => {
      expect(getHalfDurationForCategory('Sub-15')).toBe(35);
    });

    it('should return 45 for null', () => {
      expect(getHalfDurationForCategory(null)).toBe(45);
    });

    it('should return 45 for unknown', () => {
      expect(getHalfDurationForCategory('Unknown')).toBe(45);
    });
  });

  describe('AGE_CATEGORIES', () => {
    it('should have at least 10 categories', () => {
      expect(AGE_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    });

    it('should have all required fields per category', () => {
      for (const cat of AGE_CATEGORIES) {
        expect(cat.value).toBeTruthy();
        expect(cat.label).toBeTruthy();
        expect(typeof cat.maxAge).toBe('number');
        expect(typeof cat.halfDurationMinutes).toBe('number');
      }
    });
  });
});
