import { useState } from 'react';
import {
  useAttendanceRequests,
  useAttendanceResponses,
  useCreateAttendanceRequest,
  useRespondAttendance,
  AttendanceRequest,
} from '@/hooks/useCommunicationPhase2';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  ClipboardCheck, Plus, Calendar, Clock, CheckCircle2, XCircle, HelpCircle, Loader2, Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';

interface AttendanceTabProps {
  clubId: string | null;
  userId?: string | null;
  canManage: boolean;
}

export function AttendanceTab({ clubId, userId, canManage }: AttendanceTabProps) {
  const { data: requests = [], isLoading } = useAttendanceRequests(clubId, userId);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

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
        <h3 className="text-sm font-semibold text-muted-foreground">Presenças</h3>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Chamada
          </Button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma chamada de presença</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh] md:max-h-none">
          <div className="space-y-3">
            {requests.map((r) => (
              <AttendanceRequestCard
                key={r.id}
                request={r}
                canManage={canManage}
                onViewDetails={() => setSelectedRequest(r.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <CreateAttendanceDialog
        clubId={clubId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <AttendanceDetailDialog
        request={requests.find((r) => r.id === selectedRequest) || null}
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        canManage={canManage}
      />
    </>
  );
}

function AttendanceRequestCard({
  request,
  canManage,
  onViewDetails,
}: {
  request: AttendanceRequest;
  canManage: boolean;
  onViewDetails: () => void;
}) {
  const eventTypeLabels: Record<string, string> = {
    training: 'Treino',
    match: 'Jogo',
    other: 'Outro',
  };

  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={onViewDetails}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
              <h4 className="text-sm font-semibold truncate">{request.event_title}</h4>
              <Badge variant={request.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                {request.status === 'open' ? 'Aberta' : 'Fechada'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {eventTypeLabels[request.event_type] || request.event_type}
              </Badge>
              {request.event_date && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(request.event_date), "d MMM yyyy, HH:mm", { locale: pt })}
                </span>
              )}
              {request.deadline && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Prazo: {format(new Date(request.deadline), "d MMM HH:mm", { locale: pt })}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <Users className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceDetailDialog({
  request,
  open,
  onClose,
  canManage,
}: {
  request: AttendanceRequest | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const { data: responses = [] } = useAttendanceResponses(request?.id || null);
  const respond = useRespondAttendance();
  const [comment, setComment] = useState('');

  if (!request) return null;

  const confirmed = responses.filter((r) => r.response === 'confirmed').length;
  const declined = responses.filter((r) => r.response === 'declined').length;
  const maybe = responses.filter((r) => r.response === 'maybe').length;
  const pending = responses.filter((r) => r.response === 'pending').length;
  const total = responses.length || 1;
  const myResponse = responses.find((r) => r.user_id === user?.id);

  const handleRespond = (value: string) => {
    respond.mutate(
      { requestId: request.id, response: value, comment: comment.trim() || undefined },
      { onSuccess: () => { toast.success('Resposta registada'); setComment(''); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{request.event_title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {request.notes && <p className="text-sm text-muted-foreground">{request.notes}</p>}

          {/* Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmados: {confirmed}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3.5 w-3.5" /> Ausentes: {declined}
              </span>
              <span className="flex items-center gap-1 text-warning">
                <HelpCircle className="h-3.5 w-3.5" /> Talvez: {maybe}
              </span>
            </div>
            <Progress value={(confirmed / total) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {confirmed} de {responses.length} confirmados · {pending} pendentes
            </p>
          </div>

          {/* My response */}
          {request.status === 'open' && (
            <div className="border-t pt-3 space-y-2">
              <Label className="text-sm font-medium">A sua resposta</Label>
              {myResponse && myResponse.response !== 'pending' ? (
                <div className="flex items-center gap-2">
                  <Badge variant={myResponse.response === 'confirmed' ? 'default' : 'secondary'}>
                    {myResponse.response === 'confirmed' ? 'Confirmado' : myResponse.response === 'declined' ? 'Ausente' : 'Talvez'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {myResponse.responded_at && format(new Date(myResponse.responded_at), 'dd/MM HH:mm')}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comentário opcional..."
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespond('confirmed')} disabled={respond.isPending} className="flex-1">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespond('declined')} disabled={respond.isPending} className="flex-1">
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Ausente
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRespond('maybe')} disabled={respond.isPending}>
                      Talvez
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Response list for managers */}
          {canManage && responses.length > 0 && (
            <div className="border-t pt-3">
              <Label className="text-sm font-medium mb-2 block">Respostas ({responses.length})</Label>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {responses.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-1">
                      <span className="text-muted-foreground">{r.user_id.slice(0, 8)}...</span>
                      <div className="flex items-center gap-2">
                        {r.comment && <span className="text-muted-foreground italic">"{r.comment}"</span>}
                        <Badge
                          variant={r.response === 'confirmed' ? 'default' : r.response === 'declined' ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {r.response === 'confirmed' ? 'Sim' : r.response === 'declined' ? 'Não' : r.response === 'maybe' ? 'Talvez' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateAttendanceDialog({
  clubId,
  open,
  onClose,
}: {
  clubId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateAttendanceRequest(clubId);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('training');
  const [eventDate, setEventDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) { toast.error('Título é obrigatório'); return; }
    create.mutate(
      {
        event_type: eventType,
        event_title: title.trim(),
        event_date: eventDate ? new Date(eventDate).toISOString() : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Chamada de presença criada');
          setTitle(''); setEventDate(''); setDeadline(''); setNotes('');
          onClose();
        },
        onError: () => toast.error('Erro ao criar chamada'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Chamada de Presença</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Treino de quarta-feira" />
          </div>
          <div>
            <Label>Tipo de Evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="training">Treino</SelectItem>
                <SelectItem value="match">Jogo</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data do Evento</Label>
            <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <Label>Prazo de Resposta</Label>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais..." rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending}>
              {create.isPending ? 'A criar...' : 'Criar Chamada'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
