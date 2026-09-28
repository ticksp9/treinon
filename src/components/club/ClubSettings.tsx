import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, UserPlus, Trash2, Crown, Users } from 'lucide-react';

interface ClubSettingsProps {
  clubId: string;
}

export function ClubSettings({ clubId }: ClubSettingsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addAdminDialog, setAddAdminDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Fetch club owner
  const { data: club } = useQuery({
    queryKey: ['club', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clubs')
        .select('owner_id')
        .eq('id', clubId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  // Fetch club staff with admin role
  const { data: admins, isLoading: adminsLoading } = useQuery({
    queryKey: ['club-admins', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('club_staff')
        .select('*')
        .eq('club_id', clubId)
        .eq('role', 'admin')
        .eq('is_active', true);
      if (error) throw error;

      // Fetch profile info
      const adminsWithProfiles = await Promise.all(
        (data || []).map(async (admin) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', admin.user_id)
            .maybeSingle();
          return { ...admin, profile };
        })
      );

      return adminsWithProfiles;
    },
    enabled: !!clubId,
  });

  // Fetch owner profile
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', club?.owner_id],
    queryFn: async () => {
      if (!club?.owner_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', club.owner_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!club?.owner_id,
  });

  const addAdmin = useMutation({
    mutationFn: async (email: string) => {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error('Utilizador não encontrado com este email');
      }

      // Add as club staff with admin role
      const { error } = await supabase
        .from('club_staff')
        .insert({
          club_id: clubId,
          user_id: profile.id,
          name: email,
          role: 'admin',
          email: email,
          created_by: user?.id,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este utilizador já é membro do staff');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-admins', clubId] });
      toast.success('Administrador adicionado!');
      setAddAdminDialog(false);
      setNewAdminEmail('');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const removeAdmin = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from('club_staff')
        .update({ is_active: false })
        .eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-admins', clubId] });
      toast.success('Administrador removido');
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Administradores</CardTitle>
            </div>
            <Dialog open={addAdminDialog} onOpenChange={setAddAdminDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Administrador</DialogTitle>
                  <DialogDescription>
                    O utilizador deve já ter uma conta na aplicação.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email do utilizador</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => addAdmin.mutate(newAdminEmail)}
                    disabled={addAdmin.isPending || !newAdminEmail}
                  >
                    Adicionar Administrador
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Gerir quem pode administrar o clube
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Club Owner */}
            {ownerProfile && (
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Crown className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{ownerProfile.full_name || 'Proprietário'}</p>
                    <p className="text-sm text-muted-foreground">{ownerProfile.email}</p>
                  </div>
                </div>
                <Badge variant="default">Proprietário</Badge>
              </div>
            )}

            {/* Other Admins */}
            {adminsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : admins && admins.length > 0 ? (
              admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-secondary">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{admin.profile?.full_name || admin.name}</p>
                      <p className="text-sm text-muted-foreground">{admin.profile?.email || admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Admin</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeAdmin.mutate(admin.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum administrador adicional
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
