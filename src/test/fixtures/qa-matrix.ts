/**
 * QA Permission Matrix — defines expected access for each role.
 * Used by automated tests to validate access control.
 */

export interface QAPermissionEntry {
  role: string;
  canCreateInvite: boolean;
  canAcceptInvite: boolean;
  canViewOfficialChannel: boolean;
  canViewTechnicalChannel: boolean;
  canViewParentsChannel: boolean;
  canViewPlayersChannel: boolean;
  canViewOtherPlayer: boolean;
  canViewOtherAgeGroup: boolean;
  canSendMessages: boolean;
  canManageMembers: boolean;
  canCreateChannel: boolean;
  canViewCalendar: boolean;
  canViewCallups: boolean;
}

export const QA_PERMISSION_MATRIX: QAPermissionEntry[] = [
  {
    role: 'club_admin',
    canCreateInvite: true, canAcceptInvite: false,
    canViewOfficialChannel: true, canViewTechnicalChannel: true,
    canViewParentsChannel: true, canViewPlayersChannel: true,
    canViewOtherPlayer: true, canViewOtherAgeGroup: true,
    canSendMessages: true, canManageMembers: true,
    canCreateChannel: true, canViewCalendar: true, canViewCallups: true,
  },
  {
    role: 'coordinator',
    canCreateInvite: true, canAcceptInvite: true,
    canViewOfficialChannel: true, canViewTechnicalChannel: true,
    canViewParentsChannel: true, canViewPlayersChannel: true,
    canViewOtherPlayer: true, canViewOtherAgeGroup: true,
    canSendMessages: true, canManageMembers: true,
    canCreateChannel: true, canViewCalendar: true, canViewCallups: true,
  },
  {
    role: 'coach',
    canCreateInvite: true, canAcceptInvite: true,
    canViewOfficialChannel: true, canViewTechnicalChannel: true,
    canViewParentsChannel: true, canViewPlayersChannel: true,
    canViewOtherPlayer: false, canViewOtherAgeGroup: false,
    canSendMessages: true, canManageMembers: false,
    canCreateChannel: true, canViewCalendar: true, canViewCallups: true,
  },
  {
    role: 'assistant_coach',
    canCreateInvite: false, canAcceptInvite: true,
    canViewOfficialChannel: true, canViewTechnicalChannel: true,
    canViewParentsChannel: false, canViewPlayersChannel: false,
    canViewOtherPlayer: false, canViewOtherAgeGroup: false,
    canSendMessages: true, canManageMembers: false,
    canCreateChannel: false, canViewCalendar: true, canViewCallups: true,
  },
  {
    role: 'staff',
    canCreateInvite: false, canAcceptInvite: true,
    canViewOfficialChannel: true, canViewTechnicalChannel: false,
    canViewParentsChannel: false, canViewPlayersChannel: false,
    canViewOtherPlayer: false, canViewOtherAgeGroup: false,
    canSendMessages: true, canManageMembers: false,
    canCreateChannel: false, canViewCalendar: true, canViewCallups: false,
  },
  {
    role: 'guardian',
    canCreateInvite: false, canAcceptInvite: true,
    canViewOfficialChannel: true, canViewTechnicalChannel: false,
    canViewParentsChannel: true, canViewPlayersChannel: false,
    canViewOtherPlayer: false, canViewOtherAgeGroup: false,
    canSendMessages: true, canManageMembers: false,
    canCreateChannel: false, canViewCalendar: true, canViewCallups: true,
  },
  {
    role: 'player',
    canCreateInvite: false, canAcceptInvite: true,
    canViewOfficialChannel: true, canViewTechnicalChannel: false,
    canViewParentsChannel: false, canViewPlayersChannel: true,
    canViewOtherPlayer: false, canViewOtherAgeGroup: false,
    canSendMessages: true, canManageMembers: false,
    canCreateChannel: false, canViewCalendar: true, canViewCallups: true,
  },
  {
    role: 'individual_coach',
    canCreateInvite: true, canAcceptInvite: false,
    canViewOfficialChannel: true, canViewTechnicalChannel: true,
    canViewParentsChannel: true, canViewPlayersChannel: true,
    canViewOtherPlayer: false, canViewOtherAgeGroup: false,
    canSendMessages: true, canManageMembers: true,
    canCreateChannel: true, canViewCalendar: true, canViewCallups: true,
  },
];
