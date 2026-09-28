import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

// ---- Types ----

export interface AttendanceRequest {
  id: string;
  club_id: string | null;
  team_id: string | null;
  created_by: string;
  event_type: string;
  event_title: string;
  event_date: string | null;
  deadline: string | null;
  related_match_id: string | null;
  related_training_id: string | null;
  channel_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceResponse {
  id: string;
  request_id: string;
  user_id: string;
  player_id: string | null;
  response: string;
  comment: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface CommunicationTemplate {
  id: string;
  club_id: string | null;
  created_by: string;
  scope: string;
  category: string;
  title: string;
  content: string;
  placeholders: unknown[];
  is_active: boolean;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  club_id: string | null;
  created_by: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  target_audience: string;
  target_channel_id: string | null;
  template_id: string | null;
  team_id: string | null;
  is_enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface CommunicationPin {
  id: string;
  channel_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
}

// ---- Attendance ----

export function useAttendanceRequests(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['attendance-requests', clubId, userId],
    queryFn: async () => {
      if (clubId) {
        const { data, error } = await supabase
          .from('attendance_requests')
          .select('*')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as AttendanceRequest[];
      }
      if (userId) {
        const { data, error } = await supabase
          .from('attendance_requests')
          .select('*')
          .is('club_id', null)
          .eq('created_by', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as AttendanceRequest[];
      }
      return [];
    },
    enabled: !!(clubId || userId),
  });
}

export function useAttendanceResponses(requestId: string | null) {
  return useQuery({
    queryKey: ['attendance-responses', requestId],
    queryFn: async () => {
      if (!requestId) return [];
      const { data, error } = await supabase
        .from('attendance_responses')
        .select('*')
        .eq('request_id', requestId);
      if (error) throw error;
      return (data || []) as AttendanceResponse[];
    },
    enabled: !!requestId,
  });
}

export function useCreateAttendanceRequest(clubId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      event_type: string;
      event_title: string;
      event_date?: string;
      deadline?: string;
      team_id?: string;
      channel_id?: string;
      related_match_id?: string;
      related_training_id?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Missing context');
      const { error } = await supabase.from('attendance_requests').insert({
        club_id: clubId || null,
        created_by: user.id,
        event_type: data.event_type,
        event_title: data.event_title,
        event_date: data.event_date || null,
        deadline: data.deadline || null,
        team_id: data.team_id || null,
        channel_id: data.channel_id || null,
        related_match_id: data.related_match_id || null,
        related_training_id: data.related_training_id || null,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-requests'] }),
  });
}

export function useRespondAttendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { requestId: string; response: string; comment?: string; playerId?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('attendance_responses').upsert(
        {
          request_id: data.requestId,
          user_id: user.id,
          player_id: data.playerId || null,
          response: data.response,
          comment: data.comment || null,
          responded_at: new Date().toISOString(),
        },
        { onConflict: 'request_id,user_id' }
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['attendance-responses', vars.requestId] }),
  });
}

// ---- Templates ----

export function useTemplates(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['communication-templates', clubId, userId],
    queryFn: async () => {
      if (clubId) {
        const { data, error } = await supabase
          .from('communication_templates')
          .select('*')
          .eq('club_id', clubId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as CommunicationTemplate[];
      }
      if (userId) {
        const { data, error } = await supabase
          .from('communication_templates')
          .select('*')
          .is('club_id', null)
          .eq('created_by', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as CommunicationTemplate[];
      }
      return [];
    },
    enabled: !!(clubId || userId),
  });
}

export function useCreateTemplate(clubId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      category: string;
      scope?: string;
      placeholders?: string[];
    }) => {
      if (!user) throw new Error('Missing context');
      const { error } = await supabase.from('communication_templates').insert({
        club_id: clubId || null,
        created_by: user.id,
        title: data.title,
        content: data.content,
        category: data.category,
        scope: data.scope || 'personal',
        placeholders: data.placeholders ? JSON.stringify(data.placeholders) : '[]',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication-templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('communication_templates')
        .update({ is_active: false })
        .eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication-templates'] }),
  });
}

// ---- Pinned Messages ----

export function usePinnedMessages(channelId: string | null) {
  return useQuery({
    queryKey: ['pinned-messages', channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const { data, error } = await supabase
        .from('communication_pins')
        .select('*, communication_messages(*)')
        .eq('channel_id', channelId)
        .order('pinned_at', { ascending: false });
      if (error) throw error;
      return (data || []) as (CommunicationPin & { communication_messages: { id: string; content: string; sender_id: string; created_at: string } })[];
    },
    enabled: !!channelId,
  });
}

export function usePinMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { channelId: string; messageId: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error: pinError } = await supabase.from('communication_pins').insert({
        channel_id: data.channelId,
        message_id: data.messageId,
        pinned_by: user.id,
      });
      if (pinError) throw pinError;
      await supabase.from('communication_messages').update({ is_pinned: true }).eq('id', data.messageId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pinned-messages', vars.channelId] });
      qc.invalidateQueries({ queryKey: ['channel-messages', vars.channelId] });
    },
  });
}

export function useUnpinMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { channelId: string; messageId: string }) => {
      const { error } = await supabase
        .from('communication_pins')
        .delete()
        .eq('channel_id', data.channelId)
        .eq('message_id', data.messageId);
      if (error) throw error;
      await supabase.from('communication_messages').update({ is_pinned: false }).eq('id', data.messageId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pinned-messages', vars.channelId] });
      qc.invalidateQueries({ queryKey: ['channel-messages', vars.channelId] });
    },
  });
}

// ---- Automations ----

export function useAutomationRules(clubId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['automation-rules', clubId, userId],
    queryFn: async () => {
      if (clubId) {
        const { data, error } = await supabase
          .from('communication_automation_rules')
          .select('*')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as AutomationRule[];
      }
      if (userId) {
        const { data, error } = await supabase
          .from('communication_automation_rules')
          .select('*')
          .is('club_id', null)
          .eq('created_by', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as AutomationRule[];
      }
      return [];
    },
    enabled: !!(clubId || userId),
  });
}

export function useCreateAutomationRule(clubId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      trigger_type: string;
      trigger_config?: Record<string, unknown>;
      target_audience: string;
      target_channel_id?: string;
      template_id?: string;
      team_id?: string;
    }) => {
      if (!user) throw new Error('Missing context');
      const { error } = await supabase.from('communication_automation_rules').insert({
        club_id: clubId || null,
        created_by: user.id,
        name: data.name,
        trigger_type: data.trigger_type,
        trigger_config: (data.trigger_config || {}) as unknown as string,
        target_audience: data.target_audience,
        target_channel_id: data.target_channel_id || null,
        template_id: data.template_id || null,
        team_id: data.team_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('communication_automation_rules')
        .update({ is_enabled: data.is_enabled })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('communication_automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

// ---- File Upload Helper ----

export async function uploadCommunicationFile(userId: string, file: File): Promise<{ url: string; name: string; type: string; size: number }> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('communication-attachments')
    .upload(path, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from('communication-attachments')
    .getPublicUrl(path);
  return {
    url: urlData.publicUrl,
    name: file.name,
    type: file.type || ext,
    size: file.size,
  };
}
