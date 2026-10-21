import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { tx } from '@/lib/i18n/ui';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  open: { get label() { return tx('Aberta'); }, variant: 'destructive' },
  scheduled: { get label() { return tx('Agendada'); }, variant: 'outline' },
  in_progress: { get label() { return tx('Em Curso'); }, variant: 'default' },
  waiting_parts: { get label() { return tx('Aguardar Peças'); }, variant: 'secondary' },
  completed: { get label() { return tx('Concluída'); }, variant: 'default' },
  cancelled: { get label() { return tx('Cancelada'); }, variant: 'secondary' },
};

interface Props {
  workOrders: any[];
  facilities: any[];
  onCreateWorkOrder: (d: any) => void;
}

export function MaintenanceTab({ workOrders, facilities, onCreateWorkOrder }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ facility_id: '', title: '', work_order_type: 'corrective', priority: 'medium' });

  const handleCreate = () => {
    if (!form.facility_id || !form.title) return;
    onCreateWorkOrder(form);
    setOpen(false);
    setForm({ facility_id: '', title: '', work_order_type: 'corrective', priority: 'medium' });
  };

  const getFacName = (id: string) => facilities.find(f => f.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{tx('Ordens de Trabalho (')}{workOrders.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx('Ordem de Trabalho')}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{tx('Nova Ordem de Trabalho')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{tx('Instalação')}</Label><Select value={form.facility_id} onValueChange={v => setForm(p => ({ ...p, facility_id: v }))}><SelectTrigger><SelectValue placeholder={tx('Selecionar')} /></SelectTrigger><SelectContent>{facilities.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{tx('Título')}</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>{tx('Tipo')}</Label><Select value={form.work_order_type} onValueChange={v => setForm(p => ({ ...p, work_order_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="preventive">{tx('Preventiva')}</SelectItem><SelectItem value="corrective">{tx('Corretiva')}</SelectItem><SelectItem value="inspection">{tx('Inspeção')}</SelectItem></SelectContent></Select></div>
              <div><Label>{tx('Prioridade')}</Label><Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">{tx('Baixa')}</SelectItem><SelectItem value="medium">{tx('Média')}</SelectItem><SelectItem value="high">{tx('Alta')}</SelectItem><SelectItem value="critical">{tx('Crítica')}</SelectItem></SelectContent></Select></div>
              <Button onClick={handleCreate} className="w-full">{tx('Criar')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {workOrders.map(wo => {
          const st = STATUS_MAP[wo.status] || { label: wo.status, variant: 'outline' as const };
          return (
            <Card key={wo.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{wo.title}</p>
                  <p className="text-xs text-muted-foreground">{getFacName(wo.facility_id)} • {wo.work_order_type} {tx('• Prioridade:')}{' '}{wo.priority}</p>
                </div>
                <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
        {workOrders.length === 0 && <Card><CardContent className="py-6 text-center text-muted-foreground">{tx('Nenhuma ordem de trabalho')}</CardContent></Card>}
      </div>
    </div>
  );
}
