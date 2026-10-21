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
import { Plus, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { tx } from '@/lib/i18n/ui';

const TRIAL_STATUSES = [
  { value: 'scheduled', get label() { return tx('Agendado'); } },
  { value: 'confirmed', get label() { return tx('Confirmado'); } },
  { value: 'completed', get label() { return tx('Realizado'); } },
  { value: 'cancelled', get label() { return tx('Cancelado'); } },
];

export function TrialsTab() {
  const { clubId } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: trials, isLoading } = useQuery({
    queryKey: ['scouting-trials', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('prospect_trials')
        .select('*, prospect_profiles(full_name)')
        .eq('club_id', clubId)
        .order('trial_date', { ascending: false });
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
      const { error } = await supabase.from('prospect_trials').insert({
        club_id: clubId!,
        prospect_id: form.prospect_id,
        trial_date: form.trial_date,
        trial_type: form.trial_type || 'training',
        venue: form.venue || null,
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scouting-trials', clubId] });
      qc.invalidateQueries({ queryKey: ['scouting-trials-count', clubId] });
      toast.success(tx('Trial agendado'));
      setOpen(false);
    },
    onError: () => toast.error(tx('Erro ao agendar trial')),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form: Record<string, any> = {};
    fd.forEach((v, k) => { form[k] = v; });
    if (!form.prospect_id || !form.trial_date) { toast.error(tx('Prospect e data são obrigatórios')); return; }
    createMutation.mutate(form);
  };

  if (isLoading) return <div className="mt-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{tx('Trials (')}{trials?.length || 0})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{tx('Agendar Trial')}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{tx('Agendar Trial')}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>{tx('Prospect *')}</Label>
                <Select name="prospect_id">
                  <SelectTrigger><SelectValue placeholder={tx('Selecionar')} /></SelectTrigger>
                  <SelectContent>{prospects?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{tx('Data *')}</Label><Input name="trial_date" type="date" required /></div>
              <div><Label>{tx('Local')}</Label><Input name="venue" /></div>
              <div><Label>{tx('Notas')}</Label><Textarea name="notes" rows={2} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{tx('Agendar')}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(trials?.length || 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>{tx('Nenhum trial registado.')}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {trials?.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div>
                  <p className="font-medium text-sm">{t.prospect_profiles?.full_name || '–'}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.trial_date), 'dd/MM/yyyy')} · {t.venue || '–'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.status === 'completed' ? 'default' : 'outline'} className="text-xs">
                    {TRIAL_STATUSES.find(s => s.value === t.status)?.label || t.status}
                  </Badge>
                  {t.outcome && <Badge variant={t.outcome === 'approved' ? 'default' : 'destructive'} className="text-xs">{t.outcome}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
