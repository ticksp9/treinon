import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, UserPlus, Users, Trash2, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { StaffInviteDialog, PendingStaffInvites, type StaffInviteType } from '@/components/invites/StaffInviteDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Coach {
  id: string;
  coach_id: string;
  joined_at: string;
  is_active: boolean;
  permissions?: { view_all_teams?: boolean } | null;
  profile?: {
    full_name: string | null;
    email: string;
    username: string | null;
  };
  teams?: {
    id: string;
    name: string;
    role: 'head_coach' | 'assistant_coach';
  }[];
}

interface Team {
  id: string;
  name: string;
}

export default function Coaches() {
  const { user } = useAuth();
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'head_coach' | 'assistant_coach'>('head_coach');
  const queryClient = useQueryClient();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // Fetch club's coaches
  const { data: coaches, isLoading: coachesLoading } = useQuery({
    queryKey: ['club-coaches', clubId],
    queryFn: async () => {
      if (!clubId) return [];

      const { data: clubCoaches, error } = await supabase
        .from('club_coaches')
        .select('*')
        .eq('club_id', clubId);

      if (error) throw error;

      // Fetch profile info for each coach
      const coachesWithProfiles = await Promise.all(
        (clubCoaches || []).map(async (coach) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, username')
            .eq('id', coach.coach_id)
            .maybeSingle();

          const { data: teamCoaches } = await supabase
            .from('team_coaches')
            .select('team_id, role')
            .eq('coach_id', coach.coach_id);

          let teams: Coach['teams'] = [];
          if (teamCoaches && teamCoaches.length > 0) {
            const teamIds = teamCoaches.map(tc => tc.team_id);
            const { data: teamsData } = await supabase
              .from('teams')
              .select('id, name')
              .in('id', teamIds)
              .eq('club_id', clubId);
            teams = (teamsData || []).map((t) => ({
              ...t,
              role: ((teamCoaches as { team_id: string; role: string | null }[]).find((tc) => tc.team_id === t.id)?.role ?? 'head_coach') as 'head_coach' | 'assistant_coach',
            }));
          }

          return {
            ...coach,
            profile,
            teams,
          };
        })
      );

      return coachesWithProfiles as Coach[];
    },
    enabled: !!clubId && isClubAdmin,
  });

  // Fetch teams for assignment
  const { data: teams } = useQuery({
    queryKey: ['teams', clubId],
    queryFn: async () => {
      if (!clubId) return [];

      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId)
        .order('name');

      if (error) throw error;
      return data as Team[];
    },
    enabled: !!clubId && isClubAdmin,
  });

  // Assign coach to team mutation
  const assignCoachToTeam = useMutation({
    mutationFn: async ({ coachId, teamId }: { coachId: string; teamId: string }) => {
      const { error } = await supabase
        .from('team_coaches')
        .upsert({
          team_id: teamId,
          coach_id: coachId,
          role: selectedRole,
        }, { onConflict: 'team_id,coach_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-coaches'] });
      toast.success(selectedRole === 'assistant_coach' ? 'Adjunto associado à equipa!' : 'Treinador associado à equipa!');
      setAssignDialogOpen(false);
      setSelectedCoach(null);
      setSelectedTeamId('');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('Este treinador já está associado a esta equipa');
      } else {
        toast.error('Erro ao associar treinador: ' + error.message);
      }
    },
  });

  // Remove coach from club mutation
  const removeCoach = useMutation({
    mutationFn: async (coachId: string) => {
      if (!clubId) throw new Error('Club not found');

      const { error } = await supabase
        .from('club_coaches')
        .delete()
        .eq('club_id', clubId)
        .eq('coach_id', coachId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-coaches'] });
      toast.success('Treinador removido do clube');
    },
  });

  const inviteTypes: StaffInviteType[] = ['coach', 'assistant_coach', 'staff'];

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isClubAdmin) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Esta funcionalidade está disponível apenas para administradores de clubes.
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Treinadores</h1>
            <p className="text-muted-foreground">Treinadores principais, adjuntos e staff do clube</p>
          </div>

          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Convidar
          </Button>
        </div>

        <StaffInviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} teams={teams ?? []} allowedTypes={inviteTypes} />
        <PendingStaffInvites teamIds={(teams ?? []).map((t) => t.id)} />

        {/* Active Coaches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Treinadores Ativos
            </CardTitle>
            <CardDescription>
              {coaches?.length || 0} treinador(es) no clube
            </CardDescription>
          </CardHeader>
          <CardContent>
            {coachesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : coaches && coaches.length > 0 ? (
              <div className="space-y-3">
                {coaches.map((coach) => (
                  <div 
                    key={coach.id}
                    className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border/50"
                  >
                    <div>
                      <p className="font-medium">
                        {coach.profile?.full_name || coach.profile?.username || 'Sem nome'}
                      </p>
                      <p className="text-sm text-muted-foreground">{coach.profile?.email}</p>
                      <div className="flex gap-1 mt-2">
                        {coach.teams?.map((team) => (
                          <Badge key={team.id} variant={team.role === 'assistant_coach' ? 'outline' : 'secondary'} className="text-xs">
                            {team.name} · {team.role === 'assistant_coach' ? 'Adjunto' : 'Principal'}
                          </Badge>
                        ))}
                        {(!coach.teams || coach.teams.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">
                            Sem equipas atribuídas
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground" title="Pode ver (sem alterar) todas as equipas do clube">
                        <Switch
                          checked={!!coach.permissions?.view_all_teams}
                          onCheckedChange={async (v) => {
                            const { error } = await supabase.rpc('set_club_coach_permissions' as never, { _club: clubId, _coach: coach.coach_id, _perms: { view_all_teams: v } } as never);
                            if (error) toast.error('Não foi possível alterar: ' + error.message);
                            else { toast.success(v ? 'Passa a ver todas as equipas (só leitura)' : 'Vê só as suas equipas'); queryClient.invalidateQueries({ queryKey: ['club-coaches'] }); }
                          }}
                        />
                        Ver todas as equipas
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCoach(coach);
                          setAssignDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Equipa
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Remover este treinador do clube? Deixa de ter acesso às equipas do clube (os dados das equipas ficam).')) {
                            removeCoach.mutate(coach.coach_id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Ainda não tem treinadores no clube.</p>
                <p className="text-sm text-muted-foreground">
                  Convide treinadores para começar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign Coach Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir equipa</DialogTitle>
              <DialogDescription>
                Selecione uma equipa para atribuir a {selectedCoach?.profile?.full_name || 'este treinador'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Equipa</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma equipa" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Função na equipa</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'head_coach' | 'assistant_coach')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="head_coach">Treinador principal</SelectItem>
                    <SelectItem value="assistant_coach">Treinador adjunto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!selectedTeamId || assignCoachToTeam.isPending}
                onClick={() => {
                  if (selectedCoach && selectedTeamId) {
                    assignCoachToTeam.mutate({
                      coachId: selectedCoach.coach_id,
                      teamId: selectedTeamId,
                    });
                  }
                }}
              >
                Atribuir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
