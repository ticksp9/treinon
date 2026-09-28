import { useState } from 'react';
import { useReminders, useCreateReminder, useMarkReminderSent, CommunicationReminder, CommunicationChannel } from '@/hooks/useCommunication';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCircle2, Clock, Plus, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';

interface RemindersListProps {
  clubId: string | null;
  userId?: string | null;
  channels: CommunicationChannel[];
}

const reminderTypeLabels: Record<string, string> = {
  training: 'Treino',
  match: 'Jogo',
  attendance: 'Presenças',
  schedule_change: 'Alteração Horário',
  custom: 'Personalizado',
};

export function RemindersList({ clubId, userId, channels }: RemindersListProps) {
  const { data: reminders = [], isLoading } = useReminders(clubId, userId);
  const markSent = useMarkReminderSent();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Lembretes</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Lembrete
        </Button>
      </div>

      {reminders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum lembrete configurado</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh] md:max-h-none">
          <div className="space-y-3">
            {reminders.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Bell className="h-4 w-4 text-primary shrink-0" />
                        <h4 className="text-sm font-semibold truncate">{r.title}</h4>
                        <Badge variant={r.is_sent ? 'secondary' : 'default'} className="text-[10px]">
                          {r.is_sent ? 'Enviado' : 'Pendente'}
                        </Badge>
                      </div>
                      {r.content && <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {reminderTypeLabels[r.reminder_type] || r.reminder_type}
                        </Badge>
                        {r.scheduled_for && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(r.scheduled_for), "d MMM yyyy, HH:mm", { locale: pt })}
                          </span>
                        )}
                        {r.is_sent && r.sent_at && (
                          <span className="text-xs text-success flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Enviado {format(new Date(r.sent_at), 'dd/MM HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                    {!r.is_sent && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          markSent.mutate(r.id, {
                            onSuccess: () => toast.success('Lembrete marcado como enviado'),
                          });
                        }}
                        disabled={markSent.isPending}
                      >
                        <Send className="h-3 w-3 mr-1" /> Enviar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <CreateReminderDialog
        clubId={clubId}
        channels={channels}
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </>
  );
}

function CreateReminderDialog({
  clubId,
  channels,
  open,
  onClose,
}: {
  clubId: string | null;
  channels: CommunicationChannel[];
  open: boolean;
  onClose: () => void;
}) {
  const createReminder = useCreateReminder(clubId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [reminderType, setReminderType] = useState('training');
  const [scheduledFor, setScheduledFor] = useState('');
  const [channelId, setChannelId] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    createReminder.mutate(
      {
        title: title.trim(),
        content: content.trim() || undefined,
        reminder_type: reminderType,
        channel_id: channelId || undefined,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Lembrete criado');
          setTitle('');
          setContent('');
          setScheduledFor('');
          onClose();
        },
        onError: () => toast.error('Erro ao criar lembrete'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lembrete</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Treino amanhã às 18h" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={reminderType} onValueChange={setReminderType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="training">Treino</SelectItem>
                <SelectItem value="match">Jogo</SelectItem>
                <SelectItem value="attendance">Presenças</SelectItem>
                <SelectItem value="schedule_change">Alteração Horário</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Grupo destinatário</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data/Hora agendada</Label>
            <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Detalhes opcionais..." rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createReminder.isPending}>
              {createReminder.isPending ? 'A criar...' : 'Criar Lembrete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
