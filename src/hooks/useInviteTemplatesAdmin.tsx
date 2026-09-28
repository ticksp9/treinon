import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface InviteTemplate {
  id: string;
  template_key: string;
  profile_type: string;
  delivery_channel: string;
  language: string;
  name: string | null;
  description: string | null;
  subject_template: string | null;
  body_template: string;
  is_default: boolean;
  is_active: boolean;
  version_number: number;
  status: string;
  club_id: string | null;
  owner_coach_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  subject_template: string | null;
  body_template: string;
  change_notes: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TemplateEvent {
  id: string;
  template_id: string;
  version_id: string | null;
  event_type: string;
  actor_user_id: string | null;
  payload: any;
  created_at: string;
}

export function useAllInviteTemplates(filters?: {
  profileType?: string;
  channel?: string;
  language?: string;
  isActive?: boolean;
  isDefault?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['admin-invite-templates', filters],
    queryFn: async () => {
      let query = supabase
        .from('invite_templates')
        .select('*')
        .order('profile_type')
        .order('delivery_channel')
        .order('is_default', { ascending: false });

      if (filters?.profileType) query = query.eq('profile_type', filters.profileType);
      if (filters?.channel) query = query.eq('delivery_channel', filters.channel);
      if (filters?.language) query = query.eq('language', filters.language);
      if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive);
      if (filters?.isDefault !== undefined) query = query.eq('is_default', filters.isDefault);
      if (filters?.search) query = query.or(`name.ilike.%${filters.search}%,template_key.ilike.%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as InviteTemplate[];
    },
  });
}

export function useTemplateVersions(templateId: string | null) {
  return useQuery({
    queryKey: ['template-versions', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('invite_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data || []) as TemplateVersion[];
    },
    enabled: !!templateId,
  });
}

export function useTemplateEvents(templateId: string | null) {
  return useQuery({
    queryKey: ['template-events', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('invite_template_events')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as TemplateEvent[];
    },
    enabled: !!templateId,
  });
}

export function useCreateInviteTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      template_key: string;
      profile_type: string;
      delivery_channel: string;
      language?: string;
      name: string;
      description?: string;
      subject_template?: string;
      body_template: string;
      is_default?: boolean;
      status?: string;
      club_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('invite_templates')
        .insert({
          ...params,
          language: params.language || 'pt',
          is_default: params.is_default || false,
          is_active: params.status === 'published',
          status: params.status || 'draft',
          created_by: user?.id,
          updated_by: user?.id,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Create initial version
      await supabase.from('invite_template_versions').insert({
        template_id: data.id,
        version_number: 1,
        subject_template: params.subject_template || null,
        body_template: params.body_template,
        is_published: params.status === 'published',
        created_by: user?.id,
      });

      // Log event
      await supabase.from('invite_template_events').insert({
        template_id: data.id,
        event_type: 'created',
        actor_user_id: user?.id,
        payload: { name: params.name, profile_type: params.profile_type, delivery_channel: params.delivery_channel },
      });

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invite-templates'] }),
  });
}

export function useUpdateInviteTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      description?: string;
      subject_template?: string;
      body_template?: string;
      is_default?: boolean;
      is_active?: boolean;
      status?: string;
      change_notes?: string;
    }) => {
      const { id, change_notes, ...updates } = params;

      // Fetch current to increment version
      const { data: current } = await supabase
        .from('invite_templates')
        .select('version_number, body_template, subject_template')
        .eq('id', id)
        .single();

      const newVersion = (current?.version_number || 0) + 1;
      const bodyChanged = params.body_template && params.body_template !== current?.body_template;
      const subjectChanged = params.subject_template !== undefined && params.subject_template !== current?.subject_template;

      const { error } = await supabase
        .from('invite_templates')
        .update({
          ...updates,
          version_number: bodyChanged || subjectChanged ? newVersion : current?.version_number,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      // Create version snapshot if content changed
      if (bodyChanged || subjectChanged) {
        await supabase.from('invite_template_versions').insert({
          template_id: id,
          version_number: newVersion,
          subject_template: params.subject_template ?? current?.subject_template,
          body_template: params.body_template ?? current?.body_template ?? '',
          change_notes: change_notes || null,
          is_published: params.status === 'published' || params.is_active === true,
          created_by: user?.id,
        });
      }

      // Log event
      const eventType = params.is_active !== undefined
        ? (params.is_active ? 'activated' : 'deactivated')
        : params.is_default !== undefined
          ? (params.is_default ? 'set_default' : 'unset_default')
          : 'edited';

      await supabase.from('invite_template_events').insert({
        template_id: id,
        event_type: eventType,
        actor_user_id: user?.id,
        payload: { changes: Object.keys(updates) },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invite-templates'] });
      qc.invalidateQueries({ queryKey: ['template-versions'] });
      qc.invalidateQueries({ queryKey: ['template-events'] });
    },
  });
}

export function useDuplicateTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: src } = await supabase
        .from('invite_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (!src) throw new Error('Template not found');

      const { data, error } = await supabase
        .from('invite_templates')
        .insert({
          template_key: `${src.template_key}_copy_${Date.now()}`,
          profile_type: src.profile_type,
          delivery_channel: src.delivery_channel,
          language: src.language,
          name: `${src.name || src.template_key} (cópia)`,
          description: src.description,
          subject_template: src.subject_template,
          body_template: src.body_template,
          is_default: false,
          is_active: false,
          status: 'draft',
          version_number: 1,
          club_id: src.club_id,
          owner_coach_id: src.owner_coach_id,
          created_by: user?.id,
          updated_by: user?.id,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Create initial version for duplicate
      await supabase.from('invite_template_versions').insert({
        template_id: data.id,
        version_number: 1,
        subject_template: src.subject_template,
        body_template: src.body_template,
        is_published: false,
        created_by: user?.id,
      });

      await supabase.from('invite_template_events').insert({
        template_id: data.id,
        event_type: 'duplicated',
        actor_user_id: user?.id,
        payload: { source_template_id: templateId },
      });

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invite-templates'] }),
  });
}

export function useRollbackTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { templateId: string; version: TemplateVersion }) => {
      const { templateId, version } = params;

      // Get current version number
      const { data: current } = await supabase
        .from('invite_templates')
        .select('version_number')
        .eq('id', templateId)
        .single();

      const newVersion = (current?.version_number || 0) + 1;

      // Update template with old content as new version
      const { error } = await supabase
        .from('invite_templates')
        .update({
          subject_template: version.subject_template,
          body_template: version.body_template,
          version_number: newVersion,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId);
      if (error) throw error;

      // Create new version entry (rollback creates a NEW version, not deletion)
      await supabase.from('invite_template_versions').insert({
        template_id: templateId,
        version_number: newVersion,
        subject_template: version.subject_template,
        body_template: version.body_template,
        change_notes: `Rollback para v${version.version_number}`,
        is_published: true,
        created_by: user?.id,
      });

      // Log event
      await supabase.from('invite_template_events').insert({
        template_id: templateId,
        event_type: 'rollback_created',
        actor_user_id: user?.id,
        payload: { from_version: version.version_number, to_version: newVersion },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invite-templates'] });
      qc.invalidateQueries({ queryKey: ['template-versions'] });
      qc.invalidateQueries({ queryKey: ['template-events'] });
    },
  });
}
