/**
 * Unit tests — Communication visibility rules
 */
import { describe, it, expect } from 'vitest';
import {
  isChannelTypeBlockedForProfile,
  passesTeamScopeCheck,
  passesRoleAllowCheck,
} from '@/lib/communication-visibility';
import type { AccessContext, ChannelInfo } from '@/lib/communication-access-service';

function makeCtx(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    userId: 'u1', profileType: 'coach', clubId: 'club-1',
    teamIds: ['team-1'], ageGroupIds: [], playerIds: [],
    guardianId: null, isClubAdmin: false, isCoordinator: false,
    isCoach: true, isStaff: false, isGuardian: false, isPlayer: false,
    ...overrides,
  };
}

function makeCh(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    id: 'ch-1', club_id: 'club-1', owner_id: null, team_id: null,
    channel_type: 'team', visibility_scope: 'team_based',
    allow_guardians: false, allow_players: false, allow_coaches: true,
    allow_staff: false, allow_coordinators: true, can_members_post: true,
    is_official: false, is_active: true, ...overrides,
  };
}

describe('Communication Visibility Rules', () => {
  describe('isChannelTypeBlockedForProfile', () => {
    it('players_team blocks guardian', () => {
      expect(isChannelTypeBlockedForProfile('players_team', makeCtx({ isGuardian: true, isCoach: false }))).toBe(true);
    });
    it('players_team does NOT block player', () => {
      expect(isChannelTypeBlockedForProfile('players_team', makeCtx({ isPlayer: true, isCoach: false }))).toBe(false);
    });
    it('parents_team blocks player', () => {
      expect(isChannelTypeBlockedForProfile('parents_team', makeCtx({ isPlayer: true, isCoach: false }))).toBe(true);
    });
    it('parents_team does NOT block guardian', () => {
      expect(isChannelTypeBlockedForProfile('parents_team', makeCtx({ isGuardian: true, isCoach: false }))).toBe(false);
    });
    it('coaches_internal blocks player', () => {
      expect(isChannelTypeBlockedForProfile('coaches_internal', makeCtx({ isPlayer: true, isCoach: false }))).toBe(true);
    });
    it('coaches_internal blocks guardian', () => {
      expect(isChannelTypeBlockedForProfile('coaches_internal', makeCtx({ isGuardian: true, isCoach: false }))).toBe(true);
    });
    it('staff_internal blocks player', () => {
      expect(isChannelTypeBlockedForProfile('staff_internal', makeCtx({ isPlayer: true, isCoach: false }))).toBe(true);
    });
    it('coordination_internal blocks guardian', () => {
      expect(isChannelTypeBlockedForProfile('coordination_internal', makeCtx({ isGuardian: true, isCoach: false }))).toBe(true);
    });
    it('coaches_internal does NOT block club_admin', () => {
      expect(isChannelTypeBlockedForProfile('coaches_internal', makeCtx({ isClubAdmin: true }))).toBe(false);
    });
    it('team channel does NOT block anyone', () => {
      expect(isChannelTypeBlockedForProfile('team', makeCtx({ isGuardian: true, isCoach: false }))).toBe(false);
    });
  });

  describe('passesTeamScopeCheck', () => {
    it('passes when channel has no team_id', () => {
      expect(passesTeamScopeCheck(makeCtx(), makeCh({ team_id: null }))).toBe(true);
    });
    it('passes when user has no teamIds (defers to membership)', () => {
      expect(passesTeamScopeCheck(makeCtx({ teamIds: [] }), makeCh({ team_id: 'team-1' }))).toBe(true);
    });
    it('passes when user is in the team', () => {
      expect(passesTeamScopeCheck(makeCtx({ teamIds: ['team-1'] }), makeCh({ team_id: 'team-1' }))).toBe(true);
    });
    it('fails when user is in different team', () => {
      expect(passesTeamScopeCheck(makeCtx({ teamIds: ['team-2'] }), makeCh({ team_id: 'team-1' }))).toBe(false);
    });
  });

  describe('passesRoleAllowCheck', () => {
    it('guardian blocked when allow_guardians=false', () => {
      expect(passesRoleAllowCheck(makeCtx({ isGuardian: true, isCoach: false }), makeCh({ allow_guardians: false }))).toBe(false);
    });
    it('guardian allowed when allow_guardians=true', () => {
      expect(passesRoleAllowCheck(makeCtx({ isGuardian: true, isCoach: false }), makeCh({ allow_guardians: true }))).toBe(true);
    });
    it('player blocked when allow_players=false', () => {
      expect(passesRoleAllowCheck(makeCtx({ isPlayer: true, isCoach: false }), makeCh({ allow_players: false }))).toBe(false);
    });
    it('coach blocked when allow_coaches=false', () => {
      expect(passesRoleAllowCheck(makeCtx(), makeCh({ allow_coaches: false }))).toBe(false);
    });
    it('staff blocked when allow_staff=false', () => {
      expect(passesRoleAllowCheck(makeCtx({ isStaff: true, isCoach: false }), makeCh({ allow_staff: false }))).toBe(false);
    });
  });
});
