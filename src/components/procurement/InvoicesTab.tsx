import { useState } from 'react';
import { useProcurement } from '@/hooks/useProcurement';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

const statusLabels: Record<string, string> = {
  unpaid: 'Por pagar', partially_paid: 'Parc. Pago', paid: 'Pago', overdue: 'Vencido', disputed: 'Disputado', cancelled: 'Cancelado',
};
const statusColors: Record<string, string> = {
  unpaid: 'bg-amber-100 text-amber-800', partially_paid: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800', overdue: 'bg-destructive/10 text-destructive',
  disputed: 'bg-purple-100 text-purple-800', cancelled: 'bg-muted text-muted-foreground',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export function InvoicesTab({ clubId }: { clubId: string }) {
  const { invoices, invoicesLoading, vendors, createInvoice } = useProcurement(clubId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vendor_id: '', invoice_number: '', invoice_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '', subtotal: 0, tax_total: 0,
  });

  const grossTotal = form.subtotal + form.tax_total;

  const handleCreate = () => {
    createInvoice.mutate({
      vendor_id: form.vendor_id, invoice_number: form.invoice_number,
      invoice_date: form.invoice_date, due_date: form.due_date,
      subtotal: form.subtotal, tax_total: form.tax_total,
      gross_total: grossTotal,
    } as any, {
      onSuccess: () => {
        setOpen(false);
        setForm({ vendor_id: '', invoice_number: '', invoice_date: format(new Date(), 'yyyy-MM-dd'), due_date: '', subtotal: 0, tax_total: 0 });
      },
    });
  };

  // Detect overdue visually
  const now = new Date();
  const isOverdue = (inv: any) => inv.payment_status !== 'paid' && inv.payment_status !== 'cancelled' && new Date(inv.due_date) < now;

  if (invoicesLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Registar Fatura</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registar Fatura de Fornecedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Fornecedor *</Label>
                <Select value={form.vendor_id} onValueChange={v => setForm(f => ({ ...f, vendor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{vendors.filter(v => v.vendor_status === 'active').map(v => <SelectItem key={v.id} value={v.id}>{v.legal_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº Fatura *</Label><Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Fatura</Label><Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} /></div>
                <div><Label>Data Vencimento *</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Subtotal (€)</Label><Input type="number" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: Number(e.target.value) }))} /></div>
                <div><Label>IVA (€)</Label><Input type="number" value={form.tax_total} onChange={e => setForm(f => ({ ...f, tax_total: Number(e.target.value) }))} /></div>
              </div>
              <div className="text-right font-semibold">Total: {fmt(grossTotal)}</div>
              <Button onClick={handleCreate} disabled={!form.vendor_id || !form.invoice_number || !form.due_date || createInvoice.isPending} className="w-full">
                {createInvoice.isPending ? 'A registar...' : 'Registar Fatura'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Fatura</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Em Aberto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem faturas registadas</TableCell></TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.id} className={isOverdue(inv) ? 'bg-destructive/5' : ''}>
                  <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                  <TableCell className="font-medium">{(inv as any).vendors?.legal_name || '—'}</TableCell>
                  <TableCell className="text-xs">{format(new Date(inv.invoice_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-xs">{format(new Date(inv.due_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{fmt(inv.gross_total)}</TableCell>
                  <TableCell className="font-semibold">{fmt(inv.outstanding_amount)}</TableCell>
                  <TableCell>
                    <Badge className={isOverdue(inv) ? statusColors.overdue : (statusColors[inv.payment_status] || '')}>
                      {isOverdue(inv) ? 'Vencido' : (statusLabels[inv.payment_status] || inv.payment_status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
