import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Trophy, Send, Users, CheckCircle2, XCircle, Clock, AlertTriangle, Bell, Loader2, Mail, MessageCircle } from 'lucide-react';
import { callupText, openWhatsApp, sendNotice, toastNotice } from '@/lib/notice';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  useCallupConfirmations,
  useCreateCallupConfirmations,
  useSendCallupNotification,
  useCallupNotifications,
} from '@/hooks/useCommunicationPhase3';
import { EmptyState } from '@/components/ui/page-states';

interface CallupCommunicationProps {
  matchId: string;
  clubId: string;
  teamId: string;
  opponentName: string;
  matchDate: string;
  playerIds: string[];
  playerNames?: Record<string, string>;
  canManage: boolean;
}

export function CallupCommunication({
  matchId,
  clubId,
  teamId,
  opponentName,
  matchDate,
  playerIds,
  playerNames = {},
  canManage,
}: CallupCommunicationProps) {
  const { data: confirmations = [], isLoading } = useCallupConfirmations(matchId);
  const { data: notifications = [] } = useCallupNotifications(matchId);
  const createConfirmations = useCreateCallupConfirmations();
  const sendNotification = useSendCallupNotification();
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyAudience, setNotifyAudience] = useState('convocados');
  const [notifyType, setNotifyType] = useState('callup_published');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [emailing, setEmailing] = useState(false);
  const calledUp = playerIds.map(id => playerNames[id]).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt'));
  /** email to the parents of the called-up players (accounts and emails on the player record) */
  const emailParents = async (message?: string) => {
    if (playerIds.length === 0) return toast.error('Sem jogadores convocados');
    setEmailing(true);
    toastNotice(await sendNotice({ kind: 'callup', match_id: matchId, player_ids: playerIds, message: message || undefined }));
    setEmailing(false);
  };
  const shareWhatsApp = (message?: string) => openWhatsApp(callupText({ opponent: opponentName, date: matchDate, players: calledUp, message }));

  const confirmed = confirmations.filter(c => c.status === 'confirmed');
  const declined = confirmations.filter(c => c.status === 'declined');
  const pending = confirmations.filter(c => c.status === 'pending');
  const total = confirmations.length;
  const confirmRate = total > 0 ? Math.round((confirmed.length / total) * 100) : 0;

  const handleInitConfirmations = () => {
    if (playerIds.length === 0) {
      toast.error('Sem jogadores convocados');
      return;
    }
    createConfirmations.mutate({ matchId, playerIds }, {
      onSuccess: () => toast.success('Confirmações criadas para os convocados'),
      onError: () => toast.error('Erro ao criar confirmações'),
    });
  };

  const handleSendNotification = () => {
    // the email goes out even if the in-app record cannot be saved
    emailParents(notifyMessage);
    sendNotification.mutate({
      matchId,
      clubId,
      teamId,
      notificationType: notifyType,
      targetAudience: notifyAudience,
      message: notifyMessage || undefined,
    }, {
      onSuccess: () => {
        setNotifyDialogOpen(false);
        setNotifyMessage('');
      },
      onError: () => setNotifyDialogOpen(false),
    });
  };

  return (
    <div className="space-y-4">
      {/* Confirmation Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Confirmações da Convocatória
          </CardTitle>
          <CardDescription className="text-xs">
            {opponentName} · {format(new Date(matchDate), "d MMM, HH:mm", { locale: pt })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Nenhuma confirmação solicitada ainda.</p>
              {canManage && playerIds.length > 0 && (
                <Button size="sm" onClick={handleInitConfirmations} disabled={createConfirmations.isPending}>
                  {createConfirmations.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Solicitar Confirmação ({playerIds.length} convocados)
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{confirmed.length} confirmados</span>
                  <span>{confirmRate}%</span>
                </div>
                <Progress value={confirmRate} className="h-2" />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
                  <p className="text-lg font-bold text-green-600">{confirmed.length}</p>
                  <p className="text-xs text-muted-foreground">Confirmados</p>
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <XCircle className="h-4 w-4 mx-auto text-red-600 mb-1" />
                  <p className="text-lg font-bold text-red-600">{declined.length}</p>
                  <p className="text-xs text-muted-foreground">Recusados</p>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <Clock className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
                  <p className="text-lg font-bold text-yellow-600">{pending.length}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>

              {/* Per-player detail */}
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {confirmations.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                      <span className="truncate">{playerNames[c.player_id] || c.player_id.slice(0, 8)}</span>
                      <Badge
                        variant={c.status === 'confirmed' ? 'default' : c.status === 'declined' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {c.status === 'confirmed' ? 'Confirmado' : c.status === 'declined' ? 'Recusado' : 'Pendente'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          {canManage && (
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button size="sm" onClick={() => emailParents()} disabled={emailing}>
                {emailing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />} Enviar convocatória por email
              </Button>
              <Button size="sm" variant="outline" onClick={() => shareWhatsApp()}>
                <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNotifyDialogOpen(true)}>
                <Bell className="h-3 w-3 mr-1" /> Com mensagem
              </Button>
              {pending.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNotifyType('confirmation_reminder');
                    setNotifyAudience('pendentes');
                    setNotifyMessage(`Lembrete: confirme a sua presença para o jogo contra ${opponentName}.`);
                    setNotifyDialogOpen(true);
                  }}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" /> Lembrar Pendentes ({pending.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification history */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Histórico de Notificações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {notifications.slice(0, 5).map(n => (
                <div key={n.id} className="flex items-center justify-between text-xs p-2 bg-muted/20 rounded">
                  <div className="flex items-center gap-2">
                    <Send className="h-3 w-3 text-muted-foreground" />
                    <span>{n.notification_type === 'callup_published' ? 'Convocatória publicada' :
                      n.notification_type === 'confirmation_reminder' ? 'Lembrete de confirmação' :
                      n.notification_type === 'callup_updated' ? 'Convocatória atualizada' : n.notification_type}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {n.sent_at ? format(new Date(n.sent_at), "d MMM, HH:mm", { locale: pt }) : 'Não enviado'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notify Dialog */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar convocatória</DialogTitle>
            <DialogDescription>Vai por email para os pais dos convocados do jogo contra {opponentName}, com a sua mensagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={notifyType} onValueChange={setNotifyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="callup_published">Convocatória Publicada</SelectItem>
                  <SelectItem value="callup_updated">Convocatória Atualizada</SelectItem>
                  <SelectItem value="callup_reminder">Lembrete do Jogo</SelectItem>
                  <SelectItem value="confirmation_reminder">Lembrete de Confirmação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Audiência</label>
              <Select value={notifyAudience} onValueChange={setNotifyAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="convocados">Convocados</SelectItem>
                  <SelectItem value="pais_convocados">Pais dos Convocados</SelectItem>
                  <SelectItem value="full_team">Equipa Completa</SelectItem>
                  <SelectItem value="staff">Staff Técnico</SelectItem>
                  <SelectItem value="pendentes">Pendentes de Confirmação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem (opcional)</label>
              <Textarea
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
                placeholder="Mensagem adicional..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="sm:mr-auto" onClick={() => shareWhatsApp(notifyMessage)}>
              <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
            </Button>
            <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendNotification} disabled={sendNotification.isPending}>
              {sendNotification.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Send className="h-3 w-3 mr-1" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
