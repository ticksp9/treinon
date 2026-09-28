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
  BookOpen,
  ClipboardCheck,
  Megaphone,
  Shield,
  CreditCard,
  BarChart3,
  ShoppingCart,
  Briefcase,
  Package,
} from 'lucide-react';

// Staff/coach menu
const staffMenuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { title: 'Meu Perfil', icon: User, path: '/coach-profile' },
  { title: 'Equipas', icon: Users, path: '/teams' },
  { title: 'Jogadores', icon: Users, path: '/players' },
  { title: 'Jogos', icon: Trophy, path: '/matches' },
  { title: 'Treinos', icon: Calendar, path: '/training' },
  { title: 'Comunicação', icon: MessageSquare, path: '/communication' },
  { title: 'Quadro Tático', icon: PenTool, path: '/tactical-board' },
];

const clubMenuItems = [
  { title: 'Clube', icon: Building2, path: '/club' },
  { title: 'Coordenação Jovens', icon: Users, path: '/club/coordination' },
  { title: 'Treinadores', icon: UserCog, path: '/coaches' },
  { title: 'Fisioterapia', icon: Heart, path: '/club/physio' },
  { title: 'Mensalidades', icon: Wallet, path: '/erp/billing' },
  { title: 'Pagamentos', icon: CreditCard, path: '/erp/payments' },
  { title: 'Orçamento', icon: BarChart3, path: '/erp/budget' },
  { title: 'Compras & Despesas', icon: ShoppingCart, path: '/erp/procurement' },
  { title: 'Contratos & Staff', icon: Briefcase, path: '/erp/workforce' },
  { title: 'Ativos & Inventário', icon: Package, path: '/erp/inventory' },
  { title: 'Instalações & Campos', icon: Building2, path: '/erp/facilities' },
  { title: 'Saúde & Medicina', icon: Heart, path: '/erp/medical' },
  { title: 'Formação & Academia', icon: BookOpen, path: '/erp/academy' },
  { title: 'Scouting & Recrutamento', icon: Shield, path: '/erp/scouting' },
  { title: 'Regras de Jogo', icon: ClipboardCheck, path: '/erp/match-rules' },
  { title: 'Templates Convite', icon: BookOpen, path: '/admin/invite-templates' },
  { title: 'ERP', icon: Wallet, path: '/erp' },
  { title: 'Transição Época', icon: ArrowUpRight, path: '/season-transition' },
  { title: 'Épocas', icon: ArrowUpRight, path: '/seasons' },
];

// Guardian menu
const guardianMenuItems = [
  { title: 'Início', icon: Home, path: '/guardian' },
  { title: 'Comunicação', icon: MessageSquare, path: '/communication' },
  { title: 'Definições', icon: Settings, path: '/settings' },
];

// Player menu
const playerMenuItems = [
  { title: 'Início', icon: Home, path: '/player' },
  { title: 'Comunicação', icon: MessageSquare, path: '/communication' },
  { title: 'Definições', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isClubAdmin, isCoach, isGuardian, isPlayer, isIndividualCoach, accountType, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

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
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sidebar-foreground">TreinON</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão Desportiva</p>
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
                    onClick={() => navigate(item.path)}
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
                {clubMenuItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.path)}
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
              onClick={() => navigate('/settings')}
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
