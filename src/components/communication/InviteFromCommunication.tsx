import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCreateInvite } from '@/hooks/useAccessInvites';
import { useSendInvite } from '@/hooks/useInviteDelivery';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Copy, UserPlus, Mail, Phone, MessageCircle, Send, Eye } from 'lucide-react';
import { renderTemplate, validateTemplateContext, PROFILE_LABELS, CHANNEL_LABELS, type TemplateContext } from '@/lib/invite-templates';

type InviteType = 'guardian' | 'player' | 'coach' | 'assistant_coach' | 'staff';

const TYPE_DESCRIPTIONS: Record<InviteType, string> = {
  guardian: 'Envie um convite ao encarregado de educação de um atleta',
  player: 'Envie um convite para o atleta aceder à plataforma',
  coach: 'Envie um convite para um treinador se associar à equipa',
  assistant_coach: 'Envie um convite para um treinador adjunto',
  staff: 'Envie um convite para um membro do staff',
};

const REQUIRES_PLAYER: Record<InviteType, boolean> = {
  guardian: true, player: true, coach: false, assistant_coach: false, staff: false,
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail, sms: Phone, whatsapp: MessageCircle,
};

interface Props {
  inviteType: InviteType;
  open: boolean;
  onClose: () => void;
}

export function InviteFromCommunication({ inviteType, open, onClose }: Props) {
  const { user } = useAuth();
  const { clubId } = useUserRole();

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set(['email']));
  const [showPreview, setShowPreview] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<string>('email');
  const [result, setResult] = useState<{ token: string; code: string; inviteId: string } | null>(null);
  const [sending, setSending] = useState(false);

  const createInvite = useCreateInvite();
  const sendInvite = useSendInvite();
  const scopeType = clubId ? 'club' : 'coach';
  const needsPlayer = REQUIRES_PLAYER[inviteType];

  const { data: teams = [] } = useQuery({
    queryKey: ['invite-teams', clubId, user?.id],
    queryFn: async () => {
      if (clubId) {
        const { data } = await supabase.from('teams').select('id, name, category').eq('club_id', clubId).order('name');
        return data || [];
      }
      if (user?.id) {
        const { data } = await supabase.from('teams').select('id, name, category').eq('owner_id', user.id).is('club_id', null).order('name');
        return data || [];
      }
      return [];
    },
    enabled: open && !!user,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['invite-players', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      const { data } = await supabase.from('players').select('id, name, number').eq('team_id', selectedTeamId).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!selectedTeamId && needsPlayer,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['invite-templates-all', inviteType],
    queryFn: async () => {
      const { data } = await supabase
        .from('invite_templates')
        .select('*')
        .eq('profile_type', inviteType)
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      return data || [];
    },
    enabled: open,
  });

  const selectedTeam = teams.find((t: any) => t.id === selectedTeamId);
  const selectedPlayer = players.find((p: any) => p.id === selectedPlayerId);

  const templateContext: TemplateContext = useMemo(() => ({
    recipient_name: recipientName || '[Nome]',
    app_name: 'TreinON',
    team_name: selectedTeam?.name || '[Equipa]',
    age_group: selectedTeam?.category || '',
    player_name: selectedPlayer?.name || '',
    inviter_name: user?.user_metadata?.full_name || 'Equipa Técnica',
    invite_link: '[link será gerado]',
    invite_code: '[código será gerado]',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
    profile_label: PROFILE_LABELS[inviteType] || inviteType,
  }), [recipientName, selectedTeam, selectedPlayer, user, inviteType]);

  const previewTemplate = useMemo(() => {
    const tpl = templates.find((t: any) => t.delivery_channel === previewChannel);
    if (!tpl) return { subject: '', body: 'Sem template configurado para este canal.' };
    return {
      subject: tpl.subject_template ? renderTemplate(tpl.subject_template, templateContext) : '',
      body: renderTemplate(tpl.body_template, templateContext),
    };
  }, [templates, previewChannel, templateContext]);

  const toggleChannel = (ch: string) => {
    const next = new Set(selectedChannels);
    if (next.has(ch)) next.delete(ch);
    else next.add(ch);
    setSelectedChannels(next);
  };

  const channelErrors = useMemo(() => {
    const errs: string[] = [];
    if (selectedChannels.has('email') && !email.trim()) errs.push('Email obrigatório para envio por Email');
    if (selectedChannels.has('sms') && !phone.trim()) errs.push('Telefone obrigatório para envio por SMS');
    if (selectedChannels.has('whatsapp') && !phone.trim()) errs.push('Telefone obrigatório para envio por WhatsApp');
    return errs;
  }, [selectedChannels, email, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) { toast.error('Selecione uma equipa'); return; }
    if (needsPlayer && !selectedPlayerId) { toast.error('Selecione um atleta'); return; }
    if (!recipientName.trim()) { toast.error('Indique o nome do convidado'); return; }
    if (selectedChannels.size === 0) { toast.error('Selecione pelo menos um canal de envio'); return; }
    if (channelErrors.length > 0) { toast.error(channelErrors[0]); return; }

    setSending(true);
    try {
      // Step 1: Create invite
      const invData = await createInvite.mutateAsync({
        team_id: selectedTeamId,
        player_id: needsPlayer ? selectedPlayerId : undefined,
        invite_type: inviteType as 'guardian' | 'player',
        recipient_name: recipientName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        // SECURITY: scope_type, club_id, owner_coach_id derived server-side
      });

      const inviteLink = `${window.location.origin}/accept-invite?token=${invData.token}`;

      // Step 2: Send via selected channels
      const channelsArr = [...selectedChannels] as ('email' | 'sms' | 'whatsapp')[];
      try {
        await sendInvite.mutateAsync({
          invite_id: invData.invite_id,
          channels: channelsArr,
          context: {
            invite_token: invData.token,
            invite_link: inviteLink,
            base_url: window.location.origin,
          },
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        toast.success('Convite criado e enviado!');
      } catch (sendErr: any) {
        console.warn('Send failed but invite created:', sendErr);
        toast.warning('Convite criado mas envio automático falhou. Pode copiar o link manualmente.');
      }

      setResult({ token: invData.token, code: invData.code, inviteId: invData.invite_id });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar convite');
    } finally {
      setSending(false);
    }
  };

  const inviteLink = result ? `${window.location.origin}/accept-invite?token=${result.token}` : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const handleClose = () => {
    onClose();
    setResult(null);
    setRecipientName('');
    setEmail('');
    setPhone('');
    setSelectedTeamId('');
    setSelectedPlayerId('');
    setSelectedChannels(new Set(['email']));
    setShowPreview(false);
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar {PROFILE_LABELS[inviteType]}
          </DialogTitle>
          <DialogDescription>{TYPE_DESCRIPTIONS[inviteType]}</DialogDescription>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Team selection */}
            <div className="space-y-2">
              <Label>Equipa *</Label>
              <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); setSelectedPlayerId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipa" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.category ? `(${t.category})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player selection */}
            {needsPlayer && (
              <div className="space-y-2">
                <Label>Atleta *</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId} disabled={!selectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedTeamId ? 'Selecionar atleta' : 'Selecione equipa primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.number ? `#${p.number} ` : ''}{p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Recipient info */}
            <div className="space-y-2">
              <Label htmlFor="inv-name">Nome do convidado *</Label>
              <Input id="inv-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nome completo" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inv-email">Email</Label>
                <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-phone">Telefone</Label>
                <Input id="inv-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351..." />
              </div>
            </div>

            {/* Channel selection */}
            <div className="space-y-2">
              <Label>Canais de envio *</Label>
              <div className="flex gap-3">
                {(['email', 'sms', 'whatsapp'] as const).map((ch) => {
                  const Icon = CHANNEL_ICONS[ch];
                  const isSelected = selectedChannels.has(ch);
                  return (
                    <label
                      key={ch}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleChannel(ch)} />
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{CHANNEL_LABELS[ch]}</span>
                    </label>
                  );
                })}
              </div>
              {channelErrors.length > 0 && (
                <p className="text-xs text-destructive">{channelErrors[0]}</p>
              )}
            </div>

            {/* Preview toggle */}
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="h-4 w-4 mr-1" /> {showPreview ? 'Ocultar preview' : 'Ver preview'}
              </Button>
              {showPreview && selectedChannels.size > 1 && (
                <div className="flex gap-1">
                  {[...selectedChannels].map((ch) => (
                    <Button
                      key={ch}
                      type="button"
                      variant={previewChannel === ch ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setPreviewChannel(ch)}
                    >
                      {CHANNEL_LABELS[ch]}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {showPreview && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                {previewTemplate.subject && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Assunto:</span>
                    <p className="font-medium">{previewTemplate.subject}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Mensagem:</span>
                  <pre className="whitespace-pre-wrap text-sm mt-1 font-sans">{previewTemplate.body}</pre>
                </div>
              </div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={sending || createInvite.isPending}>
              {(sending || createInvite.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Criar e enviar convite
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Convite criado e enviado! Os dados abaixo podem ser partilhados manualmente se necessário.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Código de acesso</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-lg font-mono tracking-widest px-4 py-2">
                    {result.code}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.code)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Link direto</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={inviteLink} readOnly className="text-xs" />
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(inviteLink)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {[...selectedChannels].map((ch) => (
                  <Badge key={ch} variant="secondary" className="text-xs">
                    {CHANNEL_LABELS[ch]} ✓
                  </Badge>
                ))}
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
