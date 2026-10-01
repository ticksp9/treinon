import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useValidateInvite, useAcceptInvite } from '@/hooks/useAccessInvites';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, Users, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Step = 'validating' | 'preview' | 'auth' | 'success' | 'error';

const INVITE_TYPE_LABELS: Record<string, string> = {
  guardian: 'Encarregado de Educação',
  player: 'Atleta',
  coach: 'Treinador',
  assistant_coach: 'Treinador Adjunto',
  coordinator: 'Coordenador',
  staff: 'Staff',
};

const INVITE_TYPE_DESCRIPTIONS: Record<string, string> = {
  guardian: 'Crie a sua conta de Encarregado de Educação para acompanhar o seu atleta.',
  player: 'Crie a sua conta de Atleta para aceder aos seus treinos, jogos e convocatórias.',
  coach: 'Crie a sua conta de Treinador para aceder à equipa e ferramentas de gestão.',
  assistant_coach: 'Crie a sua conta de Treinador Adjunto para colaborar com a equipa técnica.',
  staff: 'Crie a sua conta de Staff para aceder às ferramentas da equipa.',
};

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = searchParams.get('token');

  const [step, setStep] = useState<Step>('validating');
  const [manualCode, setManualCode] = useState('');
  const [codeToValidate, setCodeToValidate] = useState<string | null>(() => searchParams.get('code')?.toUpperCase() || null);

  // Auth form
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: validation, isLoading: validating } = useValidateInvite(
    token,
    codeToValidate
  );
  const acceptInvite = useAcceptInvite();

  const inviteType = validation?.invite_type || 'guardian';
  const inviteLabel = INVITE_TYPE_LABELS[inviteType] || inviteType;

  // When validation returns
  useEffect(() => {
    if (validating) {
      setStep('validating');
      return;
    }
    if (!token && !codeToValidate) return;
    if (validation) {
      if (validation.valid) {
        if (validation.email && !email) setEmail(validation.email);
        if (validation.recipient_name && !name) setName(validation.recipient_name);
        setStep('preview');
      } else {
        setErrorMsg(validation.error || 'Convite inválido');
        setStep('error');
      }
    }
  }, [validation, validating, token, codeToValidate]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.length >= 4) {
      setCodeToValidate(manualCode.toUpperCase());
    }
  };

  const handleAccept = async () => {
    if (!validation?.invite_id) return;

    if (!user) {
      setStep('auth');
      return;
    }

    try {
      // SECURITY: Only send invite_id — server derives user from auth token
      const result = await acceptInvite.mutateAsync({
        invite_id: validation.invite_id,
      });
      if (result.success) {
        setStep('success');
        toast.success('Convite aceite com sucesso!');
        setTimeout(() => navigate(result.redirect), 2000);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aceitar convite');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || !username) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (password.length < 6) {
      toast.error('A password deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);

    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: name, username },
      },
    });

    if (error) {
      setLoading(false);
      if (error.message.includes('User already registered')) {
        toast.error('Este email já está registado. Use a aba "Já tenho conta".');
      } else {
        toast.error(error.message);
      }
      return;
    }

    // After signup, try to get session and accept invite
    const { data: { session } } = await supabase.auth.getSession();
    if (session && validation?.invite_id) {
      try {
        // SECURITY: Only send invite_id
        const result = await acceptInvite.mutateAsync({
          invite_id: validation.invite_id,
        });
        setStep('success');
        toast.success('Conta criada e convite aceite!');
        setTimeout(() => navigate(result.redirect), 2000);
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      toast.success('Conta criada! Confirme o seu email e depois volte a abrir o link do convite.');
      setStep('success');
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }
    setLoading(true);

    const { data: { session }, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      if (error.message.includes('Email not confirmed')) {
        toast.error('Confirme o seu email antes de entrar.');
      } else {
        toast.error(error.message);
      }
      return;
    }

    if (session && validation?.invite_id) {
      try {
        // SECURITY: Only send invite_id
        const result = await acceptInvite.mutateAsync({
          invite_id: validation.invite_id,
        });
        setStep('success');
        toast.success('Convite aceite!');
        setTimeout(() => navigate(result.redirect), 2000);
      } catch (err: any) {
        toast.error(err.message);
      }
    }
    setLoading(false);
  };

  // Code entry screen (no token in URL)
  if (!token && !codeToValidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Inserir código de convite</CardTitle>
            <CardDescription>
              Introduza o código que recebeu para aceder à plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC123"
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={manualCode.length < 4}>
                Validar código
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login principal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (step === 'validating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">A validar convite...</p>
        </Card>
      </div>
    );
  }

  // Error
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <Shield className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle>Convite inválido</CardTitle>
            <CardDescription>{errorMsg}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Ir para o login principal
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Se o convite expirou, peça ao responsável para enviar um novo convite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold mt-4">Convite aceite!</h2>
          <p className="text-muted-foreground mt-2">A redirecionar para o portal...</p>
        </Card>
      </div>
    );
  }

  // Preview step
  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Convite recebido</CardTitle>
            <CardDescription>
              Está a ser convidado para aceder à plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Perfil</span>
                <Badge>{inviteLabel}</Badge>
              </div>
              {validation?.context_name && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {validation.scope_type === 'club' ? 'Clube' : 'Treinador'}
                  </span>
                  <span className="text-sm font-medium">{validation.context_name}</span>
                </div>
              )}
              {validation?.team_name && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Equipa</span>
                  <span className="text-sm font-medium">{validation.team_name}</span>
                </div>
              )}
              {validation?.player_name && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Atleta</span>
                  <span className="text-sm font-medium">{validation.player_name}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Convidado</span>
                <span className="text-sm font-medium">{validation?.recipient_name}</span>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                {inviteType === 'guardian'
                  ? 'Ao aceitar, terá acesso ao chat, calendário de jogos, treinos e convocatórias do(s) atleta(s) vinculado(s).'
                  : inviteType === 'player'
                  ? 'Ao aceitar, terá acesso ao chat, calendário, treinos e convocatórias da sua equipa.'
                  : 'Ao aceitar, terá acesso às ferramentas de gestão do contexto indicado.'}
              </AlertDescription>
            </Alert>

            <Button className="w-full" onClick={handleAccept} disabled={acceptInvite.isPending}>
              {acceptInvite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {user ? 'Aceitar convite' : 'Continuar'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Auth step — signup/login for invited users
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Criar conta ou entrar</CardTitle>
          <CardDescription>
            {INVITE_TYPE_DESCRIPTIONS[inviteType] || 'Crie a sua conta para continuar.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Perfil do convite</span>
            <Badge variant="secondary">{inviteLabel}</Badge>
          </div>

          <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              <TabsTrigger value="login">Já tenho conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Nome completo</Label>
                  <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-username">Username</Label>
                  <Input id="signup-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-pw">Password</Label>
                  <Input id="signup-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar conta e aceitar convite
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pw">Password</Label>
                  <Input id="login-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Entrar e aceitar convite
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <Button variant="ghost" className="w-full mt-3" onClick={() => setStep('preview')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
