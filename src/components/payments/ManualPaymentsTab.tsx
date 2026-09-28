import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCharges } from '@/hooks/useBilling';
import { useClubPaymentSettings } from '@/hooks/useClubPaymentSettings';
import { ManualPaymentDialog } from './ManualPaymentDialog';
import { HandCoins, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props { clubId: string; }

export function ManualPaymentsTab({ clubId }: Props) {
  const { data: charges, isLoading } = useCharges(clubId, { status: 'all' });
  const { data: paymentConfig } = useClubPaymentSettings(clubId);
  const [selectedCharge, setSelectedCharge] = useState<any>(null);
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const pendingCharges = (charges || []).filter((c: any) =>
    ['pending', 'overdue', 'partially_paid'].includes(c.status)
  );

  if (isLoading) return <Skeleton className="h-64" />;

  const isManualAllowed = paymentConfig?.settings?.allow_manual_payments !== false;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <HandCoins className="w-5 h-5" />
          Pagamentos Manuais
        </h3>
        <p className="text-sm text-muted-foreground">
          Registar pagamentos recebidos por numerário, transferência, MB Way manual, terminal ou outro método.
        </p>
      </div>

      {!isManualAllowed && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Pagamentos manuais estão desativados nas configurações do clube.</AlertDescription>
        </Alert>
      )}

      {pendingCharges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma cobrança pendente para pagamento manual.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pendingCharges.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.description}</span>
                    <Badge variant={c.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {c.status === 'overdue' ? 'Vencida' : c.status === 'partially_paid' ? 'Parcial' : 'Pendente'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.players?.name && `${c.players.name} · `}
                    Vencimento: {new Date(c.due_date).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-bold">{fmt(Number(c.balance_due))}</span>
                    {Number(c.balance_due) < Number(c.final_amount) && (
                      <p className="text-xs text-muted-foreground">de {fmt(Number(c.final_amount))}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedCharge(c)}
                    disabled={!isManualAllowed}
                  >
                    <HandCoins className="w-4 h-4 mr-1" />Registar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedCharge && (
        <ManualPaymentDialog
          clubId={clubId}
          chargeId={selectedCharge.id}
          chargeDescription={selectedCharge.description}
          balanceDue={Number(selectedCharge.balance_due)}
          open={!!selectedCharge}
          onOpenChange={(open) => !open && setSelectedCharge(null)}
        />
      )}
    </div>
  );
}
