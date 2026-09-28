import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Star, Trash2, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  ATTRIBUTE_CATALOG,
  EVALUATION_CONTEXTS,
  type AttributeCategory,
  type AttributeScores,
  emptyAttributeScores,
  categoryAverage,
  categoryRounded,
  overallAverage,
  roundedOverall,
} from '@/lib/player-attributes';

interface PlayerEvaluationsProps {
  playerId: string;
}

interface FormState {
  id?: string;
  evaluation_date: string;
  context: string;
  period_label: string;
  attributes: AttributeScores;
  strengths: string;
  weaknesses: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  evaluation_date: format(new Date(), 'yyyy-MM-dd'),
  context: 'training',
  period_label: '',
  attributes: emptyAttributeScores(),
  strengths: '',
  weaknesses: '',
  notes: '',
});

function ratingTone(value: number | null) {
  if (value == null) return 'text-muted-foreground';
  if (value >= 7) return 'text-emerald-500';
  if (value >= 5) return 'text-amber-500';
  return 'text-red-500';
}

export function PlayerEvaluations({ playerId }: PlayerEvaluationsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectedSeasonId = useSelectedSeasonId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: evaluations, isLoading } = useQuery({
    queryKey: ['player-evaluations', playerId, selectedSeasonId],
    queryFn: async () => {
      let q = supabase
        .from('player_evaluations')
        .select('*')
        .eq('player_id', playerId);
      if (selectedSeasonId) q = q.eq('season_id', selectedSeasonId);
      const { data, error } = await q.order('evaluation_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const upsertEvaluation = useMutation({
    mutationFn: async (state: FormState) => {
      if (!user) throw new Error('Not authenticated');
      const overall = roundedOverall(state.attributes);
      const payload: any = {
        player_id: playerId,
        owner_id: user.id,
        evaluator_id: user.id,
        season_id: selectedSeasonId,
        evaluation_date: state.evaluation_date,
        context: state.context || null,
        period_label: state.period_label || null,
        attributes: state.attributes as any,
        technical_rating: categoryRounded(state.attributes, 'technical'),
        tactical_rating: categoryRounded(state.attributes, 'tactical'),
        physical_rating: categoryRounded(state.attributes, 'physical'),
        mental_rating: categoryRounded(state.attributes, 'mental'),
        overall_rating: overall,
        strengths: state.strengths || null,
        weaknesses: state.weaknesses || null,
        notes: state.notes || null,
      };


      if (state.id) {
        const { error } = await supabase
          .from('player_evaluations')
          .update(payload)
          .eq('id', state.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('player_evaluations').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-evaluations', playerId] });
      toast.success(form.id ? 'Avaliação atualizada' : 'Avaliação registada');
      setDialogOpen(false);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const deleteEvaluation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('player_evaluations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-evaluations', playerId] });
      toast.success('Avaliação removida');
    },
  });

  const latest = evaluations?.[0];
  const latestScores: AttributeScores = useMemo(() => {
    if (!latest) return {};
    if (latest.attributes && typeof latest.attributes === 'object') {
      return latest.attributes as AttributeScores;
    }
    // legacy fallback: derive from category ratings
    const out: AttributeScores = {};
    if (latest.technical_rating != null) out.technical = { __legacy: latest.technical_rating };
    if (latest.tactical_rating != null) out.tactical = { __legacy: latest.tactical_rating };
    if (latest.physical_rating != null) out.physical = { __legacy: latest.physical_rating };
    if (latest.mental_rating != null) out.mental = { __legacy: latest.mental_rating };
    return out;
  }, [latest]);

  const openCreate = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (ev: any) => {
    setForm({
      id: ev.id,
      evaluation_date: ev.evaluation_date,
      context: ev.context || 'training',
      period_label: ev.period_label || '',
      attributes:
        ev.attributes && Object.keys(ev.attributes).length > 0
          ? (ev.attributes as AttributeScores)
          : emptyAttributeScores(),
      strengths: ev.strengths || '',
      weaknesses: ev.weaknesses || '',
      notes: ev.notes || '',
    });
    setDialogOpen(true);
  };

  const updateAttr = (cat: AttributeCategory, key: string, value: number) => {
    setForm((f) => ({
      ...f,
      attributes: {
        ...f.attributes,
        [cat]: { ...(f.attributes[cat] || {}), [key]: value },
      },
    }));
  };

  const overallNow = roundedOverall(form.attributes);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Avaliações</h3>
          {latest?.overall_rating != null && (
            <Badge className="gap-1 px-2 py-1">
              <Star className="w-3 h-3 fill-current" />
              {latest.overall_rating}/10
            </Badge>
          )}
          {evaluations && evaluations.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {evaluations.length} registo{evaluations.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Avaliação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Editar Avaliação' : 'Nova Avaliação'}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={form.evaluation_date}
                      onChange={(e) => setForm({ ...form, evaluation_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contexto</Label>
                    <Select
                      value={form.context}
                      onValueChange={(v) => setForm({ ...form, context: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVALUATION_CONTEXTS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Período (opcional)</Label>
                    <Input
                      value={form.period_label}
                      onChange={(e) => setForm({ ...form, period_label: e.target.value })}
                      placeholder="Ex: 1ª volta"
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-3 flex items-center justify-between bg-muted/30">
                  <span className="text-sm text-muted-foreground">Média global</span>
                  <span className={`text-2xl font-bold ${ratingTone(overallNow)}`}>
                    {overallNow ?? '—'}/10
                  </span>
                </div>

                <Tabs defaultValue="technical">
                  <TabsList className="grid grid-cols-4 w-full">
                    {ATTRIBUTE_CATALOG.map((c) => (
                      <TabsTrigger key={c.key} value={c.key}>
                        {c.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {ATTRIBUTE_CATALOG.map((cat) => {
                    const avg = categoryAverage(form.attributes, cat.key);
                    return (
                      <TabsContent key={cat.key} value={cat.key} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Média {cat.label}
                          </span>
                          <span className={`font-semibold ${ratingTone(avg)}`}>
                            {avg != null ? avg.toFixed(1) : '—'}/10
                          </span>
                        </div>
                        {cat.attributes.map((a) => {
                          const v = form.attributes[cat.key]?.[a.key] ?? 5;
                          return (
                            <div key={a.key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">{a.label}</Label>
                                <span className={`text-sm font-semibold ${ratingTone(v)}`}>
                                  {v}/10
                                </span>
                              </div>
                              <Slider
                                value={[v]}
                                onValueChange={([nv]) => updateAttr(cat.key, a.key, nv)}
                                min={1}
                                max={10}
                                step={1}
                              />
                            </div>
                          );
                        })}
                      </TabsContent>
                    );
                  })}
                </Tabs>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Pontos Fortes</Label>
                    <Textarea
                      rows={3}
                      value={form.strengths}
                      onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                      placeholder="Velocidade, finalização..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pontos a Melhorar</Label>
                    <Textarea
                      rows={3}
                      value={form.weaknesses}
                      onChange={(e) => setForm({ ...form, weaknesses: e.target.value })}
                      placeholder="Pé esquerdo, posicionamento..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Notas adicionais do avaliador..."
                  />
                </div>
              </div>
            </ScrollArea>
            <div className="pt-3 border-t flex gap-2">
              <Button
                className="flex-1"
                onClick={() => upsertEvaluation.mutate(form)}
                disabled={upsertEvaluation.isPending}
              >
                {form.id ? 'Atualizar' : 'Guardar Avaliação'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="h-32 animate-pulse" />
        </Card>
      ) : evaluations && evaluations.length > 0 ? (
        <div className="space-y-3">
          {evaluations.map((ev: any) => {
            const scores: AttributeScores =
              ev.attributes && Object.keys(ev.attributes || {}).length > 0
                ? (ev.attributes as AttributeScores)
                : {};
            return (
              <Card key={ev.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {format(new Date(ev.evaluation_date), "d 'de' MMMM 'de' yyyy", {
                          locale: pt,
                        })}
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.context && (
                          <Badge variant="outline">
                            {EVALUATION_CONTEXTS.find((c) => c.value === ev.context)?.label ||
                              ev.context}
                          </Badge>
                        )}
                        {ev.period_label && <Badge variant="outline">{ev.period_label}</Badge>}
                        {ev.overall_rating != null && (
                          <Badge className="gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            {ev.overall_rating}/10
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ev)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteEvaluation.mutate(ev.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {ATTRIBUTE_CATALOG.map((cat) => {
                      const v =
                        Object.keys(scores).length > 0
                          ? categoryAverage(scores, cat.key)
                          : (ev as any)[`${cat.key}_rating`];
                      return (
                        <div
                          key={cat.key}
                          className="rounded-md border p-2 flex items-center justify-between"
                        >
                          <span className="text-xs">{cat.label}</span>
                          <span className={`font-semibold ${ratingTone(v as number | null)}`}>
                            {v != null
                              ? typeof v === 'number'
                                ? v.toFixed(1)
                                : v
                              : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(ev.strengths || ev.weaknesses) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                      {ev.strengths && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Pontos Fortes</p>
                          <p className="text-sm whitespace-pre-wrap">{ev.strengths}</p>
                        </div>
                      )}
                      {ev.weaknesses && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Pontos a Melhorar</p>
                          <p className="text-sm whitespace-pre-wrap">{ev.weaknesses}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {ev.notes && (
                    <p className="text-sm text-muted-foreground border-t pt-2 whitespace-pre-wrap">
                      {ev.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Star className="w-10 h-10 mx-auto mb-2" />
            <p>Sem avaliações registadas</p>
          </CardContent>
        </Card>
      )}
      {/* expose latest scores via DOM attr for downstream tabs (Resumo) - optional */}
      <span data-latest-overall={overallAverage(latestScores)?.toFixed(1) ?? ''} hidden />
    </div>
  );
}
