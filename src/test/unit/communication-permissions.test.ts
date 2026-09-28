/**
 * Unit tests — Communication permissions types and helpers
 */
import { describe, it, expect } from 'vitest';
import {
  isInstitutionalRole,
  isTeamScopedRole,
  isOperationalRole,
  isConsumerRole,
  requiresExplicitMembership,
  getAllowedChannelTypes,
  getAllowedAnnouncementScopes,
} from '@/lib/communication-permissions';

describe('Communication Permission Types', () => {
  describe('isInstitutionalRole', () => {
    it('club_admin is institutional', () => expect(isInstitutionalRole('club_admin')).toBe(true));
    it('coordinator is institutional', () => expect(isInstitutionalRole('coordinator')).toBe(true));
    it('coach is NOT institutional', () => expect(isInstitutionalRole('coach')).toBe(false));
    it('staff is NOT institutional', () => expect(isInstitutionalRole('staff')).toBe(false));
    it('player is NOT institutional', () => expect(isInstitutionalRole('player')).toBe(false));
    it('guardian is NOT institutional', () => expect(isInstitutionalRole('guardian')).toBe(false));
  });

  describe('isTeamScopedRole', () => {
    it('coach is team-scoped', () => expect(isTeamScopedRole('coach')).toBe(true));
    it('assistant_coach is team-scoped', () => expect(isTeamScopedRole('assistant_coach')).toBe(true));
    it('individual_coach is team-scoped', () => expect(isTeamScopedRole('individual_coach')).toBe(true));
    it('club_admin is NOT team-scoped', () => expect(isTeamScopedRole('club_admin')).toBe(false));
    it('staff is NOT team-scoped', () => expect(isTeamScopedRole('staff')).toBe(false));
  });

  describe('isOperationalRole', () => {
    it('club_admin is operational', () => expect(isOperationalRole('club_admin')).toBe(true));
    it('coordinator is operational', () => expect(isOperationalRole('coordinator')).toBe(true));
    it('coach is operational', () => expect(isOperationalRole('coach')).toBe(true));
    it('assistant_coach is operational', () => expect(isOperationalRole('assistant_coach')).toBe(true));
    it('staff is NOT operational', () => expect(isOperationalRole('staff')).toBe(false));
    it('player is NOT operational', () => expect(isOperationalRole('player')).toBe(false));
    it('guardian is NOT operational', () => expect(isOperationalRole('guardian')).toBe(false));
  });

  describe('isConsumerRole', () => {
    it('player is consumer', () => expect(isConsumerRole('player')).toBe(true));
    it('guardian is consumer', () => expect(isConsumerRole('guardian')).toBe(true));
    it('coach is NOT consumer', () => expect(isConsumerRole('coach')).toBe(false));
  });

  describe('requiresExplicitMembership', () => {
    it('mixed_controlled requires it', () => expect(requiresExplicitMembership('mixed_controlled')).toBe(true));
    it('custom requires it', () => expect(requiresExplicitMembership('custom')).toBe(true));
    it('restricted_internal requires it', () => expect(requiresExplicitMembership('restricted_internal')).toBe(true));
    it('team does NOT', () => expect(requiresExplicitMembership('team')).toBe(false));
    it('official does NOT', () => expect(requiresExplicitMembership('official')).toBe(false));
  });

  describe('getAllowedChannelTypes', () => {
    it('club_admin can create all types', () => {
      const types = getAllowedChannelTypes('club_admin');
      expect(types).toContain('official_club');
      expect(types).toContain('team');
      expect(types).toContain('custom');
      expect(types.length).toBeGreaterThan(10);
    });

    it('coordinator can create most but not official_club', () => {
      const types = getAllowedChannelTypes('coordinator');
      expect(types).not.toContain('official_club');
      expect(types).toContain('official_team');
      expect(types).toContain('team');
    });

    it('coach can create team-level channels', () => {
      const types = getAllowedChannelTypes('coach');
      expect(types).toContain('team');
      expect(types).toContain('parents_team');
      expect(types).toContain('players_team');
      expect(types).not.toContain('official_club');
      expect(types).not.toContain('coaches_internal');
    });

    it('assistant_coach has limited creation', () => {
      const types = getAllowedChannelTypes('assistant_coach');
      expect(types).toContain('team');
      expect(types).toContain('custom');
      expect(types).not.toContain('parents_team');
      expect(types).not.toContain('official');
    });

    it('staff can only create custom', () => {
      const types = getAllowedChannelTypes('staff');
      expect(types).toEqual(['custom']);
    });

    it('player cannot create any channel', () => {
      expect(getAllowedChannelTypes('player')).toEqual([]);
    });

    it('guardian cannot create any channel', () => {
      expect(getAllowedChannelTypes('guardian')).toEqual([]);
    });
  });

  describe('getAllowedAnnouncementScopes', () => {
    it('club_admin can announce to all scopes', () => {
      const scopes = getAllowedAnnouncementScopes('club_admin');
      expect(scopes).toContain('club');
      expect(scopes).toContain('age_group');
      expect(scopes).toContain('team');
      expect(scopes).toContain('channel');
      expect(scopes).toContain('role');
    });

    it('coordinator can announce age_group, team, channel, role', () => {
      const scopes = getAllowedAnnouncementScopes('coordinator');
      expect(scopes).not.toContain('club');
      expect(scopes).toContain('age_group');
      expect(scopes).toContain('team');
    });

    it('coach can announce team and channel only', () => {
      const scopes = getAllowedAnnouncementScopes('coach');
      expect(scopes).toEqual(['team', 'channel']);
    });

    it('assistant_coach can announce team and channel only', () => {
      expect(getAllowedAnnouncementScopes('assistant_coach')).toEqual(['team', 'channel']);
    });

    it('staff cannot announce', () => {
      expect(getAllowedAnnouncementScopes('staff')).toEqual([]);
    });

    it('player cannot announce', () => {
      expect(getAllowedAnnouncementScopes('player')).toEqual([]);
    });

    it('guardian cannot announce', () => {
      expect(getAllowedAnnouncementScopes('guardian')).toEqual([]);
    });
  });
});
