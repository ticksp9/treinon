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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { INJURY_CASE_STATUSES, INJURY_CONTEXTS } from '@/hooks/useMedical';
import { BODY_AREAS, INJURY_TYPES, INJURY_SEVERITIES } from '@/lib/physio-constants';

export function InjuryCasesTab() {
  const { user } = useAuth();
  const { clubId } = usePhysioAccess();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    person_id: '', body_area: '', body_side: '', injury_type: '', severity: 'moderate',
    context: 'training', event_date: format(new Date(), 'yyyy-MM-dd'), expected_days_out: '',
    is_recurrence: false, restrictions: '', diagnosis_notes: '',
  });

  const { data: cases, isLoading } = useQuery({
    queryKey: ['injury-cases', clubId, statusFilter],
    queryFn: async () => {
      let q = supabase.from('injury_cases').select('*').eq('club_id', clubId!).order('event_date', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('case_status', statusFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: players } = useQuery({
    queryKey: ['club-players-injuries', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, name, number').eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('injury_cases').insert({
        club_id: clubId, person_id: form.person_id, body_area: form.body_area,
        body_side: form.body_side || null, injury_type: form.injury_type, severity: form.severity,
        context: form.context, event_date: form.event_date,
        expected_days_out: form.expected_days_out ? parseInt(form.expected_days_out) : null,
        is_recurrence: form.is_recurrence, restrictions: form.restrictions || null,
        diagnosis_notes: form.diagnosis_notes || null, case_status: 'open', created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injury-cases'] });
      setShowDialog(false);
      toast.success('Caso de lesão aberto!');
    },
    onError: () => toast.error('Erro ao registar lesão'),
  });

  const getStatusBadge = (status: string) => {
    const s = INJURY_CASE_STATUSES.find(c => c.value === status);
    return s ? <Badge variant="outline" className={s.color}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
  };

  const getSeverityBadge = (sev: string) => {
    const s = INJURY_SEVERITIES.find(c => c.value === sev);
    return s ? <Badge variant="outline" className={s.color}>{s.label}</Badge> : null;
  };

  const filtered = cases?.filter(c => {
    if (!searchTerm) return true;
    const player = players?.find(p => p.id === c.person_id);
    return player?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pesquisar atleta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {INJURY_CASE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo Caso</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Abrir Caso de Lesão</DialogTitle></DialogHeader>
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
                  <Label>Zona Corporal *</Label>
                  <Select value={form.body_area} onValueChange={v => setForm({...form, body_area: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{BODY_AREAS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={form.injury_type} onValueChange={v => setForm({...form, injury_type: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{INJURY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gravidade</Label>
                  <Select value={form.severity} onValueChange={v => setForm({...form, severity: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INJURY_SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contexto</Label>
                  <Select value={form.context} onValueChange={v => setForm({...form, context: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INJURY_CONTEXTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data Evento *</Label><Input type="date" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>Dias Previsto Ausência</Label><Input type="number" value={form.expected_days_out} onChange={e => setForm({...form, expected_days_out: e.target.value})} /></div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Recorrência</Label>
                <Switch checked={form.is_recurrence} onCheckedChange={c => setForm({...form, is_recurrence: c})} />
              </div>
              <div className="space-y-2"><Label>Restrições</Label><Textarea value={form.restrictions} onChange={e => setForm({...form, restrictions: e.target.value})} rows={2} /></div>
              <div className="space-y-2"><Label>Diagnóstico / Notas</Label><Textarea value={form.diagnosis_notes} onChange={e => setForm({...form, diagnosis_notes: e.target.value})} rows={2} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.person_id || !form.body_area || !form.injury_type || createMutation.isPending}>Abrir Caso</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12"><AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum caso de lesão</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Gravidade</TableHead>
                    <TableHead>Contexto</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Dias Afastado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(c => {
                    const player = players?.find(p => p.id === c.person_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{player ? `#${player.number} ${player.name}` : '-'}</TableCell>
                        <TableCell>{BODY_AREAS.find(a => a.value === c.body_area)?.label || c.body_area}</TableCell>
                        <TableCell>{INJURY_TYPES.find(t => t.value === c.injury_type)?.label || c.injury_type}</TableCell>
                        <TableCell>{getSeverityBadge(c.severity)}</TableCell>
                        <TableCell>{INJURY_CONTEXTS.find(ctx => ctx.value === c.context)?.label || c.context}</TableCell>
                        <TableCell>{format(new Date(c.event_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{c.actual_days_out || c.expected_days_out || '-'}</TableCell>
                        <TableCell>{getStatusBadge(c.case_status)}</TableCell>
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
