import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { 
  Building2, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  Users,
  UserCheck,
  AlertTriangle,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function ERPDashboard() {
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const now = new Date();

  // Saldo do mês
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['erp-monthly-summary', clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('club_id', clubId)
        .gte('date', monthStart)
        .lte('date', monthEnd);
      
      if (error) throw error;
      
      const income = data?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const expense = data?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      return { income, expense, balance: income - expense };
    },
    enabled: !!clubId,
  });

  // Saldo do ano
  const { data: yearlyData, isLoading: yearlyLoading } = useQuery({
    queryKey: ['erp-yearly-summary', clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const yearStart = format(startOfYear(now), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(now), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('club_id', clubId)
        .gte('date', yearStart)
        .lte('date', yearEnd);
      
      if (error) throw error;
      
      const income = data?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const expense = data?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      return { income, expense, balance: income - expense };
    },
    enabled: !!clubId,
  });

  // Contagem de sócios ativos
  const { data: membersCount } = useQuery({
    queryKey: ['erp-members-count', clubId],
    queryFn: async () => {
      if (!clubId) return 0;
      const { count, error } = await supabase
        .from('club_members')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!clubId,
  });

  // Pagamentos pendentes (atletas)
  const { data: pendingFees } = useQuery({
    queryKey: ['erp-pending-fees', clubId],
    queryFn: async () => {
      if (!clubId) return 0;
      const { count, error } = await supabase
        .from('player_fees')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_paid', false);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!clubId,
  });

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!isClubAdmin) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Esta funcionalidade está disponível apenas para administradores de clubes.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">ERP do Clube</h1>
          <p className="text-muted-foreground">
            Visão geral da gestão financeira - {format(now, "MMMM 'de' yyyy", { locale: pt })}
          </p>
        </div>

        {/* Cards principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saldo do mês */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo do Mês
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className={`text-2xl font-bold ${(monthlyData?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(monthlyData?.balance || 0)}
                </div>
              )}
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  {formatCurrency(monthlyData?.income || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  {formatCurrency(monthlyData?.expense || 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Saldo do ano */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo do Ano
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {yearlyLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className={`text-2xl font-bold ${(yearlyData?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(yearlyData?.balance || 0)}
                </div>
              )}
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  {formatCurrency(yearlyData?.income || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  {formatCurrency(yearlyData?.expense || 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Sócios ativos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sócios Ativos
              </CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{membersCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Sócios com quotas em dia
              </p>
            </CardContent>
          </Card>

          {/* Pagamentos pendentes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pagamentos Pendentes
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{pendingFees || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Mensalidades de atletas por pagar
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Atalhos rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <QuickLink href="/erp/billing" icon={Wallet} label="Mensalidades" />
          <QuickLink href="/erp/payments" icon={TrendingUp} label="Pagamentos" />
          <QuickLink href="/erp/budget" icon={BarChart3} label="Orçamento" />
          <QuickLink href="/erp/procurement" icon={Wallet} label="Compras" />
          <QuickLink href="/erp/workforce" icon={Users} label="Contratos & Staff" />
          <QuickLink href="/erp/inventory" icon={Wallet} label="Ativos & Inventário" />
          <QuickLink href="/erp/facilities" icon={Building2} label="Instalações" />
          <QuickLink href="/erp/medical" icon={UserCheck} label="Saúde & Medicina" />
          <QuickLink href="/erp/academy" icon={Users} label="Formação & Academia" />
          <QuickLink href="/erp/scouting" icon={UserCheck} label="Scouting" />
          <QuickLink href="/erp/contabilidade" icon={Wallet} label="Contabilidade" />
          <QuickLink href="/erp/atletas" icon={Users} label="Atletas" />
          <QuickLink href="/erp/socios" icon={UserCheck} label="Sócios" />
          <QuickLink href="/erp/bilheteira" icon={Calendar} label="Bilheteira" />
        </div>
      </div>
    </AppLayout>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <a 
      href={href}
      className="flex flex-col items-center justify-center p-4 bg-card rounded-lg border border-border hover:bg-accent transition-colors"
    >
      <Icon className="h-6 w-6 mb-2 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
}
