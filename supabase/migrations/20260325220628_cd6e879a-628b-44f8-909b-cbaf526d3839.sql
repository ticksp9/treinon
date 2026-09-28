
-- ============================================================
-- SECURITY HARDENING: RLS policies, helper functions, constraints
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- 1. New helper functions for authorization
-- ────────────────────────────────────────────────────────────────

-- Can the user view a channel? (membership OR management permission)
CREATE OR REPLACE FUNCTION public.can_view_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communication_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.communication_channels c
    WHERE c.id = _channel_id
      AND (
        c.created_by = _user_id
        OR c.owner_id = _user_id
      )
  )
$$;

-- Can the user post to a channel?
CREATE OR REPLACE FUNCTION public.can_post_to_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communication_channel_members ccm
    JOIN public.communication_channels c ON c.id = ccm.channel_id
    WHERE ccm.channel_id = _channel_id
      AND ccm.user_id = _user_id
      AND (c.can_members_post = true OR ccm.role = 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.communication_channels c
    WHERE c.id = _channel_id
      AND (c.created_by = _user_id OR c.owner_id = _user_id)
  )
$$;

-- Can the user manage invites for a team?
CREATE OR REPLACE FUNCTION public.can_manage_invite(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id AND t.owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.clubs c ON c.id = t.club_id
    WHERE t.id = _team_id AND c.owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.club_staff cs ON cs.club_id = t.club_id
    WHERE t.id = _team_id AND cs.user_id = _user_id AND cs.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = _team_id AND tc.coach_id = _user_id
  )
$$;

-- Can manage templates (admin-level)
CREATE OR REPLACE FUNCTION public.can_manage_template(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _club_id IS NULL  -- global templates: only if no club scope
    OR EXISTS (SELECT 1 FROM public.clubs WHERE id = _club_id AND owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.club_staff 
      WHERE club_id = _club_id AND user_id = _user_id 
        AND role IN ('admin', 'coordenador') AND is_active = true
    )
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. FIX: communication_channels — membership-based visibility
-- ────────────────────────────────────────────────────────────────

-- Drop all existing SELECT policies
DROP POLICY IF EXISTS "Strict channel visibility" ON public.communication_channels;
DROP POLICY IF EXISTS "Users can view accessible channels" ON public.communication_channels;
DROP POLICY IF EXISTS "Members can view their channels" ON public.communication_channels;

-- New strict policy: membership OR ownership OR admin/coordinator of club
CREATE POLICY "Channel visibility by membership"
ON public.communication_channels
FOR SELECT TO authenticated
USING (
  -- Channel member
  is_channel_member(id, auth.uid())
  -- Channel creator/owner
  OR created_by = auth.uid()
  OR owner_id = auth.uid()
  -- Club admin/coordinator can see channels for management
  OR (club_id IS NOT NULL AND is_club_admin(auth.uid(), club_id))
  OR (club_id IS NOT NULL AND is_youth_coordinator(club_id, auth.uid()))
);

-- ────────────────────────────────────────────────────────────────
-- 3. FIX: communication_messages — strict membership
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can view messages" ON public.communication_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.communication_messages;

-- READ: only members or channel managers
CREATE POLICY "Messages readable by members"
ON public.communication_messages
FOR SELECT TO authenticated
USING (
  is_channel_member(channel_id, auth.uid())
  OR can_manage_channel(channel_id, auth.uid())
);

-- WRITE: only members with posting rights
CREATE POLICY "Messages writable by members"
ON public.communication_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND can_post_to_channel(channel_id, auth.uid())
);

-- ────────────────────────────────────────────────────────────────
-- 4. FIX: communication_channel_members — restrict visibility
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can view channel members" ON public.communication_channel_members;
DROP POLICY IF EXISTS "Channel managers can manage members" ON public.communication_channel_members;

-- See members only if you're also a member or manager
CREATE POLICY "View members if member or manager"
ON public.communication_channel_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_channel_member(channel_id, auth.uid())
  OR can_manage_channel(channel_id, auth.uid())
);

-- Insert/update/delete: only managers
CREATE POLICY "Manage members by channel managers"
ON public.communication_channel_members
FOR ALL TO authenticated
USING (
  can_manage_channel(channel_id, auth.uid())
  OR user_id = auth.uid()
)
WITH CHECK (
  can_manage_channel(channel_id, auth.uid())
  OR user_id = auth.uid()
);

-- ────────────────────────────────────────────────────────────────
-- 5. FIX: invite_templates — close permissive policies
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Read active invite_templates" ON public.invite_templates;
DROP POLICY IF EXISTS "Manage invite_templates" ON public.invite_templates;

-- READ: only admins/coordinators or own templates; service_role for edge functions
CREATE POLICY "Templates readable by authorized users"
ON public.invite_templates
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR owner_coach_id = auth.uid()
  OR (club_id IS NOT NULL AND is_club_admin(auth.uid(), club_id))
  OR (club_id IS NOT NULL AND is_youth_coordinator(club_id, auth.uid()))
  -- Global templates (club_id IS NULL and owner_coach_id IS NULL) readable by all authenticated
  -- This is needed for the send-invite edge function
  OR (club_id IS NULL AND owner_coach_id IS NULL)
);

