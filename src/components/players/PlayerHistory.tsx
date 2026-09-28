import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Building2, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface PlayerHistoryProps {
  playerId: string;
}

export function PlayerHistory({ playerId }: PlayerHistoryProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    club_name: '',
    start_date: '',
    end_date: '',
    position: '',
    notes: '',
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ['player-history', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_history')
        .select('*')
        .eq('player_id', playerId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createHistory = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('player_history')
        .insert({
          player_id: playerId,
          owner_id: user.id,
          ...formData,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-history', playerId] });
      toast.success('Historial registado');
      setDialogOpen(false);
      setFormData({
        club_name: '',
        start_date: '',
        end_date: '',
        position: '',
        notes: '',
      });
    },
    onError: (error: any) => {
      toast.error('Erro ao registar historial: ' + error.message);
    },
  });

  const deleteHistory = useMutation({
    mutationFn: async (historyId: string) => {
      const { error } = await supabase
        .from('player_history')
        .delete()
        .eq('id', historyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-history', playerId] });
      toast.success('Registo removido');
    },
  });

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return format(new Date(date), "MMM yyyy", { locale: pt });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Historial de Carreira</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar ao Historial</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Clube *</Label>
                <Input
                  value={formData.club_name}
                  onChange={(e) => setFormData({ ...formData, club_name: e.target.value })}
                  placeholder="Ex: FC Porto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Entrada</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Saída</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Posição</Label>
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Ex: Médio Centro"
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações..."
                />
              </div>

              <Button 
                className="w-full" 
                onClick={() => createHistory.mutate()}
                disabled={!formData.club_name || createHistory.isPending}
              >
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-16" />
            </Card>
          ))}
        </div>
      ) : history && history.length > 0 ? (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {history.map((item, index) => (
              <div key={item.id} className="relative pl-12">
                <div className="absolute left-4 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-secondary">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{item.club_name}</p>
                          {item.position && (
                            <p className="text-sm text-muted-foreground">{item.position}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(item.start_date) || 'Data desconhecida'}
                            {' → '}
                            {formatDate(item.end_date) || 'Presente'}
                          </p>
                          {item.notes && (
                            <p className="text-sm mt-2">{item.notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteHistory.mutate(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2" />
            <p>Sem historial de clubes anteriores</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
