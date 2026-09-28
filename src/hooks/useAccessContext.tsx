import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { AccessContext, resolveProfileType } from '@/lib/communication-access-service';

/**
 * Central access context hook for the communication module.
 * Resolves the current user's identity, roles, and scopes.
 */
export function useAccessContext(): { ctx: AccessContext | null; loading: boolean } {
  const { user } = useAuth();
  const role = useUserRole();

  const ctx = useMemo<AccessContext | null>(() => {
    if (!user || role.loading) return null;

    return {
      userId: user.id,
      profileType: resolveProfileType(role),
      clubId: role.clubId,
      teamIds: [], // populated by channel queries / team membership
      ageGroupIds: [],
      playerIds: role.playerId ? [role.playerId] : [],
      guardianId: role.guardianId,
      isClubAdmin: role.isClubAdmin,
      isCoordinator: role.isCoordinator,
      isCoach: role.isCoach,
      isStaff: role.isStaff,
      isGuardian: role.isGuardian,
      isPlayer: role.isPlayer,
    };
  }, [user, role]);

  return { ctx, loading: !user || role.loading };
}
