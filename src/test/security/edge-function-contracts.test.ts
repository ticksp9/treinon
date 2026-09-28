/**
 * Security tests — Edge function contract verification
 * Validates that edge functions enforce server-side authority.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';

function readSource(path: string): string {
  return fs.readFileSync(path, 'utf-8');
}

describe('Edge Function Security Contracts', () => {

  describe('manage-invites — create_invite', () => {
    const source = readSource('supabase/functions/manage-invites/index.ts');

    it('derives context server-side via deriveInviteContext', () => {
      expect(source).toContain('deriveInviteContext');
    });

    it('does NOT accept scope_type from request body', () => {
      // The destructuring should only take safe fields
      const createSection = source.substring(source.indexOf('create_invite'), source.indexOf('validate_invite'));
      expect(createSection).toContain('team_id, player_id, invite_type, recipient_name, email, phone');
    });

    it('uses ctx.scope_type instead of body.scope_type', () => {
      expect(source).toContain('ctx.scope_type');
      expect(source).toContain('ctx.club_id');
    });

    it('validates guardian requires player_id', () => {
      expect(source).toContain('Guardian invites require a player_id');
    });

    it('validates player requires player_id', () => {
      expect(source).toContain('Player invites require a player_id');
    });

    it('generates secure token hash', () => {
      expect(source).toContain('SHA-256');
    });
  });

  describe('manage-invites — accept_invite', () => {
    const source = readSource('supabase/functions/manage-invites/index.ts');
    const getAcceptSection = () => {
      const start = source.indexOf('accept_invite');
      const end = source.indexOf('resend_invite', start);
      return source.substring(start, end > start ? end : undefined);
    };

    it('uses authUser.id, NOT body.user_id', () => {
      const section = getAcceptSection();
      expect(section).toContain('const userId = authUser.id');
    });

    it('enforces email binding', () => {
      const section = getAcceptSection();
      expect(section).toContain('Email mismatch');
    });

    it('handles idempotent re-acceptance', () => {
      const section = getAcceptSection();
      expect(section).toContain('accepted_by_user_id === userId');
    });

    it('rejects acceptance by wrong user', () => {
      const section = getAcceptSection();
      expect(section).toContain('accepted_by_user_id !== userId');
    });
  });

  describe('manage-invites — auto-join channels', () => {
    const source = readSource('supabase/functions/manage-invites/index.ts');

    it('blocks private/restricted channels', () => {
      expect(source).toContain('BLOCKED_SCOPES');
      expect(source).toContain('"private"');
      expect(source).toContain('"restricted"');
      expect(source).toContain('"restricted_internal"');
    });

    it('limits to allowed channel types', () => {
      expect(source).toContain('ALLOWED_TYPES');
      expect(source).toContain('"official"');
      expect(source).toContain('"team"');
    });

    it('checks allow_guardians/allow_players flags', () => {
      expect(source).toContain('ch.allow_guardians');
      expect(source).toContain('ch.allow_players');
    });
  });

  describe('send-invite — delivery', () => {
    it('send-invite edge function exists', () => {
      const exists = fs.existsSync('supabase/functions/send-invite/index.ts');
      expect(exists).toBe(true);
    });

    it('send-invite validates auth', () => {
      const source = readSource('supabase/functions/send-invite/index.ts');
      expect(source).toContain('authorization');
    });
  });

  describe('useAccessInvites — frontend contracts', () => {
    const source = readSource('src/hooks/useAccessInvites.tsx');

    it('useCreateInvite does NOT send scope_type', () => {
      const banned = ['scope_type', 'club_id', 'owner_coach_id', 'created_by'];
      for (const field of banned) {
        const sendPattern = new RegExp(`${field}:\\s*params\\.${field}`);
        expect(sendPattern.test(source)).toBe(false);
      }
    });

    it('useAcceptInvite only sends invite_id', () => {
      const acceptSection = source.substring(source.indexOf('useAcceptInvite'));
      expect(acceptSection).toContain('invite_id: params.invite_id');
      expect(acceptSection).not.toContain('user_id: params');
    });
  });

  describe('AcceptInvite page — no authority leaks', () => {
    const source = readSource('src/pages/AcceptInvite.tsx');

    it('does not send user_id to accept mutation', () => {
      expect(source).not.toContain('user_id: user.id');
      expect(source).not.toContain('user_id: session.user.id');
    });

    it('only passes invite_id to acceptInvite', () => {
      expect(source).toContain('invite_id: validation.invite_id');
    });
  });
});
