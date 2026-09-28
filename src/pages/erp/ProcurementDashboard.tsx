import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useProcurement } from '@/hooks/useProcurement';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageLoading, AccessDenied } from '@/components/ui/page-states';
import {
  ShoppingCart, Users, FileText, CheckSquare, CreditCard,
  AlertTriangle, TrendingDown, Receipt, BarChart3,
} from 'lucide-react';
import { VendorsTab } from '@/components/procurement/VendorsTab';
import { PurchaseRequestsTab } from '@/components/procurement/PurchaseRequestsTab';
import { InvoicesTab } from '@/components/procurement/InvoicesTab';
import { ExpenseClaimsTab } from '@/components/procurement/ExpenseClaimsTab';
import { PayablesOverviewTab } from '@/components/procurement/PayablesOverviewTab';
import { ProcurementOverviewTab } from '@/components/procurement/ProcurementOverviewTab';

export default function ProcurementDashboard() {
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('overview');

  if (roleLoading) return <AppLayout><PageLoading /></AppLayout>;
  if (!isClubAdmin || !clubId) return <AppLayout><AccessDenied message="Acesso restrito a administradores." /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <PageHeader
          title="Compras & Despesas"
          description="Gestão de fornecedores, compras, despesas e contas a pagar"
          icon={<ShoppingCart className="w-6 h-6 text-primary" />}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="vendors" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Fornecedores</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Requisições</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Faturas</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Despesas</span>
            </TabsTrigger>
            <TabsTrigger value="payables" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Contas a Pagar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <ProcurementOverviewTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="vendors" className="mt-6">
            <VendorsTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="requests" className="mt-6">
            <PurchaseRequestsTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="invoices" className="mt-6">
            <InvoicesTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="expenses" className="mt-6">
            <ExpenseClaimsTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="payables" className="mt-6">
            <PayablesOverviewTab clubId={clubId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
