import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";

interface TeamCoachesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: {
    id: string;
    name: string;
    club_id: string;
    youth_age_groups: {
      name: string;
    };
  };
}

interface TeamCoach {
  id: string;
  coach_id: string;
  role: string;
  profiles?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export function TeamCoachesDialog({ open, onOpenChange, team }: TeamCoachesDialogProps) {
  const queryClient = useQueryClient();
  const [selectedCoach, setSelectedCoach] = useState("");
  const [selectedRole, setSelectedRole] = useState("main");

  // Fetch current team coaches
  const { data: currentCoaches, isLoading: loadingCurrent } = useQuery({
    queryKey: ['youth-team-coaches', team.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_team_coaches')
        .select(`
          id,
          coach_id,
          role
        `)
        .eq('youth_team_id', team.id);
      
      if (error) throw error;

      // Fetch profile info for each coach
      const coachesWithProfiles = await Promise.all(
        data.map(async (coach) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', coach.coach_id)
            .single();
          
          return {
            ...coach,
            profiles: profile
          };
        })
      );

      return coachesWithProfiles as TeamCoach[];
    },
    enabled: open
  });

  // Fetch available coaches from club_coaches
  const { data: availableCoaches, isLoading: loadingAvailable } = useQuery({
    queryKey: ['club-coaches', team.club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('club_coaches')
        .select('coach_id')
        .eq('club_id', team.club_id)
        .eq('is_active', true);
      
      if (error) throw error;

      // Fetch profile info for each coach
      const coachesWithProfiles = await Promise.all(
        data.map(async (coach) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', coach.coach_id)
            .single();
          
          return profile;
        })
      );

      return coachesWithProfiles.filter(Boolean);
    },
    enabled: open
  });

  // Filter out already assigned coaches
  const unassignedCoaches = availableCoaches?.filter(
    coach => !currentCoaches?.some(c => c.coach_id === coach?.id)
  );

  const addCoachMutation = useMutation({
    mutationFn: async ({ coachId, role }: { coachId: string; role: string }) => {
      const { error } = await supabase
        .from('youth_team_coaches')
        .insert({
          youth_team_id: team.id,
          coach_id: coachId,
          role: role,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-team-coaches', team.id] });
      queryClient.invalidateQueries({ queryKey: ['youth-teams', team.club_id] });
      toast.success("Treinador adicionado com sucesso");
      setSelectedCoach("");
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar treinador: ${error.message}`);
    }
  });

  const removeCoachMutation = useMutation({
    mutationFn: async (teamCoachId: string) => {
      const { error } = await supabase
        .from('youth_team_coaches')
        .delete()
        .eq('id', teamCoachId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-team-coaches', team.id] });
      queryClient.invalidateQueries({ queryKey: ['youth-teams', team.club_id] });
      toast.success("Treinador removido da equipa");
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover treinador: ${error.message}`);
    }
  });

  const handleAddCoach = () => {
    if (!selectedCoach) {
      toast.warning("Selecione um treinador");
      return;
    }
    addCoachMutation.mutate({ coachId: selectedCoach, role: selectedRole });
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'main': return 'Principal';
      case 'assistant': return 'Adjunto';
      case 'goalkeeper': return 'Guarda-Redes';
      default: return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Gerir Treinadores - {team.youth_age_groups.name} / {team.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Coach Section */}
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Adicionar Treinador</label>
              <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar treinador" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedCoaches?.map((coach) => (
                    <SelectItem key={coach?.id} value={coach?.id || ''}>
                      {coach?.full_name || coach?.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-2">
              <label className="text-sm font-medium">Função</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Principal</SelectItem>
                  <SelectItem value="assistant">Adjunto</SelectItem>
                  <SelectItem value="goalkeeper">Guarda-Redes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAddCoach}
              disabled={!selectedCoach || addCoachMutation.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Current Coaches */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Treinadores Atuais</h4>
            <ScrollArea className="h-[250px]">
              {loadingCurrent ? (
                <p className="text-center py-8 text-muted-foreground">A carregar...</p>
              ) : currentCoaches && currentCoaches.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentCoaches.map((tc) => (
                      <TableRow key={tc.id}>
                        <TableCell className="font-medium">
                          {tc.profiles?.full_name || 'Sem nome'}
                        </TableCell>
                        <TableCell>{tc.profiles?.email}</TableCell>
                        <TableCell>
                          <Badge variant={tc.role === 'main' ? 'default' : 'secondary'}>
                            {getRoleLabel(tc.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCoachMutation.mutate(tc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum treinador atribuído a esta equipa.
                </p>
              )}
            </ScrollArea>
          </div>

          {unassignedCoaches?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Todos os treinadores do clube já estão atribuídos a esta equipa.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
