import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { POSITIONS } from '@/lib/player-constants';
import { PRIORITY_OPTIONS, SOURCE_OPTIONS, PIPELINE_STAGE_LABELS } from '@/hooks/useScouting';

export function ProspectsTab() {
  const { clubId } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data: prospects, isLoading } = useQuery({
    queryKey: ['scouting-prospects', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('prospect_profiles')
        .select('*')
        .eq('club_id', clubId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async (form: Record<string, any>) => {
      const { error } = await supabase.from('prospect_profiles').insert({
        club_id: clubId!,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || null,
        nationality: form.nationality || null,
        primary_position: form.primary_position || null,
        dominant_foot: form.dominant_foot || null,
        current_club_name: form.current_club_name || null,
        source: form.source || 'manual',
        priority: form.priority || 'medium',
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scouting-prospects', clubId] });
      qc.invalidateQueries({ queryKey: ['scouting-prospects-summary', clubId] });
      toast.success('Prospect criado com sucesso');
      setOpen(false);
    },
    onError: () => toast.error('Erro ao criar prospect'),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form: Record<string, any> = {};
    fd.forEach((v, k) => { form[k] = v; });
    if (!form.full_name?.toString().trim()) { toast.error('Nome é obrigatório'); return; }
    createMutation.mutate(form);
  };

  const filtered = (prospects || []).filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.primary_position || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.current_club_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="mt-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar prospects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Prospect</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Prospect</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Nome *</Label><Input name="full_name" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Nasc.</Label><Input name="date_of_birth" type="date" /></div>
                <div><Label>Nacionalidade</Label><Input name="nationality" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Posição</Label>
                  <Select name="primary_position">
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {POSITIONS.football.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pé Dominante</Label>
                  <Select name="dominant_foot">
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right">Direito</SelectItem>
                      <SelectItem value="left">Esquerdo</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Clube Atual</Label><Input name="current_club_name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fonte</Label>
                  <Select name="source">
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select name="priority">
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notas</Label><Textarea name="notes" rows={3} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'A criar...' : 'Criar Prospect'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum prospect encontrado.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.primary_position || '–'} · {p.current_club_name || 'Sem clube'} · {p.date_of_birth || '–'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{PIPELINE_STAGE_LABELS[p.pipeline_status] || p.pipeline_status}</Badge>
                  <Badge variant={p.priority === 'critical' || p.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                    {PRIORITY_OPTIONS.find(o => o.value === p.priority)?.label || p.priority}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
