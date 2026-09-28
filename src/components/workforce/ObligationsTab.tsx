import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { StatutoryObligation, ContractAlert } from '@/hooks/useWorkforce';
import { computeObligationAging } from '@/hooks/useWorkforce';

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

const TYPE_LABELS: Record<string, string> = {
  salary: 'Salário', social_security: 'Seg. Social', tax_withholding: 'Retenção IRS',
  contractor_withholding: 'Retenção Prestador', insurance: 'Seguro', pension: 'Pensão', other: 'Outro',
};

const STATUS_MAP: Record<string, string> = {
  scheduled: 'Agendado', pending: 'Pendente', partially_paid: 'Parcial',
  paid: 'Pago', overdue: 'Vencido', disputed: 'Disputado',
};

interface Props {
  obligations: StatutoryObligation[];
  alerts: ContractAlert[];
  isLoading: boolean;
}

export function ObligationsTab({ obligations, alerts, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-64" />;

  const aging = computeObligationAging(obligations);
  const agingData = [
    { name: 'Corrente', value: aging.current },
    { name: '1-30d', value: aging.days_1_30 },
    { name: '31-60d', value: aging.days_31_60 },
    { name: '61-90d', value: aging.days_61_90 },
    { name: '>90d', value: aging.over_90 },
  ];

  const overdueAlerts = alerts.filter(a => ['overdue_salary', 'overdue_tax', 'overdue_social_security'].includes(a.alert_type));

  return (
    <div className="space-y-6">
      {/* Aging chart */}
      <Card>
        <CardHeader><CardTitle>Aging de Obrigações</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Overdue alerts */}
      {overdueAlerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-destructive">Alertas de Incumprimento</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueAlerts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{a.severity}</Badge>
                    <span className="text-sm">{a.message || a.alert_type}</span>
                  </div>
                  {a.due_date && <span className="text-xs text-muted-foreground">{a.due_date}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Obligations table */}
      <Card>
        <CardHeader><CardTitle>Obrigações</CardTitle></CardHeader>
        <CardContent>
          {obligations.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Sem obrigações registadas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor Devido</TableHead>
                  <TableHead>Valor Pago</TableHead>
                  <TableHead>Em Aberto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.map(o => {
                  const outstanding = o.amount_due - o.amount_paid;
                  return (
                    <TableRow key={o.id}>
                      <TableCell>{TYPE_LABELS[o.obligation_type] || o.obligation_type}</TableCell>
                      <TableCell>{o.reference_period}</TableCell>
                      <TableCell>{o.due_date}</TableCell>
                      <TableCell>{fmt(o.amount_due)}</TableCell>
                      <TableCell>{fmt(o.amount_paid)}</TableCell>
                      <TableCell className={outstanding > 0 ? 'font-semibold text-destructive' : ''}>{fmt(outstanding)}</TableCell>
                      <TableCell>
                        <Badge variant={o.status === 'paid' ? 'default' : o.status === 'overdue' ? 'destructive' : 'secondary'}>
                          {STATUS_MAP[o.status] || o.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
