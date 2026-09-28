import { useState } from 'react';
import { useProcurement, Vendor } from '@/hooks/useProcurement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search } from 'lucide-react';

const VENDOR_CATEGORIES = [
  { value: 'transport', label: 'Transportes' },
  { value: 'equipment', label: 'Equipamentos' },
  { value: 'health', label: 'Saúde' },
  { value: 'referees', label: 'Arbitragem' },
  { value: 'infrastructure', label: 'Infraestruturas' },
  { value: 'food', label: 'Alimentação' },
  { value: 'software', label: 'Software' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'admin', label: 'Administrativo' },
  { value: 'federation', label: 'Federação/Licenciamento' },
  { value: 'clubs', label: 'Outros Clubes' },
  { value: 'staff', label: 'Staff/Prestadores' },
  { value: 'other', label: 'Outros' },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-muted text-muted-foreground',
  blocked: 'bg-destructive/10 text-destructive',
  under_review: 'bg-amber-100 text-amber-800',
};

export function VendorsTab({ clubId }: { clubId: string }) {
  const { vendors, vendorsLoading, createVendor } = useProcurement(clubId);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ legal_name: '', tax_id: '', category: 'other', email: '', phone: '', payment_terms: 'net_30' });

  const filtered = vendors.filter(v =>
    v.legal_name.toLowerCase().includes(search.toLowerCase()) ||
    (v.tax_id || '').includes(search)
  );

  const handleCreate = () => {
    createVendor.mutate(form as any, { onSuccess: () => { setOpen(false); setForm({ legal_name: '', tax_id: '', category: 'other', email: '', phone: '', payment_terms: 'net_30' }); } });
  };

  if (vendorsLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Fornecedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome Legal *</Label><Input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} /></div>
              <div><Label>NIF</Label><Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VENDOR_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div>
                <Label>Condições de Pagamento</Label>
                <Select value={form.payment_terms} onValueChange={v => setForm(f => ({ ...f, payment_terms: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Imediato</SelectItem>
                    <SelectItem value="net_15">15 dias</SelectItem>
                    <SelectItem value="net_30">30 dias</SelectItem>
                    <SelectItem value="net_60">60 dias</SelectItem>
                    <SelectItem value="net_90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!form.legal_name || createVendor.isPending} className="w-full">
                {createVendor.isPending ? 'A criar...' : 'Criar Fornecedor'}
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
                <TableHead>Nome</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Condições</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem fornecedores registados</TableCell></TableRow>
              ) : filtered.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.legal_name}</TableCell>
                  <TableCell>{v.tax_id || '—'}</TableCell>
                  <TableCell>{VENDOR_CATEGORIES.find(c => c.value === v.category)?.label || v.category}</TableCell>
                  <TableCell>{v.payment_terms}</TableCell>
                  <TableCell><Badge className={statusColors[v.vendor_status] || ''}>{v.vendor_status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
