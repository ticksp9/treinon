/**
 * Unit tests — Template Parser
 * Tests placeholder tokenisation, safety checks, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { parseTemplate, collectTemplateVariables } from '@/lib/template-engine/parser';

describe('Template Parser', () => {
  describe('Valid placeholders', () => {
    it('should parse a single valid variable', () => {
      const result = parseTemplate('Olá {{recipient_name}}');
      expect(result.variablesFound).toContain('recipient_name');
      expect(result.invalidTokens).toHaveLength(0);
      expect(result.unsafeTokens).toHaveLength(0);
    });

    it('should parse multiple valid variables', () => {
      const result = parseTemplate('{{recipient_name}} convidado por {{inviter_name}} para {{team_name}}');
      expect(result.variablesFound).toEqual(['recipient_name', 'inviter_name', 'team_name']);
    });

    it('should deduplicate repeated variables', () => {
      const result = parseTemplate('{{recipient_name}} e {{recipient_name}}');
      expect(result.variablesFound).toEqual(['recipient_name']);
      expect(result.tokens.filter(t => t.isValid)).toHaveLength(2);
    });

    it('should handle all catalog variables', () => {
      const template = '{{recipient_name}} {{app_name}} {{club_name}} {{team_name}} {{age_group}} {{player_name}} {{inviter_name}} {{inviter_role}} {{invite_link}} {{invite_code}} {{support_email}} {{expires_at}} {{channel_name}} {{profile_label}} {{context_label}}';
      const result = parseTemplate(template);
      expect(result.variablesFound).toHaveLength(15);
      expect(result.invalidTokens).toHaveLength(0);
    });
  });

  describe('Invalid placeholders', () => {
    it('should flag unknown variables', () => {
      const result = parseTemplate('{{unknown_var}}');
      expect(result.variablesFound).toHaveLength(0);
      expect(result.invalidTokens.length).toBeGreaterThan(0);
    });

    it('should flag variables with dots as unsafe', () => {
      const result = parseTemplate('{{window.location}}');
      expect(result.unsafeTokens).toHaveLength(1);
      expect(result.unsafeTokens[0].isSafe).toBe(false);
    });

    it('should flag constructor access as unsafe', () => {
      const result = parseTemplate('{{constructor}}');
      expect(result.unsafeTokens).toHaveLength(1);
    });

    it('should flag __proto__ as unsafe', () => {
      const result = parseTemplate('{{__proto__}}');
      expect(result.unsafeTokens).toHaveLength(1);
    });

    it('should flag eval as unsafe', () => {
      const result = parseTemplate('{{eval}}');
      expect(result.unsafeTokens).toHaveLength(1);
    });

    it('should flag document access as unsafe', () => {
      const result = parseTemplate('{{document}}');
      expect(result.unsafeTokens).toHaveLength(1);
    });

    it('should flag bracket access as unsafe', () => {
      const result = parseTemplate('{{obj[0]}}');
      expect(result.unsafeTokens).toHaveLength(1);
    });

    it('should flag function calls as unsafe', () => {
      const result = parseTemplate('{{func()}}');
      expect(result.unsafeTokens).toHaveLength(1);
    });

    it('should flag process.env as unsafe', () => {
      const result = parseTemplate('{{process.env}}');
      expect(result.unsafeTokens).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty template', () => {
      const result = parseTemplate('');
      expect(result.variablesFound).toHaveLength(0);
      expect(result.tokens).toHaveLength(0);
    });

    it('should handle template with no placeholders', () => {
      const result = parseTemplate('Plain text without variables');
      expect(result.variablesFound).toHaveLength(0);
      expect(result.tokens).toHaveLength(0);
    });

    it('should handle mixed valid and invalid', () => {
      const result = parseTemplate('{{recipient_name}} and {{bad_var}} and {{window.location}}');
      expect(result.variablesFound).toEqual(['recipient_name']);
      expect(result.invalidTokens.length).toBeGreaterThan(0);
      expect(result.unsafeTokens.length).toBeGreaterThan(0);
    });

    it('should handle whitespace in placeholders', () => {
      const result = parseTemplate('{{ recipient_name }}');
      expect(result.variablesFound).toContain('recipient_name');
    });
  });

  describe('collectTemplateVariables', () => {
    it('should return variable keys', () => {
      expect(collectTemplateVariables('{{invite_link}} {{invite_code}}')).toEqual(['invite_link', 'invite_code']);
    });

    it('should return empty for no variables', () => {
      expect(collectTemplateVariables('no vars')).toEqual([]);
    });
  });
});
