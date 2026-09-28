import { useUserRole } from '@/hooks/useUserRole';
import { useWorkforce, computePayrollTotals, computeObligationAging } from '@/hooks/useWorkforce';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, FileText, Wallet, AlertTriangle, Briefcase } from 'lucide-react';
import { WorkforceOverviewTab } from '@/components/workforce/WorkforceOverviewTab';
import { StaffTab } from '@/components/workforce/StaffTab';
import { ContractsTab } from '@/components/workforce/ContractsTab';
import { PayrollTab } from '@/components/workforce/PayrollTab';
import { FeesTab } from '@/components/workforce/FeesTab';
import { ObligationsTab } from '@/components/workforce/ObligationsTab';

export default function WorkforceDashboard() {
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const wf = useWorkforce(clubId);

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
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
              <p className="text-muted-foreground">Apenas administradores do clube podem aceder a este módulo.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Contratos & Staff</h1>
          <p className="text-muted-foreground">Gestão de pessoal, contratos, salários, honorários e obrigações</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="contracts">Contratos</TabsTrigger>
            <TabsTrigger value="payroll">Salários</TabsTrigger>
            <TabsTrigger value="fees">Honorários</TabsTrigger>
            <TabsTrigger value="obligations">Obrigações</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <WorkforceOverviewTab
              people={wf.people.data || []}
              contracts={wf.contracts.data || []}
              payrollEntries={wf.payrollEntries.data || []}
              obligations={wf.obligations.data || []}
              alerts={wf.alerts.data || []}
              isLoading={wf.people.isLoading}
            />
          </TabsContent>

          <TabsContent value="staff">
            <StaffTab
              people={wf.people.data || []}
              isLoading={wf.people.isLoading}
              onAddPerson={wf.addPerson.mutate}
            />
          </TabsContent>

          <TabsContent value="contracts">
            <ContractsTab
              contracts={wf.contracts.data || []}
              people={wf.people.data || []}
              isLoading={wf.contracts.isLoading}
              onAddContract={wf.addContract.mutate}
            />
          </TabsContent>

          <TabsContent value="payroll">
            <PayrollTab
              cycles={wf.payrollCycles.data || []}
              entries={wf.payrollEntries.data || []}
              people={wf.people.data || []}
              isLoading={wf.payrollCycles.isLoading}
              onAddCycle={wf.addPayrollCycle.mutate}
            />
          </TabsContent>

          <TabsContent value="fees">
            <FeesTab
              batches={wf.feeBatches.data || []}
              people={wf.people.data || []}
              isLoading={wf.feeBatches.isLoading}
            />
          </TabsContent>

          <TabsContent value="obligations">
            <ObligationsTab
              obligations={wf.obligations.data || []}
              alerts={wf.alerts.data || []}
              isLoading={wf.obligations.isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
