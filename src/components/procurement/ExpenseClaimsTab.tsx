import { useState } from 'react';
import { useProcurement } from '@/hooks/useProcurement';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { tx, intlLocale } from '@/lib/i18n/ui';

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', submitted: 'Submetido', approved: 'Aprovado',
  rejected: 'Rejeitado', reimbursed: 'Reembolsado', cancelled: 'Cancelado',
};
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground', submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800', rejected: 'bg-destructive/10 text-destructive',
  reimbursed: 'bg-primary/10 text-primary', cancelled: 'bg-muted text-muted-foreground',
};

const fmt = (v: number) => new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'EUR' }).format(v);

const EXPENSE_TYPES = [
  { value: 'travel', get label() { return tx('Deslocação'); } },
  { value: 'meals', get label() { return tx('Refeições'); } },
  { value: 'tolls', get label() { return tx('Portagens'); } },
  { value: 'fuel', get label() { return tx('Combustível'); } },
  { value: 'accommodation', get label() { return tx('Alojamento'); } },
  { value: 'supplies', get label() { return tx('Material'); } },
  { value: 'events', get label() { return tx('Eventos/Torneios'); } },
  { value: 'general', get label() { return tx('Geral'); } },
];

export function ExpenseClaimsTab({ clubId }: { clubId: string }) {
  const { expenseClaims, expenseClaimsLoading, createExpenseClaim } = useProcurement(clubId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', expense_type: 'general', total_amount: 0 });

  const handleCreate = () => {
    createExpenseClaim.mutate({ ...form, status: 'submitted' } as any, {
      onSuccess: () => { setOpen(false); setForm({ title: '', description: '', expense_type: 'general', total_amount: 0 }); },
    });
  };

  if (expenseClaimsLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{tx('Nova Despesa')}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{tx('Submeter Despesa')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{tx('Título *')}</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>{tx('Descrição')}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div>
                <Label>{tx('Tipo de Despesa')}</Label>
                <Select value={form.expense_type} onValueChange={v => setForm(f => ({ ...f, expense_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{tx('Valor Total (€) *')}</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: Number(e.target.value) }))} /></div>
              <Button onClick={handleCreate} disabled={!form.title || form.total_amount <= 0 || createExpenseClaim.isPending} className="w-full">
                {createExpenseClaim.isPending ? tx('A submeter...') : tx('Submeter Despesa')}
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
                <TableHead>Nº</TableHead>
                <TableHead>{tx('Título')}</TableHead>
                <TableHead>{tx('Tipo')}</TableHead>
                <TableHead>{tx('Valor')}</TableHead>
                <TableHead>{tx('Estado')}</TableHead>
                <TableHead>{tx('Data')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseClaims.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{tx('Sem despesas registadas')}</TableCell></TableRow>
              ) : expenseClaims.map(ec => (
                <TableRow key={ec.id}>
                  <TableCell className="font-mono text-xs">{ec.report_number || '—'}</TableCell>
                  <TableCell className="font-medium">{ec.title}</TableCell>
                  <TableCell>{EXPENSE_TYPES.find(t => t.value === ec.expense_type)?.label || ec.expense_type}</TableCell>
                  <TableCell>{fmt(ec.total_amount)}</TableCell>
                  <TableCell><Badge className={statusColors[ec.status] || ''}>{statusLabels[ec.status] || ec.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(ec.created_at), 'dd/MM/yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
