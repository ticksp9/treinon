import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';

// ---- Types ----
export interface CommunicationChannel {
  id: string;
  club_id: string | null;
  owner_id: string | null;
  team_id: string | null;
  created_by: string;
  channel_type: string;
  name: string;
  description: string | null;
  age_group: string | null;
  target_role: string | null;
  is_active: boolean;
  can_members_post: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

export interface CommunicationAnnouncement {
  id: string;
  club_id: string | null;
  channel_id: string | null;
  created_by: string;
  title: string;
  content: string;
  priority: string;
  target_type: string;
  target_value: string | null;
  created_at: string;
  read_count?: number;
  total_recipients?: number;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
}

export interface CommunicationReminder {
  id: string;
  club_id: string | null;
  channel_id: string | null;
  created_by: string;
  reminder_type: string;
  title: string;
  content: string | null;
  scheduled_for: string | null;
  is_sent: boolean;
  sent_at: string | null;
  related_match_id: string | null;
  related_training_id: string | null;
  created_at: string;
}

// ---- Context key for communication ----
// For club mode: clubId is set
// For individual coach mode: clubId is null, we use owner-based queries
export type CommContextKey = { clubId: string | null; userId: string | null };

// ---- Hooks ----

/**
 * Fetch channels - supports both club mode and individual coach mode.
 * In club mode: fetch by club_id.
 * In individual coach mode: fetch channels where owner_id or created_by = userId.
 */
export function useChannels(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['communication-channels', clubId, userId],
    queryFn: async () => {
      if (clubId) {
        // SECURITY: Query club channels — RLS enforces visibility
        // (membership, ownership, or admin/coordinator role)
        // The query scope is intentional: RLS filters to only accessible channels
        const { data, error } = await supabase
          .from('communication_channels')
          .select('*')
          .eq('club_id', clubId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as CommunicationChannel[];
      }
      if (userId) {
        // Individual coach mode OR guardian/player mode
        // RLS will enforce membership - fetch channels user is a member of, or owns
        const { data: memberChannels, error: memberErr } = await supabase
          .from('communication_channel_members')
          .select('channel_id')
          .eq('user_id', userId);
        if (memberErr) throw memberErr;

        const memberChannelIds = (memberChannels || []).map(m => m.channel_id);

        // Also get owned/created channels (for individual coaches)
        const { data: ownedChannels, error: ownedErr } = await supabase
          .from('communication_channels')
          .select('*')
          .is('club_id', null)
          .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (ownedErr) throw ownedErr;

        let allChannels = [...(ownedChannels || [])] as CommunicationChannel[];

        // Add channels where user is member but not owner
        if (memberChannelIds.length > 0) {
          const ownedIds = new Set(allChannels.map(c => c.id));
          const missingIds = memberChannelIds.filter(id => !ownedIds.has(id));
          if (missingIds.length > 0) {
            const { data: extraChannels } = await supabase
              .from('communication_channels')
              .select('*')
              .in('id', missingIds)
              .eq('is_active', true);
            if (extraChannels) {
              allChannels = [...allChannels, ...(extraChannels as CommunicationChannel[])];
            }
          }
        }

        return allChannels;
      }
      return [];
    },
    enabled: !!(clubId || userId),
  });
}

export function useChannelMessages(channelId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`messages-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'communication_messages',
        filter: `channel_id=eq.${channelId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['channel-messages', channelId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [channelId, queryClient]);

  return useQuery({
    queryKey: ['channel-messages', channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const { data, error } = await supabase
        .from('communication_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as CommunicationMessage[];
    },
    enabled: !!channelId,
  });
}

export function useSendMessage(channelId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!channelId || !user) throw new Error('Missing context');
      const { error } = await supabase
        .from('communication_messages')
        .insert({ channel_id: channelId, sender_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-messages', channelId] });
    },
  });
}

/**
 * Create channel - supports both club mode (clubId set) and individual coach mode (clubId null).
 */
