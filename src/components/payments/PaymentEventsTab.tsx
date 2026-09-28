import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentEvents } from '@/hooks/usePaymentIntents';
import { format } from 'date-fns';

interface Props { clubId: string; }

const TYPE_LABELS: Record<string, string> = {
  payment_request_created: 'Link criado',
  payment_succeeded: 'Pagamento confirmado',
  payment_intent_succeeded: 'Intent confirmado',
  payment_failed: 'Pagamento falhado',
  payment_refunded: 'Reembolso',
  dispute_created: 'Disputa aberta',
  mbway_payment_created: 'MB WAY criado',
  statement_import_created: 'Extrato importado',
  auto_match_completed: 'Auto-match concluído',
  manual_match_created: 'Match manual',
  reconciliation_reversed: 'Reconciliação revertida',
};

export function PaymentEventsTab({ clubId }: Props) {
  const { data: events, isLoading } = usePaymentEvents(clubId);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Eventos & Auditoria</h3>
        <p className="text-sm text-muted-foreground">Trilha de auditoria de todos os eventos de pagamento</p>
      </div>
      {(!events || events.length === 0) ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sem eventos registados</CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {events.map((e: any) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[e.event_type] || e.event_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {e.event_source}
                    {e.provider_event_id && ` · ${e.provider_event_id.substring(0, 20)}...`}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(e.created_at), 'dd/MM/yyyy HH:mm:ss')}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
