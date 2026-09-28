/**
 * Centralized communication access & permission service.
 * All authorization decisions for the communication module flow through here.
 *
 * Precedence order:
 * 1. Club isolation
 * 2. Team / scope isolation
 * 3. Explicit membership
 * 4. Institutional role (club_admin / coordinator)
 * 5. Channel config (allow_*, can_members_post, visibility_scope)
 * 6. Member overrides (can_post_override, mute)
 */

import type { CommunicationProfileType, CommunicationChannelType, AnnouncementScope } from './communication-permissions';
import {
  isInstitutionalRole,
  isConsumerRole,
  isOperationalRole,
  getAllowedChannelTypes,
  getAllowedAnnouncementScopes,
} from './communication-permissions';
import {
  isChannelTypeBlockedForProfile,
  passesTeamScopeCheck,
  passesRoleAllowCheck,
} from './communication-visibility';

// Re-export types from permissions for convenience
export type { CommunicationProfileType, CommunicationChannelType, AnnouncementScope };
export type ProfileType = CommunicationProfileType;

export interface AccessContext {
  userId: string;
  profileType: ProfileType;
  clubId: string | null;
  teamIds: string[];
  ageGroupIds: string[];
  playerIds: string[];
  guardianId: string | null;
  isClubAdmin: boolean;
  isCoordinator: boolean;
  isCoach: boolean;
  isStaff: boolean;
  isGuardian: boolean;
  isPlayer: boolean;
}

export interface ChannelInfo {
  id: string;
  club_id: string | null;
  owner_id: string | null;
  team_id: string | null;
  channel_type: string;
  visibility_scope: string;
  allow_guardians: boolean;
  allow_players: boolean;
  allow_coaches: boolean;
  allow_staff: boolean;
  allow_coordinators: boolean;
  can_members_post: boolean;
  is_official: boolean;
  is_active: boolean;
}

export interface MembershipInfo {
  role: string;
  is_active: boolean;
  is_muted: boolean;
}

// =========================================================================
// CHANNEL ACCESS
// =========================================================================

/**
 * Can the user see / access a channel?
 * Applies full precedence: club isolation → channel type block → institutional override →
 * ownership → role flags → team scope.
 */
export function canAccessChannel(ctx: AccessContext, channel: ChannelInfo): boolean {
  // 0. Inactive channels are never accessible
  if (!channel.is_active) return false;

  // 1. Club isolation
  if (channel.club_id && ctx.clubId && channel.club_id !== ctx.clubId) return false;

  // 2. Channel type structural block (e.g. guardian can't see players_team)
  if (isChannelTypeBlockedForProfile(channel.channel_type, ctx)) return false;

  // 3. Institutional roles: club_admin and coordinator bypass role flags within their club
  if (ctx.isClubAdmin && channel.club_id === ctx.clubId) return true;
  if (ctx.isCoordinator && channel.club_id === ctx.clubId) return true;

  // 4. Channel owner always has access
  if (channel.owner_id === ctx.userId) return true;

  // 5. Role-based allow flags
  if (!passesRoleAllowCheck(ctx, channel)) return false;

  // 6. Team scope check
  if (!passesTeamScopeCheck(ctx, channel)) return false;

  return true;
}

// =========================================================================
// MESSAGE POSTING
// =========================================================================

export function canPostMessage(
  ctx: AccessContext,
  channel: ChannelInfo,
  membership?: MembershipInfo | null,
): boolean {
  if (!channel.is_active) return false;
  if (!membership?.is_active) return false;

  // Institutional / owner can always post
  if (ctx.isClubAdmin && channel.club_id === ctx.clubId) return true;
  if (channel.owner_id === ctx.userId) return true;
  if (membership.role === 'admin' || membership.role === 'moderator') return true;

  return channel.can_members_post;
}

// =========================================================================
// CHANNEL MANAGEMENT
// =========================================================================

export function canManageChannel(
  ctx: AccessContext,
  channel: ChannelInfo,
  membership?: MembershipInfo | null,
): boolean {
  if (ctx.isClubAdmin && channel.club_id === ctx.clubId) return true;
  if (channel.owner_id === ctx.userId) return true;
  if (ctx.isCoordinator && channel.club_id === ctx.clubId) return true;
  if (membership?.role === 'admin') return true;
  return false;
}

