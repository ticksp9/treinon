import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target } from 'lucide-react';
import { toast } from 'sonner';
import { PRIORITY_OPTIONS } from '@/hooks/useScouting';
import { POSITIONS } from '@/lib/player-constants';

export function ShortlistsTab() {
  const { clubId } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: shortlists, isLoading } = useQuery({
    queryKey: ['scouting-shortlists', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('scouting_shortlists')
        .select('*, scouting_shortlist_entries(count)')
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
      const { error } = await supabase.from('scouting_shortlists').insert({
        club_id: clubId!,
        name: form.name,
        description: form.description || null,
        target_position: form.target_position || null,
        urgency: form.urgency || 'medium',
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scouting-shortlists', clubId] });
      toast.success('Shortlist criada');
      setOpen(false);
    },
    onError: () => toast.error('Erro ao criar shortlist'),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name')?.toString().trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }
    createMutation.mutate({
      name,
      description: fd.get('description'),
      target_position: fd.get('target_position'),
      urgency: fd.get('urgency'),
    });
  };

  if (isLoading) return <div className="mt-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Shortlists ({shortlists?.length || 0})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Shortlist</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Shortlist</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Nome *</Label><Input name="name" required /></div>
              <div><Label>Descrição</Label><Input name="description" /></div>
              <div>
                <Label>Posição Alvo</Label>
                <Select name="target_position">
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{POSITIONS.football.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urgência</Label>
                <Select name="urgency">
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(shortlists?.length || 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>Nenhuma shortlist criada.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortlists?.map((s: any) => (
            <Card key={s.id} className="hover:bg-accent/30 transition-colors cursor-pointer">
              <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{s.name}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {s.scouting_shortlist_entries?.[0]?.count || 0} prospects
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {s.target_position && <Badge variant="outline" className="text-xs">{s.target_position}</Badge>}
                  <Badge variant={s.urgency === 'critical' || s.urgency === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                    {PRIORITY_OPTIONS.find(o => o.value === s.urgency)?.label || s.urgency}
                  </Badge>
                </div>
                {s.description && <p className="text-xs text-muted-foreground mt-2">{s.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
