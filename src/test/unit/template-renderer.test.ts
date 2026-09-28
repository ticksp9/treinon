/**
 * Unit tests — Template Renderer
 * Tests variable resolution, fallback, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { renderTemplate, previewTemplate } from '@/lib/template-engine/renderer';
import { MOCK_TEMPLATE_DATA } from '../fixtures/invite-fixtures';

describe('Template Renderer', () => {
  describe('Basic rendering', () => {
    it('should resolve a single variable', () => {
      const result = renderTemplate('Olá {{recipient_name}}', MOCK_TEMPLATE_DATA);
      expect(result.renderedText).toBe('Olá João Silva');
      expect(result.variablesResolved).toContain('recipient_name');
    });

    it('should resolve multiple variables', () => {
      const result = renderTemplate(
        '{{recipient_name}} convidado por {{inviter_name}} para {{team_name}}',
        MOCK_TEMPLATE_DATA
      );
      expect(result.renderedText).toBe('João Silva convidado por Pedro Costa para Sub-15 A');
    });

    it('should leave non-placeholder text intact', () => {
      const result = renderTemplate('Plain text only', MOCK_TEMPLATE_DATA);
      expect(result.renderedText).toBe('Plain text only');
    });

    it('should handle empty template', () => {
      const result = renderTemplate('', MOCK_TEMPLATE_DATA);
      expect(result.renderedText).toBe('');
    });
  });

  describe('Fallback behavior', () => {
    it('should use catalog fallback for app_name when data missing', () => {
      const data = { ...MOCK_TEMPLATE_DATA };
      delete data.app_name;
      const result = renderTemplate('{{app_name}}', data);
      expect(result.renderedText).toBe('TaticalSoccer');
      expect(result.variablesWithFallback).toContain('app_name');
    });

    it('should use catalog fallback for inviter_name when missing', () => {
      const result = renderTemplate('{{inviter_name}}', {});
      expect(result.renderedText).toBe('Equipa Técnica');
      expect(result.variablesWithFallback).toContain('inviter_name');
    });

    it('should report missing required variable', () => {
      const result = renderTemplate('{{recipient_name}}', {});
      expect(result.missingRequired).toContain('recipient_name');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should keep placeholder for required missing variable', () => {
      const result = renderTemplate('Hello {{recipient_name}}', {});
      expect(result.renderedText).toContain('{{recipient_name}}');
    });

    it('should strip optional variable without fallback when not provided', () => {
      const result = renderTemplate('Team: {{team_name}}', {});
      // team_name has no defaultFallback in catalog, so should be empty
      expect(result.renderedText).toBe('Team: ');
    });
  });

  describe('Unknown/unsafe placeholders', () => {
    it('should preserve unknown placeholders by default', () => {
      const result = renderTemplate('{{unknown_var}}', MOCK_TEMPLATE_DATA, { preserveUnknown: true });
      expect(result.renderedText).toBe('{{unknown_var}}');
    });

    it('should strip unknown placeholders when preserveUnknown is false', () => {
      const result = renderTemplate('X{{unknown_var}}Y', MOCK_TEMPLATE_DATA, { preserveUnknown: false });
      expect(result.renderedText).toBe('XY');
    });
  });

  describe('Preview rendering', () => {
    it('should match production rendering with mock data', () => {
      const template = '{{recipient_name}} - {{invite_link}}';
      const preview = previewTemplate(template, MOCK_TEMPLATE_DATA);
      const production = renderTemplate(template, MOCK_TEMPLATE_DATA, { preserveUnknown: true });
      expect(preview.renderedText).toBe(production.renderedText);
    });
  });
});
