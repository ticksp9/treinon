import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRegisterManualPayment } from '@/hooks/useClubPaymentSettings';
import { HandCoins } from 'lucide-react';
import { tx } from '@/lib/i18n/ui';

interface Props {
  clubId: string;
  chargeId: string;
  chargeDescription: string;
  balanceDue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MANUAL_METHODS = [
  { value: 'cash', get label() { return tx('Numerário'); } },
  { value: 'bank_transfer', get label() { return tx('Transferência Bancária'); } },
  { value: 'mb_way_manual', get label() { return tx('MB Way (manual)'); } },
  { value: 'terminal', get label() { return tx('Terminal POS'); } },
  { value: 'cheque', get label() { return tx('Cheque'); } },
  { value: 'other', get label() { return tx('Outro'); } },
];

export function ManualPaymentDialog({ clubId, chargeId, chargeDescription, balanceDue, open, onOpenChange }: Props) {
  const register = useRegisterManualPayment(clubId);
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(balanceDue.toString());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const handleSubmit = () => {
    register.mutate(
      {
        charge_id: chargeId,
        amount: parseFloat(amount),
        manual_method: method,
        manual_reference: reference || undefined,
        notes: notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="w-5 h-5" />
            {tx('Registar Pagamento Manual')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">{chargeDescription}</p>
            <p className="text-xs text-muted-foreground">{tx('Saldo em dívida:')}{' '}{fmt(balanceDue)}</p>
          </div>

          <div>
            <label className="text-sm font-medium">{tx('Método de Pagamento')}</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANUAL_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">{tx('Valor (€)')}</label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={balanceDue.toString()}
            />
            {parseFloat(amount) > balanceDue && (
              <p className="text-xs text-amber-600 mt-1">{tx('Valor superior ao saldo em dívida')}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">{tx('Referência (opcional)')}</label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder={tx('Nº recibo, transferência, etc.')} />
          </div>

          <div>
            <label className="text-sm font-medium">{tx('Notas (opcional)')}</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={tx('Observações adicionais')} />
          </div>

          <Button onClick={handleSubmit} disabled={!amount || parseFloat(amount) <= 0 || register.isPending} className="w-full">
            {register.isPending ? tx('A registar...') : tx('Confirmar Pagamento')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
