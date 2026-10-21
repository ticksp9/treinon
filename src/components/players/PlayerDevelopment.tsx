import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Target, Trash2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSeasonContext } from '@/hooks/useSeasonContext';
import { tx } from '@/lib/i18n/ui';

interface ClubScopedProps {
  playerId: string;
  clubId: string | null;
}

const STATUSES = [
  { value: 'open', get label() { return tx('Aberto'); } },
  { value: 'in_progress', get label() { return tx('Em curso'); } },
  { value: 'achieved', get label() { return tx('Conquistado'); } },
  { value: 'partially_achieved', get label() { return tx('Parcial'); } },
  { value: 'deferred', get label() { return tx('Adiado'); } },
  { value: 'cancelled', get label() { return tx('Cancelado'); } },
];
const PRIORITIES = [
  { value: 'low', get label() { return tx('Baixa'); } },
  { value: 'medium', get label() { return tx('Média'); } },
  { value: 'high', get label() { return tx('Alta'); } },
  { value: 'critical', get label() { return tx('Crítica'); } },
];

export function PlayerDevelopmentPlanTab({ playerId, clubId }: ClubScopedProps) {
  const { user } = useAuth();
  const { selectedSeasonId } = useSeasonContext();
  const qc = useQueryClient();
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    target_date: '',
    success_criteria: '',
  });

  const { data: plan } = useQuery({
    queryKey: ['academy-plan', playerId, selectedSeasonId],
    enabled: !!clubId,
    queryFn: async () => {
      let query = supabase
        .from('academy_development_plans')
        .select('*')
        .eq('player_id', playerId);
      if (selectedSeasonId) query = query.eq('season_id', selectedSeasonId);
      const { data, error } = await query.order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ensurePlan = useMutation({
    mutationFn: async () => {
      if (!clubId || !user) throw new Error(tx('Sem clube'));
      if (plan) return plan;
      const { data, error } = await supabase
        .from('academy_development_plans')
        .insert({
          club_id: clubId,
          player_id: playerId,
          status: 'active',
          created_by: user.id,
          responsible_user_id: user.id,
          season_id: selectedSeasonId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academy-plan', playerId] }),
  });

  const { data: goals, refetch: refetchGoals } = useQuery({
    queryKey: ['academy-goals', plan?.id],
    enabled: !!plan?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academy_development_goals')
        .select('*')
        .eq('plan_id', plan!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createGoal = useMutation({
    mutationFn: async () => {
      let p = plan;
      if (!p) p = await ensurePlan.mutateAsync();
      const { error } = await supabase.from('academy_development_goals').insert({
        plan_id: p!.id,
        title: goalForm.title,
        description: goalForm.description || null,
        priority: goalForm.priority,
        target_date: goalForm.target_date || null,
        success_criteria: goalForm.success_criteria || null,
        status: 'open',
        progress_pct: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tx('Objetivo adicionado'));
      setGoalDialog(false);
      setGoalForm({ title: '', description: '', priority: 'medium', target_date: '', success_criteria: '' });
      refetchGoals();
    },
    onError: (e: any) => toast.error(tx('Erro: ') + e.message),
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase
        .from('academy_development_goals')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => refetchGoals(),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academy_development_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => refetchGoals(),
  });

  if (!clubId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {tx('O Plano Individual está disponível em modo Clube.')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">{tx('Plano Individual')}</h3>
          {plan && (
            <p className="text-xs text-muted-foreground">
              {tx('Versão')}{' '}{plan.version_no} {tx('· Estado:')}{' '}{plan.status}
            </p>
          )}
        </div>
        <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{tx('Novo Objetivo')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{tx('Novo Objetivo Individual')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{tx('Título *')}</Label>
                <Input
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  placeholder={tx('Ex: Melhorar passe longo')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{tx('Prioridade')}</Label>
                  <Select value={goalForm.priority} onValueChange={(v) => setGoalForm({ ...goalForm, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{tx('Data alvo')}</Label>
                  <Input type="date" value={goalForm.target_date}
                    onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{tx('Descrição')}</Label>
                <Textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{tx('Critérios de sucesso')}</Label>
                <Textarea
                  value={goalForm.success_criteria}
                  onChange={(e) => setGoalForm({ ...goalForm, success_criteria: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                disabled={!goalForm.title || createGoal.isPending}
                onClick={() => createGoal.mutate()}
              >
                {tx('Guardar Objetivo')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {goals && goals.length > 0 ? (
        <div className="space-y-2">
          {goals.map((g: any) => (
            <Card key={g.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{g.title}</p>
                      <Badge variant="outline">{PRIORITIES.find((p) => p.value === g.priority)?.label || '—'}</Badge>
                      <Badge>{STATUSES.find((s) => s.value === g.status)?.label || g.status}</Badge>
                    </div>
                    {g.description && <p className="text-sm text-muted-foreground mt-1">{g.description}</p>}
                    {g.target_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tx('Alvo:')}{' '}{format(new Date(g.target_date), 'dd MMM yyyy', { locale: pt })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="text-destructive"
                    onClick={() => deleteGoal.mutate(g.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={g.progress_pct ?? 0} className="h-2 flex-1" />
                  <span className="text-xs font-semibold w-10 text-right">{g.progress_pct ?? 0}%</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={g.status}
                    onValueChange={(v) => updateGoal.mutate({ id: g.id, patch: { status: v } })}
                  >
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={g.progress_pct ?? 0}
                    className="h-8 w-24"
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)));
                      if (v !== (g.progress_pct ?? 0)) updateGoal.mutate({ id: g.id, patch: { progress_pct: v } });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Target className="w-10 h-10 mx-auto mb-2" />
            <p>{tx('Sem objetivos individuais.')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────── Observações

const CONTEXTS = [
  { value: 'training', get label() { return tx('Treino'); } },
  { value: 'match', get label() { return tx('Jogo'); } },
  { value: 'tournament', get label() { return tx('Torneio'); } },
  { value: 'camp', get label() { return tx('Estágio'); } },
  { value: 'other', get label() { return tx('Outro'); } },
];

export function PlayerObservationsTab({ playerId, clubId }: ClubScopedProps) {
  const { user } = useAuth();
  const { selectedSeason, selectedSeasonId } = useSeasonContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    observation_date: format(new Date(), 'yyyy-MM-dd'),
    context: 'training',
    content: '',
    recommendation: '',
    follow_up: false,
  });

  const { data: obs } = useQuery({
    queryKey: ['academy-observations', playerId, selectedSeasonId],
    enabled: !!clubId,
    queryFn: async () => {
      let query = supabase
        .from('academy_observations')
        .select('*')
        .eq('player_id', playerId);
      if (selectedSeason) {
        query = query
          .gte('observation_date', selectedSeason.start_date)
          .lte('observation_date', selectedSeason.end_date);
      }
      const { data, error } = await query.order('observation_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createObs = useMutation({
    mutationFn: async () => {
      if (!clubId || !user) throw new Error(tx('Sem contexto'));
      const { error } = await supabase.from('academy_observations').insert({
        club_id: clubId,
        player_id: playerId,
        observer_user_id: user.id,
        observation_date: form.observation_date,
        context: form.context,
        content: form.content,
        recommendation: form.recommendation || null,
        follow_up: form.follow_up,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tx('Observação registada'));
      setOpen(false);
      setForm({ ...form, content: '', recommendation: '', follow_up: false });
      qc.invalidateQueries({ queryKey: ['academy-observations', playerId] });
    },
    onError: (e: any) => toast.error(tx('Erro: ') + e.message),
  });

  const deleteObs = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academy_observations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academy-observations', playerId] }),
  });

  if (!clubId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {tx('As Observações estão disponíveis em modo Clube.')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{tx('Observações')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{tx('Nova')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{tx('Nova Observação')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{tx('Data')}</Label>
                  <Input type="date" value={form.observation_date}
                    onChange={(e) => setForm({ ...form, observation_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>{tx('Contexto')}</Label>
                  <Select value={form.context} onValueChange={(v) => setForm({ ...form, context: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTEXTS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>{tx('Conteúdo *')}</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <Label>{tx('Recomendação')}</Label>
                <Textarea
                  value={form.recommendation}
                  onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
                  rows={2}
                />
              </div>
              <Button
                className="w-full"
                disabled={!form.content || createObs.isPending}
                onClick={() => createObs.mutate()}
              >
                {tx('Guardar')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {obs && obs.length > 0 ? (
        <div className="space-y-2">
          {obs.map((o: any) => (
            <Card key={o.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Badge variant="outline">
                        {CONTEXTS.find((c) => c.value === o.context)?.label || o.context}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(o.observation_date), 'dd MMM yyyy', { locale: pt })}
                      </span>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{o.content}</p>
                    {o.recommendation && (
                      <p className="text-sm text-muted-foreground mt-1">
                        💡 {o.recommendation}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive"
                    onClick={() => deleteObs.mutate(o.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2" />
            <p>{tx('Sem observações.')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
