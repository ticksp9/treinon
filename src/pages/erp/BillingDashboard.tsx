import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, FileText, CreditCard, Users, AlertTriangle, BarChart3, Settings2 } from 'lucide-react';
import { PageLoading, AccessDenied } from '@/components/ui/page-states';
import { FeePlansTab } from '@/components/billing/FeePlansTab';
import { FeeAssignmentsTab } from '@/components/billing/FeeAssignmentsTab';
import { ChargesTab } from '@/components/billing/ChargesTab';
import { PaymentsTab } from '@/components/billing/PaymentsTab';
import { BillingOverviewTab } from '@/components/billing/BillingOverviewTab';
import { BillingAlertsTab } from '@/components/billing/BillingAlertsTab';

export default function BillingDashboard() {
  const { isClubAdmin, clubId, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) return <AppLayout><PageLoading /></AppLayout>;
  if (!isClubAdmin || !clubId) return <AppLayout><AccessDenied message="Disponível apenas para administradores." /></AppLayout>;

  return (
    <AppLayout title="Mensalidades e Quotas">
      <div className="space-y-6">
        <PageHeader
          title="Mensalidades e Quotas"
          description="Gestão de cobrança recorrente, pagamentos e conta corrente"
          icon={<Wallet className="w-6 h-6 text-primary" />}
        />
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" /><span className="hidden sm:inline">Planos</span>
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Users className="w-4 h-4" /><span className="hidden sm:inline">Atribuições</span>
            </TabsTrigger>
            <TabsTrigger value="charges" className="flex items-center gap-2">
              <FileText className="w-4 h-4" /><span className="hidden sm:inline">Cobranças</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" /><span className="hidden sm:inline">Pagamentos</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /><span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6"><BillingOverviewTab clubId={clubId} /></TabsContent>
          <TabsContent value="plans" className="mt-6"><FeePlansTab clubId={clubId} /></TabsContent>
          <TabsContent value="assignments" className="mt-6"><FeeAssignmentsTab clubId={clubId} /></TabsContent>
          <TabsContent value="charges" className="mt-6"><ChargesTab clubId={clubId} /></TabsContent>
          <TabsContent value="payments" className="mt-6"><PaymentsTab clubId={clubId} /></TabsContent>
          <TabsContent value="alerts" className="mt-6"><BillingAlertsTab clubId={clubId} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
