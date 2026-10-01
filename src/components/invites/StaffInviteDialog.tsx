/**
 * Invite a head coach, an assistant coach or club staff. The server creates a
 * link and a short code; the coach shares them by WhatsApp (no email service is
 * needed). The invited person opens the link, creates an account or signs in, and
 * lands in the club and team with the right role.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Copy, Loader2, Share2, UserPlus, Clock, Trash2, Link2, Mail, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCreateInvite, useRevokeInvite, useResendInvite, useEmailStatus, type InviteType } from '@/hooks/useAccessInvites';
import { shareText, copyText } from '@/lib/share';
import { cn } from '@/lib/utils';

export type StaffInviteType = Extract<InviteType, 'coach' | 'assistant_coach' | 'staff'>;

export const STAFF_ROLE_LABELS: Record<StaffInviteType, string> = {
  coach: 'Treinador principal',
  assistant_coach: 'Treinador adjunto',
  staff: 'Staff do clube',
};

const ROLE_HELP: Record<StaffInviteType, string> = {
  coach: 'Gere a equipa: plantel, treinos, jogos e convites para adjuntos.',
  assistant_coach: 'Ajuda na equipa: treinos, presenças, jogos. Não convida outros treinadores.',
  staff: 'Pessoa da estrutura do clube (secretaria, diretor…).',
};

interface TeamOpt { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  teams: TeamOpt[];
  allowedTypes: StaffInviteType[];
  defaultTeamId?: string;
}

export function inviteLink(token: string) {
  return `${window.location.origin}/accept-invite?token=${token}`;
}

export function inviteMessage(p: { name: string; type: StaffInviteType; team?: string; link: string; code: string }) {
  const first = p.name.trim().split(/\s+/)[0];
  return [
    `Olá ${first}! 👋`,
    `Foste convidado para ${STAFF_ROLE_LABELS[p.type].toLowerCase()}${p.team ? ` da equipa ${p.team}` : ''} no TreinON.`,
    '',
    `1) Abre este link: ${p.link}`,
    '2) Cria a tua conta (ou entra, se já tens) e fica tudo ligado.',
    '',
    `Se o link não abrir, vai a ${window.location.origin}/accept-invite e usa o código ${p.code}.`,
    'O convite é válido durante 7 dias.',
  ].join('\n');
}

export function StaffInviteDialog({ open, onClose, teams, allowedTypes, defaultTeamId }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<StaffInviteType>(allowedTypes[0]);
  const [teamId, setTeamId] = useState(defaultTeamId ?? teams[0]?.id ?? '');
  const [result, setResult] = useState<{ link: string; code: string; message: string; email?: string; emailSent?: boolean; emailError?: string } | null>(null);
  const create = useCreateInvite();
  const { data: emailReady } = useEmailStatus();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(''); setEmail(''); setResult(null);
      setType(allowedTypes[0]);
      setTeamId(defaultTeamId ?? teams[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error('Indique o nome da pessoa.');
    if (!teamId) return toast.error('Escolha a equipa.');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast.error('Email inválido.');
    try {
      const r = await create.mutateAsync({ team_id: teamId, invite_type: type, recipient_name: name.trim(), email: email.trim() || undefined });
      const link = inviteLink(r.token);
      const team = teams.find((t) => t.id === teamId)?.name;
      setResult({ link, code: r.code, message: inviteMessage({ name, type, team, link, code: r.code }), email: email.trim() || undefined, emailSent: r.email_sent, emailError: r.email_error });
      qc.invalidateQueries({ queryKey: ['staff-invites'] });
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível criar o convite');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para a equipa técnica</DialogTitle>
          <DialogDescription>Cria um link e um código para enviar por WhatsApp.</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nome *</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" />
            </div>
            <div className="space-y-1.5">
              <Label>Função</Label>
              <div className="grid gap-1.5">
                {allowedTypes.map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={cn('rounded-md border p-2 text-left text-sm transition', type === t ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}>
                    <span className="font-medium">{STAFF_ROLE_LABELS[t]}</span>
                    <span className="block text-xs text-muted-foreground">{ROLE_HELP[t]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{type === 'staff' ? 'Equipa de referência' : 'Equipa'}</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Escolher equipa" /></SelectTrigger>
                <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              {teams.length === 0 && <p className="text-xs text-amber-600">Crie primeiro uma equipa.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email (opcional)</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="treinador@email.com" />
              <p className="text-xs text-muted-foreground">
                {emailReady
                  ? 'O convite segue também por email. Só quem usar este email o pode aceitar.'
                  : 'Se indicar, só quem usar este email pode aceitar o convite. (O envio por email ainda não está ligado: envie pelo WhatsApp.)'}
              </p>
            </div>
            <Button className="w-full" onClick={submit} disabled={create.isPending || teams.length === 0}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}{emailReady && email.trim() ? 'Criar e enviar por email' : 'Criar convite'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {result.email && (
              <div className={cn('flex items-start gap-2 rounded-md border p-2 text-sm', result.emailSent ? 'border-green-600/40 bg-green-600/5' : 'border-amber-500/50 bg-amber-500/5')}>
                {result.emailSent ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                <span>
                  {result.emailSent
                    ? <>Email enviado para <b>{result.email}</b>. Peça para ver também a pasta de spam.</>
                    : <>O email não foi enviado{result.emailError ? ` (${result.emailError})` : ''}. Envie pelo WhatsApp.</>}
                </span>
              </div>
            )}
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="text-xs text-muted-foreground">Código</p>
              <p className="font-mono text-3xl font-bold tracking-[0.3em]">{result.code}</p>
            </div>
            <div className="flex items-center gap-2 rounded-md border p-2">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-mono text-xs">{result.link}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { if (await copyText(result.link)) toast.success('Link copiado'); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button className="w-full" onClick={() => shareText(result.message, 'Convite TreinON')}>
              <Share2 className="mr-2 h-4 w-4" />Enviar por WhatsApp
            </Button>
            <Button variant="outline" className="w-full" onClick={async () => { if (await copyText(result.message)) toast.success('Mensagem copiada'); }}>
              <Copy className="mr-2 h-4 w-4" />Copiar mensagem
            </Button>
            <p className="text-center text-xs text-muted-foreground">O link só aparece agora. Se o perder, cancele e crie outro convite.</p>
            <Button variant="ghost" className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PendingRow { id: string; recipient_name: string; email: string | null; invite_type: StaffInviteType; invite_code: string; expires_at: string; team_id: string; teams: { name: string } | null }

/** Pending coach/assistant/staff invites for the given teams, with cancel. */
export function PendingStaffInvites({ teamIds }: { teamIds: string[] }) {
  const revoke = useRevokeInvite();
  const resend = useResendInvite();
  const qc = useQueryClient();
  const { data: invites = [] } = useQuery({
    queryKey: ['staff-invites', [...teamIds].sort().join(',')],
    enabled: teamIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_invites')
        .select('id, recipient_name, email, invite_type, invite_code, expires_at, team_id, teams(name)')
        .in('team_id', teamIds)
        .in('invite_type', ['coach', 'assistant_coach', 'staff'])
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as PendingRow[]).filter((i) => new Date(i.expires_at) > new Date());
    },
  });
  if (invites.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" />Convites por aceitar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {invites.map((i) => (
          <div key={i.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.recipient_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {STAFF_ROLE_LABELS[i.invite_type]} · {i.teams?.name} · código <span className="font-mono">{i.invite_code}</span>
                {' · '}expira {new Date(i.expires_at).toLocaleDateString('pt-PT')}
              </p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Copiar código"
              onClick={async () => { if (await copyText(`${window.location.origin}/accept-invite — código ${i.invite_code}`)) toast.success('Código copiado'); }}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={i.email ? 'Reenviar por email' : 'Novo link'}
              title={i.email ? 'Reenviar (novo link, também por email)' : 'Gerar novo link para enviar'}
              onClick={async () => {
                try {
                  const r = await resend.mutateAsync(i.id);
                  const link = inviteLink(r.token);
                  if (r.email_sent) toast.success(`Reenviado para ${i.email}`);
                  else await shareText(inviteMessage({ name: i.recipient_name, type: i.invite_type, team: i.teams?.name, link, code: r.code }), 'Convite TreinON');
                  qc.invalidateQueries({ queryKey: ['staff-invites'] });
                } catch (e) { toast.error((e as Error).message); }
              }}>
              {i.email ? <Mail className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Cancelar convite"
              onClick={async () => {
                try { await revoke.mutateAsync(i.id); toast.success('Convite cancelado'); qc.invalidateQueries({ queryKey: ['staff-invites'] }); }
                catch (e) { toast.error((e as Error).message); }
              }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
