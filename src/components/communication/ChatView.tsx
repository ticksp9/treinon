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
import { Send, MessageSquare, Loader2, Pin, MoreVertical, Paperclip, Users, Hash, AlertTriangle, BellOff } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { pt } from 'date-fns/locale';
import { uploadCommunicationFile } from '@/hooks/useCommunicationPhase2';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatViewProps {
  channelId: string;
  channelName: string;
  canManage?: boolean;
  channelType?: string;
  channelDescription?: string | null;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "d 'de' MMMM yyyy", { locale: pt });
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
      onError: () => toast.error('Erro ao enviar mensagem. Tente novamente.'),
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
      toast.success('Ficheiro enviado');
    } catch {
      toast.error('Erro ao enviar ficheiro');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePin = (messageId: string) => {
    pinMessage.mutate(
      { channelId, messageId },
      { onSuccess: () => toast.success('Mensagem fixada') }
    );
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: CommunicationMessage[] }[] = [];
    let currentDate = '';
    messages.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  }, [messages]);

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
          <Badge variant="secondary" className="text-xs gap-1">
            <Users className="h-3 w-3" />
            {memberCount}
          </Badge>
        </div>
      </div>

      {/* Pinned messages */}
      <PinnedMessages channelId={channelId} canManage={canManage} />

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
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm font-medium">Sem mensagens</p>
            <p className="text-xs mt-1 text-muted-foreground/70">Envie a primeira mensagem para iniciar a conversa</p>
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
                  const displayName = senderNames?.get(msg.sender_id) || msg.sender_name || 'Utilizador';

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
                              {attachmentName || 'Ficheiro'}
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
                        {/* Actions */}
                        {canManage && (
                          <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow-sm">
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handlePin(msg.id)}>
                                  <Pin className="h-3.5 w-3.5 mr-2" /> Fixar mensagem
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
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
            placeholder="Escrever mensagem..."
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
    </div>
  );
}
