/**
 * Channel visibility rules by channel type.
 * Determines which role flags a channel type requires.
 */

import type { AccessContext, ChannelInfo } from './communication-access-service';

/**
 * Check if a channel type inherently blocks this profile,
 * independent of allow_* flags. This enforces structural rules like
 * "players_team is never visible to guardians" regardless of allow_guardians.
 */
export function isChannelTypeBlockedForProfile(
  channelType: string,
  ctx: AccessContext,
): boolean {
  // Players team: guardians never see it
  if (channelType === 'players_team' && ctx.isGuardian && !ctx.isClubAdmin && !ctx.isCoordinator) {
    return true;
  }
  // Parents team: players never see it
  if (channelType === 'parents_team' && ctx.isPlayer && !ctx.isClubAdmin && !ctx.isCoordinator) {
    return true;
  }
  // Internal channels: consumers never see them
  if (
    (channelType === 'coaches_internal' ||
      channelType === 'staff_internal' ||
      channelType === 'coordination_internal') &&
    (ctx.isPlayer || ctx.isGuardian) &&
    !ctx.isClubAdmin
  ) {
    return true;
  }
  return false;
}

/**
 * Validate team scope: if channel is team-scoped, user must belong to that team.
 * Returns true if scope check passes (or doesn't apply).
 */
export function passesTeamScopeCheck(ctx: AccessContext, channel: ChannelInfo): boolean {
  if (!channel.team_id) return true; // Not team-scoped
  if (ctx.teamIds.length === 0) return true; // No team info available, defer to membership
  return ctx.teamIds.includes(channel.team_id);
}

/**
 * Check role-based allow flags on the channel.
 * Returns false if the user's role is explicitly blocked.
 */
export function passesRoleAllowCheck(ctx: AccessContext, channel: ChannelInfo): boolean {
  if (ctx.isGuardian && !channel.allow_guardians) return false;
  if (ctx.isPlayer && !channel.allow_players) return false;
  if (ctx.isCoach && !channel.allow_coaches) return false;
  if (ctx.isStaff && !channel.allow_staff) return false;
  return true;
}
