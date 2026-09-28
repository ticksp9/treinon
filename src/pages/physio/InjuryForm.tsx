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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BODY_AREAS, INJURY_TYPES, INJURY_SEVERITIES, INJURY_STATUSES } from '@/lib/physio-constants';
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

interface InjuryFormData {
  player_id: string;
  start_date: string;
  end_date: string;
  body_area: string;
  injury_type: string;
  severity: string;
  status: string;
  notes: string;
  restrictions: string;
  is_fit: boolean;
}

export default function InjuryForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== 'new';
  const { user } = useAuth();
  const { hasPhysioAccess, clubId, loading: accessLoading } = usePhysioAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [formData, setFormData] = useState<InjuryFormData>({
    player_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    body_area: '',
    injury_type: '',
    severity: 'moderate',
    status: 'active',
    notes: '',
    restrictions: '',
    is_fit: false,
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

  // Fetch existing injury if editing
  const { data: existingInjury, isLoading: injuryLoading } = useQuery({
    queryKey: ['physio-injury', id],
    queryFn: async () => {
      if (!isEditing) return null;
      const { data, error } = await supabase
        .from('physio_injuries')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!isEditing && !!clubId,
  });

  // Update form when existing data loads
  useEffect(() => {
    if (existingInjury) {
      setFormData({
        player_id: existingInjury.player_id,
        start_date: existingInjury.start_date,
        end_date: existingInjury.end_date || '',
        body_area: existingInjury.body_area,
        injury_type: existingInjury.injury_type,
        severity: existingInjury.severity,
        status: existingInjury.status,
        notes: existingInjury.notes || '',
        restrictions: existingInjury.restrictions || '',
        is_fit: existingInjury.is_fit || false,
      });
    }
  }, [existingInjury]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InjuryFormData) => {
      const payload = {
        ...data,
        club_id: clubId,
        created_by: user?.id,
        end_date: data.end_date || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('physio_injuries')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('physio_injuries')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physio-injuries'] });
      queryClient.invalidateQueries({ queryKey: ['physio-active-injuries'] });
      toast.success(isEditing ? 'Lesão atualizada!' : 'Lesão registada!');
      navigate('/club/physio/injuries');
    },
    onError: (error) => {
      console.error('Error saving injury:', error);
      toast.error('Erro ao guardar lesão');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('physio_injuries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physio-injuries'] });
      toast.success('Lesão eliminada!');
      navigate('/club/physio/injuries');
    },
    onError: (error) => {
      console.error('Error deleting injury:', error);
      toast.error('Erro ao eliminar lesão');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.player_id || !formData.body_area || !formData.injury_type) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    saveMutation.mutate(formData);
  };

  if (accessLoading || (isEditing && injuryLoading)) {
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
              <p className="text-muted-foreground">
                Apenas fisioterapeutas e administradores podem registar lesões.
              </p>
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/club/physio/injuries')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">
              {isEditing ? 'Editar Lesão' : 'Registar Lesão'}
            </h1>
          </div>
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informação da Lesão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Player Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="player">Jogador *</Label>
                  <Select
                    value={formData.player_id}
                    onValueChange={(value) => setFormData({ ...formData, player_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar jogador" />
                    </SelectTrigger>
                    <SelectContent>
                      {players?.map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          #{player.number} {player.name} - {player.team?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Body Area and Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="body_area">Zona do Corpo *</Label>
                  <Select
                    value={formData.body_area}
                    onValueChange={(value) => setFormData({ ...formData, body_area: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar zona" />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_AREAS.map(area => (
                        <SelectItem key={area.value} value={area.value}>{area.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="injury_type">Tipo de Lesão *</Label>
                  <Select
                    value={formData.injury_type}
                    onValueChange={(value) => setFormData({ ...formData, injury_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {INJURY_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Severity and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="severity">Gravidade *</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => setFormData({ ...formData, severity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar gravidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {INJURY_SEVERITIES.map(sev => (
                        <SelectItem key={sev.value} value={sev.value}>{sev.label}</SelectItem>
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
                      <SelectValue placeholder="Selecionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {INJURY_STATUSES.map(status => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* End Date and Fit Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Recuperação</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="is_fit">Apto para Competição</Label>
                    <p className="text-xs text-muted-foreground">O jogador está autorizado a jogar</p>
                  </div>
                  <Switch
                    id="is_fit"
                    checked={formData.is_fit}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_fit: checked })}
                  />
                </div>
              </div>

              {/* Restrictions */}
              <div className="space-y-2">
                <Label htmlFor="restrictions">Restrições</Label>
                <Textarea
                  id="restrictions"
                  placeholder="Ex: Sem exercícios de impacto, sem sprints..."
                  value={formData.restrictions}
                  onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionais</Label>
                <Textarea
                  id="notes"
                  placeholder="Observações sobre a lesão..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/club/physio/injuries')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? 'A guardar...' : 'Guardar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Lesão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem a certeza que deseja eliminar este registo? Esta ação não pode ser revertida.
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
