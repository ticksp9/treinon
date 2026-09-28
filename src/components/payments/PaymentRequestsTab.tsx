import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePaymentIntents, useCreateCheckoutSession } from '@/hooks/usePaymentIntents';
import { useCharges } from '@/hooks/useBilling';
import { useClubPaymentSettings } from '@/hooks/useClubPaymentSettings';
import { format } from 'date-fns';
import { ExternalLink, CreditCard, Plus, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props { clubId: string; }

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  succeeded: 'default', pending: 'secondary', created: 'outline', failed: 'destructive', cancelled: 'destructive', expired: 'outline',
};

export function PaymentRequestsTab({ clubId }: Props) {
  const { data: intents, isLoading } = usePaymentIntents(clubId);
  const { data: charges } = useCharges(clubId, { status: 'all' });
  const { data: paymentConfig } = useClubPaymentSettings(clubId);
  const createCheckout = useCreateCheckoutSession(clubId);
  const [selectedCharge, setSelectedCharge] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [showCreate, setShowCreate] = useState(false);
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const isOnlineEnabled = paymentConfig?.settings?.allow_online_payments === true &&
    paymentConfig?.settings?.configuration_status === 'active';

  const pendingCharges = (charges || []).filter((c: any) => ['pending', 'overdue', 'partially_paid'].includes(c.status));

  const handleCreate = () => {
    if (!selectedCharge) return;
    createCheckout.mutate({ chargeId: selectedCharge, paymentMethod: selectedMethod }, {
      onSuccess: () => setShowCreate(false),
    });
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      {!isOnlineEnabled && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Pagamentos online não estão ativados. Configure na aba "Configuração" para começar a criar links de pagamento.
            Pode continuar a registar pagamentos manualmente na aba "Manual".
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Links de Pagamento</h3>
          <p className="text-sm text-muted-foreground">Sessões de checkout e pagamentos digitais</p>
        </div>
        {isOnlineEnabled && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />Criar Link</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Link de Pagamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cobrança</label>
                <Select value={selectedCharge} onValueChange={setSelectedCharge}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cobrança" /></SelectTrigger>
                  <SelectContent>
                    {pendingCharges.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.description} — {fmt(Number(c.balance_due))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Método</label>
                <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Cartão</SelectItem>
                    <SelectItem value="mb_way">MB WAY</SelectItem>
                    <SelectItem value="sepa_debit">SEPA Direct Debit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!selectedCharge || createCheckout.isPending} className="w-full">
                <CreditCard className="w-4 h-4 mr-2" />
                {createCheckout.isPending ? 'A criar...' : 'Criar Link de Pagamento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {(!intents || intents.length === 0) ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sem pedidos de pagamento</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {intents.map((i: any) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{(i.charges as any)?.description || 'Pagamento'}</span>
                    <Badge variant="outline">{i.payment_method_code}</Badge>
                    <Badge variant={STATUS_COLORS[i.status] || 'outline'}>{i.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(i.created_at), 'dd/MM/yyyy HH:mm')}
                    {i.provider_session_id && ` · ${i.provider_session_id.substring(0, 15)}...`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{fmt(Number(i.amount))}</span>
                  {i.checkout_url && i.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => window.open(i.checkout_url, '_blank')}>
                      <ExternalLink className="w-3 h-3 mr-1" />Abrir
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
