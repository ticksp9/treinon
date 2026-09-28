import { useState } from 'react';
import { useProcurement } from '@/hooks/useProcurement';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Check, X } from 'lucide-react';
import { format } from 'date-fns';

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', submitted: 'Submetido', under_review: 'Em Revisão',
  approved: 'Aprovado', rejected: 'Rejeitado', converted: 'Convertido', cancelled: 'Cancelado',
};
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground', submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800',
  rejected: 'bg-destructive/10 text-destructive', converted: 'bg-primary/10 text-primary', cancelled: 'bg-muted text-muted-foreground',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export function PurchaseRequestsTab({ clubId }: { clubId: string }) {
  const { purchaseRequests, purchaseRequestsLoading, createPurchaseRequest, updatePurchaseRequestStatus } = useProcurement(clubId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', estimated_amount: 0, urgency: 'normal', justification: '' });

  const handleCreate = () => {
    createPurchaseRequest.mutate({ ...form, status: 'submitted' } as any, {
      onSuccess: () => { setOpen(false); setForm({ title: '', description: '', estimated_amount: 0, urgency: 'normal', justification: '' }); },
    });
  };

  if (purchaseRequestsLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Requisição</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Requisição de Compra</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Valor Estimado (€)</Label><Input type="number" value={form.estimated_amount} onChange={e => setForm(f => ({ ...f, estimated_amount: Number(e.target.value) }))} /></div>
              <div>
                <Label>Urgência</Label>
                <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Justificação</Label><Textarea value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))} /></div>
              <Button onClick={handleCreate} disabled={!form.title || createPurchaseRequest.isPending} className="w-full">
                {createPurchaseRequest.isPending ? 'A submeter...' : 'Submeter Requisição'}
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
                <TableHead>Nº</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Valor Est.</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseRequests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem requisições</TableCell></TableRow>
              ) : purchaseRequests.map(pr => (
                <TableRow key={pr.id}>
                  <TableCell className="font-mono text-xs">{pr.request_number || '—'}</TableCell>
                  <TableCell className="font-medium">{pr.title}</TableCell>
                  <TableCell>{fmt(pr.estimated_amount)}</TableCell>
                  <TableCell><Badge variant="outline">{pr.urgency}</Badge></TableCell>
                  <TableCell><Badge className={statusColors[pr.status] || ''}>{statusLabels[pr.status] || pr.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(pr.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    {(pr.status === 'submitted' || pr.status === 'under_review') && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => updatePurchaseRequestStatus.mutate({ id: pr.id, status: 'approved' })}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => updatePurchaseRequestStatus.mutate({ id: pr.id, status: 'rejected' })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
