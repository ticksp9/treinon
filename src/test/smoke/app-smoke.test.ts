/**
 * Smoke tests — Basic app integrity
 * Fast checks that catch gross breakage in the build pipeline.
 */
import { describe, it, expect } from 'vitest';

describe('Smoke Tests', () => {
  describe('Template engine loads', () => {
    it('should import all engine modules without error', async () => {
      const engine = await import('@/lib/template-engine');
      expect(engine.VARIABLE_CATALOG).toBeDefined();
      expect(engine.parseTemplate).toBeDefined();
      expect(engine.validateTemplate).toBeDefined();
      expect(engine.renderTemplate).toBeDefined();
      expect(engine.sanitizeForPreview).toBeDefined();
      expect(engine.estimateSmsLength).toBeDefined();
    });
  });

  describe('Invite templates module loads', () => {
    it('should import backward-compat module', async () => {
      const mod = await import('@/lib/invite-templates');
      expect(mod.renderTemplate).toBeDefined();
      expect(mod.PROFILE_LABELS).toBeDefined();
      expect(mod.CHANNEL_LABELS).toBeDefined();
    });
  });

  describe('Constants module loads', () => {
    it('should import constants', async () => {
      const mod = await import('@/lib/constants');
      expect(mod.AGE_CATEGORIES).toBeDefined();
      expect(mod.calculateAge).toBeDefined();
      expect(mod.SPORT_TYPES).toBeDefined();
    });
  });

  describe('Template default can be resolved', () => {
    it('should render a default guardian email template', async () => {
      const { renderTemplate, DEFAULT_PREVIEW_DATA } = await import('@/lib/template-engine');
      const template = 'Olá {{recipient_name}}, aceda ao convite: {{invite_link}}';
      const result = renderTemplate(template, DEFAULT_PREVIEW_DATA);
      expect(result.renderedText).toContain('João Silva');
      expect(result.missingRequired).toHaveLength(0);
    });
  });

  describe('Auth module loads', () => {
    it('should export AuthProvider and useAuth', async () => {
      const mod = await import('@/lib/auth');
      expect(mod.AuthProvider).toBeDefined();
      expect(mod.useAuth).toBeDefined();
    });
  });
});
