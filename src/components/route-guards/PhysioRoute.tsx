import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { Loader2 } from 'lucide-react';

interface PhysioRouteProps {
  children: ReactNode;
}

export function PhysioRoute({ children }: PhysioRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasPhysioAccess, loading: physioLoading } = usePhysioAccess();

  if (authLoading || physioLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasPhysioAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
