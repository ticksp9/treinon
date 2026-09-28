import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import type { PayrollCycle, PayrollEntry, PersonRegistry } from '@/hooks/useWorkforce';
import { computePayrollTotals } from '@/hooks/useWorkforce';

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

const STATUS_MAP: Record<string, string> = {
  draft: 'Rascunho', calculated: 'Calculado', under_review: 'Em Revisão',
  approved: 'Aprovado', posted: 'Lançado', paid: 'Pago', closed: 'Fechado',
};

interface Props {
  cycles: PayrollCycle[];
  entries: PayrollEntry[];
  people: PersonRegistry[];
  isLoading: boolean;
  onAddCycle: (c: Partial<PayrollCycle>) => void;
}

export function PayrollTab({ cycles, entries, people, isLoading, onAddCycle }: Props) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    period_month: String(now.getMonth() + 1),
    fiscal_year: String(now.getFullYear()),
    start_date: '',
    end_date: '',
  });

  const handleAdd = () => {
    if (!form.start_date || !form.end_date) return;
    onAddCycle({
      period_month: Number(form.period_month),
      fiscal_year: Number(form.fiscal_year),
      start_date: form.start_date,
      end_date: form.end_date,
    });
    setOpen(false);
  };

  const totals = computePayrollTotals(entries);
  const personName = (id: string) => people.find(p => p.id === id)?.full_name || '—';

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Bruto</p><p className="text-lg font-bold">{fmt(totals.gross)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Descontos</p><p className="text-lg font-bold text-destructive">-{fmt(totals.deductions)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Encargos</p><p className="text-lg font-bold">{fmt(totals.employerCharges)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Líquido</p><p className="text-lg font-bold">{fmt(totals.net)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Custo Total</p><p className="text-lg font-bold text-primary">{fmt(totals.totalCost)}</p></CardContent></Card>
      </div>

      {/* Cycles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ciclos de Processamento</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Ciclo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Ciclo de Payroll</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Mês</Label><Input type="number" min={1} max={12} value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))} /></div>
                  <div><Label>Ano</Label><Input type="number" value={form.fiscal_year} onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início *</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                  <div><Label>Fim *</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                </div>
                <Button onClick={handleAdd} className="w-full">Criar Ciclo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem ciclos</TableCell></TableRow>
              ) : cycles.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.period_month}/{c.fiscal_year}</TableCell>
                  <TableCell>{c.payroll_type}</TableCell>
                  <TableCell>{c.start_date}</TableCell>
                  <TableCell>{c.end_date}</TableCell>
                  <TableCell><Badge variant={c.status === 'closed' || c.status === 'paid' ? 'default' : 'secondary'}>{STATUS_MAP[c.status] || c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Entries */}
      {entries.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Lançamentos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Bruto</TableHead>
                  <TableHead>Descontos</TableHead>
                  <TableHead>Encargos</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{personName(e.person_id)}</TableCell>
                    <TableCell>{fmt(e.gross_amount)}</TableCell>
                    <TableCell className="text-destructive">-{fmt(e.deductions_amount)}</TableCell>
                    <TableCell>{fmt(e.employer_charges_amount)}</TableCell>
                    <TableCell className="font-semibold">{fmt(e.net_amount)}</TableCell>
                    <TableCell><Badge variant="secondary">{e.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
