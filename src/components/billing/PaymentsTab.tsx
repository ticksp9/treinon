import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePayments } from '@/hooks/useBilling';
import { CreditCard } from 'lucide-react';
import { format } from 'date-fns';

interface Props { clubId: string; }

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', transfer: 'Transferência', mbway: 'MBWay', multibanco: 'Multibanco', other: 'Outro',
};

export function PaymentsTab({ clubId }: Props) {
  const { data: payments, isLoading } = usePayments(clubId);
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div><h3 className="font-semibold">Pagamentos Recebidos</h3><p className="text-sm text-muted-foreground">Histórico de pagamentos registados</p></div>
      {(!payments || payments.length === 0) ? (
        <Card><CardContent className="py-12 text-center"><CreditCard className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">Sem pagamentos registados</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {payments.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{(p.players as any)?.name || 'N/A'}</span>
                    <Badge variant="outline">{METHOD_LABELS[p.payment_method] || p.payment_method}</Badge>
                    <Badge variant={p.status === 'confirmed' ? 'default' : 'secondary'}>{p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(p.payment_date), 'dd/MM/yyyy')}
                    {p.transaction_reference && ` · Ref: ${p.transaction_reference}`}
                  </p>
                  {(p.payment_allocations as any[])?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {(p.payment_allocations as any[]).map((a: any) => (a.charges as any)?.description).filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-lg font-bold text-green-600">{fmt(p.amount_paid)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
