import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGuardianCharges, useGuardianPayments, useGuardianAlerts } from '@/hooks/useBilling';
import { Euro, CheckCircle2, AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  guardianProfileId: string;
  userId: string;
}

export function GuardianFinancialTab({ guardianProfileId, userId }: Props) {
  const { data: charges, isLoading: chargesLoading } = useGuardianCharges(guardianProfileId);
  const { data: payments, isLoading: paymentsLoading } = useGuardianPayments(guardianProfileId);
  const { data: alerts } = useGuardianAlerts(userId);

  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  if (chargesLoading || paymentsLoading) return <Skeleton className="h-48" />;

  const pendingCharges = charges?.filter((c: any) => c.status === 'pending' || c.status === 'overdue' || c.status === 'partially_paid') || [];
  const paidCharges = charges?.filter((c: any) => c.status === 'paid') || [];
  const totalDue = pendingCharges.reduce((s: number, c: any) => s + Number(c.balance_due), 0);
  const totalPaid = paidCharges.reduce((s: number, c: any) => s + Number(c.final_amount), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{fmt(totalDue)}</div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" /> Em aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{fmt(totalPaid)}</div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> Total pago</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Avisos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 3).map((a: any) => (
              <div key={a.id} className="text-xs p-2 bg-destructive/5 rounded">
                <span className="font-medium">{(a.charges as any)?.description}</span>
                {(a.charges as any)?.balance_due && <span className="ml-1">— {fmt((a.charges as any).balance_due)} em atraso</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending charges */}
      {pendingCharges.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Cobranças Pendentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingCharges.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div>
                  <p className="text-sm font-medium">{c.description}</p>
                  <p className="text-xs text-muted-foreground">{(c.players as any)?.name} · Venc: {format(new Date(c.due_date), 'dd/MM/yyyy')}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm">{fmt(c.balance_due)}</span>
                  <Badge variant={c.status === 'overdue' ? 'destructive' : 'outline'} className="ml-2 text-xs">{c.status === 'overdue' ? 'Vencido' : 'Pendente'}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent payments */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Últimos Pagamentos</CardTitle></CardHeader>
        <CardContent>
          {(!payments || payments.length === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sem pagamentos registados</p>
          ) : (
            <div className="space-y-2">
              {payments.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div>
                    <p className="text-sm">{(p.players as any)?.name} — {format(new Date(p.payment_date), 'dd/MM/yyyy')}</p>
                    <p className="text-xs text-muted-foreground">{p.payment_method}</p>
                  </div>
                  <span className="font-bold text-sm text-green-600">{fmt(p.amount_paid)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paid charges history */}
      {paidCharges.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Cobranças Pagas</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {paidCharges.slice(0, 10).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-1.5 text-xs">
                <span>{c.description} — {(c.players as any)?.name}</span>
                <span className="text-green-600 font-medium">{fmt(c.final_amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pendingCharges.length === 0 && paidCharges.length === 0 && (
        <Card><CardContent className="py-8 text-center"><Euro className="w-8 h-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Sem informação financeira disponível</p></CardContent></Card>
      )}
    </div>
  );
}
