import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { useRevokeInvite, useResendInvite } from '@/hooks/useAccessInvites';
import { useSendInvite, useInviteDeliveries, useInviteEvents, useManualRetry } from '@/hooks/useInviteDelivery';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/page-states';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2, Mail, Phone, MessageCircle, RefreshCw, XCircle, Users,
  Copy, Eye, Send, Clock, CheckCircle2, AlertTriangle, RotateCcw,
  Search, Filter, Ban, Zap,
} from 'lucide-react';
import { PROFILE_LABELS, CHANNEL_LABELS } from '@/lib/invite-templates';

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

const deliveryStatusLabels: Record<string, string> = {
  queued: 'Na fila',
  sending: 'A enviar',
  sent: 'Enviado',
  delivered: 'Entregue',
  failed: 'Falhou',
  bounced: 'Rejeitado',
  opened: 'Aberto',
  clicked: 'Clicado',
  accepted: 'Aceite',
  retry_scheduled: 'Retry agendado',
  exhausted: 'Retries esgotados',
  cancelled: 'Cancelado',
};

const deliveryStatusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  queued: 'secondary',
  sending: 'secondary',
  sent: 'default',
  delivered: 'default',
  failed: 'destructive',
  bounced: 'destructive',
  exhausted: 'destructive',
  cancelled: 'outline',
  opened: 'default',
  clicked: 'default',
  accepted: 'default',
  retry_scheduled: 'outline',
};

const deliveryStatusIcons: Record<string, typeof Clock> = {
  queued: Clock,
  sending: Loader2,
  sent: Send,
  delivered: CheckCircle2,
  failed: AlertTriangle,
  bounced: Ban,
  opened: Eye,
  clicked: CheckCircle2,
  accepted: CheckCircle2,
  retry_scheduled: RotateCcw,
  exhausted: AlertTriangle,
  cancelled: XCircle,
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageCircle,
};

