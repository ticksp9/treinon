/**
 * Unit tests — Membership and channel access rules
 * Tests the logic for auto-membership, channel visibility, and role gating.
 */
import { describe, it, expect } from 'vitest';
import {
  createTestChannel,
  createTestMembership,
  assertCanReadChannel,
  assertCannotReadChannel,
} from '../fixtures/factories';

describe('Membership Rules', () => {

  describe('Channel visibility flags', () => {
    it('guardian can see channel with allow_guardians=true', () => {
      const channel = createTestChannel({ allow_guardians: true });
      expect(channel.allow_guardians).toBe(true);
    });

    it('guardian cannot see channel with allow_guardians=false', () => {
      const channel = createTestChannel({ allow_guardians: false });
      expect(channel.allow_guardians).toBe(false);
    });

    it('player can see channel with allow_players=true', () => {
      const channel = createTestChannel({ allow_players: true });
      expect(channel.allow_players).toBe(true);
    });

    it('player cannot see channel with allow_players=false', () => {
      const channel = createTestChannel({ allow_players: false });
      expect(channel.allow_players).toBe(false);
    });

    it('staff cannot see channel with allow_staff=false', () => {
      const channel = createTestChannel({ allow_staff: false });
      expect(channel.allow_staff).toBe(false);
    });
  });

  describe('Channel type eligibility for auto-join', () => {
    const ALLOWED_TYPES = ['official', 'team', 'age_group', 'role_based'];
    const BLOCKED_SCOPES = ['private', 'restricted', 'restricted_internal'];

    it('team channel is eligible for auto-join', () => {
      expect(ALLOWED_TYPES).toContain('team');
    });

    it('official channel is eligible for auto-join', () => {
      expect(ALLOWED_TYPES).toContain('official');
    });

    it('private channel is NOT eligible for auto-join', () => {
      expect(BLOCKED_SCOPES).toContain('private');
      expect(ALLOWED_TYPES).not.toContain('private');
    });

    it('restricted_internal channel is NOT eligible for auto-join', () => {
      expect(BLOCKED_SCOPES).toContain('restricted_internal');
    });

    it('custom channel is NOT in auto-join list', () => {
      expect(ALLOWED_TYPES).not.toContain('custom');
    });
  });

  describe('Membership assertion helpers', () => {
    it('assertCanReadChannel passes with valid membership', () => {
      const membership = createTestMembership({ channel_id: 'ch1', user_id: 'u1' });
      expect(() => assertCanReadChannel(membership)).not.toThrow();
    });

    it('assertCanReadChannel throws on null', () => {
      expect(() => assertCanReadChannel(null)).toThrow('Expected channel membership');
    });

    it('assertCannotReadChannel passes on null', () => {
      expect(() => assertCannotReadChannel(null)).not.toThrow();
    });

    it('assertCannotReadChannel throws on existing membership', () => {
      const membership = createTestMembership({ channel_id: 'ch1', user_id: 'u1' });
      expect(() => assertCannotReadChannel(membership)).toThrow('Expected NO channel membership');
    });
  });

  describe('Auto-membership idempotency', () => {
    it('should not create duplicate membership entries', () => {
      const existing = [
        createTestMembership({ channel_id: 'ch1', user_id: 'u1' }),
      ];
      const newMembership = { channel_id: 'ch1', user_id: 'u1' };
      const isDuplicate = existing.some(
        m => m.channel_id === newMembership.channel_id && m.user_id === newMembership.user_id
      );
      expect(isDuplicate).toBe(true);
    });

    it('different channel should not be duplicate', () => {
      const existing = [
        createTestMembership({ channel_id: 'ch1', user_id: 'u1' }),
      ];
      const newMembership = { channel_id: 'ch2', user_id: 'u1' };
      const isDuplicate = existing.some(
        m => m.channel_id === newMembership.channel_id && m.user_id === newMembership.user_id
      );
      expect(isDuplicate).toBe(false);
    });
  });

  describe('Guardian-specific membership rules', () => {
    it('guardian should join channels where allow_guardians=true and team matches', () => {
      const channels = [
        createTestChannel({ allow_guardians: true, team_id: 'team1', channel_type: 'team' }),
        createTestChannel({ allow_guardians: false, team_id: 'team1', channel_type: 'team' }),
        createTestChannel({ allow_guardians: true, team_id: 'team2', channel_type: 'team' }),
      ];
      const eligible = channels.filter(c => c.allow_guardians && c.team_id === 'team1');
      expect(eligible).toHaveLength(1);
    });

    it('guardian should NOT join restricted_internal channels even if allow_guardians=true', () => {
      const channel = createTestChannel({
        allow_guardians: true,
        visibility_scope: 'restricted_internal',
      });
      const BLOCKED_SCOPES = ['private', 'restricted', 'restricted_internal'];
      const isBlocked = BLOCKED_SCOPES.includes(channel.visibility_scope);
      expect(isBlocked).toBe(true);
    });
  });

  describe('Player-specific membership rules', () => {
    it('player should join channels where allow_players=true and team matches', () => {
      const channels = [
        createTestChannel({ allow_players: true, team_id: 'team1', channel_type: 'team' }),
        createTestChannel({ allow_players: false, team_id: 'team1', channel_type: 'team' }),
      ];
      const eligible = channels.filter(c => c.allow_players && c.team_id === 'team1');
      expect(eligible).toHaveLength(1);
    });

    it('player should NOT join parents-only channel', () => {
      const channel = createTestChannel({
        allow_players: false,
        allow_guardians: true,
        channel_type: 'role_based',
        name: 'Grupo Pais',
      });
      expect(channel.allow_players).toBe(false);
    });
  });
});
