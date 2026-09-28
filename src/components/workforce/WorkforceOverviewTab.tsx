import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, FileText, Wallet, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PersonRegistry, EmploymentContract, PayrollEntry, StatutoryObligation, ContractAlert } from '@/hooks/useWorkforce';
import { computePayrollTotals, computeObligationAging } from '@/hooks/useWorkforce';

interface Props {
  people: PersonRegistry[];
  contracts: EmploymentContract[];
  payrollEntries: PayrollEntry[];
  obligations: StatutoryObligation[];
  alerts: ContractAlert[];
  isLoading: boolean;
}

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export function WorkforceOverviewTab({ people, contracts, payrollEntries, obligations, alerts, isLoading }: Props) {
  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  const activeStaff = people.filter(p => p.status === 'active' && p.person_type !== 'contractor').length;
  const activeContractors = people.filter(p => p.status === 'active' && p.person_type === 'contractor').length;
  const activeContracts = contracts.filter(c => c.contract_status === 'active').length;
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date || c.contract_status !== 'active') return false;
    const daysLeft = Math.floor((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 90;
  }).length;

  const payrollTotals = computePayrollTotals(payrollEntries);
  const aging = computeObligationAging(obligations);
  const overdueTotal = aging.days_1_30 + aging.days_31_60 + aging.days_61_90 + aging.over_90;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;

  const agingData = [
    { name: 'Corrente', value: aging.current },
    { name: '1-30d', value: aging.days_1_30 },
    { name: '31-60d', value: aging.days_31_60 },
    { name: '61-90d', value: aging.days_61_90 },
    { name: '>90d', value: aging.over_90 },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff Ativo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStaff}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeContractors} prestadores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Ativos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContracts}</div>
            {expiringContracts > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {expiringContracts} a expirar em 90 dias
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total Mensal</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(payrollTotals.totalCost)}</div>
            <p className="text-xs text-muted-foreground mt-1">Bruto + encargos patronais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueTotal > 0 ? 'text-destructive' : ''}`}>
              {fmt(overdueTotal)}
            </div>
            {criticalAlerts > 0 && (
              <p className="text-xs text-destructive mt-1">{criticalAlerts} alertas críticos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payroll breakdown + Aging chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Decomposição Salarial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Bruto</span><span className="font-semibold">{fmt(payrollTotals.gross)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Descontos</span><span className="font-semibold text-destructive">-{fmt(payrollTotals.deductions)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Encargos Patronais</span><span className="font-semibold">{fmt(payrollTotals.employerCharges)}</span></div>
            <hr className="border-border" />
            <div className="flex justify-between"><span className="font-semibold">Líquido</span><span className="font-bold">{fmt(payrollTotals.net)}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Custo Total Empregador</span><span className="font-bold text-primary">{fmt(payrollTotals.totalCost)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aging de Obrigações</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alertas Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 8).map(a => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === 'critical' ? 'destructive' : a.severity === 'high' ? 'destructive' : 'secondary'}>
                      {a.severity}
                    </Badge>
                    <span className="text-sm">{a.message || a.alert_type}</span>
                  </div>
                  {a.due_date && <span className="text-xs text-muted-foreground">{a.due_date}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
