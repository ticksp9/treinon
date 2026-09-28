import { AppLayout } from '@/components/layout/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useInventory } from '@/hooks/useInventory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { InventoryOverviewTab } from '@/components/inventory/InventoryOverviewTab';
import { AssetsTab } from '@/components/inventory/AssetsTab';
import { StockTab } from '@/components/inventory/StockTab';
import { MovementsTab } from '@/components/inventory/MovementsTab';
import { AllocationsTab } from '@/components/inventory/AllocationsTab';
import { MaintenanceTab } from '@/components/inventory/MaintenanceTab';

export default function InventoryDashboard() {
  const { isClubAdmin, loading: roleLoading } = useUserRole();
  const { assets, stock, movements, locations, allocations, kitAssignments, maintenance, alerts, teams, isLoading, createAsset, createStockItem } = useInventory();

  if (roleLoading || isLoading) {
    return <AppLayout><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}</div></div></AppLayout>;
  }

  if (!isClubAdmin) {
    return <AppLayout><div className="p-6"><Card><CardContent className="py-12 text-center"><Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3><p className="text-muted-foreground">Apenas administradores de clubes.</p></CardContent></Card></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Ativos & Inventário</h1>
          <p className="text-muted-foreground">Gestão de ativos, stock, equipamentos e consumos por equipa</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="assets">Ativos</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="movements">Movimentos</TabsTrigger>
            <TabsTrigger value="allocations">Alocações & Kits</TabsTrigger>
            <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <InventoryOverviewTab assets={assets} stock={stock} movements={movements} maintenance={maintenance} alerts={alerts} teams={teams} />
          </TabsContent>
          <TabsContent value="assets">
            <AssetsTab assets={assets} onCreateAsset={d => createAsset.mutate(d)} />
          </TabsContent>
          <TabsContent value="stock">
            <StockTab stock={stock} onCreateStock={d => createStockItem.mutate(d)} />
          </TabsContent>
          <TabsContent value="movements">
            <MovementsTab movements={movements} />
          </TabsContent>
          <TabsContent value="allocations">
            <AllocationsTab allocations={allocations} kitAssignments={kitAssignments} teams={teams} />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenanceTab maintenance={maintenance} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
