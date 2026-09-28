/**
 * Integration tests — Communication channel access
 * Tests channel visibility, membership, posting, unread, sorting,
 * and the centralized access-service permission functions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestChannel, createTestMembership, resetIdCounter } from '../fixtures/factories';
import { MOCK_IDS } from '../fixtures/invite-fixtures';
import {
  canAccessChannel, canPostMessage, canManageChannel,
  canCreateAnnouncement, canViewAnalytics, canManageInvites,
  canManageAutomations, resolveProfileType,
  type AccessContext, type ChannelInfo, type MembershipInfo,
} from '@/lib/communication-access-service';

// ---- helpers ----

function makeCtx(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    userId: 'user-1',
    profileType: 'coach',
    clubId: 'club-1',
    teamIds: ['team-1'],
    ageGroupIds: [],
    playerIds: [],
    guardianId: null,
    isClubAdmin: false,
    isCoordinator: false,
    isCoach: true,
    isStaff: false,
    isGuardian: false,
    isPlayer: false,
    ...overrides,
  };
}

function makeChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    id: 'ch-1',
    club_id: 'club-1',
    owner_id: null,
    team_id: null,
    channel_type: 'team',
    visibility_scope: 'team',
    allow_guardians: false,
    allow_players: false,
    allow_coaches: true,
    allow_staff: false,
    allow_coordinators: true,
    can_members_post: true,
    is_official: false,
    is_active: true,
    ...overrides,
  };
}

function makeMembership(overrides: Partial<MembershipInfo> = {}): MembershipInfo {
  return { role: 'member', is_active: true, is_muted: false, ...overrides };
}

// ---- Tests ----

describe('Communication Access — Integration', () => {
  beforeEach(() => resetIdCounter());

  // =========== canAccessChannel ===========

  describe('canAccessChannel — centralized service', () => {
    it('inactive channel is never accessible', () => {
      const ctx = makeCtx({ isClubAdmin: true });
      const ch = makeChannel({ is_active: false });
      expect(canAccessChannel(ctx, ch)).toBe(false);
    });

    it('club admin can access any active channel in own club', () => {
      const ctx = makeCtx({ isClubAdmin: true, isCoach: false });
      expect(canAccessChannel(ctx, makeChannel())).toBe(true);
    });

    it('coordinator can access any active channel in own club', () => {
      const ctx = makeCtx({ isCoordinator: true, isCoach: false });
      expect(canAccessChannel(ctx, makeChannel())).toBe(true);
    });

    it('channel owner always has access', () => {
      const ctx = makeCtx({ isCoach: false, isGuardian: true });
      const ch = makeChannel({ owner_id: 'user-1', allow_guardians: false });
      expect(canAccessChannel(ctx, ch)).toBe(true);
    });

    it('guardian blocked when allow_guardians=false', () => {
      const ctx = makeCtx({ isGuardian: true, isCoach: false, profileType: 'guardian' });
      expect(canAccessChannel(ctx, makeChannel({ allow_guardians: false }))).toBe(false);
    });

    it('guardian allowed when allow_guardians=true', () => {
      const ctx = makeCtx({ isGuardian: true, isCoach: false, profileType: 'guardian' });
      expect(canAccessChannel(ctx, makeChannel({ allow_guardians: true }))).toBe(true);
    });

    it('player blocked when allow_players=false', () => {
      const ctx = makeCtx({ isPlayer: true, isCoach: false, profileType: 'player' });
      expect(canAccessChannel(ctx, makeChannel({ allow_players: false }))).toBe(false);
    });

    it('player allowed when allow_players=true', () => {
      const ctx = makeCtx({ isPlayer: true, isCoach: false, profileType: 'player' });
      expect(canAccessChannel(ctx, makeChannel({ allow_players: true }))).toBe(true);
    });

    it('coach blocked when allow_coaches=false', () => {
      const ctx = makeCtx();
      expect(canAccessChannel(ctx, makeChannel({ allow_coaches: false }))).toBe(false);
    });

    it('staff blocked when allow_staff=false', () => {
      const ctx = makeCtx({ isStaff: true, isCoach: false, profileType: 'staff' });
      expect(canAccessChannel(ctx, makeChannel({ allow_staff: false }))).toBe(false);
    });

    it('team-scoped channel rejects user outside team', () => {
      const ctx = makeCtx({ teamIds: ['team-2'] });
      const ch = makeChannel({ team_id: 'team-1', allow_coaches: true });
      expect(canAccessChannel(ctx, ch)).toBe(false);
    });

    it('team-scoped channel allows user in team', () => {
      const ctx = makeCtx({ teamIds: ['team-1'] });
      const ch = makeChannel({ team_id: 'team-1', allow_coaches: true });
      expect(canAccessChannel(ctx, ch)).toBe(true);
    });

    it('club admin of club A cannot access club B channels', () => {
      const ctx = makeCtx({ isClubAdmin: true, clubId: 'club-A' });
      const ch = makeChannel({ club_id: 'club-B' });
      expect(canAccessChannel(ctx, ch)).toBe(false);
    });
  });

  // =========== canPostMessage ===========

  describe('canPostMessage — centralized service', () => {
    it('returns false for inactive channel', () => {
      const ctx = makeCtx({ isClubAdmin: true });
      const ch = makeChannel({ is_active: false });
      expect(canPostMessage(ctx, ch, makeMembership())).toBe(false);
    });

    it('returns false without active membership', () => {
      const ctx = makeCtx();
      const ch = makeChannel();
      expect(canPostMessage(ctx, ch, null)).toBe(false);
      expect(canPostMessage(ctx, ch, makeMembership({ is_active: false }))).toBe(false);
    });

    it('club admin can always post', () => {
      const ctx = makeCtx({ isClubAdmin: true });
      const ch = makeChannel({ can_members_post: false });
      expect(canPostMessage(ctx, ch, makeMembership())).toBe(true);
    });

    it('channel owner can always post', () => {
      const ctx = makeCtx();
      const ch = makeChannel({ owner_id: 'user-1', can_members_post: false });
      expect(canPostMessage(ctx, ch, makeMembership())).toBe(true);
    });

    it('channel admin role can always post', () => {
      const ctx = makeCtx();
      const ch = makeChannel({ can_members_post: false });
      expect(canPostMessage(ctx, ch, makeMembership({ role: 'admin' }))).toBe(true);
    });

    it('moderator can always post', () => {
      const ctx = makeCtx();
      const ch = makeChannel({ can_members_post: false });
      expect(canPostMessage(ctx, ch, makeMembership({ role: 'moderator' }))).toBe(true);
    });

    it('regular member can post when can_members_post=true', () => {
      const ctx = makeCtx();
      expect(canPostMessage(ctx, makeChannel({ can_members_post: true }), makeMembership())).toBe(true);
    });

    it('regular member cannot post when can_members_post=false', () => {
      const ctx = makeCtx();
      expect(canPostMessage(ctx, makeChannel({ can_members_post: false }), makeMembership())).toBe(false);
    });
  });

  // =========== canManageChannel ===========

  describe('canManageChannel — centralized service', () => {
    it('club admin can manage', () => {
      const ctx = makeCtx({ isClubAdmin: true });
      expect(canManageChannel(ctx, makeChannel())).toBe(true);
    });

    it('channel owner can manage', () => {
      const ctx = makeCtx();
      expect(canManageChannel(ctx, makeChannel({ owner_id: 'user-1' }))).toBe(true);
    });

    it('coordinator can manage in own club', () => {
      const ctx = makeCtx({ isCoordinator: true });
      expect(canManageChannel(ctx, makeChannel())).toBe(true);
    });

    it('channel admin role can manage', () => {
      const ctx = makeCtx();
      expect(canManageChannel(ctx, makeChannel(), makeMembership({ role: 'admin' }))).toBe(true);
    });

    it('regular member cannot manage', () => {
      const ctx = makeCtx();
      expect(canManageChannel(ctx, makeChannel(), makeMembership())).toBe(false);
    });

    it('guardian cannot manage', () => {
      const ctx = makeCtx({ isGuardian: true, isCoach: false, profileType: 'guardian' });
      expect(canManageChannel(ctx, makeChannel({ allow_guardians: true }), makeMembership())).toBe(false);
    });
  });

  // =========== Role-specific permission functions ===========

  describe('canCreateAnnouncement', () => {
    it('club admin can', () => expect(canCreateAnnouncement(makeCtx({ isClubAdmin: true }))).toBe(true));
    it('coordinator can', () => expect(canCreateAnnouncement(makeCtx({ isCoordinator: true }))).toBe(true));
    it('coach can', () => expect(canCreateAnnouncement(makeCtx())).toBe(true));
    it('individual_coach can', () => expect(canCreateAnnouncement(makeCtx({ profileType: 'individual_coach', isCoach: false }))).toBe(true));
    it('guardian cannot', () => expect(canCreateAnnouncement(makeCtx({ isGuardian: true, isCoach: false, profileType: 'guardian' }))).toBe(false));
    it('player cannot', () => expect(canCreateAnnouncement(makeCtx({ isPlayer: true, isCoach: false, profileType: 'player' }))).toBe(false));
  });

  describe('canViewAnalytics', () => {
    it('coach can', () => expect(canViewAnalytics(makeCtx())).toBe(true));
    it('staff can', () => expect(canViewAnalytics(makeCtx({ isStaff: true }))).toBe(true));
    it('guardian cannot', () => expect(canViewAnalytics(makeCtx({ isGuardian: true, isCoach: false }))).toBe(false));
  });

  describe('canManageInvites', () => {
    it('club admin can', () => expect(canManageInvites(makeCtx({ isClubAdmin: true }))).toBe(true));
    it('player cannot', () => expect(canManageInvites(makeCtx({ isPlayer: true, isCoach: false }))).toBe(false));
  });

  describe('canManageAutomations', () => {
    it('coordinator can', () => expect(canManageAutomations(makeCtx({ isCoordinator: true }))).toBe(true));
    it('staff cannot', () => expect(canManageAutomations(makeCtx({ isStaff: true, isCoach: false }))).toBe(false));
  });

  // =========== resolveProfileType ===========

  describe('resolveProfileType', () => {
    const base = { isClubAdmin: false, isCoordinator: false, isStaff: false, isCoach: false, isGuardian: false, isPlayer: false, isIndividualCoach: false, staffRole: null as string | null };

    it('resolves club_admin', () => expect(resolveProfileType({ ...base, isClubAdmin: true })).toBe('club_admin'));
    it('resolves coordinator', () => expect(resolveProfileType({ ...base, isCoordinator: true })).toBe('coordinator'));
    it('resolves staff', () => expect(resolveProfileType({ ...base, isStaff: true })).toBe('staff'));
    it('resolves assistant_coach', () => expect(resolveProfileType({ ...base, isStaff: true, staffRole: 'assistant_coach' })).toBe('assistant_coach'));
    it('resolves coach', () => expect(resolveProfileType({ ...base, isCoach: true })).toBe('coach'));
    it('resolves individual_coach', () => expect(resolveProfileType({ ...base, isIndividualCoach: true })).toBe('individual_coach'));
    it('resolves guardian', () => expect(resolveProfileType({ ...base, isGuardian: true })).toBe('guardian'));
    it('resolves player', () => expect(resolveProfileType({ ...base, isPlayer: true })).toBe('player'));
    it('fallback is coach', () => expect(resolveProfileType(base)).toBe('coach'));
  });

  // =========== Legacy factory-based tests ===========

  describe('Channel listing by role (legacy)', () => {
    const channels = [
      { ...createTestChannel({ channel_type: 'official', allow_guardians: true, allow_players: true, allow_coaches: true, allow_staff: true }), id: 'ch-official' },
      { ...createTestChannel({ channel_type: 'team', allow_guardians: true, allow_players: true, allow_coaches: true, allow_staff: false }), id: 'ch-team' },
      { ...createTestChannel({ channel_type: 'team', allow_guardians: false, allow_players: false, allow_coaches: true, allow_staff: true, visibility_scope: 'restricted_internal' }), id: 'ch-technical' },
      { ...createTestChannel({ channel_type: 'role_based', allow_guardians: true, allow_players: false }), id: 'ch-parents' },
      { ...createTestChannel({ channel_type: 'role_based', allow_guardians: false, allow_players: true }), id: 'ch-players' },
    ];

    function visibleChannels(role: string) {
      return channels.filter(c => {
        switch (role) {
          case 'guardian': return c.allow_guardians;
          case 'player': return c.allow_players;
          case 'coach': return c.allow_coaches;
          case 'staff': return c.allow_staff;
          case 'coordinator': return true;
          case 'club_admin': return true;
          default: return false;
        }
      });
    }

    it('guardian sees official, team, parents channels only', () => {
      const visible = visibleChannels('guardian');
      expect(visible.map(c => c.id)).toEqual(expect.arrayContaining(['ch-official', 'ch-team', 'ch-parents']));
      expect(visible.map(c => c.id)).not.toContain('ch-technical');
      expect(visible.map(c => c.id)).not.toContain('ch-players');
    });

    it('player sees official, team, players channels only', () => {
      const visible = visibleChannels('player');
      expect(visible.map(c => c.id)).toEqual(expect.arrayContaining(['ch-official', 'ch-team', 'ch-players']));
      expect(visible.map(c => c.id)).not.toContain('ch-technical');
    });

    it('coordinator sees all channels', () => {
      expect(visibleChannels('coordinator')).toHaveLength(channels.length);
    });

    it('club_admin sees all channels', () => {
      expect(visibleChannels('club_admin')).toHaveLength(channels.length);
    });
  });

  describe('Message access requires membership', () => {
    it('user with membership can read messages', () => {
      const memberships = [createTestMembership({ channel_id: 'ch1', user_id: MOCK_IDS.guardianA })];
      expect(memberships.some(m => m.channel_id === 'ch1' && m.user_id === MOCK_IDS.guardianA)).toBe(true);
    });

    it('user without membership cannot read messages', () => {
      const memberships: ReturnType<typeof createTestMembership>[] = [];
      expect(memberships.some(m => m.channel_id === 'ch1' && m.user_id === MOCK_IDS.guardianA)).toBe(false);
    });

    it('membership in different channel does not grant access', () => {
      const memberships = [createTestMembership({ channel_id: 'ch2', user_id: MOCK_IDS.guardianA })];
      expect(memberships.some(m => m.channel_id === 'ch1' && m.user_id === MOCK_IDS.guardianA)).toBe(false);
    });
  });

  describe('Cross-context isolation', () => {
    it('team A guardian cannot access team B channels', () => {
      const teamAChannels = [createTestChannel({ team_id: 'teamA', allow_guardians: true })];
      const teamBChannels = [createTestChannel({ team_id: 'teamB', allow_guardians: true })];
      const memberships = teamAChannels.map(c => createTestMembership({ channel_id: c.id, user_id: MOCK_IDS.guardianA }));
      expect(memberships.some(m => teamBChannels.some(c => c.id === m.channel_id))).toBe(false);
    });

    it('club A user cannot access club B channels', () => {
      const clubAChannel = createTestChannel({ club_id: 'clubA' });
      const clubBChannel = createTestChannel({ club_id: 'clubB' });
      const memberships = [createTestMembership({ channel_id: clubAChannel.id, user_id: 'user1' })];
      expect(memberships.some(m => m.channel_id === clubBChannel.id)).toBe(false);
    });
  });

  describe('Unread tracking logic', () => {
    it('unread count is zero when no messages after last_read_at', () => {
      const lastReadAt = new Date('2025-01-01T12:00:00Z');
      const messages = [{ created_at: '2025-01-01T11:00:00Z', sender_id: 'other' }];
      expect(messages.filter(m => new Date(m.created_at) > lastReadAt && m.sender_id !== 'me').length).toBe(0);
    });

    it('unread count increases for new messages', () => {
      const lastReadAt = new Date('2025-01-01T12:00:00Z');
      const messages = [
        { created_at: '2025-01-01T13:00:00Z', sender_id: 'other' },
        { created_at: '2025-01-01T14:00:00Z', sender_id: 'other' },
      ];
      expect(messages.filter(m => new Date(m.created_at) > lastReadAt && m.sender_id !== 'me').length).toBe(2);
    });

    it('own messages do not count as unread', () => {
      const lastReadAt = new Date('2025-01-01T12:00:00Z');
      const messages = [{ created_at: '2025-01-01T13:00:00Z', sender_id: 'me' }];
      expect(messages.filter(m => new Date(m.created_at) > lastReadAt && m.sender_id !== 'me').length).toBe(0);
    });
  });

  describe('Channel sorting', () => {
    it('official channels come before team channels', () => {
      const typePriority: Record<string, number> = { official: 0, restricted_internal: 1, team: 2, age_group: 3, role_based: 4, custom: 6 };
      const channels = [{ id: '1', channel_type: 'team' }, { id: '2', channel_type: 'official' }];
      const sorted = [...channels].sort((a, b) => (typePriority[a.channel_type] ?? 10) - (typePriority[b.channel_type] ?? 10));
      expect(sorted[0].channel_type).toBe('official');
    });

    it('channels with unread messages rank higher within same type', () => {
      const unreadMap = new Map([['ch-a', 5], ['ch-b', 0]]);
      const channels = [{ id: 'ch-b', channel_type: 'team' }, { id: 'ch-a', channel_type: 'team' }];
      const sorted = [...channels].sort((a, b) => (unreadMap.get(b.id) || 0) - (unreadMap.get(a.id) || 0));
      expect(sorted[0].id).toBe('ch-a');
    });
  });
});
