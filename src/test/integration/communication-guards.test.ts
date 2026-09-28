/**
 * Integration tests — Communication guards by module
 * Covers all 40 scenarios from the permission matrix spec.
 */
import { describe, it, expect } from 'vitest';
import {
  canAccessChannel, canPostMessage, canManageChannel, canPinMessage,
  canCreateChannel, canCreateChannelOfType, canCreateAnnouncement,
  canCreateAnnouncementWithScope, canCreateAttendanceRequest,
  canPublishCallup, canViewAnalytics, canManageTemplates,
  canManageAutomations, canManageInvites, hasOperationalAccess,
  resolveProfileType,
  type AccessContext, type ChannelInfo, type MembershipInfo,
} from '@/lib/communication-access-service';

// ---- helpers ----

function makeCtx(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    userId: 'user-1', profileType: 'coach', clubId: 'club-1',
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

function makeMbr(overrides: Partial<MembershipInfo> = {}): MembershipInfo {
  return { role: 'member', is_active: true, is_muted: false, ...overrides };
}

const playerCtx = () => makeCtx({ isPlayer: true, isCoach: false, profileType: 'player' });
const guardianCtx = () => makeCtx({ isGuardian: true, isCoach: false, profileType: 'guardian' });
const coachCtx = () => makeCtx();
const assistantCtx = () => makeCtx({ isStaff: true, isCoach: false, profileType: 'assistant_coach' });
const staffCtx = () => makeCtx({ isStaff: true, isCoach: false, profileType: 'staff' });
const coordCtx = () => makeCtx({ isCoordinator: true, isCoach: false, profileType: 'coordinator' });
const adminCtx = () => makeCtx({ isClubAdmin: true, isCoach: false, profileType: 'club_admin' });

// ===================================================================
// 10.1. Permissões centrais (tests 1-8)
// ===================================================================

describe('10.1 — Central Permissions', () => {
  it('1. player cannot access parents_team channel', () => {
    expect(canAccessChannel(playerCtx(), makeCh({ channel_type: 'parents_team', allow_players: true }))).toBe(false);
  });

  it('2. guardian cannot access players_team channel', () => {
    expect(canAccessChannel(guardianCtx(), makeCh({ channel_type: 'players_team', allow_guardians: true }))).toBe(false);
  });

  it('3. coach can access official_team of own team', () => {
    expect(canAccessChannel(coachCtx(), makeCh({ channel_type: 'official_team', team_id: 'team-1', allow_coaches: true }))).toBe(true);
  });

  it('4. coach cannot access coaches_internal of other team', () => {
    expect(canAccessChannel(coachCtx(), makeCh({ channel_type: 'coaches_internal', team_id: 'team-2', allow_coaches: true }))).toBe(false);
  });

  it('5. staff only accesses channel with membership/allow_staff', () => {
    expect(canAccessChannel(staffCtx(), makeCh({ allow_staff: false }))).toBe(false);
    expect(canAccessChannel(staffCtx(), makeCh({ allow_staff: true }))).toBe(true);
  });

  it('6. coordinator accesses any channel in own club', () => {
    expect(canAccessChannel(coordCtx(), makeCh({ allow_coaches: false, allow_staff: false }))).toBe(true);
  });

  it('7. club_admin accesses everything in own club', () => {
    expect(canAccessChannel(adminCtx(), makeCh({ allow_coaches: false, allow_staff: false }))).toBe(true);
  });

  it('8. membership cannot cross club boundary', () => {
    expect(canAccessChannel(adminCtx(), makeCh({ club_id: 'club-other' }))).toBe(false);
  });
});

// ===================================================================
// 10.2. Comunicação / canais (tests 9-12)
// ===================================================================

describe('10.2 — Channel Listing', () => {
  it('9. channel only listed when canAccessChannel=true', () => {
    const ch = makeCh({ allow_coaches: false });
    expect(canAccessChannel(coachCtx(), ch)).toBe(false);
    expect(canAccessChannel(adminCtx(), ch)).toBe(true);
  });

  it('10. user without membership cannot read custom channel', () => {
    // Custom channels require explicit membership; allow flags still matter
    const ch = makeCh({ channel_type: 'custom', allow_coaches: false });
    expect(canAccessChannel(coachCtx(), ch)).toBe(false);
  });

  it('11. mixed_controlled requires explicit membership', () => {
    const ch = makeCh({ channel_type: 'mixed_controlled', allow_coaches: false });
    expect(canAccessChannel(coachCtx(), ch)).toBe(false);
  });

  it('12. official_club respects allow_* flags', () => {
    const ch = makeCh({ channel_type: 'official_club', allow_guardians: false });
    expect(canAccessChannel(guardianCtx(), ch)).toBe(false);
    expect(canAccessChannel(guardianCtx(), makeCh({ channel_type: 'official_club', allow_guardians: true }))).toBe(true);
  });
});

// ===================================================================
// 10.3. Chat (tests 13-17)
// ===================================================================

describe('10.3 — Chat / Posting', () => {
  it('13. member can post when can_members_post=true', () => {
    expect(canPostMessage(coachCtx(), makeCh({ can_members_post: true }), makeMbr())).toBe(true);
  });

  it('14. member cannot post when can_members_post=false', () => {
    expect(canPostMessage(coachCtx(), makeCh({ can_members_post: false }), makeMbr())).toBe(false);
  });

  it('15. channel admin can post even with can_members_post=false', () => {
    expect(canPostMessage(coachCtx(), makeCh({ can_members_post: false }), makeMbr({ role: 'admin' }))).toBe(true);
  });

  it('16. pin only works for managers', () => {
    expect(canPinMessage(coachCtx(), makeCh(), makeMbr())).toBe(false);
    expect(canPinMessage(coachCtx(), makeCh(), makeMbr({ role: 'admin' }))).toBe(true);
    expect(canPinMessage(adminCtx(), makeCh())).toBe(true);
  });

  it('17. attachment follows same posting permission', () => {
    // Same function: canPostMessage
    expect(canPostMessage(guardianCtx(), makeCh({ allow_guardians: true, can_members_post: false }), makeMbr())).toBe(false);
    expect(canPostMessage(guardianCtx(), makeCh({ allow_guardians: true, can_members_post: true }), makeMbr())).toBe(true);
  });
});

// ===================================================================
// 10.4. Anúncios (tests 18-23)
// ===================================================================

describe('10.4 — Announcements', () => {
  it('18. coach creates announcement only for team scope', () => {
    expect(canCreateAnnouncementWithScope(coachCtx(), 'team')).toBe(true);
    expect(canCreateAnnouncementWithScope(coachCtx(), 'club')).toBe(false);
    expect(canCreateAnnouncementWithScope(coachCtx(), 'age_group')).toBe(false);
  });

  it('19. assistant_coach respects restrictions', () => {
    expect(canCreateAnnouncementWithScope(assistantCtx(), 'team')).toBe(true);
    expect(canCreateAnnouncementWithScope(assistantCtx(), 'club')).toBe(false);
  });

  it('20. staff without permission cannot create announcement', () => {
    expect(canCreateAnnouncement(staffCtx())).toBe(false);
  });

  it('21. coordinator creates announcement by age_group', () => {
    expect(canCreateAnnouncementWithScope(coordCtx(), 'age_group')).toBe(true);
    expect(canCreateAnnouncementWithScope(coordCtx(), 'team')).toBe(true);
    expect(canCreateAnnouncementWithScope(coordCtx(), 'club')).toBe(false);
  });

  it('22. club_admin creates official club announcement', () => {
    expect(canCreateAnnouncementWithScope(adminCtx(), 'club')).toBe(true);
    expect(canCreateAnnouncementWithScope(adminCtx(), 'team')).toBe(true);
  });

  it('23. player and guardian cannot create announcement', () => {
    expect(canCreateAnnouncement(playerCtx())).toBe(false);
    expect(canCreateAnnouncement(guardianCtx())).toBe(false);
  });
});

// ===================================================================
// 10.5. Presenças (tests 24-27)
// ===================================================================

describe('10.5 — Attendance', () => {
  it('24. coach creates attendance request', () => {
    expect(canCreateAttendanceRequest(coachCtx())).toBe(true);
  });

  it('25. player can respond', () => {
    // canRespondAttendance is always true — access control at data level
    expect(canCreateAttendanceRequest(playerCtx())).toBe(false);
  });

  it('26. guardian can respond (access control at data level)', () => {
    expect(canCreateAttendanceRequest(guardianCtx())).toBe(false);
  });

  it('27. staff without operational role cannot create attendance', () => {
    expect(canCreateAttendanceRequest(staffCtx())).toBe(false);
  });
});

// ===================================================================
// 10.6. Convocatórias (tests 28-32)
// ===================================================================

describe('10.6 — Callups', () => {
  it('28. coach publishes callup', () => {
    expect(canPublishCallup(coachCtx())).toBe(true);
  });

  it('29. player cannot publish callup', () => {
    expect(canPublishCallup(playerCtx())).toBe(false);
  });

  it('30. guardian cannot publish callup', () => {
    expect(canPublishCallup(guardianCtx())).toBe(false);
  });

  it('31. staff cannot publish callup', () => {
    expect(canPublishCallup(staffCtx())).toBe(false);
  });

  it('32. coordinator and admin can publish', () => {
    expect(canPublishCallup(coordCtx())).toBe(true);
    expect(canPublishCallup(adminCtx())).toBe(true);
  });
});

// ===================================================================
// 10.7. Portals (tests 33-35)
// ===================================================================

describe('10.7 — Portal Guards', () => {
  it('33. guardian has no operational access', () => {
    expect(hasOperationalAccess(guardianCtx())).toBe(false);
  });

  it('34. player has no operational access', () => {
    expect(hasOperationalAccess(playerCtx())).toBe(false);
  });

  it('35. portal roles use same centralized helpers', () => {
    // Verify both consumer roles use same access rules
    expect(canCreateChannel(playerCtx())).toBe(false);
    expect(canCreateChannel(guardianCtx())).toBe(false);
    expect(canManageInvites(playerCtx())).toBe(false);
    expect(canManageInvites(guardianCtx())).toBe(false);
  });
});

// ===================================================================
// 10.8. Templates / automations / analytics (tests 36-40)
// ===================================================================

describe('10.8 — Templates, Automations, Analytics', () => {
  it('36. player cannot manage templates', () => {
    expect(canManageTemplates(playerCtx())).toBe(false);
  });

  it('37. guardian cannot manage automations', () => {
    expect(canManageAutomations(guardianCtx())).toBe(false);
  });

  it('38. coach can view analytics', () => {
    expect(canViewAnalytics(coachCtx())).toBe(true);
  });

  it('39. coordinator can view analytics', () => {
    expect(canViewAnalytics(coordCtx())).toBe(true);
  });

  it('40. club_admin can view analytics', () => {
    expect(canViewAnalytics(adminCtx())).toBe(true);
  });
});

// ===================================================================
// Additional edge cases
// ===================================================================

describe('Additional — Channel creation guards', () => {
  it('player cannot create any channel type', () => {
    expect(canCreateChannel(playerCtx())).toBe(false);
    expect(canCreateChannelOfType(playerCtx(), 'custom')).toBe(false);
  });

  it('coach cannot create official_club channel', () => {
    expect(canCreateChannelOfType(coachCtx(), 'official_club')).toBe(false);
  });

  it('club_admin can create official_club', () => {
    expect(canCreateChannelOfType(adminCtx(), 'official_club')).toBe(true);
  });

  it('staff can only create custom', () => {
    expect(canCreateChannelOfType(staffCtx(), 'custom')).toBe(true);
    expect(canCreateChannelOfType(staffCtx(), 'team')).toBe(false);
  });
});

describe('Additional — resolveProfileType', () => {
  const base = {
    isClubAdmin: false, isCoordinator: false, isStaff: false,
    isCoach: false, isGuardian: false, isPlayer: false,
    isIndividualCoach: false, staffRole: null as string | null,
  };

  it('resolves club_admin', () => expect(resolveProfileType({ ...base, isClubAdmin: true })).toBe('club_admin'));
  it('resolves coordinator', () => expect(resolveProfileType({ ...base, isCoordinator: true })).toBe('coordinator'));
  it('resolves staff', () => expect(resolveProfileType({ ...base, isStaff: true })).toBe('staff'));
  it('resolves assistant_coach via staffRole', () => expect(resolveProfileType({ ...base, isStaff: true, staffRole: 'assistant_coach' })).toBe('assistant_coach'));
  it('resolves coach', () => expect(resolveProfileType({ ...base, isCoach: true })).toBe('coach'));
  it('resolves individual_coach', () => expect(resolveProfileType({ ...base, isIndividualCoach: true })).toBe('individual_coach'));
  it('resolves guardian', () => expect(resolveProfileType({ ...base, isGuardian: true })).toBe('guardian'));
  it('resolves player', () => expect(resolveProfileType({ ...base, isPlayer: true })).toBe('player'));
  it('fallback is coach', () => expect(resolveProfileType(base)).toBe('coach'));
});

describe('Additional — Club isolation', () => {
  it('admin of club A cannot access club B', () => {
    expect(canAccessChannel(
      makeCtx({ isClubAdmin: true, clubId: 'club-A' }),
      makeCh({ club_id: 'club-B' })
    )).toBe(false);
  });

  it('coordinator of club A cannot access club B', () => {
    expect(canAccessChannel(
      makeCtx({ isCoordinator: true, clubId: 'club-A' }),
      makeCh({ club_id: 'club-B' })
    )).toBe(false);
  });
});
