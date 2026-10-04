import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

// ---- Types ----

export interface CallupConfirmation {
  id: string;
  match_id: string;
  player_id: string;
  confirmed_by: string;
  status: string;
  comment: string | null;
  confirmation_deadline: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface CallupNotification {
  id: string;
  match_id: string;
  club_id: string;
  team_id: string;
  created_by: string;
  notification_type: string;
  target_audience: string;
  message: string | null;
  template_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface GuardianNotificationPreferences {
  id: string;
  guardian_id: string;
  match_reminders: boolean;
  training_reminders: boolean;
  announcement_alerts: boolean;
  callup_alerts: boolean;
  unread_followup: boolean;
}

export interface EngagementSnapshot {
  id: string;
  club_id: string;
  team_id: string | null;
  period_start: string;
  period_end: string;
  metric_type: string;
  metric_value: number;
  details: Record<string, unknown> | null;
}

// ---- Guardian Portal ----

export function useGuardianProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['guardian-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('guardian_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

export function useGuardianAthletes(guardianId: string | null) {
  return useQuery({
    queryKey: ['guardian-athletes', guardianId],
    queryFn: async () => {
      if (!guardianId) return [];
      const { data, error } = await supabase
        .from('player_guardians')
        .select('*, players(id, name, number, position, photo_url, team_id, is_active, teams(id, name, category))')
        .eq('guardian_id', guardianId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!guardianId,
  });
}

export function useGuardianNotificationPrefs(guardianId: string | null) {
  return useQuery({
    queryKey: ['guardian-notif-prefs', guardianId],
    queryFn: async () => {
      if (!guardianId) return null;
      const { data, error } = await supabase
        .from('guardian_notification_preferences')
        .select('*')
        .eq('guardian_id', guardianId)
        .maybeSingle();
      if (error) throw error;
      return data as GuardianNotificationPreferences | null;
    },
    enabled: !!guardianId,
  });
}

export function useUpdateGuardianNotifPrefs(guardianId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Partial<GuardianNotificationPreferences>) => {
      if (!guardianId) throw new Error('No guardian');
      const { error } = await supabase
        .from('guardian_notification_preferences')
        .upsert({
          guardian_id: guardianId,
          match_reminders: prefs.match_reminders ?? true,
          training_reminders: prefs.training_reminders ?? true,
          announcement_alerts: prefs.announcement_alerts ?? true,
          callup_alerts: prefs.callup_alerts ?? true,
          unread_followup: prefs.unread_followup ?? true,
        }, { onConflict: 'guardian_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guardian-notif-prefs', guardianId] }),
  });
}

// ---- Callup Confirmations ----

export function useCallupConfirmations(matchId: string | null) {
  return useQuery({
    queryKey: ['callup-confirmations', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from('callup_confirmations')
        .select('*')
        .eq('match_id', matchId);
      if (error) throw error;
      return (data || []) as CallupConfirmation[];
    },
    enabled: !!matchId,
  });
}

export function useRespondCallup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { matchId: string; playerId: string; status: string; comment?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('callup_confirmations')
        .upsert({
          match_id: data.matchId,
          player_id: data.playerId,
          confirmed_by: user.id,
          status: data.status,
          comment: data.comment || null,
          responded_at: new Date().toISOString(),
        }, { onConflict: 'match_id,player_id' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['callup-confirmations', vars.matchId] }),
  });
}

export function useCreateCallupConfirmations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { matchId: string; playerIds: string[]; deadline?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const records = data.playerIds.map(pid => ({
        match_id: data.matchId,
        player_id: pid,
        confirmed_by: user.id,
        status: 'pending',
        confirmation_deadline: data.deadline || null,
      }));
      for (const rec of records) {
        await supabase.from('callup_confirmations').upsert(rec, { onConflict: 'match_id,player_id' });
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['callup-confirmations', vars.matchId] }),
  });
}

// ---- Callup Notifications ----

export function useCallupNotifications(matchId: string | null) {
  return useQuery({
    queryKey: ['callup-notifications', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from('callup_notifications')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CallupNotification[];
    },
    enabled: !!matchId,
  });
}

export function useSendCallupNotification() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      matchId: string;
      clubId: string;
      teamId: string;
      notificationType: string;
      targetAudience: string;
      message?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('callup_notifications').insert({
        match_id: data.matchId,
        club_id: data.clubId,
        team_id: data.teamId,
        created_by: user.id,
        notification_type: data.notificationType,
        target_audience: data.targetAudience,
        message: data.message || null,
        sent_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['callup-notifications', vars.matchId] }),
  });
}

// ---- Engagement Analytics (dual-mode: club or individual coach) ----

export function useAnnouncementEngagement(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['announcement-engagement', clubId, userId],
    queryFn: async () => {
      let query = supabase
        .from('communication_announcements')
        .select('id, title, priority, created_at, target_type');

      if (clubId) {
        query = query.eq('club_id', clubId);
      } else if (userId) {
        query = query.is('club_id', null).eq('created_by', userId);
      } else {
        return { announcements: [], totalReads: 0, totalAnnouncements: 0 };
      }

      const { data: announcements, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;

      const enriched = await Promise.all((announcements || []).map(async (a) => {
        const { count } = await supabase
          .from('communication_announcement_reads')
          .select('*', { count: 'exact', head: true })
          .eq('announcement_id', a.id);
        return { ...a, read_count: count || 0 };
      }));

      return {
        announcements: enriched,
        totalReads: enriched.reduce((s, a) => s + a.read_count, 0),
        totalAnnouncements: enriched.length,
      };
    },
    enabled: !!(clubId || userId),
  });
}

