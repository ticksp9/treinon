import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Zap, Users, Calendar, Building2, User, Mail, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import { scopeFromModalities } from '@/lib/sport-scope';

const loginSchema = z.object({
  identifier: z.string().min(3, 'Email ou username inválido'),
  password: z.string().min(6, 'A password deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  username: z.string().min(3, 'Username deve ter pelo menos 3 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Username só pode conter letras, números e underscore'),
  password: z.string().min(6, 'A password deve ter pelo menos 6 caracteres'),
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code');
  
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<'individual_coach' | 'club'>('individual_coach');
  const [preferredSport, setPreferredSport] = useState<'football' | 'futsal' | 'both'>('football');
  const [clubModalities, setClubModalities] = useState<string[]>(['football']);
  const [coachInviteCode, setCoachInviteCode] = useState(inviteCode || '');
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showEmailNotConfirmed, setShowEmailNotConfirmed] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const { signIn, signInWithUsername, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Check if this is a password reset redirect
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    if (type === 'recovery') {
      setShowResetPassword(true);
    }
  }, []);

  // Same-origin relative path to return to after auth (e.g. OAuth consent flow)
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;

  useEffect(() => {
    if (user) {
      // Redirect based on account type stored in user metadata or default to dashboard
      // The actual role-aware redirect happens via useUserRole in the destination pages
      navigate(nextPath ?? '/dashboard');
    }
  }, [user, navigate, nextPath]);

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResendingEmail(true);
    try {
      const { error } = unconfirmedEmail.includes('@')
        ? await supabase.auth.resend({
            type: 'signup',
            email: unconfirmedEmail,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
            },
          })
        : await supabase.functions.invoke('auth-lookup', {
            body: {
              action: 'resend_confirmation',
              username: unconfirmedEmail.toLowerCase(),
              redirect_to: `${window.location.origin}/`,
            },
          });
      if (error) {
        toast.error('Erro ao reenviar email: ' + error.message);
      } else {
        toast.success('Email de confirmação reenviado!');
      }
    } catch (err) {
      toast.error('Erro ao reenviar email');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast.error('Insira o seu email');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/auth#type=recovery`,
      });
      if (error) {
        toast.error('Erro: ' + error.message);
      } else {
        toast.success('Email de recuperação enviado! Verifique a sua caixa de correio.');
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      }
    } catch (err) {
      toast.error('Erro ao enviar email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('A password deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As passwords não coincidem');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error('Erro: ' + error.message);
      } else {
        toast.success('Password alterada com sucesso!');
        setShowResetPassword(false);
        window.location.hash = '';
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error('Erro ao alterar password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowEmailNotConfirmed(false);
    
    try {
      loginSchema.parse({ identifier, password });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setLoading(true);
    
    const isEmail = identifier.includes('@');
    let error;

    if (isEmail) {
      const result = await signIn(identifier, password);
      error = result.error;
    } else {
      const result = await signInWithUsername(identifier, password);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setShowEmailNotConfirmed(true);
        // Email or username; for usernames the server resends without revealing the address
        setUnconfirmedEmail(identifier.trim());
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('Credenciais inválidas. Verifique o email/username e password.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Bem-vindo de volta!');
      navigate(nextPath ?? '/dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      signupSchema.parse({ email, username, password, name });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setLoading(true);

    // Check if username already exists via secure edge function
    try {
      const { data: usernameCheck } = await supabase.functions.invoke('auth-lookup', {
        body: { action: 'check_username', username: username.toLowerCase() },
      });
      if (usernameCheck?.exists) {
        setLoading(false);
        toast.error('Este username já está em uso. Escolha outro.');
        return;
      }
    } catch {
      // If edge function fails, proceed — Supabase will catch duplicates
    }

    // Check if email already exists via secure edge function
    try {
      const { data: emailCheck } = await supabase.functions.invoke('auth-lookup', {
        body: { action: 'check_email', email: email.toLowerCase() },
      });
      if (emailCheck?.exists) {
        setLoading(false);
        toast.error('Este email já está registado. Tente fazer login.');
        return;
      }
    } catch {
      // If edge function fails, proceed — Supabase will catch duplicates
    }

    // If coach with invite code, validate the code first
    if (accountType === 'individual_coach' && coachInviteCode) {
      const { data: invitation, error: invError } = await supabase
        .from('club_coach_invitations')
        .select('*')
        .eq('invite_code', coachInviteCode.toUpperCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (invError || !invitation) {
        setLoading(false);
        toast.error('Código de convite inválido ou expirado');
        return;
      }

      if (new Date(invitation.expires_at) < new Date()) {
        setLoading(false);
        toast.error('O código de convite expirou');
        return;
      }
    }

    // For clubs, use name as display_name; for coaches, use full name
    const displayName = name;
    const fullNameToSave = accountType === 'club' ? '' : name;

    const { error } = await signUp(email, password, fullNameToSave, username);
    
    if (error) {
      setLoading(false);
      if (error.message.includes('User already registered')) {
        toast.error('Este email já está registado. Tente fazer login.');
      } else if (error.message.includes('username') || error.message.includes('duplicate')) {
        toast.error('Este username já está em uso. Escolha outro.');
      } else if (error.message.includes('Database error')) {
        toast.error('Erro ao criar conta. Verifique se o username e email são únicos.');
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Update profile with account type, preferred sport and display_name
    const { data: { user: newUser } } = await supabase.auth.getUser();
    if (newUser) {
      await supabase
        .from('profiles')
        .update({ 
          account_type: accountType,
          preferred_sport: accountType === 'club' ? scopeFromModalities(clubModalities) : preferredSport,
          display_name: displayName,
        })
        .eq('id', newUser.id);

      // If registering as a club, create the club and add user as admin
      if (accountType === 'club') {
        // Ensure at least one modality is selected
        const modalitiesToSave = clubModalities.length > 0 ? clubModalities : ['football'];
        
        const { data: newClub, error: clubError } = await supabase
          .from('clubs')
          .insert({
            name: displayName, // Club name
            owner_id: newUser.id,
            modalities: modalitiesToSave,
          })
          .select('id')
          .single();

        if (newClub && !clubError) {
          // Add the owner as club staff with admin role
          await supabase
            .from('club_staff')
            .insert({
              club_id: newClub.id,
              user_id: newUser.id,
              name: displayName,
              role: 'admin',
              email: email,
            });
        } else {
          console.error('Error creating club:', clubError);
        }
      } else if (accountType === 'individual_coach' && coachInviteCode) {
        // If coach with invite code, accept the invitation
        const { data: invitation } = await supabase
          .from('club_coach_invitations')
          .select('id, club_id')
          .eq('invite_code', coachInviteCode.toUpperCase())
          .eq('status', 'pending')
          .maybeSingle();

        if (invitation) {
          // Mark invitation as accepted
          await supabase
            .from('club_coach_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitation.id);

          // Add coach to club
          await supabase
            .from('club_coaches')
            .insert({
              club_id: invitation.club_id,
              coach_id: newUser.id,
            });
        }
      }
    }

    setLoading(false);
    // Show signup success message instead of navigating
    setSignupSuccess(true);
  };

  // Signup success view
  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl font-display">Conta criada com sucesso!</CardTitle>
            <CardDescription className="text-base mt-2">
              Confirme o seu email para entrar. Enviámos um email de confirmação para <strong>{email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Verifique a sua caixa de correio (e a pasta de spam) e clique no link de confirmação.
              </AlertDescription>
            </Alert>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setSignupSuccess(false);
                setEmail('');
                setPassword('');
                setName('');
                setUsername('');
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-display">Recuperar palavra-passe</CardTitle>
            <CardDescription>
              Insira o seu email para receber um link de recuperação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail">Email</Label>
                <Input
                  id="forgotEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar email de recuperação
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reset password view
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-display">Definir nova palavra-passe</CardTitle>
            <CardDescription>
              Escolha uma nova palavra-passe para a sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSelector variant="outline" size="sm" />
        </div>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Zap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold gradient-text">TreinON</h1>
          <p className="text-muted-foreground mt-2">Gestão inteligente de futebol & futsal</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-display">Aceder à conta</CardTitle>
            <CardDescription>
              Entre ou crie uma conta para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={searchParams.get('tab') === 'signup' ? 'signup' : 'signin'} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Registar</TabsTrigger>
              </TabsList>

              {/* Hint for invited users */}
              <Alert className="mb-4 border-primary/20 bg-primary/5">
                <AlertDescription className="text-xs text-muted-foreground">
                  Se recebeu um convite para entrar como encarregado, atleta, treinador ou staff, use o link ou código enviado para criar a sua conta.{' '}
                  <button 
                    type="button" 
                    onClick={() => navigate('/accept-invite/code')} 
                    className="text-primary font-medium hover:underline"
                  >
                    Inserir código de convite
                  </button>
                </AlertDescription>
              </Alert>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  {showEmailNotConfirmed && (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <Mail className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700">
                        <div className="flex flex-col gap-3">
                          <span className="font-medium">Confirma o teu email para entrares</span>
                          <p className="text-sm">Verifique a sua caixa de correio (e a pasta de spam) e clique no link de confirmação.</p>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            onClick={handleResendConfirmation}
                            disabled={resendingEmail}
                            className="w-full sm:w-auto"
                          >
                            {resendingEmail && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            Reenviar email
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="identifier">Email ou Username</Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="seu@email.com ou username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password">Password</Label>
                      <button 
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Esqueci-me da palavra-passe
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-3">
                    <Label>Tipo de Conta</Label>
                    <RadioGroup 
                      value={accountType} 
                      onValueChange={(v) => setAccountType(v as 'individual_coach' | 'club')}
                      className="grid grid-cols-2 gap-3"
                    >
                      <Label
                        htmlFor="coach"
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          accountType === 'individual_coach' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value="individual_coach" id="coach" className="sr-only" />
                        <User className="w-6 h-6" />
                        <span className="text-sm font-medium">Treinador</span>
                      </Label>
                      <Label
                        htmlFor="club"
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          accountType === 'club' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value="club" id="club" className="sr-only" />
                        <Building2 className="w-6 h-6" />
                        <span className="text-sm font-medium">Clube</span>
                      </Label>
                    </RadioGroup>
                  </div>

                  {accountType === 'individual_coach' ? (
                    <div className="space-y-3">
                      <Label>Modalidade Principal</Label>
                      <RadioGroup 
                        value={preferredSport} 
                        onValueChange={(v) => setPreferredSport(v as 'football' | 'futsal' | 'both')}
                        className="grid grid-cols-3 gap-2"
                      >
                        <Label
                          htmlFor="football"
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            preferredSport === 'football' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value="football" id="football" className="sr-only" />
                          <span className="text-2xl">⚽</span>
                          <span className="text-sm font-medium">Futebol</span>
                          <span className="text-xs text-muted-foreground">5, 7, 9 ou 11</span>
                        </Label>
                        <Label
                          htmlFor="futsal"
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            preferredSport === 'futsal' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value="futsal" id="futsal" className="sr-only" />
                          <span className="text-2xl">🏐</span>
                          <span className="text-sm font-medium">Futsal</span>
                          <span className="text-xs text-muted-foreground">5 jogadores</span>
                        </Label>
                        <Label
                          htmlFor="both"
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            preferredSport === 'both'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value="both" id="both" className="sr-only" />
                          <span className="text-2xl">⚽🏐</span>
                          <span className="text-sm font-medium">Os dois</span>
                          <span className="text-xs text-muted-foreground">Futebol e futsal</span>
                        </Label>
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        Só verá a modalidade que escolher. Pode mudar depois nas Definições.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label>Modalidades do Clube</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            clubModalities.includes('football') 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <Checkbox
                            checked={clubModalities.includes('football')}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setClubModalities([...clubModalities, 'football']);
                              } else {
                                // Don't allow unchecking if it's the only one
                                if (clubModalities.length > 1) {
                                  setClubModalities(clubModalities.filter(m => m !== 'football'));
                                }
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-2xl">⚽</span>
                          <span className="text-sm font-medium">Futebol</span>
                          <span className="text-xs text-muted-foreground">5, 7, 9 ou 11</span>
                        </label>
                        <label
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            clubModalities.includes('futsal') 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <Checkbox
                            checked={clubModalities.includes('futsal')}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setClubModalities([...clubModalities, 'futsal']);
                              } else {
                                // Don't allow unchecking if it's the only one
                                if (clubModalities.length > 1) {
                                  setClubModalities(clubModalities.filter(m => m !== 'futsal'));
                                }
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-2xl">🏐</span>
                          <span className="text-sm font-medium">Futsal</span>
                          <span className="text-xs text-muted-foreground">5 jogadores</span>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selecione uma ou ambas as modalidades para o seu clube
                      </p>
                    </div>
                  )}

                  {accountType === 'individual_coach' && (
                    <div className="space-y-2">
                      <Label htmlFor="inviteCode">Código de Convite (opcional)</Label>
                      <Input
                        id="inviteCode"
                        type="text"
                        placeholder="ABC123"
                        value={coachInviteCode}
                        onChange={(e) => setCoachInviteCode(e.target.value.toUpperCase())}
                        className="font-mono uppercase"
                      />
                      <p className="text-xs text-muted-foreground">
                        Se foi convidado por um clube, insira o código aqui
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name">
                      {accountType === 'club' ? 'Nome do Clube' : 'Nome completo'}
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder={accountType === 'club' ? 'FC Exemplo' : 'João Silva'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupUsername">Username</Label>
                    <Input
                      id="signupUsername"
                      type="text"
                      placeholder="joaosilva"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email</Label>
                    <Input
                      id="signupEmail"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Password</Label>
                    <Input
                      id="signupPassword"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <Users className="w-6 h-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Gestão de Jogadores</p>
          </div>
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <Calendar className="w-6 h-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Treinos & Jogos</p>
          </div>
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <Zap className="w-6 h-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Estatísticas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
