import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Plus, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENT_SEASONS } from '@/lib/constants';

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_planning: boolean;
}

interface SeasonSelectorProps {
  clubId: string;
  selectedSeasonId: string | null;
  onSeasonSelect: (seasonId: string) => void;
}

export function SeasonSelector({ clubId, selectedSeasonId, onSeasonSelect }: SeasonSelectorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');

  // Fetch existing seasons for the club
  const { data: seasons, isLoading } = useQuery({
    queryKey: ['seasons', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('club_id', clubId)
        .order('name', { ascending: false });

      if (error) throw error;
      return data as Season[];
    },
    enabled: !!clubId,
  });

  // Create new season mutation
  const createSeasonMutation = useMutation({
    mutationFn: async (name: string) => {
      const startYear = parseInt(name.split('/')[0]);
      const startDate = `${startYear}-07-01`;
      const endDate = `${startYear + 1}-06-30`;

      const { data, error } = await supabase
        .from('seasons')
        .insert({
          club_id: clubId,
          name,
          start_date: startDate,
          end_date: endDate,
          is_active: false,
          is_planning: true,
          owner_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Época criada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['seasons', clubId] });
      setShowCreateDialog(false);
      setNewSeasonName('');
      onSeasonSelect(data.id);
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate key')) {
        toast.error('Esta época já existe');
      } else {
        toast.error('Erro ao criar época: ' + error.message);
      }
    },
  });

  // Auto-select planning season
  useEffect(() => {
    if (seasons && seasons.length > 0 && !selectedSeasonId) {
      const planningSeason = seasons.find(s => s.is_planning);
      if (planningSeason) {
        onSeasonSelect(planningSeason.id);
      }
    }
  }, [seasons, selectedSeasonId, onSeasonSelect]);

  const selectedSeason = seasons?.find(s => s.id === selectedSeasonId);

  const handleCreateSeason = () => {
    if (!newSeasonName) {
      toast.error('Selecione uma época');
      return;
    }
    createSeasonMutation.mutate(newSeasonName);
  };

  // Filter out already existing seasons
  const availableSeasons = CURRENT_SEASONS.filter(
    s => !seasons?.some(existing => existing.name === s)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Época em Planeamento
        </CardTitle>
        <CardDescription>
          Selecione ou crie uma época para planear a transição
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-10 bg-muted animate-pulse rounded-md" />
        ) : seasons && seasons.length > 0 ? (
          <div className="flex items-center gap-4">
            <Select value={selectedSeasonId || ''} onValueChange={onSeasonSelect}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar época..." />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    <span className="flex items-center gap-2">
                      {season.name}
                      {season.is_active && (
                        <Badge variant="default" className="ml-2 text-xs">Ativa</Badge>
                      )}
                      {season.is_planning && !season.is_active && (
                        <Badge variant="secondary" className="ml-2 text-xs">Planeamento</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedSeason && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {selectedSeason.is_planning ? (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    Em planeamento
                  </Badge>
                ) : selectedSeason.is_active ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Época ativa
                  </Badge>
                ) : (
                  <Badge variant="secondary">Arquivada</Badge>
                )}
              </div>
            )}

            {availableSeasons.length > 0 && (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Época
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Época</DialogTitle>
                    <DialogDescription>
                      Crie uma nova época para começar a planear a transição.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="season-name">Época</Label>
                      <Select value={newSeasonName} onValueChange={setNewSeasonName}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar época..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSeasons.map((season) => (
                            <SelectItem key={season} value={season}>
                              {season}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateSeason}
                      disabled={createSeasonMutation.isPending}
                    >
                      {createSeasonMutation.isPending ? 'A criar...' : 'Criar Época'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Nenhuma época criada. Crie a primeira época para começar.
            </p>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Época
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Época</DialogTitle>
                  <DialogDescription>
                    Crie uma nova época para começar a planear a transição.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="season-name">Época</Label>
                    <Select value={newSeasonName} onValueChange={setNewSeasonName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar época..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENT_SEASONS.map((season) => (
                          <SelectItem key={season} value={season}>
                            {season}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateSeason}
                    disabled={createSeasonMutation.isPending}
                  >
                    {createSeasonMutation.isPending ? 'A criar...' : 'Criar Época'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