-- WRITE: only authorized admins
CREATE POLICY "Templates manageable by admins"
ON public.invite_templates
FOR ALL TO authenticated
USING (
  created_by = auth.uid()
  OR (club_id IS NOT NULL AND is_club_admin(auth.uid(), club_id))
  OR (club_id IS NOT NULL AND is_youth_coordinator(club_id, auth.uid()))
)
WITH CHECK (
  created_by = auth.uid()
  OR (club_id IS NOT NULL AND is_club_admin(auth.uid(), club_id))
  OR (club_id IS NOT NULL AND is_youth_coordinator(club_id, auth.uid()))
);

-- ────────────────────────────────────────────────────────────────
-- 6. FIX: invite_template_versions — close USING(true) / OR true
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Read invite_template_versions" ON public.invite_template_versions;
DROP POLICY IF EXISTS "Manage invite_template_versions" ON public.invite_template_versions;

CREATE POLICY "Template versions readable by template owners"
ON public.invite_template_versions
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.invite_templates t
    WHERE t.id = template_id
      AND (
        t.created_by = auth.uid()
        OR (t.club_id IS NOT NULL AND is_club_admin(auth.uid(), t.club_id))
        OR (t.club_id IS NOT NULL AND is_youth_coordinator(t.club_id, auth.uid()))
        OR (t.club_id IS NULL AND t.owner_coach_id IS NULL)
      )
  )
);

CREATE POLICY "Template versions manageable by owners"
ON public.invite_template_versions
FOR ALL TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.invite_templates t
    WHERE t.id = template_id
      AND (t.created_by = auth.uid() OR (t.club_id IS NOT NULL AND is_club_admin(auth.uid(), t.club_id)))
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.invite_templates t
    WHERE t.id = template_id
      AND (t.created_by = auth.uid() OR (t.club_id IS NOT NULL AND is_club_admin(auth.uid(), t.club_id)))
  )
);

-- ────────────────────────────────────────────────────────────────
-- 7. FIX: invite_template_events — close USING(true)
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Read invite_template_events" ON public.invite_template_events;
DROP POLICY IF EXISTS "Insert invite_template_events" ON public.invite_template_events;

CREATE POLICY "Template events readable by template owners"
ON public.invite_template_events
FOR SELECT TO authenticated
USING (
  actor_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.invite_templates t
    WHERE t.id = template_id
      AND (
        t.created_by = auth.uid()
        OR (t.club_id IS NOT NULL AND is_club_admin(auth.uid(), t.club_id))
        OR (t.club_id IS NOT NULL AND is_youth_coordinator(t.club_id, auth.uid()))
      )
  )
);

CREATE POLICY "Template events insertable by actor"
ON public.invite_template_events
FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────
-- 8. FIX: access_invites — restrict by context
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their invites" ON public.access_invites;
DROP POLICY IF EXISTS "Team managers can view invites" ON public.access_invites;
DROP POLICY IF EXISTS "Invite creators can view" ON public.access_invites;

-- Read: creator, team manager, or the invited user (by email or accepted_by)
CREATE POLICY "Invites readable by authorized context"
ON public.access_invites
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR accepted_by_user_id = auth.uid()
  OR can_manage_invite(auth.uid(), team_id)
);

-- ────────────────────────────────────────────────────────────────
-- 9. FIX: invite_deliveries — restrict to context managers
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Delivery readable by managers" ON public.invite_deliveries;
DROP POLICY IF EXISTS "Users can view invite deliveries" ON public.invite_deliveries;
DROP POLICY IF EXISTS "Users can insert invite deliveries" ON public.invite_deliveries;
DROP POLICY IF EXISTS "Users can update invite deliveries" ON public.invite_deliveries;

CREATE POLICY "Deliveries readable by invite context"
ON public.invite_deliveries
FOR SELECT TO authenticated
USING (
  sent_by_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.access_invites ai
    WHERE ai.id = invite_id
      AND (ai.created_by = auth.uid() OR can_manage_invite(auth.uid(), ai.team_id))
  )
);

-- ────────────────────────────────────────────────────────────────
-- 10. FIX: invite_events — restrict to context managers
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Events readable by managers" ON public.invite_events;
DROP POLICY IF EXISTS "Users can view invite events" ON public.invite_events;
DROP POLICY IF EXISTS "Users can insert invite events" ON public.invite_events;

CREATE POLICY "Invite events readable by context"
ON public.invite_events
FOR SELECT TO authenticated
USING (
  actor_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.access_invites ai
    WHERE ai.id = invite_id
      AND (ai.created_by = auth.uid() OR can_manage_invite(auth.uid(), ai.team_id))
  )
);

-- ────────────────────────────────────────────────────────────────
-- 11. Performance indexes for RLS helper functions
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_channel_members_user_channel
  ON public.communication_channel_members(user_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_channel_members_channel_user
  ON public.communication_channel_members(channel_id, user_id);

CREATE INDEX IF NOT EXISTS idx_access_invites_team_id
  ON public.access_invites(team_id);

CREATE INDEX IF NOT EXISTS idx_access_invites_created_by
  ON public.access_invites(created_by);

CREATE INDEX IF NOT EXISTS idx_invite_deliveries_invite_id
  ON public.invite_deliveries(invite_id);

CREATE INDEX IF NOT EXISTS idx_invite_events_invite_id
  ON public.invite_events(invite_id);

CREATE INDEX IF NOT EXISTS idx_invite_templates_club_id
  ON public.invite_templates(club_id);

CREATE INDEX IF NOT EXISTS idx_team_coaches_team_coach
  ON public.team_coaches(team_id, coach_id);
