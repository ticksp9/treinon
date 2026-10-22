import { useState, useRef, useEffect, useMemo } from 'react';
import { useChannelMessages, useSendMessage, CommunicationMessage } from '@/hooks/useCommunication';
import { usePinMessage } from '@/hooks/useCommunicationPhase2';
import { useMarkChannelRead, useSenderProfiles, useChannelMemberCount } from '@/hooks/useCommunicationPremium';
import { PinnedMessages } from './PinnedMessages';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Send, MessageSquare, Loader2, Pin, MoreVertical, Paperclip, Users, Hash, AlertTriangle, Flag, Ban, Trash2, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useBlockedUsers, useBlockUser, useChannelReports, useDeleteMessage, useReportMessage, useResolveReport } from '@/hooks/useChatModeration';
import { format, isToday, isYesterday } from 'date-fns';
import { pt } from 'date-fns/locale';
import { uploadCommunicationFile } from '@/hooks/useCommunicationPhase2';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { tx, longDate } from '@/lib/i18n/ui';

interface ChatViewProps {
  channelId: string;
  channelName: string;
  canManage?: boolean;
  channelType?: string;
  channelDescription?: string | null;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return tx('Hoje');
  if (isYesterday(date)) return tx('Ontem');
  return longDate(date, 'date');
}

