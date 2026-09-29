import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { ThemeToggle } from './ThemeToggle';
import { SeasonPicker, SeasonReadOnlyBanner } from './SeasonPicker';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
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
              <SeasonPicker />
              <ThemeToggle />
            </div>
          </header>
          <SeasonReadOnlyBanner />
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
