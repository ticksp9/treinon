import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useBudget, BudgetLine, BudgetCategory, VarianceData } from '@/hooks/useBudget';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoading, AccessDenied } from '@/components/ui/page-states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, FileSpreadsheet, AlertTriangle, PlusCircle, Settings2, TrendingUp } from 'lucide-react';
import { BudgetOverviewTab } from '@/components/budget/BudgetOverviewTab';
import { BudgetLinesTab } from '@/components/budget/BudgetLinesTab';
import { BudgetVarianceTab } from '@/components/budget/BudgetVarianceTab';
import { BudgetAlertsTab } from '@/components/budget/BudgetAlertsTab';
import { BudgetCycleManager } from '@/components/budget/BudgetCycleManager';

export default function BudgetDashboard() {
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('overview');

  if (roleLoading) return <AppLayout><PageLoading /></AppLayout>;
  if (!isClubAdmin || !clubId) return <AppLayout><AccessDenied message="Apenas administradores podem aceder ao orçamento." /></AppLayout>;

  return (
    <AppLayout title="Orçamento">
      <div className="space-y-6">
        <PageHeader
          title="Orçamento & Controlo"
          description="Planeamento, execução e controlo orçamental"
          icon={<BarChart3 className="w-6 h-6 text-primary" />}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="cycles" className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Ciclos</span>
            </TabsTrigger>
            <TabsTrigger value="lines" className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Linhas</span>
            </TabsTrigger>
            <TabsTrigger value="variance" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Real vs Budget</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <BudgetOverviewTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="cycles" className="mt-6">
            <BudgetCycleManager clubId={clubId} />
          </TabsContent>
          <TabsContent value="lines" className="mt-6">
            <BudgetLinesTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="variance" className="mt-6">
            <BudgetVarianceTab clubId={clubId} />
          </TabsContent>
          <TabsContent value="alerts" className="mt-6">
            <BudgetAlertsTab clubId={clubId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
