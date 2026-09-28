
-- ============================================================
-- COMMUNICATION PHASE 2: Guardians, Attendance, Attachments,
-- Pins, Templates, Automations
-- ============================================================

-- 1. GUARDIAN PROFILES
CREATE TABLE public.guardian_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. PLAYER-GUARDIAN LINK (many-to-many)
CREATE TABLE public.player_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES public.guardian_profiles(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, guardian_id)
);

-- 3. ATTENDANCE REQUESTS
CREATE TABLE public.attendance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'training', -- training, match, other
  event_title TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  related_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  related_training_id UUID REFERENCES public.coach_trainings(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.communication_channels(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ATTENDANCE RESPONSES (per recipient)
CREATE TABLE public.attendance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.attendance_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  response TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, declined, maybe
  comment TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, user_id)
);

-- 5. COMMUNICATION ATTACHMENTS
CREATE TABLE public.communication_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES public.communication_announcements(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PINNED MESSAGES
CREATE TABLE public.communication_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.communication_channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, message_id)
);

-- 7. COMMUNICATION TEMPLATES
CREATE TABLE public.communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'personal', -- personal, team, club
  category TEXT NOT NULL DEFAULT 'announcement', -- announcement, reminder, attendance
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  placeholders JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. AUTOMATION RULES
CREATE TABLE public.communication_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- training_created, match_created, time_before_training, time_before_match, event_changed, event_cancelled, attendance_followup
  trigger_config JSONB DEFAULT '{}'::jsonb, -- e.g. {"hours_before": 24}
  target_audience TEXT NOT NULL DEFAULT 'full_team', -- full_team, parents, athletes, staff, custom
  target_channel_id UUID REFERENCES public.communication_channels(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  is_enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. AUTOMATION LOGS
CREATE TABLE public.communication_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.communication_automation_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_count INT DEFAULT 0,
  status TEXT DEFAULT 'sent', -- sent, failed, skipped
  details JSONB DEFAULT '{}'::jsonb
);

-- Add is_pinned to messages for fast lookups
ALTER TABLE public.communication_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
-- Add attachment_url to messages for simple inline attachments
ALTER TABLE public.communication_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.communication_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.guardian_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_automation_logs ENABLE ROW LEVEL SECURITY;

-- GUARDIAN PROFILES: own data only
CREATE POLICY "guardian_own_select" ON public.guardian_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "guardian_own_update" ON public.guardian_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "guardian_insert" ON public.guardian_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Club staff/admin can also see guardians of their club's players
CREATE POLICY "guardian_staff_select" ON public.guardian_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      JOIN public.players p ON p.id = pg.player_id
      JOIN public.teams t ON t.id = p.team_id
      WHERE pg.guardian_id = guardian_profiles.id
        AND (
          EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id AND c.owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = t.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
          OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
        )
    )
  );

-- PLAYER GUARDIANS: visible to guardian, club staff, and coaches
CREATE POLICY "pg_guardian_select" ON public.player_guardians FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.guardian_profiles gp WHERE gp.id = guardian_id AND gp.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_id AND (
        EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id AND c.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = t.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
        OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
      )
    )
  );

CREATE POLICY "pg_staff_insert" ON public.player_guardians FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_id AND (
        EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id AND c.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = t.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
      )
    )
  );

CREATE POLICY "pg_staff_delete" ON public.player_guardians FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_id AND (
        EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id AND c.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = t.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
      )
    )
  );

-- ATTENDANCE REQUESTS: club scope
CREATE POLICY "ar_select" ON public.attendance_requests FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
    OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.attendance_responses ar WHERE ar.request_id = attendance_requests.id AND ar.user_id = auth.uid()
    )
  );

CREATE POLICY "ar_insert" ON public.attendance_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "ar_update" ON public.attendance_requests FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()));

-- ATTENDANCE RESPONSES
CREATE POLICY "aresp_select" ON public.attendance_responses FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.attendance_requests ar
      WHERE ar.id = request_id AND (
        ar.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = ar.club_id AND c.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = ar.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
      )
    )
  );

CREATE POLICY "aresp_insert" ON public.attendance_responses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "aresp_update" ON public.attendance_responses FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ATTACHMENTS: club scope
CREATE POLICY "attach_select" ON public.communication_attachments FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
    OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
    OR (message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.communication_messages m
      JOIN public.communication_channel_members cm ON cm.channel_id = m.channel_id
      WHERE m.id = message_id AND cm.user_id = auth.uid()
    ))
  );

CREATE POLICY "attach_insert" ON public.communication_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- PINS: channel members can see, managers can create/delete
CREATE POLICY "pins_select" ON public.communication_pins FOR SELECT TO authenticated
  USING (public.is_channel_member(channel_id, auth.uid()));

CREATE POLICY "pins_insert" ON public.communication_pins FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_channel(channel_id, auth.uid()));

CREATE POLICY "pins_delete" ON public.communication_pins FOR DELETE TO authenticated
  USING (public.can_manage_channel(channel_id, auth.uid()));

-- TEMPLATES: creator or club scope
CREATE POLICY "templates_select" ON public.communication_templates FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (scope = 'club' AND (
      EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
      OR EXISTS (SELECT 1 FROM public.club_coaches cc WHERE cc.club_id = club_id AND cc.coach_id = auth.uid() AND cc.is_active = true)
    ))
  );

CREATE POLICY "templates_insert" ON public.communication_templates FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "templates_update" ON public.communication_templates FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "templates_delete" ON public.communication_templates FOR DELETE TO authenticated USING (created_by = auth.uid());

-- AUTOMATION RULES: creator or club admin
CREATE POLICY "automation_select" ON public.communication_automation_rules FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
  );

CREATE POLICY "automation_insert" ON public.communication_automation_rules FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "automation_update" ON public.communication_automation_rules FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "automation_delete" ON public.communication_automation_rules FOR DELETE TO authenticated USING (created_by = auth.uid());

-- AUTOMATION LOGS: same as rules
CREATE POLICY "autolog_select" ON public.communication_automation_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communication_automation_rules r
      WHERE r.id = rule_id AND (
        r.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = r.club_id AND c.owner_id = auth.uid())
      )
    )
  );

-- Updated_at triggers
CREATE TRIGGER update_guardian_profiles_updated_at BEFORE UPDATE ON public.guardian_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_requests_updated_at BEFORE UPDATE ON public.attendance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_responses_updated_at BEFORE UPDATE ON public.attendance_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.communication_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.communication_automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add club_id ref to teams if not present (needed for guardian RLS)
-- teams should already have club_id from existing schema

-- Storage bucket for communication attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('communication-attachments', 'communication-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for communication-attachments
CREATE POLICY "comm_attach_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'communication-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "comm_attach_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'communication-attachments');

CREATE POLICY "comm_attach_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'communication-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
