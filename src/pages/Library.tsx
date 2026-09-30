import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LibraryBrowser } from '@/components/library/LibraryBrowser';
import { useAuth } from '@/lib/auth';

/** The library is public (free coaching content); signed-in coaches use it inside Treinos. */
function PublicLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 font-display font-bold">
            <img src="/pwa-192x192.png" alt="" className="h-7 w-7 rounded-lg" /> TreinON
          </button>
          <Button size="sm" onClick={() => navigate('/auth?tab=signup&next=/biblioteca')}>Criar conta grátis</Button>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

export default function Library() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/training?tab=exercicios" replace />;
  return (
    <PublicLayout>
      <LibraryBrowser />
    </PublicLayout>
  );
}
