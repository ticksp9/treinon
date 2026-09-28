import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { UserPlus, UserMinus, AlertTriangle, Ban } from "lucide-react";
import { useOverduePlayersBlock } from "@/hooks/useOverduePlayersBlock";

interface TeamPlayersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: {
    id: string;
    name: string;
    age_group_id: string;
    club_id: string;
    youth_age_groups: {
      id: string;
      name: string;
      min_birth_year: number;
      max_birth_year: number;
      display_order: number;
    };
  };
}

interface Player {
  id: string;
  name: string;
  birth_date: string | null;
  number: number | null;
  position: string | null;
  team_id: string;
  teams: {
    id: string;
    name: string;
    category: string | null;
  } | null;
}

interface TeamPlayer {
  id: string;
  player_id: string;
  is_from_lower_age_group: boolean;
  status: string;
  blocked_reason: string | null;
  players: Player;
}

export function TeamPlayersDialog({ open, onOpenChange, team }: TeamPlayersDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("current");
  
  // Get blocked players due to overdue payments
  const { data: blockedPlayers } = useOverduePlayersBlock(team.club_id);

  // Fetch current team players
  const { data: currentPlayers, isLoading: loadingCurrent } = useQuery({
    queryKey: ['youth-team-players', team.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_team_players')
        .select(`
          *,
          players (
            id,
            name,
            birth_date,
            number,
            position,
            team_id,
            teams (id, name, category)
          )
        `)
        .eq('youth_team_id', team.id);
      
      if (error) throw error;
      return data as TeamPlayer[];
    },
    enabled: open
  });

  // Fetch all age groups to find the one below
  const { data: ageGroups } = useQuery({
    queryKey: ['youth-age-groups', team.club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_age_groups')
        .select('*')
        .eq('club_id', team.club_id)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Find the age group below the current one
  const lowerAgeGroup = ageGroups?.find(
    ag => ag.display_order === team.youth_age_groups.display_order - 1
  );

  // Fetch eligible players from current age group
  const { data: eligiblePlayers, isLoading: loadingEligible } = useQuery({
    queryKey: ['eligible-players', team.id, team.youth_age_groups],
    queryFn: async () => {
      // Get players whose birth year falls within the age group range
      const { data: allPlayers, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          birth_date,
          number,
          position,
          team_id,
          teams (id, name, category)
        `)
        .eq('is_active', true);
      
      if (error) throw error;

      // Filter by birth year
      const eligible = allPlayers?.filter(player => {
        if (!player.birth_date) return false;
        const birthYear = new Date(player.birth_date).getFullYear();
        return birthYear >= team.youth_age_groups.min_birth_year && 
               birthYear <= team.youth_age_groups.max_birth_year;
      });

      // Exclude players already in this team
      const currentPlayerIds = currentPlayers?.map(cp => cp.player_id) || [];
      return eligible?.filter(p => !currentPlayerIds.includes(p.id)) as Player[];
    },
    enabled: open && !!currentPlayers
  });

  // Fetch eligible players from lower age group (can "subir")
  const { data: lowerGroupPlayers, isLoading: loadingLower } = useQuery({
    queryKey: ['lower-group-players', team.id, lowerAgeGroup?.id],
    queryFn: async () => {
      if (!lowerAgeGroup) return [];

      const { data: allPlayers, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          birth_date,
          number,
          position,
          team_id,
          teams (id, name, category)
        `)
        .eq('is_active', true);
      
      if (error) throw error;

      // Filter by birth year of lower age group
      const eligible = allPlayers?.filter(player => {
        if (!player.birth_date) return false;
        const birthYear = new Date(player.birth_date).getFullYear();
        return birthYear >= lowerAgeGroup.min_birth_year && 
               birthYear <= lowerAgeGroup.max_birth_year;
      });

      // Exclude players already in this team
      const currentPlayerIds = currentPlayers?.map(cp => cp.player_id) || [];
      return eligible?.filter(p => !currentPlayerIds.includes(p.id)) as Player[];
    },
    enabled: open && !!lowerAgeGroup && !!currentPlayers
  });

  const addPlayersMutation = useMutation({
    mutationFn: async ({ playerIds, isFromLower, playerNames }: { playerIds: string[]; isFromLower: boolean; playerNames: string[] }) => {
      const records = playerIds.map(playerId => ({
        youth_team_id: team.id,
        player_id: playerId,
        is_from_lower_age_group: isFromLower,
        status: 'active',
      }));

      const { error } = await supabase
        .from('youth_team_players')
        .insert(records);
      
      if (error) throw error;
      
      // Log to history
      for (let i = 0; i < playerIds.length; i++) {
        await supabase.from('coordination_change_history').insert({
          club_id: team.club_id,
          entity_type: 'player_assignment',
          entity_id: playerIds[i],
          action: 'player_added',
          changes: { 
            player_name: playerNames[i],
            team_name: team.name,
            is_from_lower: isFromLower
          },
          performed_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-team-players', team.id] });
      queryClient.invalidateQueries({ queryKey: ['eligible-players'] });
      queryClient.invalidateQueries({ queryKey: ['lower-group-players'] });
      queryClient.invalidateQueries({ queryKey: ['youth-teams', team.club_id] });
      queryClient.invalidateQueries({ queryKey: ['coordination-history', team.club_id] });
      toast.success("Jogadores adicionados com sucesso");
      setSelectedPlayers([]);
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar jogadores: ${error.message}`);
    }
  });

  const removePlayerMutation = useMutation({
    mutationFn: async ({ teamPlayerId, playerId, playerName }: { teamPlayerId: string; playerId: string; playerName: string }) => {
      const { error } = await supabase
        .from('youth_team_players')
        .delete()
        .eq('id', teamPlayerId);
      
      if (error) throw error;
      
      // Log to history
      await supabase.from('coordination_change_history').insert({
        club_id: team.club_id,
        entity_type: 'player_assignment',
        entity_id: playerId,
        action: 'player_removed',
        changes: { 
          player_name: playerName,
          team_name: team.name
        },
        performed_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-team-players', team.id] });
      queryClient.invalidateQueries({ queryKey: ['youth-teams', team.club_id] });
      queryClient.invalidateQueries({ queryKey: ['coordination-history', team.club_id] });
      toast.success("Jogador removido da equipa");
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover jogador: ${error.message}`);
    }
  });

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleAddPlayers = (isFromLower: boolean) => {
    if (selectedPlayers.length === 0) {
      toast.warning("Selecione pelo menos um jogador");
      return;
    }
    
    // Get player names for history
    const allPlayers = [...(eligiblePlayers || []), ...(lowerGroupPlayers || [])];
    const playerNames = selectedPlayers.map(id => 
      allPlayers.find(p => p.id === id)?.name || 'Desconhecido'
    );
    
    addPlayersMutation.mutate({ playerIds: selectedPlayers, isFromLower, playerNames });
  };
  
  const isPlayerBlocked = (playerId: string) => blockedPlayers?.has(playerId) || false;

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return "-";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Gerir Jogadores - {team.youth_age_groups.name} / {team.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="current">
              Jogadores Atuais ({currentPlayers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="eligible">
              Elegíveis ({eligiblePlayers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="lower" disabled={!lowerAgeGroup}>
              Escalão Inferior ({lowerGroupPlayers?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current">
            <ScrollArea className="h-[400px]">
              {loadingCurrent ? (
                <p className="text-center py-8 text-muted-foreground">A carregar...</p>
              ) : currentPlayers && currentPlayers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Posição</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPlayers.map((tp) => (
                      <TableRow key={tp.id}>
                        <TableCell className="font-medium">
                          {tp.players.number && `#${tp.players.number} `}
                          {tp.players.name}
                        </TableCell>
                        <TableCell>{getAge(tp.players.birth_date)}</TableCell>
                        <TableCell>{tp.players.position || "-"}</TableCell>
                        <TableCell>
                          {tp.is_from_lower_age_group ? (
                            <Badge variant="secondary">Escalão Inferior</Badge>
                          ) : (
                            <Badge>Escalão Natural</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPlayerBlocked(tp.player_id) ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="destructive" className="flex items-center gap-1">
                                    <Ban className="h-3 w-3" />
                                    Bloqueado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Pagamentos em atraso há mais de 2 meses</p>
                                  <p className="text-xs">Não pode ser convocado</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : tp.status === 'blocked' ? (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {tp.blocked_reason === 'payment_overdue' ? 'Pagamento em falta' : tp.blocked_reason}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Ativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePlayerMutation.mutate({
                              teamPlayerId: tp.id,
                              playerId: tp.player_id,
                              playerName: tp.players.name
                            })}
                          >
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum jogador nesta equipa.
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="eligible">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Jogadores nascidos entre {team.youth_age_groups.min_birth_year} e {team.youth_age_groups.max_birth_year}
                </p>
                <Button
                  onClick={() => handleAddPlayers(false)}
                  disabled={selectedPlayers.length === 0 || addPlayersMutation.isPending}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Selecionados ({selectedPlayers.length})
                </Button>
              </div>
              <ScrollArea className="h-[350px]">
                {loadingEligible ? (
                  <p className="text-center py-8 text-muted-foreground">A carregar...</p>
                ) : eligiblePlayers && eligiblePlayers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Idade</TableHead>
                        <TableHead>Equipa Atual</TableHead>
                        <TableHead>Posição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligiblePlayers.map((player) => (
                        <TableRow key={player.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPlayers.includes(player.id)}
                              onCheckedChange={() => togglePlayer(player.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{player.name}</TableCell>
                          <TableCell>{getAge(player.birth_date)}</TableCell>
                          <TableCell>{player.teams?.name || "-"}</TableCell>
                          <TableCell>{player.position || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum jogador elegível disponível.
                  </p>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="lower">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Jogadores do escalão {lowerAgeGroup?.name} que podem subir
                  </p>
                  <p className="text-xs text-amber-600">
                    ⚠️ Estes jogadores ficam disponíveis para ambos os escalões
                  </p>
                </div>
                <Button
                  onClick={() => handleAddPlayers(true)}
                  disabled={selectedPlayers.length === 0 || addPlayersMutation.isPending}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Selecionados ({selectedPlayers.length})
                </Button>
              </div>
              <ScrollArea className="h-[350px]">
                {loadingLower ? (
                  <p className="text-center py-8 text-muted-foreground">A carregar...</p>
                ) : lowerGroupPlayers && lowerGroupPlayers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Idade</TableHead>
                        <TableHead>Equipa Atual</TableHead>
                        <TableHead>Posição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowerGroupPlayers.map((player) => (
                        <TableRow key={player.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPlayers.includes(player.id)}
                              onCheckedChange={() => togglePlayer(player.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{player.name}</TableCell>
                          <TableCell>{getAge(player.birth_date)}</TableCell>
                          <TableCell>{player.teams?.name || "-"}</TableCell>
                          <TableCell>{player.position || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    {lowerAgeGroup 
                      ? "Nenhum jogador do escalão inferior disponível."
                      : "Este é o escalão mais baixo."
                    }
                  </p>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
