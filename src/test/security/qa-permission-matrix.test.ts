/**
 * Security tests — QA Permission Matrix
 * Validates expected access control for each role.
 */
import { describe, it, expect } from 'vitest';
import { QA_PERMISSION_MATRIX, QAPermissionEntry } from '../fixtures/qa-matrix';

describe('QA Permission Matrix', () => {
  it('should cover all 8 roles', () => {
    const roles = QA_PERMISSION_MATRIX.map(e => e.role);
    expect(roles).toContain('club_admin');
    expect(roles).toContain('coordinator');
    expect(roles).toContain('coach');
    expect(roles).toContain('assistant_coach');
    expect(roles).toContain('staff');
    expect(roles).toContain('guardian');
    expect(roles).toContain('player');
    expect(roles).toContain('individual_coach');
    expect(QA_PERMISSION_MATRIX).toHaveLength(8);
  });

  function getRole(role: string): QAPermissionEntry {
    return QA_PERMISSION_MATRIX.find(e => e.role === role)!;
  }

  describe('Guardian restrictions', () => {
    it('cannot create invites', () => {
      expect(getRole('guardian').canCreateInvite).toBe(false);
    });

    it('can accept invites', () => {
      expect(getRole('guardian').canAcceptInvite).toBe(true);
    });

    it('cannot view technical channels', () => {
      expect(getRole('guardian').canViewTechnicalChannel).toBe(false);
    });

    it('cannot view other players', () => {
      expect(getRole('guardian').canViewOtherPlayer).toBe(false);
    });

    it('cannot manage members', () => {
      expect(getRole('guardian').canManageMembers).toBe(false);
    });

    it('cannot create channels', () => {
      expect(getRole('guardian').canCreateChannel).toBe(false);
    });
  });

  describe('Player restrictions', () => {
    it('cannot create invites', () => {
      expect(getRole('player').canCreateInvite).toBe(false);
    });

    it('cannot view parents channel', () => {
      expect(getRole('player').canViewParentsChannel).toBe(false);
    });

    it('cannot view other players', () => {
      expect(getRole('player').canViewOtherPlayer).toBe(false);
    });

    it('cannot view other age groups', () => {
      expect(getRole('player').canViewOtherAgeGroup).toBe(false);
    });
  });

  describe('Club admin privileges', () => {
    it('can create invites', () => {
      expect(getRole('club_admin').canCreateInvite).toBe(true);
    });

    it('can view all channel types', () => {
      const admin = getRole('club_admin');
      expect(admin.canViewOfficialChannel).toBe(true);
      expect(admin.canViewTechnicalChannel).toBe(true);
      expect(admin.canViewParentsChannel).toBe(true);
      expect(admin.canViewPlayersChannel).toBe(true);
    });

    it('can manage members', () => {
      expect(getRole('club_admin').canManageMembers).toBe(true);
    });
  });

  describe('Assistant coach restrictions', () => {
    it('cannot create invites', () => {
      expect(getRole('assistant_coach').canCreateInvite).toBe(false);
    });

    it('cannot view parents channel', () => {
      expect(getRole('assistant_coach').canViewParentsChannel).toBe(false);
    });

    it('cannot view other players', () => {
      expect(getRole('assistant_coach').canViewOtherPlayer).toBe(false);
    });
  });

  describe('Staff restrictions', () => {
    it('cannot create invites', () => {
      expect(getRole('staff').canCreateInvite).toBe(false);
    });

    it('cannot view technical channels', () => {
      expect(getRole('staff').canViewTechnicalChannel).toBe(false);
    });

    it('cannot view callups', () => {
      expect(getRole('staff').canViewCallups).toBe(false);
    });
  });

  describe('Coach access', () => {
    it('can create invites', () => {
      expect(getRole('coach').canCreateInvite).toBe(true);
    });

    it('cannot view other age groups', () => {
      expect(getRole('coach').canViewOtherAgeGroup).toBe(false);
    });

    it('can view all own team channels', () => {
      const coach = getRole('coach');
      expect(coach.canViewOfficialChannel).toBe(true);
      expect(coach.canViewTechnicalChannel).toBe(true);
      expect(coach.canViewParentsChannel).toBe(true);
    });
  });

  describe('Individual coach access', () => {
    it('can create invites', () => {
      expect(getRole('individual_coach').canCreateInvite).toBe(true);
    });

    it('can manage members', () => {
      expect(getRole('individual_coach').canManageMembers).toBe(true);
    });

    it('cannot view other age groups', () => {
      expect(getRole('individual_coach').canViewOtherAgeGroup).toBe(false);
    });
  });

  describe('Cross-role invariants', () => {
    it('no restricted role can view other players', () => {
      const restricted = ['guardian', 'player', 'assistant_coach', 'staff', 'coach', 'individual_coach'];
      for (const role of restricted) {
        expect(getRole(role).canViewOtherPlayer).toBe(false);
      }
    });

    it('only admin and coordinator can view other age groups', () => {
      for (const entry of QA_PERMISSION_MATRIX) {
        if (entry.role !== 'club_admin' && entry.role !== 'coordinator') {
          expect(entry.canViewOtherAgeGroup).toBe(false);
        }
      }
    });

    it('guardian and player cannot create invites', () => {
      expect(getRole('guardian').canCreateInvite).toBe(false);
      expect(getRole('player').canCreateInvite).toBe(false);
    });
  });
});
