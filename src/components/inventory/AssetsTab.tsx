import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';

const STATUS_MAP: Record<string, string> = {
  in_stock: 'Em Stock', assigned: 'Atribuído', in_use: 'Em Uso', maintenance: 'Manutenção',
  damaged: 'Danificado', lost: 'Perdido', retired: 'Retirado', disposed: 'Abatido', reserved: 'Reservado',
};

interface Props {
  assets: any[];
  onCreateAsset: (data: Record<string, unknown>) => void;
}

export function AssetsTab({ assets, onCreateAsset }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ asset_code: '', name: '', brand: '', model: '', serial_number: '', acquisition_cost: '', asset_status: 'in_stock' });

  const filtered = assets.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.asset_code?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const handleSubmit = () => {
    if (!form.asset_code || !form.name) return;
    onCreateAsset({ ...form, acquisition_cost: Number(form.acquisition_cost) || 0 });
    setOpen(false);
    setForm({ asset_code: '', name: '', brand: '', model: '', serial_number: '', acquisition_cost: '', asset_status: 'in_stock' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Ativos ({filtered.length})</CardTitle>
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8 w-48" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Ativo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Ativo</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Código</Label><Input value={form.asset_code} onChange={e => setForm(f => ({ ...f, asset_code: e.target.value }))} /></div>
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
                  <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
                </div>
                <div><Label>Nº Série</Label><Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></div>
                <div><Label>Custo Aquisição (€)</Label><Input type="number" value={form.acquisition_cost} onChange={e => setForm(f => ({ ...f, acquisition_cost: e.target.value }))} /></div>
                <div><Label>Estado</Label>
                  <Select value={form.asset_status} onValueChange={v => setForm(f => ({ ...f, asset_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSubmit}>Criar Ativo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Marca/Modelo</TableHead>
              <TableHead>Nº Série</TableHead><TableHead>Custo</TableHead><TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem ativos registados</TableCell></TableRow>
            ) : filtered.slice(0, 50).map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.asset_code}</TableCell>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{[a.brand, a.model].filter(Boolean).join(' ')}</TableCell>
                <TableCell className="text-xs">{a.serial_number || '—'}</TableCell>
                <TableCell>{fmt(Number(a.acquisition_cost) || 0)}</TableCell>
                <TableCell><Badge variant={a.asset_status === 'in_stock' ? 'secondary' : a.asset_status === 'damaged' || a.asset_status === 'lost' ? 'destructive' : 'outline'}>{STATUS_MAP[a.asset_status] || a.asset_status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
