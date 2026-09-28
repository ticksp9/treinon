/**
 * Communication permission types, enums, and matrix.
 * Single source of truth for all permission-related types.
 */

// ---- Profile Types ----
export type CommunicationProfileType =
  | 'player'
  | 'guardian'
  | 'coach'
  | 'assistant_coach'
  | 'staff'
  | 'coordinator'
  | 'club_admin'
  | 'individual_coach';

// ---- Channel Types ----
export type CommunicationChannelType =
  | 'official_club'
  | 'official_team'
  | 'official'
  | 'team'
  | 'age_group'
  | 'parents_team'
  | 'players_team'
  | 'coaches_internal'
  | 'staff_internal'
  | 'coordination_internal'
  | 'restricted_internal'
  | 'mixed_controlled'
  | 'role_based'
  | 'custom';

// ---- Member Roles ----
export type CommunicationMemberRole = 'member' | 'moderator' | 'admin' | 'owner';

// ---- Visibility Scopes ----
export type CommunicationVisibilityScope =
  | 'team_based'
  | 'age_group_based'
  | 'role_based'
  | 'private'
  | 'official_broadcast'
  | 'mixed_custom';

// ---- Actions ----
export type CommunicationAction =
  | 'view_channel'
  | 'post_message'
  | 'manage_channel'
  | 'create_channel'
  | 'pin_message'
  | 'publish_announcement'
  | 'create_attendance_request'
  | 'respond_attendance'
  | 'publish_callup'
  | 'respond_callup'
  | 'view_analytics'
  | 'manage_templates'
  | 'manage_automations'
  | 'manage_invites';

// ---- Helpers ----

/** Institutional roles with elevated access */
export function isInstitutionalRole(profileType: CommunicationProfileType): boolean {
  return profileType === 'club_admin' || profileType === 'coordinator';
}

/** Roles scoped to specific teams */
export function isTeamScopedRole(profileType: CommunicationProfileType): boolean {
  return profileType === 'coach' || profileType === 'assistant_coach' || profileType === 'individual_coach';
}

/** Roles that can manage operational aspects */
export function isOperationalRole(profileType: CommunicationProfileType): boolean {
  return (
    profileType === 'club_admin' ||
    profileType === 'coordinator' ||
    profileType === 'coach' ||
    profileType === 'assistant_coach' ||
    profileType === 'individual_coach'
  );
}

/** Consumer roles (read-mostly) */
export function isConsumerRole(profileType: CommunicationProfileType): boolean {
  return profileType === 'player' || profileType === 'guardian';
}

/** Channel types that require explicit membership (no role-based auto-access) */
export function requiresExplicitMembership(channelType: string): boolean {
  return channelType === 'mixed_controlled' || channelType === 'custom' || channelType === 'restricted_internal';
}

/** Channel types creatable by each profile */
export function getAllowedChannelTypes(profileType: CommunicationProfileType): CommunicationChannelType[] {
  switch (profileType) {
    case 'club_admin':
      return [
        'official_club', 'official_team', 'official', 'team', 'age_group',
        'parents_team', 'players_team', 'coaches_internal', 'staff_internal',
        'coordination_internal', 'restricted_internal', 'mixed_controlled',
        'role_based', 'custom',
      ];
    case 'coordinator':
      return [
        'official_team', 'official', 'team', 'age_group', 'parents_team',
        'players_team', 'coaches_internal', 'coordination_internal',
        'mixed_controlled', 'role_based', 'custom',
      ];
    case 'coach':
    case 'individual_coach':
      return ['team', 'parents_team', 'players_team', 'mixed_controlled', 'role_based', 'custom'];
    case 'assistant_coach':
      return ['team', 'mixed_controlled', 'custom'];
    case 'staff':
      return ['custom'];
    case 'player':
    case 'guardian':
      return []; // Cannot create channels
    default:
      return [];
  }
}

/** Announcement scope restrictions by profile */
export type AnnouncementScope = 'club' | 'age_group' | 'team' | 'channel' | 'role';

export function getAllowedAnnouncementScopes(profileType: CommunicationProfileType): AnnouncementScope[] {
  switch (profileType) {
    case 'club_admin':
      return ['club', 'age_group', 'team', 'channel', 'role'];
    case 'coordinator':
      return ['age_group', 'team', 'channel', 'role'];
    case 'coach':
    case 'individual_coach':
      return ['team', 'channel'];
    case 'assistant_coach':
      return ['team', 'channel'];
    default:
      return [];
  }
}
