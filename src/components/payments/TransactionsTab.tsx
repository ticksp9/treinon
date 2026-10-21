import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentTransactions } from '@/hooks/usePaymentIntents';
import { format } from 'date-fns';
import { tx, intlLocale } from '@/lib/i18n/ui';

interface Props { clubId: string; }

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  succeeded: { get label() { return tx('Confirmado'); }, variant: 'default' },
  pending: { get label() { return tx('Pendente'); }, variant: 'secondary' },
  failed: { get label() { return tx('Falhado'); }, variant: 'destructive' },
};

const METHOD_MAP: Record<string, string> = {
  card: 'Cartão', mb_way: 'MB WAY', sepa_debit: 'SEPA DD', bank_transfer: 'Transferência', cash: 'Numerário',
};

export function TransactionsTab({ clubId }: Props) {
  const { data: txns, isLoading } = usePaymentTransactions(clubId);
  const fmt = (v: number) => new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'EUR' }).format(v);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{tx('Transações')}</h3>
        <p className="text-sm text-muted-foreground">{tx('Histórico de transações confirmadas pelo provider')}</p>
      </div>
      {(!txns || txns.length === 0) ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{tx('Sem transações registadas')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {txns.map((t: any) => {
            const status = STATUS_MAP[t.transaction_status] || { label: t.transaction_status, variant: 'outline' as const };
            return (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{(t.charges as any)?.description || t.transaction_reference || tx('Transação')}</span>
                      <Badge variant="outline">{METHOD_MAP[t.payment_method_code] || t.payment_method_code}</Badge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {t.refund_status && <Badge variant="destructive">{tx('Reembolso:')}{' '}{t.refund_status}</Badge>}
                      {t.dispute_status && <Badge variant="destructive">{tx('Disputa:')}{' '}{t.dispute_status}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.transaction_date), 'dd/MM/yyyy HH:mm')}
                      {t.payer_email && ` · ${t.payer_email}`}
                      {t.provider_payment_id && ` · ${t.provider_payment_id.substring(0, 15)}...`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{fmt(Number(t.gross_amount))}</p>
                    {Number(t.fee_amount) > 0 && (
                      <p className="text-xs text-muted-foreground">{tx('Taxa:')}{' '}{fmt(Number(t.fee_amount))} {tx('· Líq:')}{' '}{fmt(Number(t.net_amount))}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
