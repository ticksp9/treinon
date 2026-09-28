import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CalendarDays, Wrench, AlertTriangle, DollarSign, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { computeOccupancyRate, computeCostsByFacility } from '@/hooks/useFacilities';

interface Props {
  facilities: any[];
  spaces: any[];
  reservations: any[];
  workOrders: any[];
  documents: any[];
  operationalCosts: any[];
  complianceAlerts: any[];
  incidents: any[];
}

export function FacilitiesOverviewTab({ facilities, spaces, reservations, workOrders, documents, operationalCosts, complianceAlerts, incidents }: Props) {
  const activeFacilities = facilities.filter(f => f.active).length;
  const activeSpaces = spaces.filter(s => s.active).length;
  const occupancy = computeOccupancyRate(reservations, 30, activeSpaces);
  const openWO = workOrders.filter(w => ['open', 'scheduled', 'in_progress'].includes(w.status)).length;
  const expiringDocs = documents.filter(d => {
    if (!d.valid_to) return false;
    const diff = (new Date(d.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;
  const totalCosts = operationalCosts.reduce((s: number, c: any) => s + Number(c.amount), 0);

  const costsByFacility = computeCostsByFacility(operationalCosts);
  const chartData = facilities.map(f => ({ name: f.name.slice(0, 20), custos: costsByFacility[f.id] || 0 })).filter(d => d.custos > 0);

  const kpis = [
    { label: 'Instalações', value: activeFacilities, icon: Building2 },
    { label: 'Espaços/Campos', value: activeSpaces, icon: MapPin },
    { label: 'Ocupação (30d)', value: `${occupancy}%`, icon: CalendarDays },
    { label: 'Manutenções Abertas', value: openWO, icon: Wrench },
    { label: 'Docs a Expirar', value: expiringDocs, icon: AlertTriangle },
    { label: 'Custos Operacionais', value: `€${totalCosts.toLocaleString('pt-PT')}`, icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <k.icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">{k.value}</div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Custos por Instalação</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `€${v.toLocaleString('pt-PT')}`} />
                <Bar dataKey="custos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
