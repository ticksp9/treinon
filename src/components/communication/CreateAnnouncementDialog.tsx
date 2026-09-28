import { useState } from 'react';
import { useCreateAnnouncement, CommunicationChannel } from '@/hooks/useCommunication';
import { useAccessContext } from '@/hooks/useAccessContext';
import { getAnnouncementScopes } from '@/lib/communication-access-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface CreateAnnouncementDialogProps {
  clubId: string | null;
  channels: CommunicationChannel[];
  open: boolean;
  onClose: () => void;
}

const targetTypeLabels: Record<string, string> = {
  channel: 'Grupo',
  team: 'Equipa',
  age_group: 'Escalão',
  role: 'Função',
  club: 'Clube',
};

export function CreateAnnouncementDialog({ clubId, channels, open, onClose }: CreateAnnouncementDialogProps) {
  const { ctx } = useAccessContext();
  const createAnnouncement = useCreateAnnouncement(clubId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [targetType, setTargetType] = useState('channel');
  const [channelId, setChannelId] = useState('');
  const [targetValue, setTargetValue] = useState('');

  // Only show scopes allowed for this profile
  const allowedScopes = ctx ? getAnnouncementScopes(ctx) : [];

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }
    createAnnouncement.mutate(
      {
        title: title.trim(),
        content: content.trim(),
        priority: isImportant ? 'important' : 'normal',
        target_type: targetType,
        channel_id: targetType === 'channel' ? channelId || undefined : undefined,
        target_value: targetType !== 'channel' ? targetValue || undefined : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Anúncio enviado com sucesso');
          setTitle('');
          setContent('');
          setIsImportant(false);
          setTargetValue('');
          onClose();
        },
        onError: () => toast.error('Erro ao enviar anúncio'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Anúncio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Treino cancelado amanhã" />
          </div>
          <div>
            <Label>Conteúdo *</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Detalhes do anúncio..." rows={4} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isImportant} onCheckedChange={setIsImportant} />
            <Label className="cursor-pointer">Marcar como importante</Label>
          </div>
          <div>
            <Label>Destinatários</Label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedScopes.includes('channel') && (
                  <SelectItem value="channel">{targetTypeLabels.channel}</SelectItem>
                )}
                {allowedScopes.includes('team') && (
                  <SelectItem value="team">{targetTypeLabels.team}</SelectItem>
                )}
                {allowedScopes.includes('age_group') && (
                  <SelectItem value="age_group">{targetTypeLabels.age_group}</SelectItem>
                )}
                {allowedScopes.includes('role') && (
                  <SelectItem value="role">{targetTypeLabels.role}</SelectItem>
                )}
                {allowedScopes.includes('club') && (
                  <SelectItem value="club">{targetTypeLabels.club}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {targetType === 'channel' && (
            <div>
              <Label>Grupo</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger><SelectValue placeholder="Selecionar grupo" /></SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {targetType !== 'channel' && targetType !== 'club' && (
            <div>
              <Label>Valor (ex: Sub-13, Treinadores)</Label>
              <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Especificar..." />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createAnnouncement.isPending}>
              {createAnnouncement.isPending ? 'A enviar...' : 'Enviar Anúncio'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
