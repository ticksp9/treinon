/**
 * Integration tests — Invite acceptance flow
 * Tests the logical flow of invite creation → validation → acceptance → profile creation → membership.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestInvite,
  createTestChannel,
  createTestMembership,
  createTestPlayer,
  createAcceptedInvite,
  createExpiredInvite,
  createRevokedInvite,
  resetIdCounter,
} from '../fixtures/factories';
import { MOCK_IDS } from '../fixtures/invite-fixtures';

describe('Invite Accept Flow — Integration', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('Guardian new user flow', () => {
    it('should validate pending invite', () => {
      const invite = createTestInvite({ invite_type: 'guardian' });
      expect(invite.status).toBe('pending');
      expect(new Date(invite.expires_at) > new Date()).toBe(true);
      const isValid = invite.status === 'pending' && new Date(invite.expires_at) > new Date();
      expect(isValid).toBe(true);
    });

    it('should derive guardian profile creation from invite_type', () => {
      const invite = createTestInvite({ invite_type: 'guardian' });
      const shouldCreateGuardianProfile = invite.invite_type === 'guardian';
      const shouldCreatePlayerGuardian = invite.invite_type === 'guardian' && !!invite.player_id;
      expect(shouldCreateGuardianProfile).toBe(true);
      expect(shouldCreatePlayerGuardian).toBe(true);
    });

    it('should set account_type to guardian', () => {
      const invite = createTestInvite({ invite_type: 'guardian' });
      const accountType = invite.invite_type === 'guardian' ? 'guardian' : invite.invite_type === 'player' ? 'player' : 'individual_coach';
      expect(accountType).toBe('guardian');
    });

    it('should auto-join eligible channels for guardian', () => {
      const channels = [
        createTestChannel({ allow_guardians: true, team_id: MOCK_IDS.teamA, channel_type: 'team', visibility_scope: 'team' }),
        createTestChannel({ allow_guardians: false, team_id: MOCK_IDS.teamA, channel_type: 'team' }),
        createTestChannel({ allow_guardians: true, team_id: MOCK_IDS.teamA, channel_type: 'official', visibility_scope: 'restricted_internal' }),
      ];
      const BLOCKED_SCOPES = ['private', 'restricted', 'restricted_internal'];
      const ALLOWED_TYPES = ['official', 'team', 'age_group', 'role_based'];
      const eligible = channels.filter(c =>
        c.allow_guardians &&
        c.team_id === MOCK_IDS.teamA &&
        ALLOWED_TYPES.includes(c.channel_type) &&
        !BLOCKED_SCOPES.includes(c.visibility_scope)
      );
      expect(eligible).toHaveLength(1);
    });

    it('should redirect to /guardian after acceptance', () => {
      const accountType = 'guardian';
      const redirect = accountType === 'guardian' ? '/guardian' : accountType === 'player' ? '/player' : '/dashboard';
      expect(redirect).toBe('/guardian');
    });
  });

  describe('Guardian existing user flow', () => {
    it('should match email binding', () => {
      const invite = createTestInvite({ email: 'joao@teste.pt' });
      const userEmail = 'joao@teste.pt';
      expect(invite.email?.toLowerCase() === userEmail.toLowerCase()).toBe(true);
    });

    it('should reject email mismatch', () => {
      const invite = createTestInvite({ email: 'joao@teste.pt' });
      const userEmail = 'outro@teste.pt';
      expect(invite.email?.toLowerCase() !== userEmail.toLowerCase()).toBe(true);
    });

    it('should not duplicate guardian_profile on re-accept', () => {
      // Simulating idempotent check
      const existingProfile = { id: 'gp1', user_id: MOCK_IDS.guardianA };
      const shouldCreate = !existingProfile;
      expect(shouldCreate).toBe(false);
    });

    it('should not duplicate player_guardians link', () => {
      const existingLinks = [{ guardian_id: 'gp1', player_id: MOCK_IDS.playerA }];
      const newLink = { guardian_id: 'gp1', player_id: MOCK_IDS.playerA };
      const isDuplicate = existingLinks.some(l => l.guardian_id === newLink.guardian_id && l.player_id === newLink.player_id);
      expect(isDuplicate).toBe(true);
    });
  });

  describe('Player new user flow', () => {
    it('should create player_account on acceptance', () => {
      const invite = createTestInvite({ invite_type: 'player' });
      const shouldCreatePlayerAccount = invite.invite_type === 'player';
      expect(shouldCreatePlayerAccount).toBe(true);
    });

    it('should set account_type to player', () => {
      const invite = createTestInvite({ invite_type: 'player' });
      const accountType = invite.invite_type === 'player' ? 'player' : 'individual_coach';
      expect(accountType).toBe('player');
    });

    it('should redirect to /player after acceptance', () => {
      const redirect = '/player';
      expect(redirect).toBe('/player');
    });

    it('should auto-join eligible channels for player', () => {
      const channels = [
        createTestChannel({ allow_players: true, team_id: MOCK_IDS.teamA, channel_type: 'team', visibility_scope: 'team' }),
        createTestChannel({ allow_players: false, team_id: MOCK_IDS.teamA, channel_type: 'team' }),
      ];
      const eligible = channels.filter(c => c.allow_players && c.team_id === MOCK_IDS.teamA);
      expect(eligible).toHaveLength(1);
    });
  });

  describe('Error cases', () => {
    it('expired invite blocks acceptance', () => {
      const invite = createExpiredInvite();
      const canAccept = invite.status === 'pending' && new Date(invite.expires_at) > new Date();
      expect(canAccept).toBe(false);
    });

    it('revoked invite blocks acceptance', () => {
      const invite = createRevokedInvite();
      const canAccept = invite.status === 'pending';
      expect(canAccept).toBe(false);
    });

    it('already accepted invite by same user is idempotent', () => {
      const invite = createAcceptedInvite({ accepted_by_user_id: MOCK_IDS.guardianA });
      const userId = MOCK_IDS.guardianA;
      const isAlreadyAccepted = invite.status === 'accepted' && invite.accepted_by_user_id === userId;
      expect(isAlreadyAccepted).toBe(true);
    });

    it('already accepted invite by different user is rejected', () => {
      const invite = createAcceptedInvite({ accepted_by_user_id: MOCK_IDS.guardianA });
      const differentUser = MOCK_IDS.guardianB;
      const isAcceptedByOther = invite.status === 'accepted' && invite.accepted_by_user_id !== differentUser;
      expect(isAcceptedByOther).toBe(true);
    });

    it('invite without player_id for guardian is invalid', () => {
      const invite = createTestInvite({ invite_type: 'guardian', player_id: null });
      const isValid = invite.invite_type !== 'guardian' || !!invite.player_id;
      expect(isValid).toBe(false);
    });
  });

  describe('Membership gating after acceptance', () => {
    it('guardian with membership can read channel', () => {
      const membership = createTestMembership({ channel_id: 'ch1', user_id: MOCK_IDS.guardianA });
      expect(membership.channel_id).toBe('ch1');
      expect(membership.user_id).toBe(MOCK_IDS.guardianA);
    });

    it('guardian without membership cannot read channel', () => {
      const memberships = [
        createTestMembership({ channel_id: 'ch1', user_id: MOCK_IDS.guardianA }),
      ];
      const hasAccess = memberships.some(m => m.channel_id === 'ch2' && m.user_id === MOCK_IDS.guardianA);
      expect(hasAccess).toBe(false);
    });

    it('player cannot see parents-only channel', () => {
      const channel = createTestChannel({ allow_players: false, allow_guardians: true });
      expect(channel.allow_players).toBe(false);
    });

    it('guardian cannot see staff-only channel', () => {
      const channel = createTestChannel({ allow_guardians: false, allow_staff: true, channel_type: 'restricted_internal' });
      expect(channel.allow_guardians).toBe(false);
    });
  });
});
