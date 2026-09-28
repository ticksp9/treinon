import { AppLayout } from '@/components/layout/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useFacilities } from '@/hooks/useFacilities';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2 } from 'lucide-react';
import { FacilitiesOverviewTab } from '@/components/facilities/FacilitiesOverviewTab';
import { SpacesTab } from '@/components/facilities/SpacesTab';
import { ReservationsTab } from '@/components/facilities/ReservationsTab';
import { MaintenanceTab } from '@/components/facilities/MaintenanceTab';
import { CostsTab } from '@/components/facilities/CostsTab';
import { ComplianceTab } from '@/components/facilities/ComplianceTab';

export default function FacilitiesDashboard() {
  const { isClubAdmin, loading: roleLoading } = useUserRole();
  const hook = useFacilities();

  if (roleLoading || hook.isLoading) {
    return <AppLayout><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div></div></AppLayout>;
  }

  if (!isClubAdmin) {
    return <AppLayout><div className="p-6"><Card><CardContent className="py-12 text-center"><Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3><p className="text-muted-foreground">Apenas administradores de clubes.</p></CardContent></Card></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Instalações & Campos</h1>
          <p className="text-muted-foreground">Gestão de instalações, reservas, manutenção e custos operacionais</p>
        </div>
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="spaces">Espaços & Campos</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
            <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
            <TabsTrigger value="costs">Custos Operacionais</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <FacilitiesOverviewTab {...hook} />
          </TabsContent>
          <TabsContent value="spaces">
            <SpacesTab facilities={hook.facilities} spaces={hook.spaces} onCreateFacility={d => hook.createFacility.mutate(d)} onCreateSpace={d => hook.createSpace.mutate(d)} />
          </TabsContent>
          <TabsContent value="reservations">
            <ReservationsTab reservations={hook.reservations} spaces={hook.spaces} facilities={hook.facilities} teams={hook.teams} onCreateReservation={d => hook.createReservation.mutate(d)} />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenanceTab workOrders={hook.workOrders} facilities={hook.facilities} onCreateWorkOrder={d => hook.createWorkOrder.mutate(d)} />
          </TabsContent>
          <TabsContent value="costs">
            <CostsTab operationalCosts={hook.operationalCosts} facilities={hook.facilities} teams={hook.teams} />
          </TabsContent>
          <TabsContent value="compliance">
            <ComplianceTab documents={hook.documents} complianceAlerts={hook.complianceAlerts} facilities={hook.facilities} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
