import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CLEARANCE_STATUSES } from '@/hooks/useMedical';

export function ClearancesTab() {
  const { user } = useAuth();
  const { clubId } = usePhysioAccess();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    person_id: '', clearance_type: 'global', clearance_status: 'fit',
    valid_from: format(new Date(), 'yyyy-MM-dd'), valid_to: '', restrictions: '', clinical_notes: '',
  });

  const { data: clearances, isLoading } = useQuery({
    queryKey: ['medical-clearances', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('medical_clearances').select('*').eq('club_id', clubId!).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: players } = useQuery({
    queryKey: ['club-players-clearances', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, name, number').eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('medical_clearances').insert({
        club_id: clubId, person_id: form.person_id, clearance_type: form.clearance_type,
        clearance_status: form.clearance_status, valid_from: form.valid_from,
        valid_to: form.valid_to || null, restrictions: form.restrictions || null,
        clinical_notes: form.clinical_notes || null, granted_by: user?.id, granted_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-clearances'] });
      setShowDialog(false);
      toast.success('Aptidão registada!');
    },
    onError: () => toast.error('Erro ao registar aptidão'),
  });

  const getStatusBadge = (status: string) => {
    const s = CLEARANCE_STATUSES.find(c => c.value === status);
    return s ? <Badge variant="outline" className={s.color}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
  };

  const typeLabels: Record<string, string> = { global: 'Global', training: 'Treino', match: 'Jogo', partial: 'Parcial' };

  const filtered = clearances?.filter(c => {
    if (!searchTerm) return true;
    const player = players?.find(p => p.id === c.person_id);
    return player?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar atleta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Aptidão</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registar Aptidão Desportiva</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Atleta *</Label>
                <Select value={form.person_id} onValueChange={v => setForm({...form, person_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id}>#{p.number} {p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.clearance_type} onValueChange={v => setForm({...form, clearance_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="training">Treino</SelectItem>
                      <SelectItem value="match">Jogo</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado *</Label>
                  <Select value={form.clearance_status} onValueChange={v => setForm({...form, clearance_status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLEARANCE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Válido De</Label><Input type="date" value={form.valid_from} onChange={e => setForm({...form, valid_from: e.target.value})} /></div>
                <div className="space-y-2"><Label>Válido Até</Label><Input type="date" value={form.valid_to} onChange={e => setForm({...form, valid_to: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Restrições</Label><Textarea placeholder="Restrições aplicáveis..." value={form.restrictions} onChange={e => setForm({...form, restrictions: e.target.value})} rows={2} /></div>
              <div className="space-y-2"><Label>Notas Clínicas</Label><Textarea placeholder="Observações..." value={form.clinical_notes} onChange={e => setForm({...form, clinical_notes: e.target.value})} rows={2} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.person_id || createMutation.isPending}>Registar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12"><Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma aptidão registada</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Válido De</TableHead>
                    <TableHead>Válido Até</TableHead>
                    <TableHead>Restrições</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(c => {
                    const player = players?.find(p => p.id === c.person_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{player ? `#${player.number} ${player.name}` : '-'}</TableCell>
                        <TableCell>{typeLabels[c.clearance_type] || c.clearance_type}</TableCell>
                        <TableCell>{getStatusBadge(c.clearance_status)}</TableCell>
                        <TableCell>{c.valid_from ? format(new Date(c.valid_from), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell>{c.valid_to ? format(new Date(c.valid_to), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{c.restrictions || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
