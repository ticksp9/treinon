import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { UserCog, Plus, X, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AGE_CATEGORIES } from '@/lib/constants';

interface CoachAssignmentStepProps {
  seasonId: string;
  clubId: string;
  seasonName: string;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
  gender: string;
  sport_type: string;
}

interface Coach {
  id: string;
  coach_id: string;
  profile?: {
    full_name: string | null;
    email: string;
  };
}

interface CoachAssignment {
  id?: string;
  coach_id: string;
  team_id: string;
  role: string;
  coach_name?: string;
}

const COACH_ROLES = [
  { value: 'head_coach', label: 'Treinador Principal' },
  { value: 'assistant', label: 'Treinador Adjunto' },
  { value: 'goalkeeper_coach', label: 'Treinador de Guarda-Redes' },
  { value: 'fitness_coach', label: 'Preparador Físico' },
];

export function CoachAssignmentStep({ seasonId, clubId, seasonName }: CoachAssignmentStepProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [assignments, setAssignments] = useState<Map<string, CoachAssignment[]>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch teams
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category, gender, sport_type')
        .order('category');

      if (error) throw error;
      return data as Team[];
    },
    enabled: !!clubId,
  });

  // Fetch club coaches
  const { data: clubCoaches, isLoading: coachesLoading } = useQuery({
    queryKey: ['club-coaches', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('club_coaches')
        .select('id, coach_id')
        .eq('club_id', clubId)
        .eq('is_active', true);

      if (error) throw error;

      // Fetch profiles separately
      const coachIds = data.map(c => c.coach_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', coachIds);

      return data.map(coach => ({
        ...coach,
        profile: profiles?.find(p => p.id === coach.coach_id),
      })) as Coach[];
    },
    enabled: !!clubId,
  });

  // Fetch existing assignments for this season
  const { data: existingAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['season-coach-assignments', seasonId],
    queryFn: async () => {
      // First get team plans for this season
      const { data: teamPlans, error: teamPlansError } = await supabase
        .from('season_team_plans')
        .select('id, team_id')
        .eq('season_id', seasonId);

      if (teamPlansError) throw teamPlansError;

      if (!teamPlans || teamPlans.length === 0) return [];

      const teamPlanIds = teamPlans.map(tp => tp.id);

      const { data, error } = await supabase
        .from('season_coach_assignments')
        .select('id, coach_id, team_plan_id, role')
        .eq('season_id', seasonId)
        .in('team_plan_id', teamPlanIds);

      if (error) throw error;

      // Map team_plan_id to team_id
      const teamPlanToTeamId = new Map(teamPlans.map(tp => [tp.id, tp.team_id]));

      return data.map(a => ({
        id: a.id,
        coach_id: a.coach_id,
        team_id: teamPlanToTeamId.get(a.team_plan_id) || '',
        team_plan_id: a.team_plan_id,
        role: a.role,
      }));
    },
    enabled: !!seasonId,
  });

  // Fetch current team coaches for initial data
  const { data: currentTeamCoaches, isLoading: currentCoachesLoading } = useQuery({
    queryKey: ['team-coaches', clubId],
    queryFn: async () => {
      if (!teams) return [];
      const teamIds = teams.map(t => t.id);
      
      const { data, error } = await supabase
        .from('team_coaches')
        .select('team_id, coach_id')
        .in('team_id', teamIds);

      if (error) throw error;
      return data;
    },
    enabled: !!clubId && !!teams && teams.length > 0,
  });

  // Initialize assignments
  useEffect(() => {
    if (!teams || !clubCoaches) return;

    const newAssignments = new Map<string, CoachAssignment[]>();

    teams.forEach(team => {
      // Check for existing season assignments first
      const teamSeasonAssignments = existingAssignments?.filter(a => a.team_id === team.id) || [];
      
      if (teamSeasonAssignments.length > 0) {
        newAssignments.set(team.id, teamSeasonAssignments.map(a => ({
          id: a.id,
          coach_id: a.coach_id,
          team_id: team.id,
          role: a.role,
          coach_name: clubCoaches.find(c => c.coach_id === a.coach_id)?.profile?.full_name || 'Treinador',
        })));
      } else {
        // Use current assignments as default
        const currentAssignments = currentTeamCoaches?.filter(tc => tc.team_id === team.id) || [];
        newAssignments.set(team.id, currentAssignments.map(tc => ({
          coach_id: tc.coach_id,
          team_id: team.id,
          role: 'head_coach',
          coach_name: clubCoaches.find(c => c.coach_id === tc.coach_id)?.profile?.full_name || 'Treinador',
        })));
      }
    });

    setAssignments(newAssignments);
  }, [teams, clubCoaches, existingAssignments, currentTeamCoaches]);

  const addCoachToTeam = (teamId: string) => {
    setAssignments(prev => {
      const newMap = new Map(prev);
      const teamAssignments = newMap.get(teamId) || [];
      teamAssignments.push({
        coach_id: '',
        team_id: teamId,
        role: 'assistant',
      });
      newMap.set(teamId, teamAssignments);
      return newMap;
    });
    setHasChanges(true);
  };

  const removeCoachFromTeam = (teamId: string, index: number) => {
    setAssignments(prev => {
      const newMap = new Map(prev);
      const teamAssignments = [...(newMap.get(teamId) || [])];
      teamAssignments.splice(index, 1);
      newMap.set(teamId, teamAssignments);
      return newMap;
    });
    setHasChanges(true);
  };

  const updateAssignment = (teamId: string, index: number, updates: Partial<CoachAssignment>) => {
    setAssignments(prev => {
      const newMap = new Map(prev);
      const teamAssignments = [...(newMap.get(teamId) || [])];
      if (teamAssignments[index]) {
        teamAssignments[index] = { ...teamAssignments[index], ...updates };
        
        // Update coach name
        if (updates.coach_id) {
          const coach = clubCoaches?.find(c => c.coach_id === updates.coach_id);
          teamAssignments[index].coach_name = coach?.profile?.full_name || 'Treinador';
        }
      }
      newMap.set(teamId, teamAssignments);
      return newMap;
    });
    setHasChanges(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // First ensure team plans exist
      for (const team of teams || []) {
        const { data: existingPlan } = await supabase
          .from('season_team_plans')
          .select('id')
          .eq('season_id', seasonId)
          .eq('team_id', team.id)
          .maybeSingle();

        let teamPlanId: string;

        if (!existingPlan) {
          const { data: newPlan, error } = await supabase
            .from('season_team_plans')
            .insert({
              season_id: seasonId,
              club_id: clubId,
              team_id: team.id,
              team_name: team.name,
              category: team.category,
              gender: team.gender,
              sport_type: team.sport_type,
              created_by: user!.id,
            })
            .select('id')
            .single();

          if (error) throw error;
          teamPlanId = newPlan.id;
        } else {
          teamPlanId = existingPlan.id;
        }

        // Delete existing assignments for this team plan
        await supabase
          .from('season_coach_assignments')
          .delete()
          .eq('team_plan_id', teamPlanId);

        // Insert new assignments
        const teamAssignments = assignments.get(team.id) || [];
        for (const assignment of teamAssignments) {
          if (assignment.coach_id) {
            const { error } = await supabase
              .from('season_coach_assignments')
              .insert({
                season_id: seasonId,
                club_id: clubId,
                coach_id: assignment.coach_id,
                team_plan_id: teamPlanId,
                role: assignment.role,
                created_by: user!.id,
              });
            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Atribuições de treinadores guardadas');
      queryClient.invalidateQueries({ queryKey: ['season-coach-assignments', seasonId] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao guardar: ' + error.message);
    },
  });

  const isLoading = teamsLoading || coachesLoading || assignmentsLoading || currentCoachesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Sort teams by category
  const sortedTeams = [...(teams || [])].sort((a, b) => {
    const catA = AGE_CATEGORIES.findIndex(c => c.value === a.category);
    const catB = AGE_CATEGORIES.findIndex(c => c.value === b.category);
    return catA - catB;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Atribuição de Treinadores
          </h2>
          <p className="text-sm text-muted-foreground">
            Defina os treinadores para cada equipa na época {seasonName}
          </p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'A guardar...' : 'Guardar Alterações'}
          </Button>
        )}
      </div>

      {(!clubCoaches || clubCoaches.length === 0) && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-6 text-center">
            <p className="text-amber-600">
              Nenhum treinador associado ao clube. Adicione treinadores primeiro.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sortedTeams.map(team => {
          const teamAssignments = assignments.get(team.id) || [];

          return (
            <Card key={team.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  <Badge variant="secondary">{team.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {teamAssignments.map((assignment, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={assignment.coach_id}
                      onValueChange={(value) => updateAssignment(team.id, index, { coach_id: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecionar treinador..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clubCoaches?.map(coach => (
                          <SelectItem key={coach.coach_id} value={coach.coach_id}>
                            {coach.profile?.full_name || coach.profile?.email || 'Treinador'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={assignment.role}
                      onValueChange={(value) => updateAssignment(team.id, index, { role: value })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COACH_ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeCoachFromTeam(team.id, index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => addCoachToTeam(team.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Treinador
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