/**
 * Can pin/unpin messages — same as manage.
 */
export function canPinMessage(
  ctx: AccessContext,
  channel: ChannelInfo,
  membership?: MembershipInfo | null,
): boolean {
  return canManageChannel(ctx, channel, membership);
}

// =========================================================================
// CHANNEL CREATION
// =========================================================================

export function canCreateChannel(ctx: AccessContext): boolean {
  return getAllowedChannelTypes(ctx.profileType).length > 0;
}

export function canCreateChannelOfType(ctx: AccessContext, channelType: string): boolean {
  return getAllowedChannelTypes(ctx.profileType).includes(channelType as CommunicationChannelType);
}

export function getCreatableChannelTypes(ctx: AccessContext): CommunicationChannelType[] {
  return getAllowedChannelTypes(ctx.profileType);
}

// =========================================================================
// ANNOUNCEMENTS
// =========================================================================

export function canCreateAnnouncement(ctx: AccessContext): boolean {
  return getAllowedAnnouncementScopes(ctx.profileType).length > 0;
}

export function canCreateAnnouncementWithScope(ctx: AccessContext, scope: AnnouncementScope): boolean {
  return getAllowedAnnouncementScopes(ctx.profileType).includes(scope);
}

export function getAnnouncementScopes(ctx: AccessContext): AnnouncementScope[] {
  return getAllowedAnnouncementScopes(ctx.profileType);
}

// =========================================================================
// ATTENDANCE
// =========================================================================

export function canCreateAttendanceRequest(ctx: AccessContext): boolean {
  return isOperationalRole(ctx.profileType);
}

export function canRespondAttendance(ctx: AccessContext): boolean {
  // Everyone can respond to attendance in their context
  return true;
}

// =========================================================================
// CALLUP
// =========================================================================

export function canPublishCallup(ctx: AccessContext): boolean {
  return isOperationalRole(ctx.profileType);
}

export function canRespondCallup(ctx: AccessContext): boolean {
  // Players and guardians respond to callups
  return true;
}

// =========================================================================
// ANALYTICS
// =========================================================================

export function canViewAnalytics(ctx: AccessContext): boolean {
  return ctx.isClubAdmin || ctx.isCoordinator || ctx.isCoach || ctx.isStaff;
}

// =========================================================================
// TEMPLATES
// =========================================================================

export function canManageTemplates(ctx: AccessContext): boolean {
  return isOperationalRole(ctx.profileType) || ctx.isStaff;
}

// =========================================================================
// AUTOMATIONS
// =========================================================================

export function canManageAutomations(ctx: AccessContext): boolean {
  return ctx.isClubAdmin || ctx.isCoordinator || ctx.isCoach;
}

// =========================================================================
// INVITES
// =========================================================================

export function canManageInvites(ctx: AccessContext): boolean {
  return ctx.isClubAdmin || ctx.isCoordinator || ctx.isCoach || ctx.isStaff;
}

// =========================================================================
// COMPOSITE PERMISSION CHECK — "canManage" replacement
// =========================================================================

/**
 * Whether the user has any operational/management capability in communication.
 * Use this instead of ad-hoc `canManage` booleans.
 */
export function hasOperationalAccess(ctx: AccessContext): boolean {
  return isOperationalRole(ctx.profileType) || ctx.isStaff;
}

// =========================================================================
// PROFILE TYPE RESOLVER
// =========================================================================

/**
 * Resolve the profileType from useUserRole data.
 */
export function resolveProfileType(role: {
  isClubAdmin: boolean;
  isCoordinator: boolean;
  isStaff: boolean;
  isCoach: boolean;
  isGuardian: boolean;
  isPlayer: boolean;
  isIndividualCoach: boolean;
  staffRole: string | null;
}): ProfileType {
  if (role.isClubAdmin) return 'club_admin';
  if (role.isCoordinator) return 'coordinator';
  if (role.isStaff) {
    if (role.staffRole === 'assistant_coach') return 'assistant_coach';
    return 'staff';
  }
  if (role.isCoach) return 'coach';
  if (role.isIndividualCoach) return 'individual_coach';
  if (role.isGuardian) return 'guardian';
  if (role.isPlayer) return 'player';
  return 'coach'; // fallback
}
