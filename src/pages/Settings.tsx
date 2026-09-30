import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, User, Lock, Save, Settings as SettingsIcon } from 'lucide-react';
import { PageLoading } from '@/components/ui/page-states';
import { useSportScope } from '@/hooks/useSportScope';
import { SPORT_SCOPE_LABELS, type SportScope } from '@/lib/sport-scope';

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { scope: sportScope, setScope: setSportScope } = useSportScope();
  const changeSportScope = async (v: SportScope) => {
    try { await setSportScope(v); toast.success(`Modalidade: ${SPORT_SCOPE_LABELS[v]}`); }
    catch { toast.error('Não foi possível mudar a modalidade'); }
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, full_name')
        .eq('id', user!.id)
        .single();
      if (profile) {
        setDisplayName(profile.display_name || profile.full_name || '');
        setUsername(profile.username || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (username.length < 3) { toast.error('Username deve ter pelo menos 3 caracteres'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { toast.error('Username só pode conter letras, números e underscore'); return; }
    setSaving(true);
    try {
      const { data: existingUsername } = await supabase
        .from('profiles').select('id').eq('username', username.toLowerCase()).neq('id', user.id).maybeSingle();
      if (existingUsername) { toast.error('Este username já está em uso'); setSaving(false); return; }
      const { error } = await supabase
        .from('profiles').update({ display_name: displayName, username: username.toLowerCase() }).eq('id', user.id);
      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar perfil: ' + error.message);
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('A nova password deve ter pelo menos 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { toast.error('As passwords não coincidem'); return; }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password alterada com sucesso!');
      setNewPassword(''); setConfirmPassword('');
    } catch (error: any) {
      toast.error('Erro ao alterar password: ' + error.message);
    } finally { setChangingPassword(false); }
  };

  if (authLoading || loading) {
    return (
      <AppLayout title="Definições">
        <PageLoading />
      </AppLayout>
    );
  }

  if (!user) return null;

  return (
    <AppLayout title="Definições">
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Definições da Conta"
          description="Gerir o seu perfil e segurança"
          icon={<SettingsIcon className="w-6 h-6 text-primary" />}
        />

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-base">Informações do Perfil</CardTitle>
                <CardDescription>Atualize o seu nome e username</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="O seu nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="username" />
                  <p className="text-xs text-muted-foreground">Só letras, números e underscore. Mínimo 3 caracteres.</p>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user.email || ''} disabled className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} size="sm">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-4 border-border/50">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">Instalar a app</p>
                  <p className="text-xs text-muted-foreground">iPhone, Android ou computador — passo a passo.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/instalar')}>Como instalar</Button>
              </CardContent>
            </Card>

            <Card className="mt-4 border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-base">Modalidade</CardTitle>
                <CardDescription>
                  Futebol e futsal são separados: só vê a modalidade com que trabalha (equipas, táticas, exercícios e jogos).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {(['football', 'futsal', 'both'] as SportScope[]).map((v) => (
                    <Button key={v} variant={sportScope === v ? 'default' : 'outline'} onClick={() => changeSportScope(v)}>
                      {SPORT_SCOPE_LABELS[v]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-base">Alterar Password</CardTitle>
                <CardDescription>Defina uma nova password para a sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Password</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <Button onClick={handleChangePassword} disabled={changingPassword} size="sm">
                  {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Lock className="w-4 h-4 mr-2" />
                  Alterar Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
