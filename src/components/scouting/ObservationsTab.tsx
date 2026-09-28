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
import { Plus, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { OBSERVATION_TYPES, RECOMMENDATION_OPTIONS } from '@/hooks/useScouting';
import { format } from 'date-fns';

export function ObservationsTab() {
  const { clubId } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: observations, isLoading } = useQuery({
    queryKey: ['scouting-observations', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('scouting_observations')
        .select('*, prospect_profiles(full_name)')
        .eq('club_id', clubId)
        .order('observation_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: prospects } = useQuery({
    queryKey: ['scouting-prospects-select', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase.from('prospect_profiles').select('id, full_name').eq('club_id', clubId).eq('status', 'active').order('full_name');
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async (form: Record<string, any>) => {
      const { error } = await supabase.from('scouting_observations').insert({
        club_id: clubId!,
        prospect_id: form.prospect_id,
        scout_user_id: user?.id,
        observation_type: form.observation_type || 'match',
        observation_date: form.observation_date || new Date().toISOString().split('T')[0],
        competition_name: form.competition_name || null,
        match_context: form.match_context || null,
        position_observed: form.position_observed || null,
        strengths: form.strengths || null,
        weaknesses: form.weaknesses || null,
        recommendation: form.recommendation || 'monitor',
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scouting-observations', clubId] });
      qc.invalidateQueries({ queryKey: ['scouting-observations-count', clubId] });
      toast.success('Observação registada com sucesso');
      setOpen(false);
    },
    onError: () => toast.error('Erro ao registar observação'),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form: Record<string, any> = {};
    fd.forEach((v, k) => { form[k] = v; });
    if (!form.prospect_id) { toast.error('Selecione um prospect'); return; }
    createMutation.mutate(form);
  };

  if (isLoading) return <div className="mt-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Observações ({observations?.length || 0})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Observação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Observação</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Prospect *</Label>
                <Select name="prospect_id">
                  <SelectTrigger><SelectValue placeholder="Selecionar prospect" /></SelectTrigger>
                  <SelectContent>{prospects?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select name="observation_type">
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>{OBSERVATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data</Label><Input name="observation_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} /></div>
              </div>
              <div><Label>Competição / Contexto</Label><Input name="competition_name" /></div>
              <div><Label>Contexto do Jogo</Label><Input name="match_context" /></div>
              <div><Label>Posição Observada</Label><Input name="position_observed" /></div>
              <div><Label>Pontos Fortes</Label><Textarea name="strengths" rows={2} /></div>
              <div><Label>Pontos a Desenvolver</Label><Textarea name="weaknesses" rows={2} /></div>
              <div>
                <Label>Recomendação</Label>
                <Select name="recommendation">
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{RECOMMENDATION_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Notas</Label><Textarea name="notes" rows={2} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'A registar...' : 'Registar Observação'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(observations?.length || 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Eye className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma observação registada.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {observations?.map((o: any) => (
            <Card key={o.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{o.prospect_profiles?.full_name || '–'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(o.observation_date), 'dd/MM/yyyy')} · {OBSERVATION_TYPES.find(t => t.value === o.observation_type)?.label || o.observation_type}
                      {o.competition_name ? ` · ${o.competition_name}` : ''}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {RECOMMENDATION_OPTIONS.find(r => r.value === o.recommendation)?.label || o.recommendation}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
