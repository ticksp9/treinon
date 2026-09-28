import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, UserPlus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { TeamPlayersDialog } from "./TeamPlayersDialog";
import { TeamCoachesDialog } from "./TeamCoachesDialog";

interface TeamsTabProps {
  clubId: string;
}

interface Team {
  id: string;
  name: string;
  sport_variant: string;
  season: string;
  is_active: boolean;
  age_group_id: string;
  club_id: string;
  youth_age_groups: {
    id: string;
    name: string;
    min_birth_year: number;
    max_birth_year: number;
    display_order: number;
  };
  _count?: {
    players: number;
    coaches: number;
  };
}

const SPORT_VARIANTS = [
  { value: 'football_7', label: 'Futebol 7' },
  { value: 'football_9', label: 'Futebol 9' },
  { value: 'football_11', label: 'Futebol 11' },
  { value: 'futsal', label: 'Futsal' },
];

export function TeamsTab({ clubId }: TeamsTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeamForPlayers, setSelectedTeamForPlayers] = useState<Team | null>(null);
  const [selectedTeamForCoaches, setSelectedTeamForCoaches] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    age_group_id: "",
    sport_variant: "football_11",
    season: "2024/2025",
  });

  // Fetch age groups for dropdown
  const { data: ageGroups } = useQuery({
    queryKey: ['youth-age-groups', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_age_groups')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
    enabled: !!clubId
  });

  // Fetch teams with counts
  const { data: teams, isLoading } = useQuery({
    queryKey: ['youth-teams', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_teams')
        .select(`
          *,
          youth_age_groups (id, name, min_birth_year, max_birth_year, display_order)
        `)
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get player and coach counts for each team
      const teamsWithCounts = await Promise.all(
        data.map(async (team) => {
          const [playersResult, coachesResult] = await Promise.all([
            supabase.from('youth_team_players').select('id', { count: 'exact' }).eq('youth_team_id', team.id),
            supabase.from('youth_team_coaches').select('id', { count: 'exact' }).eq('youth_team_id', team.id)
          ]);
          
          return {
            ...team,
            club_id: clubId,
            _count: {
              players: playersResult.count || 0,
              coaches: coachesResult.count || 0
            }
          };
        })
      );
      
      return teamsWithCounts as Team[];
    },
    enabled: !!clubId
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('youth_teams')
        .insert({
          club_id: clubId,
          name: data.name,
          age_group_id: data.age_group_id,
          sport_variant: data.sport_variant,
          season: data.season,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-teams', clubId] });
      queryClient.invalidateQueries({ queryKey: ['youth-coordination-stats', clubId] });
      toast.success("Equipa criada com sucesso");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar equipa: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('youth_teams')
        .update({
          name: data.name,
          age_group_id: data.age_group_id,
          sport_variant: data.sport_variant,
          season: data.season,
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-teams', clubId] });
      toast.success("Equipa atualizada com sucesso");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar equipa: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('youth_teams')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-teams', clubId] });
      queryClient.invalidateQueries({ queryKey: ['youth-coordination-stats', clubId] });
      toast.success("Equipa eliminada com sucesso");
    },
    onError: (error: any) => {
      toast.error(`Erro ao eliminar equipa: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      age_group_id: "",
      sport_variant: "football_11",
      season: "2024/2025",
    });
    setEditingTeam(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      age_group_id: team.age_group_id,
      sport_variant: team.sport_variant,
      season: team.season,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getSportLabel = (variant: string) => {
    return SPORT_VARIANTS.find(s => s.value === variant)?.label || variant;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Equipas</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingTeam(null); resetForm(); }} disabled={!ageGroups?.length}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Equipa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTeam ? "Editar Equipa" : "Nova Equipa"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="age_group">Escalão</Label>
                  <Select
                    value={formData.age_group_id}
                    onValueChange={(value) => setFormData({ ...formData, age_group_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar escalão" />
                    </SelectTrigger>
                    <SelectContent>
                      {ageGroups?.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Equipa</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Iniciados A, Infantis B"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sport_variant">Variante</Label>
                  <Select
                    value={formData.sport_variant}
                    onValueChange={(value) => setFormData({ ...formData, sport_variant: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPORT_VARIANTS.map((variant) => (
                        <SelectItem key={variant.value} value={variant.value}>
                          {variant.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="season">Época</Label>
                  <Input
                    id="season"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    placeholder="Ex: 2024/2025"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingTeam ? "Guardar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!ageGroups?.length ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Primeiro crie os escalões no separador "Escalões".
              </p>
            </div>
          ) : isLoading ? (
            <p className="text-muted-foreground text-center py-8">A carregar...</p>
          ) : teams && teams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipa</TableHead>
                  <TableHead>Escalão</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Jogadores</TableHead>
                  <TableHead>Treinadores</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.youth_age_groups?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getSportLabel(team.sport_variant)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {team._count?.players || 0}
                      </div>
                    </TableCell>
                    <TableCell>{team._count?.coaches || 0}</TableCell>
                    <TableCell>
                      <Badge variant={team.is_active ? "default" : "secondary"}>
                        {team.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Gerir jogadores"
                          onClick={() => setSelectedTeamForPlayers(team)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Gerir treinadores"
                          onClick={() => setSelectedTeamForCoaches(team)}
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(team)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Tem a certeza que quer eliminar esta equipa?")) {
                              deleteMutation.mutate(team.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Ainda não tem equipas criadas.
              </p>
              <p className="text-sm text-muted-foreground">
                Crie equipas como "Iniciados A", "Infantis B", etc.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player Management Dialog */}
      {selectedTeamForPlayers && (
        <TeamPlayersDialog
          open={!!selectedTeamForPlayers}
          onOpenChange={(open) => !open && setSelectedTeamForPlayers(null)}
          team={selectedTeamForPlayers}
        />
      )}

      {/* Coach Management Dialog */}
      {selectedTeamForCoaches && (
        <TeamCoachesDialog
          open={!!selectedTeamForCoaches}
          onOpenChange={(open) => !open && setSelectedTeamForCoaches(null)}
          team={selectedTeamForCoaches}
        />
      )}
    </>
  );
}
