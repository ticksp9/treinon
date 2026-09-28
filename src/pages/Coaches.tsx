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
import { Plus, Mail, Key, Copy, UserPlus, Users, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Coach {
  id: string;
  coach_id: string;
  joined_at: string;
  is_active: boolean;
  profile?: {
    full_name: string | null;
    email: string;
    username: string | null;
  };
  teams?: {
    id: string;
    name: string;
  }[];
}

interface Invitation {
  id: string;
  email: string | null;
  invite_code: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

interface Team {
  id: string;
  name: string;
}

export default function Coaches() {
  const { user } = useAuth();
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<'email' | 'code'>('email');
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  
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
            .select('team_id')
            .eq('coach_id', coach.coach_id);
          
          let teams: Team[] = [];
          if (teamCoaches && teamCoaches.length > 0) {
            const teamIds = teamCoaches.map(tc => tc.team_id);
            const { data: teamsData } = await supabase
              .from('teams')
              .select('id, name')
              .in('id', teamIds);
            teams = teamsData || [];
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

  // Fetch pending invitations
  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['coach-invitations', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      
      const { data, error } = await supabase
        .from('club_coach_invitations')
        .select('*')
        .eq('club_id', clubId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
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

  // Create invitation mutation
  const createInvitation = useMutation({
    mutationFn: async (method: 'email' | 'code') => {
      if (!clubId || !user) throw new Error('Club not found');
      
      const generateSecureCode = (length = 12) => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        let out = '';
        for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
        return out;
      };
      const inviteCode = method === 'code' ? generateSecureCode(12) : null;
      
      const { data, error } = await supabase
        .from('club_coach_invitations')
        .insert({
          club_id: clubId,
          email: method === 'email' ? inviteEmail : null,
          invite_code: inviteCode,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['coach-invitations'] });
      if (data.invite_code) {
        setGeneratedCode(data.invite_code);
        toast.success('Código de convite gerado!');
      } else {
        toast.success('Convite enviado com sucesso!');
        setInviteDialogOpen(false);
        setInviteEmail('');
      }
    },
    onError: (error: any) => {
      toast.error('Erro ao criar convite: ' + error.message);
    },
  });

  // Delete invitation mutation
  const deleteInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('club_coach_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-invitations'] });
      toast.success('Convite cancelado');
    },
  });

  // Assign coach to team mutation
  const assignCoachToTeam = useMutation({
    mutationFn: async ({ coachId, teamId }: { coachId: string; teamId: string }) => {
      const { error } = await supabase
        .from('team_coaches')
        .insert({
          team_id: teamId,
          coach_id: coachId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-coaches'] });
      toast.success('Treinador associado à equipa!');
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Código copiado!');
  };

  const handleInvite = () => {
    if (inviteMethod === 'email' && !inviteEmail) {
      toast.error('Insira um email');
      return;
    }
    createInvitation.mutate(inviteMethod);
  };

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
            <p className="text-muted-foreground">Gerir os treinadores do seu clube</p>
          </div>
          
          <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
            setInviteDialogOpen(open);
            if (!open) {
              setGeneratedCode(null);
              setInviteEmail('');
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Convidar Treinador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Treinador</DialogTitle>
                <DialogDescription>
                  Envie um convite por email ou gere um código para o treinador usar no registo.
                </DialogDescription>
              </DialogHeader>
              
              {!generatedCode ? (
                <div className="space-y-4">
                  <Tabs value={inviteMethod} onValueChange={(v) => setInviteMethod(v as 'email' | 'code')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="email">
                        <Mail className="w-4 h-4 mr-2" />
                        Por Email
                      </TabsTrigger>
                      <TabsTrigger value="code">
                        <Key className="w-4 h-4 mr-2" />
                        Por Código
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="email" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Email do Treinador</Label>
                        <Input
                          type="email"
                          placeholder="treinador@email.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="code" className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Será gerado um código único que o treinador pode usar ao criar a conta.
                      </p>
                    </TabsContent>
                  </Tabs>
                  
                  <Button 
                    onClick={handleInvite} 
                    className="w-full"
                    disabled={createInvitation.isPending}
                  >
                    {inviteMethod === 'email' ? 'Enviar Convite' : 'Gerar Código'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-secondary rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-2">Código de Convite</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-mono font-bold tracking-wider">
                        {generatedCode}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => copyToClipboard(generatedCode)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Partilhe este código com o treinador. O código expira em 7 dias.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setInviteDialogOpen(false)}
                  >
                    Fechar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Pending Invitations */}
        {invitations && invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Convites Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invitations.map((invitation) => (
                  <div 
                    key={invitation.id}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {invitation.email ? (
                        <>
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{invitation.email}</span>
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono">{invitation.invite_code}</span>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(invitation.invite_code!)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteInvitation.mutate(invitation.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                          <Badge key={team.id} variant="secondary" className="text-xs">
                            {team.name}
                          </Badge>
                        ))}
                        {(!coach.teams || coach.teams.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">
                            Sem equipas atribuídas
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
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
                          if (confirm('Tem a certeza que pretende remover este treinador?')) {
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
              <DialogTitle>Atribuir Equipa</DialogTitle>
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
