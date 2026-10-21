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
import { getCurrentSeasonName, getSeasonStartYear } from '@/lib/constants';
import { tx } from '@/lib/i18n/ui';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { get label() { return tx('Rascunho'); }, variant: 'secondary' },
  under_review: { get label() { return tx('Em Revisão'); }, variant: 'outline' },
  approved: { get label() { return tx('Aprovado'); }, variant: 'default' },
  revised: { get label() { return tx('Revisto'); }, variant: 'outline' },
  archived: { get label() { return tx('Arquivado'); }, variant: 'secondary' },
  superseded: { get label() { return tx('Substituído'); }, variant: 'secondary' },
};

export function BudgetCycleManager({ clubId }: { clubId: string }) {
  const { cycles, createCycle, approveCycle } = useBudget(clubId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', season: getCurrentSeasonName(), start_date: `${getSeasonStartYear()}-07-01`, end_date: `${getSeasonStartYear() + 1}-06-30`, budget_scope: 'club' });

  const handleCreate = () => {
    createCycle.mutate(form, { onSuccess: () => setOpen(false) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{tx('Ciclos Orçamentais')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="w-4 h-4 mr-2" />{tx('Novo Ciclo')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{tx('Criar Ciclo Orçamental')}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>{tx('Nome')}</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={tx('Orçamento {{v0}}', { v0: getCurrentSeasonName() })} />
              </div>
              <div>
                <Label>{tx('Época')}</Label>
                <Input value={form.season} onChange={e => setForm(p => ({ ...p, season: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{tx('Início')}</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>{tx('Fim')}</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>{tx('Âmbito')}</Label>
                <Select value={form.budget_scope} onValueChange={v => setForm(p => ({ ...p, budget_scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="club">{tx('Clube')}</SelectItem>
                    <SelectItem value="youth_program">{tx('Formação')}</SelectItem>
                    <SelectItem value="team">{tx('Equipa')}</SelectItem>
                    <SelectItem value="department">{tx('Departamento')}</SelectItem>
                    <SelectItem value="consolidated">{tx('Consolidado')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!form.name || createCycle.isPending} className="w-full">
                {createCycle.isPending ? tx('A criar...') : tx('Criar Ciclo')}
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
                      <CheckCircle className="w-4 h-4 mr-1" />{tx('Aprovar')}
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
              {tx('Nenhum ciclo orçamental criado. Crie o primeiro para começar.')}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
