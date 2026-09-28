import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateInvite } from '@/hooks/useAccessInvites';
import { toast } from 'sonner';
import { Loader2, UserPlus, Copy, Link2 } from 'lucide-react';

interface Props {
  teamId: string;
  playerId?: string;
  playerName?: string;
  scopeType: 'club' | 'coach';
  clubId?: string;
  ownerCoachId?: string;
  trigger?: React.ReactNode;
}

export function InvitePlayerDialog({ teamId, playerId, playerName, scopeType, clubId, ownerCoachId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [inviteType, setInviteType] = useState<'guardian' | 'player'>('guardian');
  const [recipientName, setRecipientName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ token: string; code: string; } | null>(null);
  const createInvite = useCreateInvite();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName) {
      toast.error('Indique o nome do convidado');
      return;
    }

    try {
      const data = await createInvite.mutateAsync({
        team_id: teamId,
        player_id: playerId,
        invite_type: inviteType,
        recipient_name: recipientName,
        email: email || undefined,
        // SECURITY: scope_type, club_id, owner_coach_id derived server-side
      });
      setResult({ token: data.token, code: data.code });
      toast.success('Convite criado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar convite');
    }
  };

  const inviteLink = result
    ? `${window.location.origin}/accept-invite?token=${result.token}`
    : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setRecipientName('');
    setEmail('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <UserPlus className="h-4 w-4 mr-1" /> Convidar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para a plataforma</DialogTitle>
          <DialogDescription>
            {playerName
              ? `Enviar convite relacionado com ${playerName}`
              : 'Enviar convite de acesso restrito'}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de convite</Label>
              <Select value={inviteType} onValueChange={(v) => setInviteType(v as 'guardian' | 'player')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guardian">Encarregado de Educação</SelectItem>
                  <SelectItem value="player">Atleta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipientName">Nome do convidado</Label>
              <Input
                id="recipientName"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <Button type="submit" className="w-full" disabled={createInvite.isPending}>
              {createInvite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar convite
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Convite criado! Partilhe o link ou código com o convidado.
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
