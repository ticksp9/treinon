
-- Communication channels table
CREATE TABLE public.communication_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'team' CHECK (channel_type IN ('official','team','age_group','role_based','custom')),
  name TEXT NOT NULL,
  description TEXT,
  age_group TEXT,
  target_role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  can_members_post BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Channel members
CREATE TABLE public.communication_channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.communication_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Messages
CREATE TABLE public.communication_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.communication_channels(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Announcements
CREATE TABLE public.communication_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.communication_channels(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','important')),
  target_type TEXT NOT NULL DEFAULT 'channel' CHECK (target_type IN ('channel','age_group','team','role','custom')),
  target_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Announcement read receipts
CREATE TABLE public.communication_announcement_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID REFERENCES public.communication_announcements(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Reminders
CREATE TABLE public.communication_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.communication_channels(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'training' CHECK (reminder_type IN ('training','match','attendance','schedule_change','custom')),
  title TEXT NOT NULL,
  content TEXT,
  scheduled_for TIMESTAMPTZ,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  related_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  related_training_id UUID REFERENCES public.coach_trainings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_reminders ENABLE ROW LEVEL SECURITY;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_messages;

-- Helper: check if user is channel member
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communication_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  )
$$;

-- Helper: check if user can manage channel (creator, club admin, or coordinator)
CREATE OR REPLACE FUNCTION public.can_manage_channel(_channel_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communication_channels c
    WHERE c.id = _channel_id
      AND (
        c.created_by = _user_id
        OR is_club_admin(_user_id, c.club_id)
        OR is_youth_coordinator(c.club_id, _user_id)
      )
  )
$$;

-- RLS: communication_channels
CREATE POLICY "Members can view their channels" ON public.communication_channels
  FOR SELECT TO authenticated
  USING (
    is_club_admin(auth.uid(), club_id)
    OR is_youth_coordinator(club_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.communication_channel_members m
      WHERE m.channel_id = id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and coordinators can create channels" ON public.communication_channels
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      is_club_admin(auth.uid(), club_id)
      OR is_youth_coordinator(club_id, auth.uid())
      OR is_club_coach(auth.uid(), club_id)
      OR is_team_coach(auth.uid(), COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
  );

CREATE POLICY "Channel managers can update" ON public.communication_channels
  FOR UPDATE TO authenticated
  USING (can_manage_channel(id, auth.uid()));

CREATE POLICY "Channel managers can delete" ON public.communication_channels
  FOR DELETE TO authenticated
  USING (can_manage_channel(id, auth.uid()));

-- RLS: communication_channel_members
CREATE POLICY "Members can view channel membership" ON public.communication_channel_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR can_manage_channel(channel_id, auth.uid())
  );

CREATE POLICY "Channel managers can add members" ON public.communication_channel_members
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_channel(channel_id, auth.uid()));

CREATE POLICY "Channel managers can remove members" ON public.communication_channel_members
  FOR DELETE TO authenticated
  USING (can_manage_channel(channel_id, auth.uid()) OR user_id = auth.uid());

-- RLS: communication_messages
CREATE POLICY "Members can view messages" ON public.communication_messages
  FOR SELECT TO authenticated
  USING (is_channel_member(channel_id, auth.uid()) OR can_manage_channel(channel_id, auth.uid()));

CREATE POLICY "Members can send messages" ON public.communication_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (is_channel_member(channel_id, auth.uid()) OR can_manage_channel(channel_id, auth.uid()))
  );

CREATE POLICY "Senders can delete own messages" ON public.communication_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- RLS: communication_announcements
CREATE POLICY "Club members can view announcements" ON public.communication_announcements
  FOR SELECT TO authenticated
  USING (
    is_club_admin(auth.uid(), club_id)
    OR is_youth_coordinator(club_id, auth.uid())
    OR is_club_coach(auth.uid(), club_id)
    OR is_club_staff_member(club_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.communication_announcement_reads r
      WHERE r.announcement_id = id AND r.user_id = auth.uid()
    )
    OR (channel_id IS NOT NULL AND is_channel_member(channel_id, auth.uid()))
  );

CREATE POLICY "Admins coordinators coaches can create announcements" ON public.communication_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      is_club_admin(auth.uid(), club_id)
      OR is_youth_coordinator(club_id, auth.uid())
      OR is_club_coach(auth.uid(), club_id)
    )
  );

CREATE POLICY "Creators can delete announcements" ON public.communication_announcements
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- RLS: communication_announcement_reads
CREATE POLICY "Users can view reads for their announcements" ON public.communication_announcement_reads
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.communication_announcements a
      WHERE a.id = announcement_id AND a.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can mark as read" ON public.communication_announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: communication_reminders
CREATE POLICY "Club members can view reminders" ON public.communication_reminders
  FOR SELECT TO authenticated
  USING (
    is_club_admin(auth.uid(), club_id)
    OR is_youth_coordinator(club_id, auth.uid())
    OR is_club_coach(auth.uid(), club_id)
    OR (channel_id IS NOT NULL AND is_channel_member(channel_id, auth.uid()))
  );

CREATE POLICY "Admins coordinators coaches can create reminders" ON public.communication_reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      is_club_admin(auth.uid(), club_id)
      OR is_youth_coordinator(club_id, auth.uid())
      OR is_club_coach(auth.uid(), club_id)
    )
  );

CREATE POLICY "Creators can update reminders" ON public.communication_reminders
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creators can delete reminders" ON public.communication_reminders
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
