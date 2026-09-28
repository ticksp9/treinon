/**
 * Integration tests — Full template flow
 * Tests the complete pipeline: parse → validate → render → sanitize.
 */
import { describe, it, expect } from 'vitest';
import { parseTemplate } from '@/lib/template-engine/parser';
import { validateTemplate } from '@/lib/template-engine/validator';
import { renderTemplate, previewTemplate } from '@/lib/template-engine/renderer';
import { sanitizeForPreview, estimateSmsLength } from '@/lib/template-engine/sanitizer';
import { SAMPLE_TEMPLATES, MOCK_TEMPLATE_DATA } from '../fixtures/invite-fixtures';

describe('Template Full Flow — Integration', () => {
  describe('Guardian Email flow', () => {
    const { subject, body } = SAMPLE_TEMPLATES.guardianEmail;

    it('should parse without errors', () => {
      const parsed = parseTemplate(body);
      expect(parsed.unsafeTokens).toHaveLength(0);
      expect(parsed.invalidTokens).toHaveLength(0);
      expect(parsed.variablesFound.length).toBeGreaterThan(0);
    });

    it('should validate for email channel + guardian profile', () => {
      const result = validateTemplate(body, { channel: 'email', profileType: 'guardian' });
      expect(result.isValid).toBe(true);
    });

    it('should render with all variables resolved', () => {
      const result = renderTemplate(body, MOCK_TEMPLATE_DATA);
      expect(result.missingRequired).toHaveLength(0);
      expect(result.renderedText).toContain('João Silva');
      expect(result.renderedText).toContain('Pedro Costa');
      expect(result.renderedText).toContain('Sub-15 A');
      expect(result.renderedText).toContain('abc123');
    });

    it('should render subject correctly', () => {
      const result = renderTemplate(subject, MOCK_TEMPLATE_DATA);
      expect(result.renderedText).toContain('TaticalSoccer');
      expect(result.renderedText).toContain('Academia Desportiva');
    });

    it('should produce safe preview', () => {
      const rendered = renderTemplate(body, MOCK_TEMPLATE_DATA);
      const safe = sanitizeForPreview(rendered.renderedText);
      expect(safe).not.toContain('<script');
    });

    it('preview should match production render', () => {
      const preview = previewTemplate(body, MOCK_TEMPLATE_DATA);
      const prod = renderTemplate(body, MOCK_TEMPLATE_DATA, { preserveUnknown: true });
      expect(preview.renderedText).toBe(prod.renderedText);
    });
  });

  describe('Player SMS flow', () => {
    const { body } = SAMPLE_TEMPLATES.playerSms;

    it('should validate for sms + player', () => {
      const result = validateTemplate(body, { channel: 'sms', profileType: 'player' });
      expect(result.isValid).toBe(true);
    });

    it('should estimate SMS length', () => {
      const rendered = renderTemplate(body, MOCK_TEMPLATE_DATA);
      const est = estimateSmsLength(rendered.renderedText);
      expect(est.chars).toBeGreaterThan(0);
      expect(est.segments).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Coach WhatsApp flow', () => {
    const { body } = SAMPLE_TEMPLATES.coachWhatsapp;

    it('should validate for whatsapp + coach', () => {
      const result = validateTemplate(body, { channel: 'whatsapp', profileType: 'coach' });
      expect(result.isValid).toBe(true);
    });

    it('should render preserving line breaks', () => {
      const result = renderTemplate(body, MOCK_TEMPLATE_DATA);
      expect(result.renderedText).toContain('\n');
    });
  });

  describe('Error scenarios', () => {
    it('should block template with unknown variables', () => {
      const result = validateTemplate(SAMPLE_TEMPLATES.invalidTemplate.body);
      expect(result.isValid).toBe(false);
      expect(result.unknownVariables.length + result.invalidSyntaxTokens.length).toBeGreaterThan(0);
    });

    it('should block malicious template', () => {
      const result = validateTemplate(SAMPLE_TEMPLATES.maliciousTemplate.body);
      expect(result.isValid).toBe(false);
    });

    it('should block empty template', () => {
      const result = validateTemplate(SAMPLE_TEMPLATES.emptyTemplate.body);
      expect(result.isValid).toBe(false);
    });

    it('should handle template without placeholders (valid)', () => {
      const result = validateTemplate(SAMPLE_TEMPLATES.noPlaceholders.body);
      // Valid but with warnings about missing required vars
      expect(result.variablesFound).toHaveLength(0);
    });
  });

  describe('Delivery content persistence', () => {
    it('rendered content should be stable and deterministic', () => {
      const template = SAMPLE_TEMPLATES.guardianEmail.body;
      const render1 = renderTemplate(template, MOCK_TEMPLATE_DATA);
      const render2 = renderTemplate(template, MOCK_TEMPLATE_DATA);
      expect(render1.renderedText).toBe(render2.renderedText);
    });

    it('template edit should not affect already rendered content', () => {
      const originalTemplate = '{{recipient_name}} welcome to {{club_name}}';
      const rendered = renderTemplate(originalTemplate, MOCK_TEMPLATE_DATA);
      const savedContent = rendered.renderedText;

      // Simulating template edit
      const editedTemplate = '{{recipient_name}} bem-vindo a {{club_name}}';
      const newRender = renderTemplate(editedTemplate, MOCK_TEMPLATE_DATA);

      // Old persisted content is unaffected
      expect(savedContent).toBe('João Silva welcome to Academia Desportiva');
      expect(newRender.renderedText).toBe('João Silva bem-vindo a Academia Desportiva');
      expect(savedContent).not.toBe(newRender.renderedText);
    });
  });
});
