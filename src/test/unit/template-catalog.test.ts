/**
 * Unit tests — Variable Catalog
 * Tests catalog integrity, lookups, and defaults.
 */
import { describe, it, expect } from 'vitest';
import {
  VARIABLE_CATALOG,
  ALLOWED_VARIABLE_KEYS,
  VARIABLE_MAP,
  DEFAULT_PREVIEW_DATA,
  getRequiredVariables,
  getFallback,
} from '@/lib/template-engine/catalog';

describe('Variable Catalog', () => {
  it('should have at least 15 variables', () => {
    expect(VARIABLE_CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  it('should have matching ALLOWED_VARIABLE_KEYS', () => {
    expect(ALLOWED_VARIABLE_KEYS.size).toBe(VARIABLE_CATALOG.length);
    for (const v of VARIABLE_CATALOG) {
      expect(ALLOWED_VARIABLE_KEYS.has(v.key)).toBe(true);
    }
  });

  it('should have matching VARIABLE_MAP', () => {
    for (const v of VARIABLE_CATALOG) {
      expect(VARIABLE_MAP.get(v.key)).toBe(v);
    }
  });

  it('should have DEFAULT_PREVIEW_DATA for all variables', () => {
    for (const v of VARIABLE_CATALOG) {
      expect(DEFAULT_PREVIEW_DATA).toHaveProperty(v.key);
      expect(DEFAULT_PREVIEW_DATA[v.key]).toBe(v.exampleValue);
    }
  });

  it('should include recipient_name as required', () => {
    const def = VARIABLE_MAP.get('recipient_name');
    expect(def).toBeDefined();
    expect(def!.required).toBe(true);
  });

  it('should include invite_link as required', () => {
    const def = VARIABLE_MAP.get('invite_link');
    expect(def).toBeDefined();
    expect(def!.required).toBe(true);
  });

  it('should have every variable with all required fields', () => {
    for (const v of VARIABLE_CATALOG) {
      expect(v.key).toBeTruthy();
      expect(v.label).toBeTruthy();
      expect(v.description).toBeTruthy();
      expect(v.supportedChannels.length).toBeGreaterThan(0);
      expect(v.supportedProfiles.length).toBeGreaterThan(0);
      expect(v.exampleValue).toBeTruthy();
      expect(typeof v.required).toBe('boolean');
    }
  });

  describe('getRequiredVariables', () => {
    it('should return required variables without filters', () => {
      const required = getRequiredVariables();
      expect(required).toContain('recipient_name');
      expect(required).toContain('invite_link');
    });

    it('should filter by channel', () => {
      const required = getRequiredVariables('sms');
      expect(required).toContain('recipient_name');
    });

    it('should filter by profile', () => {
      const required = getRequiredVariables(undefined, 'guardian');
      expect(required).toContain('recipient_name');
    });
  });

  describe('getFallback', () => {
    it('should return fallback for app_name', () => {
      expect(getFallback('app_name')).toBe('TreinON');
    });

    it('should return fallback for inviter_name', () => {
      expect(getFallback('inviter_name')).toBe('Equipa Técnica');
    });

    it('should return undefined for variable without fallback', () => {
      expect(getFallback('recipient_name')).toBeUndefined();
    });

    it('should return undefined for unknown key', () => {
      expect(getFallback('nonexistent')).toBeUndefined();
    });
  });
});
