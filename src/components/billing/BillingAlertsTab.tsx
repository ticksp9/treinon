import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingAlerts } from '@/hooks/useBilling';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';
import { tx } from '@/lib/i18n/ui';

interface Props { clubId: string; }

export function BillingAlertsTab({ clubId }: Props) {
  const { data: alerts, isLoading } = useBillingAlerts(clubId);
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div><h3 className="font-semibold">{tx('Alertas de Cobrança')}</h3><p className="text-sm text-muted-foreground">{tx('Histórico de notificações enviadas')}</p></div>
      {(!alerts || alerts.length === 0) ? (
        <Card><CardContent className="py-12 text-center"><Bell className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">{tx('Sem alertas registados')}</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{(a.players as any)?.name || tx('N/A')}</span>
                    <Badge variant="outline">{a.alert_type}</Badge>
                    <Badge variant={a.status === 'sent' ? 'default' : 'secondary'}>{a.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(a.charges as any)?.description || ''}
                    {(a.charges as any)?.balance_due && tx(' · {{v0}} em aberto', { v0: fmt((a.charges as any).balance_due) })}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">{a.sent_at ? format(new Date(a.sent_at), 'dd/MM/yyyy HH:mm') : tx('Pendente')}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
