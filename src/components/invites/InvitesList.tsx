import { usePlayerInvites, useRevokeInvite, useResendInvite } from '@/hooks/useAccessInvites';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/page-states';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { Mail, RefreshCw, XCircle, Users, Copy } from 'lucide-react';

interface Props {
  playerId: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceite',
  expired: 'Expirado',
  revoked: 'Revogado',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  accepted: 'default',
  expired: 'outline',
  revoked: 'destructive',
};

export function InvitesList({ playerId }: Props) {
  const { data: invites = [], isLoading } = usePlayerInvites(playerId);
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendInvite();

  const handleRevoke = async (id: string) => {
    try {
      await revokeInvite.mutateAsync(id);
      toast.success('Convite revogado');
    } catch { toast.error('Erro ao revogar'); }
  };

  const handleResend = async (id: string) => {
    try {
      const result = await resendInvite.mutateAsync(id);
      const link = `${window.location.origin}/accept-invite?token=${result.token}`;
      navigator.clipboard.writeText(link);
      toast.success('Convite reenviado! Link copiado.');
    } catch { toast.error('Erro ao reenviar'); }
  };

  if (isLoading) return null;
  if (invites.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="Sem convites"
        description="Ainda não foram enviados convites para este atleta."
      />
    );
  }

  return (
    <div className="space-y-2">
      {invites.map((inv) => (
        <Card key={inv.id}>
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{inv.recipient_name}</span>
                <Badge variant={statusVariants[inv.status] || 'outline'} className="text-xs">
                  {statusLabels[inv.status] || inv.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {inv.invite_type === 'guardian' ? 'Encarregado' : 'Atleta'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {inv.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{inv.email}</span>}
                <span>Criado {format(new Date(inv.created_at), "d MMM yyyy", { locale: pt })}</span>
                {inv.invite_code && (
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(inv.invite_code!);
                      toast.success('Código copiado');
                    }}
                  >
                    <Copy className="h-3 w-3" /> {inv.invite_code}
                  </button>
                )}
              </div>
            </div>
            {inv.status === 'pending' && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => handleResend(inv.id)} title="Reenviar">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRevoke(inv.id)} title="Revogar">
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
