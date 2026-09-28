/**
 * Unit tests — Template Validator
 * Tests validation rules by channel, profile, and content.
 */
import { describe, it, expect } from 'vitest';
import { validateTemplate, hasBlockingErrors } from '@/lib/template-engine/validator';

describe('Template Validator', () => {
  describe('Basic validation', () => {
    it('should reject empty template', () => {
      const result = validateTemplate('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template está vazio');
    });

    it('should reject whitespace-only template', () => {
      const result = validateTemplate('   ');
      expect(result.isValid).toBe(false);
    });

    it('should accept valid template', () => {
      const result = validateTemplate('Olá {{recipient_name}}, clica aqui: {{invite_link}}');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Unknown variables', () => {
    it('should report unknown variables', () => {
      const result = validateTemplate('{{unknown_variable}}');
      expect(result.isValid).toBe(false);
      expect(result.unknownVariables).toContain('unknown_variable');
    });

    it('should report unsafe placeholders as errors', () => {
      const result = validateTemplate('{{window.location}}');
      expect(result.isValid).toBe(false);
      expect(result.invalidSyntaxTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Channel-specific validation', () => {
    it('should warn about SMS length', () => {
      const longSms = 'A'.repeat(321) + ' {{recipient_name}}';
      const result = validateTemplate(longSms, { channel: 'sms' });
      expect(result.warnings.some(w => w.includes('SMS'))).toBe(true);
    });

    it('should warn about support_email in SMS channel', () => {
      const result = validateTemplate('{{recipient_name}} {{support_email}} {{invite_link}}', {
        channel: 'sms',
      });
      expect(result.warnings.some(w => w.includes('support_email'))).toBe(true);
    });

    it('should not warn about support_email in email channel', () => {
      const result = validateTemplate('{{recipient_name}} {{support_email}} {{invite_link}}', {
        channel: 'email',
      });
      expect(result.warnings.every(w => !w.includes('support_email') || !w.includes('não é suportada'))).toBe(true);
    });
  });

  describe('Profile-specific validation', () => {
    it('should warn about player_name for staff profile', () => {
      const result = validateTemplate('{{recipient_name}} {{player_name}} {{invite_link}}', {
        profileType: 'staff',
      });
      expect(result.warnings.some(w => w.includes('player_name'))).toBe(true);
    });

    it('should not warn about player_name for guardian profile', () => {
      const result = validateTemplate('{{recipient_name}} {{player_name}} {{invite_link}}', {
        profileType: 'guardian',
      });
      expect(result.warnings.every(w => !w.includes('player_name') || !w.includes('não é suportada'))).toBe(true);
    });
  });

  describe('Required variables', () => {
    it('should warn when invite_link is missing but invite_code present', () => {
      const result = validateTemplate('{{recipient_name}} {{invite_code}}');
      // invite_link not required when invite_code is present
      expect(result.missingRequiredVariables).not.toContain('invite_link');
    });

    it('should list missing required variables', () => {
      const result = validateTemplate('Just text with no variables');
      expect(result.missingRequiredVariables.length).toBeGreaterThan(0);
    });
  });

  describe('hasBlockingErrors', () => {
    it('should return true for invalid template', () => {
      expect(hasBlockingErrors('{{window.location}}')).toBe(true);
    });

    it('should return false for valid template', () => {
      expect(hasBlockingErrors('{{recipient_name}} {{invite_link}}')).toBe(false);
    });

    it('should return true for empty template', () => {
      expect(hasBlockingErrors('')).toBe(true);
    });
  });
});
