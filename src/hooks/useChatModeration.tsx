/**
 * Reporting and blocking in the chat (App Store guideline 1.2).
 * A report reaches the group's managers (inside the chat) and the support address (email);
 * blocking hides that person's messages for whoever blocked.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { sendNotice } from '@/lib/notice';

const db = supabase as any; // newer than the generated types

export interface MessageReport {
  id: string;
  message_id: string | null;
  channel_id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  message_content: string | null;
  reason: string;
  status: 'open' | 'resolved';
  created_at: string;
}

export function useBlockedUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-blocks', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await db.from('user_blocks').select('blocked_id').eq('blocker_id', user!.id);
      if (error) throw error;
      return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
    },
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, block }: { userId: string; block: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = block
        ? await db.from('user_blocks').upsert({ blocker_id: user.id, blocked_id: userId }, { onConflict: 'blocker_id,blocked_id' })
        : await db.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-blocks'] }),
  });
}

export function useReportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, reason }: { messageId: string; reason: string }) => {
      const { data, error } = await db.from('communication_message_reports')
        .insert({ message_id: messageId, reason }).select('id, channel_id').single();
      if (error) throw error;
      // the email is best effort: the report is already saved for the group's managers
      void sendNotice({ kind: 'message_report', report_id: data.id });
      return data as { id: string; channel_id: string };
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ['message-reports', r.channel_id] }),
  });
}

/** Open reports of a group: only its managers get rows back (RLS). */
export function useChannelReports(channelId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['message-reports', channelId],
    enabled: !!channelId && enabled,
    queryFn: async (): Promise<MessageReport[]> => {
      const { data, error } = await db.from('communication_message_reports')
        .select('*').eq('channel_id', channelId).eq('status', 'open').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ report, deleteMessage }: { report: MessageReport; deleteMessage: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (deleteMessage && report.message_id) {
        const { error } = await db.from('communication_messages').delete().eq('id', report.message_id);
        if (error) throw error;
      }
      const { error } = await db.from('communication_message_reports')
        .update({ status: 'resolved', resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
        .eq('id', report.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['message-reports', v.report.channel_id] });
      qc.invalidateQueries({ queryKey: ['channel-messages', v.report.channel_id] });
    },
  });
}

export function useDeleteMessage(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await db.from('communication_messages').delete().eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-messages', channelId] }),
  });
}
