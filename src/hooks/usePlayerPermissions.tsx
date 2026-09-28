// Hook that resolves PlayerPermissionContext from auth + DB scopes.
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import type { PlayerPermissionContext } from '@/lib/player-permissions';

export function usePlayerPermissions(): PlayerPermissionContext & { loading: boolean } {
  const { user } = useAuth();
  const role = useUserRole();
  const [coachedTeamIds, setCoachedTeamIds] = useState<string[]>([]);
  const [guardianPlayerIds, setGuardianPlayerIds] = useState<string[]>([]);
  const [loadingScopes, setLoadingScopes] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoadingScopes(false);
        return;
      }
      const tasks: Promise<unknown>[] = [];
      if (role.isCoach) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from('team_coaches')
              .select('team_id')
              .eq('coach_id', user.id);
            if (!cancelled) setCoachedTeamIds((data || []).map((r: any) => r.team_id));
          })(),
        );
      }
      if (role.isGuardian && role.guardianId) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from('player_guardians')
              .select('player_id')
              .eq('guardian_id', role.guardianId);
            if (!cancelled) setGuardianPlayerIds((data || []).map((r: any) => r.player_id));
          })(),
        );
      }
      await Promise.all(tasks);
      if (!cancelled) setLoadingScopes(false);
    }
    if (!role.loading) load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, role.loading, role.isCoach, role.isGuardian, role.guardianId]);

  return {
    userId: user?.id ?? null,
    isClubAdmin: role.isClubAdmin,
    isCoordinator: role.isCoordinator,
    isCoach: role.isCoach,
    isStaff: role.isStaff,
    isGuardian: role.isGuardian,
    isPlayer: role.isPlayer,
    coachedTeamIds,
    guardianPlayerIds,
    selfPlayerId: role.playerId,
    loading: role.loading || loadingScopes,
  };
}
