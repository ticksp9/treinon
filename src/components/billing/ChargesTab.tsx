import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCharges, useRecordPayment } from '@/hooks/useBilling';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, CreditCard, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props { clubId: string; }

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'overdue', label: 'Vencido' },
  { value: 'partially_paid', label: 'Parcial' },
  { value: 'paid', label: 'Pago' },
  { value: 'cancelled', label: 'Cancelado' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'outline',
  overdue: 'destructive',
  partially_paid: 'secondary',
  paid: 'default',
  cancelled: 'secondary',
};

export function ChargesTab({ clubId }: Props) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const { data: charges, isLoading } = useCharges(clubId, { status: statusFilter, year: parseInt(yearFilter) });
  const recordPayment = useRecordPayment(clubId);
  const [payDialog, setPayDialog] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');

  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const handlePay = () => {
    if (!payDialog) return;
    recordPayment.mutate({
      chargeIds: [payDialog.id],
      amount: parseFloat(payAmount) || payDialog.balance_due,
      method: payMethod,
      reference: payRef || undefined,
      playerId: payDialog.player_id,
      guardianId: payDialog.guardian_id,
    }, { onSuccess: () => { setPayDialog(null); setPayAmount(''); setPayRef(''); } });
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div><h3 className="font-semibold">Cobranças</h3><p className="text-sm text-muted-foreground">Listagem de cobranças geradas</p></div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {(!charges || charges.length === 0) ? (
        <Card><CardContent className="py-12 text-center"><FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">Sem cobranças para os filtros selecionados</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {charges.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.description}</span>
                    <Badge variant={STATUS_COLORS[c.status] as any || 'outline'}>{STATUS_OPTIONS.find(s => s.value === c.status)?.label || c.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(c.players as any)?.name || 'N/A'} · {(c.players as any)?.teams?.name || ''} · Venc: {format(new Date(c.due_date), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-sm">{fmt(c.final_amount)}</div>
                    {c.balance_due > 0 && c.balance_due < c.final_amount && (
                      <div className="text-xs text-amber-600">Em aberto: {fmt(c.balance_due)}</div>
                    )}
                    {c.discount_amount > 0 && <div className="text-xs text-green-600">Desc: -{fmt(c.discount_amount)}</div>}
                  </div>
                  {c.status !== 'paid' && c.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" onClick={() => { setPayDialog(c); setPayAmount(String(c.balance_due)); }}>
                      <CreditCard className="w-3 h-3 mr-1" /> Pagar
                    </Button>
                  )}
                  {c.status === 'paid' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registar Pagamento</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <p className="text-sm"><strong>{payDialog.description}</strong> — {(payDialog.players as any)?.name}</p>
              <p className="text-sm text-muted-foreground">Em aberto: <strong>{fmt(payDialog.balance_due)}</strong></p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
                <div><Label>Método</Label><Select value={payMethod} onValueChange={setPayMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Dinheiro</SelectItem><SelectItem value="transfer">Transferência</SelectItem><SelectItem value="mbway">MBWay</SelectItem><SelectItem value="multibanco">Multibanco</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div>
              </div>
              <div><Label>Referência (opcional)</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Nº transação" /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button><Button onClick={handlePay} disabled={recordPayment.isPending}>Confirmar Pagamento</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
