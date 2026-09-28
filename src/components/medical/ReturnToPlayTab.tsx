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
import { Plus, ArrowUpRight, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { RTP_STAGES } from '@/hooks/useMedical';

export function ReturnToPlayTab() {
  const { user } = useAuth();
  const { clubId } = usePhysioAccess();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    person_id: '', decision_type: 'return_to_train', stage: 'partial_training',
    decision_date: format(new Date(), 'yyyy-MM-dd'), justification: '',
    perceived_risk: '', remaining_restrictions: '', next_review_date: '',
  });

  const { data: decisions, isLoading } = useQuery({
    queryKey: ['rtp-decisions', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('return_to_play_decisions').select('*').eq('club_id', clubId!).order('decision_date', { ascending: false });
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: players } = useQuery({
    queryKey: ['club-players-rtp', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, name, number').eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('return_to_play_decisions').insert({
        club_id: clubId, person_id: form.person_id, decision_type: form.decision_type,
        stage: form.stage, decision_date: form.decision_date, decided_by: user?.id,
        justification: form.justification || null, perceived_risk: form.perceived_risk || null,
        remaining_restrictions: form.remaining_restrictions || null,
        next_review_date: form.next_review_date || null, status: 'approved',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rtp-decisions'] });
      setShowDialog(false);
      toast.success('Decisão registada!');
    },
    onError: () => toast.error('Erro ao registar decisão'),
  });

  const decisionTypes: Record<string, string> = {
    return_to_train: 'Retorno ao Treino',
    return_to_play: 'Retorno ao Jogo',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Decisão</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Decisão de Retorno</DialogTitle></DialogHeader>
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
                  <Label>Tipo *</Label>
                  <Select value={form.decision_type} onValueChange={v => setForm({...form, decision_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return_to_train">Retorno ao Treino</SelectItem>
                      <SelectItem value="return_to_play">Retorno ao Jogo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estágio</Label>
                  <Select value={form.stage} onValueChange={v => setForm({...form, stage: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RTP_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data Decisão</Label><Input type="date" value={form.decision_date} onChange={e => setForm({...form, decision_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>Próxima Revisão</Label><Input type="date" value={form.next_review_date} onChange={e => setForm({...form, next_review_date: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Justificação</Label><Textarea value={form.justification} onChange={e => setForm({...form, justification: e.target.value})} rows={2} /></div>
              <div className="space-y-2"><Label>Risco Percebido</Label><Input value={form.perceived_risk} onChange={e => setForm({...form, perceived_risk: e.target.value})} placeholder="Baixo, Moderado, Alto..." /></div>
              <div className="space-y-2"><Label>Restrições Remanescentes</Label><Textarea value={form.remaining_restrictions} onChange={e => setForm({...form, remaining_restrictions: e.target.value})} rows={2} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.person_id || createMutation.isPending}>Registar Decisão</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : decisions?.length === 0 ? (
            <div className="text-center py-12"><ArrowUpRight className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma decisão de retorno</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Próxima Revisão</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisions?.map(d => {
                    const player = players?.find(p => p.id === d.person_id);
                    const stage = RTP_STAGES.find(s => s.value === d.stage);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{player ? `#${player.number} ${player.name}` : '-'}</TableCell>
                        <TableCell>{decisionTypes[d.decision_type] || d.decision_type}</TableCell>
                        <TableCell><Badge variant="outline">{stage?.label || d.stage}</Badge></TableCell>
                        <TableCell>{format(new Date(d.decision_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-muted-foreground">{d.perceived_risk || '-'}</TableCell>
                        <TableCell>{d.next_review_date ? format(new Date(d.next_review_date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell><Badge variant={d.status === 'approved' ? 'secondary' : 'outline'}>{d.status === 'approved' ? 'Aprovado' : d.status}</Badge></TableCell>
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
