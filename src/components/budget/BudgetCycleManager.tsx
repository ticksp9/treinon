import { useState } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, CheckCircle, Clock, FileText, Archive } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  under_review: { label: 'Em Revisão', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  revised: { label: 'Revisto', variant: 'outline' },
  archived: { label: 'Arquivado', variant: 'secondary' },
  superseded: { label: 'Substituído', variant: 'secondary' },
};

export function BudgetCycleManager({ clubId }: { clubId: string }) {
  const { cycles, createCycle, approveCycle } = useBudget(clubId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', season: '2025/2026', start_date: '2025-07-01', end_date: '2026-06-30', budget_scope: 'club' });

  const handleCreate = () => {
    createCycle.mutate(form, { onSuccess: () => setOpen(false) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Ciclos Orçamentais</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="w-4 h-4 mr-2" />Novo Ciclo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Ciclo Orçamental</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Orçamento 2025/2026" />
              </div>
              <div>
                <Label>Época</Label>
                <Input value={form.season} onChange={e => setForm(p => ({ ...p, season: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Âmbito</Label>
                <Select value={form.budget_scope} onValueChange={v => setForm(p => ({ ...p, budget_scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="club">Clube</SelectItem>
                    <SelectItem value="youth_program">Formação</SelectItem>
                    <SelectItem value="team">Equipa</SelectItem>
                    <SelectItem value="department">Departamento</SelectItem>
                    <SelectItem value="consolidated">Consolidado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!form.name || createCycle.isPending} className="w-full">
                {createCycle.isPending ? 'A criar...' : 'Criar Ciclo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {cycles.data?.map(cycle => {
          const sc = statusConfig[cycle.status] || statusConfig.draft;
          return (
            <Card key={cycle.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{cycle.name}</h4>
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cycle.season} · {format(new Date(cycle.start_date), 'dd/MM/yyyy')} — {format(new Date(cycle.end_date), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {cycle.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => approveCycle.mutate(cycle.id)}>
                      <CheckCircle className="w-4 h-4 mr-1" />Aprovar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!cycles.data?.length && !cycles.isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum ciclo orçamental criado. Crie o primeiro para começar.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
