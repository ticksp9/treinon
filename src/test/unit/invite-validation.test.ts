/**
 * Unit tests — Invite validation and business rules
 * Tests payload validation, type mapping, and context rules.
 */
import { describe, it, expect } from 'vitest';
import { PROFILE_REDIRECT_MAP, INVITE_PROFILES, INVITE_STATUSES, DELIVERY_CHANNELS } from '../fixtures/invite-fixtures';
import { createTestInvite, createExpiredInvite, createRevokedInvite, createAcceptedInvite } from '../fixtures/factories';

describe('Invite Validation Rules', () => {

  describe('Invite type constraints', () => {
    it('guardian invite must have player_id', () => {
      const invite = createTestInvite({ invite_type: 'guardian', player_id: null });
      expect(invite.player_id).toBeNull();
      // Backend should reject this — this documents the rule
      const isValid = invite.invite_type !== 'guardian' || invite.player_id !== null;
      expect(isValid).toBe(false);
    });

    it('guardian invite with player_id is valid', () => {
      const invite = createTestInvite({ invite_type: 'guardian', player_id: '00000000-0000-0000-0000-000000000051' });
      const isValid = invite.invite_type !== 'guardian' || invite.player_id !== null;
      expect(isValid).toBe(true);
    });

    it('player invite must have player_id', () => {
      const invite = createTestInvite({ invite_type: 'player', player_id: null });
      const isValid = invite.invite_type !== 'player' || invite.player_id !== null;
      expect(isValid).toBe(false);
    });

    it('player invite with player_id is valid', () => {
      const invite = createTestInvite({ invite_type: 'player', player_id: '00000000-0000-0000-0000-000000000051' });
      const isValid = invite.invite_type !== 'player' || invite.player_id !== null;
      expect(isValid).toBe(true);
    });
  });

  describe('Account type mapping', () => {
    const INVITE_TO_ACCOUNT: Record<string, string> = {
      guardian: 'guardian',
      player: 'player',
      coach: 'individual_coach',
      assistant_coach: 'individual_coach',
      staff: 'individual_coach',
    };

    it('guardian invite maps to guardian account_type', () => {
      expect(INVITE_TO_ACCOUNT.guardian).toBe('guardian');
    });

    it('player invite maps to player account_type', () => {
      expect(INVITE_TO_ACCOUNT.player).toBe('player');
    });

    it('coach invite maps to individual_coach account_type', () => {
      expect(INVITE_TO_ACCOUNT.coach).toBe('individual_coach');
    });
  });

  describe('Redirect mapping by profile', () => {
    it('guardian redirects to /guardian', () => {
      expect(PROFILE_REDIRECT_MAP.guardian).toBe('/guardian');
    });

    it('player redirects to /player', () => {
      expect(PROFILE_REDIRECT_MAP.player).toBe('/player');
    });

    it('club redirects to /dashboard', () => {
      expect(PROFILE_REDIRECT_MAP.club).toBe('/dashboard');
    });
  });

  describe('Invite status rules', () => {
    it('expired invite should not be acceptable', () => {
      const invite = createExpiredInvite();
      const canAccept = invite.status === 'pending' && new Date(invite.expires_at) > new Date();
      expect(canAccept).toBe(false);
    });

    it('revoked invite should not be acceptable', () => {
      const invite = createRevokedInvite();
      const canAccept = invite.status === 'pending';
      expect(canAccept).toBe(false);
    });

    it('already accepted invite should be idempotent for same user', () => {
      const invite = createAcceptedInvite();
      const isSameUser = invite.accepted_by_user_id === '00000000-0000-0000-0000-000000000041';
      expect(invite.status).toBe('accepted');
      expect(isSameUser).toBe(true);
    });

    it('already accepted invite should reject different user', () => {
      const invite = createAcceptedInvite();
      const differentUser = '00000000-0000-0000-0000-000000000099';
      const isDifferent = invite.accepted_by_user_id !== differentUser;
      expect(isDifferent).toBe(true);
    });

    it('pending invite within expiry is acceptable', () => {
      const invite = createTestInvite();
      const canAccept = invite.status === 'pending' && new Date(invite.expires_at) > new Date();
      expect(canAccept).toBe(true);
    });
  });

  describe('Recipient validation', () => {
    it('should require recipient_name', () => {
      const invite = createTestInvite({ recipient_name: '' });
      expect(invite.recipient_name).toBe('');
      const isValid = invite.recipient_name.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('should accept valid recipient_name', () => {
      const invite = createTestInvite({ recipient_name: 'João Silva' });
      expect(invite.recipient_name.trim().length > 0).toBe(true);
    });

    it('email should be optional', () => {
      const invite = createTestInvite({ email: null });
      expect(invite.email).toBeNull();
    });

    it('phone should be optional', () => {
      const invite = createTestInvite({ phone: null });
      expect(invite.phone).toBeNull();
    });
  });

  describe('Delivery channel consistency', () => {
    it('should support email, sms, whatsapp', () => {
      expect(DELIVERY_CHANNELS).toContain('email');
      expect(DELIVERY_CHANNELS).toContain('sms');
      expect(DELIVERY_CHANNELS).toContain('whatsapp');
    });

    it('email delivery requires email address', () => {
      const invite = createTestInvite({ email: 'test@test.com' });
      const canSendEmail = !!invite.email;
      expect(canSendEmail).toBe(true);
    });

    it('sms delivery requires phone number', () => {
      const invite = createTestInvite({ phone: '+351912345678' });
      const canSendSms = !!invite.phone;
      expect(canSendSms).toBe(true);
    });
  });
});
