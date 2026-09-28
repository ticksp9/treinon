import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, FileText, ArrowLeftRight, BarChart3, Shield, Settings, HandCoins } from 'lucide-react';
import { PageLoading, AccessDenied } from '@/components/ui/page-states';
import { PaymentsOverviewTab } from '@/components/payments/PaymentsOverviewTab';
import { PaymentRequestsTab } from '@/components/payments/PaymentRequestsTab';
import { TransactionsTab } from '@/components/payments/TransactionsTab';
import { ReconciliationTab } from '@/components/payments/ReconciliationTab';
import { PaymentEventsTab } from '@/components/payments/PaymentEventsTab';
import { PaymentConfigTab } from '@/components/payments/PaymentConfigTab';
import { ManualPaymentsTab } from '@/components/payments/ManualPaymentsTab';
import { useSearchParams } from 'react-router-dom';

export default function PaymentsDashboard() {
  const { isClubAdmin, clubId, loading } = useUserRole();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  if (loading) return <AppLayout><PageLoading /></AppLayout>;
  if (!isClubAdmin || !clubId) return <AppLayout><AccessDenied message="Disponível apenas para administradores financeiros." /></AppLayout>;

  return (
    <AppLayout title="Pagamentos & Reconciliação">
      <div className="space-y-6">
        <PageHeader
          title="Pagamentos & Reconciliação"
          description="Pagamentos digitais, manuais, reconciliação bancária e auditoria"
          icon={<CreditCard className="w-6 h-6 text-primary" />}
        />
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" /><span className="hidden sm:inline">Links</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <HandCoins className="w-4 h-4" /><span className="hidden sm:inline">Manual</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <FileText className="w-4 h-4" /><span className="hidden sm:inline">Transações</span>
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" /><span className="hidden sm:inline">Reconciliação</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Shield className="w-4 h-4" /><span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="w-4 h-4" /><span className="hidden sm:inline">Configuração</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6"><PaymentsOverviewTab clubId={clubId} /></TabsContent>
          <TabsContent value="requests" className="mt-6"><PaymentRequestsTab clubId={clubId} /></TabsContent>
          <TabsContent value="manual" className="mt-6"><ManualPaymentsTab clubId={clubId} /></TabsContent>
          <TabsContent value="transactions" className="mt-6"><TransactionsTab clubId={clubId} /></TabsContent>
          <TabsContent value="reconciliation" className="mt-6"><ReconciliationTab clubId={clubId} /></TabsContent>
          <TabsContent value="events" className="mt-6"><PaymentEventsTab clubId={clubId} /></TabsContent>
          <TabsContent value="config" className="mt-6"><PaymentConfigTab clubId={clubId} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