export function ChatView({ channelId, channelName, canManage = false, channelType, channelDescription }: ChatViewProps) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useChannelMessages(channelId);
  const sendMessage = useSendMessage(channelId);
  const pinMessage = usePinMessage();
  const markRead = useMarkChannelRead();
  const { data: memberCount = 0 } = useChannelMemberCount(channelId);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: blocked = [] } = useBlockedUsers();
  const blockUser = useBlockUser();
  const reportMessage = useReportMessage();
  const deleteMessage = useDeleteMessage(channelId);
  const { data: reports = [] } = useChannelReports(channelId, canManage);
  const resolveReport = useResolveReport();
  const [reporting, setReporting] = useState<CommunicationMessage | null>(null);
  const [reason, setReason] = useState('');
  // messages of people this user blocked are not shown
  const visible = useMemo(() => messages.filter((m) => !blocked.includes(m.sender_id)), [messages, blocked]);

  const senderIds = useMemo(() => messages.map(m => m.sender_id), [messages]);
  const { data: senderNames } = useSenderProfiles(senderIds);

  // Mark channel as read on open + on new messages
  useEffect(() => {
    if (channelId && messages.length > 0) {
      markRead.mutate(channelId);
    }
  }, [channelId, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed, {
      onError: () => toast.error(tx('Erro ao enviar mensagem. Tente novamente.')),
    });
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const result = await uploadCommunicationFile(user.id, file);
      await supabase.from('communication_messages').insert({
        channel_id: channelId,
        sender_id: user.id,
        content: `📎 ${result.name}`,
        attachment_url: result.url,
        attachment_name: result.name,
      });
      toast.success(tx('Ficheiro enviado'));
    } catch {
      toast.error(tx('Erro ao enviar ficheiro'));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const nameOf = (id: string | null | undefined) => (id && senderNames?.get(id)) || tx('Utilizador');

  const handleReport = () => {
    if (!reporting) return;
    reportMessage.mutate({ messageId: reporting.id, reason: reason.trim() }, {
      onSuccess: () => { toast.success(tx('Denúncia enviada. Quem gere o grupo e a equipa TreinON vão analisá-la.')); setReporting(null); setReason(''); },
      onError: (e) => toast.error(tx('Não foi possível enviar a denúncia: {{msg}}', { msg: (e as Error).message })),
    });
  };

  const handleBlock = (userId: string, block: boolean) => {
    blockUser.mutate({ userId, block }, {
      onSuccess: () => toast.success(block
        ? tx('{{name}} bloqueado: deixa de ver as mensagens desta pessoa.', { name: nameOf(userId) })
        : tx('{{name}} desbloqueado.', { name: nameOf(userId) })),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const handleDelete = (messageId: string) => {
    if (!window.confirm(tx('Apagar esta mensagem para todos?'))) return;
    deleteMessage.mutate(messageId, {
      onSuccess: () => toast.success(tx('Mensagem apagada.')),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const handlePin = (messageId: string) => {
    pinMessage.mutate(
      { channelId, messageId },
      { onSuccess: () => toast.success(tx('Mensagem fixada')) }
    );
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: CommunicationMessage[] }[] = [];
    let currentDate = '';
    visible.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  }, [visible]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Hash className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{channelName}</h3>
            {channelDescription && (
              <p className="text-xs text-muted-foreground truncate">{channelDescription}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {channelType && (
            <Badge variant="outline" className="text-[10px] hidden sm:flex">
              {channelType.replace(/_/g, ' ')}
            </Badge>
          )}
          {blocked.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
                  <Ban className="h-3 w-3" />{tx('Bloqueados ({{n}})', { n: blocked.length })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {blocked.map((id) => (
                  <DropdownMenuItem key={id} onClick={() => handleBlock(id, false)}>
                    {tx('Desbloquear {{name}}', { name: nameOf(id) })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Badge variant="secondary" className="text-xs gap-1">
            <Users className="h-3 w-3" />
            {memberCount}
          </Badge>
        </div>
      </div>

      {/* Pinned messages */}
      <PinnedMessages channelId={channelId} canManage={canManage} />

      {/* Reported messages: only the group's managers see them */}
      {canManage && reports.length > 0 && (
        <div className="border-b bg-destructive/5 px-4 py-2 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" />{tx('Mensagens denunciadas ({{n}})', { n: reports.length })}
          </p>
          {reports.map((r) => (
            <div key={r.id} className="rounded-md border bg-background p-2 text-xs space-y-1">
              <p className="break-words"><span className="font-medium">{nameOf(r.reported_user_id)}:</span> {r.message_content}</p>
              {r.reason && <p className="text-muted-foreground">{tx('Motivo:')} {r.reason}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {r.message_id && (
                  <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={resolveReport.isPending}
                    onClick={() => resolveReport.mutate({ report: r, deleteMessage: true }, { onSuccess: () => toast.success(tx('Mensagem apagada.')) })}>
                    <Trash2 className="mr-1 h-3 w-3" />{tx('Apagar mensagem')}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={resolveReport.isPending}
                  onClick={() => resolveReport.mutate({ report: r, deleteMessage: false })}>
                  {tx('Manter (resolvida)')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {isLoading ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-10 w-48 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm font-medium">{tx('Sem mensagens')}</p>
            <p className="text-xs mt-1 text-muted-foreground/70">{tx('Envie a primeira mensagem para iniciar a conversa')}</p>
          </div>
        ) : (
          <div className="py-4 space-y-1">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                    {formatDateSeparator(group.date)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {group.messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user?.id;
                  const msgAny = msg as unknown as Record<string, unknown>;
                  const attachmentUrl = msgAny.attachment_url as string | undefined;
                  const attachmentName = msgAny.attachment_name as string | undefined;
                  const isPinned = msgAny.is_pinned as boolean | undefined;
                  const msgPriority = msgAny.priority_level as string | undefined;
                  const displayName = senderNames?.get(msg.sender_id) || msg.sender_name || tx('Utilizador');

                  const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                  const isSameSender = prevMsg?.sender_id === msg.sender_id;

                  return (
                    <div key={msg.id} className={cn(
                      'flex group',
                      isOwn ? 'justify-end' : 'justify-start',
                      !isSameSender ? 'mt-3' : 'mt-0.5'
                    )}>
                      <div className="relative max-w-[80%]">
                        {/* Sender name */}
                        {!isOwn && !isSameSender && (
                          <p className="text-[11px] font-medium text-muted-foreground mb-0.5 ml-1">
                            {displayName}
                          </p>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl px-3.5 py-2',
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md',
                            isPinned && 'ring-1 ring-primary/30',
                            msgPriority === 'important' && 'ring-1 ring-yellow-500/40',
                            msgPriority === 'urgent' && 'ring-2 ring-destructive/50',
                          )}
                        >
                          {isPinned && <Pin className="h-3 w-3 inline-block mr-1 opacity-60" />}
                          {msgPriority === 'urgent' && <AlertTriangle className="h-3 w-3 inline-block mr-1 text-destructive" />}
                          {attachmentUrl ? (
                            <a
                              href={attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm underline flex items-center gap-1.5"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              {attachmentName || tx('Ficheiro')}
                            </a>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          )}
                          <p className={cn(
                            'text-[10px] mt-1',
                            isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
                          )}>
                            {format(new Date(msg.created_at), 'HH:mm', { locale: pt })}
                          </p>
                        </div>
                        {/* Actions: always visible on touch screens, on hover with a mouse */}
                        <div className={cn('absolute -top-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100', isOwn ? '-left-7' : '-right-7')}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" aria-label={tx('Opções da mensagem')}>
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isOwn ? 'start' : 'end'}>
                              {canManage && (
                                <DropdownMenuItem onClick={() => handlePin(msg.id)}>
                                  <Pin className="h-3.5 w-3.5 mr-2" /> {tx('Fixar mensagem')}
                                </DropdownMenuItem>
                              )}
                              {!isOwn && (
                                <DropdownMenuItem onClick={() => { setReason(''); setReporting(msg); }}>
                                  <Flag className="h-3.5 w-3.5 mr-2" /> {tx('Denunciar mensagem')}
                                </DropdownMenuItem>
                              )}
                              {!isOwn && (
                                <DropdownMenuItem onClick={() => handleBlock(msg.sender_id, true)}>
                                  <Ban className="h-3.5 w-3.5 mr-2" /> {tx('Bloquear {{name}}', { name: displayName })}
                                </DropdownMenuItem>
                              )}
                              {(isOwn || canManage) && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(msg.id)}>
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> {tx('Apagar mensagem')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 bg-card">
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-9 w-9 rounded-lg"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tx('Escrever mensagem...')}
            className="flex-1 rounded-lg"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="shrink-0 h-9 w-9 rounded-lg"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <Dialog open={!!reporting} onOpenChange={(o) => { if (!o) setReporting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tx('Denunciar mensagem')}</DialogTitle>
            <DialogDescription>{tx('Quem gere o grupo e a equipa TreinON recebem a denúncia e analisam-na em 24 horas. Quem escreveu não sabe quem denunciou.')}</DialogDescription>
          </DialogHeader>
          {reporting && <p className="rounded-md bg-muted p-2 text-sm whitespace-pre-wrap break-words">{reporting.content}</p>}
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
            placeholder={tx('O que se passa? (ofensivo, assédio, spam…) — opcional')} />
          <DialogFooter className="gap-2">
            {reporting && (
              <Button variant="outline" onClick={() => handleBlock(reporting.sender_id, true)}>
                <Ban className="mr-1.5 h-4 w-4" />{tx('Bloquear também')}
              </Button>
            )}
            <Button variant="destructive" onClick={handleReport} disabled={reportMessage.isPending}>
              {reportMessage.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Flag className="mr-1.5 h-4 w-4" />}
              {tx('Enviar denúncia')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
