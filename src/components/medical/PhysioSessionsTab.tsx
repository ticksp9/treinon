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
import { Plus, Stethoscope, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PHYSIO_MODALITIES } from '@/hooks/useMedical';

export function PhysioSessionsTab() {
  const { user } = useAuth();
  const { clubId } = usePhysioAccess();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    person_id: '', modality: '', session_date: format(new Date(), 'yyyy-MM-dd'),
    duration_minutes: '30', pain_before: '', pain_after: '', evolution_notes: '',
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['physio-sessions-list', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('physio_sessions').select('*').eq('club_id', clubId!).order('session_date', { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: players } = useQuery({
    queryKey: ['club-players-sessions', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, name, number').eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('physio_sessions').insert({
        club_id: clubId, person_id: form.person_id, modality: form.modality,
        session_date: form.session_date, duration_minutes: parseInt(form.duration_minutes) || 30,
        pain_before: form.pain_before ? parseInt(form.pain_before) : null,
        pain_after: form.pain_after ? parseInt(form.pain_after) : null,
        evolution_notes: form.evolution_notes || null, therapist_id: user?.id, attendance_status: 'completed',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physio-sessions-list'] });
      setShowDialog(false);
      toast.success('Sessão registada!');
    },
    onError: () => toast.error('Erro ao registar sessão'),
  });

  const filtered = sessions?.filter(s => {
    if (!searchTerm) return true;
    const player = players?.find(p => p.id === s.person_id);
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
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Sessão</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registar Sessão de Fisioterapia</DialogTitle></DialogHeader>
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
                  <Label>Modalidade *</Label>
                  <Select value={form.modality} onValueChange={v => setForm({...form, modality: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{PHYSIO_MODALITIES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.session_date} onChange={e => setForm({...form, session_date: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: e.target.value})} /></div>
                <div className="space-y-2"><Label>Dor Antes (0-10)</Label><Input type="number" min="0" max="10" value={form.pain_before} onChange={e => setForm({...form, pain_before: e.target.value})} /></div>
                <div className="space-y-2"><Label>Dor Depois (0-10)</Label><Input type="number" min="0" max="10" value={form.pain_after} onChange={e => setForm({...form, pain_after: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Evolução / Notas</Label><Textarea value={form.evolution_notes} onChange={e => setForm({...form, evolution_notes: e.target.value})} rows={3} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.person_id || !form.modality || createMutation.isPending}>Registar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12"><Stethoscope className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma sessão registada</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Dor Antes</TableHead>
                    <TableHead>Dor Depois</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(s => {
                    const player = players?.find(p => p.id === s.person_id);
                    const mod = PHYSIO_MODALITIES.find(m => m.value === s.modality);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{player ? `#${player.number} ${player.name}` : '-'}</TableCell>
                        <TableCell>{format(new Date(s.session_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{mod?.label || s.modality}</TableCell>
                        <TableCell>{s.duration_minutes ? `${s.duration_minutes} min` : '-'}</TableCell>
                        <TableCell>{s.pain_before != null ? `${s.pain_before}/10` : '-'}</TableCell>
                        <TableCell>{s.pain_after != null ? `${s.pain_after}/10` : '-'}</TableCell>
                        <TableCell><Badge variant="outline">{s.attendance_status === 'completed' ? 'Realizada' : s.attendance_status}</Badge></TableCell>
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
