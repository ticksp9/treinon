import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, Calendar, CalendarDays, Users, Menu, MessageSquare, Settings } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { tr, useT } from '@/lib/i18n/ui';

type Item = { label: string; icon: typeof Home; path?: string; action?: 'menu' };

const COACH_ITEMS: Item[] = [
  { label: tr('Início'), icon: Home, path: '/dashboard' },
  { label: tr('Jogos'), icon: Trophy, path: '/matches' },
  { label: tr('Treinos'), icon: Calendar, path: '/training' },
  { label: tr('Jogadores'), icon: Users, path: '/players' },
  { label: tr('Mais'), icon: Menu, action: 'menu' },
];

const FAMILY_ITEMS = (home: string): Item[] => [
  { label: tr('Eventos'), icon: CalendarDays, path: home },
  { label: tr('Mensagens'), icon: MessageSquare, path: '/communication' },
  { label: tr('Definições'), icon: Settings, path: '/settings' },
  { label: tr('Mais'), icon: Menu, action: 'menu' },
];

/**
 * Thumb-reachable navigation for phones: coaches use the app standing on the
 * touchline with one hand. Hidden on tablets/desktop (sidebar is used there).
 */
export function MobileBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const { isGuardian, isPlayer } = useUserRole();
  const t = useT();

  const items = isGuardian ? FAMILY_ITEMS('/guardian') : isPlayer ? FAMILY_ITEMS('/player') : COACH_ITEMS;

  return (
    <nav
      aria-label={t('Navegação principal')}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = item.path ? pathname === item.path || pathname.startsWith(item.path + '/') : false;
          return (
            <li key={item.label} className="flex-1">
              <button
                type="button"
                onClick={() => (item.action === 'menu' ? setOpenMobile(true) : navigate(item.path!))}
                className={cn(
                  'flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className={cn('flex h-8 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-primary/10')}>
                  <item.icon className="h-5 w-5" />
                </span>
                {t(item.label)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
