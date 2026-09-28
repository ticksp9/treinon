/**
 * Smoke tests — Critical paths
 * Fast checks to catch gross breakage before deeper testing.
 */
import { describe, it, expect } from 'vitest';

describe('Smoke — Module Loading', () => {
  it('template engine loads', async () => {
    const mod = await import('@/lib/template-engine');
    expect(mod.VARIABLE_CATALOG).toBeDefined();
    expect(mod.parseTemplate).toBeDefined();
    expect(mod.validateTemplate).toBeDefined();
    expect(mod.renderTemplate).toBeDefined();
    expect(mod.sanitizeForPreview).toBeDefined();
  });

  it('invite-templates backward compat loads', async () => {
    const mod = await import('@/lib/invite-templates');
    expect(mod.renderTemplate).toBeDefined();
    expect(mod.PROFILE_LABELS).toBeDefined();
    expect(mod.CHANNEL_LABELS).toBeDefined();
  });

  it('constants loads', async () => {
    const mod = await import('@/lib/constants');
    expect(mod.AGE_CATEGORIES).toBeDefined();
    expect(mod.calculateAge).toBeDefined();
  });

  it('auth module loads', async () => {
    const mod = await import('@/lib/auth');
    expect(mod.AuthProvider).toBeDefined();
    expect(mod.useAuth).toBeDefined();
  });

  it('types module loads', async () => {
    const mod = await import('@/lib/types');
    expect(mod).toBeDefined();
  });
});

describe('Smoke — Template Rendering', () => {
  it('renders default guardian template', async () => {
    const { renderTemplate, DEFAULT_PREVIEW_DATA } = await import('@/lib/template-engine');
    const result = renderTemplate('Olá {{recipient_name}}, {{invite_link}}', DEFAULT_PREVIEW_DATA);
    expect(result.renderedText).toContain('João Silva');
    expect(result.missingRequired).toHaveLength(0);
  });

  it('validates template correctly', async () => {
    const { validateTemplate } = await import('@/lib/template-engine');
    const valid = validateTemplate('{{recipient_name}} {{invite_link}}');
    expect(valid.isValid).toBe(true);
    const invalid = validateTemplate('{{evil_var}}');
    expect(invalid.isValid).toBe(false);
  });
});

describe('Smoke — Page Imports', () => {
  const pages = [
    '@/pages/Auth',
    '@/pages/AcceptInvite',
    '@/pages/Dashboard',
    '@/pages/Communication',
    '@/pages/GuardianPortal',
    '@/pages/PlayerPortal',
    '@/pages/InviteTemplatesAdmin',
  ];

  for (const page of pages) {
    it(`${page} loads without error`, async () => {
      const mod = await import(/* @vite-ignore */ page);
      expect(mod.default).toBeDefined();
    });
  }
});

describe('Smoke — Hook Imports', () => {
  it('useAccessInvites loads', async () => {
    const mod = await import('@/hooks/useAccessInvites');
    expect(mod.useCreateInvite).toBeDefined();
    expect(mod.useAcceptInvite).toBeDefined();
  });

  it('useUserRole loads', async () => {
    const mod = await import('@/hooks/useUserRole');
    expect(mod.useUserRole).toBeDefined();
  });
});