export function useCreateChannel(clubId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      channel_type: string;
      description?: string;
      team_id?: string;
      age_group?: string;
      target_role?: string;
    }) => {
      if (!user) throw new Error('Missing context');
      const { data: channel, error } = await supabase
        .from('communication_channels')
        .insert({
          club_id: clubId || null,
          owner_id: clubId ? null : user.id,
          created_by: user.id,
          name: data.name,
          channel_type: data.channel_type,
          description: data.description || null,
          team_id: data.team_id || null,
          age_group: data.age_group || null,
          target_role: data.target_role || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Add creator as admin member
      await supabase
        .from('communication_channel_members')
        .insert({ channel_id: channel.id, user_id: user.id, role: 'admin' });

      return channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-channels'] });
    },
  });
}

export function useAnnouncements(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['communication-announcements', clubId, userId],
    queryFn: async () => {
      if (clubId) {
        const { data, error } = await supabase
          .from('communication_announcements')
          .select('*')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as CommunicationAnnouncement[];
      }
      if (userId) {
        const { data, error } = await supabase
          .from('communication_announcements')
          .select('*')
          .is('club_id', null)
          .eq('created_by', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as CommunicationAnnouncement[];
      }
      return [];
    },
    enabled: !!(clubId || userId),
  });
}

export function useAnnouncementReads(announcementId: string | null) {
  return useQuery({
    queryKey: ['announcement-reads', announcementId],
    queryFn: async () => {
      if (!announcementId) return [];
      const { data, error } = await supabase
        .from('communication_announcement_reads')
        .select('*')
        .eq('announcement_id', announcementId);
      if (error) throw error;
      return (data || []) as AnnouncementRead[];
    },
    enabled: !!announcementId,
  });
}

export function useCreateAnnouncement(clubId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      priority?: string;
      channel_id?: string;
      target_type?: string;
      target_value?: string;
    }) => {
      if (!user) throw new Error('Missing context');
      const { error } = await supabase
        .from('communication_announcements')
        .insert({
          club_id: clubId || null,
          created_by: user.id,
          title: data.title,
          content: data.content,
          priority: data.priority || 'normal',
          channel_id: data.channel_id || null,
          target_type: data.target_type || 'channel',
          target_value: data.target_value || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-announcements'] });
    },
  });
}

export function useMarkAnnouncementRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('communication_announcement_reads')
        .upsert(
          { announcement_id: announcementId, user_id: user.id },
          { onConflict: 'announcement_id,user_id' }
        );
      if (error) throw error;
    },
    onSuccess: (_, announcementId) => {
      queryClient.invalidateQueries({ queryKey: ['announcement-reads', announcementId] });
    },
  });
}

export function useReminders(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['communication-reminders', clubId, userId],
    queryFn: async () => {
      if (clubId) {
        const { data, error } = await supabase
          .from('communication_reminders')
          .select('*')
          .eq('club_id', clubId)
          .order('scheduled_for', { ascending: true });
        if (error) throw error;
        return (data || []) as CommunicationReminder[];
      }
      if (userId) {
        const { data, error } = await supabase
          .from('communication_reminders')
          .select('*')
          .is('club_id', null)
          .eq('created_by', userId)
          .order('scheduled_for', { ascending: true });
        if (error) throw error;
        return (data || []) as CommunicationReminder[];
      }
      return [];
    },
    enabled: !!(clubId || userId),
  });
}

export function useCreateReminder(clubId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content?: string;
      reminder_type: string;
      channel_id?: string;
      scheduled_for?: string;
      related_match_id?: string;
      related_training_id?: string;
    }) => {
      if (!user) throw new Error('Missing context');
      const { error } = await supabase
        .from('communication_reminders')
        .insert({
          club_id: clubId || null,
          created_by: user.id,
          title: data.title,
          content: data.content || null,
          reminder_type: data.reminder_type,
          channel_id: data.channel_id || null,
          scheduled_for: data.scheduled_for || null,
          related_match_id: data.related_match_id || null,
          related_training_id: data.related_training_id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-reminders'] });
    },
  });
}

export function useMarkReminderSent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from('communication_reminders')
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .eq('id', reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-reminders'] });
    },
  });
}
