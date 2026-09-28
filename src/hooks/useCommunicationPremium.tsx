import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useEffect, useMemo, useCallback } from 'react';

// ---- Unread tracking via communication_member_states ----

export interface UnreadCount {
  channelId: string;
  count: number;
}

/**
 * Fetches unread counts from communication_member_states (DB-driven, trigger-maintained).
 */
export function useUnreadCounts(channelIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-counts', channelIds.sort().join(','), user?.id],
    queryFn: async () => {
      if (!user || channelIds.length === 0) return [] as UnreadCount[];

      const { data, error } = await supabase
        .from('communication_member_states')
        .select('channel_id, unread_count')
        .eq('user_id', user.id)
        .in('channel_id', channelIds)
        .gt('unread_count', 0);

      if (error) throw error;
      return (data || []).map((d: any) => ({
        channelId: d.channel_id,
        count: d.unread_count || 0,
      }));
    },
    enabled: !!user && channelIds.length > 0,
    refetchInterval: 30000,
  });
}

/**
 * Marks a channel as read — resets unread_count to 0.
 */
export function useMarkChannelRead() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) throw new Error('Not authenticated');
      const now = new Date().toISOString();

      // Upsert member state to zero unread
      const { error } = await supabase
        .from('communication_member_states')
        .upsert({
          channel_id: channelId,
          user_id: user.id,
          unread_count: 0,
          last_read_at: now,
          last_seen_at: now,
          updated_at: now,
        }, { onConflict: 'channel_id,user_id' });

      if (error) throw error;

      // Also update legacy last_read_at on channel_members
      await supabase
        .from('communication_channel_members')
        .update({ last_read_at: now } as any)
        .eq('channel_id', channelId)
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unread-counts'] });
    },
  });
}

/**
 * Fetches last message preview per channel using channel.last_message_preview
 * Falls back to querying messages if channel doesn't have it yet.
 */
export function useChannelPreviews(channelIds: string[]) {
  return useQuery({
    queryKey: ['channel-previews', channelIds.sort().join(',')],
    queryFn: async () => {
      if (channelIds.length === 0) return new Map<string, { content: string; sender_id: string; created_at: string }>();

      const results = new Map<string, { content: string; sender_id: string; created_at: string }>();

      // Batch: fetch last message per channel
      for (const channelId of channelIds) {
        const { data } = await supabase
          .from('communication_messages')
          .select('content, sender_id, created_at')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          results.set(channelId, data);
        }
      }
      return results;
    },
    enabled: channelIds.length > 0,
    refetchInterval: 30000,
  });
}

/**
 * Fetches sender profile display names for message rendering
 */
export function useSenderProfiles(senderIds: string[]) {
  const uniqueIds = [...new Set(senderIds)].filter(Boolean);

  return useQuery({
    queryKey: ['sender-profiles', uniqueIds.sort().join(',')],
    queryFn: async () => {
      if (uniqueIds.length === 0) return new Map<string, string>();
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, username')
        .in('id', uniqueIds);

      const map = new Map<string, string>();
      (data || []).forEach(p => {
        map.set(p.id, p.display_name || p.full_name || p.username || 'Utilizador');
      });
      return map;
    },
    enabled: uniqueIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Realtime subscription for new messages across all channels
 */
export function useRealtimeMessages(channelIds: string[], onNewMessage?: (channelId: string) => void) {
  const qc = useQueryClient();

  useEffect(() => {
    if (channelIds.length === 0) return;

    const channel = supabase
      .channel('global-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'communication_messages',
      }, (payload) => {
        const channelId = payload.new?.channel_id;
        if (channelId && channelIds.includes(channelId)) {
          qc.invalidateQueries({ queryKey: ['channel-messages', channelId] });
          qc.invalidateQueries({ queryKey: ['unread-counts'] });
          qc.invalidateQueries({ queryKey: ['channel-previews'] });
          onNewMessage?.(channelId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelIds.join(','), qc, onNewMessage]);
}

/**
 * Realtime subscription for new announcements
 */
export function useRealtimeAnnouncements(clubId: string | null, onNew?: () => void) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!clubId) return;

    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'communication_announcements',
        filter: `club_id=eq.${clubId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['communication-announcements'] });
        onNew?.();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, qc, onNew]);
}

/**
 * Channel member count
 */
export function useChannelMemberCount(channelId: string | null) {
  return useQuery({
    queryKey: ['channel-member-count', channelId],
    queryFn: async () => {
      if (!channelId) return 0;
      const { count } = await supabase
        .from('communication_channel_members')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId);
      return count || 0;
    },
    enabled: !!channelId,
  });
}

// ---- Notifications Feed ----

export interface AppNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  priority_level: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
  channel_id: string | null;
  team_id: string | null;
}

export function useNotificationsFeed(limit = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications-feed', user?.id, limit],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('communication_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as AppNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-notification-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('communication_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_dismissed', false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('communication_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-feed'] });
      qc.invalidateQueries({ queryKey: ['unread-notification-count'] });
    },
  });
}

export function useDismissNotification() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('communication_notifications')
        .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-feed'] });
      qc.invalidateQueries({ queryKey: ['unread-notification-count'] });
    },
  });
}

/**
 * Realtime for notifications
 */
export function useRealtimeNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'communication_notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['notifications-feed'] });
        qc.invalidateQueries({ queryKey: ['unread-notification-count'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}

/**
 * Realtime for member state changes (unread updates)
 */
export function useRealtimeMemberStates() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('member-states')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'communication_member_states',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['unread-counts'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}

/**
 * Global unread summary: messages + announcements + pending items
 */
export function useUnreadSummary(channelIds: string[]) {
  const { data: unreadCounts = [] } = useUnreadCounts(channelIds);
  const { data: notifCount = 0 } = useUnreadNotificationCount();

  return useMemo(() => {
    const totalMessages = unreadCounts.reduce((s, u) => s + u.count, 0);
    return {
      totalMessages,
      totalNotifications: notifCount,
      total: totalMessages + notifCount,
      unreadCounts,
    };
  }, [unreadCounts, notifCount]);
}
