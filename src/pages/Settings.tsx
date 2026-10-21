import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BackupCard } from '@/components/settings/BackupCard';
import { DeleteAccountCard } from '@/components/settings/DeleteAccountCard';
import { isNativeApp } from '@/lib/native-files';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, User, Lock, Save, Settings as SettingsIcon, Languages } from 'lucide-react';
import { PageLoading } from '@/components/ui/page-states';
import { useSportScope } from '@/hooks/useSportScope';
import { SPORT_SCOPE_LABELS, type SportScope } from '@/lib/sport-scope';
import { languages, READY_LANGUAGES } from '@/lib/i18n';
import { useT, tx } from '@/lib/i18n/ui';

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const { i18n } = useTranslation();
  const { scope: sportScope, setScope: setSportScope } = useSportScope();
  const changeSportScope = async (v: SportScope) => {
    try { await setSportScope(v); toast.success(t('Modalidade: {{name}}', { name: t(SPORT_SCOPE_LABELS[v]) })); }
    catch { toast.error(t('Não foi possível mudar a modalidade')); }
  };
  // the app's language: kept on this device and in the account (so it follows the person)
  const currentLang = (i18n.language || 'pt').slice(0, 2);
  const changeLanguage = async (code: string) => {
    if (code === currentLang) return;
    await i18n.changeLanguage(code);
    try { localStorage.setItem('language', code); } catch { /* private mode */ }
    document.documentElement.lang = code;
    if (user) await supabase.from('profiles').update({ language: code }).eq('id', user.id);
    toast.success(`✓ ${languages.find((l) => l.code === code)?.name ?? code}`);
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
    if (username.length < 3) { toast.error(t('Username deve ter pelo menos 3 caracteres')); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { toast.error(t('Username só pode conter letras, números e underscore')); return; }
    setSaving(true);
    try {
      const { data: existingUsername } = await supabase
        .from('profiles').select('id').eq('username', username.toLowerCase()).neq('id', user.id).maybeSingle();
      if (existingUsername) { toast.error(t('Este username já está em uso')); setSaving(false); return; }
      const { error } = await supabase
        .from('profiles').update({ display_name: displayName, username: username.toLowerCase() }).eq('id', user.id);
      if (error) throw error;
      toast.success(t('Perfil atualizado com sucesso!'));
    } catch (error: any) {
      toast.error(t('Erro ao atualizar perfil: {{msg}}', { msg: error.message }));
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error(t('A nova password deve ter pelo menos 6 caracteres')); return; }
    if (newPassword !== confirmPassword) { toast.error(t('As passwords não coincidem')); return; }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t('Password alterada com sucesso!'));
      setNewPassword(''); setConfirmPassword('');
    } catch (error: any) {
      toast.error(t('Erro ao alterar password: {{msg}}', { msg: error.message }));
    } finally { setChangingPassword(false); }
  };

  if (authLoading || loading) {
    return (
      <AppLayout title={t('Definições')}>
        <PageLoading />
      </AppLayout>
    );
  }

  if (!user) return null;

  return (
    <AppLayout title={t('Definições')}>
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title={t('Definições da Conta')}
          description={t('Gerir o seu perfil e segurança')}
          icon={<SettingsIcon className="w-6 h-6 text-primary" />}
        />

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              <span>{t('Perfil')}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="w-4 h-4" />
              <span>{t('Segurança')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-base">{t('Informações do Perfil')}</CardTitle>
                <CardDescription>{t('Atualize o seu nome e username')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t('Nome')}</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('O seu nome')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{tx('Username')}</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="username" />
                  <p className="text-xs text-muted-foreground">{t('Só letras, números e underscore. Mínimo 3 caracteres.')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{tx('Email')}</Label>
                  <Input value={user.email || ''} disabled className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">{t('O email não pode ser alterado')}</p>
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} size="sm">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  {t('Guardar Alterações')}
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-4 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-base"><Languages className="h-4 w-4" />{t('Idioma')}</CardTitle>
                <CardDescription>{t('O idioma da aplicação neste dispositivo e na sua conta.')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {languages.filter((l) => (READY_LANGUAGES as readonly string[]).includes(l.code)).map((l) => (
                    <Button key={l.code} variant={currentLang === l.code ? 'default' : 'outline'} onClick={() => changeLanguage(l.code)} lang={l.code}>
                      <span className="mr-1.5">{l.flag}</span>{l.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {!isNativeApp() && <Card className="mt-4 border-border/50">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{t('Instalar a app')}</p>
                  <p className="text-xs text-muted-foreground">{t('iPhone, Android ou computador — passo a passo.')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/instalar')}>{t('Como instalar')}</Button>
              </CardContent>
            </Card>}

            <Card className="mt-4 border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-base">{t('Modalidade')}</CardTitle>
                <CardDescription>
                  {t('Futebol e futsal são separados: só vê a modalidade com que trabalha (equipas, táticas, exercícios e jogos).')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(['football', 'futsal', 'both'] as SportScope[]).map((v) => (
                    <Button key={v} variant={sportScope === v ? 'default' : 'outline'} onClick={() => changeSportScope(v)}>
                      {t(SPORT_SCOPE_LABELS[v])}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-display text-base">{t('Alterar Password')}</CardTitle>
                <CardDescription>{t('Defina uma nova password para a sua conta')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('Nova Password')}</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('Confirmar Nova Password')}</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <Button onClick={handleChangePassword} disabled={changingPassword} size="sm">
                  {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Lock className="w-4 h-4 mr-2" />
                  {t('Alterar Password')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* the club's / coach's data is theirs: take a copy, or move it to another database */}
        <BackupCard />
        <DeleteAccountCard />
        <p className="text-center text-xs text-muted-foreground"><a href="/privacidade" className="hover:underline">{t('Política de privacidade')}</a></p>
      </div>
    </AppLayout>
  );
}