function InviteDetailDialog({ inviteId, open, onClose }: { inviteId: string | null; open: boolean; onClose: () => void }) {
  const { data: deliveries = [], isLoading: delLoading } = useInviteDeliveries(inviteId);
  const { data: events = [], isLoading: evtLoading } = useInviteEvents(inviteId);
  const manualRetry = useManualRetry();

  const handleRetry = async (deliveryId: string) => {
    try {
      await manualRetry.mutateAsync(deliveryId);
      toast.success('Retry iniciado com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao tentar retry');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Convite</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deliveries */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Envios</h4>
            {delLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : deliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem envios registados</p>
            ) : (
              <div className="space-y-2">
                {deliveries.map((d) => {
                  const ChannelIcon = channelIcons[d.delivery_channel] || Mail;
                  const StatusIcon = deliveryStatusIcons[d.send_status] || Clock;
                  const canRetry = ['failed', 'exhausted', 'retry_scheduled'].includes(d.send_status);
                  return (
                    <div key={d.id} className="border rounded-md p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{CHANNEL_LABELS[d.delivery_channel]}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={deliveryStatusVariants[d.send_status] || 'secondary'} className="text-xs">
                            <StatusIcon className={`h-3 w-3 mr-1 ${d.send_status === 'sending' ? 'animate-spin' : ''}`} />
                            {deliveryStatusLabels[d.send_status] || d.send_status}
                          </Badge>
                          {canRetry && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5"
                              onClick={() => handleRetry(d.id)}
                              disabled={manualRetry.isPending}
                              title="Retry manual"
                            >
                              <Zap className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {d.recipient_email && <p className="text-muted-foreground">Para: {d.recipient_email}</p>}
                      {d.recipient_phone && <p className="text-muted-foreground">Tel: {d.recipient_phone}</p>}
                      {d.provider_name && d.provider_name !== 'none' && (
                        <p className="text-muted-foreground">Provider: {d.provider_name}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                        {d.sent_at && <span>Enviado: {format(new Date(d.sent_at), "d MMM HH:mm", { locale: pt })}</span>}
                        {d.delivered_at && <span>Entregue: {format(new Date(d.delivered_at), "d MMM HH:mm", { locale: pt })}</span>}
                        {d.opened_at && <span>Aberto: {format(new Date(d.opened_at), "d MMM HH:mm", { locale: pt })}</span>}
                        {d.clicked_at && <span>Clicado: {format(new Date(d.clicked_at), "d MMM HH:mm", { locale: pt })}</span>}
                        {d.accepted_at && <span className="text-primary font-medium">Aceite: {format(new Date(d.accepted_at), "d MMM HH:mm", { locale: pt })}</span>}
                      </div>
                      {d.retry_count > 0 && (
                        <p className="text-muted-foreground">
                          Retries: {d.retry_count}/{d.max_retries}
                          {d.next_retry_at && ` • Próximo: ${format(new Date(d.next_retry_at), "d MMM HH:mm", { locale: pt })}`}
                        </p>
                      )}
                      {d.failure_reason && <p className="text-destructive">Erro: {d.failure_reason}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Events */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico de Eventos</h4>
            {evtLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : events.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem eventos registados</p>
            ) : (
              <div className="space-y-1">
                {events.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{evt.event_type}</Badge>
                      <span className="text-muted-foreground">{evt.event_source}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {format(new Date(evt.created_at), "d MMM HH:mm:ss", { locale: pt })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InvitesManagementTab() {
  const { user } = useAuth();
  const { clubId } = useUserRole();
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendInvite();
  const sendInvite = useSendInvite();
  const [detailInviteId, setDetailInviteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['communication-invites', clubId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('access_invites')
        .select('*, teams(name), players(name)')
        .order('created_at', { ascending: false });

      if (clubId) {
        query = query.eq('club_id', clubId);
      } else if (user?.id) {
        query = query.eq('owner_coach_id', user.id);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const filteredInvites = invites.filter((inv: any) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const match = inv.recipient_name?.toLowerCase().includes(s) ||
        inv.email?.toLowerCase().includes(s) ||
        inv.invite_code?.toLowerCase().includes(s);
      if (!match) return false;
    }
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (channelFilter !== 'all') {
      if (!inv.delivery_channels?.includes(channelFilter)) return false;
    }
    return true;
  });

  const handleRevoke = async (id: string) => {
    try {
      await revokeInvite.mutateAsync(id);
      toast.success('Convite revogado');
    } catch {
      toast.error('Erro ao revogar');
    }
  };

  const handleResend = async (id: string) => {
    try {
      const result = await resendInvite.mutateAsync(id);
      const link = `${window.location.origin}/accept-invite?token=${result.token}`;

      try {
        await sendInvite.mutateAsync({
          invite_id: id,
          channels: ['email'],
          context: {
            invite_token: result.token,
            invite_link: link,
            base_url: window.location.origin,
          },
        });
        toast.success('Convite reenviado por email!');
      } catch {
        navigator.clipboard.writeText(link);
        toast.success('Convite reenviado! Link copiado.');
      }
    } catch {
      toast.error('Erro ao reenviar');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar nome, email, código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="accepted">Aceite</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="revoked">Revogado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Canal</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredInvites.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={invites.length === 0 ? "Sem convites enviados" : "Nenhum resultado"}
          description={invites.length === 0
            ? "Use os botões de convite para convidar pessoas para a plataforma."
            : "Tente alterar os filtros de pesquisa."}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filteredInvites.length} convite{filteredInvites.length !== 1 ? 's' : ''}</p>
          {filteredInvites.map((inv: any) => (
            <Card key={inv.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{inv.recipient_name}</span>
                    <Badge variant={statusVariants[inv.status] || 'outline'} className="text-xs">
                      {statusLabels[inv.status] || inv.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {PROFILE_LABELS[inv.invite_type] || inv.invite_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {inv.teams?.name && <span>Equipa: {inv.teams.name}</span>}
                    {inv.players?.name && <span>Atleta: {inv.players.name}</span>}
                    {inv.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />{inv.email}
                      </span>
                    )}
                    <span>{format(new Date(inv.created_at), "d MMM yyyy", { locale: pt })}</span>
                    {inv.delivery_channels && inv.delivery_channels.length > 0 && (
                      <span className="flex items-center gap-1">
                        {inv.delivery_channels.map((ch: string) => {
                          const Icon = channelIcons[ch] || Mail;
                          return <Icon key={ch} className="h-3 w-3" />;
                        })}
                      </span>
                    )}
                    {inv.invite_code && inv.status === 'pending' && (
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(inv.invite_code);
                          toast.success('Código copiado');
                        }}
                      >
                        <Copy className="h-3 w-3" /> {inv.invite_code}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetailInviteId(inv.id)}
                    title="Ver detalhes e tracking"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {inv.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResend(inv.id)}
                        title="Reenviar"
                        disabled={resendInvite.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleRevoke(inv.id)}
                        title="Revogar"
                        disabled={revokeInvite.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InviteDetailDialog
        inviteId={detailInviteId}
        open={!!detailInviteId}
        onClose={() => setDetailInviteId(null)}
      />
    </>
  );
}
