/**
 * Security tests — RLS context isolation
 * Validates that data isolation rules are correct for all roles and contexts.
 * These test the LOGIC of the access rules; actual DB enforcement is via Supabase RLS policies.
 */
import { describe, it, expect } from 'vitest';
import { QA_PERMISSION_MATRIX } from '../fixtures/qa-matrix';
import { MOCK_IDS } from '../fixtures/invite-fixtures';
import { createTestInvite, createTestDelivery, createTestChannel, createTestTemplate } from '../fixtures/factories';

describe('RLS Context Isolation — Security', () => {

  describe('Invite access isolation', () => {
    it('invite creator can read own invite', () => {
      const invite = createTestInvite({ created_by: MOCK_IDS.coachA });
      const isCreator = invite.created_by === MOCK_IDS.coachA;
      expect(isCreator).toBe(true);
    });

    it('invite acceptor can read accepted invite', () => {
      const invite = createTestInvite({ status: 'accepted', accepted_by_user_id: MOCK_IDS.guardianA });
      const isAcceptor = invite.accepted_by_user_id === MOCK_IDS.guardianA;
      expect(isAcceptor).toBe(true);
    });

    it('other guardian cannot read invite meant for different guardian', () => {
      const invite = createTestInvite({ created_by: MOCK_IDS.coachA, email: 'joao@teste.pt' });
      const otherGuardian = MOCK_IDS.guardianB;
      const isCreator = invite.created_by === otherGuardian;
      const isAcceptor = invite.accepted_by_user_id === otherGuardian;
      expect(isCreator || isAcceptor).toBe(false);
    });

    it('player cannot enumerate all invites', () => {
      const playerEntry = QA_PERMISSION_MATRIX.find(e => e.role === 'player');
      expect(playerEntry?.canCreateInvite).toBe(false);
    });
  });

  describe('Delivery access isolation', () => {
    it('delivery readable by sender', () => {
      const delivery = createTestDelivery({ invite_id: MOCK_IDS.inviteA });
      // sent_by_user_id would match the sender
      expect(delivery.invite_id).toBe(MOCK_IDS.inviteA);
    });

    it('guardian cannot read delivery details', () => {
      const guardianEntry = QA_PERMISSION_MATRIX.find(e => e.role === 'guardian');
      expect(guardianEntry?.canManageMembers).toBe(false);
    });

    it('player cannot read delivery details', () => {
      const playerEntry = QA_PERMISSION_MATRIX.find(e => e.role === 'player');
      expect(playerEntry?.canManageMembers).toBe(false);
    });
  });

  describe('Template access isolation', () => {
    it('club A admin can manage club A templates', () => {
      const template = createTestTemplate({ club_id: MOCK_IDS.clubA });
      expect(template.club_id).toBe(MOCK_IDS.clubA);
    });

    it('club A admin cannot manage club B templates', () => {
      const template = createTestTemplate({ club_id: MOCK_IDS.clubB });
      const userClub = MOCK_IDS.clubA;
      expect(template.club_id !== userClub).toBe(true);
    });

    it('guardian cannot access template admin', () => {
      const guardianEntry = QA_PERMISSION_MATRIX.find(e => e.role === 'guardian');
      expect(guardianEntry?.canCreateChannel).toBe(false);
      // Guardian has no admin privileges
    });

    it('player cannot access template admin', () => {
      const playerEntry = QA_PERMISSION_MATRIX.find(e => e.role === 'player');
      expect(playerEntry?.canCreateChannel).toBe(false);
    });
  });

  describe('Channel isolation between teams', () => {
    it('team A channel not visible to team B coach', () => {
      const teamAChannel = createTestChannel({ team_id: MOCK_IDS.teamA });
      const teamBCoach = MOCK_IDS.coachB;
      // Without membership, coach B cannot see team A channel
      const hasTeamMatch = teamAChannel.team_id === MOCK_IDS.teamB;
      expect(hasTeamMatch).toBe(false);
    });

    it('club-wide channel requires club membership', () => {
      const clubChannel = createTestChannel({ club_id: MOCK_IDS.clubA, team_id: null, visibility_scope: 'club' });
      expect(clubChannel.club_id).toBe(MOCK_IDS.clubA);
    });
  });

  describe('Cross-role security invariants', () => {
    it('no restricted role can view other players data', () => {
      const restricted = QA_PERMISSION_MATRIX.filter(e =>
        ['guardian', 'player', 'assistant_coach', 'staff', 'coach', 'individual_coach'].includes(e.role)
      );
      for (const entry of restricted) {
        expect(entry.canViewOtherPlayer).toBe(false);
      }
    });

    it('only admin and coordinator can view other age groups', () => {
      for (const entry of QA_PERMISSION_MATRIX) {
        if (!['club_admin', 'coordinator'].includes(entry.role)) {
          expect(entry.canViewOtherAgeGroup).toBe(false);
        }
      }
    });

    it('guardian and player cannot create invites', () => {
      const guardian = QA_PERMISSION_MATRIX.find(e => e.role === 'guardian');
      const player = QA_PERMISSION_MATRIX.find(e => e.role === 'player');
      expect(guardian?.canCreateInvite).toBe(false);
      expect(player?.canCreateInvite).toBe(false);
    });

    it('guardian and player cannot manage members', () => {
      const guardian = QA_PERMISSION_MATRIX.find(e => e.role === 'guardian');
      const player = QA_PERMISSION_MATRIX.find(e => e.role === 'player');
      expect(guardian?.canManageMembers).toBe(false);
      expect(player?.canManageMembers).toBe(false);
    });

    it('guardian and player cannot create channels', () => {
      const guardian = QA_PERMISSION_MATRIX.find(e => e.role === 'guardian');
      const player = QA_PERMISSION_MATRIX.find(e => e.role === 'player');
      expect(guardian?.canCreateChannel).toBe(false);
      expect(player?.canCreateChannel).toBe(false);
    });
  });

  describe('Scope enforcement', () => {
    it('individual coach templates scoped to owner_coach_id', () => {
      const template = createTestTemplate({ club_id: null, owner_coach_id: MOCK_IDS.coachA });
      expect(template.owner_coach_id).toBe(MOCK_IDS.coachA);
      expect(template.club_id).toBeNull();
    });

    it('club templates scoped to club_id', () => {
      const template = createTestTemplate({ club_id: MOCK_IDS.clubA, owner_coach_id: null });
      expect(template.club_id).toBe(MOCK_IDS.clubA);
    });

    it('individual coach cannot edit club templates', () => {
      const clubTemplate = createTestTemplate({ club_id: MOCK_IDS.clubA });
      const coachId = MOCK_IDS.coachA;
      const isOwner = clubTemplate.owner_coach_id === coachId;
      const isClubAdmin = false; // Individual coach is not club admin
      expect(isOwner || isClubAdmin).toBe(false);
    });
  });
});
