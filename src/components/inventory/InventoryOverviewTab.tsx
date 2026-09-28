import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Warehouse, AlertTriangle, Wrench, Users, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { computeStockHealth, computeConsumptionByTeam, computeMaintenanceStatus } from '@/hooks/useInventory';

interface Props {
  assets: any[];
  stock: any[];
  movements: any[];
  maintenance: any[];
  alerts: any[];
  teams: any[];
}

export function InventoryOverviewTab({ assets, stock, movements, maintenance, alerts, teams }: Props) {
  const health = computeStockHealth(stock);
  const consumption = computeConsumptionByTeam(movements, teams);
  const maint = computeMaintenanceStatus(maintenance);
  const totalAssetValue = assets.reduce((s, a) => s + (Number(a.acquisition_cost) || 0), 0);
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const chartData = consumption.slice(0, 8).map(c => ({ name: c.team_name.substring(0, 12), custo: c.total_cost }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Package className="h-4 w-4" /> Ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{assets.length}</div><p className="text-xs text-muted-foreground">{fmt(totalAssetValue)} total</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Warehouse className="h-4 w-4" /> Stock</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{health.total}</div><p className="text-xs text-muted-foreground">{health.ok} OK</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><TrendingDown className="h-4 w-4" /> Stock Crítico</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{health.critical + health.low}</div><p className="text-xs text-muted-foreground">{health.critical} esgotado, {health.low} baixo</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Wrench className="h-4 w-4" /> Manutenção</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{maint.scheduled + maint.overdue}</div>{maint.overdue > 0 && <Badge variant="destructive" className="text-xs mt-1">{maint.overdue} em atraso</Badge>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Alertas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{alerts.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-4 w-4" /> Equipas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{consumption.length}</div><p className="text-xs text-muted-foreground">com consumos</p></CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Consumo por Equipa (Top 8)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="custo" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Alertas Ativos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-auto">
              {alerts.slice(0, 10).map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded border border-border">
                  <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">{a.severity}</Badge>
                  <span className="text-sm flex-1">{a.message || a.alert_type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
