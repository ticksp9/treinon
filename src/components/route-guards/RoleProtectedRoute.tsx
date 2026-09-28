import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface RoleProtectedRouteProps {
  children: ReactNode;
  requireClubAdmin?: boolean;
  requireCoach?: boolean;
  requireClubOrCoach?: boolean;
}

export function RoleProtectedRoute({ 
  children, 
  requireClubAdmin = false,
  requireCoach = false,
  requireClubOrCoach = false,
}: RoleProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isClubAdmin, isCoach, isGuardian, isPlayer, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Guardian and player users cannot access staff routes
  if (isGuardian) return <Navigate to="/guardian" replace />;
  if (isPlayer) return <Navigate to="/player" replace />;

  if (requireClubAdmin && !isClubAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireCoach && !isCoach && !isClubAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireClubOrCoach && !isClubAdmin && !isCoach) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
