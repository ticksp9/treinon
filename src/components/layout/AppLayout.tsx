import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { OfflineIndicator } from '@/components/OfflineIndicator';
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
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 border-b border-border/60 flex items-center px-4 gap-4 bg-card/60 backdrop-blur-md sticky top-0 z-10">
            <SidebarTrigger />
            {title && (
              <h1 className="font-display font-semibold text-base text-foreground/90">{title}</h1>
            )}
            <div className="ml-auto flex items-center gap-2">
              <SeasonPicker />
              <OfflineIndicator />
            </div>
          </header>
          <SeasonReadOnlyBanner />
          <div className="flex-1 p-4 sm:p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

