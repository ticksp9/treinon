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
import { tx } from '@/lib/i18n/ui';

type Step = 'validating' | 'preview' | 'auth' | 'success' | 'error';

const INVITE_TYPE_LABELS: Record<string, string> = {
  get guardian() { return tx('Encarregado de Educação'); },
  get player() { return tx('Atleta'); },
  coach: 'Treinador',
  assistant_coach: 'Treinador Adjunto',
  coordinator: 'Coordenador',
  get staff() { return tx('Staff'); },
};

const INVITE_TYPE_DESCRIPTIONS: Record<string, string> = {
  get guardian() { return tx('Crie a sua conta de Encarregado de Educação para acompanhar o seu atleta.'); },
  get player() { return tx('Crie a sua conta de Atleta para aceder aos seus treinos, jogos e convocatórias.'); },
  get coach() { return tx('Crie a sua conta de Treinador para aceder à equipa e ferramentas de gestão.'); },
  get assistant_coach() { return tx('Crie a sua conta de Treinador Adjunto para colaborar com a equipa técnica.'); },
  get staff() { return tx('Crie a sua conta de Staff para aceder às ferramentas da equipa.'); },
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
        setErrorMsg(validation.error || tx('Convite inválido'));
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
        toast.success(tx('Convite aceite com sucesso!'));
        setTimeout(() => navigate(result.redirect), 2000);
      }
    } catch (err: any) {
      toast.error(err.message || tx('Erro ao aceitar convite'));
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || !username) {
      toast.error(tx('Preencha todos os campos'));
      return;
    }
    if (password.length < 6) {
      toast.error(tx('A password deve ter pelo menos 6 caracteres'));
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
        toast.error(tx('Este email já está registado. Use a aba "Já tenho conta".'));
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
        toast.success(tx('Conta criada e convite aceite!'));
        setTimeout(() => navigate(result.redirect), 2000);
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      toast.success(tx('Conta criada! Confirme o seu email e depois volte a abrir o link do convite.'));
      setStep('success');
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(tx('Preencha todos os campos'));
      return;
    }
    setLoading(true);

    const { data: { session }, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      if (error.message.includes('Email not confirmed')) {
        toast.error(tx('Confirme o seu email antes de entrar.'));
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
        toast.success(tx('Convite aceite!'));
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
            <CardTitle>{tx('Inserir código de convite')}</CardTitle>
            <CardDescription>
              {tx('Introduza o código que recebeu para aceder à plataforma')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">{tx('Código')}</Label>
                <Input
                  id="code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder={tx('Ex: ABC123')}
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={manualCode.length < 4}>
                {tx('Validar código')}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> {tx('Voltar ao login principal')}
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
          <p className="mt-4 text-muted-foreground">{tx('A validar convite...')}</p>
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
            <CardTitle>{tx('Convite inválido')}</CardTitle>
            <CardDescription>{errorMsg}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> {tx('Ir para o login principal')}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {tx('Se o convite expirou, peça ao responsável para enviar um novo convite.')}
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
          <h2 className="text-xl font-bold mt-4">{tx('Convite aceite!')}</h2>
          <p className="text-muted-foreground mt-2">{tx('A redirecionar para o portal...')}</p>
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
            <CardTitle>{tx('Convite recebido')}</CardTitle>
            <CardDescription>
              {tx('Está a ser convidado para aceder à plataforma')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{tx('Perfil')}</span>
                <Badge>{inviteLabel}</Badge>
              </div>
              {validation?.context_name && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {validation.scope_type === 'club' ? tx('Clube') : tx('Treinador')}
                  </span>
                  <span className="text-sm font-medium">{validation.context_name}</span>
                </div>
              )}
              {validation?.team_name && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{tx('Equipa')}</span>
                  <span className="text-sm font-medium">{validation.team_name}</span>
                </div>
              )}
              {validation?.player_name && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{tx('Atleta')}</span>
                  <span className="text-sm font-medium">{validation.player_name}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{tx('Convidado')}</span>
                <span className="text-sm font-medium">{validation?.recipient_name}</span>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                {inviteType === 'guardian'
                  ? tx('Ao aceitar, terá acesso ao chat, calendário de jogos, treinos e convocatórias do(s) atleta(s) vinculado(s).')
                  : inviteType === 'player'
                  ? tx('Ao aceitar, terá acesso ao chat, calendário, treinos e convocatórias da sua equipa.')
                  : tx('Ao aceitar, terá acesso às ferramentas de gestão do contexto indicado.')}
              </AlertDescription>
            </Alert>

            <Button className="w-full" onClick={handleAccept} disabled={acceptInvite.isPending}>
              {acceptInvite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {user ? tx('Aceitar convite') : tx('Continuar')}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> {tx('Cancelar')}
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
          <CardTitle>{tx('Criar conta ou entrar')}</CardTitle>
          <CardDescription>
            {INVITE_TYPE_DESCRIPTIONS[inviteType] || tx('Crie a sua conta para continuar.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{tx('Perfil do convite')}</span>
            <Badge variant="secondary">{inviteLabel}</Badge>
          </div>

          <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">{tx('Criar Conta')}</TabsTrigger>
              <TabsTrigger value="login">{tx('Já tenho conta')}</TabsTrigger>
            </TabsList>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">{tx('Nome completo')}</Label>
                  <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-username">{tx('Username')}</Label>
                  <Input id="signup-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">{tx('Email')}</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-pw">{tx('Password')}</Label>
                  <Input id="signup-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {tx('Criar conta e aceitar convite')}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">{tx('Email')}</Label>
                  <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pw">{tx('Password')}</Label>
                  <Input id="login-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {tx('Entrar e aceitar convite')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <Button variant="ghost" className="w-full mt-3" onClick={() => setStep('preview')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {tx('Voltar')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
