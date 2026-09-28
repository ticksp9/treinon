/**
 * Regression tests — Critical application flows
 * Ensures existing functionality isn't broken by new changes.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';

describe('Regression — Auth Flow', () => {
  it('/auth page exists and exports default component', async () => {
    const mod = await import('@/pages/Auth');
    expect(mod.default).toBeDefined();
  });

  it('/auth does NOT auto-register guardian/player accounts', () => {
    const source = fs.readFileSync('src/pages/Auth.tsx', 'utf-8');
    // Auth should only create club or individual_coach
    expect(source).not.toContain("account_type: 'guardian'");
    expect(source).not.toContain("account_type: 'player'");
  });

  it('AcceptInvite page exists', async () => {
    const mod = await import('@/pages/AcceptInvite');
    expect(mod.default).toBeDefined();
  });
});

describe('Regression — Route Guards', () => {
  it('RoleProtectedRoute redirects guardian to /guardian', () => {
    const source = fs.readFileSync('src/components/route-guards/RoleProtectedRoute.tsx', 'utf-8');
    expect(source).toContain('isGuardian');
    expect(source).toContain('/guardian');
  });

  it('RoleProtectedRoute redirects player to /player', () => {
    const source = fs.readFileSync('src/components/route-guards/RoleProtectedRoute.tsx', 'utf-8');
    expect(source).toContain('isPlayer');
    expect(source).toContain('/player');
  });
});

describe('Regression — Portals', () => {
  it('GuardianPortal page exists', async () => {
    const mod = await import('@/pages/GuardianPortal');
    expect(mod.default).toBeDefined();
  });

  it('PlayerPortal page exists', async () => {
    const mod = await import('@/pages/PlayerPortal');
    expect(mod.default).toBeDefined();
  });
});

describe('Regression — Communication', () => {
  it('Communication page exists', async () => {
    const mod = await import('@/pages/Communication');
    expect(mod.default).toBeDefined();
  });

  it('useCommunication hook exports exist', async () => {
    const mod = await import('@/hooks/useCommunication');
    expect(mod).toBeDefined();
  });
});

describe('Regression — Template Engine', () => {
  it('template engine renders correctly', async () => {
    const { renderTemplate, DEFAULT_PREVIEW_DATA } = await import('@/lib/template-engine');
    const result = renderTemplate('{{recipient_name}} - {{invite_link}}', DEFAULT_PREVIEW_DATA);
    expect(result.renderedText).toContain('João Silva');
    expect(result.missingRequired).toHaveLength(0);
  });

  it('template engine blocks unsafe content', async () => {
    const { validateTemplate } = await import('@/lib/template-engine');
    const result = validateTemplate('{{constructor}} {{__proto__}}');
    expect(result.isValid).toBe(false);
  });

  it('backward-compat renderTemplate returns string', async () => {
    const { renderTemplate } = await import('@/lib/invite-templates');
    const result = renderTemplate('Hello {{recipient_name}}', { recipient_name: 'Test' });
    expect(typeof result).toBe('string');
    expect(result).toBe('Hello Test');
  });
});

describe('Regression — Invite Hooks', () => {
  it('useAccessInvites exports all hooks', async () => {
    const mod = await import('@/hooks/useAccessInvites');
    expect(mod.useCreateInvite).toBeDefined();
    expect(mod.useRevokeInvite).toBeDefined();
    expect(mod.useResendInvite).toBeDefined();
    expect(mod.useValidateInvite).toBeDefined();
    expect(mod.useAcceptInvite).toBeDefined();
    expect(mod.useTeamInvites).toBeDefined();
    expect(mod.usePlayerInvites).toBeDefined();
  });
});

describe('Regression — Edge Functions Exist', () => {
  it('manage-invites function exists', () => {
    expect(fs.existsSync('supabase/functions/manage-invites/index.ts')).toBe(true);
  });

  it('send-invite function exists', () => {
    expect(fs.existsSync('supabase/functions/send-invite/index.ts')).toBe(true);
  });

  it('verify-pin function exists', () => {
    expect(fs.existsSync('supabase/functions/verify-pin/index.ts')).toBe(true);
  });

  it('auth-lookup function exists', () => {
    expect(fs.existsSync('supabase/functions/auth-lookup/index.ts')).toBe(true);
  });
});

describe('Regression — Constants', () => {
  it('AGE_CATEGORIES defined', async () => {
    const { AGE_CATEGORIES } = await import('@/lib/constants');
    expect(AGE_CATEGORIES.length).toBeGreaterThanOrEqual(10);
  });

  it('calculateAge works', async () => {
    const { calculateAge } = await import('@/lib/constants');
    const age = calculateAge('2010-06-15', new Date('2026-03-25'));
    expect(age).toBe(15);
  });
});
