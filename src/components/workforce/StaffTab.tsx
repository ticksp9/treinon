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
import { Plus, Search } from 'lucide-react';
import type { PersonRegistry } from '@/hooks/useWorkforce';

const PERSON_TYPES = [
  { value: 'employee', label: 'Funcionário' },
  { value: 'contractor', label: 'Prestador' },
  { value: 'coach', label: 'Treinador' },
  { value: 'medical', label: 'Staff Médico' },
  { value: 'operational', label: 'Operacional' },
  { value: 'director', label: 'Dirigente' },
  { value: 'volunteer', label: 'Voluntário' },
  { value: 'other', label: 'Outro' },
];

interface Props {
  people: PersonRegistry[];
  isLoading: boolean;
  onAddPerson: (p: Partial<PersonRegistry>) => void;
}

export function StaffTab({ people, isLoading, onAddPerson }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', person_type: 'employee', tax_id: '', email: '', phone: '' });

  const filtered = people.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || p.person_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleAdd = () => {
    if (!form.full_name.trim()) return;
    onAddPerson(form);
    setForm({ full_name: '', person_type: 'employee', tax_id: '', email: '', phone: '' });
    setOpen(false);
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pessoas Registadas</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Pessoa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registar Pessoa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome Completo *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.person_type} onValueChange={v => setForm(f => ({ ...f, person_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERSON_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>NIF</Label><Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <Button onClick={handleAdd} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {PERSON_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem registos</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell><Badge variant="outline">{PERSON_TYPES.find(t => t.value === p.person_type)?.label || p.person_type}</Badge></TableCell>
                <TableCell>{p.tax_id || '—'}</TableCell>
                <TableCell>{p.email || '—'}</TableCell>
                <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
