
-- ============================================================
-- 1. Enhance communication_channels
-- ============================================================
ALTER TABLE public.communication_channels
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_level TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

-- ============================================================
-- 2. Enhance communication_messages
-- ============================================================
ALTER TABLE public.communication_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS priority_level TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES public.communication_messages(id);

-- ============================================================
-- 3. Enhance communication_channel_members
-- ============================================================
ALTER TABLE public.communication_channel_members
  ADD COLUMN IF NOT EXISTS profile_type TEXT,
  ADD COLUMN IF NOT EXISTS membership_origin TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_level TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 4. communication_member_states (unread tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_member_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.communication_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_message_id UUID REFERENCES public.communication_messages(id),
  last_read_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE public.communication_member_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own member states"
  ON public.communication_member_states FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_member_states_user ON public.communication_member_states(user_id);
CREATE INDEX IF NOT EXISTS idx_member_states_channel ON public.communication_member_states(channel_id);
CREATE INDEX IF NOT EXISTS idx_member_states_unread ON public.communication_member_states(user_id, unread_count) WHERE unread_count > 0;

-- ============================================================
-- 5. communication_notifications (in-app notification center)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  club_id UUID REFERENCES public.clubs(id),
  team_id UUID REFERENCES public.teams(id),
  channel_id UUID REFERENCES public.communication_channels(id),
  notification_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  priority_level TEXT NOT NULL DEFAULT 'normal',
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.communication_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.communication_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts notifications"
  ON public.communication_notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.communication_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.communication_notifications(user_id) WHERE is_read = false;

-- ============================================================
-- 6. Function: increment unread on new message
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_new_message_update_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update channel last message info
  UPDATE public.communication_channels
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = now()
  WHERE id = NEW.channel_id;

  -- Increment unread for all members except sender
  INSERT INTO public.communication_member_states (channel_id, user_id, unread_count, updated_at)
  SELECT NEW.channel_id, cm.user_id, 1, now()
  FROM public.communication_channel_members cm
  WHERE cm.channel_id = NEW.channel_id
    AND cm.user_id != NEW.sender_id
    AND (cm.is_active IS NULL OR cm.is_active = true)
  ON CONFLICT (channel_id, user_id) DO UPDATE
  SET unread_count = communication_member_states.unread_count + 1,
      updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_message_update_channel
  AFTER INSERT ON public.communication_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_message_update_channel();

-- ============================================================
-- 7. Enable realtime for new tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_member_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_notifications;
