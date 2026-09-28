import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Plus, Calendar, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { EXAM_CATEGORIES } from '@/hooks/useMedical';

export function ExamsTab() {
  const { user } = useAuth();
  const { clubId } = usePhysioAccess();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    person_id: '', exam_type_code: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    provider_name: '', notes: '',
  });

  const { data: exams, isLoading } = useQuery({
    queryKey: ['medical-exams', clubId, statusFilter],
    queryFn: async () => {
      let q = supabase.from('medical_exams').select('*').eq('club_id', clubId!).order('scheduled_date', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: players } = useQuery({
    queryKey: ['club-players-for-exams', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, name, number').eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('medical_exams').insert({
        club_id: clubId, person_id: form.person_id, exam_type_code: form.exam_type_code,
        scheduled_date: form.scheduled_date, provider_name: form.provider_name || null,
        notes: form.notes || null, status: 'scheduled', requested_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-exams'] });
      setShowDialog(false);
      setForm({ person_id: '', exam_type_code: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), provider_name: '', notes: '' });
      toast.success('Exame agendado!');
    },
    onError: () => toast.error('Erro ao agendar exame'),
  });

  const statuses = [
    { value: 'scheduled', label: 'Agendado', color: 'bg-blue-500/20 text-blue-700 border-blue-500/30' },
    { value: 'in_progress', label: 'Em Andamento', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
    { value: 'completed', label: 'Concluído', color: 'bg-green-500/20 text-green-700 border-green-500/30' },
    { value: 'validated', label: 'Validado', color: 'bg-green-600/20 text-green-800 border-green-600/30' },
    { value: 'expired', label: 'Expirado', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  ];

  const getStatusBadge = (status: string) => {
    const s = statuses.find(st => st.value === status);
    return s ? <Badge variant="outline" className={s.color}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
  };

  const filtered = exams?.filter(e => {
    if (!searchTerm) return true;
    const player = players?.find(p => p.id === e.person_id);
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
              {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Agendar Exame</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Agendar Exame Médico</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Atleta *</Label>
                <Select value={form.person_id} onValueChange={v => setForm({...form, person_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {players?.map(p => <SelectItem key={p.id} value={p.id}>#{p.number} {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Exame *</Label>
                <Select value={form.exam_type_code} onValueChange={v => setForm({...form, exam_type_code: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {EXAM_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.scheduled_date} onChange={e => setForm({...form, scheduled_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Prestador</Label>
                <Input placeholder="Nome do prestador..." value={form.provider_name} onChange={e => setForm({...form, provider_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea placeholder="Observações..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.person_id || !form.exam_type_code || createMutation.isPending}>
                Agendar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum exame encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data Agendada</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(exam => {
                    const player = players?.find(p => p.id === exam.person_id);
                    const cat = EXAM_CATEGORIES.find(c => c.value === exam.exam_type_code);
                    return (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{player ? `#${player.number} ${player.name}` : exam.person_id.slice(0,8)}</TableCell>
                        <TableCell>{cat?.label || exam.exam_type_code}</TableCell>
                        <TableCell>{exam.scheduled_date ? format(new Date(exam.scheduled_date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell>{exam.expiry_date ? format(new Date(exam.expiry_date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{exam.provider_name || '-'}</TableCell>
                        <TableCell>{getStatusBadge(exam.status)}</TableCell>
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