export function useAttendanceEngagement(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['attendance-engagement', clubId, userId],
    queryFn: async () => {
      let query = supabase
        .from('attendance_requests')
        .select('id, event_title, event_type, event_date, status');

      if (clubId) {
        query = query.eq('club_id', clubId);
      } else if (userId) {
        query = query.is('club_id', null).eq('created_by', userId);
      } else {
        return { requests: [], stats: { confirmed: 0, declined: 0, pending: 0, total: 0 } };
      }

      const { data: requests, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;

      let confirmed = 0, declined = 0, pending = 0;
      for (const req of (requests || [])) {
        const { data: responses } = await supabase
          .from('attendance_responses')
          .select('response')
          .eq('request_id', req.id);
        (responses || []).forEach(r => {
          if (r.response === 'confirmed') confirmed++;
          else if (r.response === 'declined') declined++;
          else pending++;
        });
      }

      return {
        requests: requests || [],
        stats: { confirmed, declined, pending, total: confirmed + declined + pending },
      };
    },
    enabled: !!(clubId || userId),
  });
}

export function useChannelEngagement(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['channel-engagement', clubId, userId],
    queryFn: async () => {
      let query = supabase
        .from('communication_channels')
        .select('id, name, channel_type, team_id, age_group')
        .eq('is_active', true);

      if (clubId) {
        query = query.eq('club_id', clubId);
      } else if (userId) {
        query = query.is('club_id', null).or(`owner_id.eq.${userId},created_by.eq.${userId}`);
      } else {
        return [];
      }

      const { data: channels, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all((channels || []).map(async (ch) => {
        const { count: messageCount } = await supabase
          .from('communication_messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', ch.id);
        const { count: memberCount } = await supabase
          .from('communication_channel_members')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', ch.id);
        return {
          ...ch,
          message_count: messageCount || 0,
          member_count: memberCount || 0,
        };
      }));

      return enriched.sort((a, b) => b.message_count - a.message_count);
    },
    enabled: !!(clubId || userId),
  });
}

// ---- Guardian Portal: upcoming events for linked athletes ----

export function useGuardianUpcomingEvents(teamIds: string[]) {
  return useQuery({
    queryKey: ['guardian-upcoming-events', teamIds],
    queryFn: async () => {
      if (!teamIds.length) return { matches: [], trainings: [] };
      const now = new Date().toISOString();

      const { data: matches } = await supabase
        .from('matches')
        .select('id, match_date, opponent_name, is_home, location, competition, status, team_id')
        .in('team_id', teamIds)
        .eq('is_deleted', false)
        .gte('match_date', now)
        .order('match_date', { ascending: true })
        .limit(10);

      const { data: trainings } = await supabase
        .from('coach_trainings')
        .select('id, name, training_date, team_id, status')
        .in('team_id', teamIds)
        .gte('training_date', now)
        .order('training_date', { ascending: true })
        .limit(10);

      return { matches: matches || [], trainings: trainings || [] };
    },
    enabled: teamIds.length > 0,
  });
}

export function useGuardianAnnouncements(teamIds: string[]) {
  return useQuery({
    queryKey: ['guardian-announcements', teamIds],
    queryFn: async () => {
      if (!teamIds.length) return [];
      const { data: channels } = await supabase
        .from('communication_channels')
        .select('id')
        .in('team_id', teamIds);
      
      const channelIds = (channels || []).map(c => c.id);
      
      if (channelIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('communication_announcements')
        .select('*')
        .in('channel_id', channelIds)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: teamIds.length > 0,
  });
}

export function useGuardianCallups(playerIds: string[]) {
  return useQuery({
    queryKey: ['guardian-callups', playerIds],
    queryFn: async () => {
      if (!playerIds.length) return [];
      const { data, error } = await supabase
        .from('match_lineups')
        .select('player_id, match_id, matches!inner(id, match_date, opponent_name, is_home, location, competition, status, team_id)')
        .in('player_id', playerIds)
        .eq('matches.is_deleted', false)
        .order('match_id', { ascending: false });
      if (error) throw error;
      
      const now = new Date();
      return (data || []).filter((d: any) => {
        const m = d.matches;
        return m && new Date(m.match_date) >= now && m.status !== 'completed' && m.status !== 'cancelled';
      });
    },
    enabled: playerIds.length > 0,
  });
}

export function useGuardianPendingConfirmations(playerIds: string[]) {
  return useQuery({
    queryKey: ['guardian-pending-confirmations', playerIds],
    queryFn: async () => {
      if (!playerIds.length) return [];
      const { data, error } = await supabase
        .from('callup_confirmations')
        .select('*, matches(id, match_date, opponent_name, is_home, location, team_id)')
        .in('player_id', playerIds)
        .eq('status', 'pending');
      if (error) throw error;
      return data || [];
    },
    enabled: playerIds.length > 0,
  });
}

export function useGuardianAttendanceRequests(teamIds: string[]) {
  return useQuery({
    queryKey: ['guardian-attendance-requests', teamIds],
    queryFn: async () => {
      if (!teamIds.length) return [];
      const { data, error } = await supabase
        .from('attendance_requests')
        .select('*')
        .in('team_id', teamIds)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: teamIds.length > 0,
  });
}
