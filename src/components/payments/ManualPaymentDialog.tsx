import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRegisterManualPayment } from '@/hooks/useClubPaymentSettings';
import { HandCoins } from 'lucide-react';

interface Props {
  clubId: string;
  chargeId: string;
  chargeDescription: string;
  balanceDue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MANUAL_METHODS = [
  { value: 'cash', label: 'Numerário' },
  { value: 'bank_transfer', label: 'Transferência Bancária' },
  { value: 'mb_way_manual', label: 'MB Way (manual)' },
  { value: 'terminal', label: 'Terminal POS' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Outro' },
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
            Registar Pagamento Manual
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">{chargeDescription}</p>
            <p className="text-xs text-muted-foreground">Saldo em dívida: {fmt(balanceDue)}</p>
          </div>

          <div>
            <label className="text-sm font-medium">Método de Pagamento</label>
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
            <label className="text-sm font-medium">Valor (€)</label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={balanceDue.toString()}
            />
            {parseFloat(amount) > balanceDue && (
              <p className="text-xs text-amber-600 mt-1">Valor superior ao saldo em dívida</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Referência (opcional)</label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Nº recibo, transferência, etc." />
          </div>

          <div>
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações adicionais" />
          </div>

          <Button onClick={handleSubmit} disabled={!amount || parseFloat(amount) <= 0 || register.isPending} className="w-full">
            {register.isPending ? 'A registar...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
