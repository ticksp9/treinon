import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import type { EmploymentContract, PersonRegistry } from '@/hooks/useWorkforce';

const CONTRACT_TYPES = [
  { value: 'open_ended', label: 'Sem Termo' },
  { value: 'fixed_term', label: 'A Termo' },
  { value: 'service', label: 'Prestação de Serviços' },
  { value: 'consultancy', label: 'Consultoria' },
  { value: 'internship', label: 'Estágio' },
  { value: 'volunteer', label: 'Voluntário' },
  { value: 'sports_specific', label: 'Desportivo' },
  { value: 'other', label: 'Outro' },
];

const STATUS_MAP: Record<string, string> = {
  draft: 'Rascunho', active: 'Ativo', suspended: 'Suspenso',
  terminated: 'Terminado', expired: 'Expirado', renewed: 'Renovado',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

interface Props {
  contracts: EmploymentContract[];
  people: PersonRegistry[];
  isLoading: boolean;
  onAddContract: (c: Partial<EmploymentContract>) => void;
}

export function ContractsTab({ contracts, people, isLoading, onAddContract }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ person_id: '', contract_type: 'open_ended', start_date: '', end_date: '', base_salary: '0' });

  const handleAdd = () => {
    if (!form.person_id || !form.start_date) return;
    onAddContract({ person_id: form.person_id, contract_type: form.contract_type, start_date: form.start_date, end_date: form.end_date || undefined, base_salary: Number(form.base_salary) });
    setForm({ person_id: '', contract_type: 'open_ended', start_date: '', end_date: '', base_salary: '0' });
    setOpen(false);
  };

  const personName = (id: string) => people.find(p => p.id === id)?.full_name || '—';

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contratos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Contrato</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Contrato</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Pessoa *</Label>
                <Select value={form.person_id} onValueChange={v => setForm(f => ({ ...f, person_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar pessoa" /></SelectTrigger>
                  <SelectContent>{people.filter(p => p.status === 'active').map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Contrato</Label>
                <Select value={form.contract_type} onValueChange={v => setForm(f => ({ ...f, contract_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início *</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
              </div>
              <div><Label>Salário Base (€)</Label><Input type="number" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} /></div>
              <Button onClick={handleAdd} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Salário Base</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem contratos</TableCell></TableRow>
            ) : contracts.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{personName(c.person_id)}</TableCell>
                <TableCell>{CONTRACT_TYPES.find(t => t.value === c.contract_type)?.label || c.contract_type}</TableCell>
                <TableCell>{c.start_date}</TableCell>
                <TableCell>{c.end_date || '—'}</TableCell>
                <TableCell>{fmt(c.base_salary)}</TableCell>
                <TableCell>
                  <Badge variant={c.contract_status === 'active' ? 'default' : c.contract_status === 'draft' ? 'secondary' : 'outline'}>
                    {STATUS_MAP[c.contract_status] || c.contract_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
