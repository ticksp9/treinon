import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search } from 'lucide-react';

interface Props {
  stock: any[];
  onCreateStock: (data: Record<string, unknown>) => void;
}

export function StockTab({ stock, onCreateStock }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku: '', item_name: '', unit_of_measure: 'unit', minimum_stock: '0', current_stock: '0' });

  const filtered = stock.filter(s =>
    s.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.sku || !form.item_name) return;
    onCreateStock({ ...form, minimum_stock: Number(form.minimum_stock), current_stock: Number(form.current_stock) });
    setOpen(false);
    setForm({ sku: '', item_name: '', unit_of_measure: 'unit', minimum_stock: '0', current_stock: '0' });
  };

  const getStockBadge = (item: any) => {
    if (item.current_stock <= 0) return <Badge variant="destructive">Esgotado</Badge>;
    if (item.current_stock <= (item.reorder_point || item.minimum_stock || 0)) return <Badge variant="outline" className="border-amber-500 text-amber-600">Baixo</Badge>;
    return <Badge variant="secondary">OK</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Stock & Consumíveis ({filtered.length})</CardTitle>
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8 w-48" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Item de Stock</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
                <div><Label>Nome</Label><Input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} /></div>
                <div><Label>Unidade</Label><Input value={form.unit_of_measure} onChange={e => setForm(f => ({ ...f, unit_of_measure: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Stock Mínimo</Label><Input type="number" value={form.minimum_stock} onChange={e => setForm(f => ({ ...f, minimum_stock: e.target.value }))} /></div>
                  <div><Label>Stock Atual</Label><Input type="number" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} /></div>
                </div>
                <Button onClick={handleSubmit}>Criar Item</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Unidade</TableHead><TableHead>Stock</TableHead><TableHead>Mínimo</TableHead><TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem items de stock</TableCell></TableRow>
            ) : filtered.slice(0, 50).map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.sku}</TableCell>
                <TableCell className="font-medium">{s.item_name}</TableCell>
                <TableCell className="text-xs">{s.item_type}</TableCell>
                <TableCell className="text-xs">{s.unit_of_measure}</TableCell>
                <TableCell className="font-bold">{s.current_stock}</TableCell>
                <TableCell className="text-muted-foreground">{s.minimum_stock}</TableCell>
                <TableCell>{getStockBadge(s)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
