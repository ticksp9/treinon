import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactionsSummary } from '@/hooks/usePaymentIntents';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, AlertTriangle, CreditCard } from 'lucide-react';

interface Props { clubId: string; }

export function PaymentsOverviewTab({ clubId }: Props) {
  const { data: summary, isLoading } = useTransactionsSummary(clubId);
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!summary) return null;

  const cards = [
    { label: 'Recebido (bruto)', value: fmt(summary.total_gross), icon: DollarSign, color: 'text-green-600' },
    { label: 'Taxas Provider', value: fmt(summary.total_fees), icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Recebido (líquido)', value: fmt(summary.total_net), icon: TrendingUp, color: 'text-primary' },
    { label: 'Transações', value: `${summary.succeeded} ok / ${summary.failed} falhadas`, icon: CreditCard, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(summary.by_method).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recebimento por Método</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(summary.by_method).map(([method, total]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{method.replace('_', ' ')}</span>
                  <span className="font-medium">{fmt(total as number)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
