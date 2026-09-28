import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Heart, Trash2, Plus, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { REHAB_PHASES, REHAB_STATUSES, EXERCISE_LOCATIONS } from '@/lib/physio-constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Exercise {
  id?: string;
  exercise_name: string;
  description: string;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  frequency: string;
  location: string;
  video_url: string;
  order_index: number;
}

interface RehabFormData {
  player_id: string;
  injury_id: string;
  title: string;
  goal: string;
  start_date: string;
  end_date: string;
  phase: string;
  status: string;
  notes: string;
}

export default function RehabPlanForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== 'new';
  const { user } = useAuth();
  const { hasPhysioAccess, clubId, loading: accessLoading } = usePhysioAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [formData, setFormData] = useState<RehabFormData>({
    player_id: '',
    injury_id: '',
    title: '',
    goal: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    phase: 'initial',
    status: 'active',
    notes: '',
  });

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ['club-players', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from('players')
        .select('id, name, number, team:teams(id, name)')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  // Fetch injuries for selected player
  const { data: playerInjuries } = useQuery({
    queryKey: ['player-injuries', formData.player_id],
    queryFn: async () => {
      if (!formData.player_id) return [];
      const { data } = await supabase
        .from('physio_injuries')
        .select('id, body_area, injury_type, start_date')
        .eq('player_id', formData.player_id)
        .in('status', ['active', 'recovering'])
        .order('start_date', { ascending: false });
      return data || [];
    },
    enabled: !!formData.player_id,
  });

  // Fetch existing plan if editing
  const { data: existingPlan, isLoading: planLoading } = useQuery({
    queryKey: ['physio-rehab-plan', id],
    queryFn: async () => {
      if (!isEditing) return null;
      const { data, error } = await supabase
        .from('rehab_plans')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!isEditing && !!clubId,
  });

  // Fetch exercises if editing
  const { data: existingExercises } = useQuery({
    queryKey: ['rehab-exercises', id],
    queryFn: async () => {
      if (!isEditing) return [];
      const { data } = await supabase
        .from('rehab_plan_exercises')
        .select('*')
        .eq('rehab_plan_id', id)
        .order('order_index');
      return data || [];
    },
    enabled: !!isEditing && !!clubId,
  });

  // Update form when existing data loads
  useEffect(() => {
    if (existingPlan) {
      setFormData({
        player_id: existingPlan.player_id,
        injury_id: existingPlan.injury_id || '',
        title: existingPlan.title,
        goal: existingPlan.goal || '',
        start_date: existingPlan.start_date,
        end_date: existingPlan.end_date || '',
        phase: existingPlan.phase || 'initial',
        status: existingPlan.status,
        notes: existingPlan.notes || '',
      });
    }
  }, [existingPlan]);

  useEffect(() => {
    if (existingExercises && existingExercises.length > 0) {
      setExercises(existingExercises.map(e => ({
        id: e.id,
        exercise_name: e.exercise_name,
        description: e.description || '',
        sets: e.sets,
        reps: e.reps,
        duration_seconds: e.duration_seconds,
        frequency: e.frequency || '',
        location: e.location || 'training',
        video_url: e.video_url || '',
        order_index: e.order_index,
      })));
    }
  }, [existingExercises]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        club_id: clubId,
        created_by: user?.id,
        injury_id: formData.injury_id || null,
        end_date: formData.end_date || null,
      };

      let planId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('rehab_plans')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('rehab_plans')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        planId = data.id;
      }

      // Handle exercises
      if (isEditing) {
        // Delete removed exercises
        const existingIds = existingExercises?.map(e => e.id) || [];
        const currentIds = exercises.filter(e => e.id).map(e => e.id);
        const toDelete = existingIds.filter(id => !currentIds.includes(id));
        
        if (toDelete.length > 0) {
          await supabase.from('rehab_plan_exercises').delete().in('id', toDelete);
        }
      }

      // Upsert exercises
      for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];
        const exerciseData = {
          club_id: clubId,
          rehab_plan_id: planId,
          exercise_name: exercise.exercise_name,
          description: exercise.description || null,
          sets: exercise.sets,
          reps: exercise.reps,
          duration_seconds: exercise.duration_seconds,
          frequency: exercise.frequency || null,
          location: exercise.location,
          video_url: exercise.video_url || null,
          order_index: i,
        };

        if (exercise.id) {
          await supabase.from('rehab_plan_exercises').update(exerciseData).eq('id', exercise.id);
        } else {
          await supabase.from('rehab_plan_exercises').insert(exerciseData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physio-rehab-plans'] });
      queryClient.invalidateQueries({ queryKey: ['physio-active-rehab'] });
      toast.success(isEditing ? 'Plano atualizado!' : 'Plano criado!');
      navigate('/club/physio/rehab');
    },
    onError: (error) => {
      console.error('Error saving plan:', error);
      toast.error('Erro ao guardar plano');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rehab_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physio-rehab-plans'] });
      toast.success('Plano eliminado!');
      navigate('/club/physio/rehab');
    },
    onError: (error) => {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao eliminar plano');
    },
  });

  const addExercise = () => {
    setExercises([...exercises, {
      exercise_name: '',
      description: '',
      sets: null,
      reps: null,
      duration_seconds: null,
      frequency: '',
      location: 'training',
      video_url: '',
      order_index: exercises.length,
    }]);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.player_id || !formData.title) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    saveMutation.mutate();
  };

  if (accessLoading || (isEditing && planLoading)) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPhysioAccess) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/club/physio/rehab')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">
              {isEditing ? 'Editar Plano' : 'Novo Plano de Reabilitação'}
            </h1>
          </div>
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informação do Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="player">Jogador *</Label>
                  <Select
                    value={formData.player_id}
                    onValueChange={(value) => setFormData({ ...formData, player_id: value, injury_id: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar jogador" />
                    </SelectTrigger>
                    <SelectContent>
                      {players?.map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          #{player.number} {player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="injury">Lesão Associada</Label>
                  <Select
                    value={formData.injury_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, injury_id: value === "none" ? "" : value })}
                    disabled={!formData.player_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar lesão (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {playerInjuries?.map(injury => (
                        <SelectItem key={injury.id} value={injury.id}>
                          {injury.body_area} - {injury.injury_type} ({format(new Date(injury.start_date), 'dd/MM/yyyy')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Recuperação LCA - Fase 1"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Objetivo</Label>
                <Textarea
                  id="goal"
                  placeholder="Objetivo do plano de reabilitação..."
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phase">Fase</Label>
                  <Select
                    value={formData.phase}
                    onValueChange={(value) => setFormData({ ...formData, phase: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REHAB_PHASES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REHAB_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas adicionais..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Exercises */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Exercícios</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addExercise}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {exercises.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum exercício adicionado</p>
                  <Button type="button" variant="link" onClick={addExercise}>
                    Adicionar primeiro exercício
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {exercises.map((exercise, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="secondary">{index + 1}</Badge>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExercise(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome do Exercício *</Label>
                          <Input
                            placeholder="Ex: Flexão de joelho"
                            value={exercise.exercise_name}
                            onChange={(e) => updateExercise(index, 'exercise_name', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Local</Label>
                          <Select
                            value={exercise.location}
                            onValueChange={(value) => updateExercise(index, 'location', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EXERCISE_LOCATIONS.map(l => (
                                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Séries</Label>
                          <Input
                            type="number"
                            placeholder="3"
                            value={exercise.sets || ''}
                            onChange={(e) => updateExercise(index, 'sets', e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Repetições</Label>
                          <Input
                            type="number"
                            placeholder="10"
                            value={exercise.reps || ''}
                            onChange={(e) => updateExercise(index, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Duração (seg)</Label>
                          <Input
                            type="number"
                            placeholder="30"
                            value={exercise.duration_seconds || ''}
                            onChange={(e) => updateExercise(index, 'duration_seconds', e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Frequência</Label>
                          <Input
                            placeholder="2x/dia"
                            value={exercise.frequency}
                            onChange={(e) => updateExercise(index, 'frequency', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea
                          placeholder="Instruções detalhadas..."
                          value={exercise.description}
                          onChange={(e) => updateExercise(index, 'description', e.target.value)}
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>URL do Vídeo</Label>
                        <Input
                          type="url"
                          placeholder="https://youtube.com/..."
                          value={exercise.video_url}
                          onChange={(e) => updateExercise(index, 'video_url', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/club/physio/rehab')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        </form>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Plano</AlertDialogTitle>
              <AlertDialogDescription>
                Tem a certeza? Os exercícios associados também serão eliminados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
