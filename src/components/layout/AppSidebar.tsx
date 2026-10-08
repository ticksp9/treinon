import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Zap,
  Wallet,
  PenTool,
  Settings,
  LogOut,
  Building2,
  Trophy,
  UserCog,
  ArrowUpRight,
  User,
  Heart,
  MessageSquare,
  Home,
  CalendarDays,
  BookOpen,
  ClipboardCheck,
  Megaphone,
  Shield,
  CreditCard,
  BarChart3,
  ShoppingCart,
  Briefcase,
  Package,
  Shirt,
  CalendarRange,
  Stethoscope,
  MapPin,
  Mail,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Staff/coach menu — what a coach uses every week comes first
const staffMenuItems = [
  { title: 'Início', icon: LayoutDashboard, path: '/dashboard' },
  { title: 'Jogos', icon: Trophy, path: '/matches' },
  { title: 'Treinos', icon: Calendar, path: '/training' },
  { title: 'Mapa do clube', icon: CalendarRange, path: '/mapa' },
  { title: 'Eventos', icon: CalendarDays, path: '/eventos' },
  { title: 'Jogadores', icon: Users, path: '/players' },
  { title: 'Equipas', icon: Shirt, path: '/teams' },
  { title: 'Quadro Tático', icon: PenTool, path: '/tactical-board' },
  { title: 'Comunicação', icon: MessageSquare, path: '/communication' },
  { title: 'Meu Perfil', icon: User, path: '/coach-profile' },
];

// Club admin menu, grouped so 19 entries don't overwhelm
const clubMenuGroups = [
  {
    id: 'desporto',
    title: 'Desporto',
    icon: Trophy,
    items: [
      { title: 'Mapa de treinos e jogos', icon: CalendarRange, path: '/mapa' },
      { title: 'Eventos (pais e jogadores)', icon: CalendarDays, path: '/eventos' },
      { title: 'Épocas', icon: CalendarRange, path: '/seasons' },
      { title: 'Transição de época', icon: ArrowUpRight, path: '/season-transition' },
      { title: 'Coordenação jovens', icon: Users, path: '/club/coordination' },
      { title: 'Treinadores', icon: UserCog, path: '/coaches' },
      { title: 'Formação & academia', icon: BookOpen, path: '/erp/academy' },
      { title: 'Scouting', icon: Shield, path: '/erp/scouting' },
      { title: 'Regras de jogo', icon: ClipboardCheck, path: '/erp/match-rules' },
      { title: 'Fisioterapia', icon: Heart, path: '/club/physio' },
      { title: 'Saúde & medicina', icon: Stethoscope, path: '/erp/medical' },
    ],
  },
  {
    id: 'financas',
    title: 'Finanças',
    icon: Wallet,
    items: [
      { title: 'Resumo', icon: BarChart3, path: '/erp' },
      { title: 'Mensalidades', icon: Wallet, path: '/erp/billing' },
      { title: 'Pagamentos', icon: CreditCard, path: '/erp/payments' },
      { title: 'Orçamento', icon: BarChart3, path: '/erp/budget' },
      { title: 'Compras & despesas', icon: ShoppingCart, path: '/erp/procurement' },
    ],
  },
  {
    id: 'operacoes',
    title: 'Clube & operações',
    icon: Building2,
    items: [
      { title: 'Perfil do clube', icon: Building2, path: '/club' },
      { title: 'Contratos & staff', icon: Briefcase, path: '/erp/workforce' },
      { title: 'Material & inventário', icon: Package, path: '/erp/inventory' },
      { title: 'Instalações & campos', icon: MapPin, path: '/erp/facilities' },
      { title: 'Modelos de convite', icon: Mail, path: '/admin/invite-templates' },
    ],
  },
];

const OPEN_GROUPS_KEY = 'treinon_sidebar_groups';

// Guardian menu
const guardianMenuItems = [
  { title: 'Eventos', icon: CalendarDays, path: '/guardian' },
  { title: 'Comunicação', icon: MessageSquare, path: '/communication' },
  { title: 'Definições', icon: Settings, path: '/settings' },
];

// Player menu
const playerMenuItems = [
  { title: 'Eventos', icon: CalendarDays, path: '/player' },
  { title: 'Comunicação', icon: MessageSquare, path: '/communication' },
  { title: 'Definições', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isClubAdmin, isCoach, isGuardian, isPlayer, isIndividualCoach, accountType, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const go = (path: string) => {
    navigate(path);
    if (isMobile) setOpenMobile(false);
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const isGroupOpen = (g: (typeof clubMenuGroups)[number]) =>
    openGroups[g.id] ?? g.items.some((i) => location.pathname === i.path);
  const toggleGroup = (id: string, open: boolean) => {
    const next = { ...openGroups, [id]: open };
    setOpenGroups(next);
    try { localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const userInitials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || user?.email?.[0].toUpperCase() || 'U';

  const showClubMenu = (isClubAdmin || accountType === 'club') && !isIndividualCoach;
  const canAccessCommunication = isGuardian || isPlayer || isClubAdmin || isCoach || isIndividualCoach || accountType === 'club' || accountType === 'individual_coach';

  const roleLabel = isGuardian ? 'Encarregado' :
    isPlayer ? 'Jogador' :
    isClubAdmin ? 'Administrador' :
    isCoach ? 'Treinador' :
    isIndividualCoach ? 'Treinador Individual' :
    accountType === 'individual_coach' ? 'Treinador Individual' : null;

  // Determine menu items based on role
  const primaryItems = (isGuardian ? guardianMenuItems :
    isPlayer ? playerMenuItems :
    staffMenuItems).filter((item) => {
      if (item.path === '/communication') return canAccessCommunication;
      if (item.path === '/subscription') return false;
      return true;
    });

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="w-9 h-9 rounded-md ring-1 ring-sidebar-border" />
          <div>
            <h1 className="font-display font-bold text-sidebar-foreground tracking-tight">TreinON</h1>
            <p className="text-xs text-sidebar-foreground/60">O treinador ligado ao jogo</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            {isGuardian ? 'Portal do Encarregado' : isPlayer ? 'Portal do Jogador' : 'Principal'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => go(item.path)}
                    isActive={location.pathname === item.path}
                    className="cursor-pointer"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showClubMenu && !isGuardian && !isPlayer && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50">Clube</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {clubMenuGroups.map((group) => (
                  <Collapsible key={group.id} open={isGroupOpen(group)} onOpenChange={(o) => toggleGroup(group.id, o)}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="cursor-pointer">
                          <group.icon className="w-4 h-4" />
                          <span className="flex-1">{group.title}</span>
                          <ChevronDown className={cn('w-4 h-4 transition-transform', isGroupOpen(group) && 'rotate-180')} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                      <div className="ml-4 border-l border-sidebar-border pl-2">
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              size="sm"
                              onClick={() => go(item.path)}
                              isActive={location.pathname === item.path}
                              className="cursor-pointer"
                            >
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.user_metadata?.full_name || 'Utilizador'}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
            {roleLabel && !roleLoading && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {roleLabel}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          {!isGuardian && !isPlayer && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => go('/settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Definições
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
