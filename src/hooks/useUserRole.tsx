import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

interface UserRoleData {
  accountType: 'individual_coach' | 'club' | 'guardian' | 'player' | null;
  isClubAdmin: boolean;
  isCoach: boolean;
  isGuardian: boolean;
  isPlayer: boolean;
  isIndividualCoach: boolean;
  isCoordinator: boolean;
  isStaff: boolean;
  staffRole: string | null;
  clubId: string | null;
  playerId: string | null;
  guardianId: string | null;
  loading: boolean;
}

export function useUserRole(): UserRoleData {
  const { user } = useAuth();
  const [data, setData] = useState<UserRoleData>({
    accountType: null,
    isClubAdmin: false,
    isCoach: false,
    isGuardian: false,
    isPlayer: false,
    isIndividualCoach: false,
    isCoordinator: false,
    isStaff: false,
    staffRole: null,
    clubId: null,
    playerId: null,
    guardianId: null,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setData({
        accountType: null,
        isClubAdmin: false,
        isCoach: false,
        isGuardian: false,
        isPlayer: false,
        isIndividualCoach: false,
        isCoordinator: false,
        isStaff: false,
        staffRole: null,
        clubId: null,
        playerId: null,
        guardianId: null,
        loading: false,
      });
      return;
    }

    const fetchUserRole = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', user.id)
          .maybeSingle();

        const accountType = (profile?.account_type || 'individual_coach') as UserRoleData['accountType'];

        // Guardian check
        if (accountType === 'guardian') {
          const { data: gp } = await supabase
            .from('guardian_profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          setData({
            accountType: 'guardian',
            isClubAdmin: false, isCoach: false, isGuardian: true, isPlayer: false, isIndividualCoach: false,
            isCoordinator: false, isStaff: false, staffRole: null,
            clubId: null, playerId: null, guardianId: gp?.id || null, loading: false,
          });
          return;
        }

        // Player check
        if (accountType === 'player') {
          const { data: pa } = await supabase
            .from('player_accounts')
            .select('player_id')
            .eq('user_id', user.id)
            .maybeSingle();
          setData({
            accountType: 'player',
            isClubAdmin: false, isCoach: false, isGuardian: false, isPlayer: true, isIndividualCoach: false,
            isCoordinator: false, isStaff: false, staffRole: null,
            clubId: null, playerId: pa?.player_id || null, guardianId: null, loading: false,
          });
          return;
        }

        // Standard coach/club flow
        // A person can belong to more than one club (e.g. coach in two clubs): the club
        // of the team they chose to work with wins (see useActiveTeam).
        const [{ data: ownedClubs }, { data: staffRows }, { data: coachRows }] = await Promise.all([
          supabase.from('clubs').select('id').eq('owner_id', user.id),
          supabase.from('club_staff').select('club_id, role').eq('user_id', user.id).eq('is_active', true),
          supabase.from('club_coaches').select('club_id').eq('coach_id', user.id).eq('is_active', true),
        ]);
        let chosen: string | null = null;
        try { chosen = localStorage.getItem(`treinon_active_club_${user.id}`); } catch { /* ignore */ }
        const allClubIds = [
          ...(ownedClubs ?? []).map((c) => c.id),
          ...(staffRows ?? []).map((s) => s.club_id),
          ...(coachRows ?? []).map((c) => c.club_id),
        ];
        const managesAClub = (ownedClubs?.length ?? 0) > 0 || (staffRows?.length ?? 0) > 0;
        // 'own' = working with their own teams (no club) — only for people who are just coaches
        const clubId = chosen && allClubIds.includes(chosen) ? chosen
          : chosen === 'own' && !managesAClub ? null
          : allClubIds[0] ?? null;

        const ownedClub = (ownedClubs ?? []).find((c) => c.id === clubId) ?? null;
        const staffMembership = (staffRows ?? []).find((s) => s.club_id === clubId) ?? null;
        const coachMembership = (coachRows ?? []).find((c) => c.club_id === clubId) ?? null;

        const isClubAdmin = !!ownedClub || staffMembership?.role === 'admin';
        const isClubStaff = !!staffMembership;
        const isCoach = !!coachMembership;

        const isIndividualCoach = accountType === 'individual_coach' && !clubId;
        const staffRoleValue = staffMembership?.role || null;
        const isCoordinator = staffRoleValue === 'coordenador' || isClubAdmin;
        const isStaffMember = isClubStaff && !isClubAdmin;

        setData({
          accountType,
          // Only the owner or staff with role 'admin' administer the club (other staff are not admins)
          isClubAdmin,
          isCoach,
          isGuardian: false,
          isPlayer: false,
          isIndividualCoach,
          isCoordinator,
          isStaff: isStaffMember,
          staffRole: staffRoleValue,
          clubId,
          playerId: null,
          guardianId: null,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching user role:', error);
        setData(prev => ({ ...prev, loading: false }));
      }
    };

    fetchUserRole();
  }, [user]);

  return data;
}
