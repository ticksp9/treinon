import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

interface PhysioAccessData {
  hasPhysioAccess: boolean;
  isPhysio: boolean;
  isClubAdmin: boolean;
  clubId: string | null;
  loading: boolean;
}

export function usePhysioAccess(): PhysioAccessData {
  const { user } = useAuth();
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [isPhysio, setIsPhysio] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !clubId) {
      setIsPhysio(false);
      setLoading(false);
      return;
    }

    const checkPhysioRole = async () => {
      try {
        const { data } = await supabase
          .from('club_staff')
          .select('role')
          .eq('club_id', clubId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('role', 'physio')
          .maybeSingle();

        setIsPhysio(!!data);
      } catch (error) {
        console.error('Error checking physio role:', error);
        setIsPhysio(false);
      } finally {
        setLoading(false);
      }
    };

    if (!roleLoading) {
      checkPhysioRole();
    }
  }, [user, clubId, roleLoading]);

  return {
    hasPhysioAccess: isClubAdmin || isPhysio,
    isPhysio,
    isClubAdmin,
    clubId,
    loading: loading || roleLoading,
  };
}
