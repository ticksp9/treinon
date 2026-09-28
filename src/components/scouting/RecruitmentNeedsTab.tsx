import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PRIORITY_OPTIONS } from '@/hooks/useScouting';
import { POSITIONS } from '@/lib/player-constants';

export function RecruitmentNeedsTab() {
  const { clubId } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: needs, isLoading } = useQuery({
    queryKey: ['scouting-recruitment-needs', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('recruitment_needs')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async (form: Record<string, any>) => {
      const { error } = await supabase.from('recruitment_needs').insert({
        club_id: clubId!,
        position: form.position,
        profile_description: form.profile_description || null,
        urgency: form.urgency || 'medium',
        priority: form.priority || 'medium',
        reason: form.reason || null,
        target_window: form.target_window || null,
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scouting-recruitment-needs', clubId] });
      qc.invalidateQueries({ queryKey: ['scouting-needs-count', clubId] });
      toast.success('Necessidade criada');
      setOpen(false);
    },
    onError: () => toast.error('Erro ao criar necessidade'),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form: Record<string, any> = {};
    fd.forEach((v, k) => { form[k] = v; });
    if (!form.position) { toast.error('Posição é obrigatória'); return; }
    createMutation.mutate(form);
  };

  if (isLoading) return <div className="mt-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Necessidades de Recrutamento ({needs?.length || 0})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Necessidade</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Necessidade</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Posição *</Label>
                <Select name="position">
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{POSITIONS.football.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Perfil Desejado</Label><Textarea name="profile_description" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Urgência</Label>
                  <Select name="urgency">
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select name="priority">
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Motivo</Label><Input name="reason" /></div>
              <div><Label>Janela Alvo</Label><Input name="target_window" placeholder="Ex: Jan 2026" /></div>
              <div><Label>Notas</Label><Textarea name="notes" rows={2} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(needs?.length || 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>Nenhuma necessidade registada.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {needs?.map((n: any) => (
            <Card key={n.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div>
                  <p className="font-medium text-sm">{POSITIONS.football.find(p => p.value === n.position)?.label || n.position}</p>
                  <p className="text-xs text-muted-foreground">{n.reason || '–'} · {n.target_window || '–'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={n.status === 'open' ? 'default' : 'secondary'} className="text-xs">{n.status}</Badge>
                  <Badge variant={n.urgency === 'critical' || n.urgency === 'high' ? 'destructive' : 'outline'} className="text-xs">
                    {PRIORITY_OPTIONS.find(o => o.value === n.urgency)?.label || n.urgency}
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
