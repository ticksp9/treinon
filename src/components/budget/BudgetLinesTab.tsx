import { useState } from 'react';
import { useBudget, BudgetLine } from '@/hooks/useBudget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle } from 'lucide-react';

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function BudgetLinesTab({ clubId }: { clubId: string }) {
  const { cycles, categories, costCenters, useVersions, useLines, createLine } = useBudget(clubId);
  const [open, setOpen] = useState(false);

  const activeCycle = cycles.data?.find(c => c.status === 'approved') || cycles.data?.[0];
  const versions = useVersions(activeCycle?.id || null);
  const activeVersion = versions.data?.[0];
  const lines = useLines(activeVersion?.id || null);

  const [form, setForm] = useState({
    category_id: '',
    cost_center_id: '',
    line_type: 'expense',
    line_nature: 'fixed',
    month: 1,
    budget_amount: 0,
    forecast_amount: 0,
    notes: '',
  });

  const handleCreate = () => {
    if (!activeVersion) return;
    createLine.mutate({
      budget_version_id: activeVersion.id,
      category_id: form.category_id || undefined,
      cost_center_id: form.cost_center_id || undefined,
      line_type: form.line_type,
      line_nature: form.line_nature,
      month: form.month,
      budget_amount: form.budget_amount,
      forecast_amount: form.forecast_amount,
      notes: form.notes || undefined,
    }, { onSuccess: () => setOpen(false) });
  };

  const catMap = new Map((categories.data || []).map(c => [c.id, c.name]));
  const ccMap = new Map((costCenters.data || []).map(c => [c.id, c.name]));

  if (!activeCycle) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Crie um ciclo orçamental primeiro.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Linhas Orçamentais</h3>
          <p className="text-sm text-muted-foreground">{activeCycle.name} — {activeVersion?.version_label || 'Versão inicial'}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="w-4 h-4 mr-2" />Nova Linha</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Linha Orçamental</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.line_type} onValueChange={v => setForm(p => ({ ...p, line_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Receita</SelectItem>
                      <SelectItem value="expense">Custo</SelectItem>
                      <SelectItem value="capex">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Natureza</Label>
                  <Select value={form.line_nature} onValueChange={v => setForm(p => ({ ...p, line_nature: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixo</SelectItem>
                      <SelectItem value="variable">Variável</SelectItem>
                      <SelectItem value="recurring">Recorrente</SelectItem>
                      <SelectItem value="extraordinary">Extraordinário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {(categories.data || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select value={form.cost_center_id} onValueChange={v => setForm(p => ({ ...p, cost_center_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {(costCenters.data || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Mês</Label>
                  <Select value={String(form.month)} onValueChange={v => setForm(p => ({ ...p, month: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthNames.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Orçamento (€)</Label>
                  <Input type="number" value={form.budget_amount} onChange={e => setForm(p => ({ ...p, budget_amount: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Forecast (€)</Label>
                  <Input type="number" value={form.forecast_amount} onChange={e => setForm(p => ({ ...p, forecast_amount: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <Label>Notas</Label>
                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <Button onClick={handleCreate} disabled={createLine.isPending} className="w-full">
                {createLine.isPending ? 'A criar...' : 'Adicionar Linha'}
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
                <TableHead>Mês</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>C. Custo</TableHead>
                <TableHead className="text-right">Orçamento</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Desvio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lines.data || []).map(line => {
                const variance = Number(line.actual_amount || 0) - Number(line.budget_amount || 0);
                return (
                  <TableRow key={line.id}>
                    <TableCell>{line.month ? monthNames[line.month - 1] : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {line.line_type === 'revenue' ? 'Rec' : line.line_type === 'capex' ? 'Inv' : 'Cst'}
                      </Badge>
                    </TableCell>
                    <TableCell>{line.category_id ? catMap.get(line.category_id) || '—' : '—'}</TableCell>
                    <TableCell>{line.cost_center_id ? ccMap.get(line.cost_center_id) || '—' : '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(line.budget_amount))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(line.forecast_amount))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(line.actual_amount))}</TableCell>
                    <TableCell className="text-right">
                      <span className={variance > 0 ? 'text-destructive' : variance < 0 ? 'text-green-600' : ''}>
                        {formatCurrency(variance)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!lines.data?.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Sem linhas orçamentais. Adicione a primeira.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
