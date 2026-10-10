import { ReactNode } from 'react';
import { Shirt, ChevronsUpDown } from 'lucide-react';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { ThemeToggle } from './ThemeToggle';
import { SeasonPicker, SeasonReadOnlyBanner } from './SeasonPicker';
import { LiveMatchBar } from '@/components/matches/LiveMatchBar';
import { ConsentGate } from '@/components/family/ConsentGate';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { loadCustomFormations } from '@/lib/custom-formations';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

/** Which team the coach is working with; tap to switch (only shown with 2+ teams). */
function ActiveTeamChip() {
  const { myTeams, activeTeam, openChooser } = useActiveTeam();
  if (myTeams.length < 2) return null;
  return (
    <button
      type="button"
      onClick={openChooser}
      className="flex max-w-[9.5rem] items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-left text-xs hover:border-primary sm:max-w-[14rem]"
      title="Trocar de equipa"
    >
      <Shirt className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block truncate font-semibold leading-tight">{activeTeam?.name ?? 'Escolher equipa'}</span>
        {activeTeam?.club_name && <span className="block truncate text-[10px] leading-tight text-muted-foreground">{activeTeam.club_name}</span>}
      </span>
      <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function AppLayout({ children, title }: AppLayoutProps) {
  // the coach's own formations (4-1-2-1…): in every formation list of the app
  const { user } = useAuth();
  useEffect(() => { if (user?.id) loadCustomFormations(user.id); }, [user?.id]);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="h-14 border-b border-border/60 flex items-center px-3 sm:px-4 gap-3 bg-card/70 backdrop-blur-md sticky top-0 z-20">
            <SidebarTrigger className="hidden md:inline-flex" />
            <div className="flex items-center gap-2 md:hidden">
              <img src="/pwa-192x192.png" alt="" className="h-7 w-7 rounded-lg" />
            </div>
            {title && (
              <h1 className="font-display font-semibold text-base text-foreground/90 truncate">{title}</h1>
            )}
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <ActiveTeamChip />
              <SeasonPicker />
              <ThemeToggle />
            </div>
          </header>
          <SeasonReadOnlyBanner />
          <LiveMatchBar />
          <ConsentGate />
          {/* bottom padding leaves room for the phone navigation bar */}
          <div className="flex-1 p-4 pb-24 sm:p-6 md:pb-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
